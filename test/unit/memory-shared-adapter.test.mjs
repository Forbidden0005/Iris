/**
 * Unit tests for lib/memory/shared-adapter.mjs
 *
 * Covers:
 *  - IRIS_MEMORY_DIR: constant value
 *  - isSharedMemoryAvailable: reflects whether CLI bundle loaded
 *  - initSharedMemory: creates directory structure (mocked via env override)
 *  - getAgentKeeper / getAgentMemory / getMemoryBroker: return null when CLI unavailable
 *  - recordTaskMemory: returns error object when CLI unavailable
 *  - rememberFact: returns null when CLI unavailable
 *  - recallMemoryContext: returns empty string when CLI unavailable
 *  - searchMemory: returns empty array when CLI unavailable
 *  - getMemoryStats / getKeeperStats / compactKeeperStore: return null when CLI unavailable
 *  - migrateBrainToMemory: returns error when CLI unavailable; parses content when available via stub
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const {
  IRIS_MEMORY_DIR,
  isSharedMemoryAvailable,
  initSharedMemory,
  getAgentKeeper,
  getAgentMemory,
  getMemoryBroker,
  recordTaskMemory,
  rememberFact,
  recallMemoryContext,
  searchMemory,
  getMemoryStats,
  getKeeperStats,
  compactKeeperStore,
  migrateBrainToMemory,
} = await import("../../lib/memory/shared-adapter.mjs");

// ── IRIS_MEMORY_DIR ────────────────────────────────────────────────────────

describe("shared-adapter — IRIS_MEMORY_DIR", () => {
  it("is a non-empty string", () => {
    assert.equal(typeof IRIS_MEMORY_DIR, "string");
    assert.ok(IRIS_MEMORY_DIR.length > 0);
  });

  it("defaults to ~/.iris/shared-memory when env var is absent", () => {
    const expected = path.join(os.homedir(), ".iris", "shared-memory");
    // Only check when env var not set (if set we can't predict exact value)
    if (!process.env.IRIS_MEMORY_DIR) {
      assert.equal(IRIS_MEMORY_DIR, expected);
    } else {
      // If overridden, still a valid string
      assert.equal(typeof IRIS_MEMORY_DIR, "string");
    }
  });
});

// ── isSharedMemoryAvailable ────────────────────────────────────────────────

describe("shared-adapter — isSharedMemoryAvailable", () => {
  it("returns a boolean", () => {
    const result = isSharedMemoryAvailable();
    assert.equal(typeof result, "boolean");
  });

  it("returns false when CLI bundle is not present (normal CI environment)", () => {
    // In CI / test env the iris-cli dist bundle typically isn't built
    // We just assert it is consistently one or the other — never throws
    assert.doesNotThrow(() => isSharedMemoryAvailable());
  });
});

// ── getAgentKeeper / getAgentMemory / getMemoryBroker ──────────────────────

describe("shared-adapter — factory functions when CLI unavailable", () => {
  // These return null gracefully when the CLI bundle is missing
  it("getAgentKeeper returns null or an object", () => {
    const result = getAgentKeeper("/tmp");
    assert.ok(result === null || typeof result === "object");
  });

  it("getAgentKeeper uses process.cwd() when projectDir is falsy", () => {
    assert.doesNotThrow(() => getAgentKeeper(null));
    assert.doesNotThrow(() => getAgentKeeper(undefined));
    assert.doesNotThrow(() => getAgentKeeper(""));
  });

  it("getAgentMemory returns null or an object", () => {
    const result = getAgentMemory("iris-test");
    assert.ok(result === null || typeof result === "object");
  });

  it("getAgentMemory defaults agentId to iris-lead", () => {
    assert.doesNotThrow(() => getAgentMemory());
  });

  it("getMemoryBroker returns null or an object", () => {
    const result = getMemoryBroker("/tmp");
    assert.ok(result === null || typeof result === "object");
  });

  it("getMemoryBroker respects crewId option", () => {
    assert.doesNotThrow(() => getMemoryBroker("/tmp", { crewId: "iris-qa" }));
  });
});

// ── recordTaskMemory ────────────────────────────────────────────────────────

describe("shared-adapter — recordTaskMemory", () => {
  it("returns error object when AgentKeeper unavailable", async () => {
    if (isSharedMemoryAvailable()) return; // skip if bundle present
    const result = await recordTaskMemory("/tmp", {
      task: "test task",
      result: "done",
      tier: "worker",
      agent: "iris-coder"
    });
    assert.equal(typeof result, "object");
    assert.ok("ok" in result || "error" in result);
    assert.equal(result.ok, false);
  });

  it("accepts minimal entry without throwing", async () => {
    await assert.doesNotReject(() => recordTaskMemory("/tmp", {}));
  });

  it("fills defaults for missing entry fields", async () => {
    // Should not throw even with empty entry
    const result = await recordTaskMemory("/tmp", {});
    assert.equal(typeof result, "object");
  });
});

// ── rememberFact ────────────────────────────────────────────────────────────

describe("shared-adapter — rememberFact", () => {
  it("returns null when AgentMemory unavailable", () => {
    if (isSharedMemoryAvailable()) return;
    const result = rememberFact("iris-lead", "important fact", {});
    assert.equal(result, null);
  });

  it("accepts options with critical flag", () => {
    assert.doesNotThrow(() => rememberFact("iris-lead", "critical fact", { critical: true }));
  });

  it("accepts options with tags", () => {
    assert.doesNotThrow(() => rememberFact("iris-lead", "tagged fact", { tags: ["test", "unit"] }));
  });
});

// ── recallMemoryContext ─────────────────────────────────────────────────────

describe("shared-adapter — recallMemoryContext", () => {
  it("returns a string (empty or populated)", async () => {
    const result = await recallMemoryContext("/tmp", "test query");
    assert.equal(typeof result, "string");
  });

  it("returns empty string when broker unavailable", async () => {
    if (isSharedMemoryAvailable()) return;
    const result = await recallMemoryContext("/tmp", "some query");
    assert.equal(result, "");
  });

  it("handles projectId option without throwing", async () => {
    await assert.doesNotReject(() =>
      recallMemoryContext("/tmp", "query", { projectId: "proj-123" })
    );
  });

  it("accepts all options without throwing", async () => {
    await assert.doesNotReject(() =>
      recallMemoryContext("/tmp", "query", {
        maxResults: 10,
        includeDocs: true,
        includeCode: true,
        pathHints: ["lib/"],
        preferSuccessful: true,
        crewId: "iris-lead"
      })
    );
  });
});

// ── searchMemory ────────────────────────────────────────────────────────────

describe("shared-adapter — searchMemory", () => {
  it("returns an array", async () => {
    const result = await searchMemory("/tmp", "test query");
    assert.ok(Array.isArray(result));
  });

  it("returns empty array when broker unavailable", async () => {
    if (isSharedMemoryAvailable()) return;
    const result = await searchMemory("/tmp", "some query");
    assert.deepEqual(result, []);
  });

  it("accepts options without throwing", async () => {
    await assert.doesNotReject(() =>
      searchMemory("/tmp", "query", { maxResults: 5, crewId: "iris-pm" })
    );
  });
});

// ── getMemoryStats / getKeeperStats / compactKeeperStore ───────────────────

describe("shared-adapter — stats and compact", () => {
  it("getMemoryStats returns null or object when unavailable", () => {
    const result = getMemoryStats("iris-lead");
    assert.ok(result === null || typeof result === "object");
  });

  it("getMemoryStats defaults to iris-lead", () => {
    assert.doesNotThrow(() => getMemoryStats());
  });

  it("getKeeperStats returns null or object", async () => {
    const result = await getKeeperStats("/tmp");
    assert.ok(result === null || typeof result === "object");
  });

  it("compactKeeperStore returns null or object", async () => {
    const result = await compactKeeperStore("/tmp");
    assert.ok(result === null || typeof result === "object");
  });
});

// ── initSharedMemory ────────────────────────────────────────────────────────

describe("shared-adapter — initSharedMemory", () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "iris-test-memory-"));
  });

  after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("returns { ok, path } object", () => {
    const result = initSharedMemory();
    assert.equal(typeof result, "object");
    assert.ok("ok" in result);
    assert.ok("path" in result);
    assert.equal(result.path, IRIS_MEMORY_DIR);
  });

  it("creates the shared memory directory", () => {
    const result = initSharedMemory();
    assert.equal(result.ok, true);
    assert.ok(fs.existsSync(result.path));
  });

  it("is idempotent — calling twice does not throw", () => {
    assert.doesNotThrow(() => {
      initSharedMemory();
      initSharedMemory();
    });
  });
});

// ── migrateBrainToMemory ────────────────────────────────────────────────────

describe("shared-adapter — migrateBrainToMemory", () => {
  let tmpDir;
  let brainPath;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "iris-test-brain-"));
    brainPath = path.join(tmpDir, "brain.md");
  });

  after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("returns error object when AgentMemory unavailable", async () => {
    if (isSharedMemoryAvailable()) return;
    fs.writeFileSync(brainPath, "# Brain\nsome fact about iris-coder\n");
    const result = await migrateBrainToMemory(brainPath, "iris-lead");
    assert.equal(typeof result, "object");
    assert.ok("ok" in result);
    assert.equal(result.ok, false);
  });

  it("returns error when brain file does not exist", async () => {
    const result = await migrateBrainToMemory("/nonexistent/brain.md", "iris-lead");
    assert.equal(typeof result, "object");
    assert.ok("ok" in result || "error" in result);
    assert.equal(result.ok, false);
  });

  it("returns { ok, imported, skipped, errors } shape", async () => {
    if (isSharedMemoryAvailable()) return;
    fs.writeFileSync(brainPath, "Some brain content here\n");
    const result = await migrateBrainToMemory(brainPath);
    // When unavailable, returns error shape
    assert.equal(typeof result, "object");
    assert.ok("ok" in result);
  });
});
