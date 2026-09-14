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
- The dashboard does not render review packets yet — left for a follow-up
  once there's a real caller producing them, same reasoning as Evidence
  v1's initial deferral of dashboard work.

## Suggested Next Implementation

Start with Slice 3: Iris Plan Skeleton.

Reason: it is additive, testable, and creates the anchor needed for evidence, review, and conflict handling. It should live above existing dispatch and should not require changing the RT bus, engine adapters, or lead-agent runtime contract.
