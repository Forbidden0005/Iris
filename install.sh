#!/usr/bin/env bash
# Iris — first-time install script for macOS
# Usage: bash install.sh
#   bash install.sh --non-interactive   # CI / headless mode — skips prompts, configurable via env vars
#   bash install.sh --help
# Or via curl: bash <(curl -fsSL https://raw.githubusercontent.com/Iris/Iris/main/install.sh)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IRIS_DIR="$HOME/.iris"

# ── Non-interactive / CI mode ─────────────────────────────────────────────────
NON_INTERACTIVE=0
for _arg in "$@"; do
  if [[ "$_arg" == "--help" || "$_arg" == "-h" ]]; then
    cat <<'EOF'
Iris installer

Usage:
  bash install.sh
  bash install.sh --non-interactive

Non-interactive environment variables:
  IRIS_BUILD_CREWCHAT=1         Build irischat.app on macOS if swiftc is available
  IRIS_SETUP_TELEGRAM=1         Enable Telegram setup; requires TELEGRAM_BOT_TOKEN
  TELEGRAM_BOT_TOKEN=...             Telegram bot token for non-interactive setup
  IRIS_SETUP_WHATSAPP=1         Enable WhatsApp setup
  IRIS_WHATSAPP_NUMBER=...      WhatsApp allowlisted number in international format
  IRIS_WHATSAPP_NAME=...        Display name for the WhatsApp owner/contact
  IRIS_ENABLE_AUTONOMOUS=1      Enable background consciousness mode
  IRIS_AUTONOMOUS_MINUTES=15    Background consciousness interval in minutes
  IRIS_SETUP_MCP=1              Write MCP configs for Cursor / Claude Code / OpenCode
  IRIS_INSTALL_CLIS=all        Install missing coding CLIs (opencode,codex,claude,gemini,cursor,iris-cli,all,n)
  IRIS_START_NOW=1              Start the local Iris stack after install

Typical one-file local install:
  bash <(curl -fsSL https://raw.githubusercontent.com/Forbidden0005/Iris/main/install.sh)

Typical headless install:
  IRIS_SETUP_MCP=1 IRIS_START_NOW=1 bash install.sh --non-interactive
EOF
    exit 0
  fi
  [[ "$_arg" == "--non-interactive" || "$_arg" == "--ci" ]] && NON_INTERACTIVE=1
done
# Also auto-detect CI environments
[[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]] && NON_INTERACTIVE=1

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}▶${RESET} $*"; }
success() { echo -e "${GREEN}✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET} $*"; }
skip()    { echo -e "  ${YELLOW}–${RESET} $*"; }
error()   { echo -e "${RED}✗${RESET} $*"; exit 1; }
header()  { echo -e "\n${BOLD}$*${RESET}"; }

# Portable in-place sed: BSD/macOS sed requires `-i ''`, GNU sed (Linux, Git
# Bash on Windows) treats a detached '' as the script and the real script as
# the filename, so `sed -i '' "s|...|" file` silently fails on GNU sed with
# "can't read s|...|: No such file or directory". Detect via a real capability
# probe rather than uname, since Git Bash reports MINGW/MSYS, not Linux/Darwin.
sed_inplace() {
  local script="$1"; shift
  if sed --version >/dev/null 2>&1; then
    sed -i "$script" "$@"      # GNU sed
  else
    sed -i '' "$script" "$@"   # BSD/macOS sed
  fi
}

header "╔════════════════════════════════╗"
header "║     Iris  Installer       ║"
header "╚════════════════════════════════╝"
echo ""

# ── 1. Check Node.js ─────────────────────────────────────────────────────────
header "1/7  Checking prerequisites"

if ! command -v node &>/dev/null; then
  warn "Node.js not found."
  echo ""
  echo "  Install Node.js 20+ from https://nodejs.org  (or via Homebrew):"
  echo "    brew install node"
  echo ""
  error "Please install Node.js 20+ and re-run this script."
fi

NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 20 ]]; then
  error "Node.js 20+ required (found v$NODE_VERSION). Update from https://nodejs.org"
fi
success "Node.js $(node --version)"

if ! command -v npm &>/dev/null; then
  error "npm not found. Reinstall Node.js from https://nodejs.org"
fi
success "npm $(npm --version)"

# ── 2. npm install ───────────────────────────────────────────────────────────
header "2/7  Installing Node dependencies"
cd "$REPO_DIR"
npm install --silent
success "npm packages installed"

# ── 3. Create config directories ─────────────────────────────────────────────
header "3/7  Setting up config directories"

mkdir -p "$IRIS_DIR"
mkdir -p "$IRIS_DIR/chat-history"
mkdir -p "$IRIS_DIR/logs"
mkdir -p "$IRIS_DIR/sessions"
mkdir -p "$IRIS_DIR/telemetry"
mkdir -p "$IRIS_DIR/pids"
mkdir -p "$IRIS_DIR/orchestrator-logs"
mkdir -p "$IRIS_DIR/workspace"
mkdir -p "$IRIS_DIR/shared-memory/.iris/agent-memory"
mkdir -p "$IRIS_DIR/shared-memory/.iris/collections"
success "Created ~/.iris and runtime directories"

# ── 4. Bootstrap config files ────────────────────────────────────────────────
header "4/7  Bootstrapping config files"

CONFIG_FILE="$IRIS_DIR/config.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
  RT_TOKEN="iris-$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 16 || true)"
  cat > "$CONFIG_FILE" <<EOF
{
  "_note": "RT bus auth token — do not share. Providers and agents are in iris.json",
  "rt": {
    "authToken": "$RT_TOKEN"
  }
}
EOF
  success "Created ~/.iris/config.json  (RT token: $RT_TOKEN)"
else
  success "~/.iris/iris.json already exists — keeping it"
fi

IRIS_JSON="$IRIS_DIR/iris.json"
if [[ ! -f "$IRIS_JSON" ]]; then
  cat > "$IRIS_JSON" <<'EOF'
{
  "_note": "Iris agent config — edit models and providers here. All agents default to Groq (free). Swap any model to your preferred provider once you add API keys.",
  "agents": [
    { "id": "iris-lead",         "model": "groq/llama-3.3-70b-versatile", "_note": "Stinki — conversational commander. Runs on port 5010." },
    { "id": "iris-main",         "model": "groq/llama-3.3-70b-versatile", "_note": "General coordinator, fallback agent" },
    { "id": "iris-pm",           "model": "groq/llama-3.3-70b-versatile", "_note": "Planning, roadmaps, task breakdown" },
    { "id": "iris-pm-cli",       "model": "groq/llama-3.3-70b-versatile", "_note": "Domain PM for CLI tools and command-line interfaces" },
    { "id": "iris-pm-frontend",  "model": "groq/llama-3.3-70b-versatile", "_note": "Domain PM for web UI and dashboard components" },
    { "id": "iris-pm-core",      "model": "groq/llama-3.3-70b-versatile", "_note": "Domain PM for core orchestration and agent runtime" },
    { "id": "iris-coder",        "model": "groq/llama-3.3-70b-versatile", "_note": "Full-stack coding" },
    { "id": "iris-coder-front",  "model": "groq/llama-3.3-70b-versatile", "_note": "Frontend / HTML / CSS / JS" },
    { "id": "iris-coder-back",   "model": "groq/llama-3.3-70b-versatile", "_note": "Backend / API / database" },
    { "id": "iris-frontend",     "model": "groq/llama-3.3-70b-versatile", "_note": "CSS / design polish" },
    { "id": "iris-qa",           "model": "groq/llama-3.3-70b-versatile", "_note": "Testing and QA audits" },
    { "id": "iris-fixer",        "model": "groq/llama-3.3-70b-versatile", "_note": "Bug fixing, root cause analysis" },
    { "id": "iris-security",     "model": "groq/llama-3.3-70b-versatile", "_note": "Security audits" },
    { "id": "iris-github",       "model": "groq/llama-3.3-70b-versatile", "_note": "Git commits, branches, PRs" },
    { "id": "iris-copywriter",   "model": "groq/llama-3.3-70b-versatile", "_note": "Writing, docs, marketing copy" },
    { "id": "iris-seo",          "model": "groq/llama-3.3-70b-versatile", "_note": "SEO, structured data, performance" },
    { "id": "iris-researcher",   "model": "groq/llama-3.3-70b-versatile", "_note": "Web research and analysis — swap to perplexity/sonar for best results" },
    { "id": "iris-mega",         "model": "groq/llama-3.3-70b-versatile", "_note": "High-performance generalist — swap to a frontier model (claude, gpt-4o) for heavy tasks" },
    { "id": "iris-architect",    "model": "groq/llama-3.3-70b-versatile", "_note": "Project structure, path enforcement, correctness" },
    { "id": "iris-ml",           "model": "groq/llama-3.3-70b-versatile", "_note": "AI/ML pipelines and data work" },
    { "id": "orchestrator",      "model": "groq/llama-3.3-70b-versatile", "_note": "PM-loop orchestrator — reads roadmaps and routes tasks" },
    { "id": "iris-judge",        "model": "groq/llama-3.3-70b-versatile", "_note": "Cycle decision maker — evaluates PM loop progress and decides CONTINUE/SHIP/RESET" }
  ],
  "providers": {
    "groq":        { "apiKey": "", "baseUrl": "https://api.groq.com/openai/v1" },
    "anthropic":   { "apiKey": "", "baseUrl": "https://api.anthropic.com/v1" },
    "openai":      { "apiKey": "", "baseUrl": "https://api.openai.com/v1" },
    "xai":         { "apiKey": "", "baseUrl": "https://api.x.ai/v1" },
    "deepseek":    { "apiKey": "", "baseUrl": "https://api.deepseek.com/v1" },
    "mistral":     { "apiKey": "", "baseUrl": "https://api.mistral.ai/v1" },
    "cerebras":    { "apiKey": "", "baseUrl": "https://api.cerebras.ai/v1" },
    "perplexity":  { "apiKey": "", "baseUrl": "https://api.perplexity.ai" },
    "nvidia":      { "apiKey": "", "baseUrl": "https://integrate.api.nvidia.com/v1" },
    "google":      { "apiKey": "", "baseUrl": "https://generativelanguage.googleapis.com/v1beta/openai" },
    "openrouter":  { "apiKey": "", "baseUrl": "https://openrouter.ai/api/v1" },
    "fireworks":   { "apiKey": "", "baseUrl": "https://api.fireworks.ai/inference/v1" },
    "together":    { "apiKey": "", "baseUrl": "https://api.together.xyz/v1" },
    "huggingface": { "apiKey": "", "baseUrl": "https://api-inference.huggingface.co/v1" },
    "venice":      { "apiKey": "", "baseUrl": "https://api.venice.ai/api/v1" },
    "moonshot":    { "apiKey": "", "baseUrl": "https://api.moonshot.cn/v1" },
    "minimax":     { "apiKey": "", "baseUrl": "https://api.minimax.chat/v1" },
    "volcengine":  { "apiKey": "", "baseUrl": "https://ark.cn-beijing.volces.com/api/v3" },
    "qianfan":     { "apiKey": "", "baseUrl": "https://aip.baidubce.com/rpc/2.0/ai_custom/v1" },
    "vllm":        { "apiKey": "none", "baseUrl": "http://localhost:8000/v1" },
    "sglang":      { "apiKey": "none", "baseUrl": "http://localhost:30000/v1" },
    "ollama":      { "apiKey": "ollama", "baseUrl": "http://localhost:11434/v1" }
  }
}
EOF
  success "Created ~/.iris/iris.json  (all agents on Groq Llama 3.3 70B — add your key to start)"

  # Migrate API keys from OpenClaw if available
  OPENCLAW_CFG="$HOME/.openclaw/openclaw.json"
  if [[ -f "$OPENCLAW_CFG" ]]; then
    info "Found OpenClaw config at ~/.openclaw/openclaw.json — migrating API keys..."
    node -e "
      const fs = require('fs');
      const oc = JSON.parse(fs.readFileSync('$OPENCLAW_CFG', 'utf8'));
      const cs = JSON.parse(fs.readFileSync('$IRIS_JSON', 'utf8'));
      const providerMap = {
        groq: 'groq', anthropic: 'anthropic', openai: 'openai',
        xai: 'xai', deepseek: 'deepseek', mistral: 'mistral',
        google: 'google', perplexity: 'perplexity', nvidia: 'nvidia',
        cerebras: 'cerebras', ollama: 'ollama', openrouter: 'openrouter',
        together: 'together', huggingface: 'huggingface', venice: 'venice',
        moonshot: 'moonshot', minimax: 'minimax', volcengine: 'volcengine',
        qianfan: 'qianfan', fireworks: 'fireworks'
      };
      let migrated = 0;
      for (const [ocId, ocCfg] of Object.entries(oc.providers || {})) {
        const key = ocCfg.apiKey || ocCfg.key || '';
        const csId = providerMap[ocId] || ocId;
        if (key && cs.providers?.[csId] && !cs.providers[csId].apiKey) {
          cs.providers[csId].apiKey = key;
          migrated++;
        }
      }
      if (migrated > 0) {
        fs.writeFileSync('$IRIS_JSON', JSON.stringify(cs, null, 2));
        console.log('MIGRATED:' + migrated);
      }
    " 2>/dev/null && {
      MIGRATED_COUNT=$(node -e "
        const fs = require('fs');
        const oc = JSON.parse(fs.readFileSync('$OPENCLAW_CFG', 'utf8'));
        let c = 0;
        for (const [, v] of Object.entries(oc.providers || {})) { if (v.apiKey || v.key) c++; }
        console.log(c);
      " 2>/dev/null || echo "0")
      success "Migrated $MIGRATED_COUNT API key(s) from OpenClaw"
    } || true
  fi
else
  success "~/.iris/iris.json already exists — keeping it"
fi

# Bootstrap skills directory with starter skill definitions
SKILLS_DIR="$IRIS_DIR/skills"
mkdir -p "$SKILLS_DIR"
if [[ -d "$REPO_DIR/skills" ]]; then
  for f in "$REPO_DIR/skills"/*.json; do
    [[ -f "$f" ]] || continue
    dest="$SKILLS_DIR/$(basename "$f")"
    cp "$f" "$dest"
  done
  success "Skills synced to ~/.iris/skills/"
fi

# Bootstrap engines directory with bundled engine descriptors
ENGINES_DIR="$IRIS_DIR/engines"
mkdir -p "$ENGINES_DIR"
if [[ -d "$REPO_DIR/engines" ]]; then
  for f in "$REPO_DIR/engines"/*.json; do
    [[ -f "$f" ]] || continue
    dest="$ENGINES_DIR/$(basename "$f")"
    cp "$f" "$dest"
  done
  success "Engines synced to ~/.iris/engines/"
fi

# Initialize contacts and collections databases
if [[ -f "$REPO_DIR/lib/contacts/index.mjs" ]]; then
  node -e "
    import('$REPO_DIR/lib/contacts/index.mjs').then(m => {
      // DB auto-initializes on import
      console.log('✓ Contacts database initialized');
    }).catch(() => {});
  " 2>/dev/null && success "Contacts database initialized (contacts.db)" || true
fi

if [[ -f "$REPO_DIR/lib/collections/index.mjs" ]]; then
  node -e "
    import('$REPO_DIR/lib/collections/index.mjs').then(m => {
      // DB auto-initializes on import
      console.log('✓ Collections database initialized');
    }).catch(() => {});
  " 2>/dev/null && success "Collections database initialized (collections.db)" || true
fi

# Bootstrap agent prompts if not present (try repo config/prompts/ dir, or empty default)
PROMPTS_FILE="$IRIS_DIR/agent-prompts.json"
if [[ ! -f "$PROMPTS_FILE" ]]; then
  if [[ -f "$REPO_DIR/config/agent-prompts.json" ]]; then
    cp "$REPO_DIR/config/agent-prompts.json" "$PROMPTS_FILE"
    success "Copied config/agent-prompts.json to ~/.iris/"
  else
    echo '{}' > "$PROMPTS_FILE"
    success "Created ~/.iris/agent-prompts.json"
    if [[ -d "$REPO_DIR/prompts" ]] && [[ -n "$(find "$REPO_DIR/prompts" -maxdepth 1 -name '*.md' 2>/dev/null)" ]]; then
      (cd "$REPO_DIR" && node scripts/sync-prompts.mjs 2>/dev/null) && success "Seeded agent prompts from repo prompts/*.md" || true
    fi
  fi
fi

ALLOWLIST="$IRIS_DIR/cmd-allowlist.json"
if [[ ! -f "$ALLOWLIST" ]]; then
  echo '{"patterns":["npm *","node *","npx *"]}' > "$ALLOWLIST"
  success "Created ~/.iris/cmd-allowlist.json  (npm, node, npx pre-approved)"
fi

TOKEN_FILE="$IRIS_DIR/token-usage.json"
if [[ ! -f "$TOKEN_FILE" ]]; then
  echo '{"calls":0,"promptTokens":0,"completionTokens":0,"totalTokens":0,"estimatedCostUSD":0,"byModel":{}}' > "$TOKEN_FILE"
fi

# ── 5. Shell alias ────────────────────────────────────────────────────────────
header "5/7  Shell alias"

SHELL_RC=""
if [[ "$SHELL" == *"zsh"* ]]; then
  SHELL_RC="$HOME/.zshrc"
elif [[ "$SHELL" == *"bash"* ]]; then
  SHELL_RC="$HOME/.bash_profile"
fi

BIN_ALIAS="alias iris-cli='node $REPO_DIR/iris-cli/dist/iris.mjs'"
if [[ -n "$SHELL_RC" ]] && ! grep -q "iris-cli" "$SHELL_RC" 2>/dev/null; then
  echo "" >> "$SHELL_RC"
  echo "# Iris" >> "$SHELL_RC"
  echo "$BIN_ALIAS" >> "$SHELL_RC"
  success "Added iris-cli alias to $SHELL_RC"
else
  success "iris-cli alias already set"
fi

# ── 6. Optional extras ────────────────────────────────────────────────────────
header "6/7  Optional extras"

# ── 6a. SwiftBar menu bar plugin ─────────────────────────────────────────────
SWIFTBAR_PLUGIN_DIR="$HOME/Library/Application Support/SwiftBar/Plugins"
SWIFTBAR_APP="/Applications/SwiftBar.app"
SWIFTBAR_SRC="$REPO_DIR/contrib/swiftbar/openswitch.10s.sh"

if [[ -d "$SWIFTBAR_APP" ]] || [[ -d "$HOME/Applications/SwiftBar.app" ]]; then
  if mkdir -p "$SWIFTBAR_PLUGIN_DIR" 2>/dev/null && \
     cp "$SWIFTBAR_SRC" "$SWIFTBAR_PLUGIN_DIR/openswitch.10s.sh" 2>/dev/null; then
    chmod +x "$SWIFTBAR_PLUGIN_DIR/openswitch.10s.sh"
    sed_inplace "s|^IRIS_DIR=.*|IRIS_DIR=\"$REPO_DIR\"|" \
      "$SWIFTBAR_PLUGIN_DIR/openswitch.10s.sh" 2>/dev/null || true
    success "SwiftBar plugin installed → menu bar status active"
  else
    warn "SwiftBar found but couldn't write plugin (permission issue?)"
    echo "    Manual install: cp contrib/swiftbar/openswitch.10s.sh \"$SWIFTBAR_PLUGIN_DIR/\""
  fi
else
  skip "SwiftBar not installed — skipping menu bar plugin"
  echo "    Install SwiftBar (free): https://swiftbar.app  then re-run install.sh"
fi

# ── 6b. irischat macOS app ────────────────────────────────────────────────────
if command -v swiftc &>/dev/null; then
  if [[ "$NON_INTERACTIVE" -eq 1 ]]; then
    BUILD_CHAT="${IRIS_BUILD_CREWCHAT:-N}"
  else
    echo -n "  Build irischat.app (native macOS chat window)? [Y/n] "
    read -r BUILD_CHAT
    BUILD_CHAT="${BUILD_CHAT:-Y}"
  fi
  if [[ "$BUILD_CHAT" =~ ^[Yy] ]]; then
    mkdir -p "$HOME/bin"
    APP_DIR="$HOME/Applications/irischat.app"
    mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"

    swiftc -framework AppKit -framework Foundation \
      -o "$APP_DIR/Contents/MacOS/irischat" \
      "$REPO_DIR/apps/irischat/IrisChat.swift" 2>/dev/null
    chmod +x "$APP_DIR/Contents/MacOS/irischat"

    # Write minimal Info.plist
    cat > "$APP_DIR/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>irischat</string>
  <key>CFBundleIdentifier</key><string>ai.iris.irischat</string>
  <key>CFBundleName</key><string>irischat</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST

    # Build icon if sips + iconutil available and favicon exists
    FAVICON="$REPO_DIR/website/favicon.png"
    if [[ -f "$FAVICON" ]] && command -v iconutil &>/dev/null; then
      ICONSET="/tmp/irischat.iconset"
      mkdir -p "$ICONSET"
      for SIZE in 16 32 64 128 256 512; do
        sips -z $SIZE $SIZE "$FAVICON" \
          --out "$ICONSET/icon_${SIZE}x${SIZE}.png" &>/dev/null || true
        sips -z $((SIZE*2)) $((SIZE*2)) "$FAVICON" \
          --out "$ICONSET/icon_${SIZE}x${SIZE}@2x.png" &>/dev/null || true
      done
      iconutil -c icns "$ICONSET" \
        -o "$APP_DIR/Contents/Resources/irischat.icns" 2>/dev/null || true
    fi

    touch "$APP_DIR"
    success "irischat.app built → ~/Applications/irischat.app"
    echo "    Launch: open ~/Applications/irischat.app"
  else
    skip "Skipping irischat build"
  fi
else
  skip "Xcode Command Line Tools not found — skipping irischat build"
  echo "    Install CLT: xcode-select --install  then re-run install.sh"
fi

# ── 6c. Telegram bot ─────────────────────────────────────────────────────────
echo ""
if [[ "$NON_INTERACTIVE" -eq 1 ]]; then
  SETUP_TG="${IRIS_SETUP_TELEGRAM:-N}"
else
  echo -n "  Set up Telegram bot? [y/N] "
  read -r SETUP_TG
fi
SETUP_TG="${SETUP_TG:-N}"
if [[ "$SETUP_TG" =~ ^[Yy] ]]; then
  echo ""
  echo "  1. Open Telegram and message @BotFather → /newbot"
  echo "  2. Copy the token it gives you, paste below:"
  if [[ "$NON_INTERACTIVE" -eq 1 ]]; then
    TG_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
  else
    echo -n "  Bot token: "
    read -r TG_TOKEN
  fi
  if [[ -n "$TG_TOKEN" ]]; then
    # Add to .env if it exists, otherwise write one
    ENV_FILE="$REPO_DIR/.env"
    if [[ -f "$ENV_FILE" ]] && grep -q "TELEGRAM_BOT_TOKEN" "$ENV_FILE"; then
      sed_inplace "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$TG_TOKEN|" "$ENV_FILE"
    else
      echo "" >> "$ENV_FILE"
      echo "TELEGRAM_BOT_TOKEN=$TG_TOKEN" >> "$ENV_FILE"
    fi
    # Create telegram-bridge.json config file
    TG_CFG="$IRIS_DIR/telegram-bridge.json"
    cat > "$TG_CFG" <<EOF
{
  "token": "$TG_TOKEN",
  "targetAgent": "iris-lead",
  "topicRouting": {},
  "userRouting": {}
}
EOF
    success "Telegram token saved to .env"
    success "Telegram config saved to ~/.iris/telegram-bridge.json"
    echo "    Configure topic routing in Dashboard → Comms tab"
    echo "    Start bridge: npm run telegram"
  else
    skip "No token entered — skipping Telegram"
  fi
else
  skip "Skipping Telegram (add TELEGRAM_BOT_TOKEN=xxx to .env later)"
fi

# ── 6d. WhatsApp bridge ───────────────────────────────────────────────────────
echo ""
if [[ "$NON_INTERACTIVE" -eq 1 ]]; then
  SETUP_WA="${IRIS_SETUP_WHATSAPP:-N}"
else
  echo -n "  Set up WhatsApp bridge? [y/N] "
  read -r SETUP_WA
fi
SETUP_WA="${SETUP_WA:-N}"
if [[ "$SETUP_WA" =~ ^[Yy] ]]; then
  echo ""
  echo "  WhatsApp uses your personal number as a linked device (no business account needed)."
  if [[ "$NON_INTERACTIVE" -eq 1 ]]; then
    WA_NUMBER="${IRIS_WHATSAPP_NUMBER:-}"
    WA_NAME="${IRIS_WHATSAPP_NAME:-Owner}"
  else
    echo -n "  Your WhatsApp number in international format (e.g. 14155552671), or leave blank to allow anyone: "
    read -r WA_NUMBER
    echo -n "  Your name (so the iris knows who you are, e.g. Jeff): "
    read -r WA_NAME
  fi

  WA_CFG="$IRIS_DIR/whatsapp-bridge.json"
  if [[ -n "$WA_NUMBER" ]]; then
    ALLOWED_JSON="[\"$WA_NUMBER\"]"
    CONTACTS_JSON="{\"$WA_NUMBER\":\"${WA_NAME:-Owner}\"}"
  else
    ALLOWED_JSON="[]"
    CONTACTS_JSON="{}"
  fi

  cat > "$WA_CFG" <<EOF
{
  "allowedNumbers": $ALLOWED_JSON,
  "contactNames": $CONTACTS_JSON,
  "targetAgent": "iris-lead"
}
EOF
  success "WhatsApp config saved to ~/.iris/whatsapp-bridge.json"
  echo "    Start bridge: npm run whatsapp"
  echo "    Then scan the QR code with WhatsApp → Linked Devices → Link a Device"
  echo "    Bridge runs on port 5015. Messages route to iris-lead automatically."
else
  skip "Skipping WhatsApp (run 'npm run whatsapp' later and scan QR to activate)"
fi

# ── 6d2. CLI detection and install (OpenCode, Codex, Claude, Gemini, Cursor, iris-cli) ───
echo ""
cli_installed() { command -v "$1" &>/dev/null || [[ -f "$2" ]]; }
OPENCODE_OK=$(cli_installed opencode "" && echo 1 || echo 0)
CODEX_OK=$(cli_installed codex "" && echo 1 || echo 0)
CLAUDE_OK=$(cli_installed claude "" && echo 1 || echo 0)
GEMINI_OK=$(cli_installed gemini "" && echo 1 || echo 0)
CURSOR_OK=0
[[ -f "$HOME/.local/bin/agent" ]] || command -v agent &>/dev/null || command -v cursor &>/dev/null && CURSOR_OK=1
IRIS_CLI_OK=$([[ -f "$REPO_DIR/iris-cli/bin/iris.js" ]] && echo 1 || echo 0)

echo "  Coding CLI status:"
printf "    %-12s %s\n" "OpenCode"   "$([[ $OPENCODE_OK -eq 1 ]] && echo -e "${GREEN}✓ installed${RESET}" || echo -e "${YELLOW}not found${RESET}")"
printf "    %-12s %s\n" "Codex"      "$([[ $CODEX_OK -eq 1 ]] && echo -e "${GREEN}✓ installed${RESET}" || echo -e "${YELLOW}not found${RESET}")"
printf "    %-12s %s\n" "Claude"     "$([[ $CLAUDE_OK -eq 1 ]] && echo -e "${GREEN}✓ installed${RESET}" || echo -e "${YELLOW}not found${RESET}")"
printf "    %-12s %s\n" "Gemini"     "$([[ $GEMINI_OK -eq 1 ]] && echo -e "${GREEN}✓ installed${RESET}" || echo -e "${YELLOW}not found${RESET}")"
printf "    %-12s %s\n" "Cursor"     "$([[ $CURSOR_OK -eq 1 ]] && echo -e "${GREEN}✓ installed${RESET}" || echo -e "${YELLOW}not found${RESET}")"
printf "    %-12s %s\n" "iris-cli"   "$([[ $IRIS_CLI_OK -eq 1 ]] && echo -e "${GREEN}✓ built${RESET}" || echo -e "${YELLOW}not built${RESET}")"

MISSING_CLIS=()
[[ $OPENCODE_OK -eq 0 ]] && MISSING_CLIS+=(opencode)
[[ $CODEX_OK -eq 0 ]] && MISSING_CLIS+=(codex)
[[ $CLAUDE_OK -eq 0 ]] && MISSING_CLIS+=(claude)
[[ $GEMINI_OK -eq 0 ]] && MISSING_CLIS+=(gemini)
[[ $CURSOR_OK -eq 0 ]] && MISSING_CLIS+=(cursor)
[[ $IRIS_CLI_OK -eq 0 ]] && MISSING_CLIS+=(iris-cli)
TO_INSTALL=()

if [[ ${#MISSING_CLIS[@]} -gt 0 ]]; then
  if [[ "$NON_INTERACTIVE" -eq 1 ]]; then
    INSTALL_CLIS="${IRIS_INSTALL_CLIS:-N}"
  else
    echo ""
    echo -n "  Install missing CLIs? (opencode|codex|claude|gemini|cursor|iris-cli|all|n) [n] "
    read -r INSTALL_CLIS
  fi
  INSTALL_CLIS="${INSTALL_CLIS:-n}"
  if [[ "$INSTALL_CLIS" =~ ^[Aa]ll$ ]]; then
    TO_INSTALL=("${MISSING_CLIS[@]}")
  elif [[ -n "$INSTALL_CLIS" && "$INSTALL_CLIS" != "n" && "$INSTALL_CLIS" != "N" ]]; then
    TO_INSTALL=()
    for c in $(echo "$INSTALL_CLIS" | tr ',' ' '); do
      c=$(echo "$c" | tr '[:upper:]' '[:lower:]')
      if [[ " opencode codex claude gemini cursor iris-cli " == *" $c "* ]]; then
        TO_INSTALL+=("$c")
      fi
    done
  else
    TO_INSTALL=()
  fi

  for c in "${TO_INSTALL[@]-}"; do
    [[ -z "$c" ]] && continue
    case "$c" in
      opencode)
        info "Installing OpenCode CLI..."
        npm install -g @opencode-ai/cli 2>/dev/null && success "OpenCode installed" || warn "OpenCode install failed (try: npm install -g @opencode-ai/cli)"
        ;;
      codex)
        info "Installing Codex CLI..."
        npm install -g @openai/codex 2>/dev/null && success "Codex installed" || warn "Codex install failed (try: npm install -g @openai/codex)"
        ;;
      claude)
        info "Installing Claude Code CLI..."
        npm install -g @anthropic-ai/claude-code 2>/dev/null && success "Claude CLI installed" || warn "Claude install failed (try: npm install -g @anthropic-ai/claude-code)"
        ;;
      gemini)
        info "Installing Gemini CLI..."
        npm install -g @google/gemini-cli 2>/dev/null && success "Gemini CLI installed" || warn "Gemini install failed (try: npm install -g @google/gemini-cli)"
        ;;
      cursor)
        info "Installing Cursor CLI..."
        if curl -fsSL https://cursor.com/install | bash 2>/dev/null; then
          success "Cursor CLI installed"
        else
          warn "Cursor install failed (try: curl -fsSL https://cursor.com/install | bash)"
        fi
        ;;
      iris-cli)
        info "Building iris-cli..."
        if (cd "$REPO_DIR/iris-cli" && npm install --silent 2>/dev/null && npm run build 2>/dev/null); then
          success "iris-cli built"
        else
          warn "iris-cli build failed (try: cd iris-cli && npm install && npm run build)"
        fi
        ;;
    esac
  done
else
  success "All coding CLIs detected"
fi

# ── 6e. Autonomous / background consciousness ─────────────────────────────────
echo ""
if [[ "$NON_INTERACTIVE" -eq 1 ]]; then
  SETUP_AUTO="${IRIS_ENABLE_AUTONOMOUS:-N}"
else
  echo -n "  Enable autonomous mode? Iris-lead reflects between tasks and can self-initiate [y/N] "
  read -r SETUP_AUTO
fi
SETUP_AUTO="${SETUP_AUTO:-N}"
ENV_FILE="$REPO_DIR/.env"
if [[ "$SETUP_AUTO" =~ ^[Yy] ]]; then
  if [[ "$NON_INTERACTIVE" -eq 1 ]]; then
    AUTO_INTERVAL="${IRIS_AUTONOMOUS_MINUTES:-15}"
  else
    echo -n "  Check interval in minutes (default 15): "
    read -r AUTO_INTERVAL
  fi
  AUTO_INTERVAL="${AUTO_INTERVAL:-15}"
  AUTO_MS=$(( AUTO_INTERVAL * 60 * 1000 ))

  if [[ -f "$ENV_FILE" ]] && grep -q "IRIS_BG_CONSCIOUSNESS" "$ENV_FILE"; then
    sed_inplace "s|^IRIS_BG_CONSCIOUSNESS=.*|IRIS_BG_CONSCIOUSNESS=1|" "$ENV_FILE"
    sed_inplace "s|^IRIS_BG_CONSCIOUSNESS_INTERVAL_MS=.*|IRIS_BG_CONSCIOUSNESS_INTERVAL_MS=$AUTO_MS|" "$ENV_FILE"
  else
    echo "" >> "$ENV_FILE"
    echo "IRIS_BG_CONSCIOUSNESS=1" >> "$ENV_FILE"
    echo "IRIS_BG_CONSCIOUSNESS_INTERVAL_MS=$AUTO_MS" >> "$ENV_FILE"
  fi
  success "Autonomous mode enabled (every ${AUTO_INTERVAL}min) — saved to .env"
  echo "    iris-lead will reflect between tasks, suggest follow-ups, and monitor the iris."
else
  skip "Skipping autonomous mode (set IRIS_BG_CONSCIOUSNESS=1 in .env to enable later)"
fi

# ── 6f. MCP integration (Cursor / Claude Code / OpenCode) ────────────────────
echo ""
if [[ "$NON_INTERACTIVE" -eq 1 ]]; then
  SETUP_MCP="${IRIS_SETUP_MCP:-N}"
else
  echo -n "  Wire Iris agents into Cursor / Claude Code / OpenCode via MCP? [y/N] "
  read -r SETUP_MCP
fi
SETUP_MCP="${SETUP_MCP:-N}"
if [[ "$SETUP_MCP" =~ ^[Yy] ]]; then
  RT_TOKEN=$(node -e "try{const c=require('fs').readFileSync('$IRIS_DIR/config.json','utf8');console.log(JSON.parse(c).rt?.authToken||'')}catch{}" 2>/dev/null)
  upsert_mcp_config() {
    local mcp_file="$1"
    local client_name="$2"
    local mcp_dir
    mcp_dir="$(dirname "$mcp_file")"
    mkdir -p "$mcp_dir"

    if MCP_FILE="$mcp_file" RT_TOKEN="$RT_TOKEN" node <<'NODE'
const fs = require("fs");
const path = process.env.MCP_FILE;
const token = process.env.RT_TOKEN || "";

const serverEntry = {
  url: "http://127.0.0.1:5020/mcp",
  headers: { Authorization: `Bearer ${token}` }
};

let root = {};
if (fs.existsSync(path)) {
  const raw = fs.readFileSync(path, "utf8").trim();
  if (raw) {
    root = JSON.parse(raw);
  }
}

if (!root || typeof root !== "object" || Array.isArray(root)) {
  root = {};
}

if (!root.mcpServers || typeof root.mcpServers !== "object" || Array.isArray(root.mcpServers)) {
  root.mcpServers = {};
}

root.mcpServers.iris = serverEntry;
fs.writeFileSync(path, JSON.stringify(root, null, 2) + "\n", "utf8");
NODE
    then
      success "$client_name MCP configured → $mcp_file"
    else
      warn "Could not update $mcp_file automatically (invalid JSON). Please add iris manually."
    fi
  }

  # Cursor
  CURSOR_MCP="$HOME/.cursor/mcp.json"
  upsert_mcp_config "$CURSOR_MCP" "Cursor"
  echo "    restart Cursor to activate MCP tools"

  # Claude Code
  CLAUDE_MCP="$HOME/.claude/mcp.json"
  upsert_mcp_config "$CLAUDE_MCP" "Claude Code"

  # OpenCode
  OPENCODE_MCP="$HOME/.config/opencode/mcp.json"
  upsert_mcp_config "$OPENCODE_MCP" "OpenCode"

  echo ""
  echo "  Once configured, all 20 Iris agents are available as MCP tools in any project."
  echo "  MCP server runs on :5020 — start with: npm run restart-all"
else
  skip "Skipping MCP integration"
  echo "    To add later: see AGENTS.md → MCP Integration"
fi

# ── 7. Start now? ─────────────────────────────────────────────────────────────
header "7/7  Start Iris"
echo ""
echo -e "  ${BOLD}You need at least one API key to run agents.${RESET}"
echo "  Groq is free → https://console.groq.com  (takes 30 seconds)"
echo ""

HAS_KEY=0
if grep -qE '"apiKey":\s*"[^"]{8,}"' "$IRIS_JSON" 2>/dev/null; then
  HAS_KEY=1
fi

if [[ "$HAS_KEY" -eq 0 ]]; then
  warn "No API key found yet in ~/.iris/iris.json"
  echo "  You can start now and add a key in the dashboard → Providers tab."
  echo ""
fi

if [[ "$NON_INTERACTIVE" -eq 1 ]]; then
  START_NOW="${IRIS_START_NOW:-N}"
else
  echo -n "  Start Iris now? [Y/n] "
  read -r START_NOW
fi
START_NOW="${START_NOW:-Y}"

if [[ "$START_NOW" =~ ^[Yy] ]]; then
  echo ""
  info "Starting Iris..."
  bash "$REPO_DIR/scripts/restart-all-from-repo.sh" > /dev/null 2>&1 &

  echo ""
  info "Waiting for services..."
  echo ""

  wait_for() {
    local label="$1" url="$2" timeout=30 elapsed=0
    printf "  %-22s" "$label"
    while ! curl -sf "$url" > /dev/null 2>&1; do
      sleep 1; elapsed=$((elapsed + 1))
      [[ $elapsed -ge $timeout ]] && { echo -e "${RED}✗ timed out${RESET}"; return 1; }
    done
    echo -e "${GREEN}✓ up${RESET}  (${elapsed}s)"
  }

  # Portable TCP port check: `nc` isn't installed by default on Git Bash for
  # Windows, so a plain `nc -z` reports every port as closed regardless of
  # whether the service is actually up. Bash's own /dev/tcp pseudo-device
  # works the same way on Linux, macOS, and Git Bash/MSYS, so prefer it and
  # fall back to nc only if /dev/tcp isn't available for some reason.
  port_open() {
    local port="$1"
    if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
      exec 3>&- 3<&-
      return 0
    fi
    command -v nc >/dev/null 2>&1 && nc -z 127.0.0.1 "$port" 2>/dev/null
  }

  wait_for_port() {
    local label="$1" port="$2" timeout=30 elapsed=0
    printf "  %-22s" "$label"
    while ! port_open "$port"; do
      sleep 1; elapsed=$((elapsed + 1))
      [[ $elapsed -ge $timeout ]] && { echo -e "${RED}✗ timed out${RESET}"; return 1; }
    done
    echo -e "${GREEN}✓ up${RESET}  (${elapsed}s)"
  }

  wait_for_port "RT bus  :18889"   18889
  wait_for      "iris-lead :5010"  "http://127.0.0.1:5010/health"
  wait_for      "Dashboard :4319"  "http://127.0.0.1:4319"
  wait_for      "MCP/OpenAI :5020" "http://127.0.0.1:5020/health"

  BRIDGE_COUNT=$(pgrep -f "gateway-bridge.mjs" 2>/dev/null | wc -l | tr -d ' ')
  printf "  %-22s" "Agent bridges"
  if [[ "$BRIDGE_COUNT" -gt 0 ]]; then
    echo -e "${GREEN}✓ $BRIDGE_COUNT running${RESET}"
  else
    echo -e "${YELLOW}⚠ none detected yet${RESET}"
  fi

  echo ""
  echo -e "${GREEN}${BOLD}Iris is running!${RESET}"
  echo ""

  if [[ "$HAS_KEY" -eq 0 ]]; then
    echo -e "  ${YELLOW}${BOLD}Add an API key in Providers tab before chatting.${RESET}"
    echo ""
  fi

  echo "  Opening dashboard..."
  sleep 1
  open "http://127.0.0.1:4319" 2>/dev/null || true
  echo ""
  echo "  Logs: /tmp/openiris-rt-daemon.log  /tmp/iris-lead.log  /tmp/dashboard.log  /tmp/iris-mcp.log"
  echo "  Restart later: cd $REPO_DIR && npm run restart-all"
  echo ""
  echo "  OpenAI-compatible API (Open WebUI, LM Studio, Aider, etc.):"
  echo "    Base URL: http://127.0.0.1:5020/v1   API key: (any string)"
  echo "    Models:   http://127.0.0.1:5020/v1/models  (one per agent)"
  echo ""
else
  echo ""
  echo "  When ready:  cd $REPO_DIR && npm run restart-all"
  echo "  Then open:   http://127.0.0.1:4319"
  echo ""
fi
