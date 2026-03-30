/**
 * Devlog — Slash Commands Menu
 */

const slashMenu = {
  commands: [
    { cmd: "h1", label: "Heading 1", icon: "H1", insert: "# " },
    { cmd: "h2", label: "Heading 2", icon: "H2", insert: "## " },
    { cmd: "h3", label: "Heading 3", icon: "H3", insert: "### " },
    { cmd: "code", label: "Code Block", icon: "<>", insert: "```\n\n```", cursorOffset: 4 },
    { cmd: "todo", label: "To-do", icon: "\u2610", insert: "- [ ] " },
    { cmd: "divider", label: "Divider", icon: "\u2014", insert: "\n---\n" },
    { cmd: "timestamp", label: "Timestamp", icon: "\u23F1", insert: null },
    { cmd: "table", label: "Table", icon: "\u229E", insert: "| Column 1 | Column 2 |\n|----------|----------|\n|          |          |" },
    { cmd: "quote", label: "Quote", icon: "\u275D", insert: "> " }
  ],

  init(textareaEl) {
    let menuEl = null;
    let isOpen = false;
    let filtered = [];
    let selectedIdx = 0;
    let slashPos = -1;
    const cmds = slashMenu.commands;

    textareaEl.addEventListener("input", onInput);
    textareaEl.addEventListener("keydown", onKey);
    textareaEl.addEventListener("blur", () => setTimeout(hide, 200));

    function onInput() {
      const pos = textareaEl.selectionStart;
      const before = textareaEl.value.substring(0, pos);
      const m = before.match(/(?:^|\n| )\/([a-z0-9]*)$/);
      if (m) {
        slashPos = pos - m[1].length - 1;
        filtered = cmds.filter(c => c.cmd.startsWith(m[1]));
        if (filtered.length) { selectedIdx = 0; show(); return; }
      }
      hide();
    }

    function onKey(e) {
      if (!isOpen) return;
      if (e.key === "ArrowDown") { e.preventDefault(); selectedIdx = (selectedIdx + 1) % filtered.length; render(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); selectedIdx = (selectedIdx - 1 + filtered.length) % filtered.length; render(); }
      else if (e.key === "Enter") { e.preventDefault(); pick(filtered[selectedIdx]); }
      else if (e.key === "Escape") { e.preventDefault(); hide(); }
    }

    function show() {
      if (!menuEl) { menuEl = document.createElement("div"); menuEl.className = "slash-menu"; document.body.appendChild(menuEl); }
      render();
      const rect = textareaEl.getBoundingClientRect();
      const before = textareaEl.value.substring(0, textareaEl.selectionStart);
      const lines = before.split("\n");
      const lh = parseFloat(getComputedStyle(textareaEl).lineHeight) || 22;
      let top = rect.top + (lines.length) * lh - textareaEl.scrollTop + 4;
      let left = rect.left + lines[lines.length - 1].length * 8;
      if (top + 280 > window.innerHeight) top -= 290;
      if (left + 200 > window.innerWidth) left = window.innerWidth - 210;
      menuEl.style.cssText = `top:${Math.max(0, top)}px;left:${Math.max(0, left)}px;display:block;position:fixed;`;
      isOpen = true;
    }

    function render() {
      if (!menuEl) return;
      menuEl.innerHTML = filtered.map((c, i) =>
        `<div class="slash-item${i === selectedIdx ? " active" : ""}" data-i="${i}"><span class="slash-icon">${c.icon}</span><span class="slash-label">${c.label}</span></div>`
      ).join("");
      menuEl.querySelectorAll(".slash-item").forEach(el => {
        el.addEventListener("mousedown", (e) => { e.preventDefault(); pick(filtered[parseInt(el.dataset.i)]); });
      });
    }

    function hide() { if (menuEl) menuEl.style.display = "none"; isOpen = false; }

    function pick(item) {
      let text = item.insert;
      if (item.cmd === "timestamp") {
        const now = new Date();
        text = "**" + now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) + "** \u2014 ";
      }
      const pos = textareaEl.selectionStart;
      const before = textareaEl.value.substring(0, slashPos);
      const after = textareaEl.value.substring(pos);
      textareaEl.value = before + text + after;
      const cursor = item.cursorOffset ? slashPos + item.cursorOffset : slashPos + text.length;
      textareaEl.selectionStart = textareaEl.selectionEnd = cursor;
      hide();
      textareaEl.dispatchEvent(new Event("input"));
      textareaEl.focus();
    }
  }
};
