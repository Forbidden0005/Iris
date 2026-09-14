import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getStatePath } from "../runtime/paths.mjs";
import { getIrisAgentLabel, normalizeIrisAgentId } from "./identity.mjs";

export const IRIS_PLAN_STATUSES = Object.freeze([
  "draft",
  "active",
  "blocked",
  "completed",
  "failed",
  "cancelled",
]);

export const IRIS_TASK_STATUSES = Object.freeze([
  "pending",
  "running",
  "blocked",
  "done",
  "failed",
  "cancelled",
]);

// Evidence v1: manually attached proof a task/plan can point to. Nothing in
// this file collects evidence automatically from runtime logs, RT messages,
// or file writes — see docs/IRIS_CAPABILITY_MAP.md's Evidence v1 section.
export const IRIS_EVIDENCE_TYPES = Object.freeze([
  "file",
  "command",
  "message",
  "note",
  "artifact",
]);

// Review Packet v1: a durable "reviewable report" for a plan's current
// state — a summary plus pointers to evidence, risks, open questions, and
// recommendations. This is NOT an approval/automation system: creating a
// review packet does not change plan/task status, and nothing here implies
// a risk or recommendation is verified beyond what its own evidenceIds
// actually point to. See docs/IRIS_CAPABILITY_MAP.md's Review Packet section.
export const IRIS_REVIEW_STATUSES = Object.freeze(["draft", "ready", "archived"]);
export const IRIS_REVIEW_SEVERITIES = Object.freeze(["low", "medium", "high"]);

const DEFAULT_PROJECT_ID = "general";
const PLAN_STATUS_SET = new Set(IRIS_PLAN_STATUSES);
const TASK_STATUS_SET = new Set(IRIS_TASK_STATUSES);
const EVIDENCE_TYPE_SET = new Set(IRIS_EVIDENCE_TYPES);
const REVIEW_STATUS_SET = new Set(IRIS_REVIEW_STATUSES);
const REVIEW_SEVERITY_SET = new Set(IRIS_REVIEW_SEVERITIES);

// Required fields on evidence.data per type. "artifact" is special-cased
// below since it accepts either path or url, not one fixed field name.
const EVIDENCE_REQUIRED_DATA_FIELDS = {
  file: ["path"],
  command: ["command"],
  message: ["excerpt"],
  note: ["text"],
  artifact: [],
};

function nowIso(now = Date.now()) {
  return new Date(now).toISOString();
}

function sanitizePathSegment(value, fallback = DEFAULT_PROJECT_ID) {
  const clean = String(value || fallback)
    .replace(/[^a-z0-9_.-]/gi, "_")
    .slice(0, 100);
  if (clean === "." || clean === "..") return fallback;
  return clean || fallback;
}

function storageProjectId(projectId) {
  return projectId ? String(projectId) : DEFAULT_PROJECT_ID;
}

function plansRootDir() {
  const dir = getStatePath("iris-plans");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function planFilePath(planId) {
  return path.join(plansRootDir(), `${sanitizePathSegment(planId, "plan")}.json`);
}

function candidatePlanFiles(planId) {
  return [planFilePath(planId)];
}

function planFilesForList() {
  const root = plansRootDir();
  return fs.readdirSync(root)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => path.join(root, entry));
}

function assertPlanStatus(status) {
  if (!PLAN_STATUS_SET.has(status)) {
    throw new Error(`Invalid Iris plan status: ${status}`);
  }
}

function assertTaskStatus(status) {
  if (!TASK_STATUS_SET.has(status)) {
    throw new Error(`Invalid Iris task status: ${status}`);
  }
}

function assertEvidenceType(type) {
  if (!EVIDENCE_TYPE_SET.has(type)) {
    throw new Error(`Invalid Iris evidence type: ${type}`);
  }
}

function assertEvidenceData(type, data) {
  const required = EVIDENCE_REQUIRED_DATA_FIELDS[type] || [];
  for (const field of required) {
    const value = data?.[field];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Iris evidence of type "${type}" requires data.${field}`);
    }
  }
  if (type === "artifact" && !data?.path && !data?.url) {
    throw new Error('Iris evidence of type "artifact" requires data.path or data.url');
  }
}

function assertReviewStatus(status) {
  if (!REVIEW_STATUS_SET.has(status)) {
    throw new Error(`Invalid Iris review status: ${status}`);
  }
}

function assertReviewSeverity(severity) {
  if (severity !== undefined && severity !== null && !REVIEW_SEVERITY_SET.has(severity)) {
    throw new Error(`Invalid Iris review severity: ${severity}`);
  }
}

function assertKnownTaskIds(plan, taskIds, context) {
  for (const taskId of taskIds) {
    if (!plan.tasks.some((task) => task.id === taskId)) {
      throw new Error(`Iris task not found for ${context}: ${taskId}`);
    }
  }
}

function assertKnownEvidenceIds(plan, evidenceIds, context) {
  const known = new Set(
    (Array.isArray(plan.evidence) ? plan.evidence : [])
      .map((entry) => entry?.id)
      .filter(Boolean),
  );
  for (const evidenceId of evidenceIds) {
    if (!known.has(evidenceId)) {
      throw new Error(`Iris evidence not found for ${context}: ${evidenceId}`);
    }
  }
}

function defaultEvidenceTitle(type, data = {}) {
  switch (type) {
    case "file":
      return `File: ${data.path || "unknown"}`;
    case "command":
      return `Command: ${data.command || "unknown"}`;
    case "message":
      return "Message excerpt";
    case "note":
      return "Note";
    case "artifact":
      return `Artifact: ${data.path || data.url || "unknown"}`;
    default:
      return "Evidence";
  }
}

function deriveTitle(input = {}) {
  const title = String(input.title || "").trim();
  if (title) return title.slice(0, 160);
  const request = String(input.userRequest || "").trim();
  if (request) return request.replace(/\s+/g, " ").slice(0, 80);
  return "Untitled Iris plan";
}

function normalizeTask(task = {}, planId, now) {
  const runtimeAgentId = normalizeIrisAgentId(task.agentId || task.runtimeAgentId || "iris");
  const status = task.status || "pending";
  assertTaskStatus(status);
  const createdAt = task.createdAt || nowIso(now);
  const updatedAt = task.updatedAt || createdAt;

  return {
    id: task.id || `task_${crypto.randomUUID()}`,
    planId,
    title: String(task.title || task.instructions || "Untitled task").trim().slice(0, 160) || "Untitled task",
    instructions: String(task.instructions || task.title || "").trim(),
    status,
    runtimeAgentId,
    displayName: task.displayName || getIrisAgentLabel(runtimeAgentId),
    allowedTools: Array.isArray(task.allowedTools) ? [...task.allowedTools] : [],
    evidenceIds: Array.isArray(task.evidenceIds) ? [...task.evidenceIds] : [],
    // Opaque link to whatever the RT bus/dispatch system calls this task
    // (e.g. gateway-bridge's taskId). Iris never generates this itself —
    // it's only ever set by linkIrisPlanTaskToDispatch once a real
    // dispatch task exists. null until then, and stays backward-compatible
    // for task records written before this field existed.
    dispatchTaskId: task.dispatchTaskId || null,
    summary: task.summary || null,
    failureReason: task.failureReason || null,
    createdAt,
    updatedAt,
    metadata: task.metadata && typeof task.metadata === "object" ? { ...task.metadata } : {},
  };
}

function normalizeEvidence(evidence = {}, planId, now) {
  assertEvidenceType(evidence.type);
  const data =
    evidence.data && typeof evidence.data === "object" ? { ...evidence.data } : {};
  assertEvidenceData(evidence.type, data);
  const createdAt = evidence.createdAt || nowIso(now);

  return {
    id: evidence.id || `evidence_${crypto.randomUUID()}`,
    planId,
    taskId: evidence.taskId || null,
    type: evidence.type,
    title:
      String(evidence.title || defaultEvidenceTitle(evidence.type, data))
        .trim()
        .slice(0, 160) || defaultEvidenceTitle(evidence.type, data),
    summary: evidence.summary || null,
    createdAt,
    source:
      evidence.source && typeof evidence.source === "object"
        ? { ...evidence.source }
        : null,
    data,
    metadata:
      evidence.metadata && typeof evidence.metadata === "object"
        ? { ...evidence.metadata }
        : {},
  };
}

function normalizeReviewItem(item = {}, kind, plan, now) {
  const text = String(item.text || "").trim();
  if (!text) throw new Error(`Iris review ${kind} requires text`);

  assertReviewSeverity(item.severity);
  const evidenceIds = Array.isArray(item.evidenceIds) ? [...item.evidenceIds] : [];
  const taskIds = Array.isArray(item.taskIds) ? [...item.taskIds] : [];
  assertKnownEvidenceIds(plan, evidenceIds, `review ${kind}`);
  assertKnownTaskIds(plan, taskIds, `review ${kind}`);

  return {
    id: item.id || `${kind}_${crypto.randomUUID()}`,
    text,
    severity: item.severity || null,
    evidenceIds,
    taskIds,
  };
}

function normalizeReviewPacket(review = {}, plan, now) {
  const status = review.status || "draft";
  assertReviewStatus(status);
  const createdAt = review.createdAt || nowIso(now);
  const updatedAt = review.updatedAt || createdAt;

  const taskIds = Array.isArray(review.taskIds) ? [...review.taskIds] : [];
  const evidenceIds = Array.isArray(review.evidenceIds) ? [...review.evidenceIds] : [];
  assertKnownTaskIds(plan, taskIds, "review");
  assertKnownEvidenceIds(plan, evidenceIds, "review");

  return {
    id: review.id || `review_${crypto.randomUUID()}`,
    planId: plan.id,
    title: String(review.title || "Untitled review").trim().slice(0, 160) || "Untitled review",
    summary: String(review.summary || ""),
    status,
    createdAt,
    updatedAt,
    taskIds,
    evidenceIds,
    risks: Array.isArray(review.risks)
      ? review.risks.map((item) => normalizeReviewItem(item, "risk", plan, now))
      : [],
    openQuestions: Array.isArray(review.openQuestions)
      ? review.openQuestions.map((item) => normalizeReviewItem(item, "openQuestion", plan, now))
      : [],
    recommendations: Array.isArray(review.recommendations)
      ? review.recommendations.map((item) => normalizeReviewItem(item, "recommendation", plan, now))
      : [],
    metadata:
      review.metadata && typeof review.metadata === "object" ? { ...review.metadata } : {},
  };
}

function normalizePlan(plan = {}) {
  if (!plan.id) throw new Error("Iris plan id is required");
  const status = plan.status || "draft";
  assertPlanStatus(status);
  const createdAt = plan.createdAt || nowIso();
  const updatedAt = plan.updatedAt || createdAt;
  const projectId = storageProjectId(plan.projectId);

  return {
    id: String(plan.id),
    title: deriveTitle(plan),
    userRequest: String(plan.userRequest || ""),
    projectId,
    requestedBy: plan.requestedBy ? String(plan.requestedBy) : null,
    status,
    tasks: Array.isArray(plan.tasks)
      ? plan.tasks.map((task) => normalizeTask(task, String(plan.id), Date.parse(updatedAt) || Date.now()))
      : [],
    // Loaded evidence is passed through as-is (not re-validated) so plans
    // written before Evidence v1, or with hand-edited entries, still load.
    // New entries only go through normalizeEvidence() via addIrisPlanEvidence.
    evidence: Array.isArray(plan.evidence) ? [...plan.evidence] : [],
    // Same passthrough rule for review packets — plans predating Review
    // Packet v1 simply have no `reviews` key and default to [].
    reviews: Array.isArray(plan.reviews) ? [...plan.reviews] : [],
    createdAt,
    updatedAt,
    metadata: plan.metadata && typeof plan.metadata === "object" ? { ...plan.metadata } : {},
  };
}

export function createIrisPlan(input = {}, options = {}) {
  const now = options.now ?? Date.now();
  const createdAt = nowIso(now);
  const id = input.id || `plan_${crypto.randomUUID()}`;
  const plan = normalizePlan({
    id,
    title: input.title,
    userRequest: input.userRequest,
    projectId: input.projectId,
    requestedBy: input.requestedBy,
    status: input.status || "draft",
    tasks: input.tasks || [],
    evidence: input.evidence || [],
    createdAt,
    updatedAt: createdAt,
    metadata: input.metadata || {},
  });
  saveIrisPlan(plan);
  return plan;
}

export function saveIrisPlan(plan) {
  const normalized = normalizePlan(plan);
  // Safe for the current single dashboard writer; add file locking before multi-process writes.
  const file = planFilePath(normalized.id);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(normalized, null, 2)}
`, "utf8");
  fs.renameSync(tmp, file);
  return normalized;
}

export function loadIrisPlan(planId, options = {}) {
  if (!planId) return null;
  for (const file of candidatePlanFiles(planId)) {
    if (!fs.existsSync(file)) continue;
    return normalizePlan(JSON.parse(fs.readFileSync(file, "utf8")));
  }
  return null;
}

export function listIrisPlans(options = {}) {
  const plans = [];
  for (const file of planFilesForList()) {
    try {
      const plan = normalizePlan(JSON.parse(fs.readFileSync(file, "utf8")));
      if (options.projectId && plan.projectId !== String(options.projectId)) continue;
      if (options.status && plan.status !== options.status) continue;
      plans.push(plan);
    } catch {
      // Ignore corrupt plan files. Future observability can surface these.
    }
  }
  plans.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return plans;
}

export function updateIrisPlanStatus(planId, status, options = {}) {
  assertPlanStatus(status);
  const plan = loadIrisPlan(planId, options);
  if (!plan) throw new Error(`Iris plan not found: ${planId}`);
  plan.status = status;
  plan.updatedAt = nowIso(options.now ?? Date.now());
  return saveIrisPlan(plan);
}

export function addIrisPlanTask(planId, task = {}, options = {}) {
  const plan = loadIrisPlan(planId, options);
  if (!plan) throw new Error(`Iris plan not found: ${planId}`);
  const now = options.now ?? Date.now();
  const nextTask = normalizeTask(task, plan.id, now);
  plan.tasks.push(nextTask);
  plan.updatedAt = nowIso(now);
  saveIrisPlan(plan);
  return nextTask;
}

export function updateIrisPlanTaskStatus(planId, taskId, status, updates = {}, options = {}) {
  assertTaskStatus(status);
  const plan = loadIrisPlan(planId, options);
  if (!plan) throw new Error(`Iris plan not found: ${planId}`);
  const task = plan.tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new Error(`Iris task not found: ${taskId}`);
  const now = options.now ?? Date.now();
  task.status = status;
  if (Object.prototype.hasOwnProperty.call(updates, "summary")) task.summary = updates.summary;
  if (Object.prototype.hasOwnProperty.call(updates, "failureReason")) task.failureReason = updates.failureReason;
  if (Array.isArray(updates.evidenceIds)) task.evidenceIds = [...updates.evidenceIds];
  task.updatedAt = nowIso(now);
  plan.updatedAt = task.updatedAt;
  saveIrisPlan(plan);
  return task;
}

/**
 * Links a plan task to an external RT/dispatch task id. This is the only
 * function that writes task.dispatchTaskId — nothing in lib/iris generates
 * dispatch ids itself. A future dispatch-side caller (not added by this
 * slice — see docs/IRIS_CAPABILITY_MAP.md's Slice 8 note) is expected to
 * call this once it has actually created a real dispatch task, so the link
 * only ever reflects dispatch calling back into Iris, never the reverse.
 */
export function linkIrisPlanTaskToDispatch(planId, taskId, dispatchTaskId, options = {}) {
  const plan = loadIrisPlan(planId, options);
  if (!plan) throw new Error(`Iris plan not found: ${planId}`);
  const task = plan.tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new Error(`Iris task not found: ${taskId}`);
  const cleanDispatchTaskId = String(dispatchTaskId || "").trim();
  if (!cleanDispatchTaskId) throw new Error("dispatchTaskId is required");

  const now = options.now ?? Date.now();
  task.dispatchTaskId = cleanDispatchTaskId;
  task.updatedAt = nowIso(now);
  plan.updatedAt = task.updatedAt;
  saveIrisPlan(plan);
  return task;
}

export function addIrisPlanEvidence(planId, evidence = {}, options = {}) {
  const plan = loadIrisPlan(planId, options);
  if (!plan) throw new Error(`Iris plan not found: ${planId}`);
  const now = options.now ?? Date.now();

  let task = null;
  if (evidence.taskId) {
    task = plan.tasks.find((candidate) => candidate.id === evidence.taskId);
    if (!task) throw new Error(`Iris task not found: ${evidence.taskId}`);
  }

  const record = normalizeEvidence(evidence, plan.id, now);
  plan.evidence.push(record);

  if (task && !task.evidenceIds.includes(record.id)) {
    task.evidenceIds.push(record.id);
    task.updatedAt = nowIso(now);
  }

  plan.updatedAt = nowIso(now);
  saveIrisPlan(plan);
  return record;
}

export function listIrisPlanEvidence(planId, options = {}) {
  const plan = loadIrisPlan(planId, options);
  if (!plan) throw new Error(`Iris plan not found: ${planId}`);
  const evidence = Array.isArray(plan.evidence) ? plan.evidence : [];
  if (options.taskId) {
    return evidence.filter((entry) => entry?.taskId === options.taskId);
  }
  return [...evidence];
}

export function createIrisPlanReview(planId, review = {}, options = {}) {
  const plan = loadIrisPlan(planId, options);
  if (!plan) throw new Error(`Iris plan not found: ${planId}`);
  const now = options.now ?? Date.now();

  const record = normalizeReviewPacket(review, plan, now);
  plan.reviews.push(record);
  plan.updatedAt = nowIso(now);
  saveIrisPlan(plan);
  return record;
}

export function listIrisPlanReviews(planId, options = {}) {
  const plan = loadIrisPlan(planId, options);
  if (!plan) throw new Error(`Iris plan not found: ${planId}`);
  const reviews = Array.isArray(plan.reviews) ? plan.reviews : [];
  if (options.status) {
    return reviews.filter((entry) => entry?.status === options.status);
  }
  return [...reviews];
}

export function loadIrisPlanReview(planId, reviewId, options = {}) {
  const plan = loadIrisPlan(planId, options);
  if (!plan) throw new Error(`Iris plan not found: ${planId}`);
  const reviews = Array.isArray(plan.reviews) ? plan.reviews : [];
  return reviews.find((entry) => entry?.id === reviewId) || null;
}

/**
 * Review Generator v1 — builds a draft review packet purely from a plan's
 * existing records (task status, task.summary, and evidence.taskId links).
 * No LLM call, no new facts: every risk/openQuestion/recommendation here is
 * a direct, deterministic restatement of something already on the plan.
 * Always produces a "draft" packet — never "ready" — since a template
 * summarizing records is not the same as a human (or Iris) actually
 * reviewing them.
 */
export function generateIrisPlanReview(planId, options = {}) {
  const plan = loadIrisPlan(planId, options);
  if (!plan) throw new Error(`Iris plan not found: ${planId}`);

  const explicitTaskIds = Array.isArray(options.taskIds) ? options.taskIds : null;
  if (explicitTaskIds) {
    for (const taskId of explicitTaskIds) {
      if (!plan.tasks.some((task) => task.id === taskId)) {
        throw new Error(`Iris task not found for review generation: ${taskId}`);
      }
    }
  }

  const taskIds = explicitTaskIds || plan.tasks.map((task) => task.id);
  const scopedTasks = plan.tasks.filter((task) => taskIds.includes(task.id));
  const allEvidence = Array.isArray(plan.evidence) ? plan.evidence : [];

  const linkedEvidence = allEvidence.filter(
    (entry) => entry?.taskId && taskIds.includes(entry.taskId),
  );
  const planLevelEvidence = allEvidence.filter((entry) => !entry?.taskId);

  const evidenceIdSet = new Set(linkedEvidence.map((entry) => entry.id));
  if (options.includePlanEvidence === true) {
    for (const entry of planLevelEvidence) evidenceIdSet.add(entry.id);
  }
  const evidenceIds = [...evidenceIdSet];

  const tasksWithoutEvidence = scopedTasks.filter(
    (task) => !linkedEvidence.some((entry) => entry.taskId === task.id),
  );
  const tasksWithoutSummary = scopedTasks.filter((task) => !task.summary);
  const failedTasks = scopedTasks.filter((task) => task.status === "failed");
  const blockedTasks = scopedTasks.filter((task) => task.status === "blocked");
  const allDone = scopedTasks.length > 0 && scopedTasks.every((task) => task.status === "done");

  const risks = [];
  for (const task of failedTasks) {
    risks.push({ text: `Task "${task.title}" failed.`, severity: "high", taskIds: [task.id] });
  }
  for (const task of blockedTasks) {
    risks.push({ text: `Task "${task.title}" is blocked.`, severity: "medium", taskIds: [task.id] });
  }
  if (tasksWithoutEvidence.length) {
    risks.push({
      text: `${tasksWithoutEvidence.length} task(s) have no attached evidence.`,
      severity: "medium",
      taskIds: tasksWithoutEvidence.map((task) => task.id),
    });
  }

  const openQuestions = [];
  if (tasksWithoutSummary.length) {
    openQuestions.push({
      text: `${tasksWithoutSummary.length} task(s) have no recorded summary.`,
      taskIds: tasksWithoutSummary.map((task) => task.id),
    });
  }
  if (tasksWithoutEvidence.length) {
    openQuestions.push({
      text: `Is evidence still needed for ${tasksWithoutEvidence.length} task(s) that currently have none?`,
      taskIds: tasksWithoutEvidence.map((task) => task.id),
    });
  }

  const recommendations = [];
  const unresolvedTasks = [...failedTasks, ...blockedTasks];
  if (unresolvedTasks.length) {
    recommendations.push({
      text: `Resolve ${unresolvedTasks.length} failed/blocked task(s) before treating this plan as complete.`,
      taskIds: unresolvedTasks.map((task) => task.id),
    });
  }
  if (allDone && evidenceIds.length === 0) {
    recommendations.push({
      text: `All ${scopedTasks.length} task(s) are marked done, but no evidence is attached — completion is not fully supported by attached evidence.`,
      taskIds: scopedTasks.map((task) => task.id),
    });
  }

  const summary = `Review draft for ${taskIds.length} task(s) with ${evidenceIds.length} attached evidence record(s).`;

  return createIrisPlanReview(
    planId,
    {
      title: `Review draft: ${plan.title}`,
      summary,
      status: "draft",
      taskIds,
      evidenceIds,
      risks,
      openQuestions,
      recommendations,
      metadata: { generated: true, generatedBy: "generateIrisPlanReview" },
    },
    options,
  );
}

export function clearIrisPlans() {
  const dir = plansRootDir();
  for (const entry of fs.readdirSync(dir)) {
    if (entry.endsWith(".json")) fs.rmSync(path.join(dir, entry), { force: true });
  }
}
