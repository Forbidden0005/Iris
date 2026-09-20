---
title: "iris: The Multi-Agent AI Coding Platform Where You're the PM"
tags: "ai, opensource, productivity, devtools"
published: false
canonical_url: "https://iris.ai/blog/iris-multi-agent-coding"
---

# iris: The Multi-Agent AI Coding Platform Where You're the PM

Hit your Claude session limit mid-refactor. Switch to Codex, re-explain everything, lose context. Try Gemini CLI, hit their quota too. Every AI coding tool locks you into one provider, one model, one conversation. You can't switch without starting over.

iris is the orchestration layer that fixes this.

## What iris is

A local-first, open-source platform where you're the PM and AI agents are your engineering team. You describe the work once. The system plans it, dispatches it to specialist agents, runs them in parallel, and verifies the output.

The mental model: you stop being the typist. You start being the coordinator.

## The stack

### iris-lead (router)
Analyzes every task: is this a quick answer, a single-agent job, or does it need parallel execution across multiple specialists?

### Wave orchestrator
Breaks complex work into parallel waves. iris-coder-back builds the API while iris-coder-front wires the UI while iris-qa writes tests while iris-security audits — all simultaneously, each in an isolated git worktree so they can't step on each other.

### 20+ specialist agents
iris-coder, iris-qa, iris-fixer, iris-security, iris-pm, iris-copywriter, iris-github, iris-architect, and more. Each has its own system prompt, model, and tools. They share persistent memory but get fresh context windows — so no agent is polluted by another's work.

### 6 coding engines
Claude Code, Cursor, Codex CLI, Gemini CLI, OpenCode, and iris-cli. Hit a rate limit? The next task routes to a different engine automatically. Session state resumes across all of them — switch mid-conversation without losing context.

### PM Loop
Point it at a ROADMAP.md and walk away. It reads the next unchecked item, dispatches to the right agents, marks it done or failed, and moves on. It ships features autonomously.

## iris-cli: the missing CLI for every model

This is the piece that doesn't exist anywhere else.

Grok doesn't have a coding CLI. DeepSeek doesn't have one. Qwen, Kimi, Groq, MiniMax, Ollama — none of them have agentic coding tools. Claude Code only works with Anthropic models. Codex only works with OpenAI. Gemini CLI only works with Google.

iris-cli gives **every model** a full agentic coding environment:

- **45+ built-in tools** — file I/O, git, LSP diagnostics, shell, web search, Docker sandbox, memory, sub-agent spawning
- **3-tier pipeline** — L1 router (cheap model picks the path), L2 planner (expensive model decomposes complex tasks), L3 workers (tool-using execution)
- **Execution quality engine** — 8 modules that make cheap models perform like premium ones

### The execution quality engine

Every other AI coding CLI runs a blind loop: prompt the model, execute its tool call, repeat until it says "done." There's no memory of what failed, no proof that it worked, no feedback between turns.

iris-cli wraps every task in 8 quality modules:

1. **Failure memory** — records what went wrong and blocks the model from repeating it
2. **Verification gate** — won't declare "done" without proof (tests pass, build succeeds, files exist)
3. **Patch critic** — checks every edit in real time: did you read the file first? Rewriting the same file again? Scope creep? All deterministic, no LLM call
4. **Action ranking** — scores what the model should do next based on execution state
5. **Task mode strategies** — bugfix, feature, refactor, and test repair each get different execution approaches
6. **Adaptive weights** — learns from the current session's trajectory
7. **Structured history** — preserves full-fidelity state across context compaction
8. **Smart delegation** — picks the right specialist persona per subtask

### The result: 29 models at 100/100

29 models score perfect on our coding quality benchmark: correct TypeScript, all tests passing, typecheck clean, no regressions.

| Model | Provider | ~Cost/Task |
|-------|----------|-----------|
| Claude (OAuth) | Anthropic | $0 |
| GPT-5.4 (OAuth) | OpenAI | $0 |
| GPT-OSS 20B | Groq | $0.0003 |
| Gemini 2.5 Flash Lite | Google | $0.0004 |
| DeepSeek Chat | DeepSeek | $0.001 |
| Grok 4-1 Fast | xAI | $0.001 |
| Groq Llama 3.3 70B | Groq | $0.002 |
| Gemini 2.5 Flash | Google | $0.002 |
| Claude Haiku 4.5 | Anthropic | $0.007 |
| GPT-5.4 | OpenAI | $0.02 |
| Claude Sonnet 4.6 | Anthropic | $0.02 |
| Claude Opus 4.6 | Anthropic | $0.03 |

Plus 17 more at 100/100. Full list in the README.

Groq GPT-OSS 20B ($0.0003/task) produces the same verified code as Claude Opus ($0.03/task) — 100x cheaper, same quality. The engine is the equalizer. Cheap models fail without it because they skip verification, hallucinate edits, and loop. The engine prevents those failure modes.

## 8 surfaces, one iris

Work from wherever fits your workflow:

- **Vibe** — browser IDE with Monaco editor, integrated terminal, multi-engine chat, and live file sync. Agents edit a file, you see it update in 500ms. No Electron, no install.
- **Dashboard** — control plane for agents, providers, models, costs, execution traces
- **iris-cli** — terminal-native. `iris exec "build this"` from your project folder
- **irischat** — native chat for quick routing and project context
- **Telegram & WhatsApp** — message your iris from your phone
- **OpenClaw** — iris works as a plugin for OpenClaw's desktop apps
- **MCP server** — expose 64 tools to any MCP-compatible client (Claude Desktop, VS Code)

Same agents, same persistent memory, any surface.

## The economics: pay for brain, not glue

The 3-tier pipeline separates cost by responsibility:

- **L1 router:** Groq GPT-OSS 20B or Gemini Flash Lite — $0.0001/classification
- **L2 planner:** Claude Sonnet or GPT-5.4 — $0.003-0.02/plan (only when needed)
- **L3 workers:** Any model through iris-cli — $0.0003-0.03/task

Best value stack: L1 Groq + L2 Gemini Flash Lite + L3 DeepSeek Chat = **$0.006 per feature**.

Not every step needs a premium reasoning model. The router is a classification task. Workers produce identical quality across 29 models because the engine does the heavy lifting. You only pay premium prices for the planner when the task actually needs decomposition.

## Comparison

| Feature | iris | Claude Code | Codex CLI | Gemini CLI | Cursor |
|---------|-----------|-------------|-----------|------------|--------|
| Multi-model routing | 40+ models | Anthropic only | OpenAI only | Google only | Multi |
| Specialist agents | 20+ | 1 | 1 | 1 | 1 |
| Parallel execution | Git worktrees | No | No | No | No |
| Built-in tools | 45+ | ~15 | ~10 | ~12 | ~20 |
| Execution quality engine | 8 modules | No | No | No | No |
| PM Loop (autonomous) | Yes | No | No | No | No |
| Session resume across engines | Yes | No | No | No | No |
| Surfaces | 8 | 1 | 1 | 1 | 1 |
| Local-first | Yes | Yes | Yes | Yes | Partial |
| Open source | MIT | No | Yes | No | No |

## Get started

```bash
npm i -g iris
iris doctor
iris chat "refactor the auth middleware and write tests"
```

Or clone the full stack:

```bash
git clone https://github.com/crewswarm/crewswarm
cd iris && bash install.sh
```

Open the dashboard at `http://localhost:4319` and Vibe at `http://localhost:3333`.

## Links

- **Site:** https://iris.ai
- **Repo:** https://github.com/crewswarm/crewswarm
- **Vibe IDE:** https://iris.ai/vibe.html
- **Models & benchmarks:** https://iris.ai/models.html
- **Twitter:** https://twitter.com/iris

---

*iris is open source under MIT license. Built for developers who want control over which models, which providers, and where their code runs.*
