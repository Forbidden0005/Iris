# iris-cli Guide

Terminal-first interface for iris. Run builds, chat with agents, dispatch tasks, and manage pipelines -- all from the command line.

## Installation

iris-cli ships with the main iris package:

```bash
npm install -g iris
```

The `iris` command is now available globally.

From source (contributor setup):

```bash
cd iris-cli
npm install
npm run build
node bin/iris.js --help
```

## Requirements

- Node.js 20+
- Git
- For full features: iris gateway running on `http://127.0.0.1:5010`

iris-cli works standalone (direct LLM calls) or connected to the full iris stack. Standalone mode uses the unified pipeline by default.

## Quick start

```bash
# One-shot task
iris chat "build a REST API with Express and tests"

# Interactive REPL
iris repl

# Dispatch to a specific agent
iris dispatch iris-coder "fix the failing auth tests"

# Check system health
iris doctor
```

## Core commands

### `iris chat`

Send a message to the L1 router (iris-lead). It plans, decomposes, and dispatches automatically.

```bash
iris chat "refactor auth middleware"
iris chat "build auth API with tests" --modefast6
iris chat "add OAuth login" --preset quality
```

If the system needs clarification, it asks. Your next `iris chat` message auto-resumes the pending task using the saved trace ID.

Use `--new-task` to skip resume and start fresh:

```bash
iris chat "something unrelated" --new-task
```

### `iris dispatch`

Send a task directly to a named agent, bypassing the planner:

```bash
iris dispatch iris-coder "harden auth middleware"
iris dispatch iris-qa "run full test suite"
iris dispatch iris-coder "fix failing tests" --preset quality
```

### `iris run`

Unified pipeline -- multi-step builds with planning, parallel execution, and optional QA:

```bash
iris run -t "build auth API with tests"
```

Resume a failed or interrupted pipeline:

```bash
iris run --resume pipeline-<trace-id>
iris run --resume pipeline-<trace-id> --from-phase execute
```

### `iris repl`

Interactive multi-agent REPL with full tool access:

```bash
iris repl
iris repl --mode assist
```

Inside the REPL, you get streaming responses, session history, and access to all 34+ built-in tools. The session persists across turns.

`iris tui` is an alias for the same runtime with a terminal UI adapter.

### `iris explore`

Parallel speculative execution -- tries multiple approaches simultaneously:

```bash
iris explore "refactor database layer"
```

### `iris plan`

Generate a build plan without executing:

```bash
iris plan "add OAuth login" --parallel
```

### `iris preview` / `iris apply` / `iris rollback`

Sandbox diff workflow:

```bash
iris preview                    # see pending changes
iris apply --check "npm test"   # apply and verify
iris rollback                   # undo last apply
```

## Intelligence commands

```bash
iris map --graph                     # visual dependency graph
iris shell "list large files"        # natural language to shell command
iris docs "how does auth work"       # RAG search over project docs
iris blast-radius                    # impact analysis of current changes
iris memory "auth login"             # recall prior task memory
iris lsp check src/cli/index.ts      # TypeScript diagnostics
iris github "list open issues"       # natural language GitHub flows
iris github doctor                   # GitHub CLI health check
```

## Presets

Presets configure parallelism, QA rounds, and routing:

| Preset | Workers | QA | Best for |
|--------|---------|-----|----------|
| `fast6` | 6 parallel | 2 rounds | Speed-focused builds |
| `turbo6` | 6 parallel | Off | Max throughput, no QA |
| `balanced` | 4 parallel | 1 round | General use |
| `quality` | 3 parallel | 2 rounds + strict gates | Production code |

```bash
iris chat "build feature" --preset balanced
iris chat "quick fix" --modefast6
```

## Model selection

iris-cli picks a model automatically based on the task. Override with:

```bash
iris chat "build API" --model anthropic/claude-sonnet-4-20250514
```

Or set a default in config. Available providers: Anthropic, OpenAI, Google, Groq, Grok, DeepSeek, OpenRouter.

## Context injection

Attach extra context to any `chat` or `dispatch` command:

```bash
iris chat "fix this" --docs                    # auto-retrieve relevant doc chunks
iris chat "port this" --cross-repo             # inject sibling repo context
iris chat "review" --context-file src/auth.ts  # attach a specific file
iris chat "sync" --context-repo ../other-repo  # attach git context from another repo
echo "error log" | iris chat "debug this" --stdin  # pipe stdin as context
```

## Session resume

iris-cli saves session state automatically. If a task is interrupted or needs clarification:

```bash
# First message starts a task
iris chat "build auth system"
# System asks: "REST or GraphQL?"
# Next message resumes automatically
iris chat "REST with JWT"
```

Pipeline resume works the same way:

```bash
iris run -t "build feature"
# Pipeline fails at execute phase
iris run --resume pipeline-abc123 --from-phase execute
```

## Headless mode

For CI pipelines and scripts, use `--always-approve` to skip interactive prompts:

```bash
iris chat "fix lint errors" --preset fast6 --always-approve
iris ci-fix --check "npm test"
```

The `ci-fix` command runs iteratively: execute fix, run check, repeat until passing or max attempts.

## Configuration

iris-cli reads configuration from:

1. `~/.iris/iris.json` -- main config (agents, providers, settings)
2. Environment variables -- API keys and runtime flags
3. CLI flags -- override anything per-command

Key environment variables:

```bash
# Provider API keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
GROQ_API_KEY=gsk_...

# Pipeline tuning
IRIS_QA_LOOP_ENABLED=true
IRIS_QA_MAX_ROUNDS=2
IRIS_CONTEXT_BUDGET_CHARS=7000
IRIS_NO_ROUTER=true
```

See the [iris-cli README](../iris-cli/README.md) for the full list of pipeline runtime flags.

## Diagnostics

```bash
iris doctor
```

Checks Node.js, Git, API keys (10 providers), gateway health, MCP servers, and available updates. Takes about 3 seconds.

```bash
iris doctor --gateway http://custom-host:5010
```

## Cost tracking

```bash
iris cost
```

Shows per-session token costs across all providers, plus pipeline observability counters:
- `qa_approved`, `qa_rejected`, `qa_rounds_avg`
- `context_chunks_used`, `context_chars_saved_est`

## MCP server

iris-cli can serve as an MCP endpoint for other tools (Cursor, Claude Code, Codex):

```bash
iris serve --port 4317
```

This exposes a `/v1` API and `/mcp` endpoint. See [MCP-CLI-INTEGRATION.md](../iris-cli/docs/MCP-CLI-INTEGRATION.md) for setup details.

## Testing

```bash
cd iris-cli
npm run build
npm run check
npm test
```

Full QA suite:

```bash
npm run qa:full        # build + coverage + inventory + smoke
npm run qa:e2e         # gateway contract + engine matrix + PM loop
```

## Related docs

- [DASHBOARD-GUIDE.md](DASHBOARD-GUIDE.md) -- web UI guide
- [ARCHITECTURE.md](ARCHITECTURE.md) -- system diagram, ports, request flow
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) -- common issues and fixes
- [iris-cli README](../iris-cli/README.md) -- full CLI reference
- [iris-cli OVERVIEW.md](../iris-cli/docs/OVERVIEW.md) -- 1-minute summary
- [MODES-AND-FLAGS.md](../iris-cli/docs/MODES-AND-FLAGS.md) -- detailed flag reference
- [PERMISSIONS-MODEL.md](../iris-cli/docs/PERMISSIONS-MODEL.md) -- read/write/shell/approval behavior
