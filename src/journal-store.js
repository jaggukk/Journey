import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

async function atomicWriteJson(filePath, value) {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );

  try {
    await writeFile(temporaryPath, JSON.stringify(value), "utf8");
    await rename(temporaryPath, filePath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

function documentFileName(id) {
  return `${Buffer.from(id, "utf8").toString("base64url")}.json`;
}

export class JournalStore {
  constructor(dataDirectory) {
    this.kind = "filesystem";
    this.dataDirectory = path.resolve(dataDirectory);
    this.generationsDirectory = path.join(this.dataDirectory, "generations");
    this.pointerPath = path.join(this.dataDirectory, "current.json");
    this.queue = Promise.resolve();
  }

  async init() {
    await mkdir(this.generationsDirectory, { recursive: true });
  }

  withLock(operation) {
    const result = this.queue.then(operation, operation);
    this.queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  async readPointer() {
    try {
      const pointer = JSON.parse(await readFile(this.pointerPath, "utf8"));
      const generation = typeof pointer.generation === "string" ? pointer.generation : "";
      if (!/^[a-f0-9-]+$/i.test(generation)) return "";
      return generation;
    } catch (error) {
      if (error && error.code === "ENOENT") return "";
      throw error;
    }
  }

  generationPath(generation) {
    return path.join(this.generationsDirectory, generation);
  }

  async currentGenerationPath() {
    const generation = await this.readPointer();
    return generation ? this.generationPath(generation) : "";
  }

  async ensureGenerationPath() {
    const existing = await this.currentGenerationPath();
    if (existing) return existing;

    const generation = randomUUID();
    const generationPath = this.generationPath(generation);
    await mkdir(path.join(generationPath, "docs"), { recursive: true });
    await atomicWriteJson(this.pointerPath, { generation });
    return generationPath;
  }

  async readState() {
    return this.withLock(async () => {
      const generationPath = await this.currentGenerationPath();
      if (!generationPath) return null;
      try {
        return JSON.parse(await readFile(path.join(generationPath, "state.json"), "utf8"));
      } catch (error) {
        if (error && error.code === "ENOENT") return null;
        throw error;
      }
    });
  }

  async writeState(state) {
    return this.withLock(async () => {
      const generationPath = await this.ensureGenerationPath();
      await atomicWriteJson(path.join(generationPath, "state.json"), state);
      return state;
    });
  }

  async readDocs() {
    return this.withLock(async () => {
      const generationPath = await this.currentGenerationPath();
      if (!generationPath) return {};

      const docsDirectory = path.join(generationPath, "docs");
      let entries;
      try {
        entries = await readdir(docsDirectory, { withFileTypes: true });
      } catch (error) {
        if (error && error.code === "ENOENT") return {};
        throw error;
      }

      const docs = {};
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name.startsWith(".")) continue;
        const id = Buffer.from(entry.name.slice(0, -5), "base64url").toString("utf8");
        const value = JSON.parse(await readFile(path.join(docsDirectory, entry.name), "utf8"));
        docs[id] = value;
      }
      return docs;
    });
  }

  async writeDoc(id, value) {
    return this.withLock(async () => {
      const generationPath = await this.ensureGenerationPath();
      await atomicWriteJson(path.join(generationPath, "docs", documentFileName(id)), value);
      return value;
    });
  }

  async deleteDocs(ids) {
    return this.withLock(async () => {
      const generationPath = await this.currentGenerationPath();
      if (!generationPath) return;

      const docsDirectory = path.join(generationPath, "docs");
      await Promise.all(
        ids.map((id) => rm(path.join(docsDirectory, documentFileName(id)), { force: true }))
      );
    });
  }

  async replaceJournal(state, docs) {
    return this.withLock(async () => {
      const previousGeneration = await this.readPointer();
      const generation = randomUUID();
      const generationPath = this.generationPath(generation);
      const docsDirectory = path.join(generationPath, "docs");

      try {
        await mkdir(docsDirectory, { recursive: true });
        await atomicWriteJson(path.join(generationPath, "state.json"), state);
        for (const [id, value] of Object.entries(docs)) {
          await atomicWriteJson(path.join(docsDirectory, documentFileName(id)), value);
        }

        await atomicWriteJson(this.pointerPath, { generation });
        if (previousGeneration && previousGeneration !== generation) {
          await rm(this.generationPath(previousGeneration), { recursive: true, force: true });
        }
        return { state, docs };
      } catch (error) {
        await rm(generationPath, { recursive: true, force: true }).catch(() => {});
        throw error;
      }
    });
  }
}
