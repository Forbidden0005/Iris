#!/usr/bin/env node
/**
 * iris-local-smoke.mjs — local-first Iris smoke test.
 *
 * Checks that Ollama is reachable and the required models are pulled,
 * then runs one real objective through runIris() (plan -> local model/tool
 * dispatch -> evidence -> verify -> report) and prints the result.
 *
 * No mocks, no cloud fallback: this either talks to a real local Ollama
 * daemon or tells you exactly what's missing.
 *
 * Usage: node --import tsx scripts/iris-local-smoke.mjs
 *    or: npm run iris:local-smoke
 */

import { IRIS_MODEL_PLANNING, IRIS_MODEL_CODE, runIris } from '../src/agent/loop.ts';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OBJECTIVE = process.env.IRIS_SMOKE_OBJECTIVE
  || 'List the files in the tests/unit directory, then run the shell command '
    + '`node --import tsx --test tests/unit/agent-loop.test.js` and report the '
    + 'pass/fail counts from its output as evidence.';
const REQUIRED_MODELS = [IRIS_MODEL_PLANNING, IRIS_MODEL_CODE];

function log(msg) {
  console.log(msg);
}

function printHardwareGuidance() {
  log('[iris-local-smoke] hardware guidance:');
  log('  GTX 1080 Ti / 11GB VRAM, 32GB RAM: use the defaults');
  log('    planning: qwen3:8b       (ollama pull qwen3:8b)');
  log('    code:     qwen2.5-coder:7b  (ollama pull qwen2.5-coder:7b)');
  log('  qwen3:14b is a viable IRIS_MODEL_PLANNING override on this card if it performs acceptably for you — test it, do not assume.');
  log('  qwen3-coder:30b does NOT fit in 11GB VRAM. Only set IRIS_MODEL_CODE=qwen3-coder:30b');
  log('  if you explicitly accept slow CPU/RAM offload (32GB RAM, much slower than the 7B default).');
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
  // Ollama tags list exact tags (e.g. "qwen3:14b"); accept a loose prefix
  // match too since users may have a slightly different quantization tag.
  return installed.some((m) => m === wanted || m.startsWith(wanted.split(':')[0] + ':'));
}

async function main() {
  log(`[iris-local-smoke] checking Ollama at ${OLLAMA_URL} ...`);
  const { reachable, models } = await checkOllama();

  if (!reachable) {
    log(`[iris-local-smoke] FAIL: Ollama is not reachable at ${OLLAMA_URL}.`);
    log('[iris-local-smoke] Install/start it first:');
    log('  https://ollama.com/download');
    log('  ollama serve   # if it is not already running as a service');
    log('[iris-local-smoke] Then pull the required models:');
    for (const m of REQUIRED_MODELS) log(`  ollama pull ${m}`);
    printHardwareGuidance();
    process.exitCode = 1;
    return;
  }
  log(`[iris-local-smoke] OK: Ollama reachable. Installed models: ${models.join(', ') || '(none)'}`);

  const missing = REQUIRED_MODELS.filter((m) => !modelInstalled(models, m));
  if (missing.length > 0) {
    log(`[iris-local-smoke] FAIL: missing required model(s): ${missing.join(', ')}`);
    log('[iris-local-smoke] Pull them with:');
    for (const m of missing) log(`  ollama pull ${m}`);
    printHardwareGuidance();
    process.exitCode = 1;
    return;
  }
  log(`[iris-local-smoke] OK: required models present (planning=${IRIS_MODEL_PLANNING}, code=${IRIS_MODEL_CODE})`);
  if (IRIS_MODEL_CODE.startsWith('qwen3-coder:30b') || IRIS_MODEL_PLANNING.startsWith('qwen3:14b')) {
    log('[iris-local-smoke] NOTE: you have overridden a default to a heavier model.');
    printHardwareGuidance();
  }

  log(`[iris-local-smoke] running objective through runIris(): "${OBJECTIVE}"`);
  let report;
  try {
    report = await runIris(OBJECTIVE, { projectDir: process.cwd(), kind: 'code' });
  } catch (err) {
    log(`[iris-local-smoke] FAIL: runIris() threw: ${err instanceof Error ? err.stack : err}`);
    process.exitCode = 1;
    return;
  }

  log('\n[iris-local-smoke] ---- REPORT ----');
  log(JSON.stringify(report, null, 2));

  log('\n[iris-local-smoke] ---- SUMMARY ----');
  log(`task status:        ${report.task.status}`);
  log(`verification passed: ${report.verification.passed}`);
  for (const c of report.verification.checks) {
    log(`  - ${c.name}: ${c.passed ? 'pass' : `FAIL (${c.detail || 'no detail'})`}`);
  }
  if (report.evidence.error) {
    log(`raw failure: ${report.evidence.error}`);
  }
  log(`overall success:    ${report.success}`);

  process.exitCode = report.success ? 0 : 1;
}

main();
