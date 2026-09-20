import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = process.cwd();

function randomPort() {
  return 46000 + Math.floor(Math.random() * 1000);
}

async function waitFor(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    body: await res.json(),
  };
}

describe("dashboard agents-config settings", () => {
  let tmpRoot;
  let configDir;
  let configPath;
  let promptsPath;
  let port;
  let proc;
  let baseUrl;
  let startupBlocked = null;
  let logs = "";

  before(async () => {
    tmpRoot = await mkdtemp(path.join(tmpdir(), "iris-agent-settings-"));
    configDir = path.join(tmpRoot, ".iris");
    configPath = path.join(configDir, "iris.json");
    promptsPath = path.join(configDir, "agent-prompts.json");
    await fs.promises.mkdir(configDir, { recursive: true });

    await writeFile(
      configPath,
      JSON.stringify(
        {
          providers: {
            openai: { models: ["gpt-5.4"] },
            anthropic: { models: ["claude-sonnet-4-5"] },
            google: { models: ["gemini-2.5-flash"] },
          },
          agents: [
            {
              id: "iris-coder",
              model: "openai/gpt-5.4",
              tools: { profile: "default", alsoAllow: ["write_file"] },
            },
          ],
        },
        null,
        2,
      ),
    );
    await writeFile(promptsPath, JSON.stringify({}, null, 2));

    port = randomPort();
    baseUrl = `http://127.0.0.1:${port}`;
    proc = spawn(process.execPath, ["scripts/dashboard.mjs"], {
      cwd: ROOT,
      env: {
        ...process.env,
        HOME: tmpRoot,
        IRIS_CONFIG_DIR: configDir,
        IRIS_DASH_PORT: String(port),
        IRIS_BIND_HOST: "127.0.0.1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    proc.stdout.on("data", (chunk) => {
      logs += String(chunk);
    });
    proc.stderr.on("data", (chunk) => {
      logs += String(chunk);
    });

    try {
      await waitFor(`${baseUrl}/api/health`);
    } catch (error) {
      if (/operation not permitted|EPERM|Timed out/i.test(`${error.message}\n${logs}`)) {
        startupBlocked = `dashboard server bind blocked in this environment: ${error.message}`;
        return;
      }
      throw error;
    }
  });

  after(async () => {
    if (proc && !proc.killed) proc.kill("SIGTERM");
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("persists per-agent engine and model settings and creates a backup", async (t) => {
    if (startupBlocked) {
      t.skip(startupBlocked);
      return;
    }
    const res = await postJson(`${baseUrl}/api/agents-config/update`, {
      agentId: "iris-coder",
      useCodex: true,
      codexModel: "gpt-5.4",
      useClaudeCode: false,
      useCursorCli: false,
      useGeminiCli: false,
      useCrewCLI: false,
      fallbackModel: "openai/gpt-5.4",
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    const saved = JSON.parse(await readFile(configPath, "utf8"));
    const coder = saved.agents.find((agent) => agent.id === "iris-coder");
    assert.equal(coder.useCodex, true);
    assert.equal(coder.codexModel, "gpt-5.4");
    assert.equal(coder.useClaudeCode, false);
    assert.equal(coder.fallbackModel, "openai/gpt-5.4");

    const files = await readdir(configDir);
    const backups = files.filter((file) => file.startsWith("iris.json.backup."));
    assert.ok(backups.length >= 1, "expected a timestamped config backup");

    const api = await fetch(`${baseUrl}/api/agents-config`);
    const body = await api.json();
    const returned = body.agents.find((agent) => agent.id === "iris-coder");
    assert.equal(returned.useCodex, true);
    assert.equal(returned.codexModel, "gpt-5.4");
    assert.equal(returned.fallbackModel, "openai/gpt-5.4");
  });

  it("persists iris-cli settings and prompt updates through the same endpoint", async (t) => {
    if (startupBlocked) {
      t.skip(startupBlocked);
      return;
    }
    const res = await postJson(`${baseUrl}/api/agents-config/update`, {
      agentId: "iris-coder",
      useCodex: false,
      useCrewCLI: true,
      crewCliModel: "openai/gpt-5.4",
      systemPrompt: "Use the configured engine and leave clear logs.",
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    const saved = JSON.parse(await readFile(configPath, "utf8"));
    const coder = saved.agents.find((agent) => agent.id === "iris-coder");
    assert.equal(coder.useCrewCLI, true);
    assert.equal(coder.crewCliModel, "openai/gpt-5.4");
    assert.equal(coder.useCodex, false);

    const prompts = JSON.parse(await readFile(promptsPath, "utf8"));
    assert.equal(
      prompts["iris-coder"],
      "Use the configured engine and leave clear logs.",
    );
  });
});
