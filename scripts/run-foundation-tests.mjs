import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const outputFile = join(tmpdir(), `meow-foundation-test-${process.pid}.mjs`);

try {
  await build({
    entryPoints: [fileURLToPath(new URL("./foundation-smoke-test.ts", import.meta.url))],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    outfile: outputFile,
    logLevel: "silent",
  });
  await import(`${pathToFileURL(outputFile).href}?run=${Date.now()}`);
} finally {
  await rm(outputFile, { force: true });
}
