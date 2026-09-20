import { normalizeRtAgentId } from "../agent-registry.mjs";

export const IRIS_PRODUCT_NAME = "Iris";

export const IRIS_PRIMARY_ASSISTANT_ID = "iris";
export const IRIS_PRIMARY_RUNTIME_AGENT_ID = "iris-lead";

export const IRIS_AGENT_LABELS = Object.freeze({
  "iris-lead": "Iris",
  "iris-main": "Iris Coordinator",
  "iris-pm": "Planner",
  "iris-pm-cli": "CLI Planner",
  "iris-pm-frontend": "Frontend Planner",
  "iris-pm-core": "Core Planner",
  "iris-orchestrator": "Orchestrator",
  "iris-judge": "Reviewer",
  "iris-coder": "Builder",
  "iris-coder-back": "Backend Builder",
  "iris-coder-front": "Frontend Builder",
  "iris-researcher": "Researcher",
  "iris-qa": "QA Reviewer",
  "iris-copywriter": "Writer",
  "iris-fixer": "Fixer",
  "iris-github": "Release Operator",
  "iris-frontend": "Interface Designer",
  "iris-security": "Security Reviewer",
});

export const IRIS_AGENT_ALIASES = Object.freeze({
  iris: IRIS_PRIMARY_RUNTIME_AGENT_ID,
  lead: IRIS_PRIMARY_RUNTIME_AGENT_ID,
  coordinator: "iris-main",
  planner: "iris-pm",
  builder: "iris-coder",
  backend: "iris-coder-back",
  frontend: "iris-coder-front",
  researcher: "iris-researcher",
  qa: "iris-qa",
  reviewer: "iris-judge",
  fixer: "iris-fixer",
  release: "iris-github",
  security: "iris-security",
  writer: "iris-copywriter",
  orchestrator: "iris-orchestrator",
});

export function normalizeIrisAgentId(agentId = "") {
  const id = String(agentId || "").trim();
  if (!id) return "";

  const alias = IRIS_AGENT_ALIASES[id.toLowerCase()];
  if (alias) return alias;

  return normalizeRtAgentId(id);
}

export function getIrisAgentLabel(agentId = "") {
  const runtimeId = normalizeIrisAgentId(agentId);
  if (!runtimeId) return "";

  if (IRIS_AGENT_LABELS[runtimeId]) {
    return IRIS_AGENT_LABELS[runtimeId];
  }

  return runtimeId
    .replace(/^iris-/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * A user can set a custom name for an agent in ~/.iris/iris.json
 * (surfaced here as agent.name). That custom name must win over the
 * generic Iris role label — otherwise every renamed agent silently loses
 * its nickname the moment it's rendered through the Iris identity layer.
 * The Iris role label (e.g. "Builder" for iris-coder) is still always
 * computed and exposed separately as `irisLabel`, so callers that want the
 * role rather than the nickname (or want to show both) still can.
 */
export function toIrisAgentView(agent = {}) {
  const runtimeId = normalizeIrisAgentId(agent.id);
  const irisLabel = getIrisAgentLabel(runtimeId);
  const customName = String(agent.name || "").trim();
  const hasCustomName = Boolean(customName) && customName !== agent.id && customName !== runtimeId;

  return {
    ...agent,
    id: runtimeId,
    runtimeId,
    productName: IRIS_PRODUCT_NAME,
    irisLabel,
    displayName: hasCustomName ? customName : irisLabel,
  };
}
