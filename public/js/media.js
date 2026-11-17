(() => {
  "use strict";

  const J = (window.Journey = window.Journey || {});

  const ALLOWED_IMAGE_TYPES = new Set([
    "image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"
  ]);

  J.readDataUrl = function readDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Could not read that file"));
      reader.readAsDataURL(file);
    });
  };

  J.blobToDataUrl = function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Could not read that image"));
      reader.readAsDataURL(blob);
    });
  };

  J.loadImageElement = function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That picture could not be read."));
      img.src = src;
    });
  };

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
      if (canvas.toBlob) {
        canvas.toBlob((blob) => resolve(blob), type, quality);
      } else {
        resolve(null);
      }
    });
  }

  J.prepareImage = async function prepareImage(file, options) {
    const opts = options || {};
    const maxDimension = Number(opts.maxDimension) || 1800;
    const quality = typeof opts.quality === "number" ? opts.quality : 0.86;

    if (!file || !ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new Error("Use a PNG, JPEG, WebP, GIF, or AVIF picture.");
    }

    if (file.type === "image/gif") {
      if (file.size > 3 * 1024 * 1024) {
        throw new Error("That GIF is larger than 3 MB. Try a smaller one.");
      }
      const dataUrl = await J.readDataUrl(file);
      const img = await J.loadImageElement(dataUrl);
      return {
        dataUrl,
        mime: "image/gif",
        ext: ".gif",
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        bytes: file.size
      };
    }

    const source = await J.readDataUrl(file);
    const img = await J.loadImageElement(source);
    const sourceWidth = img.naturalWidth || img.width;
    const sourceHeight = img.naturalHeight || img.height;
    if (!sourceWidth || !sourceHeight) throw new Error("That picture could not be read.");

    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(img, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, "image/webp", quality);
    let mime = "image/webp";
    let ext = ".webp";
    if (!blob) {
      blob = await canvasToBlob(canvas, "image/jpeg", Math.max(quality, 0.88));
      mime = "image/jpeg";
      ext = ".jpg";
    }
    if (!blob) throw new Error("This browser could not prepare that picture.");

    const dataUrl = await J.blobToDataUrl(blob);
    return {
      dataUrl,
      mime,
      ext,
      width,
      height,
      bytes: Math.round((dataUrl.length * 3) / 4)
    };
  };

  J.addImageFiles = async function addImageFiles(files, folderId, options) {
    const opts = options || {};
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return [];
    const folder = J.findNode(folderId);
    const target = folder && folder.type === "folder" ? folder : J.currentFolder();
    if (!target) return [];

    const added = [];
    let lastError = null;
    for (const file of list) {
      if (!file.type || !file.type.startsWith("image/")) {
        lastError = "One file was skipped because it is not a picture.";
        continue;
      }
      try {
        const prepared = await J.prepareImage(file);
        const baseName = J.stripExtension(file.name) || "picture";
        const node = {
          id: J.uid("i"),
          type: "image",
          name: J.uniqueName(target, baseName),
          mime: prepared.mime,
          ext: prepared.ext,
          width: prepared.width,
          height: prepared.height,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await J.storageSetDoc(node.id, prepared.dataUrl);
        J.docs[node.id] = prepared.dataUrl;
        target.children.push(node);
        added.push(node);
      } catch (error) {
        console.error(error);
        lastError = error.message || "That picture could not be added.";
      }
    }

    if (!added.length) {
      J.toast(lastError || "No pictures were added.", { error: true });
      return [];
    }

    if (!J.state.expanded.includes(target.id)) J.state.expanded.push(target.id);
    J.state.selectedFolderId = target.id;
    await J.persistMetaNow();
    if (J.renderTree) J.renderTree();
    J.toast(
      "Added " + added.length + (added.length === 1 ? " picture" : " pictures") + " to " + target.name + ".",
      { error: false }
    );
    if (opts.openFirst !== false && J.openImageWindow) J.openImageWindow(added[0]);
    return added;
  };

  J.openImageWindow = function openImageWindow(node) {
    if (!node || node.type !== "image") return null;
    const key = "image:" + node.id;
    const existing = J.windows.get(key);
    if (existing) {
      J.restoreWindow(existing);
      J.focusWindow(existing);
      return existing;
    }

    const size = J.workspaceSize();
    const cascade = J.openWindowCount ? J.openWindowCount() : 0;
    const width = Math.min(680, Math.max(320, size.w - 80));
    const height = Math.min(560, Math.max(260, size.h - 80));
    const x = Math.max(16, Math.round((size.w - width) / 2) + (cascade % 4) * 16);
    const y = Math.max(16, Math.round((size.h - height) / 2) + (cascade % 4) * 16);

    return J.createWindow({
      kind: "image",
      key,
      nodeId: node.id,
      title: node.name,
      width,
      height,
      x,
      y,
      minWidth: 340,
      minHeight: 240,
      populate: (body) => {
        body.classList.add("image-shell");
        const stage = document.createElement("div");
        stage.className = "image-stage";

        const src = J.getDoc(node.id);
        const img = document.createElement("img");
        img.alt = node.name;
        img.draggable = false;
        if (src) {
          img.src = src;
          img.addEventListener("error", () => {
            img.remove();
            const missing = document.createElement("div");
            missing.className = "image-missing";
            missing.textContent = "This picture is unavailable.";
            stage.appendChild(missing);
          });
        } else {
          const missing = document.createElement("div");
          missing.className = "image-missing";
          missing.textContent = "This picture is unavailable.";
          stage.appendChild(missing);
        }

        const bar = document.createElement("div");
        bar.className = "image-bar";
        const meta = document.createElement("span");
        meta.className = "image-meta";
        const details = [];
        if (node.width && node.height) details.push(node.width + " × " + node.height);
        if (node.ext) details.push(String(node.ext).replace(".", "").toUpperCase());
        meta.textContent = details.join(" · ") || "Picture";
        const download = document.createElement("a");
        download.className = "image-download";
        download.textContent = "download";
        download.href = src || "#";
        download.download = node.name + (node.ext || "");
        download.setAttribute("aria-label", "Download " + node.name);
        if (!src) download.removeAttribute("href");
        bar.appendChild(meta);
        bar.appendChild(download);

        if (src) stage.appendChild(img);
        body.appendChild(stage);
        body.appendChild(bar);

        img.addEventListener("load", () => {
          if (!node.width || !node.height) {
            node.width = img.naturalWidth;
            node.height = img.naturalHeight;
            meta.textContent = [
              node.width + " × " + node.height,
              node.ext ? String(node.ext).replace(".", "").toUpperCase() : ""
            ].filter(Boolean).join(" · ");
            J.persistMetaSoon();
          }
        });
      }
    });
  };
})();
