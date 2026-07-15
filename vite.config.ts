import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "./" : "/",
  build: {
    target: "es2022",
    outDir: "dist/client",
    assetsDir: "assets",
    sourcemap: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
}));
