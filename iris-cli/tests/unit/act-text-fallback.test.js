/**
 * Unit tests for iris-cli/src/executor/act-text-fallback.ts
 *
 * Root cause: qwen2.5-coder:7b (and similar local models) via Ollama's
 * OpenAI-compat endpoint sometimes narrates a tool call as plain text
 * instead of using the API's structured tool_calls field, e.g.:
 *   "ACT: grep_search(query=\"test\")"
 * With no real tool_calls, the agentic loop never executes anything.
 * These tests cover the deterministic text patterns the fallback parser
 * must recover a tool call from, and confirm it never invents a tool
 * name that wasn't offered to the model.
 *
 * Run with: node --import tsx --test tests/unit/act-text-fallback.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseActTextFallback } from '../../src/executor/act-text-fallback.js';

const KNOWN_TOOLS = ['read_file', 'write_file', 'grep_search', 'run_shell_command'];

describe('act-text-fallback: function-call syntax', () => {
  it('parses `tool(key="value")` style text', () => {
    const text = 'ACT: grep_search(query="test", type="js")';
    const result = parseActTextFallback(text, KNOWN_TOOLS);
    assert.deepEqual(result, { tool: 'grep_search', params: { query: 'test', type: 'js' } });
  });

  it('parses numeric and boolean args', () => {
    const text = 'run_shell_command(command="npm test", run_in_background=false)';
    const result = parseActTextFallback(text, KNOWN_TOOLS);
    assert.equal(result.tool, 'run_shell_command');
    assert.equal(result.params.command, 'npm test');
    assert.equal(result.params.run_in_background, false);
  });
});

describe('act-text-fallback: fenced JSON', () => {
  it('parses a ```json {"tool":...,"params":...} ``` block', () => {
    const text = [
      'I will read the file first.',
      '```json',
      '{"tool": "read_file", "params": {"file_path": "package.json"}}',
      '```',
    ].join('\n');
    const result = parseActTextFallback(text, KNOWN_TOOLS);
    assert.deepEqual(result, { tool: 'read_file', params: { file_path: 'package.json' } });
  });

  it('parses an OpenAI function-shape JSON block ({"name","arguments"})', () => {
    const text = '```json\n{"name": "read_file", "arguments": {"file_path": "package.json"}}\n```';
    const result = parseActTextFallback(text, KNOWN_TOOLS);
    assert.deepEqual(result, { tool: 'read_file', params: { file_path: 'package.json' } });
  });
});

describe('act-text-fallback: inline JSON', () => {
  it('parses a bare (unfenced) tool-call JSON object embedded in prose', () => {
    const text = 'I will call it with {"tool": "grep_search", "params": {"query": "test command"}} to find it.';
    const result = parseActTextFallback(text, KNOWN_TOOLS);
    assert.deepEqual(result, { tool: 'grep_search', params: { query: 'test command' } });
  });
});

describe('act-text-fallback: refuses to invent tools', () => {
  it('returns null when no known tool name appears anywhere', () => {
    const text = 'ACT: some_made_up_tool(x="y")';
    const result = parseActTextFallback(text, KNOWN_TOOLS);
    assert.equal(result, null);
  });

  it('returns null for plain prose with no call-shaped text', () => {
    const text = 'The task is complete. All tests pass.';
    const result = parseActTextFallback(text, KNOWN_TOOLS);
    assert.equal(result, null);
  });

  it('returns null for empty text or no available tools', () => {
    assert.equal(parseActTextFallback('', KNOWN_TOOLS), null);
    assert.equal(parseActTextFallback('grep_search(query="x")', []), null);
  });
});
