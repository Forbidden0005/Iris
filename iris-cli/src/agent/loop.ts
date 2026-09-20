/**
 * Iris minimal agent loop: objective -> plan -> local model/tool dispatch ->
 * evidence -> verify -> report.
 *
 * Deliberately small and ugly. This is glue, not a framework: it wires
 * existing real pieces together into one function that can be called end
 * to end.
 *
 * CORRECTION (see git history): the first version of this file defaulted
 * to LocalExecutor, which only ever calls cloud-provider APIs
 * (Anthropic/OpenAI/Gemini/...) and has no tool loop at all — it just
 * returns raw LLM text. That is not Iris's architecture. Iris's runtime
 * is supposed to route to local models (Qwen3 14B / Qwen3-Coder 30B via
 * Ollama) and give them real local tools (files, shell, git). That
 * runtime already exists in this repo as `runAgenticWorker()`
 * (src/executor/agentic-executor.ts) + `Sandbox` + `GeminiToolAdapter` —
 * it already has an Ollama-first, keyless provider path
 * (http://localhost:11434/v1/chat/completions). This file previously
 * ignored it entirely and went straight to `LocalExecutor` instead.
 * `localAgentDispatcher()` below is the fix: it's the default dispatcher
 * now, and it drives the real local tool loop. `LocalExecutor` is only
 * used if a caller explicitly asks for it as a fallback.
 */

import { randomUUID } from 'node:crypto';
import { LocalExecutor, ExecutorOptions, ExecutorResult } from '../executor/local.js';
import { runAgenticWorker, L3_SYSTEM_PROMPT_COMPACT } from '../executor/agentic-executor.js';
import { Sandbox } from '../sandbox/index.js';
import { formatFriendlyFailure } from './friendly-errors.js';

export interface IrisTask {
  id: string;
  objective: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface IrisPlan {
  title: string;
  tasks: IrisTask[];
}

export interface IrisEvidence {
  taskId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  model?: string;
  providerId?: string;
  resultText?: string;
  error?: string;
}

export interface IrisVerification {
  passed: boolean;
  checks: { name: string; passed: boolean; detail?: string }[];
}

export interface IrisReport {
  objective: string;
  plan: IrisPlan;
  task: IrisTask;
  evidence: IrisEvidence;
  verification: IrisVerification;
  success: boolean;
}

/** Anything with the same call shape as LocalExecutor.execute(). Lets tests inject a fake worker. */
export interface Dispatcher {
  execute(task: string, options?: ExecutorOptions): Promise<ExecutorResult>;
}

/**
 * Simple model routing: planning/conversation vs code/tool-heavy execution.
 *
 * Defaults are sized for an 11GB-VRAM card (e.g. GTX 1080 Ti), not for a
 * high-memory workstation: qwen3-coder:30b does not fit in 11GB VRAM and
 * runs slow on CPU/RAM offload, so it is NOT the default — it's an
 * explicit opt-in via IRIS_MODEL_CODE for people with the memory for it.
 * qwen3:14b is left available as an opt-in too, for the same reason
 * (fits tighter on 11GB than qwen3:8b). Both default to local Ollama
 * tags and can be overridden via env — but the default is always local,
 * never a cloud model name.
 */
export const IRIS_MODEL_PLANNING = process.env.IRIS_MODEL_PLANNING || 'qwen3:8b';
export const IRIS_MODEL_CODE = process.env.IRIS_MODEL_CODE || 'qwen2.5-coder:7b';

export function selectModel(kind: 'planning' | 'code'): string {
  return kind === 'planning' ? IRIS_MODEL_PLANNING : IRIS_MODEL_CODE;
}

/**
 * Local, tool-using dispatcher: routes the objective to a local Ollama
 * model (Qwen3 14B for general work, Qwen3-Coder 30B for code/tool-heavy
 * work by default) and lets it act through real local tools (files, shell,
 * git — see GeminiToolAdapter) via the existing runAgenticWorker() runtime.
 * This is what "local-first" actually means for this loop: no cloud API
 * key required, no fake dispatcher, real tool calls against `projectDir`.
 */
export function localAgentDispatcher(options: {
  projectDir?: string;
  model?: string;
  kind?: 'planning' | 'code';
  tier?: 'fast' | 'standard' | 'heavy';
  maxTurns?: number;
} = {}): Dispatcher {
  const projectDir = options.projectDir || process.cwd();
  const sandbox = new Sandbox(projectDir);
  const model = options.model || selectModel(options.kind || 'code');

  return {
    async execute(task: string): Promise<ExecutorResult> {
      const agentic = await runAgenticWorker(task, sandbox, {
        model,
        projectDir,
        tier: options.tier,
        maxTurns: options.maxTurns ?? 15,
        stream: false,
        // Local models run on constrained hardware (7B-14B on ~11GB VRAM):
        // keep the prompt small so a turn finishes generating well inside
        // the per-request timeout instead of returning empty text.
        systemPrompt: L3_SYSTEM_PROMPT_COMPACT,
        includeRepoMap: false,
        includeScratchpad: false,
      });
      return {
        success: agentic.success,
        result: agentic.output,
        model: agentic.modelUsed || model,
        providerId: agentic.providerId,
      };
    },
  };
}

/**
 * Build the smallest possible plan for an objective: one task, no decomposition.
 * Real multi-step decomposition (Planner/DualL2) can be swapped in later without
 * changing the rest of the loop, since it only depends on the IrisPlan shape.
 */
export function makePlan(objective: string): IrisPlan {
  const trimmed = objective.trim();
  if (!trimmed) {
    throw new Error('objective must not be empty');
  }
  return {
    title: trimmed,
    tasks: [
      {
        id: randomUUID(),
        objective: trimmed,
        status: 'pending',
      },
    ],
  };
}

/**
 * Dispatch a single task to a real worker/LLM path, wait for completion or
 * failure, and record evidence of what happened. Never throws: failures are
 * captured in the returned evidence/task status instead.
 */
export async function dispatchTask(
  task: IrisTask,
  dispatcher: Dispatcher,
  options: ExecutorOptions = {}
): Promise<IrisEvidence> {
  task.status = 'running';
  const startedAt = new Date();

  let result: ExecutorResult | undefined;
  let error: string | undefined;

  try {
    result = await dispatcher.execute(task.objective, options);
    if (!result.success) {
      error = 'executor reported failure';
    }
  } catch (err) {
    error = formatFriendlyFailure(err);
  }

  const finishedAt = new Date();
  task.status = error ? 'failed' : 'completed';

  return {
    taskId: task.id,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    model: result?.model,
    providerId: result?.providerId,
    resultText: result?.result,
    error,
  };
}

/**
 * Minimal, non-LLM verification of a task result. This is intentionally
 * cheap and mechanical (mirrors the spirit of qa-gate.ts's deterministic
 * checks) rather than pulling in an LLM-based reviewer for a one-task loop.
 */
export function verify(evidence: IrisEvidence): IrisVerification {
  const checks: IrisVerification['checks'] = [];

  checks.push({
    name: 'no-error',
    passed: !evidence.error,
    detail: evidence.error,
  });

  const hasOutput = Boolean(evidence.resultText && evidence.resultText.trim().length > 0);
  checks.push({
    name: 'non-empty-result',
    passed: hasOutput,
    detail: hasOutput ? undefined : 'worker returned no text',
  });

  checks.push({
    name: 'completed-in-time',
    passed: evidence.durationMs >= 0,
    detail: evidence.durationMs < 0 ? 'negative duration recorded' : undefined,
  });

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}

/**
 * Run the full Iris loop for a single objective: plan (1 task) -> dispatch
 * to a real worker -> attach evidence -> minimally verify -> final report.
 */
export async function runIris(
  objective: string,
  options: {
    dispatcher?: Dispatcher;
    executorOptions?: ExecutorOptions;
    /** projectDir for the default local dispatcher's sandbox/tools */
    projectDir?: string;
    /** 'planning' -> Qwen3 14B, 'code' (default) -> Qwen3-Coder 30B */
    kind?: 'planning' | 'code';
    /** Explicit opt-in only: fall back to a cloud-provider LocalExecutor
     *  call if the local Ollama dispatch fails. Off by default — cloud
     *  keys are not the primary Iris path. */
    cloudFallback?: boolean;
  } = {}
): Promise<IrisReport> {
  const dispatcher = options.dispatcher ?? localAgentDispatcher({ projectDir: options.projectDir, kind: options.kind });
  const plan = makePlan(objective);
  const task = plan.tasks[0];

  let evidence = await dispatchTask(task, dispatcher, options.executorOptions);

  if (evidence.error && options.cloudFallback && !options.dispatcher) {
    evidence = await dispatchTask(task, new LocalExecutor(), options.executorOptions);
    evidence.error = evidence.error
      ? `local dispatch failed, cloud fallback also failed: ${evidence.error}`
      : evidence.error;
  }

  const verification = verify(evidence);

  return {
    objective,
    plan,
    task,
    evidence,
    verification,
    success: task.status === 'completed' && verification.passed,
  };
}
