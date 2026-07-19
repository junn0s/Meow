import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const clientDirectory = "dist/client";
const files = await collectFiles(clientDirectory);
const coreFiles = files
  .filter((file) => !file.endsWith(".map"))
  .filter((file) => !file.startsWith("audio/") || file === "audio/menu.opus")
  .filter((file) => file !== "sw.js")
  .sort();

const versionHash = createHash("sha256");
versionHash.update("worker-schema-v3-instant-offline-shell");
for (const file of coreFiles) {
  versionHash.update(file);
  versionHash.update(await readFile(join(clientDirectory, file)));
}

const version = versionHash.digest("hex").slice(0, 12);
const workerSource = `const VERSION = ${JSON.stringify(version)};
const APP_CACHE = \`meow-night-diner-app-\${VERSION}\`;
const RUNTIME_CACHE = \`meow-night-diner-runtime-\${VERSION}\`;
const PRECACHE_PATHS = ${JSON.stringify(coreFiles.map((file) => `./${file}`), null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    const urls = PRECACHE_PATHS.map((path) => new URL(path, self.registration.scope).href);
    await cache.addAll(urls);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith("meow-night-diner-") && name !== APP_CACHE && name !== RUNTIME_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    const networkResponse = fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    });
    event.waitUntil(networkResponse.then(() => undefined).catch(() => undefined));
    event.respondWith((async () => {
      const cachedShell = await caches.match(
        new URL("./index.html", self.registration.scope).href,
        { ignoreVary: true },
      );
      return cachedShell ?? networkResponse.catch(() => Response.error());
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) {
      return cached;
    }
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
`;

await writeFile(join(clientDirectory, "sw.js"), workerSource, "utf8");
process.stdout.write(`Generated PWA worker ${version} with ${coreFiles.length} precached files\n`);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const collected = [];
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      collected.push(...await collectFiles(absolutePath));
      continue;
    }
    collected.push(relative(clientDirectory, absolutePath).split(sep).join("/"));
  }
  return collected;
}
