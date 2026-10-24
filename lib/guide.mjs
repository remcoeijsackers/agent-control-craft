// How an agent should work with the Craft apps so its results reach the user. Returned by craft_status.
export const GUIDE = [
  "Every Craft app is its own MCP server in this run: mcp__craft-film__ (FilmCraft), mcp__craft-photo__ (PhotoCraft), mcp__craft-light__ (LightCraft), mcp__craft-effect__ (EffectCraft), mcp__craft-sound__ (SoundCraft). Only the ones listed under apps with available: true are there.",
  "Discover before you act: command_list (or list_commands) shows every command id with its parameters; command_run runs one, command_batch several (LightCraft: run_command). Inspect with doc_inspect.",
  "Save into the task's output folder only: both the project (.fcproj, .pcraft, .ecproj, the SoundCraft session) and every export. Everything there appears under Results when the run ends.",
  "Previews, caches and temporary renders belong in the scratch folder, not in the output folder. FilmCraft: right after you create or open a project, run command_run {\"id\":\"file.projectSettings.scratchDisks\",\"params\":{\"videoPreviews\":\"<scratch folder>\",\"audioPreviews\":\"<scratch folder>\",\"autoSave\":\"<scratch folder>\"}}.",
  "Never overwrite a source file: open it, edit, and save or export under a new name in the output folder.",
  "After every export, render one preview PNG next to it (render_frame / render_preview / render_photo) and look at it before you report. Name what you made and where in your final report.",
  "For a platform, call craft_delivery_spec first and use its frame size, fps, codec and duration.",
  "If an export reports offline or missing media, say which files are missing in your report. Do not accept placeholder frames on your own.",
  "If a Craft server stops answering, reopen the project you saved in the output folder and continue; save after every larger step so little is lost.",
  "Live mode: you work in the user's open app window, so they can watch. Do not close their documents, do not quit the app, and save your work under a new name.",
  "Apps marked confined: false can read and write anywhere on this Mac. Stay inside the output folder and the media folders all the same.",
];
