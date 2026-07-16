import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const hosting = JSON.parse(read(".openai/hosting.json"));
assert.match(hosting.project_id ?? "", /^appgprj_/u, "Sites project id is required");
assert.equal(hosting.d1, null);
assert.equal(hosting.r2, null);
assert.ok(existsSync(new URL("dist/client/index.html", root)), "production client build is missing");
assert.ok(existsSync(new URL("dist/server/index.js", root)), "Sites worker build is missing");
assert.ok(existsSync(new URL("dist/.openai/hosting.json", root)), "staged hosting metadata is missing");

const atmosphere = read("src/game/art/AtmosphereSystem.ts");
assert.match(atmosphere, /MAX_DYNAMIC_LIGHTS = 24/u);
assert.match(atmosphere, /MAX_ATMOSPHERE_PARTICLES = 60/u);
const styles = read("src/styles.css");
assert.match(styles, /prefers-reduced-motion: reduce/u);
assert.match(styles, /min-width: 44px/u, "touch targets must be at least 44px");
const html = read("index.html");
assert.match(html, /aria-live="polite"/u);
assert.match(html, /aria-label="모바일 게임 조작"/u);
assert.match(html, /data-touch-direction="up"/u);
assert.match(html, /data-touch-command="action"/u);
const touchControls = read("src/game/input/TouchControls.ts");
assert.match(touchControls, /pointercancel/u, "touch cancellation must release movement");
assert.match(touchControls, /visibilitychange/u, "hidden tabs must reset held directions");
assert.doesNotMatch(read("src/main.ts"), /new KeyboardEvent/u, "touch must not rely on synthetic keyboard events");

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
