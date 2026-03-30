/**
 * Devlog — Rich Text Formatting Toolbar
 */

const toolbar = {
  init(textareaEl) {
    const container = textareaEl.closest(".view, #app-screen, .modal-content");
    const bar = container ? container.querySelector(".format-toolbar") : null;
    if (!bar) return;
    bar.addEventListener("click", (e) => {
      const btn = e.target.closest(".fmt-btn");
      if (!btn) return;
      this._exec(textareaEl, btn.dataset.action);
    });
  },

  _exec(ta, action) {
    switch (action) {
      case "bold": this.wrapSelection(ta, "**", "**", "bold"); break;
      case "italic": this.wrapSelection(ta, "*", "*", "italic"); break;
      case "heading": this.linePrefix(ta, "## "); break;
      case "code": this._code(ta); break;
      case "checklist": this.linePrefix(ta, "- [ ] "); break;
      case "list": this.linePrefix(ta, "- "); break;
      case "divider": this.insert(ta, "\n---\n"); break;
      case "link": this._link(ta); break;
    }
    ta.dispatchEvent(new Event("input"));
    ta.focus();
  },

  wrapSelection(ta, before, after, defaultText) {
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = ta.value.substring(s, e);
    if (sel) {
      const t = before + sel + after;
      ta.value = ta.value.substring(0, s) + t + ta.value.substring(e);
      ta.selectionStart = s;
      ta.selectionEnd = s + t.length;
    } else {
      const t = before + defaultText + after;
      ta.value = ta.value.substring(0, s) + t + ta.value.substring(e);
      ta.selectionStart = s + before.length;
      ta.selectionEnd = s + before.length + defaultText.length;
    }
  },

  linePrefix(ta, prefix) {
    const s = ta.selectionStart;
    const lineStart = ta.value.lastIndexOf("\n", s - 1) + 1;
    ta.value = ta.value.substring(0, lineStart) + prefix + ta.value.substring(lineStart);
    ta.selectionStart = ta.selectionEnd = s + prefix.length;
  },

  insert(ta, text) {
    const s = ta.selectionStart;
    ta.value = ta.value.substring(0, s) + text + ta.value.substring(ta.selectionEnd);
    ta.selectionStart = ta.selectionEnd = s + text.length;
  },

  _code(ta) {
    const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd);
    if (sel.includes("\n")) {
      const s = ta.selectionStart, e = ta.selectionEnd;
      const t = "```\n" + sel + "\n```";
      ta.value = ta.value.substring(0, s) + t + ta.value.substring(e);
      ta.selectionStart = s + 4;
      ta.selectionEnd = s + 4 + sel.length;
    } else {
      this.wrapSelection(ta, "`", "`", "code");
    }
  },

  _link(ta) {
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = ta.value.substring(s, e);
    if (sel) {
      const t = "[" + sel + "](url)";
      ta.value = ta.value.substring(0, s) + t + ta.value.substring(e);
      ta.selectionStart = s + sel.length + 3;
      ta.selectionEnd = s + sel.length + 6;
    } else {
      const t = "[link text](url)";
      ta.value = ta.value.substring(0, s) + t + ta.value.substring(e);
      ta.selectionStart = s + 1;
      ta.selectionEnd = s + 10;
    }
  }
};
