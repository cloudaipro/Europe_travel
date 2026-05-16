// esbuild → www/ios.bundle.js (IIFE). Runs after copy-web.mjs has staged
// the web SPA into www/, so the bundle lands alongside index.html and
// gets picked up by Capacitor's `cap sync`.
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
await mkdir(resolve(here, "www"), { recursive: true });

await build({
  entryPoints: [resolve(here, "src/runtime/entry.ts")],
  bundle: true,
  format: "iife",
  globalName: "TCIOS",
  target: ["es2020"],
  platform: "browser",
  outfile: resolve(here, "www/ios.bundle.js"),
  sourcemap: false,
  logLevel: "info",
});
