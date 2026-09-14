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

// Neutral on purpose — an evidence type badge is not a pass/fail signal.
// Whether something is "verified" is up to the record's own fields
// (e.g. command.passed), never implied by the UI.
const EVIDENCE_TYPE_LABELS = {
  file: "File",
  command: "Command",
  message: "Message",
  note: "Note",
  artifact: "Artifact",
};

const REVIEW_STATUS_COLORS = {
  draft: "var(--text-3)",
  ready: "var(--accent)",
  archived: "var(--text-3)",
};

const REVIEW_SEVERITY_COLORS = {
  low: "var(--text-3)",
  medium: "var(--yellow)",
  high: "var(--red)",
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
    taskRows +
    renderEvidenceSection(plan) +
    renderReviewsSection(plan)
  );
}

// ── Evidence (read-only) ──────────────────────────────────────────────────

function formatTimestamp(createdAt) {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function findTaskById(tasks, taskId) {
  if (!taskId) return null;
  return tasks.find((t) => t && t.id === taskId) || null;
}

function renderEvidenceDataPreview(type, data) {
  const d = data && typeof data === "object" ? data : {};
  const lines = [];

  switch (type) {
    case "file":
      if (d.path) lines.push("Path: " + escHtml(d.path));
      if (d.action) lines.push("Action: " + escHtml(d.action));
      if (d.hash) lines.push("Hash: " + escHtml(d.hash));
      break;
    case "command":
      if (d.command) lines.push("Command: " + escHtml(d.command));
      if (d.exitCode !== undefined && d.exitCode !== null)
        lines.push("Exit code: " + escHtml(String(d.exitCode)));
      if (d.passed !== undefined && d.passed !== null)
        lines.push("Passed: " + escHtml(String(d.passed)));
      if (d.outputExcerpt) lines.push("Output: " + escHtml(d.outputExcerpt));
      break;
    case "message":
      if (d.agentId) lines.push("Agent: " + escHtml(d.agentId));
      if (d.excerpt) lines.push(escHtml(d.excerpt));
      break;
    case "note":
      if (d.text) lines.push(escHtml(d.text));
      break;
    case "artifact":
      if (d.path || d.url)
        lines.push((d.path ? "Path: " : "URL: ") + escHtml(d.path || d.url));
      if (d.label) lines.push("Label: " + escHtml(d.label));
      break;
    default:
      break;
  }

  return lines
    .map((line) => '<div class="meta" style="margin-top:4px;">' + line + "</div>")
    .join("");
}

function renderEvidenceRow(entry, tasks) {
  const type = String(entry?.type || "unknown");
  const typeLabel = escHtml(EVIDENCE_TYPE_LABELS[type] || type || "Unknown");
  const title = escHtml(entry?.title || "Untitled evidence");
  const createdAt = formatTimestamp(entry?.createdAt);
  const linkedTask = findTaskById(tasks, entry?.taskId);

  return (
    '<div class="card" style="margin-bottom:8px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">' +
    "<div>" +
    '<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:var(--bg-card2);color:var(--text-2);border:1px solid var(--border);margin-right:8px;">' +
    typeLabel +
    "</span>" +
    '<strong style="font-size:13px;">' +
    title +
    "</strong>" +
    "</div>" +
    (createdAt
      ? '<div class="meta" style="white-space:nowrap;">' + escHtml(createdAt) + "</div>"
      : "") +
    "</div>" +
    (entry?.summary
      ? '<div class="meta" style="margin-top:8px;">' + escHtml(entry.summary) + "</div>"
      : "") +
    (linkedTask
      ? '<div class="meta" style="margin-top:8px;">Task: ' +
        escHtml(linkedTask.displayName || linkedTask.title || linkedTask.id) +
        "</div>"
      : "") +
    '<div style="margin-top:4px;">' +
    renderEvidenceDataPreview(type, entry?.data) +
    "</div>" +
    "</div>"
  );
}

function renderEvidenceSection(plan) {
  const evidence = Array.isArray(plan.evidence) ? plan.evidence : [];
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const rows = evidence.length
    ? evidence.map((entry) => renderEvidenceRow(entry, tasks)).join("")
    : '<div class="meta" style="padding:12px 0;">No evidence attached yet.</div>';

  return (
    '<div class="meta" style="margin-top:20px;margin-bottom:8px;font-weight:600;">Evidence</div>' +
    rows
  );
}

// ── Review packets (read-only) ────────────────────────────────────────────

function resolveRefLabels(ids, collection, resolve) {
  return (Array.isArray(ids) ? ids : []).map((id) => {
    const found = collection.find((c) => c && c.id === id);
    return found ? resolve(found) : String(id);
  });
}

function renderReviewItem(item, tasks, evidence, showSeverity) {
  const text = escHtml(item?.text || "");
  const severity =
    showSeverity && item?.severity
      ? '<span style="font-size:10px;padding:1px 6px;border-radius:999px;background:' +
        (REVIEW_SEVERITY_COLORS[item.severity] || "var(--text-3)") +
        "1a;color:" +
        (REVIEW_SEVERITY_COLORS[item.severity] || "var(--text-3)") +
        ";border:1px solid " +
        (REVIEW_SEVERITY_COLORS[item.severity] || "var(--text-3)") +
        '40;margin-left:6px;">' +
        escHtml(item.severity) +
        "</span>"
      : "";

  const taskLabels = resolveRefLabels(
    item?.taskIds,
    tasks,
    (t) => t.displayName || t.title || t.id,
  );
  const evidenceLabels = resolveRefLabels(
    item?.evidenceIds,
    evidence,
    (e) => (EVIDENCE_TYPE_LABELS[e.type] || e.type || "evidence") + ": " + (e.title || e.id),
  );

  const refLines = [];
  if (taskLabels.length) refLines.push("Tasks: " + taskLabels.map(escHtml).join(", "));
  if (evidenceLabels.length)
    refLines.push("Evidence: " + evidenceLabels.map(escHtml).join(", "));

  return (
    '<div class="meta" style="margin-top:6px;">' +
    "• " +
    text +
    severity +
    (refLines.length
      ? '<div style="margin-top:2px;padding-left:14px;">' +
        refLines
          .map((line) => '<div class="meta" style="font-size:11px;">' + line + "</div>")
          .join("") +
        "</div>"
      : "") +
    "</div>"
  );
}

function renderReviewSubsection(title, items, tasks, evidence, showSeverity) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return "";
  return (
    '<div class="meta" style="margin-top:10px;font-weight:600;">' +
    escHtml(title) +
    " (" +
    list.length +
    ")</div>" +
    list.map((item) => renderReviewItem(item, tasks, evidence, showSeverity)).join("")
  );
}

function renderReviewCard(review, tasks, evidence) {
  const statusColor = REVIEW_STATUS_COLORS[review?.status] || "var(--text-3)";
  const title = escHtml(review?.title || "Untitled review");
  const created = formatTimestamp(review?.createdAt);
  const updated = formatTimestamp(review?.updatedAt);
  const taskCount = Array.isArray(review?.taskIds) ? review.taskIds.length : 0;
  const evidenceCount = Array.isArray(review?.evidenceIds) ? review.evidenceIds.length : 0;

  return (
    '<div class="card" style="margin-bottom:8px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">' +
    "<div>" +
    '<strong style="font-size:13px;">' +
    title +
    "</strong>" +
    '<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:' +
    statusColor +
    "1a;color:" +
    statusColor +
    ";border:1px solid " +
    statusColor +
    '40;margin-left:8px;">' +
    escHtml(review?.status || "draft") +
    "</span>" +
    "</div>" +
    '<div class="meta" style="white-space:nowrap;">' +
    escHtml(created) +
    (updated && updated !== created ? " · updated " + escHtml(updated) : "") +
    "</div>" +
    "</div>" +
    (review?.summary
      ? '<div class="meta" style="margin-top:8px;">' + escHtml(review.summary) + "</div>"
      : "") +
    '<div class="meta" style="margin-top:8px;">' +
    taskCount +
    (taskCount === 1 ? " task" : " tasks") +
    " referenced · " +
    evidenceCount +
    (evidenceCount === 1 ? " evidence item" : " evidence items") +
    " referenced</div>" +
    renderReviewSubsection("Risks", review?.risks, tasks, evidence, true) +
    renderReviewSubsection("Open questions", review?.openQuestions, tasks, evidence, false) +
    renderReviewSubsection("Recommendations", review?.recommendations, tasks, evidence, false) +
    "</div>"
  );
}

function renderReviewsSection(plan) {
  const reviews = Array.isArray(plan.reviews) ? plan.reviews : [];
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const evidence = Array.isArray(plan.evidence) ? plan.evidence : [];
  const rows = reviews.length
    ? reviews.map((entry) => renderReviewCard(entry, tasks, evidence)).join("")
    : '<div class="meta" style="padding:12px 0;">No review packets yet.</div>';

  return (
    '<div class="meta" style="margin-top:20px;margin-bottom:8px;font-weight:600;">Reviews</div>' +
    rows
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
