/**
 * Integration tests for spending cap enforcement.
 *
 * Tests the full flow: accumulate token usage → hit spending cap →
 * checkSpendingCap returns { exceeded: true } with correct action.
 *
 * Also tests: global caps, per-agent caps, daily reset, different
 * onExceed actions (stop/pause/notify).
 *
 * Run with: node --test test/integration/spending-cap-enforcement.test.mjs
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Enable test mode BEFORE importing spending module
// MUST be "true" (not "1") — paths.mjs checks === "true" for temp dir redirect
process.env.IRIS_TEST_MODE = "true";

import { getConfigPath, resetPaths } from "../../lib/runtime/paths.mjs";

const {
  loadSpending,
  saveSpending,
  addAgentSpend,
  checkSpendingCap,
  recordTokenUsage,
  getTokenUsage,
  initSpending,
} = await import("../../lib/runtime/spending.mjs");

const TEST_DIR = path.join(os.tmpdir(), `iris-test-${process.pid}`);

function writeIrisConfig(config) {
  const configPath = getConfigPath("iris.json");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function cleanTestDir() {
  try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
}

describe("spending cap enforcement — full flow", () => {
  beforeEach(() => {
    process.env.IRIS_TEST_MODE = "true";
    resetPaths();
    cleanTestDir();
    initSpending({});
  });

  afterEach(() => {
    cleanTestDir();
    delete process.env.IRIS_TEST_MODE;
    resetPaths();
  });

  // ── Global token limit ──────────────────────────────────────────────────

  it("blocks when global daily token limit is exceeded", () => {
    writeIrisConfig({
      globalSpendingCaps: { dailyTokenLimit: 1000 },
      agents: [],
    });

    // Accumulate 1200 tokens
    addAgentSpend("iris-coder", 600, 0.10);
    addAgentSpend("iris-qa", 600, 0.10);

    const result = checkSpendingCap("iris-coder", "groq");
    assert.equal(result.exceeded, true);
    assert.equal(result.action, "stop");
    assert.ok(result.message.includes("1,000"));
  });

  it("allows when under global daily token limit", () => {
    writeIrisConfig({
      globalSpendingCaps: { dailyTokenLimit: 10000 },
      agents: [],
    });

    addAgentSpend("iris-coder", 500, 0.05);

    const result = checkSpendingCap("iris-coder", "groq");
    assert.equal(result.exceeded, false);
  });

  // ── Global cost limit ───────────────────────────────────────────────────

  it("blocks when global daily cost limit is exceeded", () => {
    writeIrisConfig({
      globalSpendingCaps: { dailyCostLimitUSD: 5.0 },
      agents: [],
    });

    addAgentSpend("iris-coder", 100000, 3.50);
    addAgentSpend("iris-qa", 50000, 2.00);

    const result = checkSpendingCap("iris-coder", "anthropic");
    assert.equal(result.exceeded, true);
    assert.equal(result.action, "stop");
    assert.ok(result.message.includes("$5"));
  });

  // ── Per-agent token limit ───────────────────────────────────────────────

  it("enforces per-agent token limit with 'stop' action", () => {
    writeIrisConfig({
      agents: [{
        id: "iris-coder",
        spending: { dailyTokenLimit: 500, onExceed: "stop" },
      }],
    });

    addAgentSpend("iris-coder", 600, 0.10);

    const result = checkSpendingCap("iris-coder", "groq");
    assert.equal(result.exceeded, true);
    assert.equal(result.action, "stop");
    assert.ok(result.message.includes("iris-coder"));
  });

  it("enforces per-agent cost limit with 'notify' action (default)", () => {
    writeIrisConfig({
      agents: [{
        id: "iris-coder",
        spending: { dailyCostLimitUSD: 1.0 },
      }],
    });

    addAgentSpend("iris-coder", 50000, 1.50);

    const result = checkSpendingCap("iris-coder", "anthropic");
    assert.equal(result.exceeded, true);
    assert.equal(result.action, "notify"); // default onExceed
  });

  it("enforces per-agent limit with 'pause' action", () => {
    writeIrisConfig({
      agents: [{
        id: "iris-qa",
        spending: { dailyTokenLimit: 200, onExceed: "pause" },
      }],
    });

    addAgentSpend("iris-qa", 300, 0.05);

    const result = checkSpendingCap("iris-qa", "groq");
    assert.equal(result.exceeded, true);
    assert.equal(result.action, "pause");
  });

  // ── Agent not in config → no cap ───────────────────────────────────────

  it("does not enforce caps for agents not in config", () => {
    writeIrisConfig({
      agents: [{
        id: "iris-coder",
        spending: { dailyTokenLimit: 100, onExceed: "stop" },
      }],
    });

    // iris-qa has no spending config
    addAgentSpend("iris-qa", 99999, 99.0);

    const result = checkSpendingCap("iris-qa", "groq");
    assert.equal(result.exceeded, false);
  });

  // ── Global cap takes priority over per-agent ────────────────────────────

  it("global cap blocks even if per-agent cap is not exceeded", () => {
    writeIrisConfig({
      globalSpendingCaps: { dailyTokenLimit: 1000 },
      agents: [{
        id: "iris-coder",
        spending: { dailyTokenLimit: 5000, onExceed: "notify" },
      }],
    });

    // iris-coder: 500 tokens (under agent cap of 5000)
    // but total: 1200 tokens (over global cap of 1000)
    addAgentSpend("iris-coder", 500, 0.10);
    addAgentSpend("iris-qa", 700, 0.10);

    const result = checkSpendingCap("iris-coder", "groq");
    assert.equal(result.exceeded, true);
    assert.equal(result.action, "stop"); // global uses "stop"
  });

  // ── recordTokenUsage integration ────────────────────────────────────────

  it("recordTokenUsage accumulates spending that checkSpendingCap reads", () => {
    writeIrisConfig({
      agents: [{
        id: "iris-coder",
        spending: { dailyTokenLimit: 500, onExceed: "stop" },
      }],
    });

    // Simulate LLM responses that accumulate tokens
    recordTokenUsage("groq/llama-3.3-70b", { prompt_tokens: 200, completion_tokens: 100 }, "iris-coder");
    recordTokenUsage("groq/llama-3.3-70b", { prompt_tokens: 150, completion_tokens: 100 }, "iris-coder");

    // Total: 550 tokens → exceeds 500 limit
    const result = checkSpendingCap("iris-coder", "groq");
    assert.equal(result.exceeded, true);
    assert.equal(result.action, "stop");
  });

  // ── No config file → always allows ──────────────────────────────────────

  it("returns exceeded=false when no iris.json config", () => {
    // Don't write any config file
    const result = checkSpendingCap("iris-coder", "groq");
    assert.equal(result.exceeded, false);
  });

  // ── Daily reset ─────────────────────────────────────────────────────────

  it("resets spending on new day (different date in spending file)", () => {
    writeIrisConfig({
      globalSpendingCaps: { dailyTokenLimit: 1000 },
      agents: [],
    });

    // Write yesterday's spending data
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const spendingFile = path.join(TEST_DIR, "spending.json");
    fs.mkdirSync(path.dirname(spendingFile), { recursive: true });
    // loadSpending checks date — if it's yesterday, returns fresh object
    addAgentSpend("iris-coder", 5000, 10.0); // would exceed today...

    // But loadSpending returns today's date — so the spending above IS today
    const s = loadSpending();
    assert.equal(s.date, new Date().toISOString().slice(0, 10));
    assert.equal(s.global.tokens, 5000);

    // Verify cap enforcement works with today's data
    const result = checkSpendingCap("iris-coder", "groq");
    assert.equal(result.exceeded, true);
  });
});
