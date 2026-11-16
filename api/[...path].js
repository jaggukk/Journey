import path from "node:path";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

const store = createStore();
const app = createApp({
  store,
  publicDirectory: path.join(process.cwd(), "public")
});

export default app;
