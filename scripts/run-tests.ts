/**
 * Run every scripts/test-*.ts suite sequentially and aggregate the result.
 * Exits non-zero if any suite fails. Run: npm test
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const dir = join(process.cwd(), "scripts");
const suites = readdirSync(dir)
  .filter((f) => /^test-.*\.ts$/.test(f))
  .sort();

let failures = 0;
for (const suite of suites) {
  console.log(`\n══════════════════════════════════════\nRUN: scripts/${suite}\n══════════════════════════════════════`);
  const res = spawnSync("npx", ["tsx", join("scripts", suite)], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (res.status !== 0) failures++;
}

console.log(`\n══════════════════════════════════════`);
console.log(`SUITES: ${suites.length}  FAILED: ${failures}`);
process.exit(failures > 0 ? 1 : 0);
