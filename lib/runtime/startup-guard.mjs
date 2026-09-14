import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const IS_WINDOWS = process.platform === "win32";

function isWritableDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.pid-write-test-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function resolvePidDir() {
  const configured = process.env.CREWSWARM_PID_DIR;
  const homePidDir = path.join(os.homedir(), ".crewswarm", "pids");
  const tmpPidDir = path.join(
    os.tmpdir(),
    `crewswarm-pids-${process.getuid?.() ?? "user"}`,
  );

  const candidates = [configured, homePidDir, tmpPidDir].filter(Boolean);
  for (const dir of candidates) {
    if (isWritableDir(dir)) {
      if (dir !== homePidDir) {
        console.warn(`[startup-guard] Using fallback PID directory: ${dir}`);
      }
      return dir;
    }
  }

  throw new Error(
    `[startup-guard] No writable PID directory found. Tried: ${candidates.join(", ")}`,
  );
}

const PID_DIR = resolvePidDir();

/**
 * Check if a process is alive
 */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0); // Signal 0 just checks if process exists
    return true;
  } catch {
    return false;
  }
}

/**
 * Quote a port number for safe interpolation into a PowerShell command.
 */
function shellQuotePowerShell(value) {
  return String(value).replace(/[^0-9]/g, "");
}

/**
 * Get PIDs listening on a port.
 */
function getPidsOnPort(port) {
  if (IS_WINDOWS) {
    try {
      const psPort = shellQuotePowerShell(port);
      const command =
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort '${psPort}' -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"`;
      const out = execSync(command, {
        encoding: "utf8",
        timeout: 3000,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      return [...new Set(out
        .split(/\r?\n/)
        .map((line) => Number.parseInt(line.trim(), 10))
        .filter((pid) => Number.isFinite(pid) && pid > 0))];
    } catch {
      return [];
    }
  }

  try {
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
      encoding: "utf8",
      timeout: 2000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return [...new Set(out
      .split("\n")
      .filter(Boolean)
      .map((p) => Number.parseInt(p, 10))
      .filter((pid) => Number.isFinite(pid) && pid > 0))];
  } catch {
    return [];
  }
}

/**
 * Check if a port is in use.
 */
function isPortInUse(port) {
  return getPidsOnPort(port).length > 0;
}

/**
 * Kill a process by PID.
 */
function killPid(pid) {
  if (IS_WINDOWS) {
    execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore", timeout: 5000 });
    return;
  }
  process.kill(pid, 9);
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Remove a pid file without crashing startup on permission issues.
 */
function tryRemovePidFile(pidFile, serviceName, context) {
  try {
    fs.unlinkSync(pidFile);
    return true;
  } catch (err) {
    console.warn(
      `[startup-guard] Failed to remove ${context} PID file for ${serviceName}: ${err.message}`,
    );
    return false;
  }
}

/**
 * Acquire startup lock for a service
 * Returns: { ok: true, pid } if lock acquired
 *          { ok: false, runningPid, message } if already running
 */
export function acquireStartupLock(serviceName, options = {}) {
  const {
    port = null,
    killStale = true,
    maxRetries = 6,
    pidFile: pidFileOverride = null,
  } = options;
  const pidFile =
    pidFileOverride ?? path.join(PID_DIR, `${serviceName}.pid`);
  if (pidFileOverride) {
    try {
      fs.mkdirSync(path.dirname(pidFile), { recursive: true });
    } catch {
      // write below may still succeed
    }
  }
  const myPid = process.pid;

  // Check if PID file exists
  if (fs.existsSync(pidFile)) {
    try {
      const savedPid = parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10);
      if (!Number.isFinite(savedPid) || savedPid < 1) {
        console.log(
          `[startup-guard] Removing invalid PID file for ${serviceName} (not a positive integer)`,
        );
        if (!tryRemovePidFile(pidFile, serviceName, "invalid")) {
          return {
            ok: false,
            message: `Cannot remove invalid PID file for ${serviceName}: ${pidFile}`,
          };
        }
      } else if (isProcessAlive(savedPid)) {
        // Process is alive - check if it's really the right service
        if (port && !isPortInUse(port)) {
          // PID exists but port is free - stale PID file
          console.log(
            `[startup-guard] Stale PID ${savedPid} for ${serviceName} (port ${port} free) - removing`,
          );
          if (!tryRemovePidFile(pidFile, serviceName, "stale")) {
            return {
              ok: false,
              runningPid: savedPid,
              message: `Cannot remove stale PID file for ${serviceName}: ${pidFile}`,
            };
          }
        } else {
          return {
            ok: false,
            runningPid: savedPid,
            message: `${serviceName} already running (pid ${savedPid})${port ? ` on port ${port}` : ""}`,
          };
        }
      } else {
        // Stale PID file (process exited)
        console.log(
          `[startup-guard] Removing stale PID file for ${serviceName} (pid ${savedPid} dead)`,
        );
        if (!tryRemovePidFile(pidFile, serviceName, "stale")) {
          return {
            ok: false,
            runningPid: savedPid,
            message: `Cannot remove stale PID file for ${serviceName}: ${pidFile}`,
          };
        }
      }
    } catch (err) {
      // Corrupted PID file
      console.log(
        `[startup-guard] Removing corrupted PID file for ${serviceName}: ${err.message}`,
      );
      if (!tryRemovePidFile(pidFile, serviceName, "corrupted")) {
        return {
          ok: false,
          message: `Cannot remove corrupted PID file for ${serviceName}: ${pidFile}`,
        };
      }
    }
  }

  // Check port conflict
  if (port) {
    const portPids = getPidsOnPort(port).filter((pid) => pid !== myPid);
    if (portPids.length > 0) {
      if (killStale) {
        console.log(
          `[startup-guard] Port ${port} occupied by PID(s) ${portPids.join(", ")} - killing stale listener(s)`,
        );
        try {
          for (const pid of portPids) killPid(pid);
          // Wait for port to be released
          for (let i = 0; i < maxRetries; i++) {
            if (!isPortInUse(port)) break;
            const wait = (i + 1) * 1000;
            console.log(
              `[startup-guard] Port ${port} in use — retry ${i + 1}/${maxRetries} in ${wait}ms`,
            );
            sleepMs(wait);
          }
          if (isPortInUse(port)) {
            const remainingPids = getPidsOnPort(port).filter((pid) => pid !== myPid);
            return {
              ok: false,
              runningPid: remainingPids[0] ?? portPids[0],
              message: `Port ${port} still in use after killing stale listener(s): ${remainingPids.join(", ") || "unknown"}`,
            };
          }
        } catch (err) {
          return {
            ok: false,
            runningPid: portPids[0],
            message: `Failed to kill stale listener(s) ${portPids.join(", ")} on port ${port}: ${err.message}`,
          };
        }
      } else {
        return {
          ok: false,
          runningPid: portPids[0],
          message: `Port ${port} already in use by process ${portPids[0]}`,
        };
      }
    }
  }

  // Acquire lock by writing PID file
  try {
    fs.writeFileSync(pidFile, String(myPid));
    console.log(
      `[startup-guard] Acquired lock for ${serviceName} (pid ${myPid})${port ? ` on port ${port}` : ""}`,
    );

    // Clean up PID file on exit
    const cleanup = () => {
      try {
        const current = fs.existsSync(pidFile)
          ? fs.readFileSync(pidFile, "utf8").trim()
          : null;
        if (current === String(myPid)) {
          fs.unlinkSync(pidFile);
          console.log(
            `[startup-guard] Released lock for ${serviceName} (pid ${myPid})`,
          );
        }
      } catch {}
    };

    process.on("exit", cleanup);
    process.on("SIGINT", () => {
      cleanup();
      process.exit(130);
    });
    process.on("SIGTERM", () => {
      cleanup();
      process.exit(143);
    });

    return { ok: true, pid: myPid };
  } catch (err) {
    return {
      ok: false,
      message: `Failed to write PID file for ${serviceName}: ${err.message}`,
    };
  }
}

/**
 * Release startup lock (usually automatic via process.on('exit'))
 */
export function releaseStartupLock(serviceName) {
  const pidFile = path.join(PID_DIR, `${serviceName}.pid`);
  try {
    const savedPid = parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10);
    if (savedPid === process.pid) {
      fs.unlinkSync(pidFile);
      console.log(`[startup-guard] Released lock for ${serviceName}`);
    }
  } catch {}
}
