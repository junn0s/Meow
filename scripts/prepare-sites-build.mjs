import { copyFile, mkdir, writeFile } from "node:fs/promises";

const workerSource = `const worker = {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};

export default worker;
`;

await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await writeFile("dist/server/index.js", workerSource, "utf8");
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
