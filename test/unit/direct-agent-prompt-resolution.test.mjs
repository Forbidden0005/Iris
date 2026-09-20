/**
 * Direct sub-agent chat loads system text from ~/.iris/agent-prompts.json
 * (see lib/iris-lead/http-server.mjs buildDirectChatContext).
 * Shipped defaults live in config/agent-prompts.json — every agent in the default
 * install roster should resolve to a non-fallback prompt so direct chat matches expectations.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");
const bundledPromptsPath = path.join(repoRoot, "config", "agent-prompts.json");
const bundled = JSON.parse(fs.readFileSync(bundledPromptsPath, "utf8"));

/** Same resolution as http-server buildDirectChatContext (base prompt only). */
function resolveBundledBasePrompt(agentId) {
  const bareId = String(agentId || "").replace(/^iris-/, "");
  return bundled[agentId] || bundled[bareId] || null;
}

/** Agent IDs from install.sh default iris.json (normalized to iris-* RT ids). */
const DEFAULT_INSTALL_AGENT_IDS = [
  "iris-lead",
  "iris-main",
  "iris-pm",
  "iris-pm-cli",
  "iris-pm-frontend",
  "iris-pm-core",
  "iris-coder",
  "iris-coder-front",
  "iris-coder-back",
  "iris-frontend",
  "iris-qa",
  "iris-fixer",
  "iris-security",
  "iris-github",
  "iris-copywriter",
  "iris-seo",
  "iris-researcher",
  "iris-mega",
  "iris-architect",
  "iris-ml",
  "iris-orchestrator",
  "iris-judge",
];

test("bundled agent-prompts.json resolves every default-install agent id", () => {
  const missing = [];
  for (const id of DEFAULT_INSTALL_AGENT_IDS) {
    const base = resolveBundledBasePrompt(id);
    if (!base || typeof base !== "string" || !base.trim()) {
      missing.push(id);
      continue;
    }
    assert.ok(
      base.length > 20,
      `${id}: prompt too short — likely placeholder`,
    );
  }
  assert.deepEqual(
    missing,
    [],
    `Add keys for full id or bare id (after iris-): ${missing.join(", ")}`,
  );
});

test("iris-ml resolves via bare id 'ml' (not iris-ml key required)", () => {
  const base = resolveBundledBasePrompt("iris-ml");
  assert.ok(base, "iris-ml should resolve");
  assert.match(base, /iris-ml/i);
});

test("iris-main resolves via bare id 'main'", () => {
  const base = resolveBundledBasePrompt("iris-main");
  assert.ok(base, "iris-main should resolve");
  assert.match(base, /Quill|iris-main|coordinator/i);
});
