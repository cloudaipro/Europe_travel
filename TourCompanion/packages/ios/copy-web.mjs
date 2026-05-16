// copy-web.mjs — copies packages/web/public/* -> packages/ios/www/
// Pure Node 20+. No extra deps. Excludes core.bundle.js.map.
import { cp, mkdir, rm, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "..", "web", "public");
const DEST = resolve(__dirname, "www");
const EXCLUDE = new Set(["core.bundle.js.map"]);

async function main() {
  if (!existsSync(SRC)) {
    console.error(`[copy-web] source missing: ${SRC}`);
    process.exit(1);
  }
  if (existsSync(DEST)) {
    await rm(DEST, { recursive: true, force: true });
  }
  await mkdir(DEST, { recursive: true });

  const entries = await readdir(SRC);
  let copied = 0;
  for (const name of entries) {
    if (EXCLUDE.has(name)) continue;
    const srcPath = join(SRC, name);
    const destPath = join(DEST, name);
    const st = await stat(srcPath);
    await cp(srcPath, destPath, { recursive: true, force: true });
    copied += st.isDirectory() ? 1 : 1;
  }
  console.log(`[copy-web] copied ${copied} top-level entries -> ${DEST}`);
}

main().catch((err) => {
  console.error("[copy-web] failed:", err);
  process.exit(1);
});
