import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  getIrisAgentLabel,
  IRIS_PRIMARY_ASSISTANT_ID,
  IRIS_PRIMARY_RUNTIME_AGENT_ID,
  normalizeIrisAgentId,
  toIrisAgentView,
} from "../../lib/iris/identity.mjs";

describe("Iris identity layer", () => {
  test("maps Iris primary identity to the existing lead runtime agent", () => {
    assert.equal(IRIS_PRIMARY_ASSISTANT_ID, "iris");
    assert.equal(IRIS_PRIMARY_RUNTIME_AGENT_ID, "iris-lead");
    assert.equal(normalizeIrisAgentId("iris"), "iris-lead");
  });

  test("maps Iris-facing aliases without changing iris runtime ids", () => {
    assert.equal(normalizeIrisAgentId("planner"), "iris-pm");
    assert.equal(normalizeIrisAgentId("builder"), "iris-coder");
    assert.equal(normalizeIrisAgentId("qa"), "iris-qa");
    assert.equal(normalizeIrisAgentId("iris-security"), "iris-security");
  });

  test("keeps bare iris-style ids compatible", () => {
    assert.equal(normalizeIrisAgentId("coder"), "iris-coder");
    assert.equal(normalizeIrisAgentId("pm"), "iris-pm");
  });

  test("returns Iris-facing display labels for known runtime agents", () => {
    assert.equal(getIrisAgentLabel("iris-lead"), "Iris");
    assert.equal(getIrisAgentLabel("iris-coder"), "Builder");
    assert.equal(getIrisAgentLabel("security"), "Security Reviewer");
  });

  test("derives readable labels for dynamic iris agents", () => {
    assert.equal(getIrisAgentLabel("iris-data-analyst"), "Data Analyst");
  });

  test("creates a view object while preserving source fields", () => {
    const view = toIrisAgentView({ id: "builder", model: "openai/gpt-5" });

    assert.deepEqual(view, {
      id: "iris-coder",
      runtimeId: "iris-coder",
      displayName: "Builder",
      irisLabel: "Builder",
      productName: "Iris",
      model: "openai/gpt-5",
    });
  });

  test("falls back to the Iris role label when no custom name is set", () => {
    const view = toIrisAgentView({ id: "iris-coder", name: "iris-coder" });
    assert.equal(view.displayName, "Builder");
    assert.equal(view.irisLabel, "Builder");
  });

  test("preserves a user's custom agent name instead of overwriting it with the Iris label", () => {
    const view = toIrisAgentView({ id: "iris-coder", name: "Ziggy" });
    assert.equal(view.displayName, "Ziggy", "custom name must win over the Iris label");
    assert.equal(view.irisLabel, "Builder", "the Iris role label is still available separately");
  });

  test("does not treat the runtime id itself as a custom name", () => {
    const view = toIrisAgentView({ id: "coder", name: "coder" });
    assert.equal(view.displayName, "Builder");
  });
});
