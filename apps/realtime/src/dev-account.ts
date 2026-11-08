/** Dev seeds for local Better Auth accounts (shared by tests and scripts/auth-bootstrap.mjs). */

export interface DevAuthAccount {
  userId: string;
  accountId: string;
  username: string;
  email: string;
  name: string;
  password: string;
}

export const DEV_AUTH_ACCOUNT = {
  /** Stable Better Auth user id; repeated seeds reuse it. */
  userId: "seed_atlas",
  accountId: "seed_atlas_credential",
  /** Sign-in shortcut accepted by the play client. */
  username: "atlas",
  email: "atlas@local.test",
  name: "atlas",
  password: "1234",
} as const satisfies DevAuthAccount;

/** Every account the local bootstrap seeds. */
export const DEV_AUTH_ACCOUNTS: readonly DevAuthAccount[] = [
  DEV_AUTH_ACCOUNT,
  {
    userId: "seed_cloudanarchy",
    accountId: "seed_cloudanarchy_credential",
    username: "cloudanarchy",
    email: "cloudanarchy@local.test",
    name: "cloudanarchy",
    password: "1234",
  },
];

export interface DevAuthSeedInput {
  /** Output of `hashPassword()` from `better-auth/crypto`. */
  passwordHash: string;
  /** ISO-8601 timestamp used for createdAt/updatedAt (Better Auth stores dates as TEXT on D1). */
  now: string;
}

function sqlValue(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/**
 * Idempotent SQL for the development account. The user insert is a no-op when the email already
 * exists; the credential account insert only runs when that user has no credential account yet.
 * Running the statements twice therefore keeps one user, one account and the original password.
 */
export function buildDevAuthSeedStatements(
  input: DevAuthSeedInput,
  account: DevAuthAccount = DEV_AUTH_ACCOUNT,
): string[] {
  const { userId, accountId, email, name } = account;
  return [
    `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
VALUES (${sqlValue(userId)}, ${sqlValue(name)}, ${sqlValue(email)}, 1, ${sqlValue(input.now)}, ${sqlValue(input.now)})
ON CONFLICT(email) DO NOTHING;`,
    `INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt)
SELECT ${sqlValue(accountId)}, u.id, 'credential', u.id, ${sqlValue(input.passwordHash)}, ${sqlValue(input.now)}, ${sqlValue(input.now)}
FROM "user" u
WHERE u.email = ${sqlValue(email)}
  AND NOT EXISTS (
    SELECT 1 FROM account a WHERE a.userId = u.id AND a.providerId = 'credential'
  );`,
  ];
}
