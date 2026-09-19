# Running Iris locally (Ollama + local models)

Iris's default execution path is **local-first**: `crew auto` / `crew chat`
(standalone mode) route work to a local model served by
[Ollama](https://ollama.com), and let it act through real local tools
(files, shell, git) — no cloud API key required. This guide covers the
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

| Task kind  | Default model         | Approx. size | Use case                          |
|------------|------------------------|--------------|------------------------------------|
| `planning` | `qwen3:14b`             | ~9 GB        | Planning / reasoning-heavy work    |
| `code`     | `qwen3-coder:30b`       | ~19 GB       | Default — code and tool-heavy work |

Pull what fits your hardware:

```bash
ollama pull qwen3:14b          # ~11GB VRAM/RAM or more
ollama pull qwen3-coder:30b    # ~24GB VRAM/RAM or more (default for `code`)
```

If you have less memory available, `qwen3:8b` is a lighter opt-in that still
fits comfortably on ~11GB. Override the model per run with `--model`, or set
`IRIS_MODEL_CODE` / `IRIS_MODEL_PLANNING` env vars to change the defaults.

## 4. Install and build crew-cli

```bash
cd crew-cli
npm install
npm run build
```

## 5. Run it

```bash
node bin/crew.js doctor          # sanity-check Node, git, Ollama, config
node bin/crew.js chat "list the files in this repo"
node bin/crew.js auto "fix the divide-by-zero bug in src/math.ts"
```

`crew doctor` is the fastest way to confirm Ollama is reachable and a model
is pulled before running a real task.

## Troubleshooting

**"Could not reach the local Ollama server" / `ECONNREFUSED` / `fetch failed`**
Ollama isn't running. Start it with `ollama serve` (or open the Ollama app),
then retry. Confirm with `curl http://localhost:11434/api/version`.

**"model ... not found" / 404 from Ollama**
The model referenced by the run (default `qwen3-coder:30b` for code tasks,
`qwen3:14b` for planning) hasn't been pulled yet. Run:
```bash
ollama pull <model-name>
```
`crew doctor` and the CLI's own error output both name the missing model.

**Timeouts / requests that never finish generating**
Local models on constrained hardware (CPU-only, or a GPU with tight VRAM)
can take longer than the per-request timeout to produce a full response.
Try:
- a smaller model (`qwen3:8b` instead of `qwen3-coder:30b`)
- a smaller/narrower task
- raising `CREW_SHELL_TIMEOUT` for shell-heavy tasks, or `--retry-attempts`
  on `crew chat` to retry transient failures automatically

**A tool call failed (shell command, file write, ...)**
The CLI's error output includes the underlying command/path — check that
the binary is installed and the path exists in the project directory you
passed with `--project` (default: current directory).

**Still stuck?**
Run `node bin/crew.js doctor` — it checks Node version, git, config, and the
gateway URL, and prints a hint alongside each failing check.
