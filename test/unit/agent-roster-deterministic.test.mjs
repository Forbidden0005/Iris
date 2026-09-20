import test from "node:test";
import assert from "node:assert/strict";
import {
  wantsDeterministicAgentRoster,
  formatDeterministicAgentRoster,
} from "../../lib/iris-lead/chat-handler.mjs";

test("wantsDeterministicAgentRoster — user phrasing from production", () => {
  assert.equal(
    wantsDeterministicAgentRoster(
      "full agent list - one line pr agent - name - role - model",
    ),
    true,
  );
  assert.equal(wantsDeterministicAgentRoster("yo"), false);
  assert.equal(wantsDeterministicAgentRoster("list all agents"), true);
});

test("formatDeterministicAgentRoster — one line per agent incl. iris-lead", () => {
  const cfg = {
    providerKey: "xai",
    modelId: "grok-test",
    displayName: "Stinki",
    emoji: "🧠",
    agentRoster: [
      {
        id: "iris-main",
        name: "Main",
        emoji: "🦊",
        role: "",
        model: "groq/llama",
      },
      {
        id: "iris-pm",
        name: "PM",
        emoji: "",
        role: "custom role",
        model: "anthropic/claude",
      },
    ],
  };
  const out = formatDeterministicAgentRoster(cfg);
  assert.match(out, /iris-lead.*coordinator.*xai\/grok-test/);
  assert.match(out, /iris-main.*main coordinator.*groq\/llama/);
  assert.match(out, /iris-pm.*custom role.*anthropic\/claude/);
  const linesInBlock = out.match(/```\n([\s\S]*)\n```/)[1].split("\n");
  assert.equal(linesInBlock.length, 3);
});
