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

const DEFAULT_PROJECT_ID = "general";
const PLAN_STATUS_SET = new Set(IRIS_PLAN_STATUSES);
const TASK_STATUS_SET = new Set(IRIS_TASK_STATUSES);
const EVIDENCE_TYPE_SET = new Set(IRIS_EVIDENCE_TYPES);

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
  if (request) return request.replace(/s+/g, " ").slice(0, 80);
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

export function clearIrisPlans() {
  const dir = plansRootDir();
  for (const entry of fs.readdirSync(dir)) {
    if (entry.endsWith(".json")) fs.rmSync(path.join(dir, entry), { force: true });
  }
}
