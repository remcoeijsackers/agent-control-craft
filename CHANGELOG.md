# Changelog

## 1.1.0 (2026-10-25)

- Live mode finds the control port on the open app (the loopback port its process listens on), so there is no port to
  set: the five port settings are gone. It works however control was switched on: `--control`, the app's
  `*_CONTROL_PORT` variable or PhotoCraft's own preference.
- PhotoCraft stays headless when its control token is not under keys, instead of handing the agent a bridge the app
  refuses.

## 1.0.0 (2026-10-24)

- First version. Agents get the MCP servers of FilmCraft, PhotoCraft, LightCraft, EffectCraft and SoundCraft in every
  Claude run of a workspace where the plugin is on: confined to the task's folders where the app supports it, live in
  the open app when its control port answers, headless otherwise.
- `craft_status` (what the run has and how to work) and `craft_delivery_spec` (sizes, codecs and export calls for
  Instagram, TikTok, LinkedIn, YouTube, the web, print and podcasts).
- Craft Studio page: the apps with version, mode and confinement, the folders, and the recent runs that used them.
- Needs Agent Control with plugin MCP servers (permission `mcp`).
