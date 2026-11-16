(() => {
  "use strict";

  const J = (window.Journey = window.Journey || {});

  function filesRect() {
    const size = J.workspaceSize();
    const width = Math.min(364, Math.max(300, Math.round(size.w * 0.26)));
    const y = Math.min(88, Math.max(24, Math.round(size.h * 0.09)));
    const height = Math.min(760, Math.max(360, Math.round((size.h - y) * 0.86)));
    const x = Math.max(14, Math.round(size.w * 0.035));
    return { x, y, w: width, h: height };
  }

  function activeNodeId() {
    if (!J.activeKey) return "";
    const rec = J.windows.get(J.activeKey);
    return rec && (rec.kind === "note" || rec.kind === "image") ? rec.nodeId : "";
  }

  function updateTreeOpenIndicators() {
    const rec = J.windows.get("files");
    if (!rec || !rec.treeEl) return;
    const openId = activeNodeId();
    rec.treeEl.querySelectorAll(".tree-row").forEach((row) => {
      row.classList.toggle("is-open-file", row.dataset.id === openId);
    });
  }

  J.updateFilesReopen = function updateFilesReopen() {
    const button = document.getElementById("reopen-files");
    if (!button) return;
    button.hidden = J.windows.has("files");
  };

  J.afterActiveChange = function afterActiveChange() {
    updateTreeOpenIndicators();
  };

  J.afterWindowChange = function afterWindowChange() {
    J.updateFilesReopen();
    updateTreeOpenIndicators();
  };

  function updateScope() {
    const rec = J.windows.get("files");
    if (!rec || !rec.scopeEl) return;
    const folder = J.currentFolder();
    rec.scopeEl.textContent = "";
    rec.scopeEl.appendChild(document.createTextNode("new in "));
    const strong = document.createElement("strong");
    strong.textContent = folder ? folder.name : "root";
    rec.scopeEl.appendChild(strong);
    const label = folder ? folder.name : "root";
    if (rec.addFolder) rec.addFolder.title = "New folder in " + label;
    if (rec.addNote) rec.addNote.title = "New note in " + label;
    if (rec.addImage) rec.addImage.title = "Add pictures to " + label;
  }

  J.updateFileScope = updateScope;

  function focusTreeRow(id) {
    const rec = J.windows.get("files");
    if (!rec || !rec.treeEl) return;
    const row = rec.treeEl.querySelector('.tree-row[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (!row) return;
    rec.treeEl.querySelectorAll(".tree-row").forEach((entry) => {
      entry.tabIndex = entry === row ? 0 : -1;
    });
    row.focus({ preventScroll: true });
    row.scrollIntoView({ block: "nearest" });
  }

  function paintSelection() {
    const rec = J.windows.get("files");
    if (!rec || !rec.treeEl || !J.state) return;
    rec.treeEl.querySelectorAll(".tree-row").forEach((row) => {
      const selected = row.dataset.id === J.state.selectedFolderId;
      row.classList.toggle("is-selected", selected);
      if (selected) row.setAttribute("aria-selected", "true");
      else row.removeAttribute("aria-selected");
    });
  }

  function collapseSelectionIfHidden(folder) {
    if (!J.state) return;
    if (J.state.selectedFolderId === folder.id) return;
    if (J.findNode(J.state.selectedFolderId, folder)) {
      J.state.selectedFolderId = folder.id;
    }
  }

  function activateRow(node, row) {
    if (!node) return;
    const focusId = node.id;
    if (node.type === "folder") {
      const expanded = J.state.expanded.includes(node.id);
      if (expanded) {
        J.state.expanded = J.state.expanded.filter((id) => id !== node.id);
        collapseSelectionIfHidden(node);
      } else {
        J.state.expanded.push(node.id);
        J.state.selectedFolderId = node.id;
      }
      J.persistMetaSoon();
      J.renderTree({ focusId });
      return;
    }

    const parent = J.findParent(node.id);
    if (parent) J.state.selectedFolderId = parent.id;
    J.openNode(node.id);
    J.renderTree();
  }

  function rowMenuItems(node) {
    const items = [];
    if (node.type === "folder") {
      items.push({ label: "New note here", action: () => createNoteDialog(node.id) });
      items.push({ label: "New folder here", action: () => createFolderDialog(node.id) });
    } else {
      items.push({ label: "Open", action: () => J.openNode(node.id) });
    }
    if (node.id === J.state.root.id) return items;
    items.push({ type: "separator" });
    items.push({
      label: "Rename",
      shortcut: "F2",
      action: () => renameNodeDialog(node)
    });
    items.push({
      label: "Delete",
      shortcut: "Del",
      danger: true,
      action: () => deleteNode(node)
    });
    return items;
  }

  function showRowMenu(node, anchorRect) {
    J.showMenu(rowMenuItems(node), anchorRect.left, anchorRect.bottom + 4);
  }

  function makeTreeRow(node, depth, rec) {
    const row = document.createElement("div");
    row.className = "tree-row";
    row.setAttribute("role", "treeitem");
    row.setAttribute("aria-level", String(depth + 1));
    row.dataset.id = node.id;
    row.tabIndex = -1;
    row.style.paddingLeft = 16 + depth * 22 + "px";

    const isFolder = node.type === "folder";
    const expanded = isFolder && J.state.expanded.includes(node.id);
    if (isFolder) {
      row.classList.toggle("is-expanded", expanded);
      row.setAttribute("aria-expanded", String(expanded));
    }
    if (node.id === J.state.selectedFolderId) {
      row.classList.add("is-selected");
      row.setAttribute("aria-selected", "true");
      row.tabIndex = 0;
    }

    const twisty = document.createElement("span");
    twisty.className = "twisty" + (isFolder && node.children.length ? "" : " is-blank");
    twisty.innerHTML = J.ICONS.chevron;
    twisty.addEventListener("click", (event) => {
      event.stopPropagation();
      activateRow(node, row);
    });

    const icon = document.createElement("span");
    icon.className = "node-icon";
    if (isFolder) icon.innerHTML = expanded ? J.ICONS.folderOpen : J.ICONS.folder;
    else if (node.type === "image") icon.innerHTML = J.ICONS.image;
    else icon.innerHTML = J.ICONS.file;

    const name = document.createElement("span");
    name.className = "node-name";
    name.textContent = node.name;
    name.title = node.name;

    const menu = document.createElement("button");
    menu.type = "button";
    menu.className = "row-menu";
    menu.setAttribute("aria-label", "Actions for " + node.name);
    menu.title = "Actions";
    menu.innerHTML = J.ICONS.dots;
    menu.addEventListener("pointerdown", (event) => event.stopPropagation());
    menu.addEventListener("click", (event) => {
      event.stopPropagation();
      showRowMenu(node, menu.getBoundingClientRect());
    });

    row.appendChild(twisty);
    row.appendChild(icon);
    row.appendChild(name);
    row.appendChild(menu);

    row.addEventListener("click", () => {
      activateRow(node, row);
    });
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (isFolder) {
        J.state.selectedFolderId = node.id;
        updateScope();
      } else {
        const parent = J.findParent(node.id);
        if (parent) J.state.selectedFolderId = parent.id;
        updateScope();
      }
      paintSelection();
      J.showMenu(rowMenuItems(node), event.clientX, event.clientY);
    });

    rec.visibleRows.push(row);
    return row;
  }

  J.renderTree = function renderTree(options) {
    const opts = options || {};
    const rec = J.windows.get("files");
    if (!rec || !rec.treeEl || !J.state) return;
    const previousScroll = rec.treeScroll.scrollTop;
    rec.treeEl.textContent = "";
    rec.visibleRows = [];

    const fragment = document.createDocumentFragment();
    const addNode = (node, depth) => {
      fragment.appendChild(makeTreeRow(node, depth, rec));
      if (node.type === "folder" && J.state.expanded.includes(node.id)) {
        if (!node.children.length) {
          const empty = document.createElement("div");
          empty.className = "tree-empty";
          empty.style.paddingLeft = 16 + (depth + 1) * 22 + 33 + "px";
          empty.textContent = "empty";
          fragment.appendChild(empty);
        } else {
          node.children.forEach((child) => addNode(child, depth + 1));
        }
      }
    };
    addNode(J.state.root, 0);
    rec.treeEl.appendChild(fragment);
    rec.treeScroll.scrollTop = previousScroll;
    updateScope();
    updateTreeOpenIndicators();

    if (opts.focusId) {
      requestAnimationFrame(() => focusTreeRow(opts.focusId));
    }
  };

  function buildTree(rec) {
    const scroll = document.createElement("div");
    scroll.className = "tree-scroll scrollable";
    const tree = document.createElement("div");
    tree.className = "tree";
    tree.setAttribute("role", "tree");
    tree.setAttribute("aria-label", "Files");
    scroll.appendChild(tree);

    const footer = document.createElement("div");
    footer.className = "files-footer";
    const scope = document.createElement("span");
    scope.className = "files-scope";

    const addFolder = document.createElement("button");
    addFolder.type = "button";
    addFolder.className = "file-action";
    addFolder.innerHTML = J.ICONS.folderPlus;
    addFolder.setAttribute("aria-label", "New folder");
    const addNote = document.createElement("button");
    addNote.type = "button";
    addNote.className = "file-action";
    addNote.innerHTML = J.ICONS.notePlus;
    addNote.setAttribute("aria-label", "New note");
    const addImage = document.createElement("button");
    addImage.type = "button";
    addImage.className = "file-action";
    addImage.innerHTML = J.ICONS.imagePlus;
    addImage.setAttribute("aria-label", "Add pictures");
    const fonts = document.createElement("button");
    fonts.type = "button";
    fonts.className = "file-action";
    fonts.textContent = "Aa";
    fonts.setAttribute("aria-label", "Font styles");
    fonts.title = "Font styles";
    const more = document.createElement("button");
    more.type = "button";
    more.className = "file-action";
    more.innerHTML = J.ICONS.dots;
    more.setAttribute("aria-label", "More options");
    more.title = "More options";

    addFolder.addEventListener("click", () => createFolderDialog());
    addNote.addEventListener("click", () => createNoteDialog());
    addImage.addEventListener("click", () => {
      J.pendingImageFolderId = J.currentFolder().id;
      const input = document.getElementById("image-upload-input");
      if (!input) return;
      input.value = "";
      input.click();
    });
    fonts.addEventListener("click", () => J.openFontsWindow());
    more.addEventListener("click", () => {
      J.showMenuForButton(more, [
        { label: "Font styles", action: () => J.openFontsWindow() },
        { label: "Open starter note", action: openWelcomeNote },
        { type: "separator" },
        { label: "Export backup", shortcut: "JSON", action: () => J.exportBackup() },
        { label: "Import backup…", action: () => J.startBackupImport() }
      ]);
    });

    footer.appendChild(scope);
    footer.appendChild(addFolder);
    footer.appendChild(addNote);
    footer.appendChild(addImage);
    footer.appendChild(fonts);
    footer.appendChild(more);

    rec.treeScroll = scroll;
    rec.treeEl = tree;
    rec.scopeEl = scope;
    rec.addFolder = addFolder;
    rec.addNote = addNote;
    rec.addImage = addImage;
    rec.moreButton = more;

    tree.addEventListener("keydown", (event) => {
      const row = event.target.closest(".tree-row");
      if (!row) return;
      if (event.target.closest("button") && event.target !== row) return;
      const node = J.findNode(row.dataset.id);
      if (!node) return;
      const rows = rec.visibleRows;
      const index = rows.indexOf(row);

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const nextIndex = event.key === "ArrowDown" ? index + 1 : index - 1;
        const next = rows[J.clamp(nextIndex, 0, rows.length - 1)];
        if (next) focusTreeRow(next.dataset.id);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const next = event.key === "Home" ? rows[0] : rows[rows.length - 1];
        if (next) focusTreeRow(next.dataset.id);
      } else if (event.key === "ArrowRight") {
        if (node.type !== "folder") return;
        event.preventDefault();
        if (!J.state.expanded.includes(node.id)) {
          J.state.expanded.push(node.id);
          J.state.selectedFolderId = node.id;
          J.persistMetaSoon();
          J.renderTree({ focusId: node.id });
        } else if (node.children.length) {
          focusTreeRow(node.children[0].id);
        }
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (node.type === "folder" && J.state.expanded.includes(node.id)) {
          J.state.expanded = J.state.expanded.filter((id) => id !== node.id);
          collapseSelectionIfHidden(node);
          J.persistMetaSoon();
          J.renderTree({ focusId: node.id });
        } else {
          const parent = J.findParent(node.id);
          if (parent) focusTreeRow(parent.id);
        }
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activateRow(node, row);
      } else if (event.key === "F2") {
        event.preventDefault();
        renameNodeDialog(node);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteNode(node);
      } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        event.preventDefault();
        const rect = row.getBoundingClientRect();
        showRowMenu(node, { left: rect.left + 30, bottom: rect.bottom });
      }
    });

    tree.addEventListener("contextmenu", (event) => {
      if (event.target.closest(".tree-row")) return;
      event.preventDefault();
      J.showMenu([
        { label: "New note", action: () => createNoteDialog() },
        { label: "New folder", action: () => createFolderDialog() }
      ], event.clientX, event.clientY);
    });

    const body = rec.body;
    let dragDepth = 0;
    body.addEventListener("dragenter", (event) => {
      if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes("Files")) return;
      dragDepth += 1;
      body.classList.add("is-dropping");
    });
    body.addEventListener("dragover", (event) => {
      if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      body.classList.add("is-dropping");
    });
    body.addEventListener("dragleave", (event) => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) body.classList.remove("is-dropping");
    });
    body.addEventListener("drop", async (event) => {
      if (!event.dataTransfer || !event.dataTransfer.files || !event.dataTransfer.files.length) return;
      event.preventDefault();
      dragDepth = 0;
      body.classList.remove("is-dropping");
      let targetFolder = J.currentFolder();
      const row = event.target.closest(".tree-row");
      if (row) {
        const node = J.findNode(row.dataset.id);
        if (node && node.type === "folder") targetFolder = node;
        else if (node) {
          const parent = J.findParent(node.id);
          if (parent) targetFolder = parent;
        }
      }
      await handleDroppedFiles(Array.from(event.dataTransfer.files), targetFolder);
    });

    body.classList.add("files-body");
    body.appendChild(scroll);
    body.appendChild(footer);
    return body;
  }

  J.openFilesWindow = function openFilesWindow() {
    const existing = J.windows.get("files");
    if (existing) {
      J.restoreWindow(existing);
      J.focusWindow(existing);
      return existing;
    }
    const rect = filesRect();
    return J.createWindow({
      kind: "files",
      key: "files",
      title: "files",
      width: rect.w,
      height: rect.h,
      x: rect.x,
      y: rect.y,
      minWidth: 300,
      minHeight: 300,
      populate: (body, rec) => {
        buildTree(rec);
        J.renderTree();
      }
    });
  };

  function findWelcomeNote() {
    if (!J.state) return null;
    if (J.state.welcomeId) {
      const node = J.findNode(J.state.welcomeId);
      if (node && node.type === "note") return node;
    }
    const byName = [];
    J.walkNodes((node) => {
      if (node.type === "note" && node.name === "About This Website") byName.push(node);
    });
    return byName[0] || J.firstNote();
  }

  function openWelcomeNote() {
    const node = findWelcomeNote();
    if (node) J.openNode(node.id);
  }

  async function createFolderDialog(parentId) {
    const parent = J.findNode(parentId || J.currentFolder().id);
    const folder = parent && parent.type === "folder" ? parent : J.state.root;
    const name = await J.askName({
      title: "New folder",
      label: "Folder name",
      value: "New folder",
      confirmLabel: "Create folder"
    });
    if (!name) return;
    const node = {
      id: J.uid("f"),
      type: "folder",
      name: J.uniqueName(folder, name),
      children: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    folder.children.push(node);
    if (!J.state.expanded.includes(folder.id)) J.state.expanded.push(folder.id);
    J.state.expanded.push(node.id);
    J.state.selectedFolderId = node.id;
    await J.persistMetaNow();
    J.renderTree({ focusId: node.id });
  }

  async function createNoteNode(folder, name, html) {
    const node = {
      id: J.uid("n"),
      type: "note",
      name: J.uniqueName(folder, name || "Untitled note"),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const content = J.sanitizeHtml(html || "");
    J.setDoc(node.id, content);
    await J.storageSetDoc(node.id, content);
    folder.children.push(node);
    if (!J.state.expanded.includes(folder.id)) J.state.expanded.push(folder.id);
    J.state.selectedFolderId = folder.id;
    return node;
  }

  async function createNoteDialog(folderId) {
    const folder = J.findNode(folderId || J.currentFolder().id);
    const target = folder && folder.type === "folder" ? folder : J.state.root;
    const name = await J.askName({
      title: "New note",
      label: "Note name",
      value: "Untitled note",
      confirmLabel: "Create note"
    });
    if (!name) return;
    try {
      const node = await createNoteNode(target, name, "");
      await J.persistMetaNow();
      J.renderTree();
      J.openNoteWindow(node, { focusEditor: true });
    } catch (error) {
      J.reportStorageError(error);
      J.toast("The note could not be created.", { error: true });
    }
  }

  async function renameNodeDialog(node) {
    if (!node || node.id === J.state.root.id) return;
    const name = await J.askName({
      title: "Rename",
      label: "New name",
      value: node.name,
      confirmLabel: "Rename"
    });
    if (!name || name === node.name) return;
    const parent = J.findParent(node.id);
    node.name = J.uniqueName(parent || J.state.root, name, node.id);
    node.updatedAt = Date.now();
    await J.persistMetaNow();
    const keyBase = node.type === "note" ? "note:" : node.type === "image" ? "image:" : "";
    if (keyBase) {
      const rec = J.windows.get(keyBase + node.id);
      if (rec) {
        J.setWindowTitle(rec, node.name);
        if (rec.editor) rec.editor.setAttribute("aria-label", "Note content for " + node.name);
      }
    }
    J.renderTree({ focusId: node.id });
  }

  function subtree(node) {
    const ids = [];
    const collect = (entry) => {
      ids.push(entry.id);
      if (entry.type === "folder") entry.children.forEach(collect);
    };
    collect(node);
    return ids;
  }

  async function deleteNode(node) {
    if (!node || node.id === J.state.root.id) return;
    const parent = J.findParent(node.id);
    if (!parent) return;
    const ids = subtree(node);
    let fileCount = 0;
    let folderCount = 0;
    const count = (entry) => {
      if (entry.type === "folder") folderCount += 1;
      else fileCount += 1;
      if (entry.type === "folder") entry.children.forEach(count);
    };
    count(node);
    const message = node.type === "folder"
      ? 'Delete "' + node.name + '" and everything inside it?' +
        (fileCount || folderCount > 1
          ? " (" + fileCount + " " + (fileCount === 1 ? "file" : "files") + ", " +
            Math.max(0, folderCount - 1) + " " + (folderCount - 1 === 1 ? "folder" : "folders") + ")"
          : "") +
        " This cannot be undone."
      : 'Delete "' + node.name + '"? This cannot be undone.';
    const confirmed = await J.confirmDialog({
      title: "Delete",
      message,
      confirmLabel: "Delete",
      danger: true
    });
    if (!confirmed) return;

    const idSet = new Set(ids);
    Array.from(J.windows.values()).forEach((rec) => {
      if (rec.nodeId && idSet.has(rec.nodeId)) {
        rec.onClose = null;
        J.closeWindow(rec);
      }
    });

    ids.forEach((id) => {
      const pending = J.pendingDocs.get(id);
      if (pending) {
        clearTimeout(pending.timer);
        J.pendingDocs.delete(id);
      }
    });

    parent.children = parent.children.filter((child) => child.id !== node.id);
    ids.forEach((id) => {
      delete J.docs[id];
    });
    await J.storageDeleteDocs(ids);

    J.state.expanded = J.state.expanded.filter((id) => !idSet.has(id));
    if (idSet.has(J.state.selectedFolderId)) J.state.selectedFolderId = parent.id;
    if (idSet.has(J.state.welcomeId)) {
      const welcome = findWelcomeNote();
      J.state.welcomeId = welcome ? welcome.id : "";
    }
    if (idSet.has(J.state.lastNoteId)) {
      const note = J.firstNote();
      J.state.lastNoteId = note ? note.id : "";
    }
    await J.persistMetaNow();
    J.renderTree({ focusId: parent.id });
  }

  function textToHtml(text) {
    const source = String(text || "").replace(/\r\n?/g, "\n");
    if (!source.trim()) return "";
    return source
      .split(/\n{2,}/)
      .map((paragraph) => "<p>" + J.escapeHtml(paragraph).replace(/\n/g, "<br>") + "</p>")
      .join("");
  }

  async function handleDroppedFiles(files, folder) {
    const images = [];
    const textFiles = [];
    const unsupported = [];
    files.forEach((file) => {
      if (file.type && file.type.startsWith("image/")) images.push(file);
      else if (/\.(txt|md|markdown)$/i.test(file.name) || (file.type && file.type.startsWith("text/"))) textFiles.push(file);
      else unsupported.push(file.name);
    });

    if (images.length) {
      await J.addImageFiles(images, folder.id, { openFirst: !textFiles.length });
    }

    if (textFiles.length) {
      const created = [];
      for (const file of textFiles) {
        try {
          const text = await file.text();
          const node = await createNoteNode(folder, J.stripExtension(file.name) || "Dropped note", textToHtml(text));
          created.push(node);
        } catch (error) {
          console.error(error);
          J.toast("Could not read " + file.name + ".", { error: true });
        }
      }
      if (created.length) {
        await J.persistMetaNow();
        J.renderTree();
        J.openNoteWindow(created[0]);
        J.toast("Added " + created.length + (created.length === 1 ? " note" : " notes") + " to " + folder.name + ".");
      }
    }

    if (unsupported.length) {
      J.toast("Skipped " + unsupported.length + (unsupported.length === 1 ? " file" : " files") + ". Drop pictures or .txt / .md notes.", { error: true });
    }
  }

  J.handleImageUploadFiles = function handleImageUploadFiles(files) {
    const folderId = J.pendingImageFolderId || J.currentFolder().id;
    J.pendingImageFolderId = null;
    return J.addImageFiles(files, folderId);
  };

  J.openFilesWindow = J.openFilesWindow;
  J.openWelcomeNote = openWelcomeNote;
})();
