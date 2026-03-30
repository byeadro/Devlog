/**
 * Devlog — Shared Utilities
 * 
 * Common functions used by both popup and full tab views.
 */

const utils = {

  // ── Tag color palette (10 warm muted colors) ──

  TAG_COLORS: [
    { bg: 'rgba(201, 169, 110, 0.15)', text: '#C9A96E' },
    { bg: 'rgba(184, 132, 132, 0.15)', text: '#B88484' },
    { bg: 'rgba(132, 170, 132, 0.15)', text: '#84AA84' },
    { bg: 'rgba(132, 154, 184, 0.15)', text: '#849AB8' },
    { bg: 'rgba(170, 140, 170, 0.15)', text: '#AA8CAA' },
    { bg: 'rgba(184, 160, 120, 0.15)', text: '#B8A078' },
    { bg: 'rgba(140, 170, 160, 0.15)', text: '#8CAAA0' },
    { bg: 'rgba(180, 150, 130, 0.15)', text: '#B49682' },
    { bg: 'rgba(160, 160, 130, 0.15)', text: '#A0A082' },
    { bg: 'rgba(170, 140, 120, 0.15)', text: '#AA8C78' },
  ],

  getTagColor(tag) {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = ((hash << 5) - hash) + tag.charCodeAt(i);
      hash |= 0;
    }
    return this.TAG_COLORS[Math.abs(hash) % this.TAG_COLORS.length];
  },

  // ── Templates ──

  TEMPLATES: {
    standup: {
      content: '## Yesterday\n- \n\n## Today\n- \n\n## Blockers\n- ',
      tag: 'standup'
    },
    idea: {
      content: '## What\n\n\n## Why it matters\n\n\n## Next step\n',
      tag: 'idea'
    },
    bug: {
      content: '## Expected\n\n\n## Actual\n\n\n## Steps to reproduce\n1. \n\n## Possible fix\n',
      tag: 'bug'
    },
    rant: {
      content: '',
      tag: 'rant'
    }
  },

  // ── Greeting ──

  getGreeting(name) {
    const hour = new Date().getHours();
    let period = 'Good evening';
    if (hour < 12) period = 'Good morning';
    else if (hour < 17) period = 'Good afternoon';
    return `${period}, <span class="greeting-name">${name}</span>`;
  },

  // ── Fuzzy search scoring ──

  fuzzyScore(query, text) {
    const q = query.toLowerCase();
    const t = text.toLowerCase();

    // Exact substring match
    if (t.includes(q)) return { score: 100, index: t.indexOf(q) };

    // All words present
    const words = q.split(/\s+/).filter(w => w.length > 0);
    const found = words.filter(w => t.includes(w));
    if (found.length === words.length) return { score: 80, index: t.indexOf(found[0]) };
    if (found.length > 0) return { score: (found.length / words.length) * 60, index: t.indexOf(found[0]) };

    // Character sequence match
    let qi = 0, lastMatch = -1, score = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) {
        score += (ti === lastMatch + 1) ? 10 : 1;
        lastMatch = ti;
        qi++;
      }
    }
    if (qi === q.length) return { score: Math.min(score, 50), index: 0 };
    return { score: 0, index: -1 };
  },

  // ── Reading time ──

  getReadingTime(wordCount) {
    return Math.max(1, Math.ceil((wordCount || 0) / 200));
  },

  // ── Chrome storage helpers ──

  async loadUserName() {
    return new Promise(resolve => {
      chrome.storage.local.get(['devlog_username'], (r) => resolve(r.devlog_username || null));
    });
  },

  async saveUserName(name) {
    return new Promise(resolve => {
      chrome.storage.local.set({ devlog_username: name }, resolve);
    });
  },

  async saveDraft(content, tags) {
    return new Promise(resolve => {
      chrome.storage.local.set({ devlog_draft: { content, tags, savedAt: Date.now() } }, resolve);
    });
  },

  async loadDraft() {
    return new Promise(resolve => {
      chrome.storage.local.get(['devlog_draft'], (r) => resolve(r.devlog_draft || null));
    });
  },

  async clearDraft() {
    return new Promise(resolve => {
      chrome.storage.local.remove('devlog_draft', resolve);
    });
  },

  async loadPendingEntries() {
    return new Promise(resolve => {
      chrome.storage.local.get(['devlog_pending'], (r) => resolve(r.devlog_pending || []));
    });
  },

  async clearPendingEntries() {
    return new Promise(resolve => {
      chrome.storage.local.remove('devlog_pending', resolve);
    });
  },

  // ── Custom templates ──

  async getCustomTemplates() {
    return new Promise(resolve => {
      chrome.storage.local.get(["devlog_custom_templates"], r => resolve(r.devlog_custom_templates || []));
    });
  },

  async saveCustomTemplate(tpl) {
    const templates = await this.getCustomTemplates();
    templates.push({ ...tpl, id: "tpl_" + Date.now() });
    return new Promise(resolve => {
      chrome.storage.local.set({ devlog_custom_templates: templates }, resolve);
    });
  },

  async deleteCustomTemplate(id) {
    const templates = await this.getCustomTemplates();
    const filtered = templates.filter(t => t.id !== id);
    return new Promise(resolve => {
      chrome.storage.local.set({ devlog_custom_templates: filtered }, resolve);
    });
  },

  formatDate(date) {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  },

  formatTimestamp(timestamp) {
    if (!timestamp) return "";
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    });
  },

  formatRelative(timestamp) {
    if (!timestamp) return "";
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  },

  parseTags(input) {
    return input
      .split(",")
      .map(t => t.trim().toLowerCase().replace(/^#/, ""))
      .filter(t => t.length > 0);
  },

  showToast(el, msg, duration = 1800) {
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), duration);
  },

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  createEntryCard(entry, { onEdit, onPin, onTagClick, compact = false, searchTerm, relevanceScore, draggable: isDraggable }) {
    const card = document.createElement("div");
    card.className = `entry-card${entry.pinned ? " pinned" : ""}`;
    card.dataset.id = entry.id;

    // Drag handle for pinned reorder
    if (isDraggable) {
      card.setAttribute("draggable", "true");
      const handle = document.createElement("span");
      handle.className = "drag-handle";
      handle.innerHTML = '<svg width="10" height="12" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/><circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/></svg>';
      card.appendChild(handle);
    }

    // Meta row
    const meta = document.createElement("div");
    meta.className = "entry-meta";

    const dateSpan = document.createElement("span");
    dateSpan.className = "entry-date";
    dateSpan.textContent = utils.formatTimestamp(entry.createdAt);
    meta.appendChild(dateSpan);

    if (typeof relevanceScore === "number") {
      const rel = document.createElement("span");
      rel.className = "entry-relevance";
      rel.textContent = `${Math.round(relevanceScore)}% match`;
      meta.appendChild(rel);
    }

    const metaRight = document.createElement("div");
    metaRight.className = "entry-meta-right";

    // Word count + reading time
    if (entry.wordCount) {
      const wc = document.createElement("span");
      wc.className = "entry-wc";
      const readTime = utils.getReadingTime(entry.wordCount);
      wc.textContent = `${entry.wordCount}w \u00b7 ${readTime} min read`;
      metaRight.appendChild(wc);
    }

    // Pin button
    const pinBtn = document.createElement("button");
    pinBtn.className = `btn-pin${entry.pinned ? " active" : ""}`;
    pinBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M9.828 1.172a2 2 0 012.828 0l2.172 2.172a2 2 0 010 2.828L12 9l-1 5-4-4-5.5 5.5L3 14l4-4-4-4 5-1 2.828-2.828z" fill="currentColor"/></svg>`;
    pinBtn.title = entry.pinned ? "Unpin" : "Pin";
    pinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (onPin) onPin(entry.id, !entry.pinned);
    });
    metaRight.appendChild(pinBtn);

    meta.appendChild(metaRight);
    card.appendChild(meta);

    // Content (collapsible if > 40 words)
    const content = document.createElement("div");
    content.className = "entry-content";
    const isLong = (entry.wordCount || 0) > 40;
    if (isLong) content.classList.add("entry-collapsed");

    if (compact) {
      content.textContent = entry.content;
    } else {
      content.innerHTML = md.render(entry.content);
    }

    // Highlight search terms
    if (searchTerm && !compact) {
      const words = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      let html = content.innerHTML;
      words.forEach(w => {
        const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        html = html.replace(new RegExp(`(${esc})`, "gi"), '<mark class="search-highlight">$1</mark>');
      });
      content.innerHTML = html;
    }

    card.appendChild(content);

    // Show more / less toggle
    if (isLong) {
      const toggleBtn = document.createElement("button");
      toggleBtn.className = "btn-show-more";
      toggleBtn.textContent = "Show more";
      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const collapsed = content.classList.toggle("entry-collapsed");
        toggleBtn.textContent = collapsed ? "Show more" : "Show less";
      });
      card.appendChild(toggleBtn);
    }

    // Tags (color-coded + clickable)
    if (entry.tags && entry.tags.length > 0) {
      const tagsDiv = document.createElement("div");
      tagsDiv.className = "entry-tags";
      entry.tags.forEach(t => {
        const tag = document.createElement("span");
        tag.className = "entry-tag";
        tag.textContent = `#${t}`;
        const color = utils.getTagColor(t);
        tag.style.background = color.bg;
        tag.style.color = color.text;
        if (onTagClick) {
          tag.classList.add("entry-tag-clickable");
          tag.addEventListener("click", (e) => {
            e.stopPropagation();
            onTagClick(t);
          });
        }
        tagsDiv.appendChild(tag);
      });
      card.appendChild(tagsDiv);
    }

    // Click to edit
    card.addEventListener("click", () => {
      if (onEdit) onEdit(entry);
    });

    return card;
  }
};
