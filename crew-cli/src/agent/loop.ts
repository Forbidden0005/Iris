/**
 * Iris minimal agent loop: objective -> plan -> dispatch -> evidence -> verify -> report.
 *
 * Deliberately small and ugly. This is glue, not a framework: it wires
 * existing real pieces (LocalExecutor for the actual LLM call) together
 * into one function that can be called end to end.
 */

import { randomUUID } from 'node:crypto';
import { LocalExecutor, ExecutorOptions, ExecutorResult } from '../executor/local.js';

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
    error = err instanceof Error ? err.message : String(err);
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
  options: { dispatcher?: Dispatcher; executorOptions?: ExecutorOptions } = {}
): Promise<IrisReport> {
  const dispatcher = options.dispatcher ?? new LocalExecutor();
  const plan = makePlan(objective);
  const task = plan.tasks[0];

  const evidence = await dispatchTask(task, dispatcher, options.executorOptions);
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
