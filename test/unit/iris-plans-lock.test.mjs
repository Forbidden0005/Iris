import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(__dirname, "helpers", "iris-plan-lock-worker.mjs");

const TEST_DIR = path.join(os.tmpdir(), `iris-plans-lock-test-${process.pid}`);
process.env.CREWSWARM_STATE_DIR = TEST_DIR;

import { resetPaths } from "../../lib/runtime/paths.mjs";
import { createIrisPlan, loadIrisPlan, clearIrisPlans } from "../../lib/iris/plans.mjs";

before(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  resetPaths();
});

after(() => {
  clearIrisPlans();
});

function runWorker(planId, label) {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [WORKER, planId, label],
      { env: process.env },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(`worker ${label} failed: ${err.message}\n${stderr}`));
        resolve();
      },
    );
  });
}

describe("Iris plan file locking (cross-process)", () => {
  test("concurrent addIrisPlanTask calls from separate processes do not drop writes", async () => {
    const plan = createIrisPlan({
      id: `iris-lock-test-${Date.now()}`,
      title: "Plan-lock concurrency test",
      userRequest: "Prove concurrent writers don't clobber each other.",
      projectId: "iris-lock-test",
    });

    const WORKER_COUNT = 8;
    const labels = Array.from({ length: WORKER_COUNT }, (_, i) => `w${i}`);
    await Promise.all(labels.map((label) => runWorker(plan.id, label)));

    const reloaded = loadIrisPlan(plan.id);
    assert.equal(
      reloaded.tasks.length,
      WORKER_COUNT,
      `expected all ${WORKER_COUNT} concurrent task-adds to survive, got ${reloaded.tasks.length} — a write was dropped`,
    );
    const ids = new Set(reloaded.tasks.map((t) => t.id));
    for (const label of labels) {
      assert.ok(ids.has(`${plan.id}-${label}`), `missing task from worker ${label}`);
    }
  });
});
