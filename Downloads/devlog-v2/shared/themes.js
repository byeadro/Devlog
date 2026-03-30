/**
 * Devlog — Theme & Font Switcher
 */

const themes = {
  presets: {
    "warm-dark": {
      "--bg":"#1C1B19","--bg-elevated":"#242320","--bg-input":"#1A1918","--surface":"#2A2926",
      "--border":"#353330","--border-light":"#2E2D2A","--text":"#E8E4DD","--text-secondary":"#9A9590",
      "--text-tertiary":"#6B6660","--text-placeholder":"#55514C","--accent":"#C9A96E",
      "--accent-dim":"rgba(201,169,110,0.12)","--accent-hover":"#D4B87A","--danger":"#B85C5C",
      "--danger-dim":"rgba(184,92,92,0.12)","--tag-bg":"rgba(201,169,110,0.1)","--tag-text":"#B89D60",
      "--success":"#6B9E6B","--success-dim":"rgba(107,158,107,0.12)"
    },
    "midnight": {
      "--bg":"#161B22","--bg-elevated":"#1C2129","--bg-input":"#141920","--surface":"#222830",
      "--border":"#2D333B","--border-light":"#272D35","--text":"#E0E4EA","--text-secondary":"#8B929A",
      "--text-tertiary":"#636B75","--text-placeholder":"#4D5560","--accent":"#58A6FF",
      "--accent-dim":"rgba(88,166,255,0.12)","--accent-hover":"#79B8FF","--danger":"#F85149",
      "--danger-dim":"rgba(248,81,73,0.12)","--tag-bg":"rgba(88,166,255,0.1)","--tag-text":"#58A6FF",
      "--success":"#56D364","--success-dim":"rgba(86,211,100,0.12)"
    },
    "forest": {
      "--bg":"#1A1F1A","--bg-elevated":"#212821","--bg-input":"#181D18","--surface":"#283028",
      "--border":"#354035","--border-light":"#2E382E","--text":"#DEE4DD","--text-secondary":"#8A9589",
      "--text-tertiary":"#657064","--text-placeholder":"#505A4F","--accent":"#7CB87C",
      "--accent-dim":"rgba(124,184,124,0.12)","--accent-hover":"#90CC90","--danger":"#C85C5C",
      "--danger-dim":"rgba(200,92,92,0.12)","--tag-bg":"rgba(124,184,124,0.1)","--tag-text":"#7CB87C",
      "--success":"#7CB87C","--success-dim":"rgba(124,184,124,0.12)"
    },
    "light": {
      "--bg":"#FAFAF8","--bg-elevated":"#FFFFFF","--bg-input":"#F0F0EC","--surface":"#EAEAE6",
      "--border":"#D8D8D2","--border-light":"#E2E2DC","--text":"#1A1A18","--text-secondary":"#6B6B65",
      "--text-tertiary":"#9A9A94","--text-placeholder":"#B5B5AF","--accent":"#B8860B",
      "--accent-dim":"rgba(184,134,11,0.1)","--accent-hover":"#CC9B1A","--danger":"#C0392B",
      "--danger-dim":"rgba(192,57,43,0.1)","--tag-bg":"rgba(184,134,11,0.08)","--tag-text":"#8B6914",
      "--success":"#27AE60","--success-dim":"rgba(39,174,96,0.1)"
    }
  },

  setTheme(name) {
    const vars = this.presets[name];
    if (!vars) return;
    Object.entries(vars).forEach(([p, v]) => document.documentElement.style.setProperty(p, v));
    chrome.storage.local.set({ devlog_theme: name });
  },

  async loadTheme() {
    return new Promise(resolve => {
      chrome.storage.local.get(["devlog_theme"], r => {
        const name = r.devlog_theme || "warm-dark";
        if (name !== "warm-dark") this.setTheme(name);
        resolve(name);
      });
    });
  },

  FONTS: {
    literata: "'Literata', Georgia, serif",
    merriweather: "'Merriweather', Georgia, serif",
    sourceserif: "'Source Serif 4', Georgia, serif",
    jetbrains: "'JetBrains Mono', monospace",
    lora: "'Lora', Georgia, serif"
  },

  setWritingFont(name) {
    const f = this.FONTS[name];
    if (!f) return;
    document.documentElement.style.setProperty("--font-writing", f);
    chrome.storage.local.set({ devlog_font: name });
  },

  async loadWritingFont() {
    return new Promise(resolve => {
      chrome.storage.local.get(["devlog_font"], r => {
        const name = r.devlog_font || "literata";
        if (name !== "literata") this.setWritingFont(name);
        resolve(name);
      });
    });
  }
};
