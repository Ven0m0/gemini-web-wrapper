#!/usr/bin/env bash
# shellcheck enable=all shell=bash source-path=SCRIPTDIR
set -euo pipefail; shopt -s nullglob globstar
IFS=$'\n\t' LC_ALL=C
# Paths
SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly SERVER="${$SCRIPT_DIR/server.py:-server.py}"
err(){ printf '%s\n' "$*" >&2; }
die(){ err "$@"; exit 1; }
[[ -f $SERVER ]] || die "Scanner not found: $SERVER"
command -v python3 &>/dev/null || die "python3 not found in PATH"

exec python3 "$SERVER" "$@"
exec cloudflared tunnel --url http://localhost:9000
