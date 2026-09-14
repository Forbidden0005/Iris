export const IRIS_PRIMARY_LABEL = "Iris";
export const IRIS_PRIMARY_RUNTIME_ID = "crew-lead";

export function getPrimaryAssistantInfo() {
  return window._crewLeadInfo || { emoji: "🧠", name: IRIS_PRIMARY_LABEL };
}

export function getAgentDisplayName(agent = {}, fallback = "agent") {
  if (!agent) return fallback;
  return agent.displayName || agent.name || agent.id || "agent";
}

export function getAgentMentionLabel(agent = {}) {
  if (!agent) return "";
  const name = getAgentDisplayName(agent);
  return agent.runtimeId && agent.runtimeId !== name
    ? `${name} · ${agent.runtimeId}`
    : name;
}

export function getMessageAgentName(agentId = "", fallback = "agent") {
  if (agentId === IRIS_PRIMARY_RUNTIME_ID) return IRIS_PRIMARY_LABEL;
  return fallback || agentId || "agent";
}
