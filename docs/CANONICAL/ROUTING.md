# Routing

Shared chat, mentions, dispatch, and thread continuity.

## Shared chat participants

In shared chat surfaces (Dashboard Swarm Chat, shared `projectId` rooms, MCP clients), autonomous `@mentions` route to:

- **Agents:** `@iris-coder`, `@iris-qa`, `@iris-pm`, any canonical `iris-*` agent ID
- **CLI participants:** `@codex`, `@cursor`, `@claude`, `@opencode`, `@gemini`, `@iris-cli`

Participants can hand off by mentioning another in-channel. Direct engine passthrough remains available separately.

## Dispatch

From chat or API:

```
dispatch iris-coder to write a login endpoint with JWT
have iris-qa audit the last PR
```

Or pipeline:

```
@@PIPELINE [
  {"wave":1, "agent":"iris-coder", "task":"Write /src/auth.ts — JWT login"},
  {"wave":2, "agent":"iris-qa",    "task":"Test the auth endpoint"}
]
```

Tasks in the same `wave` run in parallel. Higher waves wait for lower waves.

## Thread continuity

- Per-project chat history in `~/.iris/project-messages/{projectId}/messages.jsonl`
- Session binding persists across tab switches
- RAG search over project messages: `GET /api/iris-lead/search-messages-semantic?projectId=...&q=...`

## Coordinator IDs

Bare aliases (`coder`, `pm`) are normalized to canonical RT IDs. Coordinators that can emit `@@DISPATCH` are in `lib/agent-registry.mjs` → `COORDINATOR_AGENT_IDS` and enforced in `gateway-bridge.mjs`:

- `iris-main`, `iris-pm`, `iris-pm-cli`, `iris-pm-frontend`, `iris-pm-core`, `iris-orchestrator`
