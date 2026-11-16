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

  function openLogin() {
    J.openModal({
      title: "Admin sign in",
      confirmLabel: "Sign in",
      build: (content) => {
        const copy = document.createElement("p");
        copy.className = "dialog-copy";
        copy.textContent = "Sign in to create, edit, and delete journal entries on this browser.";
        const label = document.createElement("label");
        label.className = "field";
        const labelText = document.createElement("span");
        labelText.className = "field-label";
        labelText.textContent = "Password";
        const input = document.createElement("input");
        input.className = "text-input";
        input.type = "password";
        input.autocomplete = "current-password";
        input.dataset.field = "password";
        input.spellcheck = false;
        label.appendChild(labelText);
        label.appendChild(input);
        content.appendChild(copy);
        content.appendChild(label);
      },
      onSubmit: async (content) => {
        const input = content.querySelector('[data-field="password"]');
        const password = input.value;
        if (!password) return { ok: false, error: "Enter your admin password." };
        try {
          await J.authLogin(password);
          return { ok: true, value: true };
        } catch (error) {
          return { ok: false, error: error.message || "That password is not correct." };
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
