import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:net";
import { APPS, appOf } from "../lib/apps.mjs";
import { rootsFor, serverConfig, taskLibrary } from "../lib/servers.mjs";
import { candidates, createDetector } from "../lib/detect.mjs";
import { controlPort, loopbackPorts, reachable } from "../lib/bridge.mjs";
import { deliverySpec, TARGETS } from "../lib/delivery.mjs";
import { fakeClis, runOf, tempDirs } from "./helpers.mjs";

const found = (confines) => ({ path: "/bin/x-cli", version: "1.0.0", confines });

test("headless and live arguments per app", () => {
  const d = tempDirs(), run = runOf(d);
  const args = (key, live = null, extra = {}) => serverConfig(appOf(key), found(false), run, { live, library: "/lib", ...extra }).args;
  assert.deepEqual(args("film"), ["mcp"]);
  assert.deepEqual(args("film", 7801), ["--bridge", "127.0.0.1:7801", "mcp"]);
  assert.deepEqual(args("photo"), ["mcp"]);
  assert.deepEqual(args("photo", 7802, { tokenFile: "/t/token" }), ["mcp", "--bridge", "127.0.0.1:7802", "--control-token-file", "/t/token"]);
  assert.deepEqual(args("photo", 7802), ["mcp", "--bridge", "127.0.0.1:7802"]);
  assert.deepEqual(args("light"), ["mcp", "--compact", "--library", "/lib"]);
  assert.deepEqual(args("light", 7980), ["mcp", "--compact", "--connect", "127.0.0.1:7980"]);
  assert.deepEqual(args("effect"), ["mcp", "--autosave"]);
  assert.deepEqual(args("effect", 7803), ["mcp", "--bridge", "7803"]);
  assert.deepEqual(args("sound"), ["mcp"]);
  assert.deepEqual(args("sound", 7804), ["mcp", "--connect", "7804"]);
  assert.equal(APPS.length, 5);
});

test("an app that can confine itself gets the task's folders and nothing else", () => {
  const d = tempDirs();
  const granted = join(d.root, "granted"); mkdirSync(granted);
  const run = runOf(d, { readRoots: [granted, join(d.root, "gone")], writeRoots: [d.out] });
  const cfg = serverConfig(appOf("photo"), found(true), run, { mediaFolders: [d.media, "~/nope"], home: d.home, cwd: d.root });
  assert.equal(cfg.command, "/bin/x-cli");
  assert.equal(cfg.cwd, d.root);
  assert.deepEqual(cfg.args, ["mcp", "--automation-read-root", d.out, "--automation-read-root", d.media, "--automation-read-root", granted, "--automation-write-root", d.out]);
  // Without the flags (FilmCraft, LightCraft today) nothing is added: the page and craft_status say it is not confined.
  assert.deepEqual(serverConfig(appOf("film"), found(false), run).args, ["mcp"]);
  assert.deepEqual(rootsFor(run, ["~/"], { home: d.home }).read, [d.out, d.home, granted]);
});

test("a task without a library gets its own in the temporary folder, not in its results", () => {
  assert.equal(taskLibrary({ taskCode: "AC-7" }, "/tmp/x"), "/tmp/x/agent-control-craft/lightcraft/AC-7");
  assert.equal(taskLibrary({ taskCode: "../evil" }, "/tmp/x"), "/tmp/x/agent-control-craft/lightcraft/___evil");
});

test("detection: setting first, then the usual folders; version and the folder flags", async () => {
  const bin = fakeClis(["filmcraft-cli", "photocraft-cli"], { confines: ["photocraft-cli"], version: "0.9.0" });
  const d = tempDirs();
  const det = createDetector({ home: d.home, env: { PATH: bin } });
  assert.deepEqual(await det.find(appOf("photo")), { path: join(bin, "photocraft-cli"), version: "0.9.0", confines: true });
  assert.deepEqual(await det.find(appOf("film")), { path: join(bin, "filmcraft-cli"), version: "0.9.0", confines: false });
  assert.equal(await det.find(appOf("sound")), null);
  // A wrong path in the settings is not silently replaced by another copy.
  assert.equal(await det.find(appOf("film"), "/no/such/filmcraft-cli"), null);
  assert.equal((await det.find(appOf("film"), join(bin, "filmcraft-cli"))).path, join(bin, "filmcraft-cli"));
  const list = candidates(appOf("film"), "~/bin/filmcraft-cli", { home: "/h", env: { PATH: "/p" } });
  assert.deepEqual(list.slice(0, 2), ["/h/bin/filmcraft-cli", "/h/.local/bin/filmcraft-cli"]);
  assert.ok(list.includes("/p/filmcraft-cli"));
});

test("detection is cached per file", async () => {
  const bin = fakeClis(["effectcraft-cli"]);
  let calls = 0;
  const det = createDetector({ home: "/nowhere", env: { PATH: bin }, exec: async () => { calls++; return { ok: true, out: "effectcraft-cli 0.10.0 --automation-read-root" }; } });
  await det.find(appOf("effect")); await det.find(appOf("effect"));
  assert.equal(calls, 3);
});

test("the bridge check answers quickly for an open and a closed port", async () => {
  const srv = createServer((s) => s.end()).listen(0, "127.0.0.1");
  await new Promise((r) => srv.once("listening", r));
  const port = srv.address().port;
  assert.equal(await reachable(port), true);
  srv.close();
  await new Promise((r) => srv.once("close", r));
  const t = Date.now();
  assert.equal(await reachable(port), false);
  assert.ok(Date.now() - t < 1000);
  assert.equal(await reachable(0), false);
});

test("delivery specs", () => {
  assert.deepEqual(deliverySpec().targets, Object.keys(TARGETS));
  const reel = deliverySpec("Instagram Reel");
  assert.equal(reel.target, "instagram-reel");
  assert.equal(reel.width, 1080); assert.equal(reel.height, 1920);
  assert.ok(reel.how.some((h) => h.startsWith("FilmCraft:") && h.includes('"burnCaptions":true')));
  assert.match(deliverySpec("myspace").error, /Unknown target/);
  for (const [k, s] of Object.entries(TARGETS)) assert.ok(s.how.length && s.kind && s.notes, k);
});

test("the control port is read from the open app: its loopback listener, whatever started it", async () => {
  assert.deepEqual(loopbackPorts("p78632\nf9\nn127.0.0.1:7992\nf10\nn*:7993\nf11\nn192.168.1.4:7994\nf12\nn[::1]:7992\n"), [7992, 7993]);
  const calls = [];
  const exec = async (file, args) => {
    calls.push([file.split("/").pop(), ...args]);
    return { ok: true, out: file.endsWith("pgrep") ? "78632\n78640\n" : "p78632\nf9\nn192.168.1.4:7000\nf10\nn127.0.0.1:7991\nn127.0.0.1:7992\n" };
  };
  assert.equal(await controlPort(appOf("film"), { exec, check: async (p) => p === 7992 }), 7992);
  assert.deepEqual(calls[0], ["pgrep", "-x", "FilmCraft"]);
  assert.deepEqual(calls[1].slice(1, 3), ["-a", "-p"]); assert.equal(calls[1][3], "78632,78640");
  // Not running, or running without a control port: no port.
  assert.equal(await controlPort(appOf("film"), { exec: async () => ({ ok: true, out: "\n" }) }), null);
  assert.equal(await controlPort(appOf("film"), { exec: async (f) => ({ ok: true, out: f.endsWith("pgrep") ? "1\n" : "p1\n" }) }), null);
});
