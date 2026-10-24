// Finding the Craft CLIs on this machine: the path from the settings, else the usual install folders and PATH. For a
// found CLI it reads the version and whether its MCP server can confine file access to folders (the
// --automation-read-root / --automation-write-root flags; not every app or version has them). Results are cached per
// path and modification time, so a run start costs a stat, not a process.
import { execFile } from "node:child_process";
import { accessSync, constants, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const ROOT_FLAG = "--automation-read-root";

/** Runs a CLI with stdin closed and a time limit; resolves with stdout + stderr, never rejects. */
export function run(file, args, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const child = execFile(file, args, { timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, NO_COLOR: "1" } }, (err, stdout, stderr) => {
      resolve({ ok: !err || typeof err.code === "number", out: `${stdout ?? ""}\n${stderr ?? ""}` });
    });
    child.stdin?.end();
  });
}

export const expandHome = (p, home = homedir()) => (p === "~" ? home : p.startsWith("~/") ? join(home, p.slice(2)) : p);

const executable = (p) => { try { const st = statSync(p); if (!st.isFile()) return null; accessSync(p, constants.X_OK); return st; } catch { return null; } };

/** Candidate paths for a CLI, best first. */
export function candidates(app, setting, { home = homedir(), env = process.env } = {}) {
  const list = [];
  if (setting && String(setting).trim()) list.push(expandHome(String(setting).trim(), home));
  list.push(join(home, ".local", "bin", app.cli), "/opt/homebrew/bin/" + app.cli, "/usr/local/bin/" + app.cli);
  for (const dir of String(env.PATH ?? "").split(delimiter).filter(Boolean)) list.push(join(dir, app.cli));
  // Where the Craft Launcher unpacks the CLIs: ~/.local/share/craft-cli/<app>/<release>/<cli>, newest first.
  const share = join(home, ".local", "share", "craft-cli", app.cli.replace(/-cli$/, ""));
  try { for (const d of readdirSync(share).sort().reverse()) list.push(join(share, d, app.cli)); } catch { /* not there */ }
  return [...new Set(list)];
}

export function createDetector({ exec = run, home = homedir(), env = process.env } = {}) {
  const cache = new Map();
  /**
   * The CLI of an app: `{ path, version, confines }`, or null when it is not installed. With a path in the settings only
   * that path counts, so a wrong setting shows up instead of silently using another copy.
   */
  async function find(app, setting) {
    const explicit = Boolean(setting && String(setting).trim());
    const list = candidates(app, setting, { home, env });
    for (const path of explicit ? list.slice(0, 1) : list) {
      const st = executable(path);
      if (!st) continue;
      const key = `${path}:${st.mtimeMs}:${st.size}`;
      if (!cache.has(key)) cache.set(key, inspect(path));
      return cache.get(key);
    }
    return null;
  }
  async function inspect(path) {
    const [v, help, mcpHelp] = await Promise.all([exec(path, ["--version"]), exec(path, ["--help"]), exec(path, ["mcp", "--help"])]);
    const version = /(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/.exec(v.out)?.[1] ?? null;
    return { path, version, confines: `${help.out}\n${mcpHelp.out}`.includes(ROOT_FLAG) };
  }
  return { find, clear: () => cache.clear() };
}

/** Whether the desktop app itself is installed (for the page; agents need the CLI). */
export function appInstalled(app, home = homedir()) {
  for (const dir of ["/Applications", join(home, "Applications")]) {
    try { if (statSync(join(dir, `${app.app}.app`)).isDirectory()) return true; } catch { /* not there */ }
  }
  return false;
}
