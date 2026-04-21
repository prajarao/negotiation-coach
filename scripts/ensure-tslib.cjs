/**
 * Ensures `tslib` is on disk and resolvable from the repo root.
 *
 * Several stacks (`@supabase/*`, `@clerk/*` → `snake-case`) require `tslib`.
 * Some npm installs omit the hoisted `node_modules/tslib` folder; this script
 * repairs that.
 *
 * Runs automatically on `postinstall`. You can also run:
 *
 *   npm run fix:tslib
 *
 * Last resort (PowerShell):
 *
 *   Remove-Item -Recurse -Force node_modules
 *   Remove-Item -Force package-lock.json
 *   npm install
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const tslibDir = path.join(root, "node_modules", "tslib");

function canResolveTslib() {
  try {
    require.resolve("tslib", { paths: [root] });
    return true;
  } catch {
    return false;
  }
}

function installViaNpm() {
  execSync("npm install tslib@2.8.1 --save --no-audit --no-fund --ignore-scripts", {
    cwd: root,
    stdio: "inherit",
  });
}

/**
 * Last resort: fetch the published tarball and extract to node_modules/tslib.
 * Works when `npm install` claims success but never materializes the folder.
 */
function installViaNpmPack() {
  fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
  console.warn("[ensure-tslib] Trying npm pack tslib@2.8.1 …");
  const out = execSync("npm pack tslib@2.8.1 --silent", {
    cwd: root,
    encoding: "utf8",
  });
  const tgzName = out
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .pop();
  if (!tgzName || !tgzName.endsWith(".tgz")) {
    throw new Error(`npm pack: unexpected output: ${JSON.stringify(out)}`);
  }
  const tgzPath = path.join(root, tgzName);
  if (!fs.existsSync(tgzPath)) {
    throw new Error(`npm pack: missing file ${tgzPath}`);
  }
  const tmp = path.join(root, ".tslib-pack-tmp");
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  try {
    execSync(`tar -xzf "${tgzPath}"`, { cwd: tmp, stdio: "inherit" });
  } finally {
    try {
      fs.unlinkSync(tgzPath);
    } catch {
      /* ignore */
    }
  }
  const extracted = path.join(tmp, "package");
  if (!fs.existsSync(path.join(extracted, "package.json"))) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error("npm pack extract: expected package/ folder");
  }
  fs.rmSync(tslibDir, { recursive: true, force: true });
  fs.renameSync(extracted, tslibDir);
  fs.rmSync(tmp, { recursive: true, force: true });
}

function main() {
  if (canResolveTslib()) {
    return;
  }

  console.warn("[ensure-tslib] tslib not resolvable — running npm install tslib …");
  try {
    installViaNpm();
  } catch (e) {
    console.warn("[ensure-tslib] npm install failed:", e?.message || e);
  }

  if (canResolveTslib()) {
    console.log("[ensure-tslib] tslib OK");
    return;
  }

  console.warn("[ensure-tslib] Still not resolvable — trying npm pack fallback …");
  try {
    installViaNpmPack();
  } catch (e) {
    console.error("[ensure-tslib] npm pack fallback failed:", e?.message || e);
    console.error(`
[ensure-tslib] Do a clean install:

  cd "${root}"
  Remove-Item -Recurse -Force node_modules
  Remove-Item -Force package-lock.json
  npm install
`);
    process.exit(process.env.npm_lifecycle_event === "postinstall" ? 0 : 1);
    return;
  }

  if (!canResolveTslib()) {
    console.error("[ensure-tslib] tslib still not resolvable after npm pack.");
    process.exit(process.env.npm_lifecycle_event === "postinstall" ? 0 : 1);
    return;
  }
  console.log("[ensure-tslib] tslib OK (via npm pack)");
}

main();
