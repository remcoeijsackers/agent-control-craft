// Craft Studio for Agent Control: agents make and edit photos, video, motion graphics and audio with the open-source
// Craft apps. Nothing is rebuilt here: every app's own MCP server goes into the run (ctx.mcp.provide), started with the
// task's folders as its only read and write roots when the app can confine itself, and live in the user's open app when
// its control port answers. Two small tools tell the agent what it has and how to deliver for a platform; a page shows
// the apps and the recent runs that used them.
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APPS, installHint } from "./lib/apps.mjs";
import { appInstalled, createDetector, expandHome } from "./lib/detect.mjs";
import { reachable as tcpReachable } from "./lib/bridge.mjs";
import { rootsFor, serverConfig, taskLibrary, workDir } from "./lib/servers.mjs";
import { deliverySpec } from "./lib/delivery.mjs";
import { GUIDE } from "./lib/guide.mjs";

const TERMINAL = new Set(["succeeded", "failed", "interrupted"]);
const list = (v) => (Array.isArray(v) ? v : String(v ?? "").split(/[,;\n]+/)).map((x) => String(x).trim()).filter(Boolean);

export function createStudio(ctx, { detector = createDetector(), reachable = tcpReachable, now = () => new Date(), tmp = tmpdir(), home } = {}) {
  const settings = (ws) => ctx.settings.get(ws) ?? {};
  const modeOf = (s, app) => (["auto", "headless", "off"].includes(s[`${app.key}Mode`]) ? s[`${app.key}Mode`] : "auto");
  const portOf = (s, app) => { const n = Number(s[`${app.key}Port`]); return Number.isInteger(n) && n > 0 ? n : null; };

  // The PhotoCraft control token, as a file only this user can read, while the plugin is loaded.
  let tokenDir = null, tokenValue = null;
  function tokenFile() {
    const token = ctx.secrets.get("photoControlToken");
    if (!token) return null;
    tokenDir ??= mkdtempSync(join(tmp, "agent-control-craft-"));
    const file = join(tokenDir, "photocraft.token");
    if (tokenValue !== token || !existsSync(file)) {
      writeFileSync(file, token, { mode: 0o600 });
      chmodSync(file, 0o600);
      tokenValue = token;
    }
    return file;
  }
  function cleanup() { if (tokenDir) rmSync(tokenDir, { recursive: true, force: true }); tokenDir = null; tokenValue = null; }

  function record(run, app, mode, found) {
    ctx.db.run(`INSERT INTO {{runs}} (workspace_id, run_id, task_id, task_code, app, mode, confined, version, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id, app) DO UPDATE SET mode = excluded.mode, confined = excluded.confined, version = excluded.version`,
      run.workspaceId, run.runId, run.taskId, run.taskCode, app.key, mode, found.confines ? 1 : 0, found.version, now().toISOString());
  }

  /** The MCP server of one app for one run, or null when it is off or not installed. */
  const provider = (app) => async (run) => {
    const s = settings(run.workspaceId);
    const mode = modeOf(s, app);
    if (mode === "off") return null;
    const found = await detector.find(app, s[`${app.key}Path`]);
    if (!found) return null;
    const port = mode === "auto" ? portOf(s, app) : null;
    let live = null;
    if (port) {
      if (await reachable(port)) live = port;
      else ctx.log.info(`${app.label}: nothing answers on port ${port}, ${run.taskCode} works headless`);
    }
    const library = s.lightLibrary ? expandHome(String(s.lightLibrary).trim(), home) : taskLibrary(run, tmp);
    if (app.key === "light" && !live) mkdirSync(library, { recursive: true });
    const cwd = workDir(run, tmp);
    mkdirSync(cwd, { recursive: true });
    const cfg = serverConfig(app, found, run, { live, tokenFile: live && app.key === "photo" ? tokenFile() : null, library, mediaFolders: list(s.mediaFolders), home, cwd });
    record(run, app, live ? "live" : "headless", found);
    return cfg;
  };

  function onRunStatus(e) {
    if (!e.runId || !e.data?.to) return;
    ctx.db.run(`UPDATE {{runs}} SET status = ?, ended_at = CASE WHEN ? = 1 THEN ? ELSE ended_at END WHERE run_id = ?`,
      e.data.to, TERMINAL.has(e.data.to) ? 1 : 0, now().toISOString(), e.runId);
  }

  /** What a workspace has: per app found or not, version, mode, confined, live now; plus the folders and recent runs. */
  async function status(ws, { outputDir = null, check = true } = {}) {
    const s = settings(ws);
    const apps = await Promise.all(APPS.map(async (app) => {
      const mode = modeOf(s, app), port = portOf(s, app);
      const found = mode === "off" ? null : await detector.find(app, s[`${app.key}Path`]);
      const open = found && mode === "auto" && port && check ? await reachable(port) : false;
      return {
        key: app.key, label: app.label, what: app.what, server: `craft-${app.key}`, setting: mode,
        available: Boolean(found), path: found?.path ?? null, version: found?.version ?? null,
        confined: found ? found.confines : null, port, live: Boolean(open),
        works: !found ? (mode === "off" ? "switched off in the settings" : "not installed") : open ? `live in the open ${app.label} window (port ${port})` : port && mode === "auto" ? "headless (the app is not open with its control port)" : "headless",
        desktopApp: appInstalled(app, home),
        ...(found ? {} : mode === "off" ? {} : { install: installHint(app) }),
      };
    }));
    const media = list(s.mediaFolders).map((m) => expandHome(m, home));
    const roots = outputDir ? rootsFor({ outputDir, readRoots: [], writeRoots: [] }, media, { home }) : null;
    const recent = ctx.db.all(`SELECT task_id, task_code, app, mode, confined, version, status, started_at, ended_at FROM {{runs}} WHERE workspace_id = ? ORDER BY started_at DESC, id DESC LIMIT 30`, ws)
      .map((r) => ({ ...r, confined: Boolean(r.confined), href: `#/chat/${r.task_id}` }));
    return { apps, mediaFolders: media, lightLibrary: s.lightLibrary ? expandHome(String(s.lightLibrary), home) : null, ...(roots ? { outputDir, folders: roots } : {}), recent };
  }

  async function statusTool(_args, info) {
    const st = await status(info.workspaceId, { outputDir: info.outputDir ?? null });
    return {
      apps: st.apps.map(({ desktopApp, ...a }) => a),
      outputFolder: info.outputDir ?? null,
      scratchFolder: info.taskId ? workDir({ taskId: info.taskId }, tmp) : null,
      mediaFolders: st.mediaFolders,
      ...(st.folders ? { folders: st.folders } : {}),
      howToWork: GUIDE,
      none: st.apps.some((a) => a.available) ? undefined : "No Craft app is installed or switched on for this workspace. Tell the user what you would need instead of improvising.",
    };
  }

  return { provider, onRunStatus, status, statusTool, cleanup, tokenFile };
}

let studio = null;
export default {
  onLoad(ctx) {
    studio = createStudio(ctx);
    for (const app of APPS) ctx.mcp.provide(app.key, studio.provider(app));
    ctx.tools.register("status", (args, info) => studio.statusTool(args, info));
    ctx.tools.register("delivery_spec", (args) => deliverySpec(args.target));
    ctx.routes.handle("GET", "/status", ({ workspaceId }) => studio.status(workspaceId));
    ctx.events.on("run.status", (e) => studio.onRunStatus(e));
    // Warm the detection cache, so the first run does not wait for three --help calls per app.
    void Promise.all(ctx.workspaces().map((ws) => studio.status(ws, { check: false }))).catch((e) => ctx.log.warn(`detect: ${e?.message ?? e}`));
  },
  onUnload() { studio?.cleanup(); studio = null; },
};
