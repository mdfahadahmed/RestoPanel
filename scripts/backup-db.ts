/**
 * Logical PostgreSQL backup. Runs `pg_dump` against DATABASE_URL and writes a
 * timestamped, gzipped dump to ./backups (override with BACKUP_DIR).
 *
 * Designed for an external scheduler — a GitHub Action, a server cron, or a
 * worker invoked by the daily Vercel cron (`/api/cron/backup`) — since serverless
 * functions can't run pg_dump themselves.
 *
 * Run: npx tsx scripts/backup-db.ts
 */
import { spawn } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";
import { createGzip } from "node:zlib";
import path from "node:path";

/** Deterministic, sortable backup filename for a given moment. */
export function backupFilename(now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `restopanel-${stamp}.sql.gz`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const dir = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, backupFilename());

  console.log(`Backing up database → ${outPath}`);

  await new Promise<void>((resolve, reject) => {
    const dump = spawn("pg_dump", ["--no-owner", "--no-privileges", url], { stdio: ["ignore", "pipe", "inherit"] });
    const gzip = createGzip();
    const file = createWriteStream(outPath);

    dump.stdout.pipe(gzip).pipe(file);
    dump.on("error", (e) => reject(new Error(`pg_dump failed to start (is it installed?): ${e.message}`)));
    dump.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`pg_dump exited with code ${code}`))));
    file.on("error", reject);
  });

  console.log("Backup complete.");
}

// Only run when invoked directly (so the pure helper can be imported in tests).
if (process.argv[1] && process.argv[1].endsWith("backup-db.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
