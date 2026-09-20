/**
 * Smoke test for iris-cli/src/agent/loop.ts
 *
 * Proves the full Iris loop (plan -> dispatch -> evidence -> verify -> report)
 * runs end to end. The worker/LLM call is dependency-injected via the
 * Dispatcher interface so this test is deterministic and needs no live API
 * key, but it exercises the exact same code path runIris() uses against a
 * real LocalExecutor in production.
 *
 * Run with: node --import tsx --test iris-cli/tests/unit/agent-loop.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makePlan, dispatchTask, verify, runIris } from '../../src/agent/loop.js';

function makeSucceedingDispatcher(resultText = 'done: wrote hello.txt') {
  return {
    calls: [],
    async execute(task, options) {
      this.calls.push({ task, options });
      return {
        success: true,
        result: resultText,
        model: 'fake-model',
        providerId: 'fake-provider',
      };
    },
  };
}

function makeFailingDispatcher(message = 'provider unreachable') {
  return {
    async execute() {
      throw new Error(message);
    },
  };
}

describe('agent/loop: makePlan', () => {
  it('produces a plan with at least one task', () => {
    const plan = makePlan('write a hello world script');
    assert.equal(plan.tasks.length >= 1, true);
    assert.equal(plan.tasks[0].status, 'pending');
    assert.equal(plan.tasks[0].objective, 'write a hello world script');
  });

  it('rejects an empty objective', () => {
    assert.throws(() => makePlan('   '), /objective must not be empty/);
  });
});

describe('agent/loop: dispatchTask', () => {
  it('dispatches to the worker and records evidence on success', async () => {
    const plan = makePlan('do the thing');
    const dispatcher = makeSucceedingDispatcher();

    const evidence = await dispatchTask(plan.tasks[0], dispatcher);

    assert.equal(dispatcher.calls.length, 1);
    assert.equal(dispatcher.calls[0].task, 'do the thing');
    assert.equal(plan.tasks[0].status, 'completed');
    assert.equal(evidence.error, undefined);
    assert.equal(evidence.resultText, 'done: wrote hello.txt');
    assert.equal(evidence.model, 'fake-model');
    assert.equal(typeof evidence.durationMs, 'number');
  });

  it('records failure evidence without throwing when the worker errors', async () => {
    const plan = makePlan('do the thing');
    const dispatcher = makeFailingDispatcher('provider unreachable');

    const evidence = await dispatchTask(plan.tasks[0], dispatcher);

    assert.equal(plan.tasks[0].status, 'failed');
    assert.equal(evidence.error, 'provider unreachable');
  });
});

describe('agent/loop: verify', () => {
  it('passes when there is no error and non-empty output', () => {
    const v = verify({
      taskId: 'x',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 5,
      resultText: 'some output',
    });
    assert.equal(v.passed, true);
  });

  it('fails when the result text is empty', () => {
    const v = verify({
      taskId: 'x',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 5,
      resultText: '',
    });
    assert.equal(v.passed, false);
    const check = v.checks.find((c) => c.name === 'non-empty-result');
    assert.equal(check.passed, false);
  });
});

describe('agent/loop: runIris (full end-to-end loop)', () => {
  it('runs objective -> plan -> dispatch -> evidence -> verify -> report on success', async () => {
    const dispatcher = makeSucceedingDispatcher('the answer is 42');

    const report = await runIris('answer the objective', { dispatcher });

    assert.equal(report.success, true);
    assert.equal(report.plan.tasks.length >= 1, true);
    assert.equal(report.task.status, 'completed');
    assert.equal(report.evidence.resultText, 'the answer is 42');
    assert.equal(report.verification.passed, true);
  });

  it('surfaces failure end to end when the worker fails', async () => {
    const dispatcher = makeFailingDispatcher('no API key configured');

    const report = await runIris('answer the objective', { dispatcher });

    assert.equal(report.success, false);
    assert.equal(report.task.status, 'failed');
    assert.equal(report.evidence.error, 'no API key configured');
    assert.equal(report.verification.passed, false);
  });
});
