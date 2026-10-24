// Whether a Craft app is open with its control port: a plain TCP connect to 127.0.0.1, given up quickly so a closed app
// never slows down the start of a run.
import { connect } from "node:net";

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
