import path from "node:path";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

let app = null;
let startupError = null;

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

export default function handler(request, response) {
  if (startupError) {
    response.statusCode = 503;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(
      JSON.stringify({
        error: `The journey server is not configured correctly: ${startupError.message}`
      })
    );
    return;
  }
  return app(request, response);
}
