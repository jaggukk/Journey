import express from "express";
import path from "node:path";
import { createAuth } from "./auth.js";
import { blobConfigured, uploadImageDataUrl } from "./images.js";
import {
  ValidationError,
  normalizeDocumentId,
  normalizeDocumentValue,
  normalizeDocs,
  normalizeState
} from "./validation.js";

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

// Streams key/value pairs so responses are not capped by the platform's
// buffered body limit (Vercel: 4.5 MB) as pictures accumulate.
function writeJsonPairs(response, entries, first) {
  let started = first;
  for (const [key, value] of entries) {
    if (!started) response.write(",");
    started = false;
    response.write(JSON.stringify(key) + ":" + JSON.stringify(value));
  }
  return started;
}

function streamJsonMap(response, entries, prefix, suffix) {
  response.set("Content-Type", "application/json; charset=utf-8");
  response.write(prefix);
  writeJsonPairs(response, entries, true);
  response.end(suffix);
}

export function createApp(options) {
  const opts = options || {};
  if (!opts.store) throw new Error("createApp requires a journal store.");
  const store = opts.store;
  const publicDirectory = path.resolve(opts.publicDirectory || process.cwd());
  const auth = opts.auth || createAuth(opts.authOptions);
  const imageMode = opts.imageMode || (blobConfigured() ? "blob" : "inline");
  const requestLimit =
    process.env.JOURNEY_REQUEST_LIMIT || (process.env.VERCEL ? "4.2mb" : "100mb");

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);

  app.use((request, response, next) => {
    response.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
    });
    next();
  });

  app.use(
    "/api",
    express.json({
      limit: requestLimit,
      strict: true
    })
  );

  app.use("/api", (request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (request, response) => {
    response.json({
      ok: true,
      app: "journey",
      storage: "server",
      backend: store.kind || "filesystem",
      images: imageMode,
      runtime: {
        node: process.version,
        platform: process.env.VERCEL ? "vercel" : "local",
        helpers: process.env.NODEJS_HELPERS === "0" ? "disabled" : "default"
      },
      ...auth.status(request)
    });
  });

  app.post("/api/login", auth.login);
  app.post("/api/logout", auth.logout);

  app.get(
    "/api/state",
    asyncRoute(async (request, response) => {
      const state = await store.readState();
      response.json({ state: state || null });
    })
  );

  app.put(
    "/api/state",
    auth.requireEditor,
    asyncRoute(async (request, response) => {
      const state = normalizeState(request.body && request.body.state);
      await store.writeState(state);
      response.json({ ok: true, state });
    })
  );

  app.get(
    "/api/docs",
    asyncRoute(async (request, response) => {
      const docs = await store.readDocs();
      streamJsonMap(response, Object.entries(docs), '{"docs":{', "}}");
    })
  );

  app.put(
    "/api/docs/:id",
    auth.requireEditor,
    asyncRoute(async (request, response) => {
      const id = normalizeDocumentId(request.params.id);
      const value = normalizeDocumentValue(request.body && request.body.value);
      await store.writeDoc(id, value);
      response.json({ ok: true, id });
    })
  );

  app.delete(
    "/api/docs",
    auth.requireEditor,
    asyncRoute(async (request, response) => {
      const ids = request.body && request.body.ids;
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
        throw new ValidationError("Choose valid journal documents to delete.");
      }
      const normalizedIds = [...new Set(ids.map(normalizeDocumentId))];
      await store.deleteDocs(normalizedIds);
      response.json({ ok: true, deleted: normalizedIds.length });
    })
  );

  app.get(
    "/api/journal",
    asyncRoute(async (request, response) => {
      const [state, docs] = await Promise.all([store.readState(), store.readDocs()]);
      response.set("Content-Type", "application/json; charset=utf-8");
      response.write('{"state":' + JSON.stringify(state || null) + ',"docs":{');
      writeJsonPairs(response, Object.entries(docs), true);
      response.end("}}");
    })
  );

  app.post(
    "/api/import",
    auth.requireEditor,
    asyncRoute(async (request, response) => {
      const body = request.body || {};
      const state = normalizeState(body.state);
      const docs = normalizeDocs(body.docs);
      await store.replaceJournal(state, docs);
      response.json({ ok: true, fileCount: Object.keys(docs).length });
    })
  );

  app.post(
    "/api/images",
    auth.requireEditor,
    asyncRoute(async (request, response) => {
      if (imageMode !== "blob") {
        response.status(409).json({ error: "Image uploads are stored inline on this server." });
        return;
      }
      const url = await uploadImageDataUrl(request.body && request.body.dataUrl);
      response.json({ ok: true, url });
    })
  );

  app.use("/api", (request, response) => {
    response.status(404).json({ error: "That journey API endpoint does not exist." });
  });

  app.get("/", (request, response) => {
    response.sendFile(path.join(publicDirectory, "index.html"));
  });

  app.get("/index.html", (request, response) => {
    response.sendFile(path.join(publicDirectory, "index.html"));
  });

  app.get("/styles.css", (request, response) => {
    response.sendFile(path.join(publicDirectory, "styles.css"));
  });

  app.use("/js", express.static(path.join(publicDirectory, "js"), { index: false }));
  app.use("/assets", express.static(path.join(publicDirectory, "assets"), { index: false }));

  app.use((request, response) => {
    response.status(404).send("Not found");
  });

  app.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (error instanceof ValidationError) {
      response.status(error.status || 400).json({ error: error.message });
      return;
    }

    if (error && error.type === "entity.too.large") {
      response.status(413).json({ error: "That change is too large for the journey server." });
      return;
    }

    if (error && error.type === "entity.parse.failed") {
      response.status(400).json({ error: "The request did not contain valid JSON." });
      return;
    }

    console.error("journey: request failed", error);
    response.status(500).json({ error: "The journey server could not complete that request." });
  });

  return app;
}
