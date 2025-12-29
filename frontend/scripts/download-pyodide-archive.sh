#!/usr/bin/env bash
set -euo pipefail

# Download official Pyodide release tar.bz2 from GitHub and extract to public/vendor.
#
# Usage:
#   scripts/download-pyodide-archive.sh [VERSION] [core|full] [DEST_ROOT]
#
# Examples:
#   scripts/download-pyodide-archive.sh 0.28.2
#   scripts/download-pyodide-archive.sh 0.28.2 public/vendor/pyodide
#
# Resulting layout:
#   public/vendor/pyodide/<VERSION>/full/{pyodide.js, pyodide.mjs, pyodide.asm.wasm, repodata.json, pyodide-lock.json, python_stdlib.zip, packages/...}

VERSION="${1:-0.28.2}"
VARIANT="${2:-full}"
# Backward-compat: if $2 is a path, treat it as DEST_ROOT and keep VARIANT=full
if [ "$VARIANT" != "core" ] && [ "$VARIANT" != "full" ]; then
  DEST_ROOT="$VARIANT"
  VARIANT="full"
else
  DEST_ROOT="${3:-public/vendor/pyodide}"
fi
DEST_DIR="${DEST_ROOT}/${VERSION}/full"

command -v curl >/dev/null 2>&1 || { echo "error: curl is required" >&2; exit 1; }
command -v tar  >/dev/null 2>&1 || { echo "error: tar is required"  >&2; exit 1; }

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
ARCHIVE_PATH="${TMP_DIR}/pyodide-${VERSION}.tar.bz2"

mkdir -p "$DEST_DIR"

echo "Downloading Pyodide ${VERSION} (${VARIANT}) archive..."
archive_name="pyodide-${VERSION}.tar.bz2"
if [ "$VARIANT" = "core" ]; then
  archive_name="pyodide-core-${VERSION}.tar.bz2"
fi
urls=(
  "https://github.com/pyodide/pyodide/releases/download/${VERSION}/${archive_name}"
  "https://github.com/pyodide/pyodide/releases/download/pyodide-${VERSION}/${archive_name}"
)

downloaded=false
for url in "${urls[@]}"; do
  echo "-> $url"
  if curl -L --fail --retry 3 --compressed -o "$ARCHIVE_PATH" "$url"; then
    downloaded=true
    break
  else
    echo "warn: failed to download from $url" >&2
  fi
done

if [ "$downloaded" != true ]; then
  echo "error: unable to download pyodide-${VERSION}.tar.bz2 from known URLs" >&2
  exit 1
fi

echo "Extracting to ${DEST_DIR} ..."
tar -xjf "$ARCHIVE_PATH" --strip-components=1 -C "$DEST_DIR"

# Basic sanity check
if [ ! -f "${DEST_DIR}/pyodide.js" ] || [ ! -f "${DEST_DIR}/pyodide-lock.json" ]; then
  echo "error: extraction incomplete; core files missing in ${DEST_DIR}" >&2
  exit 1
fi

echo "Done. Pyodide ${VERSION} extracted to ${DEST_DIR}"
