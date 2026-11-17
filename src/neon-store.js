import { neon } from "@neondatabase/serverless";

function parseState(value) {
  if (!value) return null;
  return typeof value === "string" ? JSON.parse(value) : value;
}

export class NeonJournalStore {
  constructor(databaseUrl) {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for Neon storage.");
    }
    this.kind = "neon";
    this.sql = neon(databaseUrl);
    this.schemaPromise = null;
  }

  async init() {
    await this.ensureSchema();
    return this;
  }

  ensureSchema() {
    if (!this.schemaPromise) {
      this.schemaPromise = (async () => {
        await this.sql`
          CREATE TABLE IF NOT EXISTS journey_state (
            id TEXT PRIMARY KEY,
            data JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await this.sql`
          CREATE TABLE IF NOT EXISTS journey_docs (
            id TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
      })().catch((error) => {
        this.schemaPromise = null;
        throw error;
      });
    }
    return this.schemaPromise;
  }

  async readState() {
    await this.ensureSchema();
    const rows = await this.sql`
      SELECT data FROM journey_state WHERE id = 'default' LIMIT 1
    `;
    return rows.length ? parseState(rows[0].data) : null;
  }

  async writeState(state) {
    await this.ensureSchema();
    await this.sql`
      INSERT INTO journey_state (id, data, updated_at)
      VALUES ('default', ${JSON.stringify(state)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return state;
  }

  async readDocs() {
    await this.ensureSchema();
    const rows = await this.sql`SELECT id, value FROM journey_docs`;
    const docs = {};
    for (const row of rows) docs[row.id] = row.value;
    return docs;
  }

  async readDocsByIds(ids) {
    if (!ids.length) return {};
    await this.ensureSchema();
    const rows = await this.sql`
      SELECT id, value FROM journey_docs WHERE id = ANY(${ids}::text[])
    `;
    const docs = {};
    for (const row of rows) docs[row.id] = row.value;
    return docs;
  }

  async writeDoc(id, value) {
    await this.ensureSchema();
    await this.sql`
      INSERT INTO journey_docs (id, value, updated_at)
      VALUES (${id}, ${value}, NOW())
      ON CONFLICT (id) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW()
    `;
    return value;
  }

  async deleteDocs(ids) {
    if (!ids.length) return {};
    await this.ensureSchema();
    const previous = await this.readDocsByIds(ids);
    await this.sql`DELETE FROM journey_docs WHERE id = ANY(${ids}::text[])`;
    return previous;
  }

  async replaceJournal(state, docs) {
    await this.ensureSchema();
    const docsJson = JSON.stringify(docs);
    await this.sql.transaction([
      this.sql`DELETE FROM journey_docs`,
      this.sql`
        INSERT INTO journey_state (id, data, updated_at)
        VALUES ('default', ${JSON.stringify(state)}::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = NOW()
      `,
      this.sql`
        INSERT INTO journey_docs (id, value, updated_at)
        SELECT key, value, NOW() FROM jsonb_each_text(${docsJson}::jsonb)
      `
    ]);
    return { state, docs };
  }
}
