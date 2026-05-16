import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
await mkdir(resolve(here, "public"), { recursive: true });

await build({
  entryPoints: [resolve(here, "src/entry.ts")],
  bundle: true,
  format: "iife",
  globalName: "TC",
  target: ["es2020"],
  outfile: resolve(here, "public/core.bundle.js"),
  sourcemap: true,
  logLevel: "info"
});
