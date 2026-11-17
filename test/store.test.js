import assert from "node:assert/strict";
import test from "node:test";
import { createStore } from "../src/store.js";

function withDatabaseUrl(value, run) {
  const previous = process.env.DATABASE_URL;
  if (value === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = value;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
}

test("notes and pictures go to Neon when DATABASE_URL is set", () => {
  withDatabaseUrl("postgresql://user:pass@ep-test.neon.tech/neondb?sslmode=require", () => {
    const store = createStore();
    assert.equal(store.kind, "neon");
  });
});

test("storage falls back to the data folder without DATABASE_URL", () => {
  withDatabaseUrl(undefined, () => {
    const store = createStore({ dataDirectory: "./data" });
    assert.equal(store.kind, "filesystem");
  });
});
