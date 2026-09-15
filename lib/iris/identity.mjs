import { normalizeRtAgentId } from "../agent-registry.mjs";

export const IRIS_PRODUCT_NAME = "Iris";

export const IRIS_PRIMARY_ASSISTANT_ID = "iris";
export const IRIS_PRIMARY_RUNTIME_AGENT_ID = "crew-lead";

export const IRIS_AGENT_LABELS = Object.freeze({
  "crew-lead": "Iris",
  "crew-main": "Iris Coordinator",
  "crew-pm": "Planner",
  "crew-pm-cli": "CLI Planner",
  "crew-pm-frontend": "Frontend Planner",
  "crew-pm-core": "Core Planner",
  "crew-orchestrator": "Orchestrator",
  "crew-judge": "Reviewer",
  "crew-coder": "Builder",
  "crew-coder-back": "Backend Builder",
  "crew-coder-front": "Frontend Builder",
  "crew-researcher": "Researcher",
  "crew-qa": "QA Reviewer",
  "crew-copywriter": "Writer",
  "crew-fixer": "Fixer",
  "crew-github": "Release Operator",
  "crew-frontend": "Interface Designer",
  "crew-security": "Security Reviewer",
});

export const IRIS_AGENT_ALIASES = Object.freeze({
  iris: IRIS_PRIMARY_RUNTIME_AGENT_ID,
  lead: IRIS_PRIMARY_RUNTIME_AGENT_ID,
  coordinator: "crew-main",
  planner: "crew-pm",
  builder: "crew-coder",
  backend: "crew-coder-back",
  frontend: "crew-coder-front",
  researcher: "crew-researcher",
  qa: "crew-qa",
  reviewer: "crew-judge",
  fixer: "crew-fixer",
  release: "crew-github",
  security: "crew-security",
  writer: "crew-copywriter",
  orchestrator: "crew-orchestrator",
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
    .replace(/^crew-/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * A user can set a custom name for an agent in ~/.crewswarm/crewswarm.json
 * (surfaced here as agent.name). That custom name must win over the
 * generic Iris role label — otherwise every renamed agent silently loses
 * its nickname the moment it's rendered through the Iris identity layer.
 * The Iris role label (e.g. "Builder" for crew-coder) is still always
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
