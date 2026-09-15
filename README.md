# Iris

**A single front-door assistant for supervised multi-agent coding work.** You talk to Iris. Iris plans the work, creates specialist agents when the job needs them, dispatches tasks, gathers evidence, tracks conflicts, and reports back with a clear, auditable status — instead of a pile of bots you have to babysit individually.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)

---

## Status

Iris is an early-stage, actively-developed project. It's forked from [crewswarm](https://github.com/crewswarm/crewswarm) — a working local-first multi-agent runtime — and is being built up into a supervised, evidence-driven orchestration product on top of that foundation.

**What exists today:**
- The inherited crewswarm runtime: `crew-lead` orchestrator, RT-bus task dispatch, `@@PIPELINE` wave execution, specialist agents, per-agent engines (Claude Code, Cursor, Gemini, Codex, OpenCode, crew-cli), and a dashboard.
- An Iris identity layer over that runtime — Iris-facing display names and roles for the existing agents, without renaming their underlying runtime IDs or storage paths.
- A durable **Plan / Task / Evidence / Review / Conflict** data model (`lib/iris/plans.mjs`) — plans and their tasks are real, inspectable records, not just chat history. Task completions attach real evidence, conflicts get first-class tracking with a resolve/dismiss lifecycle, and draft review packets can be generated deterministically from a plan's own records (no LLM call).
- A dashboard **Plans** tab for browsing plans, dispatching tasks, attaching evidence, recording and resolving conflicts, and generating draft reviews.

**What's explicitly not built yet:**
- A user-facing approval/revision loop (decided in [docs/IRIS_CAPABILITY_MAP.md](docs/IRIS_CAPABILITY_MAP.md), not yet implemented).
- Enforcement of plan run limits (advisory-only today — a plan can declare a max task/dispatch count, but nothing blocks going over it).
- A full rename of the underlying `crew-*` runtime IDs and storage paths — deliberately deferred until the product surface above them is stable. See [docs/IRIS_FOUNDATION.md](docs/IRIS_FOUNDATION.md).

See [docs/IRIS_CAPABILITY_MAP.md](docs/IRIS_CAPABILITY_MAP.md) for the full map from crewswarm's existing primitives to Iris's product concepts, and what's designed but not yet implemented.

---

## Why fork crewswarm?

Iris needed a working local-first swarm runtime on day one — task dispatch, a lead agent, per-agent engines, dashboard observability, and memory primitives all already existed and worked. Rather than build that from scratch, Iris starts from crewswarm's runtime and adds a product layer on top: durable plans instead of ephemeral chat, real evidence instead of trust-the-agent, first-class conflicts instead of buried disagreements, and (eventually) a real approval gate before consequential work ships.

The underlying engines, dispatch protocol, and dashboard architecture are still the crewswarm ones. Iris's job is the layer that turns "a swarm of agents did some things" into "here is what was asked, what was done, what proves it, and what still needs a decision."

---

## Quickstart

```bash
git clone https://github.com/Forbidden0005/Iris.git
cd Iris
npm install
npm run doctor
npm run restart-all
```

Dashboard opens at `localhost:4319`, Vibe IDE at `localhost:3333`.

### Try the Iris plan/task/evidence stack directly (no dashboard, no LLM)

```bash
npm run demo:iris-plan-stack     # narrated walkthrough of every lib/iris/plans.mjs helper
npm run smoke:iris-plan-stack    # assertion-based round-trip check
```

### Run the tests

```bash
npm test              # unit suite
npm run test:report   # summarize last results
```

---

## How it works

```
Dashboard / Vibe IDE / crew-cli / crewchat / Telegram / WhatsApp / MCP
                    |
                crew-lead (Iris lead orchestrator)
                    |
                 RT Bus
                    |
     ─────────────────────────────────
     |        |        |       |       |
   planner  coder     qa    fixer   release
                    |
        Engines: Claude Code · Cursor · Gemini · Codex · OpenCode · crew-cli
                    |
        Iris plan/task/evidence/review/conflict records (lib/iris/plans.mjs)
```

1. **You tell Iris what you need** — a one-line request or a full spec.
2. **A plan gets created** — either explicitly, or (opt-in, deterministic, no LLM) from a chat message that looks like a coordination request.
3. **Tasks dispatch to specialist agents** through the existing crewswarm runtime.
4. **Evidence attaches automatically on completion** — a task's own real dispatch outcome, not a claim, and only once the reply is treated as an actual completion rather than a retry, a bailout, or a clarifying question.
5. **Conflicts and draft reviews are inspectable, durable records** — visible in the dashboard's Plans tab, not buried in chat scrollback.

---

## Documentation

- [docs/IRIS_FOUNDATION.md](docs/IRIS_FOUNDATION.md) — product direction, what's inherited from crewswarm, non-goals for this phase.
- [docs/IRIS_CAPABILITY_MAP.md](docs/IRIS_CAPABILITY_MAP.md) — the concept map from crewswarm primitives to Iris product concepts, plus decided-but-not-built design (like the approval loop).
- [AGENTS.md](AGENTS.md) — AI-assistant setup guide (Cursor, Claude Code, Codex, etc.) for working in this repo, including the crewswarm-inherited runtime details.
- [CONTRIBUTING.md](CONTRIBUTING.md) — development setup and contribution guidelines.
- [SECURITY.md](SECURITY.md) — reporting vulnerabilities, local-first security assumptions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs welcome.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

MIT
