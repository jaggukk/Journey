import path from "node:path";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";
import { prepareRequest } from "../src/vercel-request.js";

let app = null;
let startupError = null;

function sendJson(response, statusCode, payload) {
  if (response.headersSent) return;
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

try {
  const store = createStore();
  app = createApp({
    store,
    publicDirectory: path.join(process.cwd(), "public")
  });
} catch (error) {
  startupError = error;
  console.error("journey: the API function could not start.", error);
}

function fail(response, error) {
  console.error("journey: the API function failed.", error);
  sendJson(response, 500, {
    error: "The journey server could not complete that request."
  });
}

export default function handler(request, response) {
  if (startupError) {
    sendJson(response, 503, {
      error: `The journey server is not configured correctly: ${startupError.message}`
    });
    return;
  }

  const prepared = prepareRequest(request);
  if (!prepared.ok) {
    console.error("journey: the request body could not be read.", prepared.error);
    sendJson(response, 400, {
      error: "The request did not contain valid JSON."
    });
    return;
  }

  try {
    const result = app(request, response);
    if (result && typeof result.catch === "function") {
      result.catch((error) => fail(response, error));
    }
  } catch (error) {
    fail(response, error);
  }
}
