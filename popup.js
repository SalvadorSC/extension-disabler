document.addEventListener("DOMContentLoaded", () => {
  const extensionList = document.getElementById("extensionList");
  const websiteList = document.getElementById("websiteList");
  const websiteInput = document.getElementById("websiteInput");
  const extensionFilter = document.getElementById("extensionFilter");
  const websiteFilter = document.getElementById("websiteFilter");
  const themeToggle = document.getElementById("themeToggle");
  const noExtensionsMessage = document.getElementById("noExtensionsMessage");
  const noWebsitesMessage = document.getElementById("noWebsitesMessage");
  const rateButton = document.getElementById("rateButton"); // New rate button
  const isFirefoxBrowser = navigator.userAgent.includes("Firefox");
  const toggleExtensionsButton = document.getElementById(
    "toggleSelectedExtension"
  );

  if (isFirefoxBrowser) {
    console.warn(
      "Firefox detected: The `chrome.management` API is not available."
    );
  } else {
    toggleExtensionsButton.style.display = "none";
  }

  // Toggle Extension Button Click
  toggleExtensionsButton.addEventListener("click", async () => {
    const selectedExtension = extensionList.querySelector(
      "input[type='checkbox']:checked"
    );
    if (!selectedExtension) {
      alert("Please select an extension to toggle.");
      return;
    }
    const extensionId = selectedExtension.value;

    try {
      let extensionInfo = await chrome.management.get(extensionId);
      let newState = !extensionInfo.enabled; // Toggle the current state

      if (isFirefox) {
        //alert("Firefox only allows enabling/disabling themes.");
        console.log("Firefox only allows enabling/disabling themes.");
        return;
      }

      await chrome.management.setEnabled(extensionId, newState);
      //alert(`Extension is now ${newState ? "enabled" : "disabled"}`);
      console.log(`Extension is now ${newState ? "enabled" : "disabled"}`);
    } catch (error) {
      console.error("Error toggling extension:", error);
      //alert("Action restricted: Only themes can be toggled in Firefox.");
      console.log("Action restricted: Only themes can be toggled in Firefox.");
    }
  });

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

  // Rate button logic
  rateButton.addEventListener("click", () => {
    const extensionId = "midacakbhnbiohpknjpnodiglekaedhm"; // Use the provided extension ID
    const url = `https://chrome.google.com/webstore/detail/${extensionId}`;
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
    let iconURL = extension.icons[extension.icons.length - 1].url;

    if (iconURL.startsWith("moz-extension://")) {
      console.warn(
        `Firefox icon not accessible for ${extension.name}:`,
        iconURL
      );
      // remove img
    } else {
      const img = document.createElement("img");
      img.remove();
      img.src = iconURL; // Use the standard icon if accessible
      img.alt = extension.name;
      label.appendChild(img);
    }
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

function updateNoResultsMessage(list, message, hasVisibleItems) {
  if (typeof hasVisibleItems === "undefined") {
    hasVisibleItems = Array.from(list.children).some(
      (child) => child.style.display !== "none"
    );
  }
  message.style.display = hasVisibleItems ? "none" : "block";
}
