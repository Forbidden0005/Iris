import test from "node:test";
import assert from "node:assert/strict";

import {
  classifySharedChatMention,
  hasExplicitHandoffChatIntent,
  hasExplicitWorkIntent,
  hasSpecificWorkOrder,
  stripMentionHandles,
} from "../../lib/chat/mention-routing-intent.mjs";

test("treats casual single-agent mentions as direct chat", () => {
  const result = classifySharedChatMention("@iris-researcher what's good?");
  assert.equal(result.mode, "direct");
  assert.equal(result.targetAgent, "iris-researcher");
  assert.equal(result.directMessage, "what's good?");
});

test("treats explicit work phrasing as dispatch intent", () => {
  const result = classifySharedChatMention(
    "@iris-researcher research pricing for Cursor",
  );
  assert.equal(result.mode, "dispatch");
  assert.equal(result.targetAgent, "iris-researcher");
});

test("requires a specific work order before auto-dispatching", () => {
  assert.equal(hasExplicitWorkIntent("@iris-coder-back get on it"), false);
  assert.equal(hasSpecificWorkOrder("@iris-coder-back get on it"), false);

  const result = classifySharedChatMention("@iris-coder-back get on it");
  assert.equal(result.mode, "direct");
  assert.equal(result.targetAgent, "iris-coder-back");
});

test("treats a note to iris-lead as direct chat", () => {
  const result = classifySharedChatMention(
    "@iris-lead note this for later: browser automation needs exact work orders",
  );
  assert.equal(result.mode, "direct");
  assert.equal(result.targetAgent, "iris-lead");
});

test("treats handoff phrasing as direct chat for a single mentioned agent", () => {
  const result = classifySharedChatMention(
    "@iris-researcher ask iris-pm to review your findings",
  );
  assert.equal(result.mode, "direct");
  assert.equal(result.targetAgent, "iris-researcher");
  assert.equal(
    hasExplicitHandoffChatIntent(
      "@iris-researcher ask iris-pm to review your findings",
    ),
    true,
  );
});

test("keeps strong execution requests as dispatch even if they include a later send-to phrase", () => {
  const result = classifySharedChatMention(
    "@iris-researcher research OpenClaw and then send your findings to iris-pm",
  );
  assert.equal(result.mode, "dispatch");
});

test("treats send findings to another agent as direct chat", () => {
  const result = classifySharedChatMention(
    "@iris-researcher send your findings to iris-pm",
  );
  assert.equal(result.mode, "direct");
});

test("treats speculative kickoff questions as direct chat, not dispatch", () => {
  const result = classifySharedChatMention(
    "Next? @iris-main kick off browser automation phase?",
  );
  assert.equal(result.mode, "direct");
  assert.equal(result.targetAgent, "iris-main");
});

test("treats single CLI mentions as direct chat", () => {
  const result = classifySharedChatMention("@codex hi");
  assert.equal(result.mode, "direct");
  assert.equal(result.targetParticipant?.id, "codex");
  assert.equal(result.targetParticipant?.kind, "cli");
});

test("treats explicit single CLI work orders as dispatch", () => {
  const result = classifySharedChatMention(
    "@claude inspect /tmp/demo.js and explain the bug",
  );
  assert.equal(result.mode, "dispatch");
  assert.equal(result.targetParticipant?.id, "claude");
  assert.equal(result.targetParticipant?.kind, "cli");
});

test("expands @iris-all into a direct fanout broadcast", () => {
  const result = classifySharedChatMention("@iris-all hi team");
  assert.equal(result.mode, "direct_multi");
  assert.ok(result.targetParticipants.length > 2);
  assert.ok(result.targetParticipants.some((participant) => participant.id === "iris-main"));
  assert.ok(result.targetParticipants.every((participant) => participant.kind === "agent"));
});

test("does not classify multiple mentions as direct chat", () => {
  const result = classifySharedChatMention("@iris-pm and @iris-coder check this");
  assert.equal(result.mode, "direct_multi");
  assert.deepEqual(result.targetAgents, ["iris-pm", "iris-coder"]);
});

test("strips mention handles before intent detection", () => {
  assert.equal(stripMentionHandles("@iris-coder hi there"), "hi there");
  assert.equal(hasExplicitWorkIntent("@iris-coder hi there"), false);
});
