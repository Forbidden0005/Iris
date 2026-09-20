import test from "node:test";
import assert from "node:assert/strict";

import {
  detectMentionParticipants,
  resolveChatParticipant,
} from "../lib/chat/participants.mjs";
import { detectMentions } from "../lib/chat/autonomous-mentions.mjs";

test("resolves CLI participants and agent aliases", () => {
  assert.equal(resolveChatParticipant("codex")?.kind, "cli");
  assert.equal(resolveChatParticipant("claude-code")?.runtime, "claude");
  assert.equal(resolveChatParticipant("pm")?.id, "iris-pm");
});

test("detects unique mixed mentions", () => {
  const participants = detectMentionParticipants(
    "@codex inspect this and @iris-pm plan it with @pm too",
  );
  assert.deepEqual(
    participants.map((participant) => participant.id),
    ["codex", "iris-pm"],
  );
});

test("detectMentions returns canonical participant ids", () => {
  assert.deepEqual(
    detectMentions("@cursor and @iris-coder please coordinate"),
    ["cursor", "iris-coder"],
  );
});

test("detectMentions ignores mentions inside appended original task blocks", () => {
  const reply = [
    "Got it, boss! No PM action required for this @mention test.",
    "",
    "---",
    "**[ORIGINAL TASK]:**",
    "@iris-pm Hey, the user wants to test the @mention system.",
    "",
    "Does this work?",
  ].join("\n");

  assert.deepEqual(detectMentions(reply), []);
});
