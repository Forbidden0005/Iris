import { describe, test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DIR = path.join(os.tmpdir(), `iris-plans-test-${process.pid}`);
process.env.CREWSWARM_STATE_DIR = TEST_DIR;

import { resetPaths } from "../../lib/runtime/paths.mjs";
import {
  addIrisPlanTask,
  clearIrisPlans,
  createIrisPlan,
  listIrisPlans,
  loadIrisPlan,
  updateIrisPlanStatus,
  updateIrisPlanTaskStatus,
} from "../../lib/iris/plans.mjs";

function sanitizePathSegment(value, fallback = "general") {
  const clean = String(value || fallback)
    .replace(/[^a-z0-9_.-]/gi, "_")
    .slice(0, 100);
  if (clean === "." || clean === "..") return fallback;
  return clean || fallback;
}

before(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  resetPaths();
});

afterEach(() => {
  clearIrisPlans();
});

describe("Iris plan skeleton", () => {
  test("creates and persists a plan without touching dispatch", () => {
    const plan = createIrisPlan({
      id: "plan-test-1",
      title: "Investigate dashboard",
      userRequest: "Find the dashboard issue",
      projectId: "iris",
      requestedBy: "tyler",
    }, { now: Date.parse("2026-09-14T10:00:00.000Z") });

    assert.equal(plan.id, "plan-test-1");
    assert.equal(plan.status, "draft");
    assert.equal(plan.title, "Investigate dashboard");
    assert.equal(plan.projectId, "iris");
    assert.equal(plan.requestedBy, "tyler");
    assert.deepEqual(plan.tasks, []);

    const loaded = loadIrisPlan("plan-test-1");
    assert.deepEqual(loaded, plan);
  });

  test("adds tasks with stable runtime IDs and Iris display labels", () => {
    createIrisPlan({ id: "plan-task-map", userRequest: "Build the thing" });

    const task = addIrisPlanTask("plan-task-map", {
      id: "task-builder",
      title: "Implement UI",
      instructions: "Patch the dashboard UI",
      agentId: "builder",
      allowedTools: ["read", "write"],
    }, { now: Date.parse("2026-09-14T10:05:00.000Z") });

    assert.equal(task.id, "task-builder");
    assert.equal(task.runtimeAgentId, "crew-coder");
    assert.equal(task.displayName, "Builder");
    assert.equal(task.status, "pending");
    assert.deepEqual(task.allowedTools, ["read", "write"]);

    const loaded = loadIrisPlan("plan-task-map");
    assert.equal(loaded.tasks.length, 1);
    assert.equal(loaded.tasks[0].runtimeAgentId, "crew-coder");
  });

  test("updates plan and task statuses with timestamps", () => {
    createIrisPlan({ id: "plan-status", userRequest: "Audit repo" }, {
      now: Date.parse("2026-09-14T10:00:00.000Z"),
    });
    addIrisPlanTask("plan-status", { id: "task-qa", agentId: "qa", title: "Review" }, {
      now: Date.parse("2026-09-14T10:01:00.000Z"),
    });

    const active = updateIrisPlanStatus("plan-status", "active", {
      now: Date.parse("2026-09-14T10:02:00.000Z"),
    });
    assert.equal(active.status, "active");
    assert.equal(active.updatedAt, "2026-09-14T10:02:00.000Z");

    const doneTask = updateIrisPlanTaskStatus(
      "plan-status",
      "task-qa",
      "done",
      { summary: "No blocking issues", evidenceIds: ["evidence-1"] },
      { now: Date.parse("2026-09-14T10:03:00.000Z") },
    );
    assert.equal(doneTask.status, "done");
    assert.equal(doneTask.summary, "No blocking issues");
    assert.deepEqual(doneTask.evidenceIds, ["evidence-1"]);

    const loaded = loadIrisPlan("plan-status");
    assert.equal(loaded.updatedAt, "2026-09-14T10:03:00.000Z");
    assert.equal(loaded.tasks[0].updatedAt, "2026-09-14T10:03:00.000Z");
  });

  test("lists plans newest first and filters by project", () => {
    createIrisPlan({ id: "plan-old", projectId: "a", userRequest: "Old" }, {
      now: Date.parse("2026-09-14T10:00:00.000Z"),
    });
    createIrisPlan({ id: "plan-new", projectId: "b", userRequest: "New" }, {
      now: Date.parse("2026-09-14T11:00:00.000Z"),
    });

    assert.deepEqual(listIrisPlans().map((plan) => plan.id), ["plan-new", "plan-old"]);
    assert.deepEqual(listIrisPlans({ projectId: "a" }).map((plan) => plan.id), ["plan-old"]);
  });

  test("stores flat plan files without allowing path traversal", () => {
    const unsafePlanId = "..\\evil/plan:name";
    const plan = createIrisPlan({
      id: unsafePlanId,
      projectId: "iris",
      userRequest: "Keep this inside the Iris state dir",
    });

    assert.equal(plan.id, unsafePlanId);
    assert.equal(loadIrisPlan(unsafePlanId).id, unsafePlanId);

    const root = path.join(TEST_DIR, "iris-plans");
    const files = fs.readdirSync(root).filter((entry) => entry.endsWith(".json"));
    assert.deepEqual(files, [`${sanitizePathSegment(unsafePlanId, "plan")}.json`]);
    assert.equal(fs.existsSync(path.join(root, files[0])), true);
  });

  test("rejects invalid plan and task statuses", () => {
    assert.throws(
      () => createIrisPlan({ id: "bad-plan", status: "wat", userRequest: "No" }),
      /Invalid Iris plan status/,
    );

    createIrisPlan({ id: "good-plan", userRequest: "Yes" });
    assert.throws(
      () => addIrisPlanTask("good-plan", { id: "bad-task", status: "wat" }),
      /Invalid Iris task status/,
    );
  });
});
