import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import plugin, { createStudio } from "../index.mjs";
import { appOf } from "../lib/apps.mjs";
import { createDetector } from "../lib/detect.mjs";
import { fakeClis, fakeCtx, runOf, tempDirs } from "./helpers.mjs";

const ALL = ["filmcraft-cli", "photocraft-cli", "lightcraft-cli", "effectcraft-cli", "soundcraft-cli"];
function setup({ settings = {}, secrets = {}, clis = ALL, confines = ["photocraft-cli", "effectcraft-cli", "soundcraft-cli"], open = {} } = {}) {
  const d = tempDirs();
  const bin = fakeClis(clis, { confines });
  const f = fakeCtx({ settings, secrets });
  const studio = createStudio(f.ctx, { detector: createDetector({ home: d.home, env: { PATH: bin } }), findPort: async (app) => open[app.key] ?? null, tmp: d.root, home: d.home });
  return { ...f, d, bin, studio };
}

test("every app gets a server; off or missing apps get none", async () => {
  const { studio, d, bin } = setup({ settings: { soundMode: "off" }, clis: ALL.filter((c) => c !== "lightcraft-cli") });
  const run = runOf(d);
  const film = await studio.provider(appOf("film"))(run);
  // The servers run in a scratch folder per task, so previews and caches stay out of the results.
  assert.deepEqual(film, { command: join(bin, "filmcraft-cli"), args: ["mcp"], cwd: join(d.root, "agent-control-craft", "work", "task-7") });
  const photo = await studio.provider(appOf("photo"))(run);
  assert.deepEqual(photo.args, ["mcp", "--automation-read-root", d.out, "--automation-write-root", d.out]);
  assert.equal(await studio.provider(appOf("light"))(run), null);
  assert.equal(await studio.provider(appOf("sound"))(run), null);
});

test("live when the app is open with a control port, headless otherwise; the PhotoCraft token goes to a private file", async () => {
  const token = "a".repeat(64);
  const { studio, d } = setup({ settings: { effectMode: "headless" }, secrets: { photoControlToken: token }, open: { photo: 7802, effect: 7803 } });
  const run = runOf(d);
  const photo = await studio.provider(appOf("photo"))(run);
  const file = photo.args[photo.args.indexOf("--control-token-file") + 1];
  assert.deepEqual(photo.args.slice(0, 3), ["mcp", "--bridge", "127.0.0.1:7802"]);
  assert.equal(readFileSync(file, "utf8"), token);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  // FilmCraft is not open: headless.
  assert.deepEqual((await studio.provider(appOf("film"))(run)).args, ["mcp"]);
  // EffectCraft is set to always headless: the open port is not used.
  assert.deepEqual((await studio.provider(appOf("effect"))(run)).args.slice(0, 2), ["mcp", "--autosave"]);
  studio.cleanup();
  assert.equal(existsSync(file), false);
});

test("an open PhotoCraft without its control token works headless", async () => {
  const { studio, d, logs } = setup({ open: { photo: 7802 } });
  assert.deepEqual((await studio.provider(appOf("photo"))(runOf(d))).args.slice(0, 2), ["mcp", "--automation-read-root"]);
  assert.match(logs.join("\n"), /PhotoCraft is open on port 7802, but its control token is not under keys/);
  const by = Object.fromEntries((await studio.status("ws-1")).apps.map((a) => [a.key, a]));
  assert.equal(by.photo.live, false); assert.match(by.photo.works, /control token/);
});

test("LightCraft: the library from the settings, else a fresh one per task", async () => {
  const { studio, d } = setup({ settings: {} });
  const own = await studio.provider(appOf("light"))(runOf(d));
  const lib = own.args[own.args.indexOf("--library") + 1];
  assert.equal(lib, join(d.root, "agent-control-craft", "lightcraft", "AC-7"));
  assert.ok(existsSync(lib));
  const set = setup({ settings: { lightLibrary: "~/Craft/Lib" } });
  const cfg = await set.studio.provider(appOf("light"))(runOf(set.d));
  assert.equal(cfg.args[cfg.args.indexOf("--library") + 1], join(set.d.home, "Craft", "Lib"));
});

test("media folders are readable, never writable", async () => {
  const { studio, d, settings } = setup();
  settings.mediaFolders = [d.media];
  const cfg = await studio.provider(appOf("effect"))(runOf(d));
  assert.deepEqual(cfg.args, ["mcp", "--autosave", "--automation-read-root", d.out, "--automation-read-root", d.media, "--automation-write-root", d.out]);
});

test("runs are recorded with their mode and how they ended", async () => {
  const { studio, d, db } = setup({ secrets: { photoControlToken: "a".repeat(64) }, open: { photo: 7802 } });
  const run = runOf(d);
  await studio.provider(appOf("photo"))(run);
  await studio.provider(appOf("film"))(run);
  studio.onRunStatus({ runId: "run-1", data: { from: "starting", to: "running" } });
  let rows = db.prepare("SELECT app, mode, confined, status, ended_at FROM runs ORDER BY app").all();
  assert.deepEqual(rows.map((r) => ({ ...r })), [
    { app: "film", mode: "headless", confined: 0, status: "running", ended_at: null },
    { app: "photo", mode: "live", confined: 1, status: "running", ended_at: null },
  ]);
  studio.onRunStatus({ runId: "run-1", data: { from: "running", to: "succeeded" } });
  rows = db.prepare("SELECT status, ended_at FROM runs").all();
  assert.ok(rows.every((r) => r.status === "succeeded" && r.ended_at));
  // A second provide in the same run updates the row instead of adding one.
  await studio.provider(appOf("film"))(run);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM runs").get().n, 2);
});

test("craft_status tells the agent what it has, how it works and how to get what is missing", async () => {
  const { studio, d } = setup({ clis: ["filmcraft-cli", "photocraft-cli"], open: { film: 7801 } });
  const st = await studio.statusTool({}, { workspaceId: "ws-1", outputDir: d.out });
  const by = Object.fromEntries(st.apps.map((a) => [a.key, a]));
  assert.equal(by.film.available, true); assert.equal(by.film.live, true); assert.match(by.film.works, /live in the open FilmCraft window/);
  assert.equal(by.film.confined, false);
  assert.equal(by.photo.confined, true); assert.match(by.photo.works, /^headless \(live once PhotoCraft is open/);
  assert.equal(by.sound.available, false); assert.match(by.sound.install, /Craft Launcher/);
  assert.equal(st.outputFolder, d.out);
  assert.equal(st.scratchFolder, null);
  assert.equal((await studio.statusTool({}, { workspaceId: "ws-1", taskId: "task-7" })).scratchFolder, join(d.root, "agent-control-craft", "work", "task-7"));
  assert.ok(st.howToWork.some((l) => /output folder/.test(l)));
  assert.equal(st.none, undefined);
  const none = setup({ clis: [] });
  assert.match((await none.studio.statusTool({}, { workspaceId: "ws-1" })).none, /No Craft app/);
});

test("the plugin registers a server per app, both tools, the route and the event", async () => {
  const f = fakeCtx();
  plugin.onLoad(f.ctx);
  assert.deepEqual([...f.provided.keys()], ["film", "photo", "light", "effect", "sound"]);
  assert.deepEqual([...f.tools.keys()], ["status", "delivery_spec"]);
  assert.deepEqual([...f.routes.keys()], ["GET /status"]);
  assert.deepEqual([...f.events.keys()], ["run.status"]);
  assert.equal((await f.tools.get("delivery_spec")({ target: "podcast" })).target, "podcast");
  plugin.onUnload();
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.mcpServers.map((s) => s.name), ["film", "photo", "light", "effect", "sound"]);
  assert.deepEqual(manifest.tools.map((t) => t.name), ["status", "delivery_spec"]);
});
