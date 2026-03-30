/**
 * Devlog — Focus Writing Timer
 */

const focusTimer = {
  interval: null,
  remaining: 0,
  textarea: null,
  displayEl: null,
  activeEl: null,
  presetsEl: null,
  toastEl: null,

  init(textareaEl, presetsEl, activeEl, displayEl, cancelBtn, toastEl) {
    this.textarea = textareaEl;
    this.presetsEl = presetsEl;
    this.activeEl = activeEl;
    this.displayEl = displayEl;
    this.toastEl = toastEl;

    presetsEl.querySelectorAll(".timer-preset").forEach(btn => {
      btn.addEventListener("click", () => this.start(parseInt(btn.dataset.minutes)));
    });
    cancelBtn.addEventListener("click", () => this.cancel());
  },

  start(minutes) {
    this.cancel();
    this.remaining = minutes * 60;
    this.presetsEl.style.display = "none";
    this.activeEl.style.display = "flex";
    if (this.textarea) this.textarea.classList.add("focus-active");
    this._tick();
    this.interval = setInterval(() => this._tick(), 1000);
  },

  cancel() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.remaining = 0;
    if (this.presetsEl) this.presetsEl.style.display = "flex";
    if (this.activeEl) this.activeEl.style.display = "none";
    if (this.textarea) this.textarea.classList.remove("focus-active");
  },

  _tick() {
    if (this.remaining <= 0) { this._complete(); return; }
    const m = Math.floor(this.remaining / 60);
    const s = this.remaining % 60;
    this.displayEl.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    this.remaining--;
  },

  _complete() {
    this.cancel();
    if (this.toastEl) utils.showToast(this.toastEl, "Time\u2019s up \u2014 nice session", 3000);
  }
};
