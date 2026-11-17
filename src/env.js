import { readFileSync } from "node:fs";

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
  const separator = withoutExport.indexOf("=");
  if (separator < 1) return null;

  const key = withoutExport.slice(0, separator).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  let value = withoutExport.slice(separator + 1).trim();
  const doubleQuoted = value.length >= 2 && value.startsWith('"') && value.endsWith('"');
  const singleQuoted = value.length >= 2 && value.startsWith("'") && value.endsWith("'");

  if (doubleQuoted || singleQuoted) {
    value = value.slice(1, -1);
    if (doubleQuoted) {
      value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
    }
  } else {
    const comment = value.search(/\s#/);
    if (comment !== -1) value = value.slice(0, comment).trim();
  }

  return { key, value };
}

export function loadEnvFile(filePath) {
  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }

  text.split(/\r?\n/).forEach((line) => {
    const entry = parseLine(line);
    if (!entry) return;
    if (process.env[entry.key] !== undefined) return;
    process.env[entry.key] = entry.value;
  });

  return true;
}
