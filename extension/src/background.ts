/**
 * Copilot Dash - Edge Extension Background Service Worker
 *
 * Updates the extension icon based on whether the current page
 * matches any Copilot CLI runs. The side panel handles its own
 * data fetching independently.
 */

export {}; // ensure this is treated as an ES module

const BACKEND_URL = "http://localhost:3456";

console.log("[Copilot Dash] background service worker loaded");

async function setDebugBadge(text: string): Promise<void> {
  try {
    await chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
    await chrome.action.setBadgeText({ text });
  } catch {
    // Ignore badge errors
  }
}

/**
 * Check if a URL matches any run via the backend API.
 */
async function checkUrlMatch(url: string): Promise<boolean> {
  console.log("[Copilot Dash] checkUrlMatch", url);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(
      `${BACKEND_URL}/api/runs/match?url=${encodeURIComponent(url)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    console.log("[Copilot Dash] match response", response.status);
    if (!response.ok) return false;
    const data = await response.json();
    console.log("[Copilot Dash] match result", data?.matched, data?.runs?.length);
    return !!(data.matched && data.runs && data.runs.length > 0);
  } catch (err) {
    console.log("[Copilot Dash] match error", err);
    return false;
  }
}

/**
 * Set the extension icon for a specific tab.
 */
async function setIcon(tabId: number, active: boolean): Promise<void> {
  const state = active ? "active" : "inactive";
  console.log("[Copilot Dash] setIcon start", tabId, state);
  try {
    const icon16 = chrome.runtime.getURL(`icons/icon-${state}-16.png`);
    const icon48 = chrome.runtime.getURL(`icons/icon-${state}-48.png`);
    await chrome.action.setIcon({
      tabId,
      path: {
        16: icon16,
        48: icon48,
      },
    });
    await chrome.action.setTitle({
      tabId,
      title: active ? "Copilot Dash - Run matched!" : "Copilot Dash",
    });
    await chrome.action.setBadgeText({ text: active ? "OK" : "" });
    console.log("[Copilot Dash] setIcon done", tabId, state);
  } catch (err) {
    console.log("[Copilot Dash] setIcon error", err);
  }
}

async function setSidePanelEnabled(tabId: number, enabled: boolean): Promise<void> {
  if (!chrome.sidePanel?.setOptions) return;
  try {
    await chrome.sidePanel.setOptions({
      tabId,
      enabled,
      path: enabled ? "sidepanel.html" : undefined,
    });
  } catch (err) {
    console.log("[Copilot Dash] setSidePanelEnabled error", err);
  }
}

/**
 * Update the icon for a tab based on URL match.
 */
async function updateIcon(tabId: number, url: string): Promise<void> {
  console.log("[Copilot Dash] updateIcon", tabId, url);
  if (
    !url ||
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:")
  ) {
    await setIcon(tabId, false);
    await setSidePanelEnabled(tabId, false);
    return;
  }

  const matched = await checkUrlMatch(url);
  await setIcon(tabId, matched);
  await setSidePanelEnabled(tabId, matched);
}

async function refreshActiveTabIcon(): Promise<void> {
  try {
    console.log("[Copilot Dash] refreshActiveTabIcon");
    await setDebugBadge("ON");
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs[0];
    if (tab?.id && tab.url) {
      await updateIcon(tab.id, tab.url);
    }
  } catch {
    // Ignore startup errors
  }
}

// ── Event Listeners ──

// Initial refresh on install/startup
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Copilot Dash] onInstalled");
  setDebugBadge("ON");
  refreshActiveTabIcon();
});

chrome.runtime.onStartup.addListener(() => {
  console.log("[Copilot Dash] onStartup");
  setDebugBadge("ON");
  refreshActiveTabIcon();
});

// Tab URL changes — listen for both url change and loading status
chrome.tabs.onUpdated.addListener(
  (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
    if (changeInfo.url || changeInfo.status === "loading") {
      console.log("[Copilot Dash] onUpdated", tabId, changeInfo.url, changeInfo.status);
    }
    if (changeInfo.url) {
      updateIcon(tabId, changeInfo.url);
    } else if (changeInfo.status === "loading" && tab.url) {
      updateIcon(tabId, tab.url);
    }
  }
);

// Tab switched
chrome.tabs.onActivated.addListener(async (activeInfo: chrome.tabs.TabActiveInfo) => {
  try {
    console.log("[Copilot Dash] onActivated", activeInfo.tabId);
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) updateIcon(activeInfo.tabId, tab.url);
  } catch {
    // Tab may have closed
  }
});

// Invalidate cache when webNavigation completes (new page content at same URL)
chrome.webNavigation?.onCommitted?.addListener(
  (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
    console.log("[Copilot Dash] onCommitted", details.tabId, details.url);
    if (details.frameId === 0 && details.url) {
      updateIcon(details.tabId, details.url);
    }
  }
);

// Extension icon clicked — open side panel
chrome.action.onClicked.addListener(async (tab: chrome.tabs.Tab) => {
  if (tab.id) {
    console.log("[Copilot Dash] action.onClicked", tab.id);
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Handle messages from the side panel
chrome.runtime.onMessage.addListener(
  (
    message: { type: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: { url: string }) => void
  ) => {
    if (message.type === "GET_TAB_URL") {
      console.log("[Copilot Dash] onMessage GET_TAB_URL");
      chrome.tabs
        .query({ active: true, lastFocusedWindow: true })
        .then((tabs) => {
          sendResponse({ url: tabs[0]?.url || "" });
        })
        .catch(() => {
          sendResponse({ url: "" });
        });
      return true; // keep channel open for async response
    }
  }
);
