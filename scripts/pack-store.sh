#!/usr/bin/env bash
# Build a Chrome Web Store ZIP from the repo root.
# Output: dist/extension-disabler-<version>-store.zip
#
# Included: manifest.json (no "key"), background.js, popup.html, popup.js,
# styles.css, images/
# Omitted: README, content.js, .git, .gitignore, _metadata/, and anything else.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to strip the manifest key" >&2
  exit 1
fi
if ! command -v zip >/dev/null 2>&1; then
  echo "zip is required" >&2
  exit 1
fi

VERSION="$(python3 -c 'import json; print(json.load(open("manifest.json", encoding="utf-8"))["version"])')"
case "$VERSION" in
  ""|*[!0-9.]*)
    echo "Unexpected manifest version: ${VERSION}" >&2
    exit 1
    ;;
esac

OUT_DIR="${ROOT}/dist"
OUT_ZIP="${OUT_DIR}/extension-disabler-${VERSION}-store.zip"
STAGE="$(mktemp -d)"

cleanup() {
  rm -rf "$STAGE"
}
trap cleanup EXIT

cp "${ROOT}/manifest.json" "${STAGE}/manifest.json"
cp "${ROOT}/background.js" "${STAGE}/background.js"
cp "${ROOT}/popup.html" "${STAGE}/popup.html"
cp "${ROOT}/popup.js" "${STAGE}/popup.js"
cp "${ROOT}/styles.css" "${STAGE}/styles.css"
mkdir -p "${STAGE}/images"
cp "${ROOT}/images/"* "${STAGE}/images/"

python3 - "$STAGE/manifest.json" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as fh:
    manifest = json.load(fh)

if "key" in manifest:
    del manifest["key"]

if "key" in manifest:
    sys.exit("manifest still contains key")

with open(path, "w", encoding="utf-8", newline="\n") as fh:
    json.dump(manifest, fh, indent=2)
    fh.write("\n")
PY

mkdir -p "$OUT_DIR"
rm -f "$OUT_ZIP"

(
  cd "$STAGE"
  zip -r -X "$OUT_ZIP" . \
    -x "*.DS_Store" \
    -x "*/.DS_Store" \
    -x "_metadata/*" \
    -x ".git/*" \
    -x ".gitignore" \
    -x "README.md" \
    -x "content.js"
)

python3 - "$OUT_ZIP" <<'PY'
import json
import sys
import zipfile

path = sys.argv[1]
allowed = {
    "manifest.json",
    "background.js",
    "popup.html",
    "popup.js",
    "styles.css",
}
with zipfile.ZipFile(path) as zf:
    names = [info.filename for info in zf.infolist() if not info.is_dir()]
    bad = []
    for name in names:
        if name in allowed or name.startswith("images/"):
            if name.endswith("/") or "/." in name or name.startswith("."):
                bad.append(name)
            continue
        bad.append(name)
    if bad:
        sys.exit("unexpected store ZIP entries: " + ", ".join(bad))
    missing = sorted(item for item in allowed if item not in names)
    images = [name for name in names if name.startswith("images/")]
    if missing or not images:
        sys.exit(
            "store ZIP missing files: "
            + ", ".join(missing + ([] if images else ["images/*"]))
        )
    manifest = json.loads(zf.read("manifest.json"))
    if "key" in manifest:
        sys.exit("packaged manifest still contains key")
    if not manifest.get("version"):
        sys.exit("packaged manifest has no version")
PY

echo "Wrote ${OUT_ZIP}"
