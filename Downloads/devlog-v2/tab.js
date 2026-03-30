/**
 * Devlog — Full Tab Controller
 * 
 * All views: write, feed, pinned, search, stats, export.
 * Full CRUD with edit modal.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Load theme/font before anything renders
  themes.loadTheme().then(name => {
    document.querySelectorAll(".theme-dot").forEach(d => d.classList.toggle("active", d.dataset.theme === name));
  });
  themes.loadWritingFont().then(name => {
    document.querySelectorAll(".font-btn").forEach(b => b.classList.toggle("active", b.dataset.font === name));
  });

  // ── Elements ──
  const authScreen   = document.getElementById("auth-screen");
  const appScreen    = document.getElementById("app-screen");
  const authEmail    = document.getElementById("auth-email");
  const authPassword = document.getElementById("auth-password");
  const btnLogin     = document.getElementById("btn-login");
  const btnSignup    = document.getElementById("btn-signup");
  const btnForgot    = document.getElementById("btn-forgot");
  const authError    = document.getElementById("auth-error");
  const btnSignout   = document.getElementById("btn-signout");

  const writeDate    = document.getElementById("write-date");
  const writeArea    = document.getElementById("write-area");
  const tagInput     = document.getElementById("tag-input");
  const btnSave      = document.getElementById("btn-save");
  const wordCount    = document.getElementById("word-count");
  const toast        = document.getElementById("toast");

  const feedList     = document.getElementById("feed-list");
  const feedEmpty    = document.getElementById("feed-empty");
  const feedTitle    = document.getElementById("feed-title");
  const btnLoadMore  = document.getElementById("btn-load-more");
  const btnToggleFilters = document.getElementById("btn-toggle-filters");
  const filterPanel  = document.getElementById("filter-panel");
  const filterCount  = document.getElementById("filter-count");
  const writeNotebook = document.getElementById("write-notebook");
  const editNotebook = document.getElementById("edit-notebook");

  const pinnedList   = document.getElementById("pinned-list");
  const pinnedEmpty  = document.getElementById("pinned-empty");

  const searchInput  = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");
  const searchEmpty  = document.getElementById("search-empty");

  const statsGrid    = document.getElementById("stats-grid");

  const btnExportJSON = document.getElementById("btn-export-json");
  const btnExportMD   = document.getElementById("btn-export-md");

  const editModal      = document.getElementById("edit-modal");
  const editArea       = document.getElementById("edit-area");
  const editTagInput   = document.getElementById("edit-tag-input");
  const editPinned     = document.getElementById("edit-pinned");
  const btnUpdate      = document.getElementById("btn-update");
  const btnDelete      = document.getElementById("btn-delete");
  const btnModalClose  = document.getElementById("btn-modal-close");
  const namePrompt     = document.getElementById("name-prompt");
  const nameInput      = document.getElementById("name-input");
  const btnSaveName    = document.getElementById("btn-save-name");
  const greetingEl       = document.getElementById("greeting");
  const draftIndicator   = document.getElementById("draft-indicator");
  const timelineContainer = document.getElementById("timeline-container");
  const splitContainer   = document.getElementById("split-container");
  const previewPane      = document.getElementById("preview-pane");
  const btnSplitToggle   = document.getElementById("btn-split-toggle");
  const btnHistory       = document.getElementById("btn-history");
  const versionPanel     = document.getElementById("version-panel");
  const versionList      = document.getElementById("version-list");
  const btnCloseVersions = document.getElementById("btn-close-versions");
  const templateRow      = document.getElementById("template-row");

  let lastDoc = null;
  let currentEditId = null;
  let searchTimeout = null;
  let draftTimer = null;
  let splitActive = false;
  let previewTimer = null;

  // ── Navigation ──

  const navBtns = document.querySelectorAll(".nav-btn[data-view]");
  const views = {};
  navBtns.forEach(btn => {
    const viewName = btn.dataset.view;
    views[viewName] = document.getElementById(`view-${viewName}`);
  });

  let isTransitioning = false;

  function triggerViewLoad(name) {
    if (name === "feed") loadFeed(true);
    if (name === "timeline") loadTimeline();
    if (name === "pinned") loadPinned();
    if (name === "search") searchInput.focus();
    if (name === "write") writeArea.focus();
    if (name === "stats") loadStats();
  }

  function switchView(name) {
    if (isTransitioning) return;
    navBtns.forEach(b => b.classList.toggle("active", b.dataset.view === name));

    const currentKey = Object.keys(views).find(k => views[k] && views[k].classList.contains("active"));

    if (currentKey && currentKey !== name) {
      isTransitioning = true;
      const oldView = views[currentKey];
      oldView.classList.add("view-exit");

      setTimeout(() => {
        oldView.classList.remove("active", "view-exit");
        const newView = views[name];
        if (newView) {
          newView.classList.add("active", "view-enter");
          requestAnimationFrame(() => requestAnimationFrame(() => newView.classList.remove("view-enter")));
        }
        triggerViewLoad(name);
        isTransitioning = false;
      }, 150);
    } else {
      Object.keys(views).forEach(k => { if (views[k]) views[k].classList.toggle("active", k === name); });
      triggerViewLoad(name);
    }
  }

  navBtns.forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  // ── Auth ──

  db.onAuthChange(async (user) => {
    if (user) {
      authScreen.classList.remove("active");
      appScreen.classList.add("active");
      writeDate.textContent = utils.formatDate(new Date());
      loadNotebooks();
      loadFilterTags();
      await initGreeting();
      await restoreDraft();
      await syncPendingEntries();
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
      loadFilterTags();
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

  authPassword.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnLogin.click();
  });

  // ── Greeting ──

  async function initGreeting() {
    const name = await utils.loadUserName();
    if (name) {
      namePrompt.style.display = "none";
      greetingEl.innerHTML = utils.getGreeting(name);
      greetingEl.style.display = "block";
    } else {
      namePrompt.style.display = "block";
      greetingEl.style.display = "none";
    }
  }

  btnSaveName.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    if (!name) return;
    await utils.saveUserName(name);
    namePrompt.style.display = "none";
    greetingEl.innerHTML = utils.getGreeting(name);
    greetingEl.style.display = "block";
  });

  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnSaveName.click();
  });

  // ── Templates (built-in + custom) ──

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

  // ── Tag click (filter feed by tag) ──

  let activeNotebookFilter = null;
  let activeSmartFilters = null;

  function handleTagClick(tag) {
    activeSmartFilters = { tags: [tag] };
    switchView("feed");
    loadFilteredFeed();
  }

  // ── Toolbar, slash commands, timer ──

  toolbar.init(writeArea);
  slashMenu.init(writeArea);
  slashMenu.init(editArea);
  toolbar.init(editArea);
  focusTimer.init(
    writeArea,
    document.getElementById("timer-presets"),
    document.getElementById("timer-active"),
    document.getElementById("timer-display"),
    document.getElementById("timer-cancel"),
    toast
  );

  // ── Write ──

  writeArea.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "b") { e.preventDefault(); toolbar._exec(writeArea, "bold"); }
    if ((e.ctrlKey || e.metaKey) && e.key === "i") { e.preventDefault(); toolbar._exec(writeArea, "italic"); }
  });

  writeArea.addEventListener("input", () => {
    const text = writeArea.value.trim();
    btnSave.disabled = text.length === 0;
    const wc = text.split(/\s+/).filter(w => w.length > 0).length;
    wordCount.textContent = `${wc} word${wc !== 1 ? "s" : ""}`;
    scheduleDraftSave();
    if (splitActive) updatePreview();
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
      btnSave.textContent = "Save entry";
      utils.clearDraft();
      particles.burst(btnSave, 18);
      utils.showToast(toast, "Saved");
      loadFilterTags();
      loadNotebooks();
    } catch (err) {
      console.error("Save failed:", err);
      btnSave.textContent = "Save entry";
      btnSave.disabled = false;
      utils.showToast(toast, "Error saving");
    }
  });

  writeArea.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!btnSave.disabled) btnSave.click();
    }
    // Tab inserts spaces in write area
    if (e.key === "Tab") {
      e.preventDefault();
      const start = writeArea.selectionStart;
      writeArea.value = writeArea.value.substring(0, start) + "  " + writeArea.value.substring(writeArea.selectionEnd);
      writeArea.selectionStart = writeArea.selectionEnd = start + 2;
    }
  });

  // ── Feed ──

  async function loadFeed(reset = false) {
    if (reset) { feedList.innerHTML = ""; lastDoc = null; }
    if (activeSmartFilters) { loadFilteredFeed(); return; }

    feedList.innerHTML += '<div class="loading">Loading...</div>';
    feedTitle.textContent = activeNotebookFilter ? activeNotebookFilter.name : "All entries";

    try {
      const { entries, lastDoc: newLast } = await db.getEntries(30, reset ? null : lastDoc, null, activeNotebookFilter ? activeNotebookFilter.id : null);
      const loader = feedList.querySelector(".loading");
      if (loader) loader.remove();

      if (entries.length === 0 && reset) {
        feedEmpty.style.display = "block";
        btnLoadMore.style.display = "none";
        return;
      }

      feedEmpty.style.display = "none";
      entries.forEach((entry, i) => {
        const card = utils.createEntryCard(entry, { onEdit: openEditModal, onPin: handlePin, onTagClick: handleTagClick });
        card.style.animationDelay = `${i * 0.03}s`;
        feedList.appendChild(card);
      });

      lastDoc = newLast;
      btnLoadMore.style.display = newLast ? "block" : "none";
    } catch (err) {
      console.error("Feed load failed:", err);
      const loader = feedList.querySelector(".loading");
      if (loader) loader.remove();
    }
  }

  btnLoadMore.addEventListener("click", () => loadFeed(false));

  // ── Smart Filters ──

  btnToggleFilters.addEventListener("click", () => {
    filterPanel.style.display = filterPanel.style.display === "none" ? "flex" : "none";
  });

  async function loadFilterTags() {
    try {
      const tags = await db.getAllTags();
      const wrap = document.getElementById("filter-tags");
      wrap.innerHTML = "";
      tags.forEach(t => {
        const chip = document.createElement("button");
        chip.className = "filter-tag-chip";
        chip.textContent = `#${t}`;
        chip.dataset.tag = t;
        chip.addEventListener("click", () => chip.classList.toggle("active"));
        wrap.appendChild(chip);
      });
    } catch (err) {}
  }

  document.getElementById("btn-apply-filters").addEventListener("click", () => {
    const selectedTags = [...document.querySelectorAll(".filter-tag-chip.active")].map(c => c.dataset.tag);
    const dateFrom = document.getElementById("filter-date-from").value;
    const dateTo = document.getElementById("filter-date-to").value;
    const length = document.getElementById("filter-length").value;
    const hasCode = document.getElementById("filter-has-code").checked;
    const hasLink = document.getElementById("filter-has-link").checked;
    const hasChecklist = document.getElementById("filter-has-checklist").checked;

    const f = {};
    if (selectedTags.length) f.tags = selectedTags;
    if (dateFrom) f.dateFrom = new Date(dateFrom);
    if (dateTo) { f.dateTo = new Date(dateTo); f.dateTo.setHours(23, 59, 59); }
    if (length) f.length = length;
    if (hasCode) f.hasCode = true;
    if (hasLink) f.hasLink = true;
    if (hasChecklist) f.hasChecklist = true;

    const count = Object.keys(f).length;
    if (count > 0) {
      activeSmartFilters = f;
      filterCount.textContent = count;
      filterCount.style.display = "flex";
    } else {
      activeSmartFilters = null;
      filterCount.style.display = "none";
    }
    filterPanel.style.display = "none";
    loadFilteredFeed();
  });

  document.getElementById("btn-clear-filters").addEventListener("click", () => {
    activeSmartFilters = null;
    filterCount.style.display = "none";
    document.querySelectorAll(".filter-tag-chip.active").forEach(c => c.classList.remove("active"));
    document.getElementById("filter-date-from").value = "";
    document.getElementById("filter-date-to").value = "";
    document.getElementById("filter-length").value = "";
    document.getElementById("filter-has-code").checked = false;
    document.getElementById("filter-has-link").checked = false;
    document.getElementById("filter-has-checklist").checked = false;
    filterPanel.style.display = "none";
    feedTitle.textContent = "All entries";
    loadFeed(true);
  });

  async function loadFilteredFeed() {
    feedList.innerHTML = '<div class="loading">Loading...</div>';
    feedEmpty.style.display = "none";
    btnLoadMore.style.display = "none";
    feedTitle.textContent = "Filtered entries";

    try {
      let entries = await db.getEntriesForFiltering(500);
      const f = activeSmartFilters || {};

      if (f.tags && f.tags.length) entries = entries.filter(e => f.tags.every(t => (e.tags || []).includes(t)));
      if (f.dateFrom) entries = entries.filter(e => e.createdAt && e.createdAt.toDate() >= f.dateFrom);
      if (f.dateTo) entries = entries.filter(e => e.createdAt && e.createdAt.toDate() <= f.dateTo);
      if (f.length === "short") entries = entries.filter(e => (e.wordCount || 0) < 100);
      else if (f.length === "medium") entries = entries.filter(e => (e.wordCount || 0) >= 100 && (e.wordCount || 0) <= 500);
      else if (f.length === "long") entries = entries.filter(e => (e.wordCount || 0) > 500);
      if (f.hasCode) entries = entries.filter(e => (e.content || "").includes("```"));
      if (f.hasLink) entries = entries.filter(e => /https?:|]\(/.test(e.content || ""));
      if (f.hasChecklist) entries = entries.filter(e => (e.content || "").includes("[ ]"));
      if (activeNotebookFilter) entries = entries.filter(e => e.notebookId === activeNotebookFilter.id);

      feedList.innerHTML = "";
      if (entries.length === 0) { feedEmpty.style.display = "block"; return; }

      entries.forEach((entry, i) => {
        const card = utils.createEntryCard(entry, { onEdit: openEditModal, onPin: handlePin, onTagClick: handleTagClick });
        card.style.animationDelay = `${i * 0.03}s`;
        feedList.appendChild(card);
      });
    } catch (err) {
      console.error("Filtered feed failed:", err);
      feedList.innerHTML = "";
    }
  }

  // ── Pinned (with drag-and-drop reorder) ──

  let pinnedEntries = [];

  async function loadPinned() {
    pinnedList.innerHTML = '<div class="loading">Loading...</div>';
    try {
      pinnedEntries = await db.getPinnedEntries();
      pinnedList.innerHTML = "";

      if (pinnedEntries.length === 0) {
        pinnedEmpty.style.display = "block";
        return;
      }

      pinnedEmpty.style.display = "none";
      pinnedEntries.forEach((entry, i) => {
        const card = utils.createEntryCard(entry, {
          onEdit: openEditModal,
          onPin: handlePin,
          onTagClick: handleTagClick,
          draggable: true
        });
        card.style.animationDelay = `${i * 0.03}s`;
        pinnedList.appendChild(card);
      });
    } catch (err) {
      console.error("Pinned load failed:", err);
      pinnedList.innerHTML = "";
    }
  }

  // Drag-and-drop handlers for pinned list
  let draggedId = null;

  pinnedList.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".entry-card");
    if (!card) return;
    draggedId = card.dataset.id;
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });

  pinnedList.addEventListener("dragend", (e) => {
    const card = e.target.closest(".entry-card");
    if (card) card.classList.remove("dragging");
    pinnedList.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
    draggedId = null;
  });

  pinnedList.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    pinnedList.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
    const target = e.target.closest(".entry-card");
    if (target && target.dataset.id !== draggedId) {
      target.classList.add("drag-over");
    }
  });

  pinnedList.addEventListener("drop", async (e) => {
    e.preventDefault();
    pinnedList.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
    if (!draggedId) return;

    const target = e.target.closest(".entry-card");
    if (!target || target.dataset.id === draggedId) return;

    const fromIdx = pinnedEntries.findIndex(en => en.id === draggedId);
    const toIdx = pinnedEntries.findIndex(en => en.id === target.dataset.id);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = pinnedEntries.splice(fromIdx, 1);
    pinnedEntries.splice(toIdx, 0, moved);

    // Update pinOrder for all
    const updates = pinnedEntries.map((en, i) => ({ entryId: en.id, pinOrder: i }));
    try {
      await db.updatePinOrder(updates);
      loadPinned();
    } catch (err) {
      console.error("Reorder failed:", err);
    }
  });

  // ── Pin handler ──

  async function handlePin(entryId, pinned) {
    try {
      await db.togglePin(entryId, pinned);
      // Refresh current view
      const activeView = document.querySelector(".view.active");
      if (activeView.id === "view-feed") loadFeed(true);
      if (activeView.id === "view-pinned") loadPinned();
    } catch (err) {
      console.error("Pin toggle failed:", err);
    }
  }

  // ── Search ──

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    const term = searchInput.value.trim();

    if (!term) {
      searchResults.innerHTML = "";
      searchEmpty.style.display = "none";
      return;
    }

    searchTimeout = setTimeout(async () => {
      searchResults.innerHTML = '<div class="loading">Searching...</div>';
      searchEmpty.style.display = "none";

      try {
        const results = await db.fuzzySearchEntries(term);
        searchResults.innerHTML = "";

        if (results.length === 0) {
          searchEmpty.style.display = "block";
          return;
        }

        results.forEach((entry, i) => {
          const card = utils.createEntryCard(entry, {
            onEdit: openEditModal,
            onPin: handlePin,
            onTagClick: handleTagClick,
            searchTerm: term,
            relevanceScore: entry._relevance
          });
          card.style.animationDelay = `${i * 0.03}s`;
          searchResults.appendChild(card);
        });
      } catch (err) {
        console.error("Search failed:", err);
        searchResults.innerHTML = "";
      }
    }, 300);
  });

  // ── Stats ──

  async function loadStats() {
    statsGrid.innerHTML = '<div class="loading" style="grid-column:1/-1;">Loading...</div>';
    try {
      const stats = await db.getStats();
      statsGrid.innerHTML = `
        <div class="stat-card">
          <div class="stat-value">${stats.totalEntries}</div>
          <div class="stat-label">Total entries</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.totalWords.toLocaleString()}</div>
          <div class="stat-label">Total words</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.avgWordsPerEntry}</div>
          <div class="stat-label">Avg words / entry</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.topTags.length}</div>
          <div class="stat-label">Unique tags</div>
        </div>
        ${stats.topTags.length > 0 ? `
          <div class="stat-card stat-tags">
            <div class="stat-label">Top tags</div>
            <div class="stat-tag-list">
              ${stats.topTags.map(([tag, count]) => `
                <span class="stat-tag-item">#${tag}<span class="stat-tag-count">${count}</span></span>
              `).join("")}
            </div>
          </div>
        ` : ""}
      `;
    } catch (err) {
      console.error("Stats load failed:", err);
      statsGrid.innerHTML = '<div class="feed-empty">Could not load stats.</div>';
    }

    // Load heatmap
    try {
      const entriesByDay = await db.getEntriesByDay();
      renderHeatmap(entriesByDay);
    } catch (err) {
      console.error("Heatmap load failed:", err);
    }
  }

  function renderHeatmap(entriesByDay) {
    const container = document.getElementById("heatmap-container");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start 52 weeks ago, aligned to Sunday
    const start = new Date(today);
    start.setDate(start.getDate() - 52 * 7);
    start.setDate(start.getDate() - start.getDay());

    const daysBetween = Math.floor((today - start) / 86400000);
    const numWeeks = Math.ceil((daysBetween + 1) / 7);

    // Month labels
    let monthsHtml = "";
    let lastMonth = -1;
    for (let w = 0; w < numWeeks; w++) {
      const weekDate = new Date(start);
      weekDate.setDate(weekDate.getDate() + w * 7);
      const m = weekDate.getMonth();
      if (m !== lastMonth) {
        monthsHtml += `<span class="heatmap-month">${weekDate.toLocaleDateString("en-US", { month: "short" })}</span>`;
        lastMonth = m;
      } else {
        monthsHtml += '<span class="heatmap-month"></span>';
      }
    }

    // Grid cells (column-first: each column = 1 week, 7 rows = Sun–Sat)
    let cellsHtml = "";
    for (let w = 0; w < numWeeks; w++) {
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(start);
        cellDate.setDate(cellDate.getDate() + w * 7 + d);

        if (cellDate > today) {
          cellsHtml += '<div class="heatmap-cell heatmap-cell-future"></div>';
          continue;
        }

        const key = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, "0")}-${String(cellDate.getDate()).padStart(2, "0")}`;
        const count = entriesByDay.get(key) || 0;

        let level = 0;
        if (count >= 4) level = 4;
        else if (count === 3) level = 3;
        else if (count === 2) level = 2;
        else if (count === 1) level = 1;

        const label = cellDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const noun = count === 1 ? "entry" : "entries";

        cellsHtml += `<div class="heatmap-cell" data-level="${level}" title="${label}: ${count} ${noun}"></div>`;
      }
    }

    container.innerHTML = `
      <div class="heatmap-title">Writing activity</div>
      <div class="heatmap-scroll">
        <div class="heatmap-months">${monthsHtml}</div>
        <div class="heatmap-body">
          <div class="heatmap-days">
            <span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span>
          </div>
          <div class="heatmap-grid">${cellsHtml}</div>
        </div>
      </div>
    `;
  }

  // ── Export ──

  btnExportJSON.addEventListener("click", async () => {
    btnExportJSON.textContent = "Exporting...";
    btnExportJSON.disabled = true;
    try {
      const json = await db.exportJSON();
      const date = new Date().toISOString().split("T")[0];
      utils.downloadFile(json, `devlog-export-${date}.json`, "application/json");
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      btnExportJSON.textContent = "Export as JSON";
      btnExportJSON.disabled = false;
    }
  });

  btnExportMD.addEventListener("click", async () => {
    btnExportMD.textContent = "Exporting...";
    btnExportMD.disabled = true;
    try {
      const markdown = await db.exportMarkdown();
      const date = new Date().toISOString().split("T")[0];
      utils.downloadFile(markdown, `devlog-export-${date}.md`, "text/markdown");
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      btnExportMD.textContent = "Export as Markdown";
      btnExportMD.disabled = false;
    }
  });

  // ── Edit Modal ──

  function openEditModal(entry) {
    currentEditId = entry.id;
    editArea.value = entry.content;
    editTagInput.value = (entry.tags || []).join(", ");
    editPinned.checked = entry.pinned || false;
    if (editNotebook) editNotebook.value = entry.notebookId || "";
    versionPanel.style.display = "none";
    editModal.classList.add("active");
    editArea.focus();
  }

  function closeEditModal() {
    editModal.classList.remove("active");
    versionPanel.style.display = "none";
    currentEditId = null;
  }

  btnModalClose.addEventListener("click", closeEditModal);

  btnUpdate.addEventListener("click", async () => {
    if (!currentEditId) return;
    const content = editArea.value.trim();
    if (!content) return;

    const tags = utils.parseTags(editTagInput.value);
    const pinned = editPinned.checked;
    btnUpdate.textContent = "Updating...";
    btnUpdate.disabled = true;

    try {
      await db.updateEntry(currentEditId, content, tags, pinned);
      if (editNotebook) await db.moveEntryToNotebook(currentEditId, editNotebook.value || null);
      particles.burst(btnUpdate, 14);
      closeEditModal();
      const activeView = document.querySelector(".view.active");
      if (activeView.id === "view-feed") loadFeed(true);
      if (activeView.id === "view-pinned") loadPinned();
      if (activeView.id === "view-timeline") loadTimeline();
      loadFilterTags();
      loadNotebooks();
      utils.showToast(toast, "Updated");
    } catch (err) {
      console.error("Update failed:", err);
    } finally {
      btnUpdate.textContent = "Update";
      btnUpdate.disabled = false;
    }
  });

  btnDelete.addEventListener("click", async () => {
    if (!currentEditId) return;
    if (!confirm("Delete this entry?")) return;

    try {
      await db.deleteEntry(currentEditId);
      closeEditModal();
      const activeView = document.querySelector(".view.active");
      if (activeView.id === "view-feed") loadFeed(true);
      if (activeView.id === "view-pinned") loadPinned();
      if (activeView.id === "view-timeline") loadTimeline();
      loadFilterTags();
      loadNotebooks();
      utils.showToast(toast, "Deleted");
    } catch (err) {
      console.error("Delete failed:", err);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && editModal.classList.contains("active")) {
      closeEditModal();
    }
  });

  // ── Version history ──

  btnHistory.addEventListener("click", async () => {
    if (!currentEditId) return;
    versionPanel.style.display = "flex";
    versionList.innerHTML = '<div class="loading">Loading...</div>';

    try {
      const versions = await db.getVersions(currentEditId);
      versionList.innerHTML = "";

      if (versions.length === 0) {
        versionList.innerHTML = '<div class="version-empty">No edit history yet.</div>';
        return;
      }

      versions.forEach(v => {
        const item = document.createElement("div");
        item.className = "version-item";

        const meta = document.createElement("div");
        meta.className = "version-meta";
        const date = v.savedAt ? utils.formatTimestamp(v.savedAt) : "Unknown";
        meta.innerHTML = `<strong>${date}</strong><br>${v.wordCount || 0} words`;

        const actions = document.createElement("div");
        actions.className = "version-actions";

        const previewBtn = document.createElement("button");
        previewBtn.textContent = "Preview";
        previewBtn.addEventListener("click", () => {
          editArea.value = v.content;
          versionPanel.style.display = "none";
        });

        const restoreBtn = document.createElement("button");
        restoreBtn.className = "btn-restore";
        restoreBtn.textContent = "Restore";
        restoreBtn.addEventListener("click", async () => {
          try {
            await db.restoreVersion(currentEditId, v);
            closeEditModal();
            const activeView = document.querySelector(".view.active");
            if (activeView.id === "view-feed") loadFeed(true);
            if (activeView.id === "view-pinned") loadPinned();
            if (activeView.id === "view-timeline") loadTimeline();
            utils.showToast(toast, "Version restored");
          } catch (err) {
            console.error("Restore failed:", err);
          }
        });

        actions.appendChild(previewBtn);
        actions.appendChild(restoreBtn);
        item.appendChild(meta);
        item.appendChild(actions);
        versionList.appendChild(item);
      });
    } catch (err) {
      console.error("Versions load failed:", err);
      versionList.innerHTML = '<div class="version-empty">Could not load history.</div>';
    }
  });

  btnCloseVersions.addEventListener("click", () => {
    versionPanel.style.display = "none";
  });

  // ── Timeline ──

  async function loadTimeline() {
    timelineContainer.innerHTML = '<div class="loading">Loading...</div>';
    try {
      const groups = await db.getEntriesGroupedByDay();
      timelineContainer.innerHTML = "";

      if (groups.length === 0) {
        timelineContainer.innerHTML = '<div class="feed-empty">No entries yet.</div>';
        return;
      }

      groups.forEach((group, gi) => {
        const dayEl = document.createElement("div");
        dayEl.className = "timeline-day";
        dayEl.style.animationDelay = `${gi * 0.05}s`;

        const dot = document.createElement("div");
        dot.className = "timeline-dot";
        dayEl.appendChild(dot);

        const dateEl = document.createElement("div");
        dateEl.className = "timeline-date";
        dateEl.textContent = group.date;
        dayEl.appendChild(dateEl);

        const entriesEl = document.createElement("div");
        entriesEl.className = "timeline-entries";

        group.entries.forEach((entry, i) => {
          const card = utils.createEntryCard(entry, {
            onEdit: openEditModal,
            onPin: handlePin,
            onTagClick: handleTagClick
          });
          card.style.animationDelay = `${(gi * 0.05) + (i * 0.03)}s`;
          entriesEl.appendChild(card);
        });

        dayEl.appendChild(entriesEl);
        timelineContainer.appendChild(dayEl);
      });
    } catch (err) {
      console.error("Timeline load failed:", err);
      timelineContainer.innerHTML = '<div class="feed-empty">Could not load timeline.</div>';
    }
  }

  // ── Split view (live preview) ──

  function updatePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      previewPane.innerHTML = md.render(writeArea.value);
    }, 150);
  }

  btnSplitToggle.addEventListener("click", () => {
    splitActive = !splitActive;
    splitContainer.classList.toggle("split-active", splitActive);
    previewPane.style.display = splitActive ? "block" : "none";
    btnSplitToggle.classList.toggle("active", splitActive);
    if (splitActive) {
      previewPane.innerHTML = md.render(writeArea.value);
    }
  });

  // ── Theme switching ──

  document.querySelectorAll(".theme-dot").forEach(dot => {
    dot.addEventListener("click", () => {
      document.querySelectorAll(".theme-dot").forEach(d => d.classList.remove("active"));
      dot.classList.add("active");
      themes.setTheme(dot.dataset.theme);
    });
  });

  // ── Font switching ──

  document.querySelectorAll(".font-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".font-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      themes.setWritingFont(btn.dataset.font);
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

  // ── Notebooks ──

  const NOTEBOOK_COLORS = ["#C9A96E", "#58A6FF", "#7CB87C", "#C9826E", "#A06EC9", "#6EC9B4"];
  const notebookList = document.getElementById("notebook-list");
  const btnAddNotebook = document.getElementById("btn-add-notebook");

  async function loadNotebooks() {
    try {
      const notebooks = await db.getNotebooks();
      notebookList.innerHTML = "";

      // "All entries" button
      const allBtn = document.createElement("button");
      allBtn.className = `notebook-btn${!activeNotebookFilter ? " active" : ""}`;
      allBtn.innerHTML = '<span class="notebook-dot" style="background:var(--text-tertiary);"></span><span>All entries</span>';
      allBtn.addEventListener("click", () => {
        activeNotebookFilter = null;
        activeSmartFilters = null;
        filterCount.style.display = "none";
        switchView("feed");
      });
      notebookList.appendChild(allBtn);

      notebooks.forEach(nb => {
        const btn = document.createElement("button");
        btn.className = `notebook-btn${activeNotebookFilter && activeNotebookFilter.id === nb.id ? " active" : ""}`;
        btn.innerHTML = `<span class="notebook-dot" style="background:${nb.color};"></span><span class="notebook-name">${nb.name}</span>`;
        btn.addEventListener("click", () => {
          activeNotebookFilter = nb;
          activeSmartFilters = null;
          filterCount.style.display = "none";
          switchView("feed");
        });
        btn.addEventListener("contextmenu", async (e) => {
          e.preventDefault();
          if (confirm(`Delete notebook "${nb.name}"? Entries will be kept.`)) {
            await db.deleteNotebook(nb.id);
            if (activeNotebookFilter && activeNotebookFilter.id === nb.id) activeNotebookFilter = null;
            loadNotebooks();
          }
        });
        notebookList.appendChild(btn);
      });

      // Populate notebook selects
      [writeNotebook, editNotebook].forEach(sel => {
        if (!sel) return;
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">No notebook</option>';
        notebooks.forEach(nb => {
          const opt = document.createElement("option");
          opt.value = nb.id;
          opt.textContent = nb.name;
          sel.appendChild(opt);
        });
        sel.value = currentVal;
      });
    } catch (err) {
      console.error("Notebooks load failed:", err);
    }
  }

  btnAddNotebook.addEventListener("click", () => {
    let existingForm = notebookList.querySelector(".notebook-form");
    if (existingForm) { existingForm.remove(); return; }

    const form = document.createElement("div");
    form.className = "notebook-form";
    let selectedColor = NOTEBOOK_COLORS[0];

    form.innerHTML = `
      <input type="text" placeholder="Notebook name" class="nb-name-input">
      <div class="notebook-colors">${NOTEBOOK_COLORS.map((c, i) =>
        `<button class="notebook-color-dot${i === 0 ? " active" : ""}" data-color="${c}" style="background:${c};"></button>`
      ).join("")}</div>
      <button class="btn-save" style="height:28px;font-size:11px;">Create</button>
    `;

    form.querySelectorAll(".notebook-color-dot").forEach(dot => {
      dot.addEventListener("click", () => {
        form.querySelectorAll(".notebook-color-dot").forEach(d => d.classList.remove("active"));
        dot.classList.add("active");
        selectedColor = dot.dataset.color;
      });
    });

    form.querySelector(".btn-save").addEventListener("click", async () => {
      const name = form.querySelector(".nb-name-input").value.trim();
      if (!name) return;
      await db.createNotebook(name, selectedColor);
      loadNotebooks();
    });

    notebookList.appendChild(form);
    form.querySelector(".nb-name-input").focus();
  });

  // ── Init ──
  writeDate.textContent = utils.formatDate(new Date());
});
