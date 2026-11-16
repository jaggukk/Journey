const MAX_DOCUMENT_CHARS = 16 * 1024 * 1024;
const MAX_DOCUMENTS = 10_000;
const MAX_NODES = 10_000;
const MAX_FONTS = 500;

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.status = 400;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanName(value, fallback) {
  const name = String(value == null ? "" : value)
    .replace(/[/\\\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 80)
    .trim();
  return name || fallback;
}

function cleanId(value) {
  const id = String(value == null ? "" : value).trim();
  if (!id || id.length > 160 || /[\u0000-\u001f\u007f]/.test(id)) return "";
  return id;
}

function normalizeNode(raw, seen, counter) {
  if (!isPlainObject(raw)) return null;
  if (raw.type !== "folder" && raw.type !== "note" && raw.type !== "image") return null;

  counter.count += 1;
  if (counter.count > MAX_NODES) {
    throw new ValidationError(`A journal cannot contain more than ${MAX_NODES.toLocaleString()} files and folders.`);
  }

  let id = cleanId(raw.id);
  if (!id || seen.has(id)) {
    do {
      id = `${raw.type.charAt(0)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    } while (seen.has(id));
  }
  seen.add(id);

  const createdAt = Number(raw.createdAt) || Date.now();
  const node = {
    id,
    type: raw.type,
    name: cleanName(
      raw.name,
      raw.type === "folder" ? "folder" : raw.type === "note" ? "Untitled note" : "picture"
    ),
    createdAt,
    updatedAt: Number(raw.updatedAt) || createdAt
  };

  if (raw.type === "folder") {
    const children = Array.isArray(raw.children) ? raw.children : [];
    node.children = children
      .map((child) => normalizeNode(child, seen, counter))
      .filter(Boolean);
  }

  if (raw.type === "image") {
    node.mime = typeof raw.mime === "string" ? raw.mime.slice(0, 60) : "image/webp";
    node.ext = typeof raw.ext === "string" ? raw.ext.slice(0, 10) : "";
    node.width = Number(raw.width) || 0;
    node.height = Number(raw.height) || 0;
  }

  return node;
}

export function normalizeState(raw) {
  if (!isPlainObject(raw) || !isPlainObject(raw.root)) {
    throw new ValidationError("The journal state is not readable.");
  }

  const seen = new Set();
  const root = normalizeNode(raw.root, seen, { count: 0 });
  if (!root || root.type !== "folder") {
    throw new ValidationError("The journal must have a root folder.");
  }

  const folderIds = new Set();
  const noteIds = new Set();
  const collectIds = (node) => {
    if (node.type === "folder") {
      folderIds.add(node.id);
      node.children.forEach(collectIds);
    } else if (node.type === "note") {
      noteIds.add(node.id);
    }
  };
  collectIds(root);

  const fonts = Array.isArray(raw.fonts)
    ? raw.fonts
        .filter((font) => isPlainObject(font) && typeof font.family === "string" && typeof font.url === "string")
        .slice(0, MAX_FONTS)
        .map((font) => ({
          id: cleanId(font.id) || `font_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
          family: cleanName(font.family, "Font").slice(0, 60),
          url: font.url.slice(0, 2000),
          addedAt: Number(font.addedAt) || Date.now()
        }))
    : [];

  const expanded = Array.isArray(raw.expanded)
    ? [...new Set(raw.expanded.filter((id) => typeof id === "string" && folderIds.has(id)))]
    : [];

  const state = {
    version: 1,
    root,
    fonts,
    expanded: expanded.includes(root.id) ? expanded : [root.id, ...expanded],
    selectedFolderId: folderIds.has(raw.selectedFolderId) ? raw.selectedFolderId : root.id,
    welcomeId: noteIds.has(raw.welcomeId) ? raw.welcomeId : "",
    lastNoteId: noteIds.has(raw.lastNoteId) ? raw.lastNoteId : ""
  };

  if (!state.welcomeId) {
    const welcome = findFirstNote(state.root, "About This Website") || findFirstNote(state.root);
    state.welcomeId = welcome ? welcome.id : "";
  }
  if (!state.lastNoteId) {
    const first = findFirstNote(state.root);
    state.lastNoteId = first ? first.id : "";
  }

  return state;
}

function findFirstNote(node, expectedName) {
  if (node.type === "note" && (!expectedName || node.name === expectedName)) return node;
  if (node.type !== "folder") return null;
  for (const child of node.children) {
    const found = findFirstNote(child, expectedName);
    if (found) return found;
  }
  return null;
}

export function normalizeDocs(raw) {
  if (!isPlainObject(raw)) {
    throw new ValidationError("The journal documents are not readable.");
  }

  const entries = Object.entries(raw);
  if (entries.length > MAX_DOCUMENTS) {
    throw new ValidationError(`A journal cannot contain more than ${MAX_DOCUMENTS.toLocaleString()} documents.`);
  }

  const docs = {};
  for (const [rawId, rawValue] of entries) {
    const id = cleanId(rawId);
    if (!id) throw new ValidationError("A journal document has an invalid identifier.");
    if (typeof rawValue !== "string") {
      throw new ValidationError(`The document “${id}” must contain text.`);
    }
    if (rawValue.length > MAX_DOCUMENT_CHARS) {
      throw new ValidationError(`The document “${id}” is too large to save.`);
    }
    docs[id] = rawValue;
  }

  return docs;
}

export function normalizeDocumentId(rawId) {
  const id = cleanId(rawId);
  if (!id) throw new ValidationError("A journal document has an invalid identifier.");
  return id;
}

export function normalizeDocumentValue(rawValue) {
  if (typeof rawValue !== "string") {
    throw new ValidationError("A journal document must contain text.");
  }
  if (rawValue.length > MAX_DOCUMENT_CHARS) {
    throw new ValidationError("That document is too large to save.");
  }
  return rawValue;
}
