(() => {
  "use strict";

  const J = (window.Journey = window.Journey || {});

  J.windows = new Map();
  J.zCounter = 20;
  J.activeKey = null;

  J.isMobile = function isMobile() {
    return window.matchMedia("(max-width: 860px)").matches;
  };

  J.workspaceSize = function workspaceSize() {
    const workspace = document.getElementById("workspace");
    return {
      w: Math.max(320, workspace ? workspace.clientWidth : window.innerWidth),
      h: Math.max(260, workspace ? workspace.clientHeight : window.innerHeight - 100)
    };
  };

  J.setWindowTitle = function setWindowTitle(rec, title) {
    if (!rec) return;
    rec.title = title;
    if (rec.titleEl) rec.titleEl.textContent = title;
    if (rec.el) rec.el.setAttribute("aria-label", title);
    if (J.activeKey === rec.key) {
      document.title = rec.kind === "files" ? J.APP_TITLE : title + " — " + J.APP_TITLE;
    }
  };

  function setHash(rec) {
    const hash = rec && (rec.kind === "note" || rec.kind === "image")
      ? "#/" + rec.kind + "/" + encodeURIComponent(rec.nodeId)
      : "";
    const base = location.pathname + location.search;
    try {
      history.replaceState(null, "", base + hash);
    } catch (error) {
      try {
        location.hash = hash ? hash.slice(1) : "";
      } catch (hashError) {
        // A file:// URL in a strict browser may refuse both. Permalinks are a bonus.
      }
    }
  }

  J.deactivateWindows = function deactivateWindows() {
    J.activeKey = null;
    J.windows.forEach((rec) => {
      rec.el.classList.remove("is-focused");
      rec.el.style.zIndex = rec.z;
    });
    document.title = J.APP_TITLE;
    setHash(null);
    if (J.afterActiveChange) J.afterActiveChange();
  };

  J.focusWindow = function focusWindow(rec) {
    if (!rec) return;
    if (rec.minimized) J.restoreWindow(rec);
    if (J.activeKey === rec.key) {
      rec.z = ++J.zCounter;
      rec.el.style.zIndex = rec.z;
      if (J.afterActiveChange) J.afterActiveChange();
      return;
    }
    J.activeKey = rec.key;
    J.windows.forEach((windowRec) => {
      windowRec.el.classList.toggle("is-focused", windowRec === rec);
    });
    rec.z = ++J.zCounter;
    rec.el.style.zIndex = rec.z;
    document.title = rec.kind === "files" ? J.APP_TITLE : rec.title + " — " + J.APP_TITLE;
    setHash(rec);
    if ((rec.kind === "note" || rec.kind === "image") && J.state) {
      if (rec.kind === "note") J.state.lastNoteId = rec.nodeId;
      J.persistMetaSoon();
    }
    if (J.afterActiveChange) J.afterActiveChange();
    if (typeof rec.onFocus === "function") rec.onFocus();
  };

  function topWindow(excludeKey) {
    let top = null;
    J.windows.forEach((rec) => {
      if (excludeKey && rec.key === excludeKey) return;
      if (rec.minimized) return;
      if (!top || rec.z > top.z) top = rec;
    });
    return top;
  }

  J.topWindow = topWindow;

  J.focusTopWindow = function focusTopWindow(excludeKey) {
    const top = topWindow(excludeKey);
    if (top) J.focusWindow(top);
    else J.deactivateWindows();
  };

  J.openWindowCount = function openWindowCount() {
    return J.windows.size;
  };

  J.setGeometry = function setGeometry(rec, x, y, width, height) {
    if (!rec) return;
    const size = J.workspaceSize();
    const maxWidth = Math.max(280, size.w - 8);
    const maxHeight = Math.max(150, size.h - 8);
    const w = Math.round(J.clamp(width, rec.minWidth || 300, maxWidth));
    const h = Math.round(J.clamp(height, rec.minHeight || 150, maxHeight));
    const left = Math.round(J.clamp(x, 4, Math.max(4, size.w - w - 4)));
    const top = Math.round(J.clamp(y, 4, Math.max(4, size.h - 30)));
    rec.x = left;
    rec.y = top;
    rec.w = w;
    rec.h = h;
    rec.el.style.left = left + "px";
    rec.el.style.top = top + "px";
    rec.el.style.width = w + "px";
    rec.el.style.height = h + "px";
  };

  function minimizeControl() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ctl";
    button.dataset.action = "minimize";
    button.title = "Minimize";
    button.setAttribute("aria-label", "Minimize window");
    button.innerHTML = J.ICONS.minimize;
    return button;
  }

  function closeControl() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ctl";
    button.dataset.action = "close";
    button.title = "Close";
    button.setAttribute("aria-label", "Close window");
    button.innerHTML = J.ICONS.close;
    return button;
  }

  J.createWindow = function createWindow(options) {
    const opts = options || {};
    const { kind, key } = opts;
    const size = J.workspaceSize();

    const win = document.createElement("section");
    win.className = "window";
    win.dataset.kind = kind;
    win.dataset.key = key;
    win.tabIndex = -1;
    win.setAttribute("role", "region");

    const titleId = J.uid("wintitle");
    const bar = document.createElement("div");
    bar.className = "titlebar";
    const title = document.createElement("span");
    title.className = "window-title";
    title.id = titleId;
    title.textContent = opts.title || "";
    const controls = document.createElement("div");
    controls.className = "window-controls";
    controls.appendChild(minimizeControl());
    controls.appendChild(closeControl());
    bar.appendChild(title);
    bar.appendChild(controls);
    win.setAttribute("aria-labelledby", titleId);

    const body = document.createElement("div");
    body.className = "window-body";

    const resizeHandle = document.createElement("div");
    resizeHandle.className = "resize-handle";
    resizeHandle.setAttribute("aria-hidden", "true");

    win.appendChild(bar);
    win.appendChild(body);
    win.appendChild(resizeHandle);
    const workspace = document.getElementById("workspace");
    workspace.appendChild(win);

    const rec = {
      key,
      kind,
      nodeId: opts.nodeId || null,
      title: opts.title || "",
      el: win,
      body,
      bar,
      titleEl: title,
      resizeHandle,
      x: 0,
      y: 0,
      w: opts.width || 640,
      h: opts.height || 480,
      minWidth: opts.minWidth || 300,
      minHeight: opts.minHeight || 150,
      z: ++J.zCounter,
      minimized: false,
      maximized: false,
      prevRect: null,
      cleanup: []
    };

    J.windows.set(key, rec);
    J.setGeometry(rec, opts.x || 40, opts.y || 40, opts.width || 640, opts.height || 480);

    win.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".window-controls")) return;
      J.focusWindow(rec);
    }, true);

    controls.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    controls.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      event.stopPropagation();
      event.preventDefault();
      if (button.dataset.action === "minimize") {
        if (rec.minimized) J.restoreWindow(rec);
        else J.minimizeWindow(rec);
      } else if (button.dataset.action === "close") {
        J.closeWindow(rec);
      }
    });

    bar.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target.closest("button")) return;
      if (J.isMobile()) return;
      J.focusWindow(rec);
      if (rec.minimized) {
        J.restoreWindow(rec);
        return;
      }
      if (rec.maximized) return;
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = rec.x;
      const startTop = rec.y;
      const sizeNow = J.workspaceSize();
      let moved = false;

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return;
        moved = true;
        win.classList.add("dragging");
        const nextX = J.clamp(startLeft + dx, 4, Math.max(4, sizeNow.w - rec.w - 4));
        const nextY = J.clamp(startTop + dy, 4, Math.max(4, sizeNow.h - 31));
        rec.x = nextX;
        rec.y = nextY;
        win.style.left = Math.round(nextX) + "px";
        win.style.top = Math.round(nextY) + "px";
      };

      const onUp = () => {
        win.classList.remove("dragging");
        bar.removeEventListener("pointermove", onMove);
        bar.removeEventListener("pointerup", onUp);
        bar.removeEventListener("pointercancel", onUp);
        try {
          if (bar.hasPointerCapture(event.pointerId)) bar.releasePointerCapture(event.pointerId);
        } catch (error) {
          // ignore
        }
      };

      try {
        bar.setPointerCapture(event.pointerId);
      } catch (error) {
        // ignore
      }
      bar.addEventListener("pointermove", onMove);
      bar.addEventListener("pointerup", onUp);
      bar.addEventListener("pointercancel", onUp);
    });

    bar.addEventListener("dblclick", (event) => {
      if (event.target.closest("button")) return;
      if (rec.minimized) return;
      event.preventDefault();
      J.toggleMaximize(rec);
    });

    resizeHandle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (J.isMobile() || rec.maximized || rec.minimized) return;
      event.preventDefault();
      event.stopPropagation();
      J.focusWindow(rec);
      const startX = event.clientX;
      const startY = event.clientY;
      const startW = rec.w;
      const startH = rec.h;
      const sizeNow = J.workspaceSize();

      const onMove = (moveEvent) => {
        const nextW = J.clamp(startW + (moveEvent.clientX - startX), rec.minWidth, Math.max(rec.minWidth, sizeNow.w - rec.x - 4));
        const nextH = J.clamp(startH + (moveEvent.clientY - startY), rec.minHeight, Math.max(rec.minHeight, sizeNow.h - rec.y - 4));
        rec.w = Math.round(nextW);
        rec.h = Math.round(nextH);
        win.style.width = rec.w + "px";
        win.style.height = rec.h + "px";
      };
      const onUp = () => {
        resizeHandle.removeEventListener("pointermove", onMove);
        resizeHandle.removeEventListener("pointerup", onUp);
        resizeHandle.removeEventListener("pointercancel", onUp);
        try {
          if (resizeHandle.hasPointerCapture(event.pointerId)) resizeHandle.releasePointerCapture(event.pointerId);
        } catch (error) {
          // ignore
        }
      };
      try {
        resizeHandle.setPointerCapture(event.pointerId);
      } catch (error) {
        // ignore
      }
      resizeHandle.addEventListener("pointermove", onMove);
      resizeHandle.addEventListener("pointerup", onUp);
      resizeHandle.addEventListener("pointercancel", onUp);
    });

    if (opts.populate) opts.populate(body, rec);
    J.focusWindow(rec);
    if (J.afterWindowChange) J.afterWindowChange();
    return rec;
  };

  J.restoreWindow = function restoreWindow(rec) {
    if (!rec || !rec.minimized) return;
    rec.minimized = false;
    rec.el.classList.remove("is-minimized");
    if (!rec.maximized) J.setGeometry(rec, rec.x, rec.y, rec.w, rec.h);
    J.focusWindow(rec);
    if (J.afterWindowChange) J.afterWindowChange();
  };

  J.minimizeWindow = function minimizeWindow(rec) {
    if (!rec || rec.minimized) return;
    rec.h = rec.el.offsetHeight;
    rec.minimized = true;
    rec.el.classList.add("is-minimized");
    rec.el.style.height = "";
    if (J.activeKey === rec.key) J.focusTopWindow(rec.key);
    if (J.afterWindowChange) J.afterWindowChange();
  };

  J.closeWindow = function closeWindow(rec) {
    if (!rec || !J.windows.has(rec.key)) return;
    if (typeof rec.onClose === "function") {
      try {
        rec.onClose();
      } catch (error) {
        console.error(error);
      }
    }
    rec.cleanup.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        console.error(error);
      }
    });
    const wasActive = J.activeKey === rec.key;
    rec.el.remove();
    J.windows.delete(rec.key);
    if (wasActive) J.focusTopWindow();
    if (J.afterWindowChange) J.afterWindowChange();
  };

  J.toggleMaximize = function toggleMaximize(rec) {
    if (!rec || rec.minimized) return;
    const size = J.workspaceSize();
    if (rec.maximized) {
      rec.maximized = false;
      const rect = rec.prevRect || { x: 40, y: 40, w: 720, h: 520 };
      rec.prevRect = null;
      rec.el.classList.remove("is-maximized");
      J.setGeometry(rec, rect.x, rect.y, rect.w, rect.h);
    } else {
      rec.prevRect = { x: rec.x, y: rec.y, w: rec.w, h: rec.h };
      rec.maximized = true;
      rec.el.classList.add("is-maximized");
      J.setGeometry(rec, 4, 4, size.w - 8, size.h - 8);
    }
    J.focusWindow(rec);
  };

  J.openNode = function openNode(id) {
    const node = J.findNode(id);
    if (!node || !J.state) return;
    const parent = J.findParent(node.id);
    if (parent) J.state.selectedFolderId = parent.id;
    if (node.type === "note" && J.openNoteWindow) {
      J.openNoteWindow(node);
    } else if (node.type === "image" && J.openImageWindow) {
      J.openImageWindow(node);
    } else if (node.type === "folder" && J.renderTree) {
      if (J.state.expanded.includes(node.id)) {
        J.state.expanded = J.state.expanded.filter((folderId) => folderId !== node.id);
      } else {
        J.state.expanded.push(node.id);
      }
      J.state.selectedFolderId = node.id;
      J.persistMetaSoon();
      J.renderTree();
    }
  };

  J.constrainWindows = function constrainWindows() {
    if (J.isMobile()) return;
    const size = J.workspaceSize();
    J.windows.forEach((rec) => {
      if (rec.maximized) {
        J.setGeometry(rec, 4, 4, size.w - 8, size.h - 8);
        return;
      }
      if (rec.minimized) return;
      const width = Math.min(rec.w, size.w - 8);
      const height = Math.min(rec.h, size.h - 8);
      const x = J.clamp(rec.x, 4, Math.max(4, size.w - width - 4));
      const y = J.clamp(rec.y, 4, Math.max(4, size.h - 30));
      J.setGeometry(rec, x, y, width, height);
    });
  };
})();
