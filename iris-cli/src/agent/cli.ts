/**
 * CLI argument parsing and run-evidence persistence for the Iris CLI
 * entrypoint (scripts/start.mjs). Split out from the script itself so it
 * can be unit tested without spawning a process or talking to Ollama.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IrisReport } from './loop.js';

export interface IrisCliArgs {
  command: 'run';
  objective: string;
  projectDir: string;
}

/**
 * Parse `argv` (i.e. process.argv.slice(2)) into the CLI's arguments.
 * Supported form: `run "<objective>" [--project-dir <dir>]`.
 * Throws a plain Error with a human-readable message on anything invalid.
 */
export function parseCliArgs(argv: string[], cwd: string = process.cwd()): IrisCliArgs {
  const args = [...argv];
  const command = args.shift();

  if (!command) {
    throw new Error('missing command. Usage: iris run "<objective>" [--project-dir <dir>]');
  }
  if (command !== 'run') {
    throw new Error(`unknown command "${command}". Only "run" is supported.`);
  }

  let objective: string | undefined;
  let projectDir = cwd;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--project-dir') {
      const value = args[i + 1];
      if (!value) {
        throw new Error('--project-dir requires a value');
      }
      projectDir = value;
      i++;
      continue;
    }
    if (arg.startsWith('--')) {
      throw new Error(`unknown flag "${arg}"`);
    }
    if (objective === undefined) {
      objective = arg;
    } else {
      throw new Error('too many positional arguments. Wrap the objective in quotes: iris run "do the thing"');
    }
  }

  if (!objective || !objective.trim()) {
    throw new Error('missing objective. Usage: iris run "<objective>" [--project-dir <dir>]');
  }

  return { command: 'run', objective: objective.trim(), projectDir };
}

export interface IrisRunRecord {
  objective: string;
  startedAt: string;
  finishedAt: string;
  provider: {
    kind: 'ollama';
    url: string;
    model?: string;
  };
  toolsUsed: string[];
  commandsRun: string[];
  resultText?: string;
  success: boolean;
  error?: string;
}

/** Best-effort extraction of shell commands the worker ran, from its result text. */
function extractCommandsRun(resultText: string | undefined): string[] {
  if (!resultText) return [];
  const commands: string[] = [];
  const shellBlockRe = /```(?:bash|sh|shell|console)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = shellBlockRe.exec(resultText))) {
    for (const line of match[1].split('\n')) {
      const trimmed = line.trim().replace(/^\$\s*/, '');
      if (trimmed) commands.push(trimmed);
    }
  }
  return commands;
}

/** Build a durable evidence record for one Iris run from its final report. */
export function buildRunRecord(
  report: IrisReport,
  meta: { startedAt: string; finishedAt: string; ollamaUrl: string }
): IrisRunRecord {
  return {
    objective: report.objective,
    startedAt: meta.startedAt,
    finishedAt: meta.finishedAt,
    provider: {
      kind: 'ollama',
      url: meta.ollamaUrl,
      model: report.evidence.model,
    },
    toolsUsed: [],
    commandsRun: extractCommandsRun(report.evidence.resultText),
    resultText: report.evidence.resultText,
    success: report.success,
    error: report.evidence.error,
  };
}

/**
 * Save a run record to `<projectDir>/.iris/runs/<timestamp>.json` and
 * return the absolute path written. Timestamp is filesystem-safe (no
 * colons), so this is safe on Windows too.
 */
export function saveRunRecord(record: IrisRunRecord, projectDir: string): string {
  const dir = join(projectDir, '.iris', 'runs');
  mkdirSync(dir, { recursive: true });
  const safeTimestamp = record.startedAt.replace(/[:.]/g, '-');
  const path = join(dir, `${safeTimestamp}.json`);
  writeFileSync(path, JSON.stringify(record, null, 2), 'utf8');
  return path;
}
