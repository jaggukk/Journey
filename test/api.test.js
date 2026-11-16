import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { JournalStore } from "../src/journal-store.js";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function stateWithNote(name) {
  return {
    version: 1,
    root: {
      id: "f_root",
      type: "folder",
      name: "root",
      children: [
        {
          id: "n_one",
          type: "note",
          name,
          createdAt: 1,
          updatedAt: 2
        }
      ],
      createdAt: 1,
      updatedAt: 2
    },
    fonts: [],
    expanded: ["f_root"],
    selectedFolderId: "f_root",
    welcomeId: "n_one",
    lastNoteId: "n_one"
  };
}

async function startTestServer(t) {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "journey-test-"));
  const store = new JournalStore(dataDirectory);
  await store.init();
  const app = createApp({ store, publicDirectory: projectDirectory });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dataDirectory, { recursive: true, force: true });
  });

  return { baseUrl, dataDirectory };
}

async function jsonRequest(baseUrl, resource, options) {
  const response = await fetch(baseUrl + resource, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options && options.body ? { "Content-Type": "application/json" } : {})
    }
  });
  const body = await response.json();
  return { response, body };
}

test("health reports server storage", async (t) => {
  const { baseUrl } = await startTestServer(t);
  const { response, body } = await jsonRequest(baseUrl, "/api/health");

  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true, app: "journey", storage: "server" });
});

test("state and documents round-trip through the API", async (t) => {
  const { baseUrl } = await startTestServer(t);
  const state = stateWithNote("A note");

  let result = await jsonRequest(baseUrl, "/api/state");
  assert.equal(result.response.status, 200);
  assert.equal(result.body.state, null);

  result = await jsonRequest(baseUrl, "/api/state", {
    method: "PUT",
    body: JSON.stringify({ state })
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.state.root.children[0].name, "A note");

  result = await jsonRequest(baseUrl, "/api/docs/n_one", {
    method: "PUT",
    body: JSON.stringify({ value: "<p>Hello</p>" })
  });
  assert.equal(result.response.status, 200);

  result = await jsonRequest(baseUrl, "/api/journal");
  assert.equal(result.body.state.root.children[0].id, "n_one");
  assert.equal(result.body.docs.n_one, "<p>Hello</p>");
});

test("import atomically replaces the previous journal", async (t) => {
  const { baseUrl } = await startTestServer(t);

  await jsonRequest(baseUrl, "/api/state", {
    method: "PUT",
    body: JSON.stringify({ state: stateWithNote("Old") })
  });
  await jsonRequest(baseUrl, "/api/docs/n_one", {
    method: "PUT",
    body: JSON.stringify({ value: "<p>Old note</p>" })
  });

  const importedState = stateWithNote("Imported");
  const result = await jsonRequest(baseUrl, "/api/import", {
    method: "POST",
    body: JSON.stringify({
      state: importedState,
      docs: { n_one: "<p>Imported note</p>" }
    })
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.fileCount, 1);

  const journal = await jsonRequest(baseUrl, "/api/journal");
  assert.equal(journal.body.state.root.children[0].name, "Imported");
  assert.equal(journal.body.docs.n_one, "<p>Imported note</p>");
});

test("invalid payloads are rejected without replacing data", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const result = await jsonRequest(baseUrl, "/api/state", {
    method: "PUT",
    body: JSON.stringify({ state: { root: null } })
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /root folder|not readable/i);

  const journal = await jsonRequest(baseUrl, "/api/journal");
  assert.equal(journal.body.state, null);
});

test("journal data survives a new store instance", async (t) => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "journey-restart-"));
  t.after(() => rm(dataDirectory, { recursive: true, force: true }));

  const firstStore = new JournalStore(dataDirectory);
  await firstStore.init();
  const state = stateWithNote("Persisted");
  await firstStore.replaceJournal(state, { n_one: "<p>Still here</p>" });

  const secondStore = new JournalStore(dataDirectory);
  await secondStore.init();
  assert.equal((await secondStore.readState()).root.children[0].name, "Persisted");
  assert.equal((await secondStore.readDocs()).n_one, "<p>Still here</p>");
});

test("the web app is served without exposing server source or data", async (t) => {
  const { baseUrl } = await startTestServer(t);

  let response = await fetch(baseUrl + "/");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /id="workspace"/);

  response = await fetch(baseUrl + "/src/server.js");
  assert.equal(response.status, 404);

  response = await fetch(baseUrl + "/data/current.json");
  assert.equal(response.status, 404);
});
