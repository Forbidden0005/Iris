/**
 * Dispatch completion → Evidence bridge — helper only, NOT wired into
 * dispatch/gateway-bridge/RT bus yet.
 *
 * Maps the completion record shape produced by
 * lib/runtime/task-lease.mjs's finalizeTaskState({taskKey, identity,
 * status, owner, attempt, error, note, completedAt}) into an Iris
 * evidence record via the existing lib/iris/plans.mjs API. Deterministic
 * mapping only — no LLM call, no verification beyond restating what the
 * completion record itself already claims (a "passed: true" here means
 * "dispatch reported status done," not "Iris independently confirmed
 * this work is correct").
 *
 * Deliberately NOT imported by lib/runtime/task-lease.mjs, gateway-bridge,
 * or any dispatch path. Wiring "a dispatch task actually finished" to a
 * call of attachEvidenceFromDispatchCompletion touches those protected
 * files and needs its own explicit ownership handoff — see
 * docs/IRIS_CAPABILITY_MAP.md's Slice 9 note.
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
