// Whether a Craft app is open with its control port, and on which port. The port is read from the running app itself
// (the loopback port its process listens on), so it does not matter how control was switched on: `--control <port>`,
// the app's *_CONTROL_PORT variable or its own preference, which may pick a free port. The TCP check is given up
// quickly, so a closed app never slows down the start of a run.
import { existsSync } from "node:fs";
import { connect } from "node:net";
import { run } from "./detect.mjs";

export function reachable(port, timeoutMs = 700) {
  return new Promise((resolve) => {
    if (!Number.isInteger(port) || port < 1 || port > 65535) return resolve(false);
    const s = connect({ host: "127.0.0.1", port });
    const done = (ok) => { s.removeAllListeners(); s.destroy(); resolve(ok); };
    s.setTimeout(timeoutMs, () => done(false));
    s.once("connect", () => done(true));
    s.once("error", () => done(false));
  });
}

// Agent Control may run without /usr/sbin on its PATH.
const tool = (name, dirs) => dirs.map((d) => `${d}/${name}`).find((p) => existsSync(p)) ?? name;
const PGREP = tool("pgrep", ["/usr/bin", "/bin"]);
const LSOF = tool("lsof", ["/usr/sbin", "/usr/bin", "/bin"]);

/** The listening ports in `lsof -Fn` output that are reachable on 127.0.0.1: loopback or all interfaces. */
export const loopbackPorts = (out) =>
  [...new Set([...String(out).matchAll(/^n(?:127\.0\.0\.1|localhost|\[::1\]|\*):(\d+)$/gm)].map((m) => Number(m[1])))];

/** The control port of the open app, or null when it is not running or listens nowhere. */
export async function controlPort(app, { exec = run, check = reachable } = {}) {
  const pids = (await exec(PGREP, ["-x", app.app])).out.split(/\s+/).filter((p) => /^\d+$/.test(p));
  if (!pids.length) return null;
  const ls = await exec(LSOF, ["-a", "-p", pids.join(","), "-iTCP", "-sTCP:LISTEN", "-nP", "-Fn"]);
  for (const port of loopbackPorts(ls.out)) if (await check(port)) return port;
  return null;
}
