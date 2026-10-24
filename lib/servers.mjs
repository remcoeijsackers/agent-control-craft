// Building the MCP server of one Craft app for one agent run: the CLI with its `mcp` arguments, live or headless, and
// the folders it may read and write when the app can confine itself. Pure apart from the existence checks, so the
// exact command line per app is easy to test.
import { existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expandHome } from "./detect.mjs";

const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
const uniq = (xs) => [...new Set(xs.filter(Boolean).map((p) => resolve(p)))];

/**
 * The folders for a run. Writing: the task's output folder and the folders Rights let it write. Reading: those, the
 * media folders from the settings and the folders Rights let it read. Folders that do not exist are left out (a Craft
 * app refuses a root it cannot resolve).
 */
export function rootsFor(run, mediaFolders = [], { home, exists = isDir } = {}) {
  const write = uniq([run.outputDir, ...(run.writeRoots ?? [])]).filter(exists);
  const read = uniq([...write, ...mediaFolders.map((m) => expandHome(String(m).trim(), home)), ...(run.readRoots ?? [])]).filter(exists);
  return { read, write };
}

const safe = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, "_");
/** A fresh LightCraft library per task when none is set: in the temporary folder, not in the results. */
export const taskLibrary = (run, base = tmpdir()) => join(base, "agent-control-craft", "lightcraft", safe(run.taskCode || run.taskId));
/** The working folder of a task's Craft servers: previews, caches and anything relative land here, not in the results. */
export const workDir = (run, base = tmpdir()) => join(base, "agent-control-craft", "work", safe(run.taskId));

/**
 * The stdio config for one app. `found` is the detected CLI ({path, confines}); `live` the control port when the app
 * is open (else null).
 */
export function serverConfig(app, found, run, { live = null, tokenFile = null, library, mediaFolders = [], home, exists, cwd } = {}) {
  const args = app.args({ port: live, tokenFile, library: library || taskLibrary(run) });
  const roots = found.confines ? rootsFor(run, mediaFolders, { home, exists }) : null;
  if (roots) for (const r of roots.read) args.push("--automation-read-root", r);
  if (roots) for (const w of roots.write) args.push("--automation-write-root", w);
  return { command: found.path, args, ...(cwd && existsSync(cwd) ? { cwd } : {}) };
}
