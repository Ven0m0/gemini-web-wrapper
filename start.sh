#!/usr/bin/env bash

set -euo pipefail
shopt -s nullglob globstar
IFS=$'\n\t'
LC_ALL=C

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly SCRIPT_DIR

SERVER="${SERVER:-${SCRIPT_DIR}/server.py}"
readonly SERVER

err() {
  printf '%s\n' "$*" >&2
}

die() {
  err "$@"
  exit 1
}

[[ -f "$SERVER" ]] || die "server.py not found: $SERVER"
command -v python3 >/dev/null 2>&1 || die "python3 not found in PATH"

if [[ "${SKIP_FRONTEND_BUILD:-0}" != "1" ]]; then
  FRONTEND_DIR="${SCRIPT_DIR}/frontend"
  FRONTEND_DIST_DIR="${FRONTEND_DIST_DIR:-${FRONTEND_DIR}/dist}"

  if [[ -d "$FRONTEND_DIR" && ! -d "$FRONTEND_DIST_DIR" ]]; then
    if command -v npm >/dev/null 2>&1; then
      err "frontend build missing; building PWA assets…"

      if [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
        npm --prefix "$FRONTEND_DIR" ci
      fi

      npm --prefix "$FRONTEND_DIR" run build
    else
      err "npm not found; skipping frontend build (API-only mode)."
    fi
  fi
fi

exec python3 "$SERVER" "$@"
