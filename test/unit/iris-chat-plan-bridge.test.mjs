import { describe, test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DIR = path.join(os.tmpdir(), `iris-chat-plan-bridge-test-${process.pid}`);
process.env.CREWSWARM_STATE_DIR = TEST_DIR;

import { resetPaths } from "../../lib/runtime/paths.mjs";
import { clearIrisPlans, listIrisPlans } from "../../lib/iris/plans.mjs";
import {
  looksLikeCoordinationRequest,
  createDraftPlanFromChatRequest,
} from "../../lib/iris/chat-plan-bridge.mjs";

before(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  resetPaths();
});

afterEach(() => {
  clearIrisPlans();
});

describe("looksLikeCoordinationRequest", () => {
  test("matches typical coordination phrasing", () => {
    assert.equal(
      looksLikeCoordinationRequest("Build me a team to investigate this repo"),
      true,
    );
    assert.equal(
      looksLikeCoordinationRequest("Can you coordinate the release across agents?"),
      true,
    );
    assert.equal(
      looksLikeCoordinationRequest("Dispatch agents to fix the failing tests"),
      true,
    );
    assert.equal(
      looksLikeCoordinationRequest("Plan the next milestone with backend and UI work"),
      true,
    );
  });

  test("does not match plain questions or small talk", () => {
    assert.equal(looksLikeCoordinationRequest("What time is it?"), false);
    assert.equal(looksLikeCoordinationRequest("Thanks, that worked."), false);
    assert.equal(looksLikeCoordinationRequest("What does this function do?"), false);
    assert.equal(looksLikeCoordinationRequest(""), false);
    assert.equal(looksLikeCoordinationRequest(undefined), false);
  });
});

describe("createDraftPlanFromChatRequest", () => {
  test("creates a draft plan when the message matches the heuristic", () => {
    const plan = createDraftPlanFromChatRequest(
      "Build me a team to audit the dashboard for security issues",
      { projectId: "iris", requestedBy: "tyler", now: Date.parse("2026-09-14T15:00:00.000Z") },
    );

    assert.ok(plan);
    assert.equal(plan.status, "draft");
    assert.equal(plan.projectId, "iris");
    assert.equal(plan.requestedBy, "tyler");
    assert.equal(plan.userRequest, "Build me a team to audit the dashboard for security issues");
    assert.equal(plan.title, "Build me a team to audit the dashboard for security issues");
    assert.equal(plan.metadata.source, "chat");
    assert.equal(plan.metadata.detected, true);
  });

  test("returns null and creates nothing when the message doesn't match", () => {
    const before = listIrisPlans().length;
    const plan = createDraftPlanFromChatRequest("What's the weather like?");
    assert.equal(plan, null);
    assert.equal(listIrisPlans().length, before);
  });

  test("returns null for empty or missing text", () => {
    assert.equal(createDraftPlanFromChatRequest(""), null);
    assert.equal(createDraftPlanFromChatRequest("   "), null);
    assert.equal(createDraftPlanFromChatRequest(undefined), null);
  });

  test("force option creates a plan even when the heuristic doesn't match", () => {
    const plan = createDraftPlanFromChatRequest("What's the weather like?", { force: true });
    assert.ok(plan);
    assert.equal(plan.status, "draft");
    assert.equal(plan.metadata.detected, false);
  });
});
