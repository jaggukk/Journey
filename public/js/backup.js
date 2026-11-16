(() => {
  "use strict";

  const J = (window.Journey = window.Journey || {});

  J.exportBackup = async function exportBackup() {
    if (!J.state) return;
    try {
      await J.flushAllDocs();
      const payload = {
        app: "journey",
        version: 1,
        exportedAt: new Date().toISOString(),
        state: J.state,
        docs: J.docs
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = "journey-backup-" + date + ".json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      J.toast("Backup downloaded.");
    } catch (error) {
      console.error(error);
      J.toast("The backup could not be created.", { error: true });
    }
  };

  J.startBackupImport = function startBackupImport() {
    const input = document.getElementById("backup-import-input");
    if (!input) return;
    input.value = "";
    input.click();
  };

  J.importBackupFile = async function importBackupFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload || !payload.state) throw new Error("This is not a JAGAN K K backup.");
      const newState = J.normalizeState(payload.state);
      if (!newState) throw new Error("This backup does not contain a readable file tree.");
      const newDocs = J.ensureDocs(newState, payload.docs || {});
      const fileCount = Object.keys(newDocs).length;
      const confirmed = await J.confirmDialog({
        title: "Import backup",
        message: "Replace everything currently in JAGAN K K with this backup? It contains " + fileCount +
          " " + (fileCount === 1 ? "file" : "files") + ". This cannot be undone.",
        confirmLabel: "Replace everything",
        danger: true
      });
      if (!confirmed) return;

      // Finish old writes, then stop persistence so no timer can overwrite the import.
      await J.flushAllDocs();
      J.suspendPersistence();
      await J.waitForPendingWrites();

      await J.storageReplaceJournal(newState, newDocs);

      // Adopt the imported state before the reload. The beforeunload handler
      // flushes J.state, so leaving the old object here would overwrite the
      // import we just wrote.
      J.state = newState;
      J.docs = newDocs;
      J.applyCustomFontImports();
      J.toast("Backup imported. Reloading…");
      setTimeout(() => {
        if (location.hash) history.replaceState(null, "", location.pathname + location.search);
        location.reload();
      }, 250);
    } catch (error) {
      J.resumePersistence();
      console.error(error);
      J.toast(error.message || "That backup could not be imported.", { error: true, duration: 5000 });
    }
  };
})();
