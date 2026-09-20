import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SWIFT_PATH = path.join(ROOT, "apps", "irischat", "IrisChat.swift");
const BUILD_PATH = path.join(ROOT, "apps", "irischat", "build-irischat.sh");

const swift = fs.readFileSync(SWIFT_PATH, "utf8");
const buildScript = fs.readFileSync(BUILD_PATH, "utf8");

describe("irischat surface contract", () => {
  test("reads iris config from ~/.iris/iris.json", () => {
    assert.match(swift, /\.iris\/iris\.json/);
    assert.match(swift, /loadCrewConfig\(\)/);
    assert.match(swift, /loadIrisJson\(\)/);
  });

  test("defaults dashboard API base to localhost dashboard port", () => {
    assert.match(swift, /let DASH_PORT\s+=\s+.*4319/);
    assert.match(swift, /let API_BASE\s+=\s+"http:\/\/127\.0\.0\.1:\\\(DASH_PORT\)"/);
  });

  test("supports iris-lead, direct CLI, and specialist agent modes", () => {
    assert.match(swift, /selectedMode: String = "iris-lead"/);
    assert.match(swift, /"cli:opencode"/);
    assert.match(swift, /"cli:cursor"/);
    assert.match(swift, /"agent:iris-coder"/);
    assert.match(swift, /switch between iris-lead, direct CLIs, and specialist agents/);
  });

  test("supports image upload and voice recording flows", () => {
    assert.match(swift, /pickImage/);
    assert.match(swift, /toggleVoiceRecording/);
    assert.match(swift, /apiPost\("\/api\/analyze-image"/);
    assert.match(swift, /apiPostMultipart\("\/api\/transcribe-audio"/);
  });

  test("loads project and per-agent chat history from iris-lead APIs", () => {
    assert.match(swift, /\/api\/iris-lead\/project-messages/);
    assert.match(swift, /\/api\/iris-lead\/history/);
    assert.match(swift, /\/api\/iris-lead\/clear/);
  });
});

describe("irischat build script contract", () => {
  test("builds a macOS app bundle with irischat identifiers", () => {
    assert.match(buildScript, /APP_NAME="irischat"/);
    assert.match(buildScript, /CFBundleIdentifier/);
    assert.match(buildScript, /com\.iris\.irischat/);
    assert.match(buildScript, /CFBundleExecutable/);
  });

  test("declares microphone and photo usage descriptions", () => {
    assert.match(buildScript, /NSMicrophoneUsageDescription/);
    assert.match(buildScript, /record voice messages/);
    assert.match(buildScript, /NSPhotoLibraryUsageDescription/);
    assert.match(buildScript, /select images for analysis/);
  });

  test("documents the expected runtime features in build output", () => {
    assert.match(buildScript, /Mode picker for iris-lead, direct CLIs, and specialist agents/);
    assert.match(buildScript, /Per-agent \+ per-project chat history/);
    assert.match(buildScript, /Shows current engine per agent/);
  });
});
