# Iris Capability Map

This document maps the Iris product direction to the crewswarm runtime that Iris currently inherits. It is a planning artifact, not a rewrite mandate.

## Working Principle

Iris should become clearer by adding product-facing concepts above the existing runtime contracts before replacing anything below them.

Do not rename or remove `crew-*` runtime IDs, RT bus routes, engine adapters, or existing dashboard APIs until compatibility shims and tests exist.

## Current Runtime Primitives

| Iris concept | Current primitive | Current state |
|---|---|---|
| Iris lead assistant | `crew-lead` runtime agent | Working, exposed through the chat/dashboard surface |
| Specialist agents | Built-in `crew-*` agents plus dynamic agent configs | Working, but product labels are still being layered on top |
| Dispatch | RT bus task assignment, `@@DISPATCH`, `@@PIPELINE`, wave dispatcher | Working, but not represented as durable user-facing plan state |
| Conversation | Project/general message history and chat bubbles | Working, but not enough for audit/review workflows |
| Evidence | Task completions, produced files, messages, logs | Exists across systems, but not normalized into an Iris evidence model |
| Memory | AgentMemory, AgentKeeper, project messages, optional RAG | Exists, but product semantics are not yet unified |
| Review | Manual inspection through dashboard/files/logs | No explicit review gate for high-impact changes |
| Conflicts | Merge/worktree errors, agent disagreement in messages | No first-class conflict object or resolution flow |

## Target Product Concepts

### Plan

A plan is the user-visible structure Iris is executing. It should answer:

- What outcome did the user ask for?
- What tasks did Iris create?
- Which agent owns each task?
- What is pending, running, blocked, failed, or done?
- What evidence supports each completed step?
- What changed after revisions?

Current gap: pipeline/wave state exists, but there is no stable Iris-facing plan object that can be inspected, resumed, revised, and audited.

### Task

A task is a single unit of delegated work. It should include:

- Stable task ID
- Parent plan ID
- Assigned agent runtime ID and Iris display label
- Prompt/instructions snapshot
- Allowed tools/permissions snapshot
- Status and timestamps
- Output summary
- Evidence links
- Failure reason when applicable

Current gap: task dispatch exists, but task state is scattered across RT messages, task logs, and completion records.

### Evidence

Evidence is anything Iris can point to when explaining a conclusion. Examples:

- File path and diff summary
- Test command and result
- Agent message excerpt
- Runtime log excerpt
- Created artifact
- External source citation, when applicable

Current gap: evidence is not normalized or attached to plan/task records.

### Review

A review is a user checkpoint before risky actions or final acceptance. It should show:

- Proposed change or decision
- Evidence supporting it
- Known risks
- Conflicts or unresolved questions
- Approve/reject/revise actions

Current gap: the user can inspect manually, but Iris cannot yet produce a first-class review packet.

### Conflict

A conflict is a disagreement or incompatible result Iris must resolve. It can come from:

- Two agents recommending different actions
- A failed merge/worktree operation
- Test results contradicting an agent claim
- Missing evidence for a claimed completion

Current gap: conflicts are implicit in messages/logs instead of explicit state.

## Phase 1 Candidate Slices

### Slice 3: Iris Plan Skeleton

Add a read/write plan record without changing dispatch behavior.

Acceptance criteria:

- A plan can be created for a user request.
- A plan has stable ID, title, status, created/updated timestamps, and task list.
- Plan records can be stored locally in the existing config/state area.
- Existing dispatch can run without needing a plan.
- Tests cover plan creation, update, and status transitions.

Current implementation:

- `lib/iris/plans.mjs` stores flat JSON plan records under the existing state directory, with `projectId` as filterable metadata.
- `scripts/dashboard.mjs` exposes minimal `/api/iris/plans` endpoints for dashboard read/create/status use.
- No dispatch, RT bus, or engine adapter behavior depends on plan records yet.

### Slice 4: Task And Evidence Records

Attach task/evidence metadata around existing dispatch outputs.

Acceptance criteria:

- A task can reference an existing runtime agent ID and Iris label.
- A task can collect evidence entries without changing the RT bus.
- Evidence supports at least file, command, message, and note types.
- Evidence records are serializable and validated.

Current implementation — Evidence v1:

- Evidence lives embedded in the plan's JSON file (`plan.evidence`, an
  array), not a separate store. No SQLite.
- Five types in v1: `file`, `command`, `message`, `note`, `artifact`.
- Common fields on every evidence record: `id`, `planId`, `taskId`
  (nullable), `type`, `title`, `summary` (nullable), `createdAt`, `source`
  (freeform object or null), `data` (type-specific object), `metadata`.
- Required fields inside `data`, enforced by `addIrisPlanEvidence`:
  - `file` → `path`
  - `command` → `command`
  - `message` → `excerpt`
  - `note` → `text`
  - `artifact` → `path` or `url` (either one)
- `id` and `title` are auto-generated when omitted (title falls back to a
  type-specific default like `File: <path>`); `createdAt` defaults to now.
- `lib/iris/plans.mjs` exports `addIrisPlanEvidence(planId, evidence, options?)`
  and `listIrisPlanEvidence(planId, options?)`. Setting `evidence.taskId`
  attaches the new evidence id to that task's `evidenceIds` — the referenced
  task must already exist on the plan or the call throws.
- **Evidence is manually attached only.** Nothing reads RT messages, task
  logs, or the filesystem to generate evidence automatically. A caller
  (dashboard, CLI, or a future dispatch hook) has to call
  `addIrisPlanEvidence` explicitly. This is deliberate: Iris should not
  claim proof of something it did not actually verify.
- Backward compatibility: plans written before Evidence v1 (missing the
  `evidence` key) or containing hand-edited/malformed evidence entries
  still load without throwing — `loadIrisPlan`/`listIrisPlans` pass
  existing evidence through as-is. Only *new* evidence added via
  `addIrisPlanEvidence` is validated against the schema above.
- The dashboard does not render evidence yet — Slice 5's Plan View still
  only shows plan/task fields. Surfacing evidence read-only is left for a
  follow-up once there's a real evidence-producing caller, so the UI isn't
  built around empty arrays.

### Slice 5: Dashboard Plan View

Expose plan/task/evidence records in the dashboard.

Acceptance criteria:

- Chat can show the active plan summary.
- User can inspect tasks and evidence without reading raw RT logs.
- Internal `crew-*` IDs are shown only as runtime metadata.

### Slice 6: Review Packet

Create a user-facing review packet from a plan/task set.

Acceptance criteria:

- Iris can summarize what changed and why.
- Review packet links to evidence.
- Review packet marks unresolved risks/conflicts.
- No automatic high-impact action is introduced in this slice.

Current implementation — Review Packet v1:

- **Not an approval or automation system.** Creating a review packet never
  changes a plan's or task's status. A risk, open question, or
  recommendation is only as credible as the `evidenceIds` it actually
  points to — the packet itself makes no independent verification claim.
- Review packets live embedded in the plan's JSON file (`plan.reviews`, an
  array), same storage model as evidence. No SQLite, no separate store.
- Schema: `id`, `planId`, `title`, `summary`, `status`
  (`draft` | `ready` | `archived`), `createdAt`, `updatedAt`, `taskIds`,
  `evidenceIds`, `risks`, `openQuestions`, `recommendations`, `metadata`.
- `risks` / `openQuestions` / `recommendations` share one item shape: `id`,
  `text` (required), `severity` (optional, `low` | `medium` | `high`),
  `evidenceIds` (optional), `taskIds` (optional).
- `lib/iris/plans.mjs` exports `createIrisPlanReview(planId, review, options?)`,
  `listIrisPlanReviews(planId, options?)`, and
  `loadIrisPlanReview(planId, reviewId, options?)`.
- Validation: `status` and any item `severity` must be one of the allowed
  values; every `taskIds`/`evidenceIds` entry (at the packet level and
  inside each risk/question/recommendation) must reference something that
  actually exists on the plan, or the call throws. `id`/`title`/timestamps
  auto-generate when omitted.
- **Append-only in v1** — no update or delete on a review packet, matching
  evidence's own append-only model. A new packet is the way to reflect a
  changed understanding of the plan.
- Backward compatible: plans written before this slice have no `reviews`
  key and default to `[]` on load, same passthrough rule as evidence.
- The dashboard renders review packets read-only in the Plan View's
  Reviews section (status badge, summary, referenced task/evidence
  counts, and risks/open questions/recommendations with resolved
  task/evidence labels). No create/edit/status controls exist yet.

Current implementation — Review Generator v1:

- **Deterministic, non-LLM, and not a verification.** `generateIrisPlanReview`
  in `lib/iris/plans.mjs` builds a draft review packet purely by reading a
  plan's existing tasks and evidence — it makes no model call and invents
  no facts. Every risk, open question, and recommendation it produces is a
  direct, templated restatement of something already on the plan (a task's
  status, whether a task has a summary, whether a task has any evidence
  linked via `evidence.taskId`). It does not confirm those facts are
  correct — it restates what the records already say.
- Always produces `status: "draft"`, never `"ready"` — generating a
  summary of records is not the same as a human or Iris actually having
  reviewed them. Nothing promotes a generated packet to `"ready"`
  automatically, now or later, without an explicit call elsewhere.
- Scope: defaults to every task on the plan; pass `options.taskIds` to
  scope to a subset (unknown ids throw). Evidence: includes evidence
  linked to an in-scope task via `taskId`; pass
  `options.includePlanEvidence: true` to also include evidence with no
  `taskId` (plan-level evidence).
- Generated content, by condition:
  - Failed task → risk (`severity: "high"`); blocked task → risk
    (`severity: "medium"`).
  - Any in-scope tasks with no linked evidence → one aggregate risk
    ("N task(s) have no attached evidence.") and one aggregate open
    question phrased as a question, not a restated fact.
  - Any in-scope tasks with no `summary` → one aggregate open question.
  - Any failed/blocked tasks → one recommendation to resolve them before
    treating the plan as complete.
  - All in-scope tasks `done` but zero evidence attached → one
    recommendation noting completion isn't supported by attached evidence.
  - A clean plan (all done, evidence attached, no gaps) generates a draft
    with empty `risks`/`openQuestions`/`recommendations` — the generator
    does not manufacture concerns that aren't there.
- `metadata: { generated: true, generatedBy: "generateIrisPlanReview" }` on
  every generated packet, so callers/UI can distinguish a generated
  summary from a manually authored review packet.
- Not wired to chat, dispatch, RT bus, or any runtime event — nothing
  calls this automatically. It is a helper a future caller (CLI, dashboard
  button, or Iris itself) can invoke; this slice only adds the function.

### Slice 7: Chat → Plan Bridge

Automatically create a draft Iris plan when a chat message looks like a
request for Iris to coordinate multi-step work, instead of only ever
creating plans through helpers/API.

Current implementation:

- `lib/iris/chat-plan-bridge.mjs` — `looksLikeCoordinationRequest(text)` is
  a deterministic, regex-based heuristic (no LLM call), styled after
  `lib/crew-lead/intent.mjs`'s `parseServiceIntent`. Deliberately
  over-inclusive: a false positive just creates an extra cheap, inert,
  inspectable draft plan; a false negative silently loses the point of
  this slice, which is the worse failure mode.
  `createDraftPlanFromChatRequest(text, options)` calls the heuristic and,
  on a match (or when `options.force: true`), creates a plan via the
  existing `createIrisPlan` — always `status: "draft"`, never further
  along, with `metadata: { source: "chat", detected }` so a generated plan
  is distinguishable from a manually created one.
- **This is the first slice to touch crew-lead runtime code**, done only
  after explicit sign-off (Tyler: "Claude take crew-lead wiring"). The
  actual edit in `lib/crew-lead/chat-handler.mjs` is one import line and a
  4-line `try/catch` call at the top of `handleChat`, right after
  `sharedThreadId` is computed and before any existing branch. It cannot
  alter `handleChat`'s existing control flow, return value, or shared
  state, and a failure inside it is caught and logged, never thrown.
- Full behavioral coverage lives in
  `test/unit/iris-chat-plan-bridge.test.mjs`, run in isolation against the
  pure `chat-plan-bridge.mjs` functions. The one-call-site change inside
  `handleChat` itself is *not* covered by an end-to-end test —
  `handleChat` has a large, deeply-coupled dependency surface
  (`_deps.loadConfig`, `loadHistory`, `appendHistory`, `broadcastSSE`, and
  more used later in the function) that would take disproportionate effort
  to stub just to exercise 4 already-isolated lines. Verified instead via
  `node --check` on the edited file and the existing
  `chat-handler-mentions.test.mjs` / `agent-roster-deterministic.test.mjs`
  suites still passing unchanged.
- Not wired to dispatch, RT bus, or engine adapters — this slice only
  decides whether a plan record should exist.

### Slice 8: Plan Task → Dispatch Linking (bridge only, not wired)

A plan task and a real RT/dispatch task are currently unrelated — a plan
task has no way to point at the actual work item dispatch created for it.

Current implementation:

- `task.dispatchTaskId` (nullable) added to the task schema in
  `lib/iris/plans.mjs`. Backward compatible — existing task records
  without it just load as `null`.
- `linkIrisPlanTaskToDispatch(planId, taskId, dispatchTaskId, options?)` is
  the only function that ever writes this field. It never generates a
  dispatch id itself — it only records one a caller already has.
- **Not wired to dispatch, the RT bus, `gateway-bridge.mjs`, or
  `wave-dispatcher.mjs`.** Nothing calls this function yet. The real work —
  having dispatch call back into Iris once it actually creates a task for
  a plan's task — touches files explicitly protected across every slice
  in this project and needs its own explicit ownership handoff before
  anyone edits them, the same way chat-handler.mjs wiring did in Slice 7.

## Suggested Next Implementation

Start with Slice 3: Iris Plan Skeleton.

Reason: it is additive, testable, and creates the anchor needed for evidence, review, and conflict handling. It should live above existing dispatch and should not require changing the RT bus, engine adapters, or lead-agent runtime contract.
