/**
 * Iris Plans tab — read-only view of Iris plan/task records.
 * Deps: getJSON (core/api), escHtml, showEmpty, showError (core/dom)
 *
 * This is intentionally read-only: no create/edit/status-change controls.
 * Plans are not yet written automatically by dispatch, so this view is a
 * plan register, not a live orchestration monitor.
 */
import { getJSON } from "../core/api.js";
import { escHtml, showEmpty, showError } from "../core/dom.js";
import { state } from "../core/state.js";

let hideAllViews = () => {};
let setNavActive = () => {};

const EMPTY_MESSAGE =
  "No plans yet — Iris doesn't automatically log plans for every conversation yet.";

const PLAN_STATUS_COLORS = {
  draft: "var(--text-3)",
  active: "var(--accent)",
  blocked: "var(--yellow)",
  completed: "var(--green)",
  failed: "var(--red)",
  cancelled: "var(--text-3)",
};

const TASK_STATUS_COLORS = {
  pending: "var(--text-3)",
  running: "var(--accent)",
  blocked: "var(--yellow)",
  done: "var(--green)",
  failed: "var(--red)",
  cancelled: "var(--text-3)",
};

export function initPlansTab(deps = {}) {
  hideAllViews = deps.hideAllViews || hideAllViews;
  setNavActive = deps.setNavActive || setNavActive;
}

export function showPlans() {
  hideAllViews();
  document.getElementById("plansView").classList.add("active");
  setNavActive("navPlans");
  showPlanList();
  loadPlans();
}

// ── List panel ────────────────────────────────────────────────────────────

function currentProjectId() {
  const selector = document.getElementById("chatProjectSelect");
  const value = String(selector?.value || "").trim();
  if (value && value !== "undefined") return value;
  return state.chatActiveProjectId || "general";
}

function showPlanList() {
  const listPanel = document.getElementById("plansListPanel");
  const detailPanel = document.getElementById("planDetailPanel");
  if (listPanel) listPanel.style.display = "block";
  if (detailPanel) detailPanel.style.display = "none";
}

export async function loadPlans() {
  const list = document.getElementById("plansList");
  if (!list) return;
  list.innerHTML = '<div class="meta" style="padding:20px;">Loading plans…</div>';
  try {
    const projectId = currentProjectId();
    const data = await getJSON(
      "/api/iris/plans?projectId=" + encodeURIComponent(projectId),
    );
    const plans = data.plans || [];
    if (!plans.length) {
      showEmpty(list, EMPTY_MESSAGE);
      return;
    }
    list.innerHTML = plans.map(renderPlanCard).join("");
  } catch (e) {
    showError(list, "Failed to load plans: " + e.message);
  }
}

function truncate(text, max) {
  const s = String(text || "").trim();
  return s.length > max ? s.slice(0, max).trim() + "…" : s;
}

function renderPlanCard(plan) {
  const id = escHtml(plan.id);
  const title = escHtml(plan.title || "Untitled Iris plan");
  const statusColor = PLAN_STATUS_COLORS[plan.status] || "var(--text-3)";
  const taskCount = Array.isArray(plan.tasks) ? plan.tasks.length : 0;
  const updated = plan.updatedAt
    ? new Date(plan.updatedAt).toLocaleString()
    : "";
  const requestPreview = plan.userRequest
    ? '<div class="meta" style="margin-top:6px;">' +
      escHtml(truncate(plan.userRequest, 140)) +
      "</div>"
    : "";

  return (
    '<div class="card" data-plan-id="' +
    id +
    '" data-action="openPlan" style="cursor:pointer;">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">' +
    "<div>" +
    '<strong style="font-size:15px;">' +
    title +
    "</strong>" +
    '<span style="margin-left:10px;font-size:11px;padding:2px 8px;border-radius:999px;background:' +
    statusColor +
    "1a;color:" +
    statusColor +
    ";border:1px solid " +
    statusColor +
    '40;">' +
    escHtml(plan.status || "draft") +
    "</span>" +
    "</div>" +
    '<div class="meta" style="white-space:nowrap;">' +
    updated +
    "</div>" +
    "</div>" +
    '<div class="meta" style="margin-top:8px;">' +
    taskCount +
    (taskCount === 1 ? " task" : " tasks") +
    "</div>" +
    requestPreview +
    "</div>"
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────

async function openPlanDetail(planId) {
  const listPanel = document.getElementById("plansListPanel");
  const detailPanel = document.getElementById("planDetailPanel");
  const body = document.getElementById("planDetailBody");
  if (listPanel) listPanel.style.display = "none";
  if (detailPanel) detailPanel.style.display = "block";
  if (body)
    body.innerHTML = '<div class="meta" style="padding:20px;">Loading plan…</div>';

  try {
    const data = await getJSON("/api/iris/plans/" + encodeURIComponent(planId));
    const plan = data.plan;
    if (!plan) {
      showError(body, "Plan not found.");
      return;
    }
    if (body) body.innerHTML = renderPlanDetail(plan);
  } catch (e) {
    showError(body, "Failed to load plan: " + e.message);
  }
}

function renderPlanDetail(plan) {
  const statusColor = PLAN_STATUS_COLORS[plan.status] || "var(--text-3)";
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];

  const taskRows = tasks.length
    ? tasks.map(renderTaskRow).join("")
    : '<div class="meta" style="padding:12px 0;">No tasks recorded on this plan yet.</div>';

  return (
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;">' +
    "<div>" +
    '<strong style="font-size:17px;">' +
    escHtml(plan.title || "Untitled Iris plan") +
    "</strong>" +
    '<span style="margin-left:10px;font-size:11px;padding:2px 8px;border-radius:999px;background:' +
    statusColor +
    "1a;color:" +
    statusColor +
    ";border:1px solid " +
    statusColor +
    '40;">' +
    escHtml(plan.status || "draft") +
    "</span>" +
    "</div>" +
    "</div>" +
    '<div class="meta" style="margin-bottom:8px;">Project: ' +
    escHtml(plan.projectId || "general") +
    "</div>" +
    (plan.userRequest
      ? '<div class="meta" style="margin-bottom:16px;white-space:pre-wrap;">' +
        escHtml(plan.userRequest) +
        "</div>"
      : "") +
    '<div class="meta" style="margin-bottom:8px;font-weight:600;">Tasks</div>' +
    taskRows
  );
}

function renderTaskRow(task) {
  const statusColor = TASK_STATUS_COLORS[task.status] || "var(--text-3)";
  const label = escHtml(task.displayName || task.runtimeAgentId || "agent");
  const runtimeId =
    task.runtimeAgentId && task.runtimeAgentId !== task.displayName
      ? ' <span class="meta">(' + escHtml(task.runtimeAgentId) + ")</span>"
      : "";

  return (
    '<div class="card" style="margin-bottom:8px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">' +
    "<div>" +
    '<strong style="font-size:13px;">' +
    escHtml(task.title || task.instructions || "Untitled task") +
    "</strong>" +
    '<div class="meta">' +
    label +
    runtimeId +
    "</div>" +
    "</div>" +
    '<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:' +
    statusColor +
    "1a;color:" +
    statusColor +
    ";border:1px solid " +
    statusColor +
    '40;white-space:nowrap;">' +
    escHtml(task.status || "pending") +
    "</span>" +
    "</div>" +
    (task.summary
      ? '<div class="meta" style="margin-top:8px;">' + escHtml(task.summary) + "</div>"
      : "") +
    (task.failureReason
      ? '<div class="meta" style="margin-top:8px;color:var(--red-hi);">' +
        escHtml(task.failureReason) +
        "</div>"
      : "") +
    "</div>"
  );
}

// ── Event delegation ──────────────────────────────────────────────────────

document.addEventListener("click", (e) => {
  const refreshBtn = e.target.closest('[data-action="refreshPlans"]');
  if (refreshBtn) {
    loadPlans();
    return;
  }
  const backBtn = e.target.closest('[data-action="closePlanDetail"]');
  if (backBtn) {
    showPlanList();
    return;
  }
  const card = e.target.closest('[data-action="openPlan"]');
  if (card) {
    openPlanDetail(card.dataset.planId);
  }
});
