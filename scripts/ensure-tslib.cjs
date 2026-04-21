/**
 * Fix: "Cannot find module 'tslib'" when loading @clerk/clerk-sdk-node
 *
 * `snake-case` (pulled in by @clerk/backend) depends on tslib. If npm's hoisted
 * install is incomplete, run from the repo root:
 *
 *   npm run fix:tslib
 *
 * If that still fails, do a clean install (Windows PowerShell):
 *
 *   Remove-Item -Recurse -Force node_modules
 *   Remove-Item -Force package-lock.json
 *   npm install
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const tslibPkg = path.join(root, "node_modules", "tslib", "package.json");

if (fs.existsSync(tslibPkg)) {
  console.log("tslib OK:", path.dirname(tslibPkg));
  process.exit(0);
}

console.warn("tslib missing — running: npm install tslib@2.8.1 …\n");
try {
  execSync("npm install tslib@2.8.1 --save --no-audit --no-fund", {
    cwd: root,
    stdio: "inherit",
  });
} catch (e) {
  console.error("\n[fix:tslib] npm install failed:", e?.message || e);
}

if (!fs.existsSync(tslibPkg)) {
  console.error(`
[fix:tslib] Still no node_modules/tslib. Do a clean install:

  cd "${root}"
  Remove-Item -Recurse -Force node_modules
  Remove-Item -Force package-lock.json
  npm install
`);
  process.exit(1);
}

console.log('\n[fix:tslib] Success. Verify with: node -e "require(\'tslib\')"');
process.exit(0);
