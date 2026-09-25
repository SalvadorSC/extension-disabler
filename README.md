# Extension Disabler for Localhost and websites

Chrome extension that temporarily disables other extensions on localhost and sites you choose — useful while developing or on pages where password managers / language tools get in the way.

**Chrome Web Store:** https://chromewebstore.google.com/detail/extension-disabler-for-lo/midacakbhnbiohpknjpnodiglekaedhm  
**Portfolio:** https://salvasc.dev/  
**Write-up:** https://medium.com/@sanchezcampossalvador/how-i-developed-a-chrome-extension-to-disable-other-extensions-tried-to-do-too-in-firefox-765c2f0902d9

## Status

Recovered from the Chrome Web Store install **v1.1.2** (Manifest V3) on 2026-09-25. Original git history was not found; this tree is the published package minus Chrome `_metadata`.

## Load unpacked (dev)

1. Open `chrome://extensions`
2. Enable Developer mode
3. **Load unpacked** → select this folder

## Permissions

Uses `chrome.management` and `chrome.storage.sync` for site-based block lists.

## License

Proprietary / all rights reserved unless otherwise noted by the author.
