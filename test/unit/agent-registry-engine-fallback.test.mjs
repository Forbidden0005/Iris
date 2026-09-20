/**
 * @version 1.0.0
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { agentMustNotUseEngineLlmFallback } from "../../lib/agent-registry.mjs";

describe("agentMustNotUseEngineLlmFallback", () => {
  test("iris-qa and iris-security require engine (no LLM-only fallback)", () => {
    assert.equal(agentMustNotUseEngineLlmFallback("iris-qa"), true);
    assert.equal(agentMustNotUseEngineLlmFallback("qa"), true);
    assert.equal(agentMustNotUseEngineLlmFallback("iris-security"), true);
  });

  test("iris-main may use conversational fallback", () => {
    assert.equal(agentMustNotUseEngineLlmFallback("iris-main"), false);
    assert.equal(agentMustNotUseEngineLlmFallback("iris-lead"), false);
  });

  test("iris-pm variants require engine", () => {
    assert.equal(agentMustNotUseEngineLlmFallback("iris-pm"), true);
    assert.equal(agentMustNotUseEngineLlmFallback("iris-pm-cli"), true);
  });
});
