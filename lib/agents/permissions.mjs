/**
 * Agent tool permission helpers — extracted from iris-lead.mjs
 * Reads/writes per-agent tool permissions from iris.json.
 */

import fs   from "fs";
import path from "path";
import os   from "os";
import { applySharedChatPromptOverlay } from "../chat/shared-chat-prompt-overlay.mjs";

function tryRead(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

export const IRIS_TOOL_NAMES = new Set([
  "write_file","read_file","mkdir","run_cmd","git","dispatch","telegram","web_search","web_fetch","skill","define_skill","browser",
]);

export const AGENT_TOOL_ROLE_DEFAULTS = {
  "iris-qa":          ["read_file"],
  "iris-security":    ["read_file","run_cmd"],
  "iris-coder":       ["write_file","read_file","mkdir","run_cmd","browser"],
  "iris-coder-front": ["write_file","read_file","mkdir","run_cmd","browser"],
  "iris-coder-back":  ["write_file","read_file","mkdir","run_cmd","browser"],
  "iris-frontend":    ["write_file","read_file","mkdir","run_cmd"],
  "iris-fixer":       ["write_file","read_file","mkdir","run_cmd","browser"],
  "iris-github":      ["read_file","run_cmd","git"],
  "iris-copywriter":  ["write_file","read_file","web_search","web_fetch"],
  "iris-main":        ["write_file","read_file","mkdir","run_cmd","dispatch","web_search","web_fetch"],
  "iris-pm":          ["read_file","dispatch"],
  "iris-telegram":    ["telegram","read_file"],
};

export function readAgentTools(agentId) {
  const swarm = tryRead(path.join(os.homedir(), ".iris", "iris.json")) || {};
  const agents = Array.isArray(swarm.agents) ? swarm.agents : [];
  const agent  = agents.find(a => a.id === agentId);
  const exact = AGENT_TOOL_ROLE_DEFAULTS[agentId];
  const roleDefaults = exact || Object.entries(AGENT_TOOL_ROLE_DEFAULTS).find(([key]) => agentId.startsWith(key))?.[1] || [];
  const explicit = agent?.tools?.irisAllow || agent?.tools?.alsoAllow || null;
  if (explicit) {
    const valid = explicit.filter(t => IRIS_TOOL_NAMES.has(t));
    if (valid.length) return { source: "config", tools: [...new Set([...roleDefaults, ...valid])] };
  }
  if (roleDefaults.length) return { source: "role-default", tools: roleDefaults };
  return { source: "fallback", tools: ["read_file","write_file","mkdir","run_cmd"] };
}

export function writeAgentTools(agentId, tools) {
  const valid = tools.filter(t => IRIS_TOOL_NAMES.has(t));
  const swarmPath = path.join(os.homedir(), ".iris", "iris.json");
  const swarm = tryRead(swarmPath) || {};
  if (!Array.isArray(swarm.agents)) swarm.agents = [];
  let agent = swarm.agents.find(a => a.id === agentId);
  if (!agent) {
    agent = { id: agentId };
    swarm.agents.push(agent);
  }
  if (!agent.tools) agent.tools = {};
  agent.tools.irisAllow = valid;
  fs.writeFileSync(swarmPath, JSON.stringify(swarm, null, 2), "utf8");
  return valid;
}

export function getSearchToolsConfig() {
  return tryRead(path.join(os.homedir(), ".iris", "search-tools.json")) || {};
}

export function getRawAgentPrompts() {
  return (
    tryRead(path.join(os.homedir(), ".iris", "agent-prompts.json")) || {}
  );
}

export function getAgentPrompts() {
  const prompts = getRawAgentPrompts();
  const augmented = {};
  for (const [key, value] of Object.entries(prompts)) {
    augmented[key] = applySharedChatPromptOverlay(value, key);
  }
  return augmented;
}

export function writeAgentPrompt(agentId, promptText) {
  const promptsPath = path.join(os.homedir(), ".iris", "agent-prompts.json");
  const prompts = getRawAgentPrompts();
  prompts[agentId] = promptText;
  fs.writeFileSync(promptsPath, JSON.stringify(prompts, null, 2), "utf8");
  return promptText;
}
