import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { loadEnvFile } from "./env.js";
import { createStore } from "./store.js";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(sourceDirectory, "..");
const publicDirectory = path.join(projectDirectory, "public");

const envFile = path.join(projectDirectory, ".env");
try {
  if (loadEnvFile(envFile)) console.log(`loaded settings from ${envFile}`);
} catch (error) {
  console.error(`journey could not read ${envFile}; continuing with the current environment.`);
  console.error(error.message);
}

const host = process.env.HOST || "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "3000", 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a number between 1 and 65535.");
}

let store;
try {
  store = createStore();
  if (typeof store.init === "function") await store.init();
} catch (error) {
  console.error("journey could not open its journal storage.");
  if (store && store.kind === "neon") {
    console.error(
      "Check DATABASE_URL in .env (or in the Vercel project settings) and that the Neon database is running."
    );
  }
  console.error(error.message);
  process.exit(1);
}

const app = createApp({
  store,
  publicDirectory
});

const server = app.listen(port, host, () => {
  const address = server.address();
  const listeningPort = address && typeof address === "object" ? address.port : port;
  console.log(`journey is running at http://${host}:${listeningPort}`);
  if (store.kind === "filesystem") {
    console.log(`journey data is stored in ${store.dataDirectory}`);
  } else {
    console.log("journey data is stored in Neon.");
  }
  const authConfigured = Boolean(
    process.env.JOURNEY_ADMIN_PASSWORD || process.env.JOURNEY_ADMIN_PASSWORD_HASH
  );
  if (authConfigured) {
    console.log(
      `admin sign-in is enabled for username "${process.env.JOURNEY_ADMIN_USERNAME || "admin"}".`
    );
  } else if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
    console.log(
      "admin sign-in is using the local defaults (username: admin, password: journey). " +
        "Create a .env file to choose your own."
    );
  } else {
    console.log("admin sign-in is not configured; the journal is read-only.");
  }
});

function shutdown(signal) {
  console.log(`\njourney received ${signal}; shutting down.`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
