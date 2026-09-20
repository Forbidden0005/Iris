/**
 * Unit tests for scripts/sync-agents.mjs
 *
 * The script auto-runs main() on import, so we cannot safely import it
 * directly. Instead we:
 *  - Verify the file parses without syntax errors (via node --check)
 *  - Test the pure helper functions by extracting their logic inline
 *    (normalizeId, getAgentName, buildAgentTable, buildAgentList)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, "../../scripts/sync-agents.mjs");

// ── Re-implemented helpers (matching the source) ──────────────────────────
// These are not exported from the script, so we replicate them here to
// validate the logic independently.

function normalizeId(id) {
  return (id || "").replace(/^iris-/, "");
}

function getAgentName(id) {
  return (id || "").startsWith("iris-") ? id : `iris-${id}`;
}

function buildAgentTable(agents) {
  const header = `| Agent | Role | Best for |
|-------|------|----------|`;
  const rows = agents.map(
    (a) => `| \`${a.name}\` | ${a.meta.emoji} ${a.meta.label} | ${a.meta.best} |`
  );
  return [header, ...rows].join("\n");
}

function buildAgentList(agents) {
  return agents
    .map((a) => `- \`${a.name}\` — ${a.meta.label}: ${a.meta.best}`)
    .join("\n");
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("scripts/sync-agents.mjs", () => {
  it("parses without syntax errors", () => {
    execFileSync("node", ["--check", SCRIPT], { encoding: "utf8", timeout: 10000 });
  });
});

describe("sync-agents helpers (replicated)", () => {
  describe("normalizeId", () => {
    it("strips iris- prefix", () => {
      assert.equal(normalizeId("iris-coder"), "coder");
    });

    it("leaves bare IDs unchanged", () => {
      assert.equal(normalizeId("pm"), "pm");
    });

    it("handles empty string", () => {
      assert.equal(normalizeId(""), "");
    });

    it("handles undefined", () => {
      assert.equal(normalizeId(undefined), "");
    });
  });

  describe("getAgentName", () => {
    it("preserves existing iris- prefix", () => {
      assert.equal(getAgentName("iris-coder"), "iris-coder");
    });

    it("adds iris- prefix to bare IDs", () => {
      assert.equal(getAgentName("pm"), "iris-pm");
    });

    it("handles empty string", () => {
      assert.equal(getAgentName(""), "iris-");
    });
  });

  describe("buildAgentTable", () => {
    it("produces a markdown table", () => {
      const agents = [
        { name: "iris-pm", meta: { emoji: "📋", label: "Planning", best: "Tasks" } },
      ];
      const table = buildAgentTable(agents);
      assert.ok(table.includes("| Agent |"));
      assert.ok(table.includes("`iris-pm`"));
      assert.ok(table.includes("📋 Planning"));
    });

    it("returns header only for empty agent list", () => {
      const table = buildAgentTable([]);
      assert.ok(table.includes("| Agent |"));
      assert.ok(!table.includes("`iris-"));
    });
  });

  describe("buildAgentList", () => {
    it("produces a markdown list", () => {
      const agents = [
        { name: "iris-coder", meta: { label: "Implementation", best: "Code" } },
      ];
      const list = buildAgentList(agents);
      assert.ok(list.includes("- `iris-coder`"));
      assert.ok(list.includes("Implementation: Code"));
    });

    it("returns empty string for empty agent list", () => {
      assert.equal(buildAgentList([]), "");
    });
  });
});
