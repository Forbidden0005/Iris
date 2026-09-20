# iris-cli Quick Start

## Installation

```bash
cd iris-cli
npm install
chmod +x bin/iris.js
```

## Prerequisites

The iris-cli requires the iris gateway to be running:

```bash
# In a separate terminal
cd /home/user/Iris
npm run iris-lead
```

The gateway should start on port 5010.

## Usage

### Check System Status
```bash
./bin/iris.js status
```

Expected output:
```
System Status:
Agents Online: 10
Tasks Active: 0
RT Bus: connected
```

### List Available Agents
```bash
./bin/iris.js list
```

Expected output:
```
✓ iris-coder - Full Stack Coder
✓ iris-qa - Quality Assurance
✓ iris-fixer - Bug Fixer
✓ iris-frontend - UI/UX Specialist
✓ iris-coder-back - Backend Specialist
...
```

### Dispatch a Task
```bash
./bin/iris.js dispatch iris-coder "Fix authentication bug in auth.js"
```

### Speculative Execution
Compare multiple implementation strategies in parallel:
```bash
iris explore "refactor the database layer"
```

### Natural Language Shell
Translate your intent into an exact shell command:
```bash
iris shell "list all large files in src sorted by size"
```

### GitHub Intelligence
Run health checks and perform issue/PR actions with natural language:
```bash
iris github doctor
iris github "create issue 'Add rate limiting' body: describe steps here" --dry-run
```

### Interactive Terminal
Run interactive tools directly with PTY support:
```bash
iris exec "vim src/app.js"
```

### Parallel Planning
Execute complex multi-step plans in parallel:
```bash
iris plan "implement user dashboard" --parallel --concurrency 4
```

## Configuration

Create `~/.iris/iris.json` to customize settings:

```json
{
  "crewLeadUrl": "http://localhost:5010",
  "rtBusUrl": "ws://localhost:18889",
  "dashboardUrl": "http://localhost:4319",
  "timeout": 300000,
  "agents": []
}
```

## Troubleshooting

### "Gateway not reachable"
- Ensure the iris gateway is running: `npm run iris-lead`
- Check the gateway is on port 5010: `curl http://localhost:5010/health`

### "Timeout waiting for agent"
- Check if the RT bus is connected: `./bin/iris.js status`
- Increase timeout: `--timeout 600000` (10 minutes)
- Check agent logs in the iris dashboard

### "Agent not found"
- List available agents: `./bin/iris.js list`
- Use exact agent name: `iris-coder` not `coder`

## Architecture

```
┌─────────────┐
│  iris-cli   │  Your command-line interface
└──────┬──────┘
       │ HTTP POST /api/dispatch
       ↓
┌─────────────┐
│  iris-lead  │  Gateway (port 5010)
└──────┬──────┘
       │ WebSocket RT bus (port 18889)
       ↓
┌─────────────┐
│   Agents    │  iris-coder, iris-qa, iris-fixer, etc.
└─────────────┘
```

## Development

Run tests:
```bash
npm test
# or
node --test tests/
```

Lint code:
```bash
npm run lint
```

Check syntax:
```bash
npm run check
```

## Features Ready for Launch

- [x] **Session State Management** (via `.iris/session.json`)
- [x] **Git Context Auto-Injection** (automated prompts)
- [x] **OAuth Token Finder** (`iris auth`)
- [x] **Sandbox Mode** (`iris preview`, `iris branch`)
- [x] **Plan-First Workflow** (`iris plan`)
- [x] **Automated Debugging** (`iris apply --check`)
- [x] **Voice & Browser Debugging** (`iris listen`, `iris browser-debug`)
- [x] **Multi-Repo & Team Sync** (`iris repos-scan`, `iris sync`)
- [x] **Speculative Execution** (`iris explore`)
- [x] **DevEx Intelligence** (`iris lsp-check`, `iris map --graph`, `iris docs`)

See `ROADMAP.md` for full completion status.
