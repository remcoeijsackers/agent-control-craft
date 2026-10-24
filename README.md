# Craft Studio for Agent Control

A plugin for [Agent Control](https://github.com/remcoeijsackers/agent-control) that lets your agents make and edit
**photos, video, motion graphics and audio** with the open-source [Craft apps](https://github.com/storytold):

| App | What agents do with it |
|---|---|
| **FilmCraft** | Video editing (Premiere Pro-class): import footage, cut, titles, color, captions, export for every platform |
| **PhotoCraft** | Image editing (Photoshop-class): layers, retouching, compositions, export |
| **LightCraft** | Photo library and raw development (Lightroom-class): import, develop, crop, presets, export |
| **EffectCraft** | Motion graphics and compositing (After Effects-class): animated titles, lower thirds, logo reveals |
| **SoundCraft** | Audio (Pro Tools-class): voice-over, music beds, mixing, bounces for a video or a podcast |

Nothing is rebuilt here. Every Craft app comes with its own MCP server, and this plugin hands those servers to your
agents, set up for Agent Control:

- **Confined to the task.** An app that supports it may only write to the task's output folder and only read that
  folder, your media folders and the folders the task has rights to. A save anywhere else is refused by the app itself.
- **Results where you expect them.** Projects and exports are saved in the task's output folder, so they show up
  under **Results** when the run ends. Previews and caches go to a scratch folder instead.
- **Headless or live.** By default the apps run in the background, without windows, so agents can work at night. Start an
  app with `--control <port>` and set that port in the plugin. While the port answers, agents work in your open window
  and you can watch every edit.
- **No guessing.** `craft_status` tells the agent what it has and how to work. `craft_delivery_spec` gives exact sizes,
  frame rates, codecs, durations and the export call per app for Instagram, TikTok, LinkedIn, YouTube, the web, print and
  podcasts.

## Requirements

- Agent Control with plugin MCP servers (the `mcp` permission, [agent-control#77](https://github.com/remcoeijsackers/agent-control/pull/77)).
  An older version refuses the manifest.
- The Craft apps' command-line tools: `filmcraft-cli`, `photocraft-cli`, `lightcraft-cli`, `effectcraft-cli`,
  `soundcraft-cli`. Install them with the [Craft Launcher](https://github.com/storytold/craft-launcher) or from each
  app's releases. The plugin looks in `~/.local/bin`, `/opt/homebrew/bin`, `/usr/local/bin`, `PATH` and the launcher's
  folder; you can also set a path per app. Any subset works.

## Install

In Agent Control: **Plugins → Browse**, find **Craft Studio**, click **Install**. Then:

1. **Plugins → Installed → Craft Studio**: turn it on for the workspaces where agents should make media.
2. Optionally fill in its **settings** per workspace: media folders agents may read (for example `~/Craft`,
   `~/Pictures`), a LightCraft library, a control port per app for live mode, or switch an app off.
3. Open **Plugins → Craft Studio** to see which apps were found, their version, and whether each is confined.
4. Under **Rights**, allow the tools `craft-film`, `craft-photo`, … for the workspace. Without that, the first call to
   each app asks you in the inbox. In God mode the autonomy rules decide, and every decision is in the God audit log.

Then give a task like *"Make a 20-second Instagram reel from the clips in ~/Craft/shoot-0412, with our logo animated
at the start and captions"* and the agent will use FilmCraft, EffectCraft and the delivery spec for a reel.

## How it works

At the start of every Claude run in a workspace where the plugin is on, Agent Control asks it for its MCP servers
(`ctx.mcp.provide`). For every app that is on and installed, the plugin:

1. finds the CLI, reads its version, and checks whether its MCP server can confine file access
   (`--automation-read-root` / `--automation-write-root`);
2. checks the app's control port, when you set one (at most 0.7 s): open means **live**
   (`--bridge` / `--connect`), closed means **headless**;
3. builds the command line. Confined apps get the output folder as their only write root, and the output folder, media
   folders and permitted folders as read roots. LightCraft gets a fresh library per task, or yours. EffectCraft runs
   headless with `--autosave`. LightCraft runs with `--compact`, so the agent sees about 17 tools instead of more than 300;
4. records the run, so the page can show which runs used which app and how they ended.

The agent then sees the apps' own tools, as `mcp__craft-film__command_run`, `mcp__craft-photo__doc_save`, and so on.

| App | Confined to the task | Live flag |
|---|---|---|
| PhotoCraft 0.9 | yes | `--bridge 127.0.0.1:<port>` + `--control-token-file` |
| EffectCraft 0.10 | yes | `--bridge <port>` |
| SoundCraft | yes | `--connect <port>` |
| FilmCraft 0.8 | not yet: the plugin applies it as soon as a version supports the flags | `--bridge 127.0.0.1:<port>` |
| LightCraft 0.8 | not yet, as above | `--connect 127.0.0.1:<port>` |

An app that is not confined can read and write anywhere on your Mac. The page says so, and agents are told to stay
in the output and media folders. Only allow its tools under Rights if you trust the work.

EffectCraft's headless autosave writes recovery copies to its own folder in `~/Library/Application Support/EffectCraft`,
like the app does.

## Security

- The plugin runs no media code of its own: it starts the Craft CLIs you installed, with arguments built from your
  settings.
- These MCP servers are programs outside the agent's sandbox. That is why Agent Control never allows their tools
  automatically: they follow Rights, or the autonomy rules in God mode.
- The PhotoCraft control token stays in the OS key store. For live mode it is written to a private file (`0600`) in a
  temporary folder, which is removed when the plugin unloads.

## Development

```bash
npm test
```

The tests use fake CLIs and a fake Agent Control context, so they run anywhere with Node 24. Plugin docs:
[docs/plugin-sdk.md](https://github.com/remcoeijsackers/agent-control/blob/main/docs/plugin-sdk.md).

## License

MIT. The Craft apps are separate projects by [storytold](https://github.com/storytold), with their own licenses.
