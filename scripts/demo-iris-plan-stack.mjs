#!/usr/bin/env node
/**
 * Local end-to-end demo of the Iris plan/task/evidence/review/conflict
 * stack — no LLM, no dispatch, no RT bus, no dashboard or server startup.
 * Walks through every public helper in lib/iris/plans.mjs once, in the
 * order a real (manual) workflow would use them, and prints what
 * happened at each step.
 *
 * This is a narrated walkthrough, not an assertion-based test — for that,
 * see scripts/smoke-iris-plan-stack.mjs and test/unit/iris-plans.test.mjs.
 *
 * State dir: same rule as the smoke script — uses CREWSWARM_STATE_DIR as
 * given if the caller set it; otherwise creates a private temp directory
 * for this run and removes it when done, so normal user state under
 * ~/.crewswarm is never touched by default.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const usingCallerStateDir = Boolean(process.env.CREWSWARM_STATE_DIR);
let tempStateDir = null;

if (!usingCallerStateDir) {
  tempStateDir = fs.mkdtempSync(path.join(os.tmpdir(), "iris-demo-plan-stack-"));
  process.env.CREWSWARM_STATE_DIR = tempStateDir;
}

const { resetPaths, getStatePath } = await import("../lib/runtime/paths.mjs");
resetPaths();

const {
  createIrisPlan,
  addIrisPlanTask,
  addIrisPlanEvidence,
  generateIrisPlanReview,
  createIrisPlanConflict,
  resolveIrisPlanConflict,
  loadIrisPlan,
} = await import("../lib/iris/plans.mjs");

function section(title) {
  console.log("");
  console.log(`── ${title} ──`);
}

async function run() {
  const runId = Date.now();
  const planId = `iris-demo-${runId}`;

  console.log("[iris-demo] Local Iris plan/task/evidence/review/conflict walkthrough");
  console.log(`[iris-demo] stateDir=${getStatePath()} (${usingCallerStateDir ? "caller-provided" : "temp, will be removed"})`);

  section("1. Create plan");
  const plan = createIrisPlan({
    id: planId,
    title: "Fix the flaky auth test",
    userRequest: "Track down and fix the intermittent auth test failure.",
    projectId: "iris-demo",
  });
  console.log(`Created plan "${plan.title}" (${plan.id}), status=${plan.status}`);

  section("2. Add task");
  const task = addIrisPlanTask(planId, {
    id: `${planId}-task`,
    agentId: "coder",
    title: "Investigate and fix the race condition",
    instructions: "Run the auth suite 20x, find the race, patch it.",
  });
  console.log(`Added task "${task.title}" → runtime agent ${task.runtimeAgentId} (${task.displayName})`);

  section("3. Attach evidence");
  const evidence = addIrisPlanEvidence(planId, {
    type: "command",
    taskId: task.id,
    title: "Test run after fix",
    data: { command: "npm test -- auth", exitCode: 0, passed: true },
  });
  console.log(`Attached evidence "${evidence.title}" (${evidence.type}), passed=${evidence.data.passed}`);

  section("4. Generate draft review");
  const review = generateIrisPlanReview(planId);
  console.log(`Generated review "${review.title}" (status=${review.status})`);
  console.log(`  ${review.summary}`);
  if (review.risks.length) console.log(`  Risks: ${review.risks.map((r) => r.text).join("; ")}`);
  if (review.openQuestions.length) {
    console.log(`  Open questions: ${review.openQuestions.map((q) => q.text).join("; ")}`);
  }
  if (review.recommendations.length) {
    console.log(`  Recommendations: ${review.recommendations.map((r) => r.text).join("; ")}`);
  }

  section("5. Create conflict");
  const conflict = createIrisPlanConflict(planId, {
    type: "test_vs_claim",
    description: "An earlier report claimed this was fixed, but the suite was still flaky at the time.",
    taskIds: [task.id],
    evidenceIds: [evidence.id],
  });
  console.log(`Recorded conflict (${conflict.type}), status=${conflict.status}`);

  section("6. Resolve conflict");
  const resolved = resolveIrisPlanConflict(
    planId,
    conflict.id,
    "resolved",
    "Re-ran the suite 20x after the fix landed — all green, evidence attached above.",
  );
  console.log(`Conflict now ${resolved.status}: "${resolved.resolution}"`);

  section("7. Final state");
  const finalPlan = loadIrisPlan(planId);
  console.log(`Plan "${finalPlan.title}" (${finalPlan.id})`);
  console.log(`  tasks: ${finalPlan.tasks.length}`);
  console.log(`  evidence: ${finalPlan.evidence.length}`);
  console.log(`  reviews: ${finalPlan.reviews.length}`);
  console.log(`  conflicts: ${finalPlan.conflicts.length} (${finalPlan.conflicts.filter((c) => c.status !== "open").length} closed)`);

  console.log("");
  console.log("[iris-demo] Done.");
  if (usingCallerStateDir) {
    console.log(`  Plan file: ${path.join(getStatePath("iris-plans"), `${planId}.json`)}`);
  } else {
    console.log(`  Temp state dir will be removed: ${tempStateDir}`);
  }
}

run()
  .then(() => cleanup())
  .catch((err) => {
    console.error(`[iris-demo] FAIL: ${err.message}`);
    cleanup();
    process.exit(1);
  });

function cleanup() {
  if (!usingCallerStateDir && tempStateDir) {
    try {
      fs.rmSync(tempStateDir, { recursive: true, force: true });
    } catch {
      // Best-effort — OS temp dirs get reaped eventually regardless.
    }
  }
}
