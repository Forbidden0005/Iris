/**
 * Tests for crew-cli/src/agent/friendly-errors.ts
 *
 * These lock in that common local-model failure modes (Ollama not running,
 * a model that hasn't been pulled, a request timeout, a failed tool call)
 * get turned into an actionable message instead of a bare error string.
 *
 * Run with: node --import tsx --test crew-cli/tests/unit/friendly-errors.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFailure, formatFriendlyFailure } from '../../src/agent/friendly-errors.js';

describe('friendly-errors: classifyFailure', () => {
  it('recognizes Ollama being unreachable', () => {
    const failure = classifyFailure(new Error('fetch failed'));
    assert.equal(failure.kind, 'ollama-unreachable');
    assert.match(failure.hint, /ollama serve/);
  });

  it('recognizes ECONNREFUSED to the Ollama port', () => {
    const failure = classifyFailure(new Error('connect ECONNREFUSED 127.0.0.1:11434'));
    assert.equal(failure.kind, 'ollama-unreachable');
  });

  it('recognizes a missing local model and names it in the hint', () => {
    const failure = classifyFailure(new Error('model "qwen3-coder:30b" not found, try pulling it first'));
    assert.equal(failure.kind, 'model-missing');
    assert.match(failure.hint, /ollama pull qwen3-coder:30b/);
  });

  it('recognizes a request timeout', () => {
    const failure = classifyFailure(new Error('The operation was aborted'));
    assert.equal(failure.kind, 'timeout');
    assert.match(failure.hint, /smaller|faster|retry/i);
  });

  it('recognizes a failed shell tool call', () => {
    const failure = classifyFailure(new Error('spawn foo ENOENT'));
    assert.equal(failure.kind, 'tool-failure');
  });

  it('falls back to unknown for unrecognized errors without inventing a cause', () => {
    const failure = classifyFailure(new Error('provider unreachable'));
    assert.equal(failure.kind, 'unknown');
    assert.equal(failure.summary, 'provider unreachable');
  });

  it('accepts plain strings as well as Error objects', () => {
    const failure = classifyFailure('ECONNREFUSED');
    assert.equal(failure.kind, 'ollama-unreachable');
  });
});

describe('friendly-errors: formatFriendlyFailure', () => {
  it('appends an actionable hint for a recognized failure', () => {
    const formatted = formatFriendlyFailure(new Error('fetch failed'));
    assert.match(formatted, /Could not reach the local Ollama server/);
    assert.match(formatted, /ollama serve/);
  });

  it('leaves unrecognized errors as the original message, unchanged', () => {
    const formatted = formatFriendlyFailure(new Error('provider unreachable'));
    assert.equal(formatted, 'provider unreachable');
  });
});
