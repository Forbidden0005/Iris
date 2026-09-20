import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRtAgentId,
  BUILT_IN_RT_AGENTS,
  RT_TO_GATEWAY_AGENT_MAP,
  COORDINATOR_AGENT_IDS,
  coordinate_aget_ids,
  NO_PREFIX_AGENT_IDS,
} from "../../lib/agent-registry.mjs";

describe("normalizeRtAgentId", () => {
  test("returns empty string for empty input", () => {
    assert.equal(normalizeRtAgentId(""), "");
    assert.equal(normalizeRtAgentId(), "");
    assert.equal(normalizeRtAgentId(null), "");
  });

  test("passes through already-prefixed iris- IDs", () => {
    assert.equal(normalizeRtAgentId("iris-coder"), "iris-coder");
    assert.equal(normalizeRtAgentId("iris-qa"), "iris-qa");
    assert.equal(normalizeRtAgentId("iris-main"), "iris-main");
  });

  test("adds iris- prefix to bare agent names", () => {
    assert.equal(normalizeRtAgentId("coder"), "iris-coder");
    assert.equal(normalizeRtAgentId("pm"), "iris-pm");
    assert.equal(normalizeRtAgentId("fixer"), "iris-fixer");
  });

  test("passes through NO_PREFIX_AGENT_IDS without adding iris-", () => {
    for (const id of NO_PREFIX_AGENT_IDS) {
      assert.equal(normalizeRtAgentId(id), id);
    }
  });

  test("trims whitespace before normalizing", () => {
    assert.equal(normalizeRtAgentId("  coder  "), "iris-coder");
  });
});

describe("BUILT_IN_RT_AGENTS", () => {
  test("is a non-empty array of strings", () => {
    assert.ok(Array.isArray(BUILT_IN_RT_AGENTS));
    assert.ok(BUILT_IN_RT_AGENTS.length > 0);
    for (const id of BUILT_IN_RT_AGENTS) {
      assert.equal(typeof id, "string");
    }
  });

  test("all built-in agents start with iris- or are orchestrator", () => {
    for (const id of BUILT_IN_RT_AGENTS) {
      assert.ok(id.startsWith("iris-") || id === "orchestrator", `unexpected id: ${id}`);
    }
  });
});

describe("RT_TO_GATEWAY_AGENT_MAP", () => {
  test("all iris- keys map to bare agent IDs without iris-", () => {
    for (const [rt, gw] of Object.entries(RT_TO_GATEWAY_AGENT_MAP)) {
      if (rt.startsWith("iris-")) {
        assert.ok(!gw.startsWith("iris-") || gw === "orchestrator",
          `Expected bare id for ${rt}, got ${gw}`);
      }
    }
  });

  test("all BUILT_IN_RT_AGENTS have a mapping", () => {
    for (const id of BUILT_IN_RT_AGENTS) {
      assert.ok(id in RT_TO_GATEWAY_AGENT_MAP, `${id} missing from RT_TO_GATEWAY_AGENT_MAP`);
    }
  });
});

describe("COORDINATOR_AGENT_IDS", () => {
  test("contains expected coordinator IDs", () => {
    assert.ok(COORDINATOR_AGENT_IDS.includes("iris-pm"));
    assert.ok(COORDINATOR_AGENT_IDS.includes("iris-main"));
    assert.ok(COORDINATOR_AGENT_IDS.includes("iris-orchestrator"));
  });

  test("exports the backward-compatible typo alias", () => {
    assert.equal(coordinate_aget_ids, COORDINATOR_AGENT_IDS);
  });
});
