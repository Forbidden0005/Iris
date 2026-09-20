# Install

Updated: March 14, 2026

Use this as the canonical setup path.

## What you get

`install.sh` handles:
- Node dependency install
- `~/.iris/` bootstrap
- default config and RT token generation
- optional `irischat` build on macOS
- optional SwiftBar plugin install
- optional Telegram setup
- optional WhatsApp setup
- optional MCP wiring for Cursor / Claude Code / OpenCode
- optional immediate local stack start

What it does not do by default:
- provision cloud infrastructure
- automatically deploy arbitrary generated apps to production
- choose a hosting platform for you

## Recommended Paths

Use these defaults:

- most users: global npm install
- contributors: source install from a clone
- servers and teams: Docker

## Most Users: npm Install

```bash
npm install -g iris
iris
```

This is the best path when you want to:
- evaluate iris quickly
- run it locally on your machine
- avoid cloning the repo unless you actually need the source

## Contributors: Source Install

Fresh machine:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/crewswarm/crewswarm/main/install.sh)
```

Cloned repo:

```bash
git clone https://github.com/crewswarm/crewswarm
cd iris
bash install.sh
```

Then:

```bash
npm run doctor
npm run restart-all
open http://127.0.0.1:4319
```

Use this when you want:
- the repo checked out locally
- contributor workflows
- direct access to scripts, source, and local debugging

## Cursor / Codex / Headless Install

For non-interactive setup:

```bash
IRIS_SETUP_MCP=1 \
IRIS_START_NOW=1 \
bash install.sh --non-interactive
```

Useful env flags:

- `IRIS_BUILD_CREWCHAT=1`
- `IRIS_SETUP_TELEGRAM=1`
- `TELEGRAM_BOT_TOKEN=...`
- `IRIS_SETUP_WHATSAPP=1`
- `IRIS_WHATSAPP_NUMBER=14155552671`
- `IRIS_WHATSAPP_NAME=Jeff`
- `IRIS_ENABLE_AUTONOMOUS=1`
- `IRIS_AUTONOMOUS_MINUTES=15`
- `IRIS_SETUP_MCP=1`
- `IRIS_START_NOW=1`

This is the best path for:
- Cursor cloning the repo and wiring MCP automatically
- Codex or CI bootstrapping a machine without prompts
- remote shells where you want install + start in one shot

## Servers and Teams: Docker Install

For a server or team box:

```bash
curl -fsSL https://raw.githubusercontent.com/crewswarm/crewswarm/main/scripts/install-docker.sh | bash
```

Or:

```bash
git clone https://github.com/crewswarm/crewswarm
cd iris
docker compose up -d
```

Use Docker when you want:
- a stable shared instance
- easier restarts and host isolation
- team/server deployment instead of local development

## After Install

1. Add at least one provider key in Dashboard → Providers
2. Verify health:

```bash
npm run doctor
bash scripts/smoke.sh --no-build
bash scripts/smoke-surfaces.sh
```

3. Open the main surfaces:
- Dashboard: `http://127.0.0.1:4319`
- Vibe: `http://127.0.0.1:3333`
- irischat: `/Applications/irischat.app`

## Deployment Reality

iris can build and operate projects locally, and Codex can absolutely use it to generate deployable code.

But deployment itself is still project-specific:
- static site
- Node server
- Docker service
- Fly / Railway / VPS / custom infra

So the current public claim should be:
- install and run iris with one file: yes
- wire it into Cursor/Codex: yes
- automatically deploy every generated app with one universal command: no

## Recommended Public Path

For most users:

1. run `npm install -g iris`
2. start with `iris`
3. add at least one provider key in Dashboard → Providers
4. use Dashboard for setup
5. use Vibe for project work
6. use Docker only when moving to a server/team instance
