#!/usr/bin/env bash
set -euo pipefail
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME="$BASE_DIR/standalone/AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3.html"
if command -v xdg-open >/dev/null 2>&1; then xdg-open "$GAME"; elif command -v open >/dev/null 2>&1; then open "$GAME"; else printf "Open this file in a browser:\n%s\n" "$GAME"; fi
