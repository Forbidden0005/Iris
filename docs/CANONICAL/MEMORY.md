# Memory

Shared memory, project messages, and RAG role.

## Three memory layers

1. **AgentMemory** — cognitive facts (decisions, constraints, preferences)
   - Stored: `~/.iris/shared-memory/.iris/agent-memory/<agent-id>.json`
   - Written by: `@@BRAIN` commands, migration script, `rememberFact()` API

2. **AgentKeeper** — task results (completed work by all agents)
   - Stored: `~/.iris/shared-memory/.iris/agentkeeper.jsonl`
   - Written by: Gateway after task completion, CLI `--keep` mode

3. **Collections** — local docs/code RAG (optional)
   - Stored: `~/.iris/shared-memory/.iris/collections/`
   - Written by: `iris index --docs`, `iris index --code`

**MemoryBroker** blends all three, scores hits, returns unified context.

## Migrate legacy brain.md

```bash
node scripts/migrate-brain-to-shared-memory.mjs --dry-run

node scripts/migrate-brain-to-shared-memory.mjs
```

## Use from chat

```
@@MEMORY search "authentication security"
@@MEMORY stats
@@BRAIN This project requires 2FA for admin routes
```

## Project messages

- Chat history: `~/.iris/project-messages/{projectId}/messages.jsonl`
- Auto-indexed for semantic search
- API: `GET /api/iris-lead/search-messages-semantic?projectId=...&q=...`

## How it works

- **Gateway:** Calls `recallMemoryContext()` when building prompts; records tasks via `recordTaskMemory()`
- **Iris-lead chat:** Injects MemoryBroker context at session start; parses `@@MEMORY` commands
- **CLI:** Uses MemoryBroker natively in iris-cli
