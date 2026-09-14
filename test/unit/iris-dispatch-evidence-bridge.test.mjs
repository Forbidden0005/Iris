import { describe, test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DIR = path.join(os.tmpdir(), `iris-dispatch-evidence-bridge-test-${process.pid}`);
process.env.CREWSWARM_STATE_DIR = TEST_DIR;

import { resetPaths } from "../../lib/runtime/paths.mjs";
import { clearIrisPlans, createIrisPlan, addIrisPlanTask, loadIrisPlan } from "../../lib/iris/plans.mjs";
import { attachEvidenceFromDispatchCompletion } from "../../lib/iris/dispatch-evidence-bridge.mjs";

before(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  resetPaths();
});

afterEach(() => {
  clearIrisPlans();
});

describe("attachEvidenceFromDispatchCompletion", () => {
  test("attaches passing evidence for a done completion", () => {
    createIrisPlan({ id: "plan-completion-pass", userRequest: "Test pass mapping" });
    const task = addIrisPlanTask("plan-completion-pass", { id: "task-a", title: "A" });

    const evidence = attachEvidenceFromDispatchCompletion(
      "plan-completion-pass",
      task.id,
      { taskKey: "hash:abc123", status: "done", owner: "crew-coder", attempt: 1 },
      { now: Date.parse("2026-09-14T17:00:00.000Z") },
    );

    assert.equal(evidence.type, "command");
    assert.equal(evidence.taskId, task.id);
    assert.equal(evidence.data.passed, true);
    assert.equal(evidence.data.command, "hash:abc123");
    assert.equal(evidence.source.owner, "crew-coder");
    assert.equal(evidence.source.attempt, 1);
    assert.equal(evidence.metadata.generated, true);

    const loaded = loadIrisPlan("plan-completion-pass");
    assert.ok(loaded.tasks[0].evidenceIds.includes(evidence.id));
  });

  test("attaches failing evidence with error excerpt for a non-done completion", () => {
    createIrisPlan({ id: "plan-completion-fail", userRequest: "Test fail mapping" });
    const task = addIrisPlanTask("plan-completion-fail", { id: "task-a", title: "A" });

    const evidence = attachEvidenceFromDispatchCompletion("plan-completion-fail", task.id, {
      taskKey: "hash:def456",
      status: "failed",
      owner: "crew-coder",
      attempt: 2,
      error: "Timeout waiting for response",
    });

    assert.equal(evidence.data.passed, false);
    assert.equal(evidence.data.outputExcerpt, "Timeout waiting for response");
  });

  test("omits outputExcerpt when there is no error or note", () => {
    createIrisPlan({ id: "plan-completion-empty", userRequest: "Test empty excerpt" });
    const task = addIrisPlanTask("plan-completion-empty", { id: "task-a", title: "A" });

    const evidence = attachEvidenceFromDispatchCompletion("plan-completion-empty", task.id, {
      taskKey: "hash:ghi789",
      status: "done",
    });

    assert.equal(Object.prototype.hasOwnProperty.call(evidence.data, "outputExcerpt"), false);
  });

  test("throws for an unknown task, same as addIrisPlanEvidence", () => {
    createIrisPlan({ id: "plan-completion-unknown", userRequest: "Unknown task" });
    assert.throws(
      () =>
        attachEvidenceFromDispatchCompletion("plan-completion-unknown", "no-such-task", {
          taskKey: "x",
          status: "done",
        }),
      /Iris task not found: no-such-task/,
    );
  });
});
