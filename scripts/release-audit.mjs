import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const hosting = JSON.parse(read(".openai/hosting.json"));
const manifest = JSON.parse(read("public/manifest.webmanifest"));
assert.match(hosting.project_id ?? "", /^appgprj_/u, "Sites project id is required");
assert.equal(hosting.d1, null);
assert.equal(hosting.r2, null);
assert.ok(existsSync(new URL("dist/client/index.html", root)), "production client build is missing");
assert.ok(existsSync(new URL("dist/client/manifest.webmanifest", root)), "PWA manifest is missing");
assert.ok(existsSync(new URL("dist/client/sw.js", root)), "generated service worker is missing");
assert.ok(existsSync(new URL("dist/client/icons/icon-192.png", root)), "192px PWA icon is missing");
assert.ok(existsSync(new URL("dist/client/icons/icon-512.png", root)), "512px PWA icon is missing");
assert.equal(manifest.display, "standalone", "PWA must launch without browser chrome");
assert.equal(manifest.start_url, "./", "PWA start URL must remain compatible with GitHub Pages subpaths");
assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
assert.ok(existsSync(new URL("dist/server/index.js", root)), "Sites worker build is missing");
assert.ok(existsSync(new URL("dist/.openai/hosting.json", root)), "staged hosting metadata is missing");

const atmosphere = read("src/game/art/AtmosphereSystem.ts");
assert.match(atmosphere, /MAX_DYNAMIC_LIGHTS = 24/u);
assert.match(atmosphere, /MAX_ATMOSPHERE_PARTICLES = 60/u);
const styles = read("src/styles.css");
assert.match(styles, /prefers-reduced-motion: reduce/u);
assert.match(styles, /min-width: 52px/u, "mobile touch targets must be at least 52px");
assert.match(styles, /calc\(\(100dvh - 82px\) \* 16 \/ 9\)/u, "landscape controls must reserve space outside the game canvas");
assert.match(styles, /-webkit-touch-callout: none/u, "iOS touch callouts must be disabled");
assert.match(styles, /-webkit-user-select: none/u, "mobile controls must not select text");
const html = read("index.html");
assert.match(html, /rel="manifest"/u, "the PWA manifest must be linked from the app shell");
assert.match(html, /rel="apple-touch-icon"/u, "iOS must receive a dedicated home-screen icon");
assert.match(html, /aria-live="polite"/u);
assert.match(html, /aria-label="모바일 게임 조작"/u);
assert.match(html, /data-touch-direction="up"/u);
assert.match(html, /data-touch-command="action"/u);
const touchControls = read("src/game/input/TouchControls.ts");
assert.match(touchControls, /pointercancel/u, "touch cancellation must release movement");
assert.match(touchControls, /visibilitychange/u, "hidden tabs must reset held directions");
assert.match(touchControls, /selectstart/u, "native text selection must be blocked on controls");
assert.match(touchControls, /dblclick/u, "double taps must not open native selection UI");
const main = read("src/main.ts");
assert.match(main, /registerServiceWorker/u, "production builds must register the offline worker");
assert.doesNotMatch(main, /new KeyboardEvent/u, "touch must not rely on synthetic keyboard events");
assert.match(main, /pagehide/u, "mobile page exits must request an immediate save");
assert.match(main, /document\.visibilityState === "hidden"/u, "backgrounding the app must request a save");
assert.match(main, /game\.loop\.sleep/u, "hidden tabs must stop the Phaser loop");
assert.match(main, /game\.loop\.wake/u, "visible tabs must resume the Phaser loop");
assert.match(main, /limit: 30/u, "touch devices must cap the game loop at 30 FPS");
assert.match(main, /limit: 60/u, "desktop loop must allow runtime performance limits");
const performanceSystem = read("src/game/systems/PerformanceSystem.ts");
assert.match(performanceSystem, /targetFps: 24/u, "battery mode must cap gameplay at 24 FPS");
assert.match(performanceSystem, /reflectionsEnabled: false/u, "battery mode must disable reflections");
assert.match(atmosphere, /atmosphereUpdateIntervalMs/u, "atmosphere updates must be throttled by profile");
assert.match(main, /"low-power"/u, "touch devices must request a low-power GPU profile");
assert.match(read("src/game/scenes/GameScene.ts"), /지금 저장/u, "the pause menu must expose manual save");
const soundManager = read("src/game/audio/SoundManager.ts");
assert.match(soundManager, /setMenuMusic/u, "menu music must be supported");
assert.match(soundManager, /toggleMusicMute/u, "music must have an independent mute control");
assert.match(soundManager, /toggleSfxMute/u, "sound effects must have an independent mute control");
assert.match(soundManager, /startFeverLayer/u, "fever must add a synchronized music layer");
assert.match(soundManager, /context\.suspend/u, "background audio must suspend its Web Audio context");
assert.match(read("src/game/data/musicSchedule.ts"), /MUSIC_PHASE_SLOTS/u, "music-driven world schedule is required");
for (const track of ["menu", "day-1", "day-2", "sunset-1", "sunset-2", "night-1", "night-2", "night-3", "dawn-1", "dawn-2"]) {
  assert.ok(existsSync(new URL(`public/audio/${track}.opus`, root)), `missing optimized music track: ${track}`);
}

assert.ok(contrastRatio("#d9f5ff", "#11162c") >= 4.5, "HUD text contrast is below 4.5:1");
assert.ok(contrastRatio("#45ffd2", "#2e3855") >= 3, "fever indicator contrast is below 3:1");
assert.ok(contrastRatio("#ffe4a3", "#11162c") >= 4.5, "title contrast is below 4.5:1");

for (const file of ["README.md", "docs/game-description.md", "docs/ai-usage-report.md", "docs/30-stage-economy-balance-design.md"]) {
  assert.ok(read(file).length > 500, `${file} is incomplete`);
}

process.stdout.write("Release audit: PASS (hosting build, accessibility, motion, render caps, documents)\n");

function contrastRatio(foreground, background) {
  const brighter = relativeLuminance(foreground);
  const darker = relativeLuminance(background);
  return (Math.max(brighter, darker) + 0.05) / (Math.min(brighter, darker) + 0.05);
}

function relativeLuminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/giu).map((channel) => Number.parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}
