let blockedExtensions = [];
let blockedWebsites = [];

// Initialize from storage
chrome.storage.sync.get(["blockedExtensions", "blockedWebsites"], (data) => {
  if (data.blockedExtensions) {
    blockedExtensions = data.blockedExtensions;
  }
  if (data.blockedWebsites) {
    blockedWebsites = data.blockedWebsites;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    checkAndToggleExtensions(tab.url);
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    checkAndToggleExtensions(tab.url);
  });
});

function checkAndToggleExtensions(url) {
  const shouldDisable = blockedWebsites.some((site) => url.includes(site));
  if (shouldDisable) {
    disableExtensions();
  } else {
    enableExtensions();
  }
}

function disableExtensions() {
  blockedExtensions.forEach((extensionId) => {
    chrome.management.setEnabled(extensionId, false, () => {
      console.log(`Disabled extension: ${extensionId}`);
    });
  });
}

function enableExtensions() {
  blockedExtensions.forEach((extensionId) => {
    chrome.management.setEnabled(extensionId, true, () => {
      console.log(`Enabled extension: ${extensionId}`);
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateSettings") {
    blockedExtensions = request.extensions;
    blockedWebsites = request.websites;
    chrome.storage.sync.set({
      blockedExtensions,
      blockedWebsites,
    });
    sendResponse({ status: "success" });
  }
});

// Check the URL of the currently active tab when the extension is first loaded
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs.length > 0) {
    checkAndToggleExtensions(tabs[0].url);
  }
});
