/**
 * Devlog — Popup Controller
 * 
 * Quick capture mode. Write, tag, save. 
 * Link to full tab for browsing/editing.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Load theme/font before anything renders
  themes.loadTheme().then(name => {
    document.querySelectorAll(".theme-dot").forEach(d => d.classList.toggle("active", d.dataset.theme === name));
  });
  themes.loadWritingFont();

  const authScreen   = document.getElementById("auth-screen");
  const appScreen    = document.getElementById("app-screen");
  const authEmail    = document.getElementById("auth-email");
  const authPassword = document.getElementById("auth-password");
  const btnLogin     = document.getElementById("btn-login");
  const btnSignup    = document.getElementById("btn-signup");
  const btnForgot    = document.getElementById("btn-forgot");
  const authError    = document.getElementById("auth-error");
  const btnSignout   = document.getElementById("btn-signout");
  const btnOpenTab   = document.getElementById("btn-open-tab");

  const writeDate      = document.getElementById("write-date");
  const writeArea      = document.getElementById("write-area");
  const tagInput       = document.getElementById("tag-input");
  const btnSave        = document.getElementById("btn-save");
  const wordCount      = document.getElementById("word-count");
  const toast          = document.getElementById("toast");
  const namePrompt     = document.getElementById("name-prompt");
  const nameInput      = document.getElementById("name-input");
  const btnSaveName    = document.getElementById("btn-save-name");
  const greeting       = document.getElementById("greeting");
  const draftIndicator = document.getElementById("draft-indicator");

  let draftTimer = null;

  // ── Auth ──

  db.onAuthChange(async (user) => {
    if (user) {
      authScreen.classList.remove("active");
      appScreen.classList.add("active");
      writeDate.textContent = utils.formatDate(new Date());
      await initGreeting();
      await restoreDraft();
      await syncPendingEntries();
      loadNotebookSelect();
      writeArea.focus();
    } else {
      authScreen.classList.add("active");
      appScreen.classList.remove("active");
    }
  });

  async function syncPendingEntries() {
    const pending = await utils.loadPendingEntries();
    if (pending.length === 0) return;

    let synced = 0;
    for (const entry of pending) {
      try {
        await db.createEntry(entry.content, entry.tags);
        synced++;
      } catch (err) {
        console.error("Failed to sync pending entry:", err);
      }
    }

    await utils.clearPendingEntries();
    if (synced > 0) {
      utils.showToast(toast, `Synced ${synced} bookmark${synced > 1 ? "s" : ""}`);
    }
  }

  function showAuthError(msg) {
    authError.textContent = msg;
    authError.style.display = "block";
    setTimeout(() => { authError.style.display = "none"; }, 4000);
  }

  btnLogin.addEventListener("click", async () => {
    const email = authEmail.value.trim();
    const pass = authPassword.value;
    if (!email || !pass) return showAuthError("Enter email and password.");

    btnLogin.textContent = "Signing in...";
    btnLogin.disabled = true;
    try {
      await db.signIn(email, pass);
    } catch (err) {
      showAuthError(err.message.replace("Firebase: ", ""));
    } finally {
      btnLogin.textContent = "Sign in";
      btnLogin.disabled = false;
    }
  });

  btnSignup.addEventListener("click", async () => {
    const email = authEmail.value.trim();
    const pass = authPassword.value;
    if (!email || !pass) return showAuthError("Enter email and password.");
    if (pass.length < 6) return showAuthError("Password must be at least 6 characters.");

    btnSignup.textContent = "Creating...";
    btnSignup.disabled = true;
    try {
      await db.signUp(email, pass);
    } catch (err) {
      showAuthError(err.message.replace("Firebase: ", ""));
    } finally {
      btnSignup.textContent = "Create account";
      btnSignup.disabled = false;
    }
  });

  btnForgot.addEventListener("click", async () => {
    const email = authEmail.value.trim();
    if (!email) return showAuthError("Enter your email first.");
    try {
      await db.resetPassword(email);
      showAuthError("Reset email sent. Check your inbox.");
    } catch (err) {
      showAuthError(err.message.replace("Firebase: ", ""));
    }
  });

  btnSignout.addEventListener("click", async () => {
    await db.signOut();
  });

  // Enter key submits login
  authPassword.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnLogin.click();
  });

  // ── Greeting ──

  async function initGreeting() {
    const name = await utils.loadUserName();
    if (name) {
      namePrompt.style.display = "none";
      greeting.innerHTML = utils.getGreeting(name);
      greeting.style.display = "block";
    } else {
      namePrompt.style.display = "block";
      greeting.style.display = "none";
    }
  }

  btnSaveName.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    if (!name) return;
    await utils.saveUserName(name);
    namePrompt.style.display = "none";
    greeting.innerHTML = utils.getGreeting(name);
    greeting.style.display = "block";
  });

  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnSaveName.click();
  });

  // ── Templates (built-in + custom) ──

  const templateRow = document.getElementById("template-row");

  function applyTemplate(content, tags) {
    writeArea.value = content;
    tagInput.value = tags;
    writeArea.dispatchEvent(new Event("input"));
    writeArea.focus();
  }

  document.querySelectorAll(".template-btn[data-template]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tmpl = utils.TEMPLATES[btn.dataset.template];
      if (tmpl) applyTemplate(tmpl.content, tmpl.tag);
    });
  });

  async function renderCustomTemplates() {
    templateRow.querySelectorAll(".template-btn-custom").forEach(el => el.remove());
    const customs = await utils.getCustomTemplates();
    customs.forEach(tpl => {
      const btn = document.createElement("button");
      btn.className = "template-btn template-btn-custom";
      btn.title = tpl.label;
      btn.textContent = tpl.icon;
      btn.addEventListener("click", () => applyTemplate(tpl.content, tpl.tags || ""));
      btn.addEventListener("contextmenu", async (e) => {
        e.preventDefault();
        if (confirm(`Delete template "${tpl.label}"?`)) {
          await utils.deleteCustomTemplate(tpl.id);
          renderCustomTemplates();
        }
      });
      templateRow.appendChild(btn);
    });
  }

  // Save-as-template form
  const btnSaveTemplate = document.getElementById("btn-save-template");
  const tplForm = document.getElementById("template-save-form");
  const tplNameInput = document.getElementById("tpl-name");
  const tplIconInput = document.getElementById("tpl-icon");
  const btnConfirmTpl = document.getElementById("btn-confirm-template");

  btnSaveTemplate.addEventListener("click", () => {
    tplForm.style.display = tplForm.style.display === "none" ? "flex" : "none";
  });

  btnConfirmTpl.addEventListener("click", async () => {
    const label = tplNameInput.value.trim();
    if (!label) return;
    await utils.saveCustomTemplate({
      label,
      icon: tplIconInput.value.trim() || "📝",
      content: writeArea.value,
      tags: tagInput.value
    });
    tplForm.style.display = "none";
    tplNameInput.value = "";
    tplIconInput.value = "📝";
    renderCustomTemplates();
    utils.showToast(toast, "Template saved");
  });

  renderCustomTemplates();

  // ── Auto-save drafts ──

  function scheduleDraftSave() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      const content = writeArea.value;
      const tags = tagInput.value;
      if (content || tags) {
        utils.saveDraft(content, tags);
      }
    }, 1000);
  }

  async function restoreDraft() {
    const draft = await utils.loadDraft();
    if (draft && (draft.content || draft.tags)) {
      writeArea.value = draft.content || "";
      tagInput.value = draft.tags || "";
      writeArea.dispatchEvent(new Event("input"));
      draftIndicator.classList.add("show");
      setTimeout(() => draftIndicator.classList.remove("show"), 2000);
    }
  }

  // ── Write ──

  writeArea.addEventListener("input", () => {
    const text = writeArea.value.trim();
    btnSave.disabled = text.length === 0;
    const wc = text.split(/\s+/).filter(w => w.length > 0).length;
    wordCount.textContent = `${wc} word${wc !== 1 ? "s" : ""}`;
    scheduleDraftSave();
  });

  tagInput.addEventListener("input", scheduleDraftSave);

  btnSave.addEventListener("click", async () => {
    const content = writeArea.value.trim();
    if (!content) return;

    const tags = utils.parseTags(tagInput.value);
    btnSave.disabled = true;
    btnSave.textContent = "Saving...";

    try {
      await db.createEntry(content, tags, false, writeNotebook.value || null);
      writeArea.value = "";
      tagInput.value = "";
      wordCount.textContent = "0 words";
      btnSave.textContent = "Save";
      utils.clearDraft();
      particles.burst(btnSave, 18);
      utils.showToast(toast, "Saved");
    } catch (err) {
      console.error("Save failed:", err);
      btnSave.textContent = "Save";
      btnSave.disabled = false;
      utils.showToast(toast, "Error saving");
    }
  });

  // Ctrl+Enter to save
  writeArea.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!btnSave.disabled) btnSave.click();
    }
  });

  // ── Toolbar, slash commands, timer ──

  toolbar.init(writeArea);
  slashMenu.init(writeArea);
  focusTimer.init(
    writeArea,
    document.getElementById("timer-presets"),
    document.getElementById("timer-active"),
    document.getElementById("timer-display"),
    document.getElementById("timer-cancel"),
    toast
  );

  // Keyboard shortcuts for bold/italic
  writeArea.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "b") { e.preventDefault(); toolbar._exec(writeArea, "bold"); }
    if ((e.ctrlKey || e.metaKey) && e.key === "i") { e.preventDefault(); toolbar._exec(writeArea, "italic"); }
  });

  // ── Notebook select ──

  const writeNotebook = document.getElementById("write-notebook");

  async function loadNotebookSelect() {
    try {
      const notebooks = await db.getNotebooks();
      writeNotebook.innerHTML = '<option value="">No notebook</option>';
      notebooks.forEach(nb => {
        const opt = document.createElement("option");
        opt.value = nb.id;
        opt.textContent = nb.name;
        writeNotebook.appendChild(opt);
      });
    } catch (e) {}
  }

  // ── Theme switching ──

  document.querySelectorAll(".theme-dot").forEach(dot => {
    dot.addEventListener("click", () => {
      document.querySelectorAll(".theme-dot").forEach(d => d.classList.remove("active"));
      dot.classList.add("active");
      themes.setTheme(dot.dataset.theme);
    });
  });

  // ── Ambient sound ──

  async function initAmbient() {
    const prefs = await ambient.load();
    document.querySelectorAll(".ambient-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.sound === prefs.sound);
    });
    const vol = document.querySelector(".ambient-volume");
    if (vol) vol.value = prefs.volume * 100;
  }

  document.querySelectorAll(".ambient-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ambient-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      ambient.play(btn.dataset.sound);
    });
  });

  const ambientVolume = document.querySelector(".ambient-volume");
  if (ambientVolume) {
    ambientVolume.addEventListener("input", (e) => {
      ambient.setVolume(parseInt(e.target.value) / 100);
    });
  }

  initAmbient();

  // ── Open full tab ──

  btnOpenTab.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "openFullTab" });
    window.close();
  });
});
