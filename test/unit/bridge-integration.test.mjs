import test from "node:test";
import assert from "node:assert/strict";

import integration from "../../lib/bridges/integration.mjs";

const {
  shouldSaveToProjectRAG,
  getEnabledPlatforms,
  registerPlatform,
  detectProjectFromMessage,
} = integration;

test("bridge integration exposes expected built-in platforms", () => {
  const enabled = getEnabledPlatforms();
  assert.ok(enabled.includes("telegram"));
  assert.ok(enabled.includes("whatsapp"));
  assert.ok(enabled.includes("iris-chat"));
});

test("bridge integration excludes chat-only agents from project RAG where configured", () => {
  assert.equal(shouldSaveToProjectRAG("telegram", "iris-loco"), false);
  assert.equal(shouldSaveToProjectRAG("whatsapp", "iris-loco"), false);
  assert.equal(shouldSaveToProjectRAG("telegram", "iris-pm"), true);
});

test("bridge integration can register new platforms dynamically", () => {
  registerPlatform("signal", { sourcePrefix: "signal-chat", icon: "📶", excludeAgents: ["iris-loco"] });
  assert.ok(getEnabledPlatforms().includes("signal"));
  assert.equal(shouldSaveToProjectRAG("signal", "iris-loco"), false);
  assert.equal(shouldSaveToProjectRAG("signal", "iris-main"), true);
});

test("project detection finds explicit project mentions and output-dir path hints", () => {
  const projects = [
    { id: "website", name: "website", outputDir: "/tmp/builds/website" },
    { id: "iris-cli", name: "iris-cli", outputDir: "/tmp/builds/iris-cli" },
  ];

  assert.equal(
    detectProjectFromMessage("dispatch iris-coder to website project: improve hero copy", projects),
    "website",
  );
  assert.equal(
    detectProjectFromMessage("Please edit iris-cli/src/index.ts and tighten routing", projects),
    "iris-cli",
  );
  assert.equal(
    detectProjectFromMessage("work on the website project next", projects),
    "website",
  );
  assert.equal(
    detectProjectFromMessage("general chat with no project context", projects),
    null,
  );
});
