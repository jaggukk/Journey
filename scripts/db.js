import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "../src/env.js";
import { JournalStore } from "../src/journal-store.js";
import { NeonJournalStore } from "../src/neon-store.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
loadEnvFile(path.join(projectDirectory, ".env"));

const command = process.argv[2] || "check";
const force = process.argv.includes("--force");
const databaseUrl = process.env.DATABASE_URL;

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function describeDatabase(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch (error) {
    return "DATABASE_URL";
  }
}

function localDataDirectory() {
  return path.resolve(
    process.env.JOURNEY_DATA_DIR || path.join(projectDirectory, "data")
  );
}

async function readLocalJournal() {
  const store = new JournalStore(localDataDirectory());
  await store.init();
  const state = await store.readState();
  const docs = state ? await store.readDocs() : {};
  return { state, docs };
}

async function check(store) {
  const state = await store.readState();
  const docs = await store.readDocs();
  const ids = Object.keys(docs);
  const bytes = ids.reduce((total, id) => total + String(docs[id] || "").length, 0);

  console.log(`database: ${describeDatabase(databaseUrl)}`);
  console.log("tables: journey_state, journey_docs (ready)");
  console.log(`journal state: ${state ? "present" : "empty"}`);
  console.log(`documents: ${ids.length}`);
  if (ids.length) {
    const largest = ids.reduce((biggest, id) =>
      String(docs[id] || "").length > String(docs[biggest] || "").length ? id : biggest
    );
    console.log(`stored text and pictures: ${(bytes / 1024).toFixed(1)} KB`);
    console.log(`largest record: ${largest} (${(String(docs[largest]).length / 1024).toFixed(1)} KB)`);
  }
}

async function importLocal(store) {
  const { state, docs } = await readLocalJournal();
  if (!state) {
    fail(`No journal found in ${localDataDirectory()}. Nothing to import.`);
    return;
  }

  const existing = await store.readState();
  if (existing && !force) {
    fail(
      "The Neon database already holds a journal. Re-run with --force to replace it:\n" +
        "  npm run db:import -- --force"
    );
    return;
  }

  await store.replaceJournal(state, docs);
  const count = Object.keys(docs).length;
  console.log(`imported ${count} document${count === 1 ? "" : "s"} into Neon.`);
  console.log("Restart the server, then reload the site.");
}

if (!databaseUrl) {
  fail(
    "DATABASE_URL is not set.\n" +
      "Add your Neon connection string to .env, for example:\n" +
      "  DATABASE_URL=postgresql://user:password@ep-xxx.aws.neon.tech/neondb?sslmode=require"
  );
} else if (!["check", "import"].includes(command)) {
  fail(`Unknown command "${command}". Use "check" or "import".`);
} else {
  const store = new NeonJournalStore(databaseUrl);
  try {
    await store.init();
    if (command === "check") await check(store);
    else await importLocal(store);
  } catch (error) {
    fail(`Neon database error: ${error.message}`);
  }
}
