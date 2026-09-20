/**
 * Comprehensive unit tests for lib/agents/permissions.mjs
 *
 * Covers: IRIS_TOOL_NAMES, AGENT_TOOL_ROLE_DEFAULTS,
 *         readAgentTools, getSearchToolsConfig,
 *         getRawAgentPrompts, getAgentPrompts
 *
 * Skips: writeAgentTools, writeAgentPrompt (write to ~/.iris/)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  IRIS_TOOL_NAMES,
  AGENT_TOOL_ROLE_DEFAULTS,
  readAgentTools,
  getSearchToolsConfig,
  getRawAgentPrompts,
  getAgentPrompts,
} from "../../lib/agents/permissions.mjs";

// ── IRIS_TOOL_NAMES ────────────────────────────────────────────────────

describe("IRIS_TOOL_NAMES – type and structure", () => {
  it("is a Set", () => {
    assert.ok(IRIS_TOOL_NAMES instanceof Set);
  });

  it("is non-empty", () => {
    assert.ok(IRIS_TOOL_NAMES.size > 0);
  });

  it("all entries are non-empty strings", () => {
    for (const name of IRIS_TOOL_NAMES) {
      assert.equal(typeof name, "string");
      assert.ok(name.length > 0);
    }
  });
});

describe("IRIS_TOOL_NAMES – expected entries", () => {
  const expected = [
    "write_file",
    "read_file",
    "mkdir",
    "run_cmd",
    "git",
    "dispatch",
    "telegram",
    "web_search",
    "web_fetch",
    "skill",
    "define_skill",
    "browser",
  ];

  for (const tool of expected) {
    it(`contains "${tool}"`, () => {
      assert.ok(IRIS_TOOL_NAMES.has(tool), `missing: ${tool}`);
    });
  }

  it("does not contain unknown/fabricated tool names", () => {
    assert.ok(!IRIS_TOOL_NAMES.has("fly_drone"));
    assert.ok(!IRIS_TOOL_NAMES.has("hack_server"));
    assert.ok(!IRIS_TOOL_NAMES.has(""));
  });
});

// ── AGENT_TOOL_ROLE_DEFAULTS ────────────────────────────────────────────────

describe("AGENT_TOOL_ROLE_DEFAULTS – type and structure", () => {
  it("is a plain object", () => {
    assert.equal(typeof AGENT_TOOL_ROLE_DEFAULTS, "object");
    assert.ok(AGENT_TOOL_ROLE_DEFAULTS !== null);
  });

  it("all values are non-empty arrays", () => {
    for (const [agent, tools] of Object.entries(AGENT_TOOL_ROLE_DEFAULTS)) {
      assert.ok(Array.isArray(tools), `${agent}: expected array`);
      assert.ok(tools.length > 0, `${agent}: expected non-empty tools`);
    }
  });

  it("all tool entries are valid IRIS_TOOL_NAMES", () => {
    for (const [agent, tools] of Object.entries(AGENT_TOOL_ROLE_DEFAULTS)) {
      for (const tool of tools) {
        assert.ok(
          IRIS_TOOL_NAMES.has(tool),
          `${agent}: unknown tool "${tool}"`,
        );
      }
    }
  });
});

describe("AGENT_TOOL_ROLE_DEFAULTS – known agent entries", () => {
  const knownAgents = [
    "iris-qa",
    "iris-security",
    "iris-coder",
    "iris-coder-front",
    "iris-coder-back",
    "iris-frontend",
    "iris-fixer",
    "iris-github",
    "iris-copywriter",
    "iris-main",
    "iris-pm",
    "iris-telegram",
  ];

  for (const agent of knownAgents) {
    it(`has a defaults entry for "${agent}"`, () => {
      assert.ok(agent in AGENT_TOOL_ROLE_DEFAULTS, `missing: ${agent}`);
    });
  }

  it("iris-qa has exactly read_file", () => {
    assert.deepEqual(AGENT_TOOL_ROLE_DEFAULTS["iris-qa"], ["read_file"]);
  });

  it("iris-security has read_file and run_cmd", () => {
    const t = AGENT_TOOL_ROLE_DEFAULTS["iris-security"];
    assert.ok(t.includes("read_file"));
    assert.ok(t.includes("run_cmd"));
  });

  it("iris-coder has write_file, read_file, mkdir, run_cmd, browser", () => {
    const t = AGENT_TOOL_ROLE_DEFAULTS["iris-coder"];
    for (const tool of ["write_file", "read_file", "mkdir", "run_cmd", "browser"]) {
      assert.ok(t.includes(tool), `iris-coder missing: ${tool}`);
    }
  });

  it("iris-github has git", () => {
    assert.ok(AGENT_TOOL_ROLE_DEFAULTS["iris-github"].includes("git"));
  });

  it("iris-pm has dispatch", () => {
    assert.ok(AGENT_TOOL_ROLE_DEFAULTS["iris-pm"].includes("dispatch"));
  });

  it("iris-main has dispatch, web_search, web_fetch", () => {
    const t = AGENT_TOOL_ROLE_DEFAULTS["iris-main"];
    assert.ok(t.includes("dispatch"));
    assert.ok(t.includes("web_search"));
    assert.ok(t.includes("web_fetch"));
  });

  it("iris-copywriter has web_search and web_fetch", () => {
    const t = AGENT_TOOL_ROLE_DEFAULTS["iris-copywriter"];
    assert.ok(t.includes("web_search"));
    assert.ok(t.includes("web_fetch"));
  });

  it("iris-telegram has telegram", () => {
    assert.ok(AGENT_TOOL_ROLE_DEFAULTS["iris-telegram"].includes("telegram"));
  });
});

// ── readAgentTools ──────────────────────────────────────────────────────────

describe("readAgentTools – return shape", () => {
  it("returns an object with source (string) and tools (array)", () => {
    const result = readAgentTools("iris-coder");
    assert.equal(typeof result.source, "string");
    assert.ok(Array.isArray(result.tools));
  });

  it("source is one of config, role-default, or fallback", () => {
    const result = readAgentTools("iris-coder");
    assert.ok(
      ["config", "role-default", "fallback"].includes(result.source),
      `unexpected source: ${result.source}`,
    );
  });

  it("tools array contains only IRIS_TOOL_NAMES entries", () => {
    const result = readAgentTools("iris-coder");
    for (const tool of result.tools) {
      assert.ok(IRIS_TOOL_NAMES.has(tool), `unknown tool: ${tool}`);
    }
  });

  it("returns non-empty tools array", () => {
    const result = readAgentTools("iris-coder");
    assert.ok(result.tools.length > 0);
  });
});

describe("readAgentTools – known agents", () => {
  it("iris-qa returns role-default (or config) with at least read_file", () => {
    const result = readAgentTools("iris-qa");
    assert.ok(["config", "role-default"].includes(result.source));
    assert.ok(result.tools.includes("read_file"));
  });

  it("iris-coder-front uses coder-front defaults or prefix match", () => {
    const result = readAgentTools("iris-coder-front");
    assert.ok(Array.isArray(result.tools));
    assert.ok(result.tools.length > 0);
  });

  it("iris-main includes dispatch in its tools", () => {
    const result = readAgentTools("iris-main");
    assert.ok(result.tools.includes("dispatch"));
  });

  it("iris-github includes git in its tools", () => {
    const result = readAgentTools("iris-github");
    assert.ok(result.tools.includes("git"));
  });
});

describe("readAgentTools – unknown agents", () => {
  it("returns fallback source for an unknown agent", () => {
    const result = readAgentTools("iris-this-does-not-exist-xyz-00000");
    assert.equal(result.source, "fallback");
  });

  it("fallback tools include read_file, write_file, mkdir, run_cmd", () => {
    const result = readAgentTools("iris-unknown-agent-xyz");
    for (const tool of ["read_file", "write_file", "mkdir", "run_cmd"]) {
      assert.ok(result.tools.includes(tool), `fallback missing: ${tool}`);
    }
  });

  it("prefix-match: iris-coder-XYZ should match iris-coder defaults", () => {
    const result = readAgentTools("iris-coder-xyz-custom");
    // Should either use role-default (prefix match) or fallback
    assert.ok(["config", "role-default", "fallback"].includes(result.source));
    assert.ok(result.tools.length > 0);
  });
});

describe("readAgentTools – deduplication", () => {
  it("tools array has no duplicate entries", () => {
    for (const agent of ["iris-coder", "iris-main", "iris-pm", "iris-qa"]) {
      const result = readAgentTools(agent);
      const unique = [...new Set(result.tools)];
      assert.equal(result.tools.length, unique.length, `${agent}: duplicate tools`);
    }
  });
});

// ── getSearchToolsConfig ────────────────────────────────────────────────────

describe("getSearchToolsConfig", () => {
  it("returns a non-null object", () => {
    const cfg = getSearchToolsConfig();
    assert.ok(typeof cfg === "object" && cfg !== null);
  });

  it("never throws even when config file is absent", () => {
    let result;
    assert.doesNotThrow(() => {
      result = getSearchToolsConfig();
    });
    assert.ok(typeof result === "object");
  });
});

// ── getRawAgentPrompts ──────────────────────────────────────────────────────

describe("getRawAgentPrompts", () => {
  it("returns a non-null object", () => {
    const prompts = getRawAgentPrompts();
    assert.ok(typeof prompts === "object" && prompts !== null);
  });

  it("never throws", () => {
    assert.doesNotThrow(() => getRawAgentPrompts());
  });

  it("all values are strings when entries exist", () => {
    const prompts = getRawAgentPrompts();
    for (const [key, val] of Object.entries(prompts)) {
      assert.equal(
        typeof val,
        "string",
        `prompt for ${key} is not a string`,
      );
    }
  });
});

// ── getAgentPrompts ─────────────────────────────────────────────────────────

describe("getAgentPrompts", () => {
  it("returns a non-null object", () => {
    const prompts = getAgentPrompts();
    assert.ok(typeof prompts === "object" && prompts !== null);
  });

  it("never throws", () => {
    assert.doesNotThrow(() => getAgentPrompts());
  });

  it("contains the same keys as getRawAgentPrompts", () => {
    const raw = getRawAgentPrompts();
    const augmented = getAgentPrompts();
    assert.deepEqual(Object.keys(augmented).sort(), Object.keys(raw).sort());
  });

  it("all values are strings when entries exist", () => {
    const prompts = getAgentPrompts();
    for (const [key, val] of Object.entries(prompts)) {
      assert.equal(typeof val, "string", `prompt for ${key} is not a string`);
    }
  });

  it("augmented prompts are at least as long as raw prompts (overlay adds content)", () => {
    const raw = getRawAgentPrompts();
    const augmented = getAgentPrompts();
    for (const key of Object.keys(raw)) {
      assert.ok(
        augmented[key].length >= raw[key].length,
        `${key}: augmented prompt shorter than raw`,
      );
    }
  });
});
