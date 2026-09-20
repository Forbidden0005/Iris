# OpenClaw Plugin

Iris ships an official [OpenClaw](https://github.com/openclaw/openclaw) plugin that lets any OpenClaw agent dispatch tasks to your local iris.

## What it adds

| Surface | Description |
|---|---|
| `iris_dispatch` | Agent tool — dispatch to any iris agent, blocks until done |
| `iris_status` | Agent tool — poll task status by taskId |
| `iris_agents` | Agent tool — list available agents |
| `/iris` | Slash command from any channel (Telegram, WhatsApp, Discord, etc.) |
| `iris.dispatch` | Gateway RPC method |
| `iris.status` | Gateway RPC method |
| `iris.agents` | Gateway RPC method |

## Install

```bash
# From Iris repo root
openclaw plugins install ./contrib/openclaw-plugin

# Or link for development (edits reflected immediately)
openclaw plugins install -l ./contrib/openclaw-plugin

# Restart gateway
openclaw restart
```

## Configure

Add to your `openclaw.json` (usually `~/.openclaw/openclaw.json`):

```json
{
  "plugins": {
    "entries": {
      "iris": {
        "enabled": true,
        "config": {
          "url": "http://127.0.0.1:5010",
          "token": "<your RT auth token>"
        }
      }
    }
  }
}
```

Find your token:

```bash
cat ~/.iris/iris.json | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).rt?.authToken||'not set'))"
```

## How it works

```
OpenClaw agent
  -> iris_dispatch tool call
    -> POST iris-lead /api/dispatch (Bearer token)
      -> RT WebSocket bus (port 18889)
        -> target agent bridge (gateway-bridge.mjs)
          -> LLM + tool execution
        -> task.done event
      -> iris-lead stores result
    -> GET /api/status/:taskId (polled)
  <- result returned to OpenClaw agent
```

No LLM keys cross the boundary. Iris uses its own provider config. The only shared secret is the RT auth token.

## Agent discovery

OpenClaw discovers Iris agents from directories in `~/.openclaw/agents/`. Iris's install script creates these automatically. The plugin also provides `iris_agents` which queries the live agent list from iris-lead at runtime.

## Publishing to ClawHub

The plugin can be published for other OpenClaw users:

```bash
cd contrib/openclaw-plugin
npm publish --access public
```

Users install with:

```bash
openclaw plugins install iris-openclaw-plugin
```

Published on npm: [iris-openclaw-plugin](https://www.npmjs.com/package/iris-openclaw-plugin)

## Files

```
contrib/openclaw-plugin/
  index.ts                  # Plugin source (tools, commands, RPC, health)
  openclaw.plugin.json      # Plugin manifest
  package.json              # npm package config
  README.md                 # Full usage docs
  skills/iris/
    SKILL.md                # Teaches OpenClaw AI when/how to use Iris
```

See `contrib/openclaw-plugin/README.md` for detailed usage, examples, and troubleshooting.
