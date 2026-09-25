# Extension Disabler for Localhost and websites

Chrome extension that temporarily disables other extensions on localhost and sites you choose — useful while developing or on pages where password managers / language tools get in the way.

**Chrome Web Store:** https://chromewebstore.google.com/detail/extension-disabler-for-lo/midacakbhnbiohpknjpnodiglekaedhm  
**Portfolio:** https://salvasc.dev/  
**Write-up:** https://medium.com/@sanchezcampossalvador/how-i-developed-a-chrome-extension-to-disable-other-extensions-tried-to-do-too-in-firefox-765c2f0902d9

## Status

Recovered from the Chrome Web Store install **v1.1.2** (Manifest V3) on 2026-09-25. Original git history was not found; this tree is the published package minus Chrome `_metadata`.

## Release notes

### 1.2.0

- Hostname matching is fixed so a site rule follows the host you entered.
- Extensions that were already enabled are restored after a site rule no longer applies.
- Store packaging leaves out the development `key` and files Chrome rejects.
- Settings can be imported and exported.

## Chrome Web Store ZIP

Upload a ZIP with the extension files at the archive root (`manifest.json` is not inside an extra folder). Include only:

- `manifest.json` **without** the `key` field (that key is for local unpacked loads; the store rejects it)
- `background.js`
- `popup.html` and `popup.js`
- `styles.css`
- `images/`

Do not include `_metadata/`, `.git`, `.gitignore`, `content.js`, or `README.md`. `content.js` is not referenced by the manifest. README stays in the repo.

From the repo root:

```bash
./scripts/pack-store.sh
```

The script copies those files into a temp directory, strips `key` from the manifest with Python, and writes `dist/extension-disabler-1.2.0-store.zip` (the filename uses the version in `manifest.json`).

Manual steps, if you are not using the script:

1. Copy `manifest.json`, `background.js`, `popup.html`, `popup.js`, `styles.css`, and `images/` into an empty directory.
2. Delete the `key` property from that copy of `manifest.json`.
3. From inside that directory, zip the contents (not the parent folder): `zip -r ../extension-disabler-1.2.0-store.zip .`
4. Check the listing: `manifest.json` is at the top level, and the archive has no `key`, `_metadata/`, `.git`, or `.gitignore`.

## Load unpacked (dev)

1. Open `chrome://extensions`
2. Enable Developer mode
3. **Load unpacked** → select this folder

## Release / store ZIP

The `key` field in `manifest.json` stays in this repo so an unpacked install keeps the same extension ID as the Chrome Web Store listing (`midacakbhnbiohpknjpnodiglekaedhm`). Never commit a `.pem` private key.

When you pack the ZIP that gets uploaded to the Web Store, leave out `key` and any `_metadata` directory. The store already holds the extension’s key, and it rejects packages that include either of those.

## Permissions

Uses `chrome.management` and `chrome.storage.sync` for site-based block lists.

## License

Proprietary / all rights reserved unless otherwise noted by the author.
