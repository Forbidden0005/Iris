# Iris Dispatch Skill

## When to use this skill

Use Iris tools when the user asks you to **build, write, test, review, fix, or ship something** that would benefit from a specialist agent — especially multi-step work that crosses disciplines (code + tests + docs, or frontend + backend + QA).

**Trigger phrases:**
- "build / write / create / implement [feature]"
- "test / audit / review [code or PR]"
- "fix [bug]"
- "write docs / a README / a spec for..."
- "dispatch iris-coder / iris-qa / iris-pm to..."
- "have the iris handle..."

## Available tools

- `iris_agents` — list all available agents (call this first if unsure)
- `iris_dispatch` — send a task to a specialist and wait for the result
- `iris_status` — poll a running task by taskId

## How to use

### Step 1 — pick the right agent

| Task type | Agent |
|---|---|
| Write or edit code (general) | `iris-coder` |
| Frontend / UI / CSS | `iris-coder-front` or `iris-frontend` |
| Backend / API / DB | `iris-coder-back` |
| Write tests, audit, QA | `iris-qa` |
| Fix a bug or error | `iris-fixer` |
| Plan a feature or roadmap | `iris-pm` |
| Security review | `iris-security` |
| Write docs, copy, README | `iris-copywriter` |
| Git / PR operations | `iris-github` |
| Heavy reasoning / complex tasks | `iris-mega` |
| Web research | `iris-researcher` |
| System architecture / design | `iris-architect` |
| ML / data tasks | `iris-ml` |
| SEO optimization | `iris-seo` |
| Task evaluation / judging | `iris-judge` |
| General / orchestration | `iris-main` |

If you're unsure, call `iris_agents` first to see the live list.

### Step 2 — dispatch with a clear task

Write the task as a precise, self-contained instruction. Include:
- **What** to produce (file path, function name, endpoint, etc.)
- **How** to verify it worked (optional `verify` field)
- **Done condition** (optional `done` field)

Good example:
```
agent: "iris-coder"
task: "Write /src/api/auth.ts — a JWT login endpoint using jose. Accept email+password, validate against users array, return httpOnly cookie."
verify: "curl -X POST http://localhost:3000/login returns Set-Cookie header"
done: "File exists and contains createSigner from jose"
```

### Step 3 — wait and relay

`iris_dispatch` blocks until the agent finishes (up to 5 minutes). The result includes the agent's full output including any files written, commands run, and verification results. Relay the relevant parts to the user.

## Chaining agents

For complex work, dispatch sequentially — use the result of one agent as context for the next:

```
1. iris_dispatch iris-pm  → "Create a task plan for user auth feature"
2. iris_dispatch iris-coder → "Implement: [result from step 1]"
3. iris_dispatch iris-qa  → "Test: [result from step 2]"
```

## Slash command alternative

Users can also dispatch directly from any channel:
```
/iris iris-coder write /tmp/hello.js — a 10-line express hello world
/iris iris-qa audit the last PR
/iris              ← lists available agents
```

## When NOT to use Iris

- Simple one-liner answers or explanations — handle directly
- Tasks you can complete yourself without writing files or running code
- If Iris is not running (`iris_agents` returns empty or errors)
