(() => {
  "use strict";

  const J = (window.Journey = window.Journey || {});

  function parseHashTarget() {
    const match = window.location.hash.match(/^#\/(note|image)\/([^/]+)$/);
    if (!match) return null;
    let id = match[2];
    try {
      id = decodeURIComponent(id);
    } catch (error) {
      return null;
    }
    const node = J.findNode(id);
    if (!node) return null;
    if (match[1] === "note" && node.type !== "note") return null;
    if (match[1] === "image" && node.type !== "image") return null;
    return node;
  }

  async function loadOrSeed() {
    let loadedState = null;
    let loadedDocs = {};
    try {
      const rawState = await J.storageGetMeta();
      if (rawState) {
        loadedState = J.normalizeState(rawState);
        if (loadedState) loadedDocs = await J.storageGetAllDocs();
      }
    } catch (error) {
      console.error("journey: could not read saved data", error);
      J.toast("The saved index could not be read. Starting with the starter files.", { error: true, duration: 6000 });
    }

    if (loadedState) {
      J.state = loadedState;
      J.docs = J.ensureDocs(loadedState, loadedDocs);
      try {
        await J.storageSetMeta(loadedState);
      } catch (error) {
        J.reportStorageError(error);
      }
      return;
    }

    const seed = J.seedContent();
    J.state = seed.state;
    J.docs = seed.docs;
    try {
      await J.storageSetMeta(J.state);
      for (const [id, value] of Object.entries(J.docs)) {
        await J.storageSetDoc(id, value);
      }
    } catch (error) {
      J.reportStorageError(error);
    }
  }

  function openInitialNote() {
    const fromHash = parseHashTarget();
    if (fromHash) {
      J.openNode(fromHash.id);
      return;
    }
    if (J.isMobile()) return;
    const last = J.state.lastNoteId ? J.findNode(J.state.lastNoteId) : null;
    if (last && last.type === "note") {
      J.openNode(last.id);
      return;
    }
    const welcome = J.state.welcomeId ? J.findNode(J.state.welcomeId) : null;
    if (welcome && welcome.type === "note") {
      J.openNode(welcome.id);
      return;
    }
    const first = J.firstNote();
    if (first) J.openNode(first.id);
  }

  function wireGlobalEvents() {
    const reopen = document.getElementById("reopen-files");
    if (reopen) reopen.addEventListener("click", () => J.openFilesWindow());

    const imageInput = document.getElementById("image-upload-input");
    if (imageInput) {
      imageInput.addEventListener("change", async () => {
        const files = Array.from(imageInput.files || []);
        imageInput.value = "";
        if (!files.length) return;
        try {
          await J.handleImageUploadFiles(files);
        } catch (error) {
          console.error(error);
          J.toast("Those pictures could not be added.", { error: true });
        }
      });
    }

    const inlineInput = document.getElementById("inline-image-input");
    if (inlineInput) {
      inlineInput.addEventListener("change", () => {
        const files = Array.from(inlineInput.files || []);
        inlineInput.value = "";
        if (files.length) J.handleInlineImageFiles(files);
      });
    }

    const importInput = document.getElementById("backup-import-input");
    if (importInput) {
      importInput.addEventListener("change", async () => {
        const file = importInput.files && importInput.files[0];
        importInput.value = "";
        if (file) await J.importBackupFile(file);
      });
    }

    const onResize = J.debounce(() => J.constrainWindows(), 120);
    window.addEventListener("resize", onResize);

    window.addEventListener("hashchange", () => {
      const target = parseHashTarget();
      if (target) J.openNode(target.id);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        J.flushAllDocs();
        J.flushMeta();
      }
    });

    window.addEventListener("beforeunload", () => {
      J.flushAllDocs();
      J.flushMeta();
    });

    window.addEventListener("dragover", (event) => {
      if (event.dataTransfer && Array.from(event.dataTransfer.types || []).includes("Files")) {
        event.preventDefault();
      }
    });
    window.addEventListener("drop", (event) => {
      if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
        if (!event.defaultPrevented) event.preventDefault();
      }
    });
  }

  async function init() {
    const workspace = document.getElementById("workspace");
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch (error) {
      // Older browsers fall back to their own block element.
    }
    const boot = document.createElement("div");
    boot.className = "boot-note";
    boot.textContent = "opening…";
    if (workspace) workspace.appendChild(boot);

    try {
      await J.initStorage();
    } catch (error) {
      console.warn("journey: storage unavailable", error);
      J.storage.unavailable = true;
      J.storage.fallback = true;
    }

    await loadOrSeed();
    J.applyCustomFontImports();
    wireGlobalEvents();

    if (J.storage.unavailable) {
      J.toast(
        "This browser is blocking local storage, so changes will be lost when you close the page. Export a backup before you leave.",
        { error: true, duration: 10000 }
      );
    }

    if (boot) boot.remove();
    J.openFilesWindow();
    openInitialNote();
    J.updateFilesReopen();
    J.updateFileScope();
  }

  init().catch((error) => {
    console.error("journey: could not start", error);
    const workspace = document.getElementById("workspace");
    if (workspace) {
      workspace.textContent = "";
      const message = document.createElement("div");
      message.className = "boot-note";
      message.textContent = "journey could not start. Please reload the page.";
      workspace.appendChild(message);
    }
  });
})();
