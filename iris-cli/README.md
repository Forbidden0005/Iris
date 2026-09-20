# iris-cli

AI coding CLI with an execution quality engine. 29+ models score 100/100 across 12 providers — cheap models perform like premium ones because the engine prevents failures, forces verification, and learns from past runs.

```
npm i -g iris-cli
iris doctor
iris auto "fix the divide-by-zero bug in src/math.ts"
```

## Execution Quality Engine

No other CLI has this. Claude Code, Codex, and Gemini CLI run blind loops. iris-cli wraps every task in 8 quality modules:

- **Failure memory** — blocks repeated bad tool calls after 1 failure
- **Verification gate** — forces proof (test/build) before accepting "done"
- **Edit gate** — rejects "done" without file changes on mutation tasks
- **Action ranking** — steers model toward highest-value next action per turn
- **Task mode strategies** — bugfix/feature/refactor/test_repair get different approaches
- **Patch critic** — catches unread edits, churn, scope creep in real time
- **Adaptive weights** — learns from past runs which action patterns work best
- **Deterministic QA** — checks filesystem ground truth, not LLM judgment

Result: Groq Llama 3.3 70B (free) scores the same as GPT-5.4 ($0.15/call). Gemini Flash at $0.003/task matches Claude Opus. The engine is the equalizer.

## Providers (12 verified at 4/4 presets)

Claude (OAuth), OpenAI (OAuth), Gemini, DeepSeek, Grok, Groq, Kimi, GLM, Qwen, MiniMax, OpenRouter (387 models), OpenCode/Zen (39 models + free tier).

---

Command-line interface for iris agent orchestration with local safety rails (sandbox diffs, session state, routing/cost logs), team sync, CI/browser helpers, and voice mode.

---
**[OVERVIEW.md](docs/OVERVIEW.md)** - 🚀 1-minute summary of what this is and how it works.
**[INSTRUCTION-STACK.md](docs/INSTRUCTION-STACK.md)** - canonical instruction precedence and composition
**[PERMISSIONS-MODEL.md](docs/PERMISSIONS-MODEL.md)** - canonical read/write/shell/approval behavior by mode
---

## Requirements

- Node.js 20+
- Git
- Optional for full integration: running Iris gateway (`http://127.0.0.1:5010`)

## Install

```bash
npm install
npm run build
```

Run the CLI:

```bash
node bin/iris.js --help
```

## Core Commands

```bash
iris chat "refactor auth middleware"
iris chat "build auth API with tests" --modefast6
iris dispatch iris-coder "fix failing tests"
iris dispatch iris-coder "harden auth middleware" --preset quality
iris run -t "build auth API with tests"     # unified pipeline (resumable)
iris run --resume pipeline-<trace-id>       # resume/replay from checkpoint trace
iris run --resume pipeline-<trace-id> --from-phase execute
iris explore "refactor database layer" # parallel speculative execution
iris plan "add OAuth login" --parallel
iris preview
iris apply --check "npm test"
iris rollback
```

## Intelligence Commands

```bash
iris map --graph                     # visual dependency graph
iris shell "list large files"        # NL to shell command translation
iris docs "how does auth work"       # RAG search over docs/markdown
iris blast-radius                    # impact analysis of current changes
iris capabilities                    # runtime capability handshake
iris memory "auth login"             # recall prior task memory
iris lsp check src/cli/index.ts      # TypeScript diagnostics
iris lsp complete src/cli/index.ts 10 5
iris repl                            # interactive multi-agent REPL
iris tui                             # terminal UI adapter (same runtime as REPL)
iris github "list open issues"       # NL GitHub flows
iris github doctor                   # GitHub CLI health check
```

## Advanced Commands

```bash
iris sync --status
iris privacy --show
iris serve --port 4317               # unified /v1 API + /mcp endpoint
iris exec "vim src/server.ts"        # interactive terminal (PTY)
iris listen --duration-sec 6
iris browser-debug --url http://127.0.0.1:4319
iris ci-fix --check "npm test"
iris doctor
```

### Pipeline Runtime Flags

- `IRIS_USE_UNIFIED_ROUTER=false` - force-disable UnifiedPipeline routing path
- `IRIS_LEGACY_ROUTER=true` - use legacy router/legacy standalone execution path
- `IRIS_DUAL_L2_ENABLED=true` - enable Dual-L2 planning/decomposition
- `IRIS_QA_LOOP_ENABLED=true` - run QA -> fixer -> final QA gate before completion
- `IRIS_QA_MAX_ROUNDS=2` - max fixer rounds in QA loop
- `IRIS_CONTEXT_BUDGET_CHARS=7000` - per-worker retrieved artifact context budget
- `IRIS_CONTEXT_MAX_CHUNKS=8` - max retrieved artifact chunks per worker
- `IRIS_CONTEXT_PACK_TTL_HOURS=24` - TTL for persisted context-pack cache in `.iris/context-packs`
- `IRIS_TOOL_MODE=auto|native|markers` - tool execution mode (default `auto`)
- `IRIS_GEMINI_DYNAMIC_DECLARATIONS=true|false` - use dynamic Gemini declaration builder (default `true`)
- `IRIS_ENABLE_ADVANCED_ADAPTER_TOOLS=true|false` - enable safe advanced adapter tools in default pipeline (default `true`)
- `IRIS_NO_ROUTER=true|false` - skip router classification and force execute-parallel flow

CLI preset flags (chat/auto/dispatch):
- `--preset fast6|turbo6|balanced|quality`
- `--modefast6` shortcut for `fast6`
- `--new-task` (chat only) ignores pending clarification resume and starts fresh

Preset summary:
- `fast6`: 6 parallel workers, QA 2 rounds, no-router, speed-focused
- `turbo6`: 6 parallel workers, QA off, no-router, max throughput
- `balanced`: 4 workers, QA 1 round, no-router, mixed speed/quality
- `quality`: 3 workers, QA 2 rounds + stricter gates, no-router

## Diagnostics & Health

```bash
iris doctor              # checks Node.js, Git, API keys, gateway, MCP, updates (~3s)
iris doctor --gateway http://custom:5010
```

`iris doctor` validates your environment and suggests fixes:
- **API key detection** — shows which of 10 providers are configured
- **Cheapest-first hints** — when no keys found, recommends Gemini (free) and Groq (free)
- **Gateway health** — verifies iris-lead is reachable
- **MCP server health** — checks configured MCP servers
- **Update check** — shows if a newer version is available on npm

## Key Engine Features

| Feature | Status |
|---|---|
| **Streaming output** | ✅ All providers — Gemini, OpenAI, Anthropic, Grok, DeepSeek, Groq, OpenRouter |
| **Session continuity** | ✅ SessionManager persists history across REPL sessions |
| **Auto-approve mode** | ✅ `--always-approve` flag for unattended execution |
| **Turn compression** | ✅ Topic-Action-Summary keeps prompts lean on long sessions |
| **JIT context** | ✅ Files discovered by tools are indexed for subsequent turns |
| **Repo-map RAG** | ✅ TF-IDF semantic search injected before execution |
| **Auto-retry** | ✅ Failed tool calls retry up to 3 times with auto-correction |
| **Infinite loop detection** | ✅ Repeating-action detector stops stuck agents |
| **Multimodal vision** | ✅ `--image` flag for Gemini, Claude, GPT-4o, Grok Vision |
| **Cost tracking** | ✅ Per-session token costs for all providers |

Adaptive QA + reliability:
- `IRIS_QA_SMALL_EDIT_THRESHOLD=1` and `IRIS_QA_SMALL_EDIT_ROUNDS=1` reduce QA rounds for tiny edits
- `IRIS_DECOMPOSE_MAX_ATTEMPTS=2` retries lightweight decomposition on failure
- `IRIS_SELF_CONSISTENCY_GATE_ENABLED=true` validates synthesized final output against worker evidence

Standalone default:
- standalone mode now uses UnifiedPipeline by default.
- pass `--legacy-router` to any command for temporary legacy fallback.

## L1/L2/L3 Use Cases

- Use case 1 (Code engine path): command-driven execution (`dispatch`, `auto`, `run`) with full L2/L3 pipeline.
- Use case 2 (Chat-directed execution): user chats with L1 (`iris chat`), L2 decides/forces execution path, L3 runs workers/tools.

Clarification rule:
- L1 returns final completion when done.
- If L3 emits unresolved `ask_user`, L1 returns only clarification questions and waits for user input.
- Next `iris chat` message auto-resumes the pending trace using saved `traceId` and prior plan artifacts.

## Quick Benchmarking

```bash
# Compare latency/pass behavior of presets
node scripts/benchmark-presets.mjs
```

`iris cost` now includes pipeline observability counters:
- `qa_approved`, `qa_rejected`, `qa_rounds_avg`
- `context_chunks_used`, `context_chars_saved_est`

## Context Flags

`chat` and `dispatch` accept these context injection flags:

- `--docs` — auto-retrieve relevant doc chunks via collections search
- `--cross-repo` — inject sibling repo context
- `--context-file <path>` — attach a file
- `--context-repo <path>` — attach git context from another repo
- `--stdin` — pipe stdin as context

## What Is Implemented

- Phase 1 (MVP): complete
- Phase 2 (Intelligence): complete
- Phase 3 (Polish/Launch): complete
- Phase 4 (Advanced): complete
- Phase 5 (3-Tier LLM Scale-Up): complete

See [ROADMAP.md](ROADMAP.md) for tracked completion.

## Testing

```bash
npm run build
npm run check
npm test
```

Latest local QA pass (2026-03-01):
- Build: passing
- Check: passing
- Tests: 178 passing, 0 failing

## Community

- 💬 [Join our Discord](https://discord.gg/iris)
- 🐛 [Report a bug](https://github.com/iris/iris-cli/issues)
- 💡 [Request a feature](https://github.com/iris/iris-cli/discussions)

## Documentation

- [QUICKSTART.md](docs/QUICKSTART.md)
- [INSTRUCTION-STACK.md](docs/INSTRUCTION-STACK.md)
- [PERMISSIONS-MODEL.md](docs/PERMISSIONS-MODEL.md)
- [EXAMPLES.md](docs/EXAMPLES.md)
- [API.md](docs/API.md)
- [API-UNIFIED-v1.md](docs/API-UNIFIED-v1.md) — unified dashboard/CLI/headless contract
- [MCP-CLI-INTEGRATION.md](docs/MCP-CLI-INTEGRATION.md) — Codex/Cursor/Claude MCP setup
- [openapi.unified.v1.json](docs/openapi.unified.v1.json) — OpenAPI spec
- [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- [CONTRIBUTING.md](docs/CONTRIBUTING.md)
- [SECURITY.md](docs/SECURITY.md)
