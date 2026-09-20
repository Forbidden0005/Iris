#!/usr/bin/env node
/**
 * Iris CLI entrypoint (v0).
 *
 * Usage:
 *   node --import tsx scripts/start.mjs run "<objective>" [--project-dir <dir>]
 *
 * Runs a real objective through the local-first Iris agent loop
 * (runIris(): plan -> local Ollama model/tool dispatch -> evidence ->
 * verify -> report), prints readable progress, writes a durable evidence
 * record to `.iris/runs/<timestamp>.json` under the project dir, and exits
 * non-zero on failure.
 *
 * No mocks, no silent cloud fallback: this either talks to a real local
 * Ollama daemon or fails clearly and tells you what to do about it.
 */

import { IRIS_MODEL_PLANNING, IRIS_MODEL_CODE, runIris } from '../src/agent/loop.ts';
import { parseCliArgs, buildRunRecord, saveRunRecord } from '../src/agent/cli.ts';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const REQUIRED_MODELS = [IRIS_MODEL_PLANNING, IRIS_MODEL_CODE];

function log(msg) {
  console.log(msg);
}

async function checkOllama() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      return { reachable: false, models: [] };
    }
    const data = await res.json();
    const models = (data.models || []).map((m) => m.name || m.model).filter(Boolean);
    return { reachable: true, models };
  } catch {
    return { reachable: false, models: [] };
  }
}

function modelInstalled(installed, wanted) {
  return installed.some((m) => m === wanted || m.startsWith(wanted.split(':')[0] + ':'));
}

function printUsage() {
  log('Usage: iris run "<objective>" [--project-dir <dir>]');
  log('');
  log('  <objective>        Natural-language task for Iris to run against the project.');
  log('  --project-dir DIR  Root directory to operate on (default: current working directory).');
  log('');
  log('Environment:');
  log('  OLLAMA_URL         Ollama base URL (default: http://localhost:11434)');
  log(`  IRIS_MODEL_PLANNING  Planning model tag (default: qwen3:8b)`);
  log(`  IRIS_MODEL_CODE      Code/tool model tag (default: qwen2.5-coder:7b)`);
}

async function runCommand(args) {
  log(`[iris] checking Ollama at ${OLLAMA_URL} ...`);
  const { reachable, models } = await checkOllama();

  if (!reachable) {
    log(`[iris] FAIL: Ollama is not reachable at ${OLLAMA_URL}.`);
    log('[iris] Install/start it first:');
    log('  https://ollama.com/download');
    log('  ollama serve   # if it is not already running as a service');
    log('[iris] Then pull the required models:');
    for (const m of REQUIRED_MODELS) log(`  ollama pull ${m}`);
    return 1;
  }
  log(`[iris] OK: Ollama reachable. Installed models: ${models.join(', ') || '(none)'}`);

  const missing = REQUIRED_MODELS.filter((m) => !modelInstalled(models, m));
  if (missing.length > 0) {
    log(`[iris] FAIL: missing required model(s): ${missing.join(', ')}`);
    log('[iris] Pull them with:');
    for (const m of missing) log(`  ollama pull ${m}`);
    return 1;
  }
  log(`[iris] OK: required models present (planning=${IRIS_MODEL_PLANNING}, code=${IRIS_MODEL_CODE})`);

  log(`[iris] objective: "${args.objective}"`);
  log(`[iris] project dir: ${args.projectDir}`);
  log('[iris] running agent loop (this can take a while on local hardware)...');

  const startedAt = new Date().toISOString();
  let report;
  try {
    report = await runIris(args.objective, { projectDir: args.projectDir, kind: 'code' });
  } catch (err) {
    const finishedAt = new Date().toISOString();
    const message = err instanceof Error ? err.stack || err.message : String(err);
    log(`[iris] FAIL: runIris() threw: ${message}`);
    const record = {
      objective: args.objective,
      startedAt,
      finishedAt,
      provider: { kind: 'ollama', url: OLLAMA_URL },
      toolsUsed: [],
      commandsRun: [],
      success: false,
      error: message,
    };
    const path = saveRunRecord(record, args.projectDir);
    log(`[iris] evidence written to ${path}`);
    return 1;
  }
  const finishedAt = new Date().toISOString();

  log('\n[iris] ---- REPORT ----');
  log(JSON.stringify(report, null, 2));

  log('\n[iris] ---- SUMMARY ----');
  log(`task status:         ${report.task.status}`);
  log(`verification passed: ${report.verification.passed}`);
  for (const c of report.verification.checks) {
    log(`  - ${c.name}: ${c.passed ? 'pass' : `FAIL (${c.detail || 'no detail'})`}`);
  }
  if (report.evidence.error) {
    log(`raw failure: ${report.evidence.error}`);
  }
  log(`overall success:     ${report.success}`);

  const record = buildRunRecord(report, { startedAt, finishedAt, ollamaUrl: OLLAMA_URL });
  const path = saveRunRecord(record, args.projectDir);
  log(`[iris] evidence written to ${path}`);

  return report.success ? 0 : 1;
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    printUsage();
    process.exitCode = argv.length === 0 ? 1 : 0;
    return;
  }

  let args;
  try {
    args = parseCliArgs(argv);
  } catch (err) {
    log(`[iris] FAIL: ${err instanceof Error ? err.message : String(err)}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  process.exitCode = await runCommand(args);
}

main();
