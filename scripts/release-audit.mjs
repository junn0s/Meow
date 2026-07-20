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
assert.match(read("scripts/generate-pwa-worker.mjs"), /!request\.headers\.has\("range"\)/u, "partial audio responses must bypass runtime caching");
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
assert.match(html, /data-touch-joystick/u, "mobile movement must use the drag joystick");
assert.match(html, /data-touch-command="action"/u);
assert.match(html, /user-scalable=no/u, "mobile browser zoom must be disabled for the game shell");
const touchControls = read("src/game/input/TouchControls.ts");
assert.match(touchControls, /pointercancel/u, "touch cancellation must release movement");
assert.match(touchControls, /visibilitychange/u, "hidden tabs must reset held directions");
assert.match(touchControls, /selectstart/u, "native text selection must be blocked on controls");
assert.match(touchControls, /dblclick/u, "double taps must not open native selection UI");
assert.match(touchControls, /getJoystickDirections/u, "drag movement must resolve joystick directions");
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
assert.match(performanceSystem, /automationUpdateIntervalMs/u, "worker dispatch must run on a throttled simulation tick");
assert.match(performanceSystem, /customerUiUpdateIntervalMs/u, "customer UI rendering must be throttled");
assert.match(performanceSystem, /reflectionsEnabled: false/u, "battery mode must disable reflections");
assert.match(atmosphere, /atmosphereUpdateIntervalMs/u, "atmosphere updates must be throttled by profile");
assert.match(main, /"low-power"/u, "touch devices must request a low-power GPU profile");
const gameScene = read("src/game/scenes/GameScene.ts");
const chapterData = read("src/game/data/chapterData.ts");
for (const venue of ["달빛 야식당", "선셋 칵테일 바", "고양이 한식당", "별빛 레스토랑", "달빛 오마카세"]) {
  assert.match(chapterData, new RegExp(venue, "u"), `missing chapter venue: ${venue}`);
}
assert.match(read("src/game/systems/ProgressionSystem.ts"), /advanceChapter/u, "chapter completion must open the next restaurant");
assert.match(read("src/game/systems/SaveSystem.ts"), /SAVE_DATA_VERSION = 5/u, "chapter progress requires save data v5");
assert.match(read("src/game/art/PixelArtFactory.ts"), /station-chapter-/u, "each chapter needs themed worktop textures");
assert.match(read("src/game/data/visualData.ts"), /CHAPTER_VISUAL_PALETTES/u, "each chapter needs its own map palette");
assert.match(read("src/game/art/PixelArtFactory.ts"), /drawSundaeStation/u, "sundae needs its own worktop art");
assert.doesNotMatch(read("src/game/data/menuData.ts"), /붕어빵/u, "the retired fish-bread name must not appear in live menu data");
const releaseServerBody = gameScene.match(/private releaseServer\([\s\S]*?\n  \}\n\n  private configureDebugApi/u)?.[0] ?? "";
assert.match(gameScene, /paymentPool/u, "payment sprites must be pooled instead of recreated");
assert.match(gameScene, /startPlayerCooking/u, "the owner must be able to start cooking at a worktop");
assert.match(gameScene, /cookingAgent: automated \? "chef" : "player"/u, "manual orders must wait for direct player cooking");
assert.match(gameScene, /assignChefToWaitingCooking/u, "idle chefs must claim queued parallel-cooking tickets");
assert.match(read("src/game/entities/CookingStation.ts"), /hasPendingPlayerTicket/u, "worktops must expose player-owned cooking tickets");
assert.match(read("src/game/entities/CookingStation.ts"), /조리×/u, "parallel cooking must be visible on each worktop");
assert.doesNotMatch(
  read("src/game/entities/CookingStation.ts"),
  /P\$\{priceLevel\}|S\$\{speedLevel\}|C\$\{cookingSlotCount\}/u,
  "internal P/S/C levels must not be shown below menu prices",
);
assert.match(gameScene, /calculateCharacterTravelDurationMs/u, "workers must share the owner's movement-speed calculation");
assert.doesNotMatch(releaseServerBody, /homeX|homeY/u, "servers must stay where service finishes instead of lining up at home");
assert.doesNotMatch(read("src/game/entities/Player.ts"), /new Phaser\.Math\.Vector2/u, "player input must not allocate vectors every frame");
assert.match(read("src/game/systems/ProgressionSystem.ts"), /NO_FEVER_TRANSITION/u, "idle fever updates must avoid state allocations");
assert.match(read("src/game/scenes/GameScene.ts"), /지금 저장/u, "the pause menu must expose manual save");
assert.match(gameScene, /private beginLiveShop/u, "opening the shop must use a live simulation overlay");
assert.match(gameScene, /beginLiveShop\(\)[\s\S]*?setMusicPaused\(false\)/u, "shop music must keep playing");
const playerSource = read("src/game/entities/Player.ts");
assert.match(playerSource, /getCustomizedPlayerTextureKey/u, "avatar cosmetics must be baked into movement textures");
assert.doesNotMatch(playerSource, /avatarGraphics/u, "avatar cosmetics must not follow the player as a delayed overlay");
assert.match(read("src/game/art/SceneDecor.ts"), /facilityObjects/u, "purchased facilities need dedicated placed objects");
assert.match(read("src/game/art/PixelArtFactory.ts"), /createFacilityTextures/u, "facility products need actual pixel-art textures");
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
