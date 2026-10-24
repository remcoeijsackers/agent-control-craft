// Test helpers: a fake Agent Control ctx (a real SQLite database for the plugin's table, settings and secrets in
// memory) and fake Craft CLIs, small shell scripts that answer --version and --help like the real ones.
import { DatabaseSync } from "node:sqlite";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function fakeCtx({ settings = {}, secrets = {}, workspaces = ["ws-1"] } = {}) {
  const db = new DatabaseSync(":memory:");
  const x = (sql) => sql.replace(/\{\{\s*runs\s*\}\}/g, "runs");
  db.exec(x(readFileSync(new URL("../migrations/001_runs.sql", import.meta.url), "utf8")));
  const logs = [], provided = new Map(), tools = new Map(), routes = new Map(), events = new Map();
  const ctx = {
    settings: { get: (ws) => settings[ws] ?? settings },
    secrets: { get: (k) => secrets[k] ?? null },
    db: { run: (s, ...a) => db.prepare(x(s)).run(...a), all: (s, ...a) => db.prepare(x(s)).all(...a), get: (s, ...a) => db.prepare(x(s)).get(...a) },
    workspaces: () => workspaces,
    mcp: { provide: (name, fn) => provided.set(name, fn) },
    tools: { register: (name, fn) => tools.set(name, fn) },
    routes: { handle: (method, path, fn) => routes.set(`${method} ${path}`, fn) },
    events: { on: (kind, fn) => events.set(kind, fn) },
    log: { info: (m) => logs.push(m), warn: (m) => logs.push(m), error: (m) => logs.push(m) },
  };
  return { ctx, logs, db, provided, tools, routes, events, settings, secrets };
}

/** A folder with fake CLIs. `confines` lists the apps whose help mentions the folder flags. */
export function fakeClis(names, { confines = [], version = "1.2.3" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "craft-cli-"));
  for (const name of names) {
    const flags = confines.includes(name) ? "  --automation-read-root DIR  --automation-write-root DIR" : "";
    const f = join(dir, name);
    writeFileSync(f, `#!/bin/sh\ncase "$1" in\n  --version) echo "${name} ${version}" ;;\n  --help) echo "usage: ${name} mcp${flags}" ;;\n  mcp) echo "mcp server${flags}" ;;\nesac\n`);
    chmodSync(f, 0o755);
  }
  return dir;
}

export function tempDirs() {
  const root = mkdtempSync(join(tmpdir(), "craft-run-"));
  const out = join(root, "outputs", "AC-7"), media = join(root, "media"), home = join(root, "home");
  for (const d of [out, media, home]) mkdirSync(d, { recursive: true });
  return { root, out, media, home };
}

export const runOf = (dirs, over = {}) => ({ workspaceId: "ws-1", taskId: "task-7", taskCode: "AC-7", runId: "run-1", outputDir: dirs.out, readRoots: [], writeRoots: [dirs.out], ...over });
