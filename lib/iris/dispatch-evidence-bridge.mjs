/**
 * Dispatch completion → Evidence bridge.
 *
 * Maps a dispatch-completion-shaped record ({taskKey, status, owner, error,
 * note}) into an Iris evidence record via the existing lib/iris/plans.mjs
 * API. Deterministic mapping only — no LLM call, no verification beyond
 * restating what the completion record itself already claims (a
 * "passed: true" here means "dispatch reported this reply as a real
 * completion," not "Iris independently confirmed this work is correct").
 *
 * Wired into lib/crew-lead/ws-router.mjs's task.done and task.failed
 * handlers, guarded there by `dispatch.irisPlanId && dispatch.irisTaskId`
 * (only set when a caller opted in via pipelineMeta at dispatch time — see
 * lib/crew-lead/wave-dispatcher.mjs and lib/crew-lead/http-server.mjs's
 * /api/dispatch route). On the done path, this is only called once a
 * reply has passed ws-router's own question/plan/bailout auto-retry
 * checks — a reply that would trigger a retry must never be recorded as
 * passed:true. On the failed path, it is only called once no rate-limit
 * retry/fallback actually redispatched the task. See
 * docs/IRIS_CAPABILITY_MAP.md's Slice 9 note for the product-level design.
 */
import { addIrisPlanEvidence } from "./plans.mjs";

/**
 * @param {string} planId
 * @param {string} taskId - the Iris plan task this completion belongs to
 * @param {object} completion - a finalizeTaskState-shaped record
 * @param {string} [completion.taskKey]
 * @param {string} [completion.status] - "done" maps to data.passed: true
 * @param {string} [completion.owner]
 * @param {number} [completion.attempt]
 * @param {string} [completion.error]
 * @param {string} [completion.note]
 * @param {object} [options] - forwarded to addIrisPlanEvidence (e.g. now, projectId)
 * @returns {object} the created evidence record
 */
export function attachEvidenceFromDispatchCompletion(planId, taskId, completion = {}, options = {}) {
  const passed = completion.status === "done";
  const outputExcerpt = String(completion.error || completion.note || "").trim().slice(0, 2000);

  const data = {
    command: completion.taskKey || "dispatch task",
    passed,
  };
  if (outputExcerpt) data.outputExcerpt = outputExcerpt;

  return addIrisPlanEvidence(
    planId,
    {
      type: "command",
      taskId,
      title: `Dispatch completion: ${completion.taskKey || "unknown task"}`,
      source: {
        bridge: "attachEvidenceFromDispatchCompletion",
        taskKey: completion.taskKey || null,
        owner: completion.owner || null,
        attempt: completion.attempt ?? null,
      },
      data,
      metadata: { generated: true, generatedBy: "attachEvidenceFromDispatchCompletion" },
    },
    options,
  );
}
