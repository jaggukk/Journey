(() => {
  "use strict";

  const J = (window.Journey = window.Journey || {});

  let adminButton = null;

  function renderAdmin() {
    if (!adminButton) return;
    adminButton.classList.toggle("is-authed", !J.readOnly);
    adminButton.setAttribute("aria-expanded", "false");
    adminButton.title = J.readOnly
      ? J.adminConfigured
        ? "Sign in as admin"
        : "Admin login is not configured"
      : "Signed in as admin";
    adminButton.setAttribute("aria-label", adminButton.title);
  }

  function field(name, labelText, type) {
    const label = document.createElement("label");
    label.className = "field";
    const span = document.createElement("span");
    span.className = "field-label";
    span.textContent = labelText;
    const input = document.createElement("input");
    input.className = "text-input";
    input.type = type;
    input.autocomplete = type === "password" ? "current-password" : "username";
    input.dataset.field = name;
    input.spellcheck = false;
    input.autocapitalize = "none";
    label.appendChild(span);
    label.appendChild(input);
    return { label, input };
  }

  function openLogin() {
    J.openModal({
      title: "Admin sign in",
      confirmLabel: "Sign in",
      build: (content) => {
        const copy = document.createElement("p");
        copy.className = "dialog-copy";
        copy.textContent = "Sign in to create, edit, and delete journal entries.";
        const username = field("username", "Username", "text");
        const password = field("password", "Password", "password");
        content.appendChild(copy);
        content.appendChild(username.label);
        content.appendChild(password.label);
        if (J.adminLocalDefaults) {
          const hint = document.createElement("p");
          hint.className = "dialog-copy";
          hint.textContent =
            "This server is using the local defaults: admin / journey. Add JOURNEY_ADMIN_USERNAME and JOURNEY_ADMIN_PASSWORD to .env to change them.";
          content.appendChild(hint);
        }
      },
      onSubmit: async (content) => {
        const usernameInput = content.querySelector('[data-field="username"]');
        const passwordInput = content.querySelector('[data-field="password"]');
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        if (!username) return { ok: false, error: "Enter your admin username." };
        if (!password) return { ok: false, error: "Enter your admin password." };
        try {
          await J.authLogin(username, password);
          return { ok: true, value: true };
        } catch (error) {
          return { ok: false, error: error.message || "That username or password is not correct." };
        }
      }
    }).then((signedIn) => {
      if (signedIn) location.reload();
    });
  }

  async function signOut() {
    try {
      await J.authLogout();
      const response = await fetch("/api/health", {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      const health = await response.json();
      J.readOnly = !health.canEdit;
      J.adminConfigured = Boolean(health.adminConfigured);
      J.adminLocalDefaults = Boolean(health.localDefaults);
      renderAdmin();
      J.toast("Signed out.");
    } catch (error) {
      console.error(error);
      J.toast("Could not sign out. Please try again.", { error: true });
    }
  }

  function menuItems() {
    if (!J.readOnly) {
      return [
        { label: "Signed in as admin", disabled: true },
        { type: "separator" },
        {
          label: "Sign out",
          action: signOut
        }
      ];
    }

    if (!J.adminConfigured) {
      return [
        {
          label: "Admin login is not configured",
          disabled: true
        }
      ];
    }

    return [
      {
        label: "Sign in as admin",
        action: openLogin
      }
    ];
  }

  J.initAdmin = function initAdmin() {
    adminButton = document.getElementById("admin-toggle");
    if (!adminButton) return;

    adminButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const rect = adminButton.getBoundingClientRect();
      adminButton.setAttribute("aria-expanded", "true");
      J.showMenu(menuItems(), rect.left, rect.bottom + 6);
      queueMicrotask(() => {
        const close = () => {
          adminButton.setAttribute("aria-expanded", "false");
          document.removeEventListener("pointerdown", close, true);
        };
        document.addEventListener("pointerdown", close, true);
      });
    });

    renderAdmin();
  };

  J.openAdminLogin = openLogin;
})();
