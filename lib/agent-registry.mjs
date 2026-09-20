// Shared iris agent registry.
// Dynamically loads agents from ~/.iris/iris.json so new agents
// are automatically discovered without code changes.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Minimal built-in fallback for core coordinator agents
// Plus agents used in tests (so tests pass on CI without config file)
const CORE_AGENTS = [
  "iris-main",
  "iris-pm",
  "iris-pm-cli",
  "iris-pm-frontend",
  "iris-pm-core",
  "iris-orchestrator",
  "iris-lead",
  "iris-judge",
  // Test agents (needed for CI)
  "iris-coder",
  "iris-coder-back",
  "iris-coder-front",
  "iris-researcher",
  "iris-qa",
  "iris-copywriter",
  "iris-fixer",
  "iris-github",
  "iris-frontend",
  "iris-security",
];

const CORE_MAP = {
  "iris-main": "main",
  "iris-pm": "pm",
  "iris-pm-cli": "pm-cli",
  "iris-pm-frontend": "pm-frontend",
  "iris-pm-core": "pm-core",
  "iris-orchestrator": "orchestrator",
  "iris-lead": "lead",
  "iris-judge": "judge",
  // Test agents
  "iris-coder": "coder",
  "iris-coder-back": "coder-back",
  "iris-coder-front": "coder-front",
  "iris-researcher": "researcher",
  "iris-qa": "qa",
  "iris-copywriter": "copywriter",
  "iris-fixer": "fixer",
  "iris-github": "github",
  "iris-frontend": "frontend",
  "iris-security": "security",
};

/**
 * Build agent registry dynamically from config files.
 * Reads ~/.iris/iris.json and discovers all configured agents.
 */
function buildAgentRegistry() {
  const map = { ...CORE_MAP };
  const listSet = new Set(CORE_AGENTS);

  const cfgPaths = [
    path.join(os.homedir(), ".iris", "iris.json"),
    path.join(os.homedir(), ".openclaw", "openclaw.json"),
  ];

  for (const cfgPath of cfgPaths) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
      const agents = Array.isArray(cfg.agents) ? cfg.agents
                   : Array.isArray(cfg.agents?.list) ? cfg.agents.list
                   : [];

      for (const agent of agents) {
        const rawId = String(agent.id || "").trim();
        if (!rawId) continue;

        // Normalize to RT format (iris-xxx)
        const bareId = rawId.replace(/^iris-/, "");
        const rtId = rawId.startsWith("iris-") ? rawId : `iris-${bareId}`;

        // Always keep canonical RT IDs in the exported list
        if (!map[rtId]) {
          map[rtId] = bareId;
          listSet.add(rtId);
        }
        // Support bare alias lookup (e.g. "orchestrator", "security")
        // without adding duplicate non-RT IDs to BUILT_IN_RT_AGENTS.
        if (rawId === bareId && !map[bareId]) {
          map[bareId] = bareId;
        }
      }
    } catch (err) {
      // Config file not found or invalid JSON — use core agents only
      if (process.env.DEBUG) {
        console.warn(`[agent-registry] Could not load ${cfgPath}: ${err.message}`);
      }
    }
  }

  return { list: [...listSet].sort(), map };
}

// Build registry on module load
const { list, map } = buildAgentRegistry();

export const BUILT_IN_RT_AGENTS = list;
export const RT_TO_GATEWAY_AGENT_MAP = map;

// Core agents that MUST exist - system breaks if missing
export const REQUIRED_AGENTS = new Set([
  "iris-lead",      // Fatal: no chat handler, no dispatch
  "iris-main",      // Fatal: no synthesis, no fallback coordinator
  "iris-pm",        // Fatal: PM-loop breaks, no roadmap processing
  "iris-orchestrator", // Fatal: pipeline dispatch fails
  "iris-coder",     // Fatal: PM-loop's default worker
  "iris-judge"      // Fatal: PM-loop judge decisions fail (if PM_USE_JUDGE=on)
]);

// Coordinator agents that can dispatch to other agents
export const COORDINATOR_AGENT_IDS = [
  "iris-main",
  "iris-pm",
  "iris-pm-cli",
  "iris-pm-frontend",
  "iris-pm-core",
  "iris-orchestrator"
];

// Backward-compatible alias for a misspelled import introduced by recent edits.
export const coordinate_aget_ids = COORDINATOR_AGENT_IDS;

/**
 * Agents whose tasks assume the configured engine runs (read_file / write_file / git / CLI).
 * If Codex/Cursor/OpenCode fails, we must NOT silently fall back to direct LLM — the user would
 * get prose with no qa-report.md, no audits, etc.
 */
export const AGENTS_NO_ENGINE_LLM_FALLBACK = new Set([
  "iris-coder",
  "iris-coder-back",
  "iris-coder-front",
  "iris-frontend",
  "iris-fixer",
  "iris-architect",
  "iris-qa",
  "iris-security",
  "iris-github",
  "iris-copywriter",
  "iris-researcher",
  "iris-seo",
  "iris-ml",
  "iris-mega",
  "iris-pm",
  "iris-pm-cli",
  "iris-pm-frontend",
  "iris-pm-core",
  "iris-orchestrator",
]);

/**
 * True when engine failure should surface an error instead of LLM-only fallback (rt-envelope).
 * @param {string} agentId
 * @returns {boolean}
 */
export function agentMustNotUseEngineLlmFallback(agentId = "") {
  const id = normalizeRtAgentId(String(agentId || "").trim());
  if (!id) return false;
  if (AGENTS_NO_ENGINE_LLM_FALLBACK.has(id)) return true;
  // Dynamic coding-style workers
  if (/^iris-[\w-]*(coder|fixer)(-|$)/i.test(id)) return true;
  if (/^iris-[\w-]*frontend(-|$)/i.test(id)) return true;
  return false;
}

/**
 * Check if an agent ID is a coordinator (can dispatch to other agents)
 * Handles both RT format (iris-xxx) and bare aliases (xxx)
 * @param {string} agentId - Agent ID to check
 * @returns {boolean} True if agent is a coordinator
 */
export function isCoordinator(agentId = "") {
  const id = String(agentId || "").trim();
  if (!id) return false;
  
  // Check RT format directly
  if (COORDINATOR_AGENT_IDS.includes(id)) return true;
  
  // Check bare alias by normalizing to RT format
  const rtId = normalizeRtAgentId(id);
  return COORDINATOR_AGENT_IDS.includes(rtId);
}

/**
 * Validate that all required agents exist in config
 * @param {Array} agents - Agent list from config
 * @returns {Object} { valid: boolean, missing: string[] }
 */
export function validateRequiredAgents(agents = []) {
  const agentIds = new Set(
    agents
      .map((a) => normalizeRtAgentId(a?.id))
      .filter(Boolean)
  );
  const missing = [];
  
  for (const required of REQUIRED_AGENTS) {
    if (!agentIds.has(required)) {
      missing.push(required);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

// Agents that don't get "iris-" prefix normalization
export const NO_PREFIX_AGENT_IDS = new Set(["security"]);

/**
 * Normalize agent ID to RT format (iris-xxx).
 * @param {string} agentId - Raw agent ID
 * @returns {string} Normalized RT agent ID
 */
export function normalizeRtAgentId(agentId = "") {
  const id = String(agentId || "").trim();
  if (!id) return "";
  if (id.startsWith("iris-") || NO_PREFIX_AGENT_IDS.has(id)) return id;
  return `iris-${id}`;
}
