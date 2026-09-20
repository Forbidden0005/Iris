# Running Iris locally (Ollama + local models)

Iris's v0 execution path is **local-first**: `npm run iris:run` routes a task
through the local Iris loop, talks to a local model served by
[Ollama](https://ollama.com), and lets it act through real local tools
(files, shell, git). No cloud API key is required. This guide covers the
five-minute setup for that path and what to do when it fails.

## 1. Install Ollama

- macOS / Windows: download from https://ollama.com/download
- Linux:
  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ```

## 2. Start the Ollama server

```bash
ollama serve
```

Leave this running (or install Ollama as a background service / launch the
desktop app, which does this for you). Iris talks to it over
`http://localhost:11434`.

Verify it's up:

```bash
curl http://localhost:11434/api/version
```

## 3. Pull the models Iris uses by default

Iris picks a model based on task kind:

| Task kind  | Default model          | Use case                          |
|------------|-------------------------|------------------------------------|
| `planning` | `qwen3:8b`              | Planning / reasoning-heavy work    |
| `code`     | `qwen2.5-coder:7b`      | Default — code and tool-heavy work |

Pull what fits your hardware:

```bash
ollama pull qwen3:8b
ollama pull qwen2.5-coder:7b
```

These defaults are sized for the current local-first path and have been tested
on an 11GB VRAM / 32GB RAM Windows machine. `qwen3:14b` is a viable planning
override if it performs acceptably for you. `qwen3-coder:30b` does **not** fit
comfortably in 11GB VRAM; only set `IRIS_MODEL_CODE=qwen3-coder:30b` if you
explicitly accept slow CPU/RAM offload.

## 4. Install and build iris-cli

```bash
cd iris-cli
npm install
npm run build
```

## 5. Run it

```bash
npm run iris:local-smoke
npm run iris:run -- "Inspect this repo by listing the project root, read package.json, run node --import tsx --test tests/unit/agent-loop.test.js, and report evidence."
```

`iris:local-smoke` is the fastest end-to-end check. It confirms Ollama is
reachable, checks the required models, runs a deterministic repo-inspection
objective, and writes evidence under `iris-cli/.iris/runs/`.

## Troubleshooting

**"Could not reach the local Ollama server" / `ECONNREFUSED` / `fetch failed`**
Ollama isn't running. Start it with `ollama serve` (or open the Ollama app),
then retry. Confirm with `curl http://localhost:11434/api/version`.

**"model ... not found" / 404 from Ollama**
The model referenced by the run (default `qwen2.5-coder:7b` for code tasks,
`qwen3:8b` for planning) hasn't been pulled yet. Run:
```bash
ollama pull <model-name>
```
The Iris preflight output names the missing model.

**Timeouts / requests that never finish generating**
Local models on constrained hardware (CPU-only, or a GPU with tight VRAM)
can take longer than the per-request timeout to produce a full response.
Try:
- a smaller/narrower task
- `IRIS_MODEL_CODE=qwen2.5-coder:3b` for a faster code model experiment
- rerunning once after Ollama has warmed the model

**A tool call failed (shell command, file write, ...)**
The CLI's error output includes the underlying command/path — check that
the binary is installed and the path exists in the project directory you
passed with `--project-dir` (default: current directory).

**Still stuck?**
Run `npm run iris:local-smoke` again and read the preflight section first. If
Ollama is reachable and the required models are present, the `.iris/runs/`
evidence file from the failed run is the next thing to inspect.
