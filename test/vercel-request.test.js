import test from "node:test";
import assert from "node:assert/strict";
import { prepareRequest } from "../src/vercel-request.js";

test("platform helper body is materialized into a writable property", () => {
  const parsed = { username: "jaggu_kk", password: "secret" };
  const request = {};
  Object.defineProperty(request, "body", {
    configurable: true,
    enumerable: true,
    get() {
      return parsed;
    }
  });

  const result = prepareRequest(request);

  assert.equal(result.ok, true);
  assert.deepEqual(request.body, parsed);
  assert.deepEqual(Object.getOwnPropertyDescriptor(request, "body").value, parsed);
  assert.equal(Object.getOwnPropertyDescriptor(request, "body").writable, true);

  // body-parser assigns to request.body in strict mode after reading the stream.
  assert.doesNotThrow(() => {
    request.body = { username: "other" };
  });
  assert.deepEqual(request.body, { username: "other" });
});

test("a plain request is left untouched", () => {
  const request = { method: "POST", headers: {} };
  const result = prepareRequest(request);
  assert.equal(result.ok, true);
  assert.equal("body" in request, false);
});

test("inherited helper accessors are shadowed with a data property", () => {
  const prototype = {};
  Object.defineProperty(prototype, "body", {
    configurable: true,
    get() {
      return { ok: true };
    }
  });
  const request = Object.create(prototype);

  const result = prepareRequest(request);

  assert.equal(result.ok, true);
  assert.deepEqual(request.body, { ok: true });
  assert.doesNotThrow(() => {
    request.body = { replaced: true };
  });
  assert.deepEqual(request.body, { replaced: true });
});

test("query and cookies helper accessors are removed so Express owns them", () => {
  const request = {};
  for (const property of ["query", "cookies"]) {
    Object.defineProperty(request, property, {
      configurable: true,
      enumerable: true,
      get() {
        return {};
      }
    });
  }

  const result = prepareRequest(request);

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(request, "query"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(request, "cookies"), false);
});

test("an unreadable helper body is reported instead of crashing", () => {
  const request = {};
  Object.defineProperty(request, "body", {
    configurable: true,
    get() {
      throw new SyntaxError("Invalid JSON");
    }
  });

  const result = prepareRequest(request);

  assert.equal(result.ok, false);
  assert.equal(result.error.message, "Invalid JSON");
});
