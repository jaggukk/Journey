(() => {
  "use strict";

  const J = (window.Journey = window.Journey || {});

  function fontStyleElement() {
    let style = document.getElementById("custom-fonts");
    if (!style) {
      style = document.createElement("style");
      style.id = "custom-fonts";
      document.head.appendChild(style);
    }
    return style;
  }

  function safeUrl(url) {
    return String(url || "").replace(/["'\\\n\r]/g, "");
  }

  J.applyCustomFontImports = function applyCustomFontImports() {
    const style = fontStyleElement();
    const imports = (J.state && J.state.fonts ? J.state.fonts : [])
      .filter((font) => font && /^https:\/\//i.test(font.url) && font.family)
      .map((font) => '@import url("' + safeUrl(font.url) + '");')
      .join("\n");
    style.textContent = imports;
  };

  J.refreshFontSelects = function refreshFontSelects() {
    J.windows.forEach((rec) => {
      if (rec.kind === "note" && typeof rec.refreshFonts === "function") rec.refreshFonts();
    });
  };

  function extractUrl(raw) {
    const text = String(raw || "").trim();
    if (!text || /^[^:\/]+\s*$/.test(text) && !/https?:/i.test(text)) return { url: "", familyOnly: text };
    const urlMatch = text.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
    if (urlMatch) return { url: urlMatch[1].trim(), familyOnly: "" };
    const plainMatch = text.match(/https?:\/\/[^\s'"<>)]+/i);
    if (plainMatch) return { url: plainMatch[0].replace(/[;,]+$/, ""), familyOnly: "" };
    if (text.indexOf("http") === -1) return { url: "", familyOnly: text.replace(/^[\s'"]+|[\s'"]+$/g, "") };
    return { url: "", familyOnly: "" };
  }

  function familyFromUrl(url) {
    try {
      const parsed = new URL(url);
      const families = parsed.searchParams.getAll("family");
      if (!families.length) return "";
      return families[0]
        .split(":")[0]
        .replace(/\+/g, " ")
        .trim();
    } catch (error) {
      return "";
    }
  }

  function normalizedUrl(url) {
    try {
      const parsed = new URL(String(url || "").trim());
      if (parsed.protocol !== "https:") return "";
      return parsed.href;
    } catch (error) {
      return "";
    }
  }

  function googleFontUrl(family) {
    const query = encodeURIComponent(family).replace(/%20/g, "+");
    return "https://fonts.googleapis.com/css2?family=" + query + "&display=swap";
  }

  function validFamily(family) {
    return !!family && family.length <= 60 && !/[<>"'\\;{}]/.test(family);
  }

  function fontRow(font, options) {
    const opts = options || {};
    const row = document.createElement("div");
    row.className = "font-row";

    const sample = document.createElement("div");
    sample.className = "font-sample";
    sample.style.fontFamily = opts.css || ('"' + font.family + '", sans-serif');
    sample.textContent = "Aa";

    const info = document.createElement("div");
    info.className = "font-info";
    const name = document.createElement("div");
    name.className = "font-name";
    name.textContent = font.family;
    const sampleLine = document.createElement("div");
    sampleLine.className = "font-sample-line";
    sampleLine.style.fontFamily = opts.css || ('"' + font.family + '", sans-serif');
    sampleLine.textContent = "The quick brown fox jumps over the lazy dog.";
    const tag = document.createElement("span");
    tag.className = "font-tag";
    tag.textContent = opts.custom ? "added" : "included";
    info.appendChild(name);
    info.appendChild(sampleLine);
    info.appendChild(tag);

    row.appendChild(sample);
    row.appendChild(info);

    if (opts.custom) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "font-remove";
      remove.textContent = "remove";
      remove.title = "Remove " + font.family;
      remove.addEventListener("click", () => {
        J.state.fonts = J.state.fonts.filter((entry) => entry.id !== font.id);
        J.applyCustomFontImports();
        J.refreshFontSelects();
        J.persistMetaNow();
        opts.onRemove();
        J.toast("Removed " + font.family + ". Anything using it now falls back to the default font.");
      });
      row.appendChild(remove);
    } else {
      const spacer = document.createElement("span");
      row.appendChild(spacer);
    }

    return row;
  }

  J.openFontsWindow = function openFontsWindow() {
    const key = "fonts";
    const existing = J.windows.get(key);
    if (existing) {
      J.restoreWindow(existing);
      J.focusWindow(existing);
      return existing;
    }

    const size = J.workspaceSize();
    const width = Math.min(670, Math.max(340, size.w - 60));
    const height = Math.min(640, Math.max(320, size.h - 60));
    const x = Math.max(16, Math.round((size.w - width) / 2) + 14);
    const y = Math.max(16, Math.round((size.h - height) / 2) + 10);

    return J.createWindow({
      kind: "fonts",
      key,
      title: "Font styles",
      width,
      height,
      x,
      y,
      minWidth: 380,
      minHeight: 300,
      populate: (body) => {
        body.classList.add("fonts-body", "scrollable");

        const intro = document.createElement("div");
        intro.className = "fonts-intro";
        const heading = document.createElement("h2");
        heading.textContent = "Font styles";
        const introCopy = document.createElement("p");
        introCopy.textContent = "Choose a font in any note's toolbar. Select text to style part of a note, or press Ctrl/⌘ + A to change the whole note.";
        const introHint = document.createElement("p");
        introHint.textContent = "Add any Google Fonts style below. Paste the full <style> snippet, an @import, a CSS URL, or just the font's name. Added fonts appear in every note.";
        intro.appendChild(heading);
        intro.appendChild(introCopy);
        intro.appendChild(introHint);

        const form = document.createElement("form");
        form.className = "font-form";
        form.noValidate = true;

        const nameField = document.createElement("label");
        nameField.className = "field";
        const nameLabel = document.createElement("span");
        nameLabel.className = "field-label";
        nameLabel.textContent = "Name (optional)";
        const nameInput = document.createElement("input");
        nameInput.className = "text-input";
        nameInput.type = "text";
        nameInput.maxLength = 60;
        nameInput.placeholder = "Detected from the import";
        nameInput.autocomplete = "off";
        nameInput.spellcheck = false;
        nameField.appendChild(nameLabel);
        nameField.appendChild(nameInput);

        const importField = document.createElement("label");
        importField.className = "field";
        const importLabel = document.createElement("span");
        importLabel.className = "field-label";
        importLabel.textContent = "Google Fonts import";
        const importInput = document.createElement("textarea");
        importInput.className = "text-area";
        importInput.rows = 3;
        importInput.placeholder = J.WELCOME_EXAMPLE;
        importInput.spellcheck = false;
        importField.appendChild(importLabel);
        importField.appendChild(importInput);

        const example = document.createElement("button");
        example.type = "button";
        example.className = "link-button";
        example.textContent = "use the example";
        example.addEventListener("click", () => {
          importInput.value = J.WELCOME_EXAMPLE;
          nameInput.value = "";
          error.textContent = "";
          importInput.focus();
        });
        const hint = document.createElement("p");
        hint.className = "field-hint";
        hint.appendChild(document.createTextNode("Needs an internet connection. "));
        hint.appendChild(example);

        const error = document.createElement("p");
        error.className = "form-error";
        error.setAttribute("role", "alert");

        const actions = document.createElement("div");
        actions.className = "form-actions";
        const add = document.createElement("button");
        add.type = "submit";
        add.className = "btn";
        add.textContent = "Add font style";
        actions.appendChild(add);

        form.appendChild(nameField);
        form.appendChild(importField);
        form.appendChild(hint);
        form.appendChild(error);
        form.appendChild(actions);

        const bundledTitle = document.createElement("div");
        bundledTitle.className = "font-section-title";
        const bundledHeading = document.createElement("h3");
        bundledHeading.textContent = "Included";
        const bundledCount = document.createElement("span");
        bundledCount.textContent = J.BUNDLED_FONTS.length + " styles";
        bundledTitle.appendChild(bundledHeading);
        bundledTitle.appendChild(bundledCount);

        const bundledList = document.createElement("div");
        bundledList.className = "font-list";
        J.BUNDLED_FONTS.forEach((font) => {
          bundledList.appendChild(fontRow(font, { css: font.css }));
        });

        const customTitle = document.createElement("div");
        customTitle.className = "font-section-title";
        const customHeading = document.createElement("h3");
        customHeading.textContent = "Yours";
        const customCount = document.createElement("span");
        customTitle.appendChild(customHeading);
        customTitle.appendChild(customCount);

        const customList = document.createElement("div");
        customList.className = "font-list";

        function renderCustomList() {
          customList.textContent = "";
          customCount.textContent = (J.state.fonts.length || 0) + (J.state.fonts.length === 1 ? " style" : " styles");
          if (!J.state.fonts.length) {
            const empty = document.createElement("div");
            empty.className = "fonts-empty";
            empty.textContent = "Nothing added yet. Paste the snippet above to begin.";
            customList.appendChild(empty);
            return;
          }
          J.state.fonts.forEach((font) => {
            customList.appendChild(fontRow(font, { custom: true, onRemove: renderCustomList }));
          });
        }
        renderCustomList();

        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          error.textContent = "";
          const raw = importInput.value.trim();
          const typedName = J.sanitizeName(nameInput.value, "");
          let url = "";
          let family = typedName;

          const extracted = extractUrl(raw);
          if (extracted.url) {
            url = normalizedUrl(extracted.url);
            family = familyFromUrl(url) || typedName || extracted.familyOnly;
          } else if (extracted.familyOnly) {
            family = typedName || extracted.familyOnly;
          }

          if (!family && !url) {
            error.textContent = "Paste a Google Fonts import or type a font name.";
            return;
          }
          family = String(family || "").trim();
          if (!validFamily(family)) {
            error.textContent = "That font name contains characters the browser cannot use.";
            return;
          }
          if (!url) url = googleFontUrl(family);
          if (!normalizedUrl(url)) {
            error.textContent = "Use a secure https:// Google Fonts CSS address.";
            return;
          }

          const duplicate = J.BUNDLED_FONTS.some((font) => font.family.toLowerCase() === family.toLowerCase()) ||
            J.state.fonts.some((font) => font.family.toLowerCase() === family.toLowerCase());
          if (duplicate) {
            error.textContent = family + " is already in the list.";
            return;
          }

          J.state.fonts.push({
            id: J.uid("font"),
            family,
            url,
            addedAt: Date.now()
          });
          J.applyCustomFontImports();
          J.refreshFontSelects();
          await J.persistMetaNow();
          renderCustomList();
          importInput.value = "";
          nameInput.value = "";
          J.toast("Added " + family + " to your fonts.");
          importInput.focus();
        });

        body.appendChild(intro);
        body.appendChild(form);
        body.appendChild(bundledTitle);
        body.appendChild(bundledList);
        body.appendChild(customTitle);
        body.appendChild(customList);
      }
    });
  };
})();
