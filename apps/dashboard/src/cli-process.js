/**
 * CLI Process View - Orchestration status + model configuration
 */

import { updateOrchestrationStatus, startOrchestrationStatusUpdates, stopOrchestrationStatusUpdates } from './orchestration-status.js';

let cliProcessMode = 'connected';

window.initCLIProcess = async function() {
  await loadCLIProcessConfig();
  startOrchestrationStatusUpdates();
  setupCLIProcessListeners();
};

function setupCLIProcessListeners() {
  document.querySelector('[data-action="toggleCLIProcessMode"]')?.addEventListener('click', toggleCLIProcessMode);
  document.querySelector('[data-action="saveCLIProcessConfig"]')?.addEventListener('click', saveCLIProcessConfig);
  document.querySelector('[data-action="applyRecommendedCLIProcessConfig"]')?.addEventListener('click', applyRecommendedCLIProcessConfig);
  document.querySelector('[data-action="resetCLIProcessConfig"]')?.addEventListener('click', resetCLIProcessConfig);
  bindCustomModelSelectors();
  document.querySelector('[data-action="refreshCLIProcess"]')?.addEventListener('click', async () => {
    await updateOrchestrationStatus();
    await loadCLIProcessConfig();
  });
}

function bindCustomModelSelectors() {
  [
    'configChatModel',
    'configRouterModel',
    'configReasoningModel',
    'configL2AModel',
    'configL2BModel',
    'configExecutionModel',
    'configQAModel'
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.customBound === '1') return;
    el.dataset.customBound = '1';
    el.addEventListener('change', () => handleCustomModelSelection(el));
  });
}

function handleCustomModelSelection(selectEl) {
  if (!selectEl || selectEl.value !== '__custom__') return;
  const previous = selectEl.dataset.previousValue || '';
  const raw = window.prompt('Enter exact model ID for this slot:', previous);
  const custom = String(raw || '').trim();
  if (!custom) {
    selectEl.value = previous;
    return;
  }
  let option = Array.from(selectEl.options).find((opt) => opt.value === custom);
  if (!option) {
    option = document.createElement('option');
    option.value = custom;
    option.textContent = `${custom} (custom)`;
    const customMarker = Array.from(selectEl.options).find((opt) => opt.value === '__custom__');
    if (customMarker) {
      selectEl.insertBefore(option, customMarker);
    } else {
      selectEl.appendChild(option);
    }
  }
  selectEl.value = custom;
  selectEl.dataset.previousValue = custom;
}

function toggleCLIProcessMode() {
  cliProcessMode = cliProcessMode === 'connected' ? 'standalone' : 'connected';
  const btn = document.getElementById('cliProcessMode');
  if (btn) {
    btn.textContent = cliProcessMode === 'connected' ? '🔌 Connected Mode' : '🔌 Standalone Mode';
    btn.style.color = cliProcessMode === 'connected' ? '#10b981' : '#6b7280';
  }
  cliProcessMode === 'connected' ? startOrchestrationStatusUpdates() : stopOrchestrationStatusUpdates();
}

async function loadCLIProcessConfig() {
  try {
    const res = await fetch('/api/settings/cli-models');
    if (res.ok) {
      const config = await res.json();
      const set = (id, v) => {
        const el = document.getElementById(id);
        if (!el) return;
        const value = v || '';
        if (value && !Array.from(el.options || []).some((opt) => opt.value === value)) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = `${value} (saved custom)`;
          const customMarker = Array.from(el.options || []).find((opt) => opt.value === '__custom__');
          if (customMarker) {
            el.insertBefore(option, customMarker);
          } else {
            el.appendChild(option);
          }
        }
        el.value = value;
        el.dataset.previousValue = value;
      };
      set('configChatModel', config.IRIS_CHAT_MODEL);
      set('configRouterModel', config.IRIS_ROUTER_MODEL);
      set('configReasoningModel', config.IRIS_REASONING_MODEL);
      set('configL2AModel', config.IRIS_L2A_MODEL);
      set('configL2BModel', config.IRIS_L2B_MODEL);
      set('configExecutionModel', config.IRIS_EXECUTION_MODEL);
      set('configQAModel', config.IRIS_QA_MODEL);
      set('configMaxWorkers', config.IRIS_MAX_PARALLEL_WORKERS || '6');
      set('configExtraValidators', config.IRIS_L2_EXTRA_VALIDATORS);
    }
  } catch (err) {
    console.error('[CLI Process] Failed to load config:', err);
  }
}

function getCLIProcessConfigFromForm() {
  const get = (id) => document.getElementById(id)?.value || '';
  return {
    IRIS_CHAT_MODEL: get('configChatModel'),
    IRIS_ROUTER_MODEL: get('configRouterModel'),
    IRIS_REASONING_MODEL: get('configReasoningModel'),
    IRIS_L2A_MODEL: get('configL2AModel'),
    IRIS_L2B_MODEL: get('configL2BModel'),
    IRIS_EXECUTION_MODEL: get('configExecutionModel'),
    IRIS_QA_MODEL: get('configQAModel'),
    IRIS_MAX_PARALLEL_WORKERS: get('configMaxWorkers') || '6',
    IRIS_L2_EXTRA_VALIDATORS: get('configExtraValidators')
  };
}

async function saveCLIProcessConfig() {
  const config = getCLIProcessConfigFromForm();
  try {
    const res = await fetch('/api/settings/cli-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText);
    }
    alert('✅ CLI configuration saved to iris.json. Restart iris (Services → Start All) for changes to take effect.');
  } catch (err) {
    alert('❌ Save failed: ' + err.message);
  }
}

async function applyRecommendedCLIProcessConfig() {
  const config = {
    IRIS_CHAT_MODEL: 'grok-4-1-fast-non-reasoning',
    IRIS_ROUTER_MODEL: 'gpt-5.4',
    IRIS_REASONING_MODEL: 'gpt-5.4',
    IRIS_L2A_MODEL: 'gpt-5.4',
    IRIS_L2B_MODEL: 'gpt-5.4',
    IRIS_EXECUTION_MODEL: 'gemini-2.5-flash',
    IRIS_QA_MODEL: 'gpt-5.4',
    IRIS_MAX_PARALLEL_WORKERS: '6',
    IRIS_L2_EXTRA_VALIDATORS: ''
  };
  document.getElementById('configChatModel').value = config.IRIS_CHAT_MODEL;
  document.getElementById('configRouterModel').value = config.IRIS_ROUTER_MODEL;
  document.getElementById('configReasoningModel').value = config.IRIS_REASONING_MODEL;
  document.getElementById('configL2AModel').value = config.IRIS_L2A_MODEL;
  document.getElementById('configL2BModel').value = config.IRIS_L2B_MODEL;
  document.getElementById('configExecutionModel').value = config.IRIS_EXECUTION_MODEL;
  document.getElementById('configQAModel').value = config.IRIS_QA_MODEL;
  document.getElementById('configMaxWorkers').value = config.IRIS_MAX_PARALLEL_WORKERS;
  document.getElementById('configExtraValidators').value = config.IRIS_L2_EXTRA_VALIDATORS;
  bindCustomModelSelectors();
  try {
    const res = await fetch('/api/settings/cli-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (res.ok) {
      alert('✅ Recommended stack applied. Restart iris for changes to take effect.');
    }
  } catch (err) {
    console.error('[CLI Process] Apply recommended failed:', err);
  }
}

async function resetCLIProcessConfig() {
  ['configChatModel','configRouterModel','configReasoningModel','configL2AModel','configL2BModel','configExecutionModel','configQAModel','configExtraValidators'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('configMaxWorkers').value = '6';
  try {
    const config = {
      IRIS_CHAT_MODEL: '', IRIS_ROUTER_MODEL: '', IRIS_REASONING_MODEL: '', IRIS_L2A_MODEL: '', IRIS_L2B_MODEL: '',
      IRIS_EXECUTION_MODEL: '', IRIS_QA_MODEL: '', IRIS_MAX_PARALLEL_WORKERS: '6', IRIS_L2_EXTRA_VALIDATORS: ''
    };
    await fetch('/api/settings/cli-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  } catch (err) {
    console.error('[CLI Process] Reset save failed:', err);
  }
  alert('↻ Configuration reset');
}

export { cliProcessMode };
