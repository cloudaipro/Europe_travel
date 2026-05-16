// copy-web.mjs — copies packages/web/public/* -> packages/ios/www/
// Pure Node 20+. No extra deps. Excludes core.bundle.js.map. After copy,
// injects <script src="/ios.bundle.js"></script> before </body> in the
// staged www/index.html so the iOS runtime shim loads after the web SPA.
// The web build is never modified — only the iOS www/ copy.
import { cp, mkdir, rm, readdir, stat, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "..", "web", "public");
const DEST = resolve(__dirname, "www");
const EXCLUDE = new Set(["core.bundle.js.map"]);
const IOS_SCRIPT_TAG = `<script src="/ios.bundle.js"></script>`;

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

  // Inject the iOS bundle <script> tag before </body>. Idempotent — the
  // www/ dir is wiped each run, but guard anyway in case anyone re-runs
  // this script without the rm step.
  const indexPath = join(DEST, "index.html");
  if (existsSync(indexPath)) {
    const html = await readFile(indexPath, "utf8");
    if (html.includes(IOS_SCRIPT_TAG)) {
      console.log(`[copy-web] ios.bundle.js script tag already present`);
    } else if (!html.includes("</body>")) {
      console.error(`[copy-web] no </body> found in index.html — cannot inject ios bundle`);
      process.exit(1);
    } else {
      const patched = html.replace("</body>", `  ${IOS_SCRIPT_TAG}\n</body>`);
      await writeFile(indexPath, patched, "utf8");
      console.log(`[copy-web] injected ios.bundle.js <script> before </body>`);
    }
  }
}

main().catch((err) => {
  console.error("[copy-web] failed:", err);
  process.exit(1);
});
