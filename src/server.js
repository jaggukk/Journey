import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createStore } from "./store.js";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(sourceDirectory, "..");
const publicDirectory = path.join(projectDirectory, "public");
const host = process.env.HOST || "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "3000", 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a number between 1 and 65535.");
}

const store = createStore();
if (typeof store.init === "function") await store.init();

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
  if (!process.env.JOURNEY_ADMIN_PASSWORD && !process.env.JOURNEY_ADMIN_PASSWORD_HASH) {
    console.log("admin login is not configured; local editing is open.");
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
