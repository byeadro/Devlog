/**
 * Devlog — Background Service Worker
 *
 * Listens for messages from the popup to open the full tab view.
 * Provides "Save to Devlog" context menu for bookmarking pages.
 */

// ── Context menu setup ──

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-devlog",
    title: "Save to Devlog",
    contexts: ["page", "selection"]
  });
});

// ── Context menu click handler ──

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "save-to-devlog") return;

  const title = (tab && tab.title) || "Untitled";
  const url = (tab && tab.url) || "";
  const selectedText = info.selectionText || "";

  // Build markdown content
  let content = `## [${title}](${url})`;
  if (selectedText) {
    const quoted = selectedText.split("\n").map(line => `> ${line}`).join("\n");
    content += `\n\n${quoted}`;
  }

  const entry = {
    content,
    tags: ["bookmark"],
    createdAt: new Date().toISOString()
  };

  // Append to pending entries in storage
  chrome.storage.local.get(["devlog_pending"], (result) => {
    const pending = result.devlog_pending || [];
    pending.push(entry);
    chrome.storage.local.set({ devlog_pending: pending }, () => {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-128.png",
        title: "Saved to Devlog",
        message: `Bookmarked: ${title}`
      });
    });
  });
});

// ── Message listener ──

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "openFullTab") {
    chrome.tabs.create({ url: chrome.runtime.getURL("tab.html") });
    sendResponse({ ok: true });
  }
});
