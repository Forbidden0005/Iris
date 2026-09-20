/**
 * Shared Chat Hybrid Tests
 *
 * Covers:
 * - Message write-back from dispatch completions into channels
 * - Mention routing in shared channels (direct vs. dispatch classification)
 * - Channel isolation (messages in one channel don't leak to another)
 * - Direct agent chat vs. room chat separation (directChat metadata flag)
 * - Thread binding (threadId preserves conversation threads)
 *
 * Uses temp directories so no real ~/.iris data is touched.
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── Temp-dir isolation for project-messages store ────────────────────────────

let tmpBase;

before(async () => {
  tmpBase = await mkdtemp(join(tmpdir(), "cs-hybrid-test-"));
  // Point the runtime paths module at the temp dir before any other import
  process.env.IRIS_STATE_DIR = tmpBase;
  process.env.IRIS_CONFIG_DIR = tmpBase;
});

after(async () => {
  delete process.env.IRIS_STATE_DIR;
  delete process.env.IRIS_CONFIG_DIR;
  await rm(tmpBase, { recursive: true, force: true });
});

// Lazy-import the modules AFTER environment variables are set so path resolution
// uses tmpBase.  We use dynamic import inside each describe block (or at the
// top of the first test) rather than top-level static imports.

// ── Helpers ──────────────────────────────────────────────────────────────────

function uniqueChannel() {
  return `chan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── 1. message write-back ─────────────────────────────────────────────────────

describe("message write-back from dispatch completions", () => {
  it("saves a sub-agent completion message into the project channel", async () => {
    const { saveProjectMessage, loadProjectMessages } = await import(
      "../../lib/chat/project-messages.mjs"
    );

    const channel = uniqueChannel();

    const id = saveProjectMessage(channel, {
      source: "sub-agent",
      role: "assistant",
      content: "Task complete. I wrote hello.js.",
      agent: "iris-coder",
      metadata: { triggeredBy: "dispatch", taskId: "task-42" },
    });

    assert.ok(id, "saveProjectMessage should return a message ID");

    const msgs = loadProjectMessages(channel);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].source, "sub-agent");
    assert.equal(msgs[0].agent, "iris-coder");
    assert.equal(msgs[0].role, "assistant");
    assert.equal(msgs[0].metadata.taskId, "task-42");
  });

  it("assigns a stable UUID to each saved message", async () => {
    const { saveProjectMessage, loadProjectMessages } = await import(
      "../../lib/chat/project-messages.mjs"
    );

    const channel = uniqueChannel();

    const id1 = saveProjectMessage(channel, {
      source: "agent",
      role: "assistant",
      content: "First response",
      agent: "iris-qa",
    });

    const id2 = saveProjectMessage(channel, {
      source: "agent",
      role: "assistant",
      content: "Second response",
      agent: "iris-qa",
    });

    assert.ok(id1 && id2, "Both IDs must be truthy");
    assert.notEqual(id1, id2, "Each message must get a unique ID");

    const msgs = loadProjectMessages(channel);
    const ids = msgs.map((m) => m.id);
    assert.ok(ids.includes(id1));
    assert.ok(ids.includes(id2));
  });

  it("returns null and does not crash when required fields are missing", async () => {
    const { saveProjectMessage } = await import(
      "../../lib/chat/project-messages.mjs"
    );

    // Missing `content`
    const r1 = saveProjectMessage(uniqueChannel(), {
      source: "agent",
      role: "assistant",
    });
    assert.equal(r1, null);

    // Missing `role`
    const r2 = saveProjectMessage(uniqueChannel(), {
      source: "agent",
      content: "hello",
    });
    assert.equal(r2, null);

    // Missing `source`
    const r3 = saveProjectMessage(uniqueChannel(), {
      role: "user",
      content: "hello",
    });
    assert.equal(r3, null);
  });

  it("returns null and does not crash when projectId is absent", async () => {
    const { saveProjectMessage } = await import(
      "../../lib/chat/project-messages.mjs"
    );

    const r = saveProjectMessage(null, {
      source: "dashboard",
      role: "user",
      content: "message with no project",
    });
    assert.equal(r, null);
  });

  it("stores a timestamp on every saved message", async () => {
    const { saveProjectMessage, loadProjectMessages } = await import(
      "../../lib/chat/project-messages.mjs"
    );

    const channel = uniqueChannel();
    const before = Date.now();

    saveProjectMessage(channel, {
      source: "dashboard",
      role: "user",
      content: "ping",
    });

    const after = Date.now();
    const [msg] = loadProjectMessages(channel);
    assert.ok(msg.ts >= before, "ts should be >= time before save");
    assert.ok(msg.ts <= after, "ts should be <= time after save");
  });
});

// ── 2. mention routing ────────────────────────────────────────────────────────

describe("mention routing in shared channels", () => {
  it("classifies a casual single-agent mention as direct chat", async () => {
    const { classifySharedChatMention } = await import(
      "../../lib/chat/mention-routing-intent.mjs"
    );

    const result = classifySharedChatMention("@iris-pm what's the sprint goal?");
    assert.equal(result.mode, "direct");
    assert.equal(result.targetAgent, "iris-pm");
  });

  it("classifies a specific work-order mention as dispatch", async () => {
    const { classifySharedChatMention } = await import(
      "../../lib/chat/mention-routing-intent.mjs"
    );

    const result = classifySharedChatMention(
      "@iris-coder implement the login endpoint in /src/auth.js and write tests"
    );
    assert.equal(result.mode, "dispatch");
    assert.equal(result.targetAgent, "iris-coder");
  });

  it("classifies @iris-all as a direct multi broadcast (not dispatch)", async () => {
    const { classifySharedChatMention } = await import(
      "../../lib/chat/mention-routing-intent.mjs"
    );

    const result = classifySharedChatMention("@iris-all daily standup reminder");
    assert.equal(result.mode, "direct_multi");
    assert.ok(result.targetParticipants.length >= 2, "should expand to multiple agents");
    // @iris-lead is excluded from @iris-all fanout
    assert.ok(
      !result.targetParticipants.find((p) => p.id === "iris-lead"),
      "iris-lead must be excluded from @iris-all"
    );
  });

  it("classifies two simultaneous agent mentions as direct_multi", async () => {
    const { classifySharedChatMention } = await import(
      "../../lib/chat/mention-routing-intent.mjs"
    );

    const result = classifySharedChatMention(
      "@iris-main and @iris-qa can you both review this PR?"
    );
    assert.equal(result.mode, "direct_multi");
    assert.ok(result.targetAgents.includes("iris-main"));
    assert.ok(result.targetAgents.includes("iris-qa"));
  });

  it("classifies a handoff phrasing (ask … to) as direct, not dispatch", async () => {
    const { classifySharedChatMention } = await import(
      "../../lib/chat/mention-routing-intent.mjs"
    );

    const result = classifySharedChatMention(
      "@iris-researcher ask iris-pm to review your findings"
    );
    assert.equal(result.mode, "direct");
    assert.equal(result.targetAgent, "iris-researcher");
  });

  it("classifies a CLI participant mention as direct chat", async () => {
    const { classifySharedChatMention } = await import(
      "../../lib/chat/mention-routing-intent.mjs"
    );

    const result = classifySharedChatMention("@codex hi, are you there?");
    assert.equal(result.mode, "direct");
    assert.equal(result.targetParticipant?.kind, "cli");
  });

  it("classifies an unrecognised handle as 'none'", async () => {
    const { classifySharedChatMention } = await import(
      "../../lib/chat/mention-routing-intent.mjs"
    );

    const result = classifySharedChatMention("@ghost-agent do something");
    assert.equal(result.mode, "none");
    assert.equal(result.targetAgent, null);
  });

  it("stores mention metadata when saving a message with mentions", async () => {
    const { saveProjectMessage, loadProjectMessages } = await import(
      "../../lib/chat/project-messages.mjs"
    );

    const channel = uniqueChannel();

    saveProjectMessage(channel, {
      source: "dashboard",
      role: "user",
      content: "@iris-qa please audit the auth module",
      metadata: { mentions: ["iris-qa"] },
    });

    const msgs = loadProjectMessages(channel, { mentionedAgent: "iris-qa" });
    assert.equal(msgs.length, 1);
    assert.ok(msgs[0].metadata.mentions.includes("iris-qa"));
  });
});

// ── 3. channel isolation ──────────────────────────────────────────────────────

describe("channel isolation", () => {
  it("messages in channel A do not appear when loading channel B", async () => {
    const { saveProjectMessage, loadProjectMessages } = await import(
      "../../lib/chat/project-messages.mjs"
    );

    const channelA = uniqueChannel();
    const channelB = uniqueChannel();

    saveProjectMessage(channelA, {
      source: "dashboard",
      role: "user",
      content: "Message for A",
    });

    saveProjectMessage(channelB, {
      source: "dashboard",
      role: "user",
      content: "Message for B",
    });

    const msgsA = loadProjectMessages(channelA);
    const msgsB = loadProjectMessages(channelB);

    assert.equal(msgsA.length, 1);
    assert.equal(msgsA[0].content, "Message for A");

    assert.equal(msgsB.length, 1);
    assert.equal(msgsB[0].content, "Message for B");
  });

  it("clearing one channel does not affect another channel", async () => {
    const { saveProjectMessage, loadProjectMessages, clearProjectMessages } =
      await import("../../lib/chat/project-messages.mjs");

    const channelA = uniqueChannel();
    const channelB = uniqueChannel();

    saveProjectMessage(channelA, {
      source: "dashboard",
      role: "user",
      content: "Keep me",
    });
    saveProjectMessage(channelB, {
      source: "dashboard",
      role: "user",
      content: "Also keep me",
    });

    clearProjectMessages(channelA);

    const msgsA = loadProjectMessages(channelA);
    const msgsB = loadProjectMessages(channelB);

    assert.equal(msgsA.length, 0, "channel A should be empty after clear");
    assert.equal(msgsB.length, 1, "channel B should be unaffected");
  });

  it("returns an empty array for a channel that has never had messages", async () => {
    const { loadProjectMessages } = await import(
      "../../lib/chat/project-messages.mjs"
    );

    const msgs = loadProjectMessages(uniqueChannel());
    assert.deepEqual(msgs, []);
  });

  it("sanitises dangerous characters in projectId before writing to disk", async () => {
    const { saveProjectMessage, loadProjectMessages } = await import(
      "../../lib/chat/project-messages.mjs"
    );

    // Slashes and null bytes would create path traversal — they must be sanitised
    const dangerousId = "../../../etc/passwd";

    const id = saveProjectMessage(dangerousId, {
      source: "dashboard",
      role: "user",
      content: "Injection attempt",
    });

    // Should save to a sanitised path (not crash, not escape tmpBase)
    assert.ok(id, "should return an ID even for a sanitised channel name");

    const msgs = loadProjectMessages(dangerousId);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].content, "Injection attempt");
  });
});

// ── 4. direct agent chat vs. room chat separation ─────────────────────────────

describe("direct agent chat vs room chat separation", () => {
  it("excludes direct-chat messages when excludeDirect filter is set", async () => {
    const { saveProjectMessage, loadProjectMessages } = await import(
      "../../lib/chat/project-messages.mjs"
    );

    const channel = uniqueChannel();

    // Room message
    saveProjectMessage(channel, {
      source: "dashboard",
      role: "user",
      content: "Room message",
      metadata: {},
    });

    // Direct-chat message (directChat: true in metadata)
    saveProjectMessage(channel, {
      source: "dashboard",
      role: "user",
      content: "Private DM to agent",
      metadata: { directChat: true },
    });

    const allMsgs = loadProjectMessages(channel);
    assert.equal(allMsgs.length, 2, "loadProjectMessages without filter returns both");

    const roomOnly = loadProjectMessages(channel, { excludeDirect: true });
    assert.equal(roomOnly.length, 1, "excludeDirect should hide direct-chat messages");
    assert.equal(roomOnly[0].content, "Room message");
  });

  it("includes direct-chat messages when excludeDirect is not set", async () => {
    const { saveProjectMessage, loadProjectMessages } = await import(
      "../../lib/chat/project-messages.mjs"
    );

    const channel = uniqueChannel();

    saveProjectMessage(channel, {
      source: "dashboard",
      role: "user",
      content: "Private note",
      metadata: { directChat: true },
    });

    const msgs = loadProjectMessages(channel);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].metadata.directChat, true);
  });

  it("filters by source=sub-agent to isolate agent completions", async () => {
    const { saveProjectMessage, loadProjectMessages } = await import(
      "../../lib/chat/project-messages.mjs"
    );

    const channel = uniqueChannel();

    saveProjectMessage(channel, {
      source: "dashboard",
      role: "user",
      content: "User request",
    });
    saveProjectMessage(channel, {
      source: "sub-agent",
      role: "assistant",
      content: "Agent result",
      agent: "iris-coder",
    });

    const agentMsgs = loadProjectMessages(channel, { source: "sub-agent" });
    assert.equal(agentMsgs.length, 1);
    assert.equal(agentMsgs[0].agent, "iris-coder");
  });

  it("filters by agent name to retrieve a specific agent's completions", async () => {
    const { saveProjectMessage, loadProjectMessages } = await import(
      "../../lib/chat/project-messages.mjs"
    );

    const channel = uniqueChannel();

    saveProjectMessage(channel, {
      source: "sub-agent",
      role: "assistant",
      content: "QA result",
      agent: "iris-qa",
    });
    saveProjectMessage(channel, {
      source: "sub-agent",
      role: "assistant",
      content: "Coder result",
      agent: "iris-coder",
    });

    const qaMsgs = loadProjectMessages(channel, { agent: "iris-qa" });
    assert.equal(qaMsgs.length, 1);
    assert.equal(qaMsgs[0].agent, "iris-qa");
    assert.equal(qaMsgs[0].content, "QA result");
  });
});

// ── 5. thread binding ─────────────────────────────────────────────────────────

describe("thread binding (threadId preserves conversation threads)", () => {
  it("getThreadBinding returns null before any binding is set", async () => {
    const { getThreadBinding } = await import(
      "../../lib/chat/thread-binding.mjs"
    );
    const result = getThreadBinding("proj-x", "thread-missing");
    assert.equal(result, null);
  });

  it("setThreadBinding stores and getThreadBinding retrieves the binding", async () => {
    const { setThreadBinding, getThreadBinding, clearThreadBinding } =
      await import("../../lib/chat/thread-binding.mjs");

    const project = "proj-bind-test";
    const thread = "thread-abc123";

    clearThreadBinding(project, thread);

    const stored = setThreadBinding(project, thread, {
      participantId: "iris-main",
      kind: "agent",
      runtime: "openai/gpt-4o",
      displayName: "iris-main",
    });

    assert.ok(stored, "setThreadBinding should return the stored binding");
    assert.equal(stored.participantId, "iris-main");
    assert.equal(stored.kind, "agent");
    assert.ok(typeof stored.boundAt === "number", "boundAt should be a number");

    const retrieved = getThreadBinding(project, thread);
    assert.equal(retrieved?.participantId, "iris-main");
    assert.equal(retrieved?.runtime, "openai/gpt-4o");
  });

  it("clearThreadBinding removes a stored binding", async () => {
    const { setThreadBinding, getThreadBinding, clearThreadBinding } =
      await import("../../lib/chat/thread-binding.mjs");

    const project = "proj-clear-test";
    const thread = "thread-to-clear";

    setThreadBinding(project, thread, {
      participantId: "iris-qa",
      kind: "agent",
    });

    clearThreadBinding(project, thread);
    assert.equal(getThreadBinding(project, thread), null);
  });

  it("bindings in different projects are isolated from one another", async () => {
    const { setThreadBinding, getThreadBinding, clearThreadBinding } =
      await import("../../lib/chat/thread-binding.mjs");

    const thread = "shared-thread-id";

    clearThreadBinding("proj-alpha", thread);
    clearThreadBinding("proj-beta", thread);

    setThreadBinding("proj-alpha", thread, {
      participantId: "iris-main",
      kind: "agent",
    });
    setThreadBinding("proj-beta", thread, {
      participantId: "iris-qa",
      kind: "agent",
    });

    const alpha = getThreadBinding("proj-alpha", thread);
    const beta = getThreadBinding("proj-beta", thread);

    assert.equal(alpha?.participantId, "iris-main");
    assert.equal(beta?.participantId, "iris-qa");
  });

  it("setThreadBinding rejects a binding with no participantId", async () => {
    const { setThreadBinding, getThreadBinding, clearThreadBinding } =
      await import("../../lib/chat/thread-binding.mjs");

    const project = "proj-invalid";
    const thread = "thread-invalid";
    clearThreadBinding(project, thread);

    const result = setThreadBinding(project, thread, { kind: "agent" });
    assert.equal(result, null, "setThreadBinding should return null when participantId is absent");
    assert.equal(getThreadBinding(project, thread), null);
  });

  it("messages saved with the same threadId can be retrieved by threadId filter", async () => {
    const { saveProjectMessage, loadProjectMessages } = await import(
      "../../lib/chat/project-messages.mjs"
    );

    const channel = uniqueChannel();
    const threadId = "thread-unique-123";

    saveProjectMessage(channel, {
      source: "dashboard",
      role: "user",
      content: "Thread message 1",
      threadId,
    });
    saveProjectMessage(channel, {
      source: "sub-agent",
      role: "assistant",
      content: "Thread reply 1",
      agent: "iris-coder",
      threadId,
    });
    // A message on a different thread — must not appear in filtered results
    saveProjectMessage(channel, {
      source: "dashboard",
      role: "user",
      content: "Different thread message",
      threadId: "other-thread",
    });

    const threaded = loadProjectMessages(channel, { threadId });
    assert.equal(threaded.length, 2, "exactly the two messages with the matching threadId");
    assert.ok(threaded.every((m) => m.threadId === threadId));
  });

  it("messages with parentId link to their parent in the message tree", async () => {
    const { saveProjectMessage, loadProjectMessages, buildMessageTree } =
      await import("../../lib/chat/project-messages.mjs");

    const channel = uniqueChannel();

    const rootId = saveProjectMessage(channel, {
      source: "dashboard",
      role: "user",
      content: "Root message",
    });

    saveProjectMessage(channel, {
      source: "sub-agent",
      role: "assistant",
      content: "Child reply",
      agent: "iris-main",
      parentId: rootId,
    });

    const tree = buildMessageTree(channel);
    assert.ok(tree.length >= 1, "tree should have at least one root node");

    const rootNode = tree.find((n) => n.id === rootId);
    assert.ok(rootNode, "root message should be in the tree");
    assert.equal(rootNode.children.length, 1, "root should have one child");
    assert.equal(rootNode.children[0].content, "Child reply");
  });
});

// ── 6. applySharedChatPromptOverlay ──────────────────────────────────────────

describe("applySharedChatPromptOverlay cleans stale instructions", () => {
  it("removes stale dispatch-only @mention lines from existing prompts", async () => {
    const { applySharedChatPromptOverlay } = await import(
      "../../lib/chat/shared-chat-prompt-overlay.mjs"
    );

    const staleLegacyPrompt =
      "You are iris-lead.\n" +
      "- In shared chat surfaces plain `@mentions` are a live routing mechanism.  \n" +
      "- `@agent` is communication, not an implicit dispatch\n";

    const result = applySharedChatPromptOverlay(staleLegacyPrompt, "iris-lead");

    // Stale lines must be gone
    assert.doesNotMatch(result, /plain `@mentions` are a live routing mechanism/i);
    assert.doesNotMatch(result, /`@agent` is communication, not an implicit dispatch/i);

    // Canonical overlay must be present
    assert.match(result, /use the @mention system/i);
    assert.match(result, /literal `@participant` message/i);
  });

  it("returns only the overlay when there is no prior prompt", async () => {
    const { applySharedChatPromptOverlay, getSharedChatPromptOverlay } =
      await import("../../lib/chat/shared-chat-prompt-overlay.mjs");

    const result = applySharedChatPromptOverlay("", "iris-qa");
    const expected = getSharedChatPromptOverlay("iris-qa");

    assert.equal(result, expected);
  });

  it("appends the overlay to a clean existing prompt", async () => {
    const { applySharedChatPromptOverlay } = await import(
      "../../lib/chat/shared-chat-prompt-overlay.mjs"
    );

    const base = "You are iris-coder. Write clean, tested code.";
    const result = applySharedChatPromptOverlay(base, "iris-coder");

    assert.match(result, /You are iris-coder/);
    assert.match(result, /Shared Chat \+ @Mention System/i);
  });
});
