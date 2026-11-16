(() => {
  "use strict";

  const J = (window.Journey = window.Journey || {});

  const ALLOWED_TAGS = new Set([
    "A", "B", "BLOCKQUOTE", "BR", "CODE", "DIV", "EM", "FIGCAPTION", "FIGURE",
    "FONT", "H1", "H2", "H3", "H4", "HR", "I", "IMG", "LI", "OL", "P", "PRE",
    "S", "SPAN", "STRIKE", "STRONG", "SUB", "SUP", "U", "UL"
  ]);

  const DROP_TAGS = new Set([
    "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "BASE",
    "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "OPTION", "SVG", "MATH",
    "TEMPLATE", "NOSCRIPT", "AUDIO", "VIDEO", "SOURCE", "TRACK", "CANVAS"
  ]);

  const STYLE_PROPS = new Set([
    "font-family", "font-size", "font-weight", "font-style",
    "text-decoration", "text-decoration-line", "text-align"
  ]);

  function cleanStyle(value) {
    const probe = document.createElement("span");
    probe.style.cssText = String(value || "");
    const kept = [];
    STYLE_PROPS.forEach((property) => {
      const propertyValue = probe.style.getPropertyValue(property);
      if (!propertyValue) return;
      if (/url\s*\(|expression|@import|behavior|javascript:/i.test(propertyValue)) return;
      kept.push(property + ": " + propertyValue);
    });
    return kept.join("; ");
  }

  function validHref(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.charAt(0) === "#") return raw;
    try {
      const url = new URL(raw, document.baseURI);
      if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") {
        return url.href;
      }
    } catch (error) {
      // fall through
    }
    return "";
  }

  function sanitizeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.remove();
      return;
    }
    const tag = node.tagName;
    if (!ALLOWED_TAGS.has(tag)) {
      if (DROP_TAGS.has(tag)) {
        node.remove();
        return;
      }
      const parent = node.parentNode;
      if (!parent) return;
      Array.from(node.childNodes).forEach(sanitizeNode);
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      node.remove();
      return;
    }

    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const keep =
        (name === "href" && tag === "A") ||
        (name === "target" && tag === "A") ||
        (name === "rel" && tag === "A") ||
        (name === "title" && (tag === "A" || tag === "IMG")) ||
        (name === "src" && tag === "IMG") ||
        (name === "alt" && tag === "IMG") ||
        (name === "width" && tag === "IMG") ||
        (name === "height" && tag === "IMG") ||
        (name === "face" && tag === "FONT") ||
        (name === "size" && tag === "FONT") ||
        (name === "color" && tag === "FONT") ||
        name === "style";
      if (!keep) node.removeAttribute(attribute.name);
    });

    if (tag === "A") {
      const href = validHref(node.getAttribute("href"));
      if (href) {
        node.setAttribute("href", href);
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      } else {
        node.removeAttribute("href");
      }
    }

    if (tag === "IMG") {
      const src = String(node.getAttribute("src") || "");
      if (!/^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(src)) {
        node.remove();
        return;
      }
      node.setAttribute("loading", "lazy");
      node.setAttribute("decoding", "async");
    }

    if (tag === "FONT") {
      const face = String(node.getAttribute("face") || "");
      if (!face || face.length > 80 || /[<>"'\\;{}]/.test(face)) node.removeAttribute("face");
    }

    if (node.hasAttribute && node.hasAttribute("style")) {
      const style = cleanStyle(node.getAttribute("style"));
      if (style) node.setAttribute("style", style);
      else node.removeAttribute("style");
    }

    Array.from(node.childNodes).forEach(sanitizeNode);
  }

  J.sanitizeHtml = function sanitizeHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString("<body>" + String(html || "") + "</body>", "text/html");
    Array.from(doc.body.childNodes).forEach(sanitizeNode);
    return doc.body.innerHTML;
  };

  J.validHref = validHref;

  function findAll(node, callback, parent) {
    if (!node) return undefined;
    const found = callback(node, parent);
    if (found !== undefined) return found;
    if (node.type === "folder" && Array.isArray(node.children)) {
      for (const child of node.children) {
        const result = findAll(child, callback, node);
        if (result !== undefined) return result;
      }
    }
    return undefined;
  }

  J.findNode = function findNode(id, root) {
    if (!id) return null;
    return findAll(root || J.state.root, (node) => (node.id === id ? node : undefined)) || null;
  };

  J.findParent = function findParent(id, root) {
    return findAll(root || J.state.root, (node, parent) => {
      if (node.id === id) return parent || null;
      return undefined;
    }) || null;
  };

  J.walkNodes = function walkNodes(callback) {
    const visit = (node) => {
      callback(node);
      if (node.type === "folder") node.children.forEach(visit);
    };
    if (J.state) visit(J.state.root);
  };

  J.allNodeIds = function allNodeIds() {
    const ids = [];
    J.walkNodes((node) => ids.push(node.id));
    return ids;
  };

  J.allFolderIds = function allFolderIds() {
    const ids = [];
    J.walkNodes((node) => {
      if (node.type === "folder") ids.push(node.id);
    });
    return ids;
  };

  J.nodePath = function nodePath(id) {
    const parts = [];
    let node = J.findNode(id);
    while (node) {
      parts.unshift(node.name);
      const parent = J.findParent(node.id);
      if (!parent) break;
      node = parent;
    }
    return parts;
  };

  J.currentFolder = function currentFolder() {
    if (!J.state) return null;
    const folder = J.findNode(J.state.selectedFolderId);
    return folder && folder.type === "folder" ? folder : J.state.root;
  };

  J.getDoc = function getDoc(id) {
    const value = J.docs[id];
    return typeof value === "string" ? value : "";
  };

  J.setDoc = function setDoc(id, value) {
    J.docs[id] = String(value == null ? "" : value);
  };

  J.firstNote = function firstNote() {
    let result = null;
    J.walkNodes((node) => {
      if (!result && node.type === "note") result = node;
    });
    return result;
  };

  J.uniqueName = function uniqueName(parent, desired, excludeId) {
    const base = J.sanitizeName(desired, "Untitled");
    const siblings = parent && parent.children ? parent.children : [];
    const used = new Set(
      siblings
        .filter((node) => node.id !== excludeId)
        .map((node) => node.name.toLowerCase())
    );
    if (!used.has(base.toLowerCase())) return base;
    let counter = 2;
    while (used.has((base + " " + counter).toLowerCase())) counter += 1;
    return base + " " + counter;
  };

  J.revealFolder = function revealFolder(id) {
    if (!J.state) return;
    const folder = J.findNode(id);
    if (!folder || folder.type !== "folder") return;
    if (!J.state.expanded.includes(folder.id)) J.state.expanded.push(folder.id);
    J.state.selectedFolderId = folder.id;
    J.persistMetaSoon();
  };

  function seedContent() {
    const now = Date.now();
    let counter = 0;
    const makeId = (prefix) => {
      counter += 1;
      return prefix + "_seed" + counter;
    };

    const folder = (name, children) => ({
      id: makeId("f"),
      type: "folder",
      name,
      children: children || [],
      createdAt: now,
      updatedAt: now
    });

    const note = (name, html) => {
      const node = {
        id: makeId("n"),
        type: "note",
        name,
        createdAt: now,
        updatedAt: now
      };
      docs[node.id] = html;
      return node;
    };

    const image = (name, src, meta) => {
      const node = {
        id: makeId("i"),
        type: "image",
        name,
        mime: meta.mime,
        ext: meta.ext,
        width: meta.width,
        height: meta.height,
        createdAt: now,
        updatedAt: now
      };
      docs[node.id] = src;
      return node;
    };

    const docs = {};

    const aboutMe = note("About Me", [
      "<h2>This page is yours.</h2>",
      "<p>Write a few true things here. Who you are, what you are making, what you are reading, what you are looking for. There is no required shape.</p>",
      "<p>Try a list if you like:</p>",
      "<ul>",
      "<li>something you keep returning to</li>",
      "<li>something you are learning</li>",
      "<li>something you want to remember</li>",
      "</ul>",
      "<p><em>Select this text and start typing. Rename the file from the menu beside its name in the files window.</em></p>"
    ].join(""));

    const welcome = note("About This Website", [
      '<p><em>"Wow, what a great website."</em></p>',
      "<p>This is <strong>journey</strong> — a small, private desktop for notes, pictures, and the things you're working through. It works like the file browser it looks like.</p>",
      "<p>Click a folder in <strong>files</strong> to open it. Click a note or a picture to open it in a window. Drag a title bar to move a window, resize from the bottom-right corner, minimize with <strong>–</strong>, and double-click a title bar to fill the screen.</p>",
      "<ul>",
      "<li><strong>about</strong> holds the introductions.</li>",
      "<li><strong>posts</strong> is for dated entries and longer pieces.</li>",
      "<li><strong>projects</strong>, <strong>papers</strong>, and <strong>art</strong> are here for whatever they become.</li>",
      "</ul>",
      "<p>Use the buttons at the bottom of the files window to add a folder, a note, or a picture. You can also drop images straight into the tree. Inside a note, the toolbar handles headings, fonts, lists, links, and pictures.</p>",
      "<p><strong>Aa</strong> opens <strong>Font styles</strong>. Paste a Google Fonts <code>@import</code> — or simply type the name of a font — and it becomes available in every note.</p>",
      "<p>Everything is stored in this browser. Export a backup from the <strong>⋯</strong> menu. Focus a window and the URL changes, so you can bookmark a file.</p>",
      "<p><em>Replace this starter content with your own. All of it is editable.</em></p>"
    ].join(""));

    const post = note("On keeping a record", [
      "<p><em>November 16, 2026</em></p>",
      "<h2>On keeping a record</h2>",
      "<p>Some days are too large to hold in your head. Writing them down does not shrink them, but it gives them edges. A date, a sentence, a photograph, a list of what happened before lunch.</p>",
      "<p>The record does not have to be complete. It only has to be yours.</p>",
      "<blockquote>A notebook is less a museum than a workbench.</blockquote>",
      "<p>This is a starter entry. Replace it with a real one.</p>"
    ].join(""));

    const about = folder("about", [aboutMe, welcome]);
    const posts = folder("posts", [post]);
    const projects = folder("projects", []);
    const papers = folder("papers", []);
    const art = folder("art", [
      image("Monochrome study", J.SAMPLE_ART, {
        mime: "image/svg+xml",
        ext: ".svg",
        width: 1200,
        height: 800
      })
    ]);

    const root = folder("root", [about, posts, projects, papers, art]);
    root.id = "f_root";

    const state = {
      version: 1,
      root,
      fonts: [],
      expanded: [root.id, about.id],
      selectedFolderId: root.id,
      welcomeId: welcome.id,
      lastNoteId: welcome.id
    };

    return { state, docs };
  }

  J.seedContent = seedContent;

  function normalizeNode(raw, seen) {
    if (!raw || typeof raw !== "object") return null;
    const type = raw.type;
    if (type !== "folder" && type !== "note" && type !== "image") return null;

    let id = typeof raw.id === "string" && raw.id ? raw.id : J.uid(type.charAt(0));
    if (seen.has(id)) id = J.uid(type.charAt(0));
    seen.add(id);

    const node = {
      id,
      type,
      name: J.sanitizeName(raw.name, type === "folder" ? "folder" : type === "note" ? "Untitled note" : "picture"),
      createdAt: Number(raw.createdAt) || Date.now(),
      updatedAt: Number(raw.updatedAt) || Number(raw.createdAt) || Date.now()
    };

    if (type === "folder") {
      node.children = Array.isArray(raw.children)
        ? raw.children.map((child) => normalizeNode(child, seen)).filter(Boolean)
        : [];
    }

    if (type === "image") {
      node.mime = typeof raw.mime === "string" ? raw.mime.slice(0, 60) : "image/webp";
      node.ext = typeof raw.ext === "string" ? raw.ext.slice(0, 10) : "";
      node.width = Number(raw.width) || 0;
      node.height = Number(raw.height) || 0;
    }

    return node;
  }

  J.normalizeState = function normalizeState(raw) {
    if (!raw || typeof raw !== "object" || !raw.root) return null;
    const seen = new Set();
    const root = normalizeNode(raw.root, seen);
    if (!root || root.type !== "folder") return null;

    const state = {
      version: 1,
      root,
      fonts: Array.isArray(raw.fonts)
        ? raw.fonts
            .filter((font) => font && typeof font.family === "string" && typeof font.url === "string")
            .map((font) => ({
              id: typeof font.id === "string" ? font.id : J.uid("font"),
              family: font.family.slice(0, 60),
              url: font.url,
              addedAt: Number(font.addedAt) || Date.now()
            }))
        : [],
      expanded: Array.isArray(raw.expanded) ? raw.expanded.filter((id) => typeof id === "string") : [],
      selectedFolderId: typeof raw.selectedFolderId === "string" ? raw.selectedFolderId : root.id,
      welcomeId: typeof raw.welcomeId === "string" ? raw.welcomeId : "",
      lastNoteId: typeof raw.lastNoteId === "string" ? raw.lastNoteId : ""
    };

    const folderIds = new Set();
    const collectFolders = (node) => {
      if (node.type !== "folder") return;
      folderIds.add(node.id);
      node.children.forEach(collectFolders);
    };
    collectFolders(root);

    state.expanded = state.expanded.filter((id) => folderIds.has(id));
    if (!state.expanded.includes(root.id)) state.expanded.unshift(root.id);

    if (!folderIds.has(state.selectedFolderId)) state.selectedFolderId = root.id;

    if (!J.findNode(state.welcomeId, root)) state.welcomeId = "";
    if (!J.findNode(state.lastNoteId, root)) state.lastNoteId = "";

    const noteNames = [];
    const collectNotes = (node) => {
      if (node.type === "note") noteNames.push(node);
      if (node.type === "folder") node.children.forEach(collectNotes);
    };
    collectNotes(root);
    if (!state.welcomeId) {
      const welcomeByName = noteNames.find((node) => node.name === "About This Website");
      state.welcomeId = welcomeByName ? welcomeByName.id : "";
    }
    if (!state.lastNoteId) {
      const first = noteNames[0];
      state.lastNoteId = first ? first.id : "";
    }

    return state;
  };

  J.ensureDocs = function ensureDocs(state, loadedDocs) {
    const docs = {};
    const source = loadedDocs && typeof loadedDocs === "object" ? loadedDocs : {};
    const ids = new Set();
    const visit = (node) => {
      if (node.type === "note") {
        docs[node.id] = typeof source[node.id] === "string" ? source[node.id] : "";
        ids.add(node.id);
      } else if (node.type === "image") {
        docs[node.id] = typeof source[node.id] === "string" ? source[node.id] : "";
        ids.add(node.id);
      } else if (node.type === "folder") {
        node.children.forEach(visit);
      }
    };
    visit(state.root);
    return docs;
  };
})();
