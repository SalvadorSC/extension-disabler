document.addEventListener("DOMContentLoaded", () => {
  const extensionList = document.getElementById("extensionList");
  const websiteList = document.getElementById("websiteList");
  const websiteInput = document.getElementById("websiteInput");
  const extensionFilter = document.getElementById("extensionFilter");
  const websiteFilter = document.getElementById("websiteFilter");
  const themeToggle = document.getElementById("themeToggle");
  const noExtensionsMessage = document.getElementById("noExtensionsMessage");
  const noWebsitesMessage = document.getElementById("noWebsitesMessage");
  const rateButton = document.getElementById("rateButton");
  const exportSettingsButton = document.getElementById("exportSettings");
  const importSettingsButton = document.getElementById("importSettings");
  const importSettingsFile = document.getElementById("importSettingsFile");


  chrome.management.getAll((extensions) => {
    chrome.storage.sync.get("blockedExtensions", (data) => {
      const blockedExtensions = data.blockedExtensions || [];
      const sortedExtensions = extensions.sort((a, b) => {
        if (
          blockedExtensions.includes(a.id) &&
          !blockedExtensions.includes(b.id)
        ) {
          return -1;
        }
        if (
          !blockedExtensions.includes(a.id) &&
          blockedExtensions.includes(b.id)
        ) {
          return 1;
        }
        return a.name.localeCompare(b.name);
      });

      sortedExtensions.forEach((extension) => {
        if (
          extension.type === "extension" &&
          extension.id !== chrome.runtime.id
        ) {
          addExtensionToList(
            extension,
            blockedExtensions.includes(extension.id)
          );
        }
      });

      updateNoResultsMessage(extensionList, noExtensionsMessage);
    });
  });

  chrome.storage.sync.get(
    ["blockedWebsites", "blockedExtensions", "theme"],
    (data) => {
      console.log("Retrieved data from storage:", data);
      if (data.blockedWebsites) {
        data.blockedWebsites.forEach((site) => {
          addWebsiteToList(site);
        });
      }

      if (data.blockedExtensions) {
        data.blockedExtensions.forEach((extensionId) => {
          const checkbox = document.getElementById(extensionId);
          if (checkbox) {
            checkbox.checked = true;
          }
        });
      }

      if (data.theme === "dark") {
        document.body.classList.add("dark-mode");
        themeToggle.textContent = "Light Mode";
      }

      updateNoResultsMessage(websiteList, noWebsitesMessage);
    }
  );

  document.getElementById("addWebsite").addEventListener("click", () => {
    const website = websiteInput.value.trim();
    if (website) {
      addWebsiteToList(website);
      websiteInput.value = "";
      saveSettings();
    }
  });

  document.getElementById("resetButton").addEventListener("click", () => {
    if (confirm("Are you sure you want to reset all settings?")) {
      chrome.storage.sync.clear(() => {
        location.reload();
      });
    }
  });

  exportSettingsButton.addEventListener("click", exportSettings);
  importSettingsButton.addEventListener("click", () => {
    importSettingsFile.click();
  });
  importSettingsFile.addEventListener("change", () => {
    const file = importSettingsFile.files && importSettingsFile.files[0];
    importSettingsFile.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result).replace(/^\uFEFF/, "");
        const settings = validateImportedSettings(JSON.parse(text));
        writeImportedSettings(settings);
      } catch (error) {
        const message =
          error instanceof SyntaxError
            ? "Settings file is not valid JSON."
            : error.message;
        alert(message || "Could not import settings.");
      }
    };
    reader.onerror = () => {
      alert("Could not read that file.");
    };
    reader.readAsText(file);
  });

  // Rate button logic
  rateButton.addEventListener("click", () => {
    const url =
      "https://chromewebstore.google.com/detail/extension-disabler-for-lo/midacakbhnbiohpknjpnodiglekaedhm";
    window.open(url, "_blank");
  });

  extensionFilter.addEventListener("input", () => {
    const filterText = extensionFilter.value.toLowerCase();
    const extensions = extensionList.querySelectorAll(".extension-item");
    let hasVisibleExtensions = false;
    extensions.forEach((extension) => {
      const name = extension.querySelector("span").textContent.toLowerCase();
      if (name.includes(filterText)) {
        extension.style.display = "";
        hasVisibleExtensions = true;
      } else {
        extension.style.display = "none";
      }
    });
    updateNoResultsMessage(
      extensionList,
      noExtensionsMessage,
      hasVisibleExtensions
    );
  });

  websiteFilter.addEventListener("input", () => {
    const filterText = websiteFilter.value.toLowerCase();
    const websites = websiteList.querySelectorAll("li");
    let hasVisibleWebsites = false;
    websites.forEach((website) => {
      if (
        website.querySelector("input").value.toLowerCase().includes(filterText)
      ) {
        website.style.display = "";
        hasVisibleWebsites = true;
      } else {
        website.style.display = "none";
      }
    });
    updateNoResultsMessage(websiteList, noWebsitesMessage, hasVisibleWebsites);
  });

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDarkMode = document.body.classList.contains("dark-mode");
    themeToggle.textContent = isDarkMode ? "Light Mode" : "Dark Mode";
    chrome.storage.sync.set({ theme: isDarkMode ? "dark" : "default" });
  });

  // Collapsible logic
  const collapsibles = document.getElementsByClassName("collapsible");
  for (const collapsible of collapsibles) {
    collapsible.addEventListener("click", function () {
      this.classList.toggle("active");
      const content = this.nextElementSibling;
      const arrow = this.querySelector(".arrow");
      if (content.style.maxHeight) {
        content.style.maxHeight = null;
        arrow.innerHTML = "&#9654;"; // Right arrow
      } else {
        content.style.maxHeight = content.scrollHeight + "px";
        arrow.innerHTML = "&#9660;"; // Down arrow
      }
    });
  }
});

function addExtensionToList(extension, isBlocked) {
  const extensionList = document.getElementById("extensionList");
  const div = document.createElement("div");
  div.classList.add("extension-item");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = extension.id;
  checkbox.checked = isBlocked;

  checkbox.addEventListener("change", () => {
    saveSettings();
  });

  const label = document.createElement("label");
  label.htmlFor = extension.id;

  if (extension.icons && extension.icons.length > 0) {
    const iconURL = extension.icons[extension.icons.length - 1].url;
    const img = document.createElement("img");
    img.src = iconURL;
    img.alt = extension.name;
    label.appendChild(img);
  }

  const span = document.createElement("span");
  span.textContent = extension.name;

  label.appendChild(span);

  div.appendChild(checkbox);
  div.appendChild(label);
  extensionList.appendChild(div);

  updateNoResultsMessage(
    extensionList,
    document.getElementById("noExtensionsMessage")
  );
}

// Function to clean up the URL
function sanitizeURL(url) {
  try {
    let urlObj = new URL(url);
    return urlObj.origin; // Keeps only protocol + domain
  } catch (error) {
    console.error("Invalid URL:", error);
    return url; // Fallback to full URL if parsing fails
  }
}

document.getElementById("addCurrentWebsite").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
      alert("No active tab found.");
      return;
    }
    const fullURL = tabs[0].url;
    const cleanURL = sanitizeURL(fullURL); // Clean the URL
    addWebsiteToList(cleanURL);
    saveSettings();
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.update(tabs[0].id, { url: tabs[0].url });
    });
  });
});

function addWebsiteToList(website) {
  const websiteList = document.getElementById("websiteList");
  const li = document.createElement("li");

  const input = document.createElement("input");
  input.type = "text";
  input.value = website;
  input.addEventListener("change", () => {
    saveSettings();
  });

  const removeButton = document.createElement("button");
  removeButton.textContent = "Remove";
  removeButton.classList.add("remove-btn");
  removeButton.addEventListener("click", () => {
    li.remove();
    saveSettings();
  });

  li.appendChild(input);
  li.appendChild(removeButton);
  websiteList.appendChild(li);

  updateNoResultsMessage(
    websiteList,
    document.getElementById("noWebsitesMessage")
  );
}

function saveSettings() {
  const extensionList = document.getElementById("extensionList");
  const websiteList = document.getElementById("websiteList");

  const selectedExtensions = Array.from(
    extensionList.querySelectorAll("input:checked")
  ).map((checkbox) => checkbox.id);
  const websites = Array.from(websiteList.querySelectorAll("li input")).map(
    (input) => input.value.trim()
  );

  console.log("Saving websites to storage:", websites);

  chrome.runtime.sendMessage(
    {
      action: "updateSettings",
      extensions: selectedExtensions,
      websites: websites,
    },
    (response) => {
      if (response.status === "success") {
        console.log("Settings saved");
      }
    }
  );

  chrome.storage.sync.set({
    blockedExtensions: selectedExtensions,
    blockedWebsites: websites,
  });
}

function exportSettings() {
  chrome.storage.sync.get(
    ["blockedExtensions", "blockedWebsites", "theme"],
    (data) => {
      const payload = {
        blockedExtensions: data.blockedExtensions || [],
        blockedWebsites: data.blockedWebsites || [],
        theme: data.theme === "dark" ? "dark" : "default",
      };
      const blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "extension-disabler-settings.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  );
}

// Expected file shape: { blockedExtensions: string[], blockedWebsites: string[], theme?: "dark" | "default" }
function validateImportedSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Settings file must be a JSON object.");
  }

  const blockedExtensions = stringList(
    value.blockedExtensions,
    "blockedExtensions"
  );
  const blockedWebsites = stringList(value.blockedWebsites, "blockedWebsites");

  if (
    value.theme !== undefined &&
    value.theme !== "dark" &&
    value.theme !== "default"
  ) {
    throw new Error('theme must be "dark" or "default".');
  }

  assertSyncItemSize("blockedExtensions", blockedExtensions);
  assertSyncItemSize("blockedWebsites", blockedWebsites);

  const settings = { blockedExtensions, blockedWebsites };
  if (value.theme === "dark" || value.theme === "default") {
    settings.theme = value.theme;
  }
  return settings;
}

function stringList(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array of strings.`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new Error(`${label}[${index}] must be a non-empty string.`);
    }
    return item.trim();
  });
}

function assertSyncItemSize(label, value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
  if (bytes > chrome.storage.sync.QUOTA_BYTES_PER_ITEM) {
    throw new Error(`${label} is too large to store.`);
  }
}

function writeImportedSettings(settings) {
  const payload = {
    blockedExtensions: settings.blockedExtensions,
    blockedWebsites: settings.blockedWebsites,
  };
  if (settings.theme) payload.theme = settings.theme;

  chrome.storage.sync.set(payload, () => {
    if (chrome.runtime.lastError) {
      alert("Could not save settings: " + chrome.runtime.lastError.message);
      return;
    }
    chrome.runtime.sendMessage(
      {
        action: "updateSettings",
        extensions: settings.blockedExtensions,
        websites: settings.blockedWebsites,
      },
      () => {
        location.reload();
      }
    );
  });
}

function updateNoResultsMessage(list, message, hasVisibleItems) {
  if (typeof hasVisibleItems === "undefined") {
    hasVisibleItems = Array.from(list.children).some(
      (child) => child.style.display !== "none"
    );
  }
  message.style.display = hasVisibleItems ? "none" : "block";
}
