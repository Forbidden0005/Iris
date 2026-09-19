/**
 * Unit tests for the Iris CLI argument parsing and evidence persistence
 * (crew-cli/src/agent/cli.ts), used by scripts/start.mjs.
 *
 * Run with: node --import tsx --test crew-cli/tests/unit/iris-cli.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCliArgs, buildRunRecord, saveRunRecord } from '../../src/agent/cli.js';

describe('cli: parseCliArgs', () => {
  it('parses a plain run command with the cwd as project dir', () => {
    const args = parseCliArgs(['run', 'inspect this repo'], '/home/tyler/project');
    assert.deepEqual(args, {
      command: 'run',
      objective: 'inspect this repo',
      projectDir: '/home/tyler/project',
    });
  });

  it('parses --project-dir override, including Windows-style paths', () => {
    const args = parseCliArgs(
      ['run', 'do the thing', '--project-dir', 'C:\\Users\\tyler\\Desktop\\Projects\\Iris\\crew-cli'],
      '/ignored'
    );
    assert.equal(args.projectDir, 'C:\\Users\\tyler\\Desktop\\Projects\\Iris\\crew-cli');
    assert.equal(args.objective, 'do the thing');
  });

  it('trims the objective', () => {
    const args = parseCliArgs(['run', '  do the thing  '], '/cwd');
    assert.equal(args.objective, 'do the thing');
  });

  it('rejects a missing command', () => {
    assert.throws(() => parseCliArgs([], '/cwd'), /missing command/);
  });

  it('rejects an unknown command', () => {
    assert.throws(() => parseCliArgs(['fly'], '/cwd'), /unknown command "fly"/);
  });

  it('rejects a missing objective', () => {
    assert.throws(() => parseCliArgs(['run'], '/cwd'), /missing objective/);
  });

  it('rejects an empty/whitespace-only objective', () => {
    assert.throws(() => parseCliArgs(['run', '   '], '/cwd'), /missing objective/);
  });

  it('rejects --project-dir with no value', () => {
    assert.throws(() => parseCliArgs(['run', 'do it', '--project-dir'], '/cwd'), /--project-dir requires a value/);
  });

  it('rejects an unknown flag', () => {
    assert.throws(() => parseCliArgs(['run', 'do it', '--bogus'], '/cwd'), /unknown flag "--bogus"/);
  });

  it('rejects extra positional arguments', () => {
    assert.throws(() => parseCliArgs(['run', 'do it', 'extra'], '/cwd'), /too many positional arguments/);
  });
});

describe('cli: buildRunRecord', () => {
  it('captures success, model, and result text from a report', () => {
    const report = {
      objective: 'inspect this repo',
      plan: { title: 'inspect this repo', tasks: [] },
      task: { id: '1', objective: 'inspect this repo', status: 'completed' },
      evidence: {
        taskId: '1',
        startedAt: '2026-01-01T00:00:00.000Z',
        finishedAt: '2026-01-01T00:00:05.000Z',
        durationMs: 5000,
        model: 'qwen2.5-coder:7b',
        resultText: 'done: ran tests, all green',
      },
      verification: { passed: true, checks: [] },
      success: true,
    };

    const record = buildRunRecord(report, {
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:00:05.000Z',
      ollamaUrl: 'http://localhost:11434',
    });

    assert.equal(record.objective, 'inspect this repo');
    assert.equal(record.success, true);
    assert.equal(record.provider.kind, 'ollama');
    assert.equal(record.provider.model, 'qwen2.5-coder:7b');
    assert.equal(record.resultText, 'done: ran tests, all green');
    assert.equal(record.error, undefined);
  });

  it('extracts shell commands from fenced code blocks in the result text', () => {
    const report = {
      objective: 'run tests',
      plan: { title: 'run tests', tasks: [] },
      task: { id: '1', objective: 'run tests', status: 'completed' },
      evidence: {
        taskId: '1',
        startedAt: 't0',
        finishedAt: 't1',
        durationMs: 1,
        resultText: 'Ran the test suite:\n```bash\nnode --test tests/unit/agent-loop.test.js\n```\nAll green.',
      },
      verification: { passed: true, checks: [] },
      success: true,
    };

    const record = buildRunRecord(report, { startedAt: 't0', finishedAt: 't1', ollamaUrl: 'http://x' });
    assert.deepEqual(record.commandsRun, ['node --test tests/unit/agent-loop.test.js']);
  });

  it('carries the failure reason through when the task did not succeed', () => {
    const report = {
      objective: 'do the thing',
      plan: { title: 'do the thing', tasks: [] },
      task: { id: '1', objective: 'do the thing', status: 'failed' },
      evidence: {
        taskId: '1',
        startedAt: 't0',
        finishedAt: 't1',
        durationMs: 1,
        error: 'executor reported failure',
      },
      verification: { passed: false, checks: [] },
      success: false,
    };

    const record = buildRunRecord(report, { startedAt: 't0', finishedAt: 't1', ollamaUrl: 'http://x' });
    assert.equal(record.success, false);
    assert.equal(record.error, 'executor reported failure');
  });
});

describe('cli: saveRunRecord', () => {
  it('writes a run record under .iris/runs and returns the path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'iris-cli-test-'));
    try {
      const record = {
        objective: 'inspect this repo',
        startedAt: '2026-01-01T00:00:00.000Z',
        finishedAt: '2026-01-01T00:00:05.000Z',
        provider: { kind: 'ollama', url: 'http://localhost:11434', model: 'qwen2.5-coder:7b' },
        toolsUsed: [],
        commandsRun: [],
        resultText: 'done',
        success: true,
      };

      const path = saveRunRecord(record, dir);
      assert.equal(path, join(dir, '.iris', 'runs', '2026-01-01T00-00-00-000Z.json'));

      const written = JSON.parse(readFileSync(path, 'utf8'));
      assert.deepEqual(written, record);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
