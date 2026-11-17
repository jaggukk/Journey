(() => {
  "use strict";

  const J = (window.Journey = window.Journey || {});

  J.APP_TITLE = "journey";
  J.SAMPLE_ART = "assets/monochrome-study.svg";
  J.WELCOME_EXAMPLE =
    "<style>@import url('https://fonts.googleapis.com/css2?family=Shadows+Into+Light&display=swap');</style>";

  J.BUNDLED_FONTS = [
    { family: "Caveat", note: "handwritten", css: "'Caveat', cursive" },
    { family: "Playfair Display", note: "editorial serif", css: "'Playfair Display', Georgia, serif" },
    { family: "Space Mono", note: "monospace", css: "'Space Mono', monospace" }
  ];

  J.ICONS = {
    chevron: '<svg viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 1 6 4 2.5 7"/></svg>',
    folder: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round" aria-hidden="true"><path d="M2.7 5.4h5.1l1.55 1.8h8v8.6H2.7z"/><path d="M2.7 5.4V3.6h5.1l1.55 1.75"/></svg>',
    folderOpen: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round" aria-hidden="true"><path d="M2.7 8.2h14.7l-1.7 7.6H2.7z"/><path d="M2.7 8.2V3.9h5.2l1.6 1.8h5.3v2.5"/></svg>',
    file: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round" aria-hidden="true"><path d="M5 2.6h6.2l3.8 3.9v10.9H5z"/><path d="M11.2 2.6v4h3.8"/></svg>',
    image: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round" aria-hidden="true"><path d="M5 2.6h6.2l3.8 3.9v10.9H5z"/><path d="M11.2 2.6v4h3.8"/><path d="m6.4 14.4 2.7-2.8 1.9 1.9 1.3-1.3 1.9 2.2"/><circle cx="8.3" cy="9.3" r=".8"/></svg>',
    dots: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3" cy="8" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="13" cy="8" r="1.1"/></svg>',
    folderPlus: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 5.2h4.6L8 6.9h8v8.2H2z"/><path d="M2 5.2V3.4h4.6L8 5.1"/><path d="M9 9v4M7 11h4"/></svg>',
    notePlus: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 1.8h6l3.6 3.7v10.7H4z"/><path d="M10 1.8v3.8h3.6"/><path d="M9 8.4v4.2M6.9 10.5h4.2"/></svg>',
    imagePlus: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 1.8h6l3.6 3.7v10.7H4z"/><path d="M10 1.8v3.8h3.6"/><path d="m5.1 13.4 2.2-2.3 1.6 1.6 1.1-1.1 1.5 1.7"/><path d="M9 8.1v3.4M7.3 9.8h3.4"/></svg>',
    minimize: '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M2 5h6"/></svg>',
    close: '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.15" aria-hidden="true"><path d="m2.3 2.3 5.4 5.4M7.7 2.3 2.3 7.7"/></svg>',
    link: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.4 10.6 10.6 7.4"/><path d="M6.2 12.8H5a3.2 3.2 0 0 1 0-6.4h2.2M11.8 5.2H13a3.2 3.2 0 0 1 0 6.4h-2.2"/></svg>',
    imageInsert: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="14" height="12"/><circle cx="6.3" cy="7" r="1.1"/><path d="m3.2 13 3.7-3.8 2.6 2.5 1.8-1.8 3.3 3.3"/></svg>',
    bulletList: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" aria-hidden="true"><circle cx="3.2" cy="4.6" r=".85" fill="currentColor" stroke="none"/><circle cx="3.2" cy="9" r=".85" fill="currentColor" stroke="none"/><circle cx="3.2" cy="13.4" r=".85" fill="currentColor" stroke="none"/><path d="M6.4 4.6h8.4M6.4 9h8.4M6.4 13.4h8.4"/></svg>',
    numberList: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" aria-hidden="true"><path d="M2.2 3.5h1.1v3.1M2 6.6h2.2"/><path d="M2 9.9c.3-.5 2-.7 2 .4 0 .8-2 1.4-2 2.5h2.1"/><path d="M6.6 4.6h8.3M6.6 9.4h8.3M6.6 13.6h8.3"/></svg>',
    fonts: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.2 14.6 6.7 3.4l4.5 11.2M3.8 10.7h5.8"/><path d="M11.6 14.6V8.2h1.8a2.1 2.1 0 0 1 0 4.2h-1.8"/></svg>'
  };

  J.el = function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };

  J.uid = function uid(prefix) {
    const rand = window.crypto && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    return (prefix || "n") + "_" + rand;
  };

  J.clamp = function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  };

  J.debounce = function debounce(fn, wait) {
    let timer = null;
    const wrapped = (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
    wrapped.cancel = () => {
      clearTimeout(timer);
      timer = null;
    };
    wrapped.flush = (...args) => {
      clearTimeout(timer);
      timer = null;
      return fn(...args);
    };
    return wrapped;
  };

  J.escapeHtml = function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  J.escapeAttr = J.escapeHtml;

  J.sanitizeName = function sanitizeName(raw, fallback) {
    let name = String(raw == null ? "" : raw)
      .replace(/[\/\\\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    name = name.replace(/^\.+/, "").replace(/\s+$/, "");
    return name || fallback || "";
  };

  J.formatBytes = function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  J.formatDate = function formatDate(timestamp) {
    if (!timestamp) return "";
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
      }).format(new Date(timestamp));
    } catch (error) {
      return "";
    }
  };

  J.stripExtension = function stripExtension(filename) {
    return String(filename || "").replace(/\.[^.\/\\]+$/, "");
  };

  const API_ROOT = "/api";

  async function apiRequest(resource, options) {
    const opts = options || {};
    const request = {
      method: opts.method || "GET",
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" }
    };
    if (opts.body !== undefined) {
      request.headers["Content-Type"] = "application/json";
      request.body = JSON.stringify(opts.body);
    }

    let response;
    try {
      response = await fetch(API_ROOT + resource, request);
    } catch (error) {
      const networkError = new Error("The journey server could not be reached.");
      networkError.cause = error;
      throw networkError;
    }

    const text = await response.text();
    let payload = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        if (response.ok) throw new Error("The journey server sent an unreadable response.");
      }
    }

    if (!response.ok) {
      const apiError = new Error(payload.error || "The journey server could not complete that request.");
      apiError.status = response.status;
      throw apiError;
    }
    return payload;
  }

  J.storage = {
    server: true,
    unavailable: false,
    backend: "filesystem",
    images: "inline"
  };
  J.readOnly = false;
  J.adminConfigured = false;
  J.adminUsername = "";
  J.adminLocalDefaults = false;

  J.initStorage = async function initStorage() {
    try {
      const health = await apiRequest("/health");
      if (!health.ok || health.storage !== "server") {
        throw new Error("The journey server did not report a healthy storage service.");
      }
      J.storage.server = true;
      J.storage.unavailable = false;
      J.storage.backend = health.backend || "filesystem";
      J.storage.images = health.images === "blob" ? "blob" : "inline";
      J.readOnly = !health.canEdit;
      J.adminConfigured = Boolean(health.adminConfigured);
      J.adminUsername = typeof health.adminUsername === "string" ? health.adminUsername : "";
      J.adminLocalDefaults = Boolean(health.localDefaults);
    } catch (error) {
      J.storage.server = false;
      J.storage.unavailable = true;
      const connectionError = new Error(
        "The journey server is not available. Start it with “npm start”, then reload this page."
      );
      connectionError.cause = error;
      throw connectionError;
    }
  };

  J.authLogin = async function authLogin(username, password) {
    await apiRequest("/auth/login", {
      method: "POST",
      body: { username, password }
    });
    J.readOnly = false;
  };

  J.authLogout = async function authLogout() {
    await apiRequest("/auth/logout", { method: "POST", body: {} });
    J.readOnly = true;
  };

  J.uploadPreparedImage = async function uploadPreparedImage(prepared) {
    if (J.storage.images !== "blob") return prepared.dataUrl;
    const payload = await apiRequest("/images", {
      method: "POST",
      body: { dataUrl: prepared.dataUrl }
    });
    if (!payload.url) throw new Error("The picture server did not return an address.");
    return payload.url;
  };

  J.storageGetMeta = async function storageGetMeta() {
    if (J.storage.unavailable) return undefined;
    const payload = await apiRequest("/state");
    return payload.state || undefined;
  };

  J.storageSetMeta = async function storageSetMeta(stateObject) {
    if (J.storage.unavailable) return false;
    await apiRequest("/state", { method: "PUT", body: { state: stateObject } });
    return true;
  };

  J.storageGetAllDocs = async function storageGetAllDocs() {
    if (J.storage.unavailable) return {};
    const payload = await apiRequest("/docs");
    return payload.docs && typeof payload.docs === "object" ? payload.docs : {};
  };

  J.storageSetDoc = async function storageSetDoc(id, value) {
    if (J.storage.unavailable) return false;
    await apiRequest("/docs/" + encodeURIComponent(id), {
      method: "PUT",
      body: { value }
    });
    return true;
  };

  J.storageDeleteDocs = async function storageDeleteDocs(ids) {
    if (!ids.length || J.storage.unavailable) return;
    await apiRequest("/docs", { method: "DELETE", body: { ids } });
  };

  J.storageReplaceJournal = async function storageReplaceJournal(stateObject, docs) {
    if (J.storage.unavailable) {
      throw new Error("The journey server is not available.");
    }
    await apiRequest("/import", {
      method: "POST",
      body: { state: stateObject, docs }
    });
  };

  J.storageWarned = false;

  J.reportStorageError = function reportStorageError(error, message) {
    console.error("journey: storage error", error);
    if (J.storageWarned) return;
    J.storageWarned = true;
    const text = message || (
      error && error.status === 413
        ? "That change is too large for the journey server. Try a smaller picture or export a backup."
        : "Could not save to the journey server. Your latest change may not be on disk."
    );
    if (J.toast) J.toast(text, { error: true, duration: 6000 });
  };

  J.persistenceSuspended = false;
  J.pendingDocs = new Map();

  let metaTimer = null;
  let metaSave = null;
  const activeDocSaves = new Set();

  function saveDocNow(id, value, onState) {
    const request = J.storageSetDoc(id, value)
      .then(() => {
        if (onState) onState("saved");
        J.storageWarned = false;
      })
      .catch((error) => {
        if (onState) onState("error");
        J.reportStorageError(error);
      })
      .finally(() => {
        activeDocSaves.delete(request);
      });
    activeDocSaves.add(request);
    return request;
  }

  J.persistMetaSoon = function persistMetaSoon() {
    if (J.persistenceSuspended || J.readOnly) return;
    clearTimeout(metaTimer);
    metaTimer = setTimeout(() => {
      metaTimer = null;
      J.persistMetaNow().catch((error) => J.reportStorageError(error));
    }, 160);
  };

  J.persistMetaNow = async function persistMetaNow() {
    if (!J.state || J.persistenceSuspended || J.readOnly) return;
    clearTimeout(metaTimer);
    metaTimer = null;
    const stateSnapshot = JSON.parse(JSON.stringify(J.state));
    const request = J.storageSetMeta(stateSnapshot)
      .then(() => {
        J.storageWarned = false;
      })
      .catch((error) => {
        J.reportStorageError(error);
      })
      .finally(() => {
        if (metaSave === request) metaSave = null;
      });
    metaSave = request;
    await request;
  };

  J.scheduleDocSave = function scheduleDocSave(id, value, onState) {
    if (J.persistenceSuspended || J.readOnly) return;
    const existing = J.pendingDocs.get(id);
    if (existing) clearTimeout(existing.timer);
    if (onState) onState("saving");
    const timer = setTimeout(() => {
      J.pendingDocs.delete(id);
      saveDocNow(id, value, onState);
    }, 480);
    J.pendingDocs.set(id, { timer, value, onState });
  };

  J.flushDoc = function flushDoc(id) {
    const pending = J.pendingDocs.get(id);
    if (!pending) return Promise.resolve();
    clearTimeout(pending.timer);
    J.pendingDocs.delete(id);
    return saveDocNow(id, pending.value, pending.onState);
  };

  J.flushAllDocs = function flushAllDocs() {
    const promises = [];
    J.pendingDocs.forEach((pending, id) => {
      clearTimeout(pending.timer);
      promises.push(saveDocNow(id, pending.value, pending.onState));
    });
    J.pendingDocs.clear();
    return Promise.all(promises);
  };

  J.flushMeta = async function flushMeta() {
    if (!J.state) return;
    await J.persistMetaNow();
  };

  J.suspendPersistence = function suspendPersistence() {
    J.persistenceSuspended = true;
    clearTimeout(metaTimer);
    metaTimer = null;
    J.pendingDocs.forEach((pending) => clearTimeout(pending.timer));
    J.pendingDocs.clear();
  };

  J.resumePersistence = function resumePersistence() {
    J.persistenceSuspended = false;
  };

  J.waitForPendingWrites = async function waitForPendingWrites() {
    const writes = Array.from(activeDocSaves);
    if (metaSave) writes.push(metaSave);
    await Promise.allSettled(writes);
  };
})();
