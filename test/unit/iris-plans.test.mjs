import { describe, test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DIR = path.join(os.tmpdir(), `iris-plans-test-${process.pid}`);
process.env.CREWSWARM_STATE_DIR = TEST_DIR;

import { resetPaths } from "../../lib/runtime/paths.mjs";
import {
  addIrisPlanEvidence,
  addIrisPlanTask,
  clearIrisPlans,
  createIrisPlan,
  listIrisPlanEvidence,
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

describe("Iris plan evidence", () => {
  test("adds evidence to a plan", () => {
    createIrisPlan({ id: "plan-evidence-basic", userRequest: "Ship the thing" });

    const record = addIrisPlanEvidence("plan-evidence-basic", {
      type: "note",
      data: { text: "Looked fine on manual check" },
    }, { now: Date.parse("2026-09-14T12:00:00.000Z") });

    assert.equal(record.type, "note");
    assert.equal(record.planId, "plan-evidence-basic");
    assert.equal(record.data.text, "Looked fine on manual check");
    assert.equal(record.createdAt, "2026-09-14T12:00:00.000Z");

    const loaded = loadIrisPlan("plan-evidence-basic");
    assert.equal(loaded.evidence.length, 1);
    assert.equal(loaded.evidence[0].id, record.id);

    const listed = listIrisPlanEvidence("plan-evidence-basic");
    assert.deepEqual(listed, loaded.evidence);
  });

  test("generates a stable evidence id when omitted", () => {
    createIrisPlan({ id: "plan-evidence-id", userRequest: "Check ids" });
    const record = addIrisPlanEvidence("plan-evidence-id", {
      type: "note",
      data: { text: "note" },
    });
    assert.match(record.id, /^evidence_/);

    const withId = addIrisPlanEvidence("plan-evidence-id", {
      id: "evidence-fixed",
      type: "note",
      data: { text: "second note" },
    });
    assert.equal(withId.id, "evidence-fixed");
  });

  test("requires type-specific fields", () => {
    createIrisPlan({ id: "plan-evidence-required", userRequest: "Check required fields" });

    assert.throws(
      () => addIrisPlanEvidence("plan-evidence-required", { type: "file", data: {} }),
      /requires data\.path/,
    );
    assert.throws(
      () => addIrisPlanEvidence("plan-evidence-required", { type: "command", data: {} }),
      /requires data\.command/,
    );
    assert.throws(
      () => addIrisPlanEvidence("plan-evidence-required", { type: "message", data: {} }),
      /requires data\.excerpt/,
    );
    assert.throws(
      () => addIrisPlanEvidence("plan-evidence-required", { type: "note", data: {} }),
      /requires data\.text/,
    );
    assert.throws(
      () => addIrisPlanEvidence("plan-evidence-required", { type: "artifact", data: {} }),
      /requires data\.path or data\.url/,
    );

    // Valid minimal records for each type should not throw.
    addIrisPlanEvidence("plan-evidence-required", { type: "file", data: { path: "a.txt" } });
    addIrisPlanEvidence("plan-evidence-required", { type: "command", data: { command: "npm test" } });
    addIrisPlanEvidence("plan-evidence-required", { type: "message", data: { excerpt: "looks good" } });
    addIrisPlanEvidence("plan-evidence-required", { type: "artifact", data: { url: "https://example.com" } });
  });

  test("rejects an invalid evidence type", () => {
    createIrisPlan({ id: "plan-evidence-invalid-type", userRequest: "Check type validation" });
    assert.throws(
      () => addIrisPlanEvidence("plan-evidence-invalid-type", { type: "screenshot", data: {} }),
      /Invalid Iris evidence type/,
    );
  });

  test("attaches evidence id to the referenced task", () => {
    createIrisPlan({ id: "plan-evidence-task", userRequest: "Link evidence to a task" });
    const task = addIrisPlanTask("plan-evidence-task", {
      id: "task-with-evidence",
      agentId: "qa",
      title: "Run tests",
    });
    assert.deepEqual(task.evidenceIds, []);

    const record = addIrisPlanEvidence("plan-evidence-task", {
      type: "command",
      taskId: "task-with-evidence",
      data: { command: "npm test", exitCode: 0, passed: true },
    });

    const loaded = loadIrisPlan("plan-evidence-task");
    const loadedTask = loaded.tasks.find((t) => t.id === "task-with-evidence");
    assert.deepEqual(loadedTask.evidenceIds, [record.id]);

    assert.throws(
      () =>
        addIrisPlanEvidence("plan-evidence-task", {
          type: "note",
          taskId: "no-such-task",
          data: { text: "orphaned" },
        }),
      /Iris task not found: no-such-task/,
    );
  });

  test("old plans with missing or raw evidence still load", () => {
    // Simulate a plan file written before Evidence v1 existed: no evidence
    // key at all, plus a second plan with a malformed evidence entry.
    const root = path.join(TEST_DIR, "iris-plans");
    fs.mkdirSync(root, { recursive: true });

    fs.writeFileSync(
      path.join(root, "legacy-no-evidence.json"),
      JSON.stringify({
        id: "legacy-no-evidence",
        userRequest: "Predates evidence",
        status: "draft",
        tasks: [],
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      }),
    );

    fs.writeFileSync(
      path.join(root, "legacy-raw-evidence.json"),
      JSON.stringify({
        id: "legacy-raw-evidence",
        userRequest: "Has junk evidence",
        status: "draft",
        tasks: [],
        evidence: [{ note: "not a real evidence record" }],
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      }),
    );

    const noEvidence = loadIrisPlan("legacy-no-evidence");
    assert.deepEqual(noEvidence.evidence, []);

    const rawEvidence = loadIrisPlan("legacy-raw-evidence");
    assert.deepEqual(rawEvidence.evidence, [{ note: "not a real evidence record" }]);

    assert.deepEqual(
      listIrisPlans().map((p) => p.id).sort(),
      ["legacy-no-evidence", "legacy-raw-evidence"],
    );
  });
});
