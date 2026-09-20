# Iris Plugin for OpenClaw

Connects your OpenClaw agents to a local [Iris](https://github.com/crewswarm/crewswarm) multi-agent runtime.

Your OpenClaw agents gain three new tools — `iris_dispatch`, `iris_status`, and `iris_agents` — plus a `/iris` slash command and Gateway RPC methods. **No LLM credentials are shared** — only a single auth token.

---

## What it does

| Surface | Description |
|---|---|
| `iris_dispatch` | Agent tool — dispatch a task to any iris agent and block until done |
| `iris_status` | Agent tool — poll status of a task by `taskId` |
| `iris_agents` | Agent tool — list available agents |
| `/iris <agent> <task>` | Slash command from any channel |
| `iris.dispatch` | Gateway RPC |
| `iris.status` | Gateway RPC |
| `iris.agents` | Gateway RPC |

---

## Requirements

- [Iris](https://github.com/crewswarm/crewswarm) running locally (`npm run restart-all`)
- `iris-lead` reachable at `http://127.0.0.1:5010` (default)
- Your RT auth token from `~/.iris/config.json → rt.authToken`

---

## Install

```bash
# From the Iris repo root:
openclaw plugins install ./contrib/openclaw-plugin
```

Or link for development (no copy, reflects edits immediately):

```bash
openclaw plugins install -l ./contrib/openclaw-plugin
```

Then restart the OpenClaw Gateway:

```bash
openclaw restart
```

---

## Configure

Add to your `openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "iris": {
        "enabled": true,
        "config": {
          "url":   "http://127.0.0.1:5010",
          "token": "<your RT auth token>"
        }
      }
    }
  }
}
```

Find your token:

```bash
cat ~/.iris/config.json | python3 -c "import json,sys; print(json.load(sys.stdin)['rt']['authToken'])"
```

Optional config:

| Key | Default | Description |
|---|---|---|
| `url` | `http://127.0.0.1:5010` | iris-lead base URL |
| `token` | *(required)* | RT auth token |
| `pollIntervalMs` | `4000` | Status poll frequency |
| `pollTimeoutMs` | `300000` | Max wait time (5 min) |

---

## Usage

### From an OpenClaw agent conversation

Your OpenClaw agent will automatically call `iris_dispatch` when it makes sense:

> "Use iris-coder to write a login endpoint with JWT auth"

Or explicitly:

> "Call iris_dispatch with agent=iris-qa to audit my last change"

### Slash command (any channel — Telegram, WhatsApp, etc.)

```
/iris iris-coder write /tmp/hello.js — a 10-line express hello world
/iris iris-qa audit the last PR changes
/iris iris-pm create a roadmap for the auth feature
/iris                   ← lists available agents
```

### Gateway RPC (from scripts or other tools)

```bash
# Dispatch
openclaw rpc iris.dispatch '{"agent":"iris-copywriter","task":"Write a tagline for Iris"}'

# Poll status
openclaw rpc iris.status '{"taskId":"<uuid>"}'

# List agents
openclaw rpc iris.agents
```

### Direct HTTP (no OpenClaw needed)

```bash
TOKEN="<your RT token>"

# List agents
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5010/api/agents

# Dispatch
curl -X POST http://127.0.0.1:5010/api/dispatch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent":"iris-coder","task":"write hello.js"}'

# Poll
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5010/api/status/<taskId>
```

---

## Available agents (default iris)

| Agent | Role |
|---|---|
| `iris-coder` | Full-stack coding |
| `iris-coder-front` | Frontend specialist |
| `iris-coder-back` | Backend specialist |
| `iris-frontend` | UI/CSS polish |
| `iris-qa` | Testing & audit |
| `iris-fixer` | Bug fixing |
| `iris-pm` | Planning & roadmaps |
| `iris-security` | Security review |
| `iris-copywriter` | Writing & docs |
| `iris-github` | Git & PRs |
| `iris-main` | General purpose |
| `iris-mega` | Heavy reasoning tasks |
| `iris-researcher` | Web research |
| `iris-architect` | System design |
| `iris-ml` | ML/data tasks |
| `iris-orchestrator` | Wave orchestration |
| `iris-seo` | SEO optimization |
| `iris-loco` | Web search/fetch |
| `iris-judge` | Task evaluation |
| `iris-telegram` | Telegram integration |
| `iris-whatsapp` | WhatsApp integration |

---

## How it works

```
OpenClaw agent
  → iris_dispatch tool call
    → POST /api/dispatch (iris-lead HTTP, Bearer token)
      → RT WebSocket bus (port 18889)
        → target agent bridge (gateway-bridge.mjs)
          → LLM call (Mistral / Cerebras / DeepSeek / etc.)
          → tool execution (@@WRITE_FILE, @@RUN_CMD, etc.)
        → task.done event back on RT bus
      → iris-lead stores result
    → GET /api/status/:taskId (polled every 4s)
  ← result returned to OpenClaw agent
```

No LLM keys cross the boundary — Iris uses its own provider config. The only shared secret is the RT auth token.

---

## Troubleshooting

**"iris-lead unreachable"** — run `npm run restart-all` in the Iris repo.

**401 Unauthorized** — token mismatch. Re-copy from `~/.iris/config.json → rt.authToken`.

**Task never completes** — check `/tmp/iris-lead.log` and the bridge log in `/tmp/`.

**Agent not found** — call `iris_agents` to see the live agent list.
