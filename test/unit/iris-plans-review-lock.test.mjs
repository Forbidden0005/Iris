import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TASK_WORKER = path.join(__dirname, "helpers", "iris-plan-lock-worker.mjs");
const REVIEW_WORKER = path.join(__dirname, "helpers", "iris-plan-review-worker.mjs");

const TEST_DIR = path.join(os.tmpdir(), `iris-plans-review-lock-test-${process.pid}`);
process.env.IRIS_STATE_DIR = TEST_DIR;

import { resetPaths } from "../../lib/runtime/paths.mjs";
import { createIrisPlan, loadIrisPlan, clearIrisPlans } from "../../lib/iris/plans.mjs";

before(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  resetPaths();
});

after(() => {
  clearIrisPlans();
});

function runWorker(script, args) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [script, ...args], { env: process.env }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`worker failed: ${err.message}\n${stderr}`));
      resolve();
    });
  });
}

describe("Iris plan review-generation locking (cross-process)", () => {
  test("generateIrisPlanReview's read-derive-write does not lose concurrent task writes or generated reviews", async () => {
    const plan = createIrisPlan({
      id: `iris-review-lock-test-${Date.now()}`,
      title: "Review-lock concurrency test",
      userRequest: "Prove review generation is covered by one lock across read + write.",
      projectId: "iris-review-lock-test",
    });

    const TASK_COUNT = 6;
    const REVIEW_COUNT = 6;
    const taskLabels = Array.from({ length: TASK_COUNT }, (_, i) => `t${i}`);
    const reviewLabels = Array.from({ length: REVIEW_COUNT }, (_, i) => `r${i}`);

    // Interleave task-adds and review-generations across processes so the
    // lock (not just luck) has to serialize a generateIrisPlanReview
    // read-derive-write against a concurrent addIrisPlanTask
    // read-modify-write on the same plan file.
    await Promise.all([
      ...taskLabels.map((label) => runWorker(TASK_WORKER, [plan.id, label])),
      ...reviewLabels.map((label) => runWorker(REVIEW_WORKER, [plan.id, label])),
    ]);

    const reloaded = loadIrisPlan(plan.id);

    assert.equal(
      reloaded.tasks.length,
      TASK_COUNT,
      `expected all ${TASK_COUNT} concurrent task-adds to survive alongside concurrent review generation, got ${reloaded.tasks.length}`,
    );
    assert.equal(
      reloaded.reviews.length,
      REVIEW_COUNT,
      `expected all ${REVIEW_COUNT} concurrently generated reviews to survive, got ${reloaded.reviews.length} — one write was dropped`,
    );

    // Every review's taskIds/evidenceIds must reference records that
    // actually exist on the final plan (loadIrisPlanReview-style ids
    // pointing nowhere would mean a review was generated from, or saved
    // over, an inconsistent snapshot).
    const validTaskIds = new Set(reloaded.tasks.map((t) => t.id));
    for (const review of reloaded.reviews) {
      for (const taskId of review.taskIds) {
        assert.ok(validTaskIds.has(taskId), `review ${review.id} references unknown task ${taskId}`);
      }
    }
  });
});
