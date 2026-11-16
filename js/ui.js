(() => {
  "use strict";

  const J = (window.Journey = window.Journey || {});

  J.toast = function toast(message, options) {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const opts = options || {};
    const node = document.createElement("div");
    node.className = "toast" + (opts.error ? " is-error" : "");
    node.textContent = String(message);
    root.appendChild(node);
    const duration = Number(opts.duration) || 3200;
    setTimeout(() => {
      node.classList.add("is-leaving");
      setTimeout(() => node.remove(), 180);
    }, duration);
  };

  let currentMenu = null;
  let menuCleanup = null;

  J.closeMenu = function closeMenu() {
    if (menuCleanup) {
      menuCleanup();
      menuCleanup = null;
    }
    if (currentMenu) {
      currentMenu.remove();
      currentMenu = null;
    }
  };

  J.showMenu = function showMenu(items, x, y) {
    J.closeMenu();
    const root = document.getElementById("menu-root");
    if (!root) return;
    const menu = document.createElement("div");
    menu.className = "menu";
    menu.setAttribute("role", "menu");

    items.forEach((item) => {
      if (!item) return;
      if (item.type === "separator") {
        const sep = document.createElement("div");
        sep.className = "menu-sep";
        menu.appendChild(sep);
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "menuitem");
      if (item.shortcut) {
        const shortcut = document.createElement("span");
        shortcut.className = "shortcut";
        shortcut.textContent = item.shortcut;
        button.textContent = item.label;
        button.appendChild(shortcut);
      } else {
        button.textContent = item.label;
      }
      if (item.danger) button.classList.add("danger");
      if (item.disabled) button.disabled = true;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        J.closeMenu();
        if (item.action) {
          try {
            const result = item.action();
            if (result && typeof result.catch === "function") {
              result.catch((error) => {
                console.error(error);
                J.toast("Something went wrong. Please try again.", { error: true });
              });
            }
          } catch (error) {
            console.error(error);
            J.toast("Something went wrong. Please try again.", { error: true });
          }
        }
      });
      menu.appendChild(button);
    });

    root.appendChild(menu);

    const margin = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rect = menu.getBoundingClientRect();
    const left = J.clamp(x, margin, Math.max(margin, viewportWidth - rect.width - margin));
    const top = J.clamp(y, margin, Math.max(margin, viewportHeight - rect.height - margin));
    menu.style.left = left + "px";
    menu.style.top = top + "px";
    currentMenu = menu;

    const first = menu.querySelector("button:not(:disabled)");
    if (first) first.focus();

    const onPointerDown = (event) => {
      if (!menu.contains(event.target)) J.closeMenu();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        J.closeMenu();
        return;
      }
      const buttons = Array.from(menu.querySelectorAll("button:not(:disabled)"));
      if (!buttons.length) return;
      const index = buttons.indexOf(document.activeElement);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        buttons[(index + 1 + buttons.length) % buttons.length].focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        buttons[(index - 1 + buttons.length) % buttons.length].focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        buttons[0].focus();
      } else if (event.key === "End") {
        event.preventDefault();
        buttons[buttons.length - 1].focus();
      }
    };
    const onViewportChange = () => J.closeMenu();

    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
      window.addEventListener("resize", onViewportChange);
      window.addEventListener("blur", onViewportChange);
    }, 0);

    menu.addEventListener("keydown", onKeyDown);
    menuCleanup = () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("blur", onViewportChange);
      menu.removeEventListener("keydown", onKeyDown);
    };
  };

  J.showMenuForButton = function showMenuForButton(button, items) {
    const rect = button.getBoundingClientRect();
    J.showMenu(items, rect.left, rect.bottom + 4);
  };

  function focusableElements(container) {
    return Array.from(
      container.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.offsetParent !== null);
  }

  J.openModal = function openModal(options) {
    return new Promise((resolve) => {
      const opts = options || {};
      const root = document.getElementById("overlay-root");
      const app = document.getElementById("app");
      const previousFocus = document.activeElement;
      const overlay = document.createElement("div");
      overlay.className = "overlay";

      const dialog = document.createElement("div");
      dialog.className = "dialog";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      const titleId = J.uid("dialogtitle");
      dialog.setAttribute("aria-labelledby", titleId);

      const bar = document.createElement("div");
      bar.className = "titlebar";
      const title = document.createElement("span");
      title.className = "window-title";
      title.id = titleId;
      title.textContent = opts.title || "";
      const controls = document.createElement("div");
      controls.className = "window-controls";
      const close = document.createElement("button");
      close.type = "button";
      close.className = "ctl";
      close.setAttribute("aria-label", "Close");
      close.title = "Close";
      close.innerHTML = J.ICONS.close;
      controls.appendChild(close);
      bar.appendChild(title);
      bar.appendChild(controls);

      const form = document.createElement("form");
      form.className = "dialog-body";
      form.noValidate = true;

      const content = document.createElement("div");
      form.appendChild(content);

      const error = document.createElement("p");
      error.className = "dialog-error";
      error.setAttribute("role", "alert");
      form.appendChild(error);

      const actions = document.createElement("div");
      actions.className = "dialog-actions";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn secondary";
      cancel.textContent = opts.cancelLabel || "Cancel";
      const confirm = document.createElement("button");
      confirm.type = "submit";
      confirm.className = "btn" + (opts.danger ? " danger" : "");
      confirm.textContent = opts.confirmLabel || "Create";
      actions.appendChild(cancel);
      actions.appendChild(confirm);
      form.appendChild(actions);

      dialog.appendChild(bar);
      dialog.appendChild(form);
      overlay.appendChild(dialog);
      root.appendChild(overlay);

      if (app) app.inert = true;
      document.body.classList.add("has-modal");

      let closed = false;
      const finish = (value) => {
        if (closed) return;
        closed = true;
        document.removeEventListener("keydown", onKeyDown, true);
        overlay.remove();
        if (app) app.inert = false;
        document.body.classList.remove("has-modal");
        if (previousFocus && typeof previousFocus.focus === "function") {
          try {
            previousFocus.focus({ preventScroll: true });
          } catch (error) {
            previousFocus.focus();
          }
        }
        resolve(value);
      };

      const onKeyDown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish(null);
          return;
        }
        if (event.key === "Tab") {
          const items = focusableElements(dialog);
          if (!items.length) return;
          const first = items[0];
          const last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      };

      close.addEventListener("click", () => finish(null));
      cancel.addEventListener("click", () => finish(null));
      overlay.addEventListener("pointerdown", (event) => {
        if (event.target === overlay) finish(null);
      });
      document.addEventListener("keydown", onKeyDown, true);

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        error.textContent = "";
        confirm.disabled = true;
        try {
          const result = opts.onSubmit ? await opts.onSubmit(content, form) : { ok: true, value: true };
          if (!result || result.ok === false) {
            error.textContent = (result && result.error) || "Please check that and try again.";
            confirm.disabled = false;
            return;
          }
          finish(result.value === undefined ? true : result.value);
        } catch (submitError) {
          console.error(submitError);
          error.textContent = "Something went wrong. Please try again.";
          confirm.disabled = false;
        }
      });

      if (opts.build) opts.build(content, form);
      requestAnimationFrame(() => {
        const firstField = focusableElements(dialog).find((element) => /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName));
        if (firstField) {
          firstField.focus();
          if (typeof firstField.select === "function" && firstField.tagName === "INPUT") firstField.select();
        } else {
          confirm.focus();
        }
      });
    });
  };

  J.askName = function askName(options) {
    const opts = options || {};
    return J.openModal({
      title: opts.title || "Name",
      confirmLabel: opts.confirmLabel || "Create",
      build: (content) => {
        const label = document.createElement("label");
        label.className = "field";
        const labelText = document.createElement("span");
        labelText.className = "field-label";
        labelText.textContent = opts.label || "Name";
        const input = document.createElement("input");
        input.className = "text-input";
        input.type = "text";
        input.value = opts.value || "";
        input.maxLength = 80;
        input.autocomplete = "off";
        input.spellcheck = false;
        input.dataset.field = "name";
        label.appendChild(labelText);
        label.appendChild(input);
        content.appendChild(label);
      },
      onSubmit: (content) => {
        const input = content.querySelector('[data-field="name"]');
        const name = J.sanitizeName(input.value, "");
        if (!name) return { ok: false, error: "Give it a name first." };
        return { ok: true, value: name };
      }
    });
  };

  J.askText = function askText(options) {
    const opts = options || {};
    return J.openModal({
      title: opts.title || "Add text",
      confirmLabel: opts.confirmLabel || "OK",
      build: (content) => {
        if (opts.message) {
          const message = document.createElement("p");
          message.className = "dialog-copy";
          message.textContent = opts.message;
          content.appendChild(message);
        }
        const label = document.createElement("label");
        label.className = "field";
        const labelText = document.createElement("span");
        labelText.className = "field-label";
        labelText.textContent = opts.label || "";
        const input = document.createElement("input");
        input.className = "text-input";
        input.type = opts.type || "text";
        input.value = opts.value || "";
        input.placeholder = opts.placeholder || "";
        input.autocomplete = "off";
        input.spellcheck = false;
        input.dataset.field = "text";
        label.appendChild(labelText);
        label.appendChild(input);
        content.appendChild(label);
      },
      onSubmit: (content) => {
        const input = content.querySelector('[data-field="text"]');
        const value = input.value.trim();
        if (opts.validate) {
          const error = opts.validate(value);
          if (error) return { ok: false, error };
        }
        return { ok: true, value };
      }
    });
  };

  J.confirmDialog = function confirmDialog(options) {
    const opts = options || {};
    return J.openModal({
      title: opts.title || "Are you sure?",
      confirmLabel: opts.confirmLabel || "Confirm",
      cancelLabel: opts.cancelLabel || "Cancel",
      danger: !!opts.danger,
      build: (content) => {
        const message = document.createElement("p");
        message.className = "dialog-copy";
        message.textContent = opts.message || "This cannot be undone.";
        content.appendChild(message);
      },
      onSubmit: () => ({ ok: true, value: true })
    }).then((result) => result === true);
  };
})();
