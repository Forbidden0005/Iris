#!/usr/bin/env bash
# SwiftBar helper to restart services via the canonical restart script.
# Usage: swiftbar-restart-service.sh <service-id>

set -euo pipefail

SERVICE_ID="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IRIS_DIR="${IRIS_DIR:-${OPENCLAW_DIR:-$REPO_ROOT}}"
RESTART_SCRIPT="$IRIS_DIR/scripts/restart-service.sh"

if [[ -z "$SERVICE_ID" ]]; then
  echo "Usage: $0 <service-id>"
  echo "Valid IDs: rt-bus, agents, iris-lead, telegram, whatsapp, opencode, mcp, studio, studio-watch, dashboard, openclaw-gateway"
  exit 1
fi

exec bash "$RESTART_SCRIPT" "$SERVICE_ID"
