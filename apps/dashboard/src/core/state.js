// Shared in-memory state — mutate via the exported object properties
// Restored from sessionStorage on page load to survive refresh

const STORAGE_KEY = 'iris_ui_state';

function loadSaved() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

const saved = loadSaved();

export const state = {
  // OpenCode session selection (Sessions tab)
  selected: saved.selected || null,
  
  // Selected CLI engine for Sessions tab (opencode, claude, codex, gemini, iris-cli)
  selectedEngine: saved.selectedEngine || 'opencode',

  // Agent list (loaded from /api/agents)
  agents: saved.agents || [],

  // Active chat project
  chatActiveProjectId: saved.chatActiveProjectId || '',

  // Active shared channel/project for the Swarm tab
  swarmChatProjectId: saved.swarmChatProjectId || '',

  // Project registry cache (populated by loadProjects)
  projectsData: saved.projectsData || {},

  // Active tab (for scroll restoration)
  activeTab: saved.activeTab || 'chat',

  // Per-tab scroll positions { tabName: scrollTop }
  scrollPositions: saved.scrollPositions || {},
};

/** Persist current state to sessionStorage (call after meaningful state changes). */
export function persistState() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      selected: state.selected,
      selectedEngine: state.selectedEngine,
      chatActiveProjectId: state.chatActiveProjectId,
      swarmChatProjectId: state.swarmChatProjectId,
      projectsData: state.projectsData,
      activeTab: state.activeTab,
      scrollPositions: state.scrollPositions,
      // Don't persist agents list — it's large and gets stale
    }));
  } catch { /* quota exceeded or private mode — ignore */ }
}

/** Save scroll position for the current active tab. */
export function saveScrollPosition(tabName) {
  const main = document.querySelector('.view.active');
  if (main) {
    state.scrollPositions[tabName || state.activeTab] = main.scrollTop;
    persistState();
  }
}

/** Restore scroll position for a tab after re-render. */
export function restoreScrollPosition(tabName) {
  const pos = state.scrollPositions[tabName];
  if (pos != null) {
    requestAnimationFrame(() => {
      const main = document.querySelector('.view.active');
      if (main) main.scrollTop = pos;
    });
  }
}

export const AGENT_RANK = {
  'iris-lead': 0,
  'iris-orchestrator': 1, 'orchestrator': 1, 'iris-main': 2,
  'iris-pm': 3, 'iris-architect': 4,
  'iris-coder': 5, 'iris-coder-back': 6, 'iris-coder-front': 7, 'iris-frontend': 8,
  'iris-ml': 9, 'iris-fixer': 10,
  'iris-qa': 11, 'iris-security': 12,
  'iris-researcher': 13, 'iris-copywriter': 14, 'iris-seo': 15,
  'iris-github': 16, 'iris-db-migrator': 17,
  'iris-telegram': 18, 'iris-mega': 19,
};

export function sortAgents(arr) {
  return (arr || []).sort((a, b) => (AGENT_RANK[a.id] ?? 50) - (AGENT_RANK[b.id] ?? 50));
}
