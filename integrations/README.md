# iris Integrations

> **Platform bridges** — Connect iris to Telegram, WhatsApp, MCP, and more

## What Lives Here

| File | What it does |
|------|--------------|
| `telegram-bridge.mjs` | Telegram bot (official Bot API) |
| `whatsapp-bridge.mjs` | WhatsApp bot (Baileys — personal account) |
| `mcp-server.mjs` | MCP server + OpenAI-compatible API (port 5020) |

## Telegram Bridge

**Official Telegram Bot API** — create a bot via BotFather, no phone number needed.

### Setup

1. Create bot via [@BotFather](https://t.me/BotFather)
2. Add token to `~/.iris/telegram-bridge.json`:
   ```json
   {"token": "8078407232:AAHVNzRnoUilRbIBjwh..."}
   ```
3. Start: `npm run telegram`
4. Test: Message your bot → `/start`

### Topic Routing (Supergroups)

**Different agents per topic in a single group.**

```json
{
  "topicRouting": {
    "-100XXXXXXXXXX": {
      "20": "iris-loco",
      "94": "iris-pm",
      "main": "iris-lead"
    }
  }
}
```

- Each topic = isolated conversation
- Topic agents can dispatch to specialists
- Role-based permissions (PM vs coder vs chat-only)

**Logs:** `~/.iris/logs/telegram-bridge.jsonl`

---

## WhatsApp Bridge

**Personal bot via Baileys** (WhatsApp Web automation) — your phone becomes a linked device.

### Setup

1. Start: `npm run whatsapp`
2. Scan QR code (WhatsApp → Linked Devices)
3. Auth persists in `~/.iris/whatsapp-auth/`

### Restrict Access

In `~/.iris/iris.json` → `env`:
```json
{"WA_ALLOWED_NUMBERS": "+15551234567,+15559876543"}
```

**Logs:** `~/.iris/logs/whatsapp-bridge.jsonl`

---

## MCP Server

**Model Context Protocol** server — exposes iris agents as MCP tools for:
- Cursor IDE
- Claude Code
- OpenCode
- Any MCP-compatible client

Also runs an **OpenAI-compatible API** for Open WebUI, etc.

### Ports

- **MCP endpoint:** `http://127.0.0.1:5020/mcp`
- **OpenAI API:** `http://127.0.0.1:5020/v1`

### Setup

Add to `~/.cursor/mcp.json` (or `~/.claude/mcp.json`, `~/.config/opencode/mcp.json`):

```json
{
  "mcpServers": {
    "iris": {
      "url": "http://127.0.0.1:5020/mcp",
      "headers": {
        "Authorization": "Bearer <your-rt-auth-token>"
      }
    }
  }
}
```

Get token: `cat ~/.iris/iris.json | python3 -c "import json,sys; print(json.load(sys.stdin)['rt']['authToken'])"`

### Available Tools

- `dispatch_agent` — Send task to any agent
- `list_agents` — List all agents and status
- `run_pipeline` — Multi-agent orchestration
- `chat_stinki` — Talk to iris-lead
- `iris_status` — Live system status
- `smart_dispatch` — Get execution plan before running
- `skill_*` — All 44 skills as MCP tools

**Start:** `npm run restart-all` (auto-starts MCP server)

---

## Universal Cross-Platform Systems

All bridges share:

### 1. Generic Collections (RAG Search)
TF-IDF + cosine similarity over structured data.

```javascript
import { createCollection } from '../lib/collections/index.mjs';
const venues = createCollection('venues');
venues.add({ title: "Thai Kitchen", content: "Pad Thai $14..." });
const results = venues.search("spicy curry", {tags: "vegan"}, 5);
```

### 2. Universal Contacts
Platform-agnostic user profiles (WhatsApp, Telegram, Web).

```javascript
import { trackContact, updatePreferences } from '../lib/contacts/index.mjs';
trackContact('whatsapp:15551234567@s.whatsapp.net', 'whatsapp', 'STOS');
updatePreferences('whatsapp:15551234567@s.whatsapp.net', {
  diet: "vegan",
  allergies: ["shellfish"]
});
```

**Database:** `~/.iris/contacts.db`

### 3. Preference Extraction
Auto-extract user preferences from conversation history.

```javascript
import { extractPreferences } from '../lib/preferences/extractor.mjs';
const prefs = await extractPreferences(history, llmCaller, 'food');
// Returns: {diet: "vegan", allergies: ["shellfish"], favCuisines: ["Thai"]}
```

---

## Running

```bash
# All bridges
npm run telegram &
npm run whatsapp &
npm run restart-all  # includes MCP server

# Individual
node integrations/telegram-bridge.mjs
node integrations/whatsapp-bridge.mjs
node integrations/mcp-server.mjs
```

## Environment Variables

**Telegram:**
- `TELEGRAM_BOT_TOKEN` — Bot token from BotFather

**WhatsApp:**
- `WA_ALLOWED_NUMBERS` — Comma-separated phone numbers
- `WA_HTTP_PORT` — HTTP server port (default: 5015)

**MCP:**
- `MCP_PORT` — Server port (default: 5020)

## Security

1. **Telegram allowlist:** `telegram-bridge.json → allowedChatIds`
2. **WhatsApp allowlist:** `WA_ALLOWED_NUMBERS` env var
3. **MCP auth:** Bearer token required for all requests
4. **Message logging:** All messages logged to `~/.iris/logs/`

## Troubleshooting

**Duplicate replies:** Multiple bridge instances running
```bash
pkill -f telegram-bridge.mjs
node integrations/telegram-bridge.mjs &
```

**WhatsApp QR expired:** Delete auth and re-scan
```bash
rm -rf ~/.iris/whatsapp-auth/
node integrations/whatsapp-bridge.mjs
```

**MCP not connecting:** Check token and restart Cursor/Claude Code

## License

MIT
