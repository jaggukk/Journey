import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { ValidationError } from "./validation.js";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_EXTENSIONS = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif"
};

export function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function parseImageDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") {
    throw new ValidationError("That picture is not readable.");
  }
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([a-z0-9+/=\s]+)$/i);
  if (!match) {
    throw new ValidationError("Use a PNG, JPEG, WebP, GIF, or AVIF picture.");
  }

  const mime = match[1].toLowerCase();
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length) throw new ValidationError("That picture is empty.");
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ValidationError("That picture is larger than 3 MB after compression.");
  }

  return { mime, buffer, extension: IMAGE_EXTENSIONS[mime] };
}

export async function uploadImageDataUrl(dataUrl) {
  if (!blobConfigured()) {
    throw new Error("Vercel Blob is not configured on this server.");
  }

  const image = parseImageDataUrl(dataUrl);
  const pathname = `journey/images/${Date.now()}-${randomUUID()}${image.extension}`;
  const blob = await put(pathname, image.buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType: image.mime,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });

  return blob.url;
}

export async function deleteImageUrls(values) {
  if (!blobConfigured()) return;
  const urls = [];
  for (const value of values || []) {
    if (typeof value !== "string" || !value.startsWith("https://")) continue;
    try {
      const url = new URL(value);
      if (!url.hostname.endsWith(".blob.vercel-storage.com")) continue;
      urls.push(url.href);
    } catch (error) {
      // Ignore non-URL document values.
    }
  }

  if (urls.length) {
    await del([...new Set(urls)], { token: process.env.BLOB_READ_WRITE_TOKEN });
  }
}
