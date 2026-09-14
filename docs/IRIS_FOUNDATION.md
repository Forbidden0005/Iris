# Iris Foundation

Iris is a new project forked from crewswarm. The starting point is intentional:
crewswarm already has a working local-first swarm runtime, a lead agent, task
dispatch, dashboard observability, per-agent engines, and memory primitives.

The first Iris phase is not a broad rename. The first phase is to put a stable
product frame around the existing runtime so future changes are made for the
right system.

## Product Direction

Iris is a single front-door assistant for supervised multi-agent work.

The user talks to Iris. Iris plans the work, creates specialist agents when the
job needs them, monitors progress, gathers evidence, resolves conflicts, verifies
results, and reports back with clear status.

The user should experience one coherent assistant, not a pile of bots.

## Inherited From crewswarm

- Lead conversation surface: `crew-lead` is the current orchestrator entrypoint.
- Agent dispatch: RT-bus task assignment and `@@PIPELINE` wave execution.
- Specialist agents: built-in roles plus dynamic agent creation.
- Runtime engines: OpenCode, Cursor CLI, Claude Code, Codex, crew-cli, and direct
  API execution paths.
- Permission model: role defaults and per-agent tool allow-lists.
- Memory layers: AgentMemory, AgentKeeper, project messages, and optional RAG
  collections.
- Dashboard: chat, swarm state, RT messages, sessions, agents, memory, workflows,
  and testing views.

## Reference Systems

Use OpenHands as reference material for:

- Backend/frontend boundaries.
- Conversation UX and control-center polish.
- Long-term architecture docs and operational discipline.
- Isolated workspaces, conversation lifecycle, and agent server boundaries.

Use Open Swarm as dashboard inspiration only. Do not copy its architecture until
we have inspected it against Iris requirements.

## First Architectural Moves

1. Add an Iris identity layer above existing crewswarm names.
2. Keep runtime IDs stable until compatibility shims exist.
3. Define Iris-facing terms for lead, agents, tasks, evidence, memory, and
   review.
4. Map current crewswarm capabilities to Iris capabilities.
5. Add tests around any behavior changed by the identity layer.
6. Only then rename user-visible dashboard and CLI surfaces.

## Non-Goals For Phase 1

- No full repo-wide rename.
- No replacement of the RT bus.
- No replacement of existing engine adapters.
- No deletion of crewswarm compatibility paths.
- No rewrite of `crew-lead.mjs`, `gateway-bridge.mjs`, or
  `scripts/dashboard.mjs`.

## Current Gaps

- Iris needs a durable task/evidence model, not only chat messages and task
  completion logs.
- Iris needs explicit plan state that can be inspected, resumed, revised, and
  audited.
- Iris needs conflict handling between agents.
- Iris needs a user-facing review loop before high-impact changes.
- Iris needs an identity and naming layer that avoids leaking internal
  `crew-*` concepts into the product experience.
- Iris needs sharper model-budget controls and run limits per spawned agent.

## Working Rule

Prefer additive compatibility over replacement. If a change can make Iris clearer
without breaking crewswarm's runtime contracts, do that first.

## Phase 1 Slice: Identity Layer

The identity layer maps Iris-facing product concepts to the current crewswarm
runtime contracts.

Acceptance criteria:

- `iris` resolves to the existing `crew-lead` runtime agent.
- Iris-facing aliases such as `planner`, `builder`, and `qa` resolve to stable
  `crew-*` IDs.
- User-facing labels can say `Iris`, `Planner`, or `Builder` without renaming the
  runtime agents yet.
- Unknown dynamic `crew-*` agents still get readable labels.
- `/api/agents-config` exposes Iris display metadata while preserving stable
  runtime IDs.
- Existing dispatch, memory, config, and permissions paths remain untouched.

## Phase 1 Slice: Dashboard Language

User-facing dashboard chrome and conversation labels should say Iris when they
refer to the primary assistant. Internal runtime names stay visible only when
they explain routing, commands, config files, or compatibility.

Acceptance criteria:

- The dashboard title and brand say Iris.
- Primary assistant bubbles and fallback labels say Iris instead of `crew-lead`.
- Mention help can still show `@crew-lead` as Iris's current runtime mention.
- API routes, storage paths, process names, and runtime IDs remain unchanged.
