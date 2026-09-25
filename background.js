let blockedExtensions = [];
let blockedWebsites = [];

// Prior `enabled` value for extensions this service worker turned off because
// the user was on a blocked site. Local storage (not sync) so a worker restart
// can still restore them on this browser only.
let priorEnabledState = {};

const PRIOR_STATE_KEY = "priorEnabledState";

// management.setEnabled is global, so overlapping tab events must run in order.
let queue = Promise.resolve();

function enqueue(task) {
  queue = queue.then(task).catch((error) => {
    console.error("Extension Disabler:", error);
  });
  return queue;
}

function asStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string");
}

function sanitizeSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const snapshot = {};
  for (const [id, enabled] of Object.entries(value)) {
    if (typeof enabled === "boolean") snapshot[id] = enabled;
  }
  return snapshot;
}

/**
 * A blocked-site entry matches a tab by hostname or origin, never by substring.
 *
 * - "example.com" matches that hostname on any scheme and port.
 * - "localhost" and "127.0.0.1" are exact hosts (they are not aliases).
 * - "localhost:3000" or "127.0.0.1:8080" match that host only on the given port.
 * - "https://example.com" or "http://localhost:3000" (what Add current website
 *   stores) match that origin. The path is ignored.
 *
 * `example.com` therefore does not match `notexample.com` or `example.com.evil.com`.
 */
function urlMatchesSite(tabUrl, siteEntry) {
  if (typeof tabUrl !== "string" || typeof siteEntry !== "string") return false;

  let tab;
  try {
    tab = new URL(tabUrl);
  } catch {
    return false;
  }
  if (tab.protocol !== "http:" && tab.protocol !== "https:") return false;

  const trimmed = siteEntry.trim();
  if (!trimmed) return false;

  const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
  let pattern;
  try {
    pattern = new URL(hasProtocol ? trimmed : `http://${trimmed}`);
  } catch {
    return false;
  }
  if (!pattern.hostname) return false;

  if (hasProtocol) {
    return tab.origin === pattern.origin;
  }

  if (tab.hostname.toLowerCase() !== pattern.hostname.toLowerCase()) {
    return false;
  }

  // Bare hosts match every port. An explicit port (localhost:3000) does not.
  // Read the port from the text: URL parsing drops the default port, so
  // "localhost:80" would otherwise look like "localhost".
  const port = explicitPort(trimmed);
  if (!port) return true;

  const tabPort = tab.port || (tab.protocol === "https:" ? "443" : "80");
  return tabPort === port;
}

function explicitPort(entry) {
  const hostPart = entry.split(/[/?#]/)[0];
  const match = hostPart.match(/:(\d+)$/);
  return match ? match[1] : "";
}

function isBlockedUrl(url) {
  return blockedWebsites.some((site) => urlMatchesSite(url, site));
}

async function persistSnapshot() {
  await chrome.storage.local.set({ [PRIOR_STATE_KEY]: priorEnabledState });
}

async function restoreIds(ids) {
  if (ids.length === 0) return;

  let changed = false;
  for (const extensionId of ids) {
    const prior = priorEnabledState[extensionId];
    // Only undo a disable we performed. A user who already had the extension
    // off must not be forced back on when they leave the site.
    if (prior === true) {
      try {
        const info = await chrome.management.get(extensionId);
        if (!info.enabled) {
          await chrome.management.setEnabled(extensionId, true);
          console.log(`Restored extension: ${extensionId}`);
        }
      } catch (error) {
        console.warn(`Could not restore extension ${extensionId}`, error);
        // Still installed: keep the snapshot and try again on the next check.
        try {
          await chrome.management.get(extensionId);
          continue;
        } catch {
          // Uninstalled.
        }
      }
    }
    delete priorEnabledState[extensionId];
    changed = true;
  }

  if (changed) await persistSnapshot();
}

async function disableListedExtensions() {
  let snapshotChanged = false;

  for (const extensionId of blockedExtensions) {
    if (Object.prototype.hasOwnProperty.call(priorEnabledState, extensionId)) {
      continue;
    }
    try {
      const info = await chrome.management.get(extensionId);
      priorEnabledState[extensionId] = info.enabled;
      snapshotChanged = true;
    } catch (error) {
      console.warn(`Skipping missing extension ${extensionId}`, error);
    }
  }

  // Persist before disabling so a worker restart still knows the user's state.
  if (snapshotChanged) await persistSnapshot();

  for (const extensionId of blockedExtensions) {
    if (priorEnabledState[extensionId] !== true) continue;
    try {
      const info = await chrome.management.get(extensionId);
      if (!info.enabled) continue;
      await chrome.management.setEnabled(extensionId, false);
      console.log(`Disabled extension: ${extensionId}`);
    } catch (error) {
      console.warn(`Could not disable extension ${extensionId}`, error);
    }
  }
}

async function applyForUrl(url) {
  const blocking = isBlockedUrl(url);
  const snapshotted = Object.keys(priorEnabledState);
  const removedFromList = snapshotted.filter(
    (id) => !blockedExtensions.includes(id)
  );

  if (!blocking) {
    await restoreIds(snapshotted);
    return;
  }

  await restoreIds(removedFromList);
  await disableListedExtensions();
}

async function reevaluateActiveTab() {
  const [active] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (!active || !active.url) return;
  await applyForUrl(active.url);
}

function scheduleActiveTabRecheck(tabId) {
  enqueue(async () => {
    const [active] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    // Ignore updates from background tabs. Enabling is global, so a tab the
    // user is not looking at must not turn extensions back on.
    if (!active || !active.url) return;
    if (tabId != null && active.id !== tabId) return;
    await applyForUrl(active.url);
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "complete" && !changeInfo.url) return;
  scheduleActiveTabRecheck(tabId);
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  enqueue(async () => {
    const win = await chrome.windows.get(activeInfo.windowId);
    if (!win.focused) return;
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (!tab.url) return;
    await applyForUrl(tab.url);
  });
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  enqueue(async () => {
    const [active] = await chrome.tabs.query({ active: true, windowId });
    if (!active || !active.url) return;
    await applyForUrl(active.url);
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "updateSettings") return;

  enqueue(async () => {
    blockedExtensions = asStringList(request.extensions);
    blockedWebsites = asStringList(request.websites);
    await chrome.storage.sync.set({ blockedExtensions, blockedWebsites });
    await reevaluateActiveTab();
  });
  sendResponse({ status: "success" });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (!changes.blockedExtensions && !changes.blockedWebsites) return;

  enqueue(async () => {
    let changed = false;
    if (changes.blockedExtensions) {
      const next = asStringList(changes.blockedExtensions.newValue);
      if (next.join("\n") !== blockedExtensions.join("\n")) {
        blockedExtensions = next;
        changed = true;
      }
    }
    if (changes.blockedWebsites) {
      const next = asStringList(changes.blockedWebsites.newValue);
      if (next.join("\n") !== blockedWebsites.join("\n")) {
        blockedWebsites = next;
        changed = true;
      }
    }
    // Covers Reset, which clears storage without an updateSettings message.
    if (changed) await reevaluateActiveTab();
  });
});

enqueue(async () => {
  const data = await chrome.storage.sync.get([
    "blockedExtensions",
    "blockedWebsites",
  ]);
  blockedExtensions = asStringList(data.blockedExtensions);
  blockedWebsites = asStringList(data.blockedWebsites);

  const local = await chrome.storage.local.get(PRIOR_STATE_KEY);
  priorEnabledState = sanitizeSnapshot(local[PRIOR_STATE_KEY]);

  await reevaluateActiveTab();
});
