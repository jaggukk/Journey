(() => {
  "use strict";

  const J = (window.Journey = window.Journey || {});

  let inlineImageTarget = null;

  function nextNoteRect() {
    const size = J.workspaceSize();
    const files = J.windows.get("files");
    let x = files ? files.x + files.w + 26 : Math.max(24, Math.round(size.w * 0.27));
    let y = 18;
    let width = Math.min(820, size.w - x - 24);
    if (width < 460) {
      width = Math.min(820, size.w - 32);
      x = Math.max(16, Math.round((size.w - width) / 2));
      y = 18;
    }
    const count = Array.from(J.windows.values()).filter((rec) => rec.kind === "note" || rec.kind === "image").length;
    const offset = (count % 4) * 18;
    return {
      x: x + offset,
      y: y + offset,
      w: width,
      h: Math.min(800, Math.max(360, Math.round((size.h - y - offset) * 0.9)))
    };
  }

  function toolbarButton(options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tb-btn" + (options.text ? " text-btn" : "");
    button.title = options.title;
    button.setAttribute("aria-label", options.title);
    if (options.html) button.innerHTML = options.html;
    else button.textContent = options.text;
    if (options.command) button.dataset.command = options.command;
    if (options.action) button.dataset.action = options.action;
    if (options.toggle) button.setAttribute("aria-pressed", "false");
    if (options.className) button.classList.add(options.className);
    button.addEventListener("mousedown", (event) => {
      if (event.button === 0) event.preventDefault();
    });
    return button;
  }

  function option(value, label, disabled) {
    const node = document.createElement("option");
    node.value = value;
    node.textContent = label;
    if (disabled) node.disabled = true;
    return node;
  }

  function fillFontOptions(select) {
    const current = select.value;
    select.textContent = "";
    select.appendChild(option("", "Font"));
    const bundled = document.createElement("optgroup");
    bundled.label = "Included";
    J.BUNDLED_FONTS.forEach((font) => bundled.appendChild(option(font.family, font.family)));
    select.appendChild(bundled);

    if (J.state && J.state.fonts.length) {
      const custom = document.createElement("optgroup");
      custom.label = "Yours";
      J.state.fonts.forEach((font) => custom.appendChild(option(font.family, font.family)));
      select.appendChild(custom);
    }

    const values = Array.from(select.options).map((entry) => entry.value);
    select.value = values.includes(current) ? current : "";
  }

  function normalizeLink(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.charAt(0) === "#") return raw;
    if (/^mailto:/i.test(raw)) return raw;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^[\w.-]+\.[a-z]{2,}([\/?#].*)?$/i.test(raw)) return "https://" + raw;
    return null;
  }

  function insertHtmlIntoEditor(rec, html) {
    if (!rec || !rec.editor || !rec.editor.isConnected) return;
    const editor = rec.editor;
    const selection = window.getSelection();
    let range = rec.savedRange;
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    try {
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (error) {
      // ignore
    }
    editor.focus({ preventScroll: true });
    try {
      document.execCommand("insertHTML", false, html);
    } catch (error) {
      const fragment = document.createRange().createContextualFragment(html);
      range.insertNode(fragment);
    }
    rec.savedRange = null;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function insertInlineImages(files, rec) {
    if (!rec || !rec.editor || !rec.editor.isConnected) return;
    const list = Array.from(files || []).filter((file) => file && file.type && file.type.startsWith("image/"));
    if (!list.length) return;
    const imageHtml = [];
    for (const file of list) {
      try {
        const prepared = await J.prepareImage(file, { maxDimension: 1600, quality: 0.86 });
        imageHtml.push(
          '<img src="' + prepared.dataUrl + '" alt="' +
          J.escapeAttr(J.stripExtension(file.name) || "picture") + '">'
        );
      } catch (error) {
        console.error(error);
        J.toast(error.message || "That picture could not be added to the note.", { error: true });
      }
    }
    if (!imageHtml.length) return;
    insertHtmlIntoEditor(rec, imageHtml.join("") + "<p><br></p>");
  }

  J.handleInlineImageFiles = function handleInlineImageFiles(files) {
    if (!inlineImageTarget || !inlineImageTarget.rec || !inlineImageTarget.rec.editor.isConnected) {
      J.toast("Open a note first, then add a picture.", { error: true });
      return;
    }
    insertInlineImages(files, inlineImageTarget.rec).finally(() => {
      inlineImageTarget = null;
    });
  };

  J.openInlineImagePicker = function openInlineImagePicker(rec) {
    inlineImageTarget = { rec };
    const input = document.getElementById("inline-image-input");
    if (!input) return;
    input.value = "";
    input.click();
  };

  J.openNoteWindow = function openNoteWindow(node, options) {
    if (!node || node.type !== "note") return null;
    const opts = options || {};
    const key = "note:" + node.id;
    const existing = J.windows.get(key);
    if (existing) {
      J.restoreWindow(existing);
      J.focusWindow(existing);
      if (opts.focusEditor && existing.editor) {
        existing.editor.focus({ preventScroll: true });
        if (opts.caretAtStart) {
          const range = document.createRange();
          range.selectNodeContents(existing.editor);
          range.collapse(true);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      return existing;
    }

    const rect = nextNoteRect();

    return J.createWindow({
      kind: "note",
      key,
      nodeId: node.id,
      title: node.name,
      width: rect.w,
      height: rect.h,
      x: rect.x,
      y: rect.y,
      minWidth: 420,
      minHeight: 260,
      populate: (body, rec) => {
        body.classList.add("note-window-body");
        const shell = document.createElement("div");
        shell.className = "note-shell";

        const toolbar = document.createElement("div");
        toolbar.className = "editor-toolbar";
        toolbar.setAttribute("role", "toolbar");
        toolbar.setAttribute("aria-label", "Note formatting");

        const styleSelect = document.createElement("select");
        styleSelect.className = "tb-select style-select";
        styleSelect.title = "Text style";
        styleSelect.setAttribute("aria-label", "Text style");
        styleSelect.appendChild(option("p", "Body"));
        styleSelect.appendChild(option("h2", "Heading"));
        styleSelect.appendChild(option("h3", "Subheading"));
        styleSelect.appendChild(option("blockquote", "Quote"));

        const fontSelect = document.createElement("select");
        fontSelect.className = "tb-select font-select";
        fontSelect.title = "Font — select text to style part of a note";
        fontSelect.setAttribute("aria-label", "Font family");
        fillFontOptions(fontSelect);

        const bold = toolbarButton({ text: "B", title: "Bold (Ctrl+B)", command: "bold", toggle: true });
        bold.style.fontWeight = "700";
        const italic = toolbarButton({ text: "I", title: "Italic (Ctrl+I)", command: "italic", toggle: true });
        italic.style.fontStyle = "italic";
        const underline = toolbarButton({ text: "U", title: "Underline (Ctrl+U)", command: "underline", toggle: true });
        underline.style.textDecoration = "underline";
        underline.style.textUnderlineOffset = "2px";

        const sep1 = document.createElement("span");
        sep1.className = "tb-sep";
        const sep2 = document.createElement("span");
        sep2.className = "tb-sep";

        const bullets = toolbarButton({
          html: J.ICONS.bulletList,
          title: "Bulleted list",
          command: "insertUnorderedList",
          toggle: true
        });
        const numbers = toolbarButton({
          html: J.ICONS.numberList,
          title: "Numbered list",
          command: "insertOrderedList",
          toggle: true
        });

        const link = toolbarButton({ html: J.ICONS.link, title: "Add link", action: "link" });
        const picture = toolbarButton({ html: J.ICONS.imageInsert, title: "Add picture", action: "image" });
        const fonts = toolbarButton({ html: J.ICONS.fonts, title: "Font styles", action: "fonts" });
        const spacer = document.createElement("span");
        spacer.className = "tb-spacer";

        toolbar.append(
          styleSelect, fontSelect, sep1,
          bold, italic, underline, sep2,
          bullets, numbers, link, picture, spacer, fonts
        );

        const scroll = document.createElement("div");
        scroll.className = "editor-scroll scrollable";
        const wrap = document.createElement("div");
        wrap.className = "editor-wrap";
        const editor = document.createElement("div");
        editor.className = "editor";
        editor.contentEditable = "true";
        editor.spellcheck = true;
        editor.setAttribute("role", "textbox");
        editor.setAttribute("aria-multiline", "true");
        editor.setAttribute("aria-label", "Note content for " + node.name);
        editor.dataset.placeholder = "Write something down…";

        const stored = J.getDoc(node.id);
        const clean = J.sanitizeHtml(stored);
        if (clean !== stored) {
          J.docs[node.id] = clean;
          J.scheduleDocSave(node.id, clean);
        }
        editor.innerHTML = clean;

        wrap.appendChild(editor);
        scroll.appendChild(wrap);

        const status = document.createElement("div");
        status.className = "editor-status";
        const saveStatus = document.createElement("span");
        saveStatus.className = "save-status";
        saveStatus.dataset.state = "saved";
        const dot = document.createElement("span");
        dot.className = "save-dot";
        dot.setAttribute("aria-hidden", "true");
        const saveText = document.createElement("span");
        saveText.textContent = "saved";
        saveStatus.appendChild(dot);
        saveStatus.appendChild(saveText);
        const count = document.createElement("span");
        count.className = "word-count";
        status.appendChild(saveStatus);
        status.appendChild(count);

        shell.appendChild(toolbar);
        shell.appendChild(scroll);
        shell.appendChild(status);
        body.appendChild(shell);

        rec.editor = editor;
        rec.fontSelect = fontSelect;
        rec.savedRange = null;
        rec.refreshFonts = () => fillFontOptions(fontSelect);

        function setSaveState(state) {
          saveStatus.dataset.state = state;
          if (state === "saving") saveText.textContent = "saving…";
          else if (state === "saved") saveText.textContent = "saved";
          else if (state === "error") saveText.textContent = "not saved";
        }

        function updateCounts() {
          updateEmptyState();
          const text = editor.innerText || editor.textContent || "";
          const words = text.trim() ? text.trim().split(/\s+/).length : 0;
          const pictures = editor.querySelectorAll("img").length;
          const wordLabel = words === 1 ? "word" : "words";
          const pictureLabel = pictures === 1 ? "picture" : "pictures";
          count.textContent = words + " " + wordLabel + (pictures ? " · " + pictures + " " + pictureLabel : "");
        }

        function updateEmptyState() {
          const hasText = (editor.innerText || editor.textContent || "").trim().length > 0;
          const hasOther = !!editor.querySelector("img, hr");
          editor.dataset.empty = String(!hasText && !hasOther);
        }

        function persistNote() {
          const html = editor.innerHTML;
          J.docs[node.id] = html;
          node.updatedAt = Date.now();
          setSaveState("saving");
          J.scheduleDocSave(node.id, html, setSaveState);
          J.persistMetaSoon();
        }

        function refreshToolbarState() {
          const selection = window.getSelection();
          if (!selection || !selection.rangeCount || !editor.contains(selection.anchorNode)) return;
          const states = {
            bold: "bold",
            italic: "italic",
            underline: "underline"
          };
          Object.keys(states).forEach((name) => {
            const button = toolbar.querySelector('[data-command="' + states[name] + '"]');
            let active = false;
            try {
              active = document.queryCommandState(states[name]);
            } catch (error) {
              active = false;
            }
            button.classList.toggle("is-on", active);
            button.setAttribute("aria-pressed", String(active));
          });
          ["insertUnorderedList", "insertOrderedList"].forEach((command) => {
            const button = toolbar.querySelector('[data-command="' + command + '"]');
            let active = false;
            try {
              active = document.queryCommandState(command);
            } catch (error) {
              active = false;
            }
            button.classList.toggle("is-on", active);
            button.setAttribute("aria-pressed", String(active));
          });

          let block = "p";
          let element = selection.anchorNode;
          while (element && element !== editor) {
            if (element.nodeType === 1) {
              const tag = element.tagName.toLowerCase();
              if (tag === "h1" || tag === "h2") { block = "h2"; break; }
              if (tag === "h3") { block = "h3"; break; }
              if (tag === "blockquote") { block = "blockquote"; break; }
              if (tag === "p" || tag === "li" || tag === "div") { block = tag === "p" ? "p" : "p"; break; }
            }
            element = element.parentNode;
          }
          if (["p", "h2", "h3", "blockquote"].includes(block)) styleSelect.value = block;

          let family = "";
          element = selection.anchorNode;
          while (element && element !== editor) {
            if (element.nodeType === 1) {
              if (element.tagName === "FONT" && element.getAttribute("face")) {
                family = element.getAttribute("face");
                break;
              }
              if (element.style && element.style.fontFamily) {
                family = element.style.fontFamily.split(",")[0].replace(/["']/g, "").trim();
                break;
              }
            }
            element = element.parentNode;
          }
          const values = Array.from(fontSelect.options).map((entry) => entry.value);
          fontSelect.value = values.includes(family) ? family : "";
        }

        const onSelectionChange = () => {
          const selection = window.getSelection();
          if (!selection || !selection.rangeCount) return;
          const range = selection.getRangeAt(0);
          if (editor.contains(range.commonAncestorContainer)) {
            rec.savedRange = range.cloneRange();
            refreshToolbarState();
          }
        };
        document.addEventListener("selectionchange", onSelectionChange);
        rec.cleanup.push(() => document.removeEventListener("selectionchange", onSelectionChange));

        function restoreSelection() {
          const selection = window.getSelection();
          if (rec.savedRange && editor.contains(rec.savedRange.commonAncestorContainer)) {
            try {
              selection.removeAllRanges();
              selection.addRange(rec.savedRange);
            } catch (error) {
              // ignore
            }
          }
          editor.focus({ preventScroll: true });
        }

        function ensureBlocks() {
          const blockTags = /^(P|H[1-6]|BLOCKQUOTE|UL|OL|PRE|FIGURE|HR|DIV|TABLE)$/;
          let group = null;
          Array.from(editor.childNodes).forEach((node) => {
            if (node.nodeType === 1 && blockTags.test(node.tagName)) {
              group = null;
              return;
            }
            if (node.nodeType === 3 && !node.textContent.trim() && !group) return;
            if (!group) {
              group = document.createElement("p");
              editor.insertBefore(group, node);
            }
            group.appendChild(node);
          });
        }

        function runCommand(command, value) {
          if (command === "formatBlock") ensureBlocks();
          restoreSelection();
          try {
            document.execCommand("styleWithCSS", false, false);
            document.execCommand(command, false, value == null ? null : value);
          } catch (error) {
            console.error(error);
          }
          if (command === "formatBlock") {
            const tag = String(value || "").replace(/[<>]/g, "").toLowerCase();
            if (tag && tag !== "p") {
              editor.querySelectorAll(tag).forEach((block) => {
                while (block.firstChild && block.firstChild.nodeName === "BR" && block.textContent.trim()) {
                  block.removeChild(block.firstChild);
                }
              });
            }
          }
          editor.focus({ preventScroll: true });
          editor.dispatchEvent(new Event("input", { bubbles: true }));
          refreshToolbarState();
        }

        editor.addEventListener("input", () => {
          persistNote();
          updateCounts();
        });
        editor.addEventListener("blur", () => {
          persistNote();
        });
        editor.addEventListener("keydown", (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            persistNote();
            J.flushDoc(node.id).then(() => setSaveState("saved"));
          }
        });
        editor.addEventListener("click", (event) => {
          const anchor = event.target.closest("a");
          if (anchor && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            window.open(anchor.href, "_blank", "noopener");
          }
        });
        editor.addEventListener("dragover", (event) => {
          if (event.dataTransfer && Array.from(event.dataTransfer.types || []).includes("Files")) {
            event.preventDefault();
            editor.classList.add("is-dropping");
          }
        });
        editor.addEventListener("dragleave", () => editor.classList.remove("is-dropping"));
        editor.addEventListener("drop", (event) => {
          if (!event.dataTransfer || !event.dataTransfer.files || !event.dataTransfer.files.length) return;
          event.preventDefault();
          editor.classList.remove("is-dropping");
          const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
          if (!files.length) return;
          let range = null;
          if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(event.clientX, event.clientY);
          else if (document.caretPositionFromPoint) {
            const position = document.caretPositionFromPoint(event.clientX, event.clientY);
            if (position) {
              range = document.createRange();
              range.setStart(position.offsetNode, position.offset);
              range.collapse(true);
            }
          }
          if (range && editor.contains(range.startContainer)) {
            rec.savedRange = range;
          }
          insertInlineImages(files, rec);
        });
        editor.addEventListener("paste", (event) => {
          const clipboard = event.clipboardData;
          if (!clipboard) return;
          const imageFiles = Array.from(clipboard.items || [])
            .filter((item) => item.kind === "file" && item.type && item.type.startsWith("image/"))
            .map((item) => item.getAsFile())
            .filter(Boolean);
          if (imageFiles.length) {
            event.preventDefault();
            insertInlineImages(imageFiles, rec);
            return;
          }
          const html = clipboard.getData("text/html");
          if (html) {
            event.preventDefault();
            const clean = J.sanitizeHtml(html);
            if (clean) insertHtmlIntoEditor(rec, clean);
          }
        });

        styleSelect.addEventListener("change", () => {
          runCommand("formatBlock", "<" + styleSelect.value + ">");
        });
        fontSelect.addEventListener("change", () => {
          const family = fontSelect.value || "Helvetica Neue";
          runCommand("fontName", family);
        });

        toolbar.querySelectorAll("[data-command]").forEach((button) => {
          button.addEventListener("click", () => {
            runCommand(button.dataset.command);
          });
        });

        toolbar.querySelector('[data-action="link"]').addEventListener("click", async () => {
          const selection = window.getSelection();
          const collapsed = !selection || !selection.rangeCount || selection.isCollapsed;
          if (collapsed) {
            J.toast("Select the words you want to turn into a link first.");
            return;
          }
          let currentHref = "";
          let anchorNode = selection.anchorNode;
          while (anchorNode && anchorNode !== editor) {
            if (anchorNode.nodeType === 1 && anchorNode.tagName === "A") {
              currentHref = anchorNode.getAttribute("href") || "";
              break;
            }
            anchorNode = anchorNode.parentNode;
          }
          const result = await J.askText({
            title: "Add link",
            message: "Leave it empty to remove the link.",
            label: "Link address",
            type: "url",
            value: currentHref,
            placeholder: "https://example.com",
            confirmLabel: "Apply",
            validate: (value) => {
              if (!value) return "";
              return normalizeLink(value) === null ? "Use a web address, email address, or #section." : "";
            }
          });
          if (result === null) return;
          restoreSelection();
          if (!result) {
            try { document.execCommand("unlink", false, null); } catch (error) { /* ignore */ }
          } else {
            const href = normalizeLink(result);
            if (!href) return;
            try {
              document.execCommand("createLink", false, href);
              editor.querySelectorAll("a").forEach((anchor) => {
                anchor.target = "_blank";
                anchor.rel = "noopener noreferrer";
              });
            } catch (error) {
              console.error(error);
            }
          }
          editor.focus({ preventScroll: true });
          editor.dispatchEvent(new Event("input", { bubbles: true }));
          refreshToolbarState();
        });

        toolbar.querySelector('[data-action="image"]').addEventListener("click", () => {
          J.openInlineImagePicker(rec);
        });
        toolbar.querySelector('[data-action="fonts"]').addEventListener("click", () => {
          if (J.openFontsWindow) J.openFontsWindow();
        });

        rec.onClose = () => {
          persistNote();
          J.flushDoc(node.id);
        };

        updateCounts();
        updateEmptyState();
        if (opts.focusEditor) {
          requestAnimationFrame(() => {
            editor.focus({ preventScroll: true });
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
          });
        }
      }
    });
  };
})();
