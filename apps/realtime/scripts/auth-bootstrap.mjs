/**
 * Idempotent Better Auth bootstrap for local development.
 *
 * Adapted from the product owner's mezenta reference (apps/mezenta/scripts/auth-bootstrap.mjs):
 * apply the Better Auth schema, hash the password with Better Auth's own hasher, write the
 * parameterised SQL to a temporary file and execute it with `wrangler d1 execute`. The password
 * therefore never appears in a shell command line.
 *
 * The dev accounts are `atlas` / `1234` and `cloudanarchy` / `1234` (`<name>@local.test`). Better Auth's sign-up endpoint would
 * reject `1234` (minPasswordLength 8) and the account would be unverified, so the seed writes the
 * user directly with `emailVerified = 1`, exactly like mezenta's operator bootstrap. Sign-in
 * itself does not apply the sign-up length rule.
 *
 * Local only by default (the Worker's `AUTH_DB` D1 database). `--remote` exists for parity with
 * mezenta but must never be used against production: this account is a development fixture.
 *
 * Usage:
 *   pnpm --filter realtime auth:bootstrap
 *   node scripts/auth-bootstrap.mjs [--remote --config wrangler.production.jsonc]
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { hashPassword } from "better-auth/crypto";
import { DEV_AUTH_ACCOUNTS, buildDevAuthSeedStatements } from "../src/dev-account.ts";

const APP_ROOT = resolve(import.meta.dirname, "..");
process.chdir(APP_ROOT);

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const configIndex = args.indexOf("--config");
const config = configIndex === -1 ? undefined : args[configIndex + 1];
const valueFlags = [configIndex].filter((index) => index !== -1).map((index) => index + 1);
const unknown = args.filter((arg, index) => !arg.startsWith("--") && !valueFlags.includes(index));
if (unknown.length) throw new Error(`Unknown argument(s): ${unknown.join(" ")}`);

function runWrangler(wranglerArgs, { capture = false } = {}) {
  const finalArgs = [...wranglerArgs];
  if (!remote && process.env.WRANGLER_PERSIST_TO) {
    finalArgs.push("--persist-to", process.env.WRANGLER_PERSIST_TO);
  }
  if (config) finalArgs.push("--config", config);
  const result = spawnSync("pnpm", ["exec", "wrangler", ...finalArgs], {
    cwd: APP_ROOT,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`wrangler ${finalArgs.join(" ")} exited with code ${result.status}`);
  }
  return result.stdout ?? "";
}

/** Executes one SQL file against AUTH_DB (local D1 or the configured remote database). */
function executeFile(path) {
  runWrangler(["d1", "execute", "AUTH_DB", remote ? "--remote" : "--local", "--file", path]);
}

function queryUser(account) {
  const output = runWrangler(
    [
      "d1",
      "execute",
      "AUTH_DB",
      remote ? "--remote" : "--local",
      "--json",
      "--command",
      `SELECT u.id, u.email, a.id AS accountId FROM "user" u LEFT JOIN account a ON a.userId = u.id AND a.providerId = 'credential' WHERE u.email = '${account.email}' LIMIT 1`,
    ],
    { capture: true },
  );
  try {
    const parsed = JSON.parse(output);
    const batch = Array.isArray(parsed) ? parsed[0] : parsed;
    return batch?.results?.[0] ?? null;
  } catch {
    return null;
  }
}

// 1. Schema (CREATE TABLE/INDEX ... IF NOT EXISTS, safe to re-run). Saved decks share AUTH_DB.
executeFile("migrations/0001_better_auth.sql");
executeFile("migrations/0002_saved_decks.sql");

// 2. Seed. The hash is computed here so the plaintext password never reaches argv or a log.
for (const account of DEV_AUTH_ACCOUNTS) {
  const passwordHash = await hashPassword(account.password);
  const now = new Date().toISOString();
  const sql = [
    "-- Development seed for @cloud-np/auth; safe to delete.",
    ...buildDevAuthSeedStatements({ passwordHash, now }, account),
  ].join("\n");

  const dir = mkdtempSync(join(tmpdir(), "riftbound-auth-"));
  const file = join(dir, "seed.sql");
  try {
    writeFileSync(file, `${sql}\n`);
    const before = queryUser(account);
    executeFile(file);
    const after = queryUser(account);
    if (!after) throw new Error(`Seeding finished but ${account.email} was not found.`);
    console.log(
      `${before ? "Already seeded" : "Seeded"} ${account.username} (${account.email}) ` +
        `in ${remote ? "remote" : "local"} AUTH_DB; user id ${after.id}.`,
    );
    console.log(`Sign in with username "${account.username}" and password "${account.password}".`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
