/**
 * Unit tests for lib/chat/participants.mjs
 *
 * Tests all four exported functions:
 *   listCliParticipants, listChatParticipants, resolveChatParticipant,
 *   detectMentionParticipants
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  listCliParticipants,
  listChatParticipants,
  resolveChatParticipant,
  detectMentionParticipants,
} from "../../lib/chat/participants.mjs";

// ── listCliParticipants ───────────────────────────────────────────────────────

describe("listCliParticipants", () => {
  it("returns an array", () => {
    assert.ok(Array.isArray(listCliParticipants()));
  });

  it("contains known CLI participants", () => {
    const ids = listCliParticipants().map((p) => p.id);
    assert.ok(ids.includes("codex"));
    assert.ok(ids.includes("cursor"));
    assert.ok(ids.includes("claude"));
    assert.ok(ids.includes("opencode"));
    assert.ok(ids.includes("iris-cli"));
    assert.ok(ids.includes("gemini"));
  });

  it("all entries have id, kind, runtime, and aliases fields", () => {
    for (const p of listCliParticipants()) {
      assert.ok(typeof p.id === "string");
      assert.equal(p.kind, "cli");
      assert.ok(typeof p.runtime === "string");
      assert.ok(Array.isArray(p.aliases));
    }
  });

  it("returns defensive copies (mutations do not affect subsequent calls)", () => {
    const list1 = listCliParticipants();
    list1[0].id = "mutated";
    const list2 = listCliParticipants();
    assert.notEqual(list2[0].id, "mutated");
  });
});

// ── listChatParticipants ──────────────────────────────────────────────────────

describe("listChatParticipants", () => {
  it("returns an array", () => {
    assert.ok(Array.isArray(listChatParticipants()));
  });

  it("is sorted alphabetically by id", () => {
    const participants = listChatParticipants();
    for (let i = 1; i < participants.length; i++) {
      assert.ok(
        participants[i - 1].id.localeCompare(participants[i].id) <= 0,
        `Expected sorted order: ${participants[i - 1].id} before ${participants[i].id}`
      );
    }
  });

  it("contains no duplicate IDs", () => {
    const participants = listChatParticipants();
    const ids = participants.map((p) => p.id);
    const unique = new Set(ids);
    assert.equal(unique.size, ids.length);
  });

  it("includes both agent and cli participants", () => {
    const participants = listChatParticipants();
    assert.ok(participants.some((p) => p.kind === "agent"));
    assert.ok(participants.some((p) => p.kind === "cli"));
  });

  it("includes iris-lead agent participant", () => {
    const participants = listChatParticipants();
    assert.ok(participants.some((p) => p.id === "iris-lead"));
  });

  it("all entries have id, kind, and aliases fields", () => {
    for (const p of listChatParticipants()) {
      assert.ok(typeof p.id === "string");
      assert.ok(["agent", "cli"].includes(p.kind));
      assert.ok(Array.isArray(p.aliases));
    }
  });
});

// ── resolveChatParticipant ────────────────────────────────────────────────────

describe("resolveChatParticipant", () => {
  it("returns null for empty input", () => {
    assert.equal(resolveChatParticipant(""), null);
    assert.equal(resolveChatParticipant(null), null);
    assert.equal(resolveChatParticipant(undefined), null);
  });

  it("resolves a canonical agent ID", () => {
    const p = resolveChatParticipant("iris-lead");
    assert.ok(p !== null);
    assert.equal(p.id, "iris-lead");
    assert.equal(p.kind, "agent");
  });

  it("resolves a bare agent alias (without iris- prefix)", () => {
    const p = resolveChatParticipant("lead");
    assert.ok(p !== null);
    assert.equal(p.id, "iris-lead");
  });

  it("resolves a CLI participant by id", () => {
    const p = resolveChatParticipant("cursor");
    assert.ok(p !== null);
    assert.equal(p.id, "cursor");
    assert.equal(p.kind, "cli");
  });

  it("resolves a CLI participant by alias", () => {
    const p = resolveChatParticipant("claude-code");
    assert.ok(p !== null);
    assert.equal(p.id, "claude");
  });

  it("is case-insensitive", () => {
    const lower = resolveChatParticipant("iris-coder");
    const upper = resolveChatParticipant("IRIS-CODER");
    const mixed = resolveChatParticipant("Iris-Coder");
    assert.equal(lower?.id, upper?.id);
    assert.equal(lower?.id, mixed?.id);
  });

  it("trims surrounding whitespace", () => {
    const p = resolveChatParticipant("  iris-coder  ");
    assert.ok(p !== null);
    assert.equal(p.id, "iris-coder");
  });

  it("returns null for unrecognised ID", () => {
    assert.equal(resolveChatParticipant("not-a-real-participant"), null);
  });

  it("resolves iris-qa", () => {
    const p = resolveChatParticipant("iris-qa");
    assert.ok(p !== null);
  });

  it("resolves gemini alias gemini-cli", () => {
    const p = resolveChatParticipant("gemini-cli");
    assert.ok(p !== null);
    assert.equal(p.id, "gemini");
  });

  it("resolves iris-cli alias crewcli", () => {
    const p = resolveChatParticipant("crewcli");
    assert.ok(p !== null);
    assert.equal(p.id, "iris-cli");
  });
});

// ── detectMentionParticipants ─────────────────────────────────────────────────

describe("detectMentionParticipants", () => {
  it("returns empty array for empty/null input", () => {
    assert.deepEqual(detectMentionParticipants(""), []);
    assert.deepEqual(detectMentionParticipants(null), []);
    assert.deepEqual(detectMentionParticipants(undefined), []);
  });

  it("returns empty array when no @mentions present", () => {
    assert.deepEqual(detectMentionParticipants("hello world, no mentions here"), []);
  });

  it("detects a single valid @mention", () => {
    const result = detectMentionParticipants("hey @iris-coder can you help?");
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "iris-coder");
  });

  it("detects multiple different @mentions", () => {
    const result = detectMentionParticipants("@iris-coder and @iris-qa please review");
    const ids = result.map((p) => p.id);
    assert.ok(ids.includes("iris-coder"));
    assert.ok(ids.includes("iris-qa"));
  });

  it("deduplicates repeated mentions of the same participant", () => {
    const result = detectMentionParticipants("@iris-coder @iris-coder do it twice");
    const ids = result.map((p) => p.id);
    const unique = new Set(ids);
    assert.equal(unique.size, ids.length);
    assert.equal(result.length, 1);
  });

  it("ignores unknown @mentions", () => {
    const result = detectMentionParticipants("@nonexistent-bot please do something");
    assert.deepEqual(result, []);
  });

  it("resolves @mention by alias", () => {
    const result = detectMentionParticipants("ping @cursor please");
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "cursor");
  });

  it("broadcast @iris-all expands to all non-lead agent participants", () => {
    const result = detectMentionParticipants("attention @iris-all");
    assert.ok(result.length > 1, "iris-all should expand to multiple agents");
    // iris-lead should be excluded from broadcast
    assert.ok(!result.some((p) => p.id === "iris-lead"));
    // All returned participants should be agents
    for (const p of result) {
      assert.equal(p.kind, "agent");
    }
  });

  it("handles @mention at the very start of text", () => {
    const result = detectMentionParticipants("@iris-qa please run tests");
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "iris-qa");
  });

  it("does not pick up mentions inside words (no leading space/start)", () => {
    // "email@iris-qa.com" — the @ is not preceded by a word boundary (\\s or start)
    const result = detectMentionParticipants("email@iris-qa.com is invalid");
    // The regex requires (^|\s)@ so embedded @ in email should not match
    // iris-qa.com will be parsed as "iris-qa" by the regex — test behaviour as-is
    // The implementation uses /@([a-zA-Z0-9_-]+)/ preceded by (^|\s),
    // so "email@" has no leading space — should NOT match
    assert.equal(result.length, 0);
  });

  it("returns participant objects with all expected fields", () => {
    const result = detectMentionParticipants("@iris-coder help");
    assert.equal(result.length, 1);
    const p = result[0];
    assert.ok("id" in p);
    assert.ok("kind" in p);
    assert.ok("aliases" in p);
  });
});
