# Keeping Agents Working

Operational tips for reliable agent execution.

## Restart everything

```bash
npm run restart-all
```

Restarts: RT bus → agent bridges → iris-lead → dashboard.

## Restart agents only

```bash
node scripts/start-iris.mjs --force
```

Keeps dashboard and iris-lead running; restarts all gateway bridges.

## Restart single agent

```bash
node scripts/start-iris.mjs --restart iris-coder
```

## Check health

```bash
npm run health
```

Verifies paths, config, and running services.

## Logs

```bash
tail -f /tmp/iris-lead.log
tail -f /tmp/openiris-rt-daemon.log
tail -f /tmp/bridge-iris-coder.log
```

## Timeouts

If agents hang, increase timeouts in `~/.iris/iris.json` env:

- `IRIS_ENGINE_IDLE_TIMEOUT_MS` — engine silence before kill
- `IRIS_DISPATCH_CLAIMED_TIMEOUT_MS` — claimed task timeout

## @@KILL when stuck

Type `@@KILL` in chat to SIGTERM all agent bridges. Then restart:

```bash
node scripts/start-iris.mjs
```
