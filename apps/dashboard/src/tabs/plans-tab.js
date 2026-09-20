/**
 * Iris Plans tab — mostly read-only view of Iris plan/task records, with
 * two explicit, user-triggered actions: generating a draft review, and
 * dispatching a task. Neither happens automatically. No create/edit/
 * status-change controls beyond those two exist here.
 * Deps: getJSON, postJSON (core/api), escHtml, showEmpty, showError,
 * showNotification (core/dom)
 */
import { getJSON, patchJSON, postJSON } from "../core/api.js";
import { escHtml, showEmpty, showError, showNotification } from "../core/dom.js";
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

const CONFLICT_STATUS_COLORS = {
  open: "var(--yellow)",
  resolved: "var(--green)",
  dismissed: "var(--text-3)",
};

const CONFLICT_TYPE_LABELS = {
  agent_disagreement: "Agent disagreement",
  test_vs_claim: "Test vs. claim",
  blocked_task: "Blocked task",
  missing_evidence: "Missing evidence",
  other: "Other",
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
    ? tasks.map((task) => renderTaskRow(task, plan.id)).join("")
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
    renderAddTaskForm(plan.id) +
    renderEvidenceSection(plan) +
    renderReviewsSection(plan) +
    renderConflictsSection(plan) +
    renderLimitsSection(plan)
  );
}

// ── Conflicts (read-only) ───────────────────────────────────────────────────

function renderConflictRow(conflict, tasks, evidence, planId) {
  const statusColor = CONFLICT_STATUS_COLORS[conflict?.status] || "var(--text-3)";
  const typeLabel = escHtml(CONFLICT_TYPE_LABELS[conflict?.type] || conflict?.type || "Unknown");
  const description = escHtml(conflict?.description || "");
  const createdAt = formatTimestamp(conflict?.createdAt);

  const taskLabels = resolveRefLabels(conflict?.taskIds, tasks, (t) => t.displayName || t.title || t.id);
  const evidenceLabels = resolveRefLabels(
    conflict?.evidenceIds,
    evidence,
    (e) => (EVIDENCE_TYPE_LABELS[e.type] || e.type || "evidence") + ": " + (e.title || e.id),
  );
  const refLines = [];
  if (taskLabels.length) refLines.push("Tasks: " + taskLabels.map(escHtml).join(", "));
  if (evidenceLabels.length) refLines.push("Evidence: " + evidenceLabels.map(escHtml).join(", "));

  return (
    '<div class="card" style="margin-bottom:8px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">' +
    "<div>" +
    '<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:var(--bg-card2);color:var(--text-2);border:1px solid var(--border);margin-right:8px;">' +
    typeLabel +
    "</span>" +
    '<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:' +
    statusColor +
    "1a;color:" +
    statusColor +
    ";border:1px solid " +
    statusColor +
    '40;">' +
    escHtml(conflict?.status || "open") +
    "</span>" +
    "</div>" +
    (createdAt
      ? '<div class="meta" style="white-space:nowrap;">' + escHtml(createdAt) + "</div>"
      : "") +
    "</div>" +
    '<div class="meta" style="margin-top:8px;">' +
    description +
    "</div>" +
    (conflict?.resolution
      ? '<div class="meta" style="margin-top:8px;">Resolution: ' + escHtml(conflict.resolution) + "</div>"
      : "") +
    (refLines.length
      ? '<div style="margin-top:6px;">' +
        refLines
          .map((line) => '<div class="meta" style="font-size:11px;">' + line + "</div>")
          .join("") +
        "</div>"
      : "") +
    (conflict?.status === "open" ? renderResolveConflictControl(conflict.id, planId) : "") +
    "</div>"
  );
}

function renderResolveConflictControl(conflictId, planId) {
  const idAttr = escHtml(conflictId);
  const planIdAttr = escHtml(planId);
  return (
    '<div style="margin-top:8px;">' +
    '<button type="button" class="btn-ghost" data-action="toggleResolveConflict" data-conflict-id="' +
    idAttr +
    '" style="font-size:12px;padding:4px 10px;">Resolve</button>' +
    '<div id="resolveForm-' +
    idAttr +
    '" data-plan-id="' +
    planIdAttr +
    '" data-conflict-id="' +
    idAttr +
    '" style="display:none;margin-top:6px;gap:6px;max-width:380px;">' +
    '<textarea class="resolve-note" placeholder="Resolution note (required)" rows="2" style="font-size:12px;width:100%;"></textarea>' +
    '<div style="display:flex;gap:6px;margin-top:4px;">' +
    '<button type="button" class="btn-green" data-action="submitResolveConflict" data-status="resolved" style="font-size:12px;padding:4px 10px;">Mark resolved</button>' +
    '<button type="button" class="btn-ghost" data-action="submitResolveConflict" data-status="dismissed" style="font-size:12px;padding:4px 10px;">Dismiss</button>' +
    "</div>" +
    "</div>" +
    "</div>"
  );
}

function renderRecordConflictForm(plan) {
  const idAttr = escHtml(plan.id);
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const taskOptions =
    '<option value="">(no linked task)</option>' +
    tasks
      .map(
        (t) =>
          '<option value="' + escHtml(t.id) + '">' + escHtml(t.title || t.id) + "</option>",
      )
      .join("");

  return (
    '<div style="margin-top:8px;">' +
    '<button type="button" class="btn-ghost" data-action="toggleRecordConflict" style="font-size:12px;padding:4px 10px;">+ Record conflict</button>' +
    '<div id="recordConflictForm" data-plan-id="' +
    idAttr +
    '" style="display:none;margin-top:8px;padding:10px;border:1px solid var(--border);border-radius:8px;gap:6px;max-width:420px;">' +
    '<select id="conflictType" style="font-size:12px;">' +
    '<option value="agent_disagreement">Agent disagreement</option>' +
    '<option value="test_vs_claim">Test vs. claim</option>' +
    '<option value="blocked_task">Blocked task</option>' +
    '<option value="missing_evidence">Missing evidence</option>' +
    '<option value="other">Other</option>' +
    "</select>" +
    '<select id="conflictTaskId" style="font-size:12px;">' +
    taskOptions +
    "</select>" +
    '<textarea id="conflictDescription" placeholder="Description" rows="2" style="font-size:12px;width:100%;"></textarea>' +
    '<div style="display:flex;gap:6px;margin-top:4px;">' +
    '<button type="button" class="btn-green" data-action="submitRecordConflict" style="font-size:12px;padding:4px 10px;">Record conflict</button>' +
    '<button type="button" class="btn-ghost" data-action="cancelRecordConflict" style="font-size:12px;padding:4px 10px;">Cancel</button>' +
    "</div>" +
    "</div>" +
    "</div>"
  );
}

function renderConflictsSection(plan) {
  const conflicts = Array.isArray(plan.conflicts) ? plan.conflicts : [];
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const evidence = Array.isArray(plan.evidence) ? plan.evidence : [];
  const rows = conflicts.length
    ? conflicts.map((entry) => renderConflictRow(entry, tasks, evidence, plan.id)).join("")
    : '<div class="meta" style="padding:12px 0;">No conflicts recorded yet.</div>';

  return (
    '<div class="meta" style="margin-top:20px;margin-bottom:8px;font-weight:600;">Conflicts</div>' +
    rows +
    renderRecordConflictForm(plan)
  );
}

// ── Run limits (read-only, advisory) ───────────────────────────────────────

function computePlanUsage(plan) {
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const evidence = Array.isArray(plan.evidence) ? plan.evidence : [];
  const reviews = Array.isArray(plan.reviews) ? plan.reviews : [];
  return {
    taskCount: tasks.length,
    dispatchedTaskCount: tasks.filter((t) => Boolean(t?.dispatchTaskId)).length,
    evidenceCount: evidence.length,
    reviewGenerationCount: reviews.filter((r) => r?.metadata?.generated === true).length,
  };
}

function renderLimitRow(label, used, max) {
  const hasMax = typeof max === "number" && Number.isFinite(max);
  return (
    '<div class="meta" style="margin-top:4px;">' +
    escHtml(label) +
    ": " +
    escHtml(String(used)) +
    (hasMax ? " / " + escHtml(String(max)) : "") +
    "</div>"
  );
}

function renderLimitsSection(plan) {
  const limits = plan.limits && typeof plan.limits === "object" ? plan.limits : {};
  const usage = computePlanUsage(plan);

  const rows =
    renderLimitRow("Tasks", usage.taskCount, limits.maxTasks) +
    renderLimitRow("Dispatched", usage.dispatchedTaskCount, limits.maxDispatches) +
    renderLimitRow("Evidence attached", usage.evidenceCount, null) +
    renderLimitRow("Reviews generated", usage.reviewGenerationCount, limits.maxReviewGenerations);

  // Runtime/cost usage isn't tracked anywhere yet — show the declared
  // limit as a note rather than pretending a "0 / N" usage number.
  const untracked = [];
  if (typeof limits.maxRuntimeMinutes === "number") {
    untracked.push(
      "Runtime limit: " + escHtml(String(limits.maxRuntimeMinutes)) + " min (usage not tracked yet)",
    );
  }
  if (typeof limits.maxEstimatedCostUsd === "number") {
    untracked.push(
      "Cost limit: $" + escHtml(String(limits.maxEstimatedCostUsd)) + " (usage not tracked yet)",
    );
  }
  const untrackedRows = untracked
    .map((line) => '<div class="meta" style="margin-top:4px;">' + line + "</div>")
    .join("");

  return (
    '<div class="meta" style="margin-top:20px;margin-bottom:8px;font-weight:600;">Run Limits (advisory)</div>' +
    rows +
    untrackedRows
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
    rows +
    renderAttachEvidenceForm(plan)
  );
}

// ── Attach evidence (explicit, user-triggered only) ────────────────────────

function renderAttachEvidenceForm(plan) {
  const idAttr = escHtml(plan.id);
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const taskOptions =
    '<option value="">(no linked task)</option>' +
    tasks
      .map(
        (t) =>
          '<option value="' + escHtml(t.id) + '">' + escHtml(t.title || t.id) + "</option>",
      )
      .join("");

  return (
    '<div style="margin-top:8px;">' +
    '<button type="button" class="btn-ghost" data-action="toggleAttachEvidence" style="font-size:12px;padding:4px 10px;">+ Attach evidence</button>' +
    '<div id="attachEvidenceForm" data-plan-id="' +
    idAttr +
    '" style="display:none;margin-top:8px;padding:10px;border:1px solid var(--border);border-radius:8px;gap:6px;max-width:420px;">' +
    '<select id="evidenceType" style="font-size:12px;">' +
    '<option value="note">Note</option>' +
    '<option value="file">File</option>' +
    '<option value="command">Command</option>' +
    '<option value="message">Message</option>' +
    '<option value="artifact">Artifact</option>' +
    "</select>" +
    '<select id="evidenceTaskId" style="font-size:12px;">' +
    taskOptions +
    "</select>" +
    '<input id="evidenceTitle" placeholder="Title (optional)" style="font-size:12px;" />' +
    '<input id="evidenceSummary" placeholder="Summary (optional)" style="font-size:12px;" />' +
    '<div data-evidence-fields="note"><textarea id="evidenceNoteText" placeholder="Note text" rows="2" style="font-size:12px;width:100%;"></textarea></div>' +
    '<div data-evidence-fields="file" hidden>' +
    '<input id="evidenceFilePath" placeholder="File path" style="font-size:12px;width:100%;margin-bottom:6px;" />' +
    '<input id="evidenceFileAction" placeholder="Action (optional, e.g. read/write)" style="font-size:12px;width:100%;" />' +
    "</div>" +
    '<div data-evidence-fields="command" hidden>' +
    '<input id="evidenceCommandText" placeholder="Command" style="font-size:12px;width:100%;margin-bottom:6px;" />' +
    '<input id="evidenceExitCode" placeholder="Exit code (optional)" style="font-size:12px;width:100%;margin-bottom:6px;" />' +
    '<select id="evidencePassed" style="font-size:12px;">' +
    '<option value="">Passed? (optional)</option>' +
    '<option value="true">Yes</option>' +
    '<option value="false">No</option>' +
    "</select>" +
    "</div>" +
    '<div data-evidence-fields="message" hidden>' +
    '<input id="evidenceExcerpt" placeholder="Message excerpt" style="font-size:12px;width:100%;margin-bottom:6px;" />' +
    '<input id="evidenceAgentId" placeholder="Agent id (optional)" style="font-size:12px;width:100%;" />' +
    "</div>" +
    '<div data-evidence-fields="artifact" hidden>' +
    '<input id="evidenceArtifactPath" placeholder="Path or URL" style="font-size:12px;width:100%;margin-bottom:6px;" />' +
    '<input id="evidenceArtifactLabel" placeholder="Label (optional)" style="font-size:12px;width:100%;" />' +
    "</div>" +
    '<div style="display:flex;gap:6px;margin-top:4px;">' +
    '<button type="button" class="btn-green" data-action="submitAttachEvidence" style="font-size:12px;padding:4px 10px;">Attach evidence</button>' +
    '<button type="button" class="btn-ghost" data-action="cancelAttachEvidence" style="font-size:12px;padding:4px 10px;">Cancel</button>' +
    "</div>" +
    "</div>" +
    "</div>"
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
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;margin-bottom:8px;">' +
    '<div class="meta" style="font-weight:600;">Reviews</div>' +
    '<button type="button" class="btn-ghost" data-action="generateReview" data-plan-id="' +
    escHtml(plan.id) +
    '" style="font-size:12px;padding:4px 10px;">Generate draft review</button>' +
    "</div>" +
    rows
  );
}

function renderAddTaskForm(planId) {
  const idAttr = escHtml(planId);
  return (
    '<div style="margin-top:8px;">' +
    '<button type="button" class="btn-ghost" data-action="toggleAddTask" style="font-size:12px;padding:4px 10px;">+ Add task</button>' +
    '<div id="addTaskForm" data-plan-id="' +
    idAttr +
    '" style="display:none;margin-top:8px;padding:10px;border:1px solid var(--border);border-radius:8px;gap:6px;max-width:420px;">' +
    '<input id="addTaskTitle" placeholder="Title" style="font-size:12px;" />' +
    '<textarea id="addTaskInstructions" placeholder="Instructions" rows="2" style="font-size:12px;"></textarea>' +
    '<input id="addTaskAgent" placeholder="Agent (e.g. coder, qa, builder)" style="font-size:12px;" />' +
    '<div style="display:flex;gap:6px;">' +
    '<button type="button" class="btn-green" data-action="submitAddTask" style="font-size:12px;padding:4px 10px;">Add task</button>' +
    '<button type="button" class="btn-ghost" data-action="cancelAddTask" style="font-size:12px;padding:4px 10px;">Cancel</button>' +
    "</div>" +
    "</div>" +
    "</div>"
  );
}

function renderTaskRow(task, planId) {
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
    renderDispatchTaskControl(task, planId) +
    "</div>"
  );
}

// ── Dispatch task (explicit, user-triggered only) ──────────────────────────

function renderDispatchTaskControl(task, planId) {
  const planIdAttr = escHtml(planId);
  const taskIdAttr = escHtml(task.id);

  if (task.dispatchTaskId) {
    return (
      '<div class="meta" style="margin-top:8px;">' +
      "Dispatched: " +
      escHtml(task.dispatchTaskId) +
      "</div>" +
      '<button type="button" class="btn-ghost" disabled style="margin-top:6px;font-size:12px;padding:4px 10px;" title="This task already has a dispatch id — dispatching again would risk duplicate work.">' +
      "Dispatched" +
      "</button>"
    );
  }

  const missingReasons = [];
  if (!task.runtimeAgentId) missingReasons.push("no runtime agent assigned");
  if (!String(task.instructions || task.title || "").trim()) missingReasons.push("no instructions or title");

  if (missingReasons.length) {
    return (
      '<button type="button" class="btn-ghost" disabled style="margin-top:8px;font-size:12px;padding:4px 10px;" title="Cannot dispatch: ' +
      escHtml(missingReasons.join(", ")) +
      '.">' +
      "Dispatch task" +
      "</button>"
    );
  }

  const dispatchBody = String(task.instructions || task.title || "").trim();

  return (
    '<button type="button" class="btn-ghost" data-action="dispatchTask" data-plan-id="' +
    planIdAttr +
    '" data-task-id="' +
    taskIdAttr +
    '" data-agent="' +
    escHtml(task.runtimeAgentId) +
    '" data-task-body="' +
    escHtml(dispatchBody) +
    '" style="margin-top:8px;font-size:12px;padding:4px 10px;">' +
    "Dispatch task" +
    "</button>"
  );
}

// ── Event delegation ──────────────────────────────────────────────────────

document.addEventListener("change", (e) => {
  if (e.target && e.target.id === "evidenceType") {
    const selected = e.target.value;
    document.querySelectorAll("[data-evidence-fields]").forEach((el) => {
      el.hidden = el.dataset.evidenceFields !== selected;
    });
  }
});

// Plans-tab actions are handled entirely by this module, not by the
// dashboard's central ACTION_REGISTRY (apps/dashboard/src/app.js). Both
// listeners are on `document`, so this one (registered first, since
// app.js imports this module before installing its own click listener)
// runs first and handles the click — but without stopImmediatePropagation,
// app.js's listener still runs afterward on the same event and logs a
// spurious "unknown data-action" warning for every plans-tab action.
const PLANS_TAB_ACTIONS = new Set([
  "refreshPlans",
  "closePlanDetail",
  "openPlan",
  "generateReview",
  "dispatchTask",
  "toggleAddTask",
  "cancelAddTask",
  "submitAddTask",
  "toggleAttachEvidence",
  "cancelAttachEvidence",
  "submitAttachEvidence",
  "toggleRecordConflict",
  "cancelRecordConflict",
  "submitRecordConflict",
  "toggleResolveConflict",
  "submitResolveConflict",
]);

document.addEventListener("click", async (e) => {
  const actionEl = e.target.closest("[data-action]");
  if (actionEl && PLANS_TAB_ACTIONS.has(actionEl.dataset.action)) {
    e.stopImmediatePropagation();
  }

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
    return;
  }
  const generateBtn = e.target.closest('[data-action="generateReview"]');
  if (generateBtn) {
    const planId = generateBtn.dataset.planId;
    if (!planId || generateBtn.disabled) return;
    const originalText = generateBtn.textContent;
    generateBtn.disabled = true;
    generateBtn.textContent = "Generating…";
    try {
      await postJSON(
        "/api/iris/plans/" + encodeURIComponent(planId) + "/reviews/generate",
        {},
      );
      showNotification("Draft review generated");
      // Re-render from a fresh GET, which also replaces this button element
      // (and its disabled state) with a new one.
      await openPlanDetail(planId);
    } catch (err) {
      showNotification("Failed to generate review: " + err.message, "error");
      generateBtn.disabled = false;
      generateBtn.textContent = originalText;
    }
    return;
  }
  const dispatchBtn = e.target.closest('[data-action="dispatchTask"]');
  if (dispatchBtn) {
    const { planId, taskId, agent, taskBody } = dispatchBtn.dataset;
    if (!planId || !taskId || dispatchBtn.disabled) return;
    const originalText = dispatchBtn.textContent;
    dispatchBtn.disabled = true;
    dispatchBtn.textContent = "Dispatching…";
    try {
      const result = await postJSON("/api/dispatch", {
        agent,
        task: taskBody,
        sessionId: currentProjectId(),
        irisPlanId: planId,
        irisTaskId: taskId,
      });
      // /api/dispatch can resolve with HTTP 200 and { ok: false, error }
      // (e.g. when iris-lead itself is unreachable) — postJSON only
      // rejects on a non-2xx status, so this must be checked explicitly
      // or a failed dispatch would be reported as a success.
      if (!result?.ok) {
        throw new Error(result?.error || "dispatch failed");
      }
      showNotification("Task dispatched");
      // Re-render from a fresh GET so dispatchTaskId appears once the
      // dormant link hook has written it.
      await openPlanDetail(planId);
    } catch (err) {
      showNotification("Failed to dispatch task: " + err.message, "error");
      dispatchBtn.disabled = false;
      dispatchBtn.textContent = originalText;
    }
    return;
  }
  const toggleAddTaskBtn = e.target.closest('[data-action="toggleAddTask"]');
  if (toggleAddTaskBtn) {
    const form = document.getElementById("addTaskForm");
    if (form) form.style.display = form.style.display === "none" ? "grid" : "none";
    return;
  }
  const cancelAddTaskBtn = e.target.closest('[data-action="cancelAddTask"]');
  if (cancelAddTaskBtn) {
    const form = document.getElementById("addTaskForm");
    if (form) form.style.display = "none";
    return;
  }
  const submitAddTaskBtn = e.target.closest('[data-action="submitAddTask"]');
  if (submitAddTaskBtn) {
    const form = document.getElementById("addTaskForm");
    const planId = form?.dataset.planId;
    if (!planId || submitAddTaskBtn.disabled) return;
    const title = document.getElementById("addTaskTitle")?.value.trim();
    const instructions = document.getElementById("addTaskInstructions")?.value.trim();
    const agent = document.getElementById("addTaskAgent")?.value.trim();
    if (!title && !instructions) {
      showNotification("Give the task a title or instructions", "error");
      return;
    }
    const originalText = submitAddTaskBtn.textContent;
    submitAddTaskBtn.disabled = true;
    submitAddTaskBtn.textContent = "Adding…";
    try {
      await postJSON("/api/iris/plans/" + encodeURIComponent(planId) + "/tasks", {
        title,
        instructions,
        runtimeAgentId: agent || undefined,
      });
      showNotification("Task added");
      await openPlanDetail(planId);
    } catch (err) {
      showNotification("Failed to add task: " + err.message, "error");
      submitAddTaskBtn.disabled = false;
      submitAddTaskBtn.textContent = originalText;
    }
    return;
  }
  const toggleAttachEvidenceBtn = e.target.closest('[data-action="toggleAttachEvidence"]');
  if (toggleAttachEvidenceBtn) {
    const form = document.getElementById("attachEvidenceForm");
    if (form) form.style.display = form.style.display === "none" ? "grid" : "none";
    return;
  }
  const cancelAttachEvidenceBtn = e.target.closest('[data-action="cancelAttachEvidence"]');
  if (cancelAttachEvidenceBtn) {
    const form = document.getElementById("attachEvidenceForm");
    if (form) form.style.display = "none";
    return;
  }
  const submitAttachEvidenceBtn = e.target.closest('[data-action="submitAttachEvidence"]');
  if (submitAttachEvidenceBtn) {
    const form = document.getElementById("attachEvidenceForm");
    const planId = form?.dataset.planId;
    if (!planId || submitAttachEvidenceBtn.disabled) return;
    const type = document.getElementById("evidenceType")?.value || "note";
    const taskId = document.getElementById("evidenceTaskId")?.value || undefined;
    const title = document.getElementById("evidenceTitle")?.value.trim() || undefined;
    const summary = document.getElementById("evidenceSummary")?.value.trim() || undefined;
    const data = buildEvidenceData(type);
    if (!data) {
      showNotification("Fill in the required field for this evidence type", "error");
      return;
    }
    const originalText = submitAttachEvidenceBtn.textContent;
    submitAttachEvidenceBtn.disabled = true;
    submitAttachEvidenceBtn.textContent = "Attaching…";
    try {
      await postJSON("/api/iris/plans/" + encodeURIComponent(planId) + "/evidence", {
        type,
        taskId,
        title,
        summary,
        data,
      });
      showNotification("Evidence attached");
      await openPlanDetail(planId);
    } catch (err) {
      showNotification("Failed to attach evidence: " + err.message, "error");
      submitAttachEvidenceBtn.disabled = false;
      submitAttachEvidenceBtn.textContent = originalText;
    }
    return;
  }
  const toggleRecordConflictBtn = e.target.closest('[data-action="toggleRecordConflict"]');
  if (toggleRecordConflictBtn) {
    const form = document.getElementById("recordConflictForm");
    if (form) form.style.display = form.style.display === "none" ? "grid" : "none";
    return;
  }
  const cancelRecordConflictBtn = e.target.closest('[data-action="cancelRecordConflict"]');
  if (cancelRecordConflictBtn) {
    const form = document.getElementById("recordConflictForm");
    if (form) form.style.display = "none";
    return;
  }
  const submitRecordConflictBtn = e.target.closest('[data-action="submitRecordConflict"]');
  if (submitRecordConflictBtn) {
    const form = document.getElementById("recordConflictForm");
    const planId = form?.dataset.planId;
    if (!planId || submitRecordConflictBtn.disabled) return;
    const type = document.getElementById("conflictType")?.value || "other";
    const taskId = document.getElementById("conflictTaskId")?.value || undefined;
    const description = document.getElementById("conflictDescription")?.value.trim();
    if (!description) {
      showNotification("Describe the conflict before recording it", "error");
      return;
    }
    const originalText = submitRecordConflictBtn.textContent;
    submitRecordConflictBtn.disabled = true;
    submitRecordConflictBtn.textContent = "Recording…";
    try {
      await postJSON("/api/iris/plans/" + encodeURIComponent(planId) + "/conflicts", {
        type,
        description,
        taskIds: taskId ? [taskId] : undefined,
      });
      showNotification("Conflict recorded");
      await openPlanDetail(planId);
    } catch (err) {
      showNotification("Failed to record conflict: " + err.message, "error");
      submitRecordConflictBtn.disabled = false;
      submitRecordConflictBtn.textContent = originalText;
    }
    return;
  }
  const toggleResolveBtn = e.target.closest('[data-action="toggleResolveConflict"]');
  if (toggleResolveBtn) {
    const conflictId = toggleResolveBtn.dataset.conflictId;
    const form = document.getElementById("resolveForm-" + conflictId);
    if (form) form.style.display = form.style.display === "none" ? "grid" : "none";
    return;
  }
  const submitResolveBtn = e.target.closest('[data-action="submitResolveConflict"]');
  if (submitResolveBtn) {
    const form = submitResolveBtn.closest("[data-plan-id][data-conflict-id]");
    const planId = form?.dataset.planId;
    const conflictId = form?.dataset.conflictId;
    const status = submitResolveBtn.dataset.status;
    if (!planId || !conflictId || submitResolveBtn.disabled) return;
    const resolution = form.querySelector(".resolve-note")?.value.trim();
    if (!resolution) {
      showNotification("A resolution note is required", "error");
      return;
    }
    const originalText = submitResolveBtn.textContent;
    submitResolveBtn.disabled = true;
    submitResolveBtn.textContent = "Saving…";
    try {
      await patchJSON(
        "/api/iris/plans/" + encodeURIComponent(planId) + "/conflicts/" + encodeURIComponent(conflictId) + "/resolve",
        { status, resolution },
      );
      showNotification(status === "dismissed" ? "Conflict dismissed" : "Conflict resolved");
      await openPlanDetail(planId);
    } catch (err) {
      showNotification("Failed to update conflict: " + err.message, "error");
      submitResolveBtn.disabled = false;
      submitResolveBtn.textContent = originalText;
    }
  }
});

function buildEvidenceData(type) {
  const val = (id) => document.getElementById(id)?.value.trim() || "";
  switch (type) {
    case "file": {
      const path = val("evidenceFilePath");
      if (!path) return null;
      const data = { path };
      const action = val("evidenceFileAction");
      if (action) data.action = action;
      return data;
    }
    case "command": {
      const command = val("evidenceCommandText");
      if (!command) return null;
      const data = { command };
      const exitCode = val("evidenceExitCode");
      if (exitCode && !Number.isNaN(Number(exitCode))) data.exitCode = Number(exitCode);
      const passed = document.getElementById("evidencePassed")?.value;
      if (passed === "true") data.passed = true;
      else if (passed === "false") data.passed = false;
      return data;
    }
    case "message": {
      const excerpt = val("evidenceExcerpt");
      if (!excerpt) return null;
      const data = { excerpt };
      const agentId = val("evidenceAgentId");
      if (agentId) data.agentId = agentId;
      return data;
    }
    case "artifact": {
      const pathOrUrl = val("evidenceArtifactPath");
      if (!pathOrUrl) return null;
      const data = /^https?:\/\//i.test(pathOrUrl) ? { url: pathOrUrl } : { path: pathOrUrl };
      const label = val("evidenceArtifactLabel");
      if (label) data.label = label;
      return data;
    }
    case "note":
    default: {
      const text = val("evidenceNoteText");
      if (!text) return null;
      return { text };
    }
  }
}
