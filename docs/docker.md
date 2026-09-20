# Docker Deployment

Run iris on any Linux server with Docker.

## Quick start

```bash
curl -fsSL https://raw.githubusercontent.com/Forbidden0005/Iris/main/scripts/install-docker.sh | bash
```

Or manually:

```bash
git clone https://github.com/Forbidden0005/Iris.git
cd iris
docker compose up -d
```

## Pre-built images

```bash
docker pull iris/iris:latest
docker pull ghcr.io/forbidden0005/iris:latest
```

**Multi-arch:** AMD64 + ARM64 (Apple Silicon, Raspberry Pi, Graviton)

## Services

| Service | Port |
|---------|------|
| iris-core | 4319 (dashboard + iris-lead + agents) |
| iris-rt-bus | 18889 |
| iris-mcp | 5020 (optional) |

## Configuration

API keys in `docker/.env`:

```bash
GROQ_API_KEY=gsk_...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

Volumes: `~/.iris` → config, logs, memory; `./projects` → workspace.

## Full guide

See [docker/README.md](../docker/README.md) for detailed setup, use cases, and environment variables.
