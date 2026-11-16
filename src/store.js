import path from "node:path";
import { JournalStore } from "./journal-store.js";
import { NeonJournalStore } from "./neon-store.js";

export function createStore(options) {
  const opts = options || {};
  if (process.env.DATABASE_URL) {
    return new NeonJournalStore(process.env.DATABASE_URL);
  }

  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is required on Vercel. Connect a Neon database to the project.");
  }

  const dataDirectory =
    opts.dataDirectory ||
    process.env.JOURNEY_DATA_DIR ||
    path.join(process.cwd(), "data");
  return new JournalStore(dataDirectory);
}
