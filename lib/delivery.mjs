// Delivery specs per target, with the export call per Craft app. Platforms change their limits now and then; these are
// safe values that every platform accepts, not the absolute maximum.

const film = (w, h, fps, extra = "") => `FilmCraft: command_run {"id":"file.exportMedia","params":{"path":"<output folder>/<name>.mp4","format":"h264","width":${w},"height":${h},"fps":${fps},"wait":true${extra}}}`;
const effect = (fmt = "h264", ext = "mp4") => `EffectCraft: command_run {"id":"renderQueue.add","params":{"comp":"<comp>","format":"${fmt}","output":"<output folder>/<name>.${ext}"}}, then command_run {"id":"renderQueue.render"}`;
const light = (longEdge, ext = "jpg") => `LightCraft: export {"path":"<output folder>/<name>.${ext}","longEdge":${longEdge}}`;
const photo = (ext = "jpg") => `PhotoCraft: doc_export {"path":"<output folder>/<name>.${ext}"} (format from the extension)`;
const preview = "Then render one preview PNG next to it (render_frame / render_preview) and look at it before you report.";

export const TARGETS = {
  "instagram-feed": {
    kind: "image or video", width: 1080, height: 1350, aspect: "4:5", fps: 30, codec: "H.264 + AAC, MP4", maxDurationSec: 60,
    notes: "4:5 portrait takes the most room in the feed; keep text inside the middle 1080×1080 because the grid crops to 1:1. Images: JPEG, sRGB.",
    how: [light(1350), photo(), film(1080, 1350, 30), effect(), preview],
  },
  "instagram-story": {
    kind: "image or video", width: 1080, height: 1920, aspect: "9:16", fps: 30, codec: "H.264 + AAC, MP4", maxDurationSec: 60,
    notes: "Keep text and faces out of the top 250 px and bottom 340 px (profile bar and reply field).",
    how: [photo(), film(1080, 1920, 30), effect(), preview],
  },
  "instagram-reel": {
    kind: "video", width: 1080, height: 1920, aspect: "9:16", fps: 30, codec: "H.264 + AAC 48 kHz, MP4", maxDurationSec: 180,
    notes: "Hook in the first 2 seconds. Burn in captions (many watch muted): file.exportMedia takes \"burnCaptions\":true. Safe zone as for stories; the caption bar covers the bottom fifth.",
    how: [film(1080, 1920, 30, ',"burnCaptions":true'), effect(), preview],
  },
  tiktok: {
    kind: "video", width: 1080, height: 1920, aspect: "9:16", fps: 30, codec: "H.264 + AAC, MP4", maxDurationSec: 600,
    notes: "Same safe zone as reels; the right edge holds the buttons, keep 120 px free there.",
    how: [film(1080, 1920, 30, ',"burnCaptions":true'), effect(), preview],
  },
  "linkedin-feed": {
    kind: "image", width: 1200, height: 1200, aspect: "1:1", notes: "1:1 or 4:5 (1080×1350) for a post; 1200×627 for a link preview. JPEG or PNG, sRGB, under 5 MB.",
    how: [light(1200), photo("jpg"), preview],
  },
  "linkedin-video": {
    kind: "video", width: 1920, height: 1080, aspect: "16:9 (or 1:1, 4:5)", fps: 30, codec: "H.264 + AAC, MP4", maxDurationSec: 600,
    notes: "Burn in captions; LinkedIn plays muted. Square (1080×1080) does better on mobile. Keep it under 5 GB.",
    how: [film(1920, 1080, 30, ',"burnCaptions":true'), effect(), preview],
  },
  youtube: {
    kind: "video", width: 3840, height: 2160, aspect: "16:9", fps: "as recorded (24, 25, 30, 50 or 60)", codec: "H.264 High + AAC, MP4 (or ProRes for a master)",
    notes: "1920×1080 is fine when the source is HD. Also make a 1280×720 JPEG thumbnail (under 2 MB) with PhotoCraft.",
    how: [`FilmCraft: command_run {"id":"file.exportMedia","params":{"path":"<output folder>/<name>.mp4","preset":"YouTube 2160p 4K Ultra HD","wait":true}} (or "YouTube 1080p Full HD" for an HD source)`, effect(), photo("jpg") + " for the thumbnail, 1280×720", preview],
  },
  "youtube-short": {
    kind: "video", width: 1080, height: 1920, aspect: "9:16", fps: 30, codec: "H.264 + AAC, MP4", maxDurationSec: 180,
    notes: "Vertical or square; loops well when the end leads back into the start.",
    how: [film(1080, 1920, 30), effect(), preview],
  },
  "web-hero": {
    kind: "video (muted loop) + poster image", width: 1920, height: 1080, aspect: "16:9", fps: 25, codec: "H.264, MP4, no audio track; plus WebM VP9", maxDurationSec: 20,
    notes: "Aim for under 8 MB: \"bitrateKbps\":3000 and \"audio\":false. Make a WebP poster of the first frame for slow connections.",
    how: [film(1920, 1080, 25, ',"bitrateKbps":3000,"audio":false'), effect("webm", "webm"), light(1920, "webp") + " or " + photo("webp") + " for the poster", preview],
  },
  "web-image": {
    kind: "image", width: 2400, aspect: "free", codec: "WebP (or AVIF), sRGB",
    notes: "Long edge 2400 px covers retina screens; also make a 1200 px version for thumbnails. Strip location metadata.",
    how: [light(2400, "webp") + " (add \"metadata\":\"none\" to strip metadata)", photo("webp"), preview],
  },
  "print-a4": {
    kind: "image", width: 2480, height: 3508, aspect: "1:√2 (210×297 mm)", codec: "TIFF 16-bit (or JPEG at quality 100), 300 ppi",
    notes: "Add 3 mm bleed on every side when it goes to a printer (2551×3579 px). Stay in sRGB unless the printer asks for CMYK.",
    how: [light(3508, "tif") + ' with "ppi":300', photo("tif"), preview],
  },
  podcast: {
    kind: "audio", codec: "master WAV 48 kHz / 24-bit, plus MP3 or AAC 128-192 kbps",
    notes: "Loudness -16 LUFS for stereo (-19 for mono), true peak at most -1 dBTP. Keep the WAV master in the results too.",
    how: ['SoundCraft: bounce_mix {"path":"<output folder>/<name>.wav"}', 'FilmCraft (audio of an edit): command_run {"id":"file.exportMedia","params":{"path":"<output folder>/<name>.m4a","format":"aac","loudnessLufs":-16,"wait":true}}'],
  },
};

export function deliverySpec(target) {
  if (!target) return { targets: Object.keys(TARGETS), note: "Call again with one target." };
  const key = String(target).trim().toLowerCase().replace(/[\s_]+/g, "-");
  const spec = TARGETS[key];
  if (!spec) return { error: `Unknown target "${target}"`, targets: Object.keys(TARGETS) };
  return { target: key, ...spec, check: "Platforms change their limits; when it matters, check the platform's current help page." };
}
