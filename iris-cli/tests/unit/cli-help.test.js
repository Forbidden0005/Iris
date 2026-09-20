/**
 * CLI help-text tests: `iris --help` and command-level `--help` should be
 * self-serve — showing example invocations and a pointer to local (Ollama)
 * setup docs, not just a bare flag/option list.
 *
 * These invoke bin/iris.js as a real subprocess (its --help fast paths
 * never require Ollama, a gateway, or a built dist bundle for the
 * top-level case) so they exercise exactly what a user sees.
 *
 * Run with: node --import tsx --test iris-cli/tests/unit/cli-help.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const binPath = join(__dirname, '..', '..', 'bin', 'iris.js');

function runHelp(args) {
  return spawnSync(process.execPath, [binPath, ...args], { encoding: 'utf8' });
}

describe('cli: iris --help', () => {
  it('lists top-level commands and example invocations', () => {
    const { stdout, status } = runHelp(['--help']);
    assert.equal(status, 0);
    assert.match(stdout, /Usage: iris \[options\] \[command\]/);
    assert.match(stdout, /Examples:/);
    assert.match(stdout, /iris doctor/);
    assert.match(stdout, /iris auto "fix the failing test"/);
  });

  it('points to the local-setup guide for first-time users', () => {
    const { stdout } = runHelp(['--help']);
    assert.match(stdout, /docs\/RUNNING-LOCALLY\.md/);
  });

  it('-h behaves the same as --help', () => {
    const { stdout: full } = runHelp(['--help']);
    const { stdout: short } = runHelp(['-h']);
    assert.equal(short, full);
  });
});
