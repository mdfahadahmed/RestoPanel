/**
 * Run every scripts/test-*.ts suite sequentially and aggregate the result.
 * Exits non-zero if any suite fails. Run: npm test
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

/**
 * Load .env into a plain object. Plain `tsx script.ts` does not read .env the way
 * the Next.js and Prisma CLIs do, so without this every suite dies on
 * "Environment variable not found: DATABASE_URL". Real process env wins, so
 * `DATABASE_URL=… npm test` still overrides the file.
 */
function envFromFile(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    out[key] = value.replace(/^(['"])([\s\S]*)\1$/, "$2");
  }
  return out;
}

const dir = join(process.cwd(), "scripts");
const suites = readdirSync(dir)
  .filter((f) => /^test-.*\.ts$/.test(f))
  .sort();

const env = { ...envFromFile(join(process.cwd(), ".env")), ...process.env };

let failures = 0;
const failed: string[] = [];
for (const suite of suites) {
  console.log(`\n══════════════════════════════════════\nRUN: scripts/${suite}\n══════════════════════════════════════`);
  const res = spawnSync("npx", ["tsx", join("scripts", suite)], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env,
  });
  if (res.status !== 0) {
    failures++;
    failed.push(suite);
  }
}

console.log(`\n══════════════════════════════════════`);
console.log(`SUITES: ${suites.length}  FAILED: ${failures}`);
if (failed.length) console.log(`FAILING: ${failed.join(", ")}`);
process.exit(failures > 0 ? 1 : 0);
