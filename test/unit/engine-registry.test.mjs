import { describe, it } from "node:test";
import assert from "node:assert/strict";

async function loadRegistry() {
  return import("../../lib/engines/engine-registry.mjs");
}

describe("engine registry", () => {
  it("matches agent.engine='codex' via selectEngine", async () => {
    const { initEngineRegistry, selectEngine } = await loadRegistry();
    initEngineRegistry({
      loadAgentList: () => [{ id: "iris-fixer", engine: "codex" }],
      engineRunners: { codex: async () => "ok" },
    });

    const selected = selectEngine(
      { agentId: "iris-fixer", agent: "iris-fixer", engine: "codex", prompt: "fix the broken build script" },
      "command.run_task",
    );

    assert.equal(selected?.id, "codex");
  });
});
