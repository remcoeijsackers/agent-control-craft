// The Craft apps this plugin brings to agent runs, and how each one's MCP server is started. Every app ships a CLI with
// an `mcp` subcommand: headless by default, or driving the open app ("live") over its control port. The flags differ a
// little per app, so each one says how it takes a live connection and what it needs headless.

/** @typedef {{ port: number | null, tokenFile: string | null, library: string }} StartInfo */

export const APPS = [
  {
    key: "film", label: "FilmCraft", what: "video editing (Premiere Pro-class)", cli: "filmcraft-cli", app: "FilmCraft", repo: "storytold/filmcraft",
    // FilmCraft takes --bridge as a global option, before the subcommand.
    args: (/** @type {StartInfo} */ x) => x.port ? ["--bridge", `127.0.0.1:${x.port}`, "mcp"] : ["mcp"],
  },
  {
    key: "photo", label: "PhotoCraft", what: "image editing and retouching (Photoshop-class)", cli: "photocraft-cli", app: "PhotoCraft", repo: "storytold/photocraft",
    args: (x) => x.port ? ["mcp", "--bridge", `127.0.0.1:${x.port}`, ...(x.tokenFile ? ["--control-token-file", x.tokenFile] : [])] : ["mcp"],
  },
  {
    key: "light", label: "LightCraft", what: "photo library and raw development (Lightroom-class)", cli: "lightcraft-cli", app: "LightCraft", repo: "storytold/lightcraft",
    // Without --compact LightCraft lists every command as its own tool (300+); compact keeps the helpers and run_command.
    args: (x) => x.port ? ["mcp", "--compact", "--connect", `127.0.0.1:${x.port}`] : ["mcp", "--compact", "--library", x.library],
  },
  {
    key: "effect", label: "EffectCraft", what: "motion graphics and compositing (After Effects-class)", cli: "effectcraft-cli", app: "EffectCraft", repo: "storytold/effectcraft",
    // Headless work survives a crash of the server only with --autosave; live, the app saves.
    args: (x) => x.port ? ["mcp", "--bridge", String(x.port)] : ["mcp", "--autosave"],
  },
  {
    key: "sound", label: "SoundCraft", what: "audio recording, editing and mixing (Pro Tools-class)", cli: "soundcraft-cli", app: "SoundCraft", repo: "storytold/soundcraft",
    args: (x) => x.port ? ["mcp", "--connect", String(x.port)] : ["mcp"],
  },
];

export const appOf = (key) => APPS.find((a) => a.key === key);

/** Where to get an app that is missing. */
export const installHint = (a) => `Install ${a.label} with the Craft Launcher (https://github.com/storytold/craft-launcher) or from https://github.com/${a.repo}/releases, so that ${a.cli} is on this Mac (for example in ~/.local/bin), or set its path in the plugin's settings.`;
