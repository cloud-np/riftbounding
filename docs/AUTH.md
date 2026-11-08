# Authentication (`@cloud-np/auth` + Better Auth)

This repo uses the product owner's `@cloud-np/auth` package for real accounts. Guest play
(`POST /api/auth/token` → HS256 JWT) still exists and is unchanged. Both token kinds are accepted
everywhere the realtime worker checks identity.

## What `@cloud-np/auth` is

`@cloud-np/auth` is the shared Better Auth configuration for the site fleet (Better Auth
**1.6.33**). It exports:

- `createCloudAuth(options)` from `@cloud-np/auth` — builds a Better Auth instance with the fleet's
  plugin set (`admin`, `bearer`, `twoFactor`, `emailOTP`) and email/password auth. The package
  enables `requireEmailVerification` and a sign-up password minimum of 8 characters.
- `createCloudAuthClient(baseURL)` from `@cloud-np/auth/client` — the matching browser client.

The package is vendored in this repo at [`packages/auth`](../packages/auth) because the published
package lives in the private GitHub Packages registry and the sibling `../core` checkout is
read-only for this task. `packages/auth/SOURCE.md` records the exact source path and the
`../core` commit (`8bc0317cc916704a403dd4a7beebfab4518946b8`), plus the one type-only compile fix.

## Mezenta files followed

The product owner's reference integration is the `mezenta` repo:

| Concern                                                                  | Mezenta file                                                                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Better Auth server factory, D1/Drizzle adapter, plugins, trusted origins | `apps/mezenta/src/server/auth/index.ts`                                                                  |
| Better Auth tables and columns                                           | `apps/mezenta/src/server/platform/schema.ts` (`user`, `session`, `account`, `verification`, `twoFactor`) |
| HTTP mount (`/api/auth/[...all]`)                                        | `apps/mezenta/src/pages/api/auth/[...all].ts`                                                            |
| D1 binding / worker config                                               | `apps/mezenta/wrangler.jsonc` (`DB_PLATFORM`)                                                            |
| Schema apply                                                             | `apps/mezenta/scripts/db-push.mjs` + `scripts/lib/d1.mjs`                                                |
| Dev account bootstrap                                                    | `apps/mezenta/scripts/auth-bootstrap.mjs`                                                                |
| Package reference                                                        | `apps/mezenta/package.json` (`@cloud-np/auth`, `better-auth`)                                            |

Mezenta depends on the published `@cloud-np/auth@^0.1.8` and overlays `../core` during local dev
with `scripts/core-link.mjs`. Since that registry is private and `../core` is read-only here, this
repo vendors the same `0.1.8` source as the workspace package `@cloud-np/auth` and consumes it as
`workspace:*`. The runtime shape is identical.

## Integration approach

- **Where Better Auth runs:** inside `apps/realtime` (the Cloudflare Worker that already serves the
  room API), exactly like mezenta hosts it inside its Worker. No sidecar process is needed, and
  `pnpm dev` / `pnpm --filter realtime dev` start everything.
- **Database:** Cloudflare D1 binding `AUTH_DB`, database name `riftbound-auth`. Better Auth's
  Kysely adapter auto-detects the D1 binding (`D1SqliteDialect`) when you pass
  `database: env.AUTH_DB`; all requests use `transaction: false` semantics because D1 has no
  interactive transactions. The schema is in
  [`apps/realtime/migrations/0001_better_auth.sql`](../apps/realtime/migrations/0001_better_auth.sql)
  and mirrors mezenta's tables/columns with SQLite/TEXT date columns.
- **HTTP routes:** `POST /api/auth/token` remains the guest endpoint. Every other `/api/auth/*`
  request is handled by `auth.handler` in `apps/realtime/src/auth-server.ts`
  (`POST /api/auth/sign-in/email`, `GET /api/auth/get-session`, `POST /api/auth/sign-out`, …).
- **Identity verification:** `verifyRealtimeAuthToken` first checks the guest HS256 JWT, then
  treats the token as a Better Auth session token and calls
  `auth.api.getSession({ headers: { authorization: "Bearer …" } })` (the package enables the
  bearer plugin). This single verifier is injected into:
  - room HTTP actions (`join_room`, `take_seat`, …) in `src/parties.ts`,
  - `coordinator` `create_room`,
  - `matchmaking` HTTP actions,
  - websocket `join_shell` / `join_game` / `resume_game` / `auth_refresh` (`verifyFor`).
    The verified Better Auth user id becomes the room's `authSubject` / `playerId`, so possession
    and resume checks keep working.
- **Client:** `apps/play/src/runtime/auth.ts` uses `createCloudAuthClient(authBase())`.
  `loginWithPassword("atlas", "1234")` maps the username shortcut to
  `atlas@local.test`, calls `client.signIn.email`, and persists the returned session token plus
  the display identity. The token is sent to the worker as `authToken` exactly like a guest JWT.
  The exported hook shape (`useIdentity`, `signIn`, `signOut`, `register`, `identity`,
  `hasToken`, `loading`, `error`) is unchanged. `AccountDialog` still offers "Continue as guest".
- **Accounts are email/password.** Any identifier containing `@` is used as-is; a bare username
  becomes `<username>@local.test` for the local seed shortcut. Account creation is enabled
  (`disableSignUp: false`, open email policy via `authorizeEmail`), matching the original account
  dialog's **New to Rift Atlas? Create an account** path. Sign-up keeps the package's email
  verification requirement: development auto-verifies the new row after a successful sign-up (see
  below) so no mail delivery is needed; production sends the verification link through the
  configured email transport before the account can sign in.

## Environment variables

| variable                | default                          | used by  | meaning                                                                                              |
| ----------------------- | -------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `AUTH_DB`               | D1 binding in `wrangler.jsonc`   | realtime | Better Auth database (`riftbound-auth`)                                                              |
| `BETTER_AUTH_SECRET`    | dev fallback in `auth-server.ts` | realtime | Better Auth signing secret. **Required in production** (32+ random chars).                           |
| `BETTER_AUTH_URL`       | request origin + `/api/auth`     | realtime | Public auth base URL. Set to e.g. `https://realtime.example.com/api/auth` in production.             |
| `AUTH_TRUSTED_ORIGINS`  | localhost + Rift Atlas origins   | realtime | Comma-separated extra browser origins allowed by Better Auth/CORS.                                   |
| `ENVIRONMENT`           | `development` (`wrangler.jsonc`) | realtime | `production` turns off development auto-verification and requires a real email transport.             |
| `AUTH_EMAIL_WEBHOOK_URL` | —                               | realtime | Production mail transport: receives `{to,name,subject,html}` JSON POSTs (verification, password reset, OTP). |
| `AUTH_EMAIL_WEBHOOK_TOKEN` | —                             | realtime | Optional `Authorization: Bearer …` sent to the mail webhook.                                          |
| `AUTH_SECRET`           | dev fallback                     | realtime | Guest HS256 JWT secret. Set in production.                                                           |
| `NEXT_PUBLIC_AUTH_BASE` | realtime HTTP base               | play     | Browser auth base (`/api/auth/*`).                                                                   |

Better Auth rate-limits sign-in in memory per Worker isolate. The worker forwards
`cf-connecting-ip` as `x-forwarded-for` so clients do not all share one bucket.

Production uses the package's shipped limiter unchanged (Better Auth's default sign-in/sign-up rule
is 3 requests / 10 s / IP). In development (`ENVIRONMENT` not `production`) the worker adds the
`rift-dev-auth-rate-limit` plugin, which raises those same per-path buckets (sign-in/sign-up,
password/email changes, reset/OTP) to 100 / 10 s so e2e runs and account switching do not
spontaneously `429`. It does not disable the limiter or bypass storage; the plugin is absent in
production. See `DEV_AUTH_RATE_LIMIT` in `apps/realtime/src/auth-server.ts`.

## Local development

Requires Node 22+ (repo uses Node 26) and pnpm.

```bash
pnpm install
pnpm --filter realtime dev     # applies schema + seed, then wrangler dev on :1999
```

`pnpm --filter realtime dev` runs `scripts/auth-bootstrap.mjs` first. The script is idempotent:

1. applies `migrations/0001_better_auth.sql` and `migrations/0002_saved_decks.sql`
   (`CREATE ... IF NOT EXISTS`),
2. hashes the dev password with Better Auth's own hasher (`better-auth/crypto`),
3. writes the SQL to a temporary file (the password never appears in argv),
4. executes it with `wrangler d1 execute AUTH_DB --local`.

Run it manually at any time (also safe if the account already exists):

```bash
pnpm --filter realtime auth:bootstrap
```

To reset local auth data, delete the Worker's local D1 state (for example
`apps/realtime/.wrangler/state/v3/d1`) and re-run the command above. `WRANGLER_PERSIST_TO` is
honoured by the bootstrap script, matching mezenta's `scripts/lib/d1.mjs`.

Then start the client:

```bash
pnpm --filter play dev
```

Open the account dialog and sign in with:

- **username:** `atlas` (or the email `atlas@local.test`)
- **password:** `1234`

"Continue as guest" still works and stores a separate guest JWT. Signing in as `atlas` clears the
guest session; signing out clears the Better Auth session token and the local guest token.

**Create an account** works too. The dialog's footer opens the registration mode; enter any
username (mapped to `<username>@local.test`) or email plus a password of at least 8 characters.
In development the worker logs the verification email to the `wrangler dev` console and then marks
the new user verified automatically, so registration signs in immediately without a mail server.
The account is stored in the same D1 database as the seed.

The seed is dev-only. Better Auth's sign-up minimum password length (8) would reject `1234`, but
the bootstrap writes a **verified** credential row directly (same approach as mezenta's
`auth-bootstrap.mjs`, which inserts a hashed password with `better-auth/crypto`). Sign-in itself
does not enforce the sign-up length rule.

## Production notes

- Create a real D1 database and replace the placeholder `database_id` in
  `apps/realtime/wrangler.jsonc` (or override the binding in the deploy config). Apply
  `migrations/0001_better_auth.sql` and `migrations/0002_saved_decks.sql` with
  `wrangler d1 execute AUTH_DB --remote --file <migration>` (or
  `wrangler d1 migrations apply AUTH_DB --remote`).
- Set `BETTER_AUTH_SECRET`, `AUTH_SECRET`, `BETTER_AUTH_URL`, `AUTH_TRUSTED_ORIGINS` and
  `ENVIRONMENT=production` through secrets/vars. Do not commit production secrets.
- **Do not run `auth:bootstrap` against production.** It creates the `atlas` / `1234` development
  account. The script defaults to local D1; `--remote` exists only for parity with mezenta and
  must be used deliberately. If the account is ever created by mistake, delete the `user` row (the
  session/account rows cascade) and its sessions.
- Account creation is enabled. Development auto-verifies new users and only logs the email; set
  `ENVIRONMENT=production` for the real flow. Configure email delivery with
  `AUTH_EMAIL_WEBHOOK_URL` (and optionally `AUTH_EMAIL_WEBHOOK_TOKEN`): the worker POSTs
  `{to, name, subject, html}` JSON to that endpoint for verification, password-reset and OTP
  messages. Without a webhook, production sign-up fails with
  `Auth email delivery is not configured (AUTH_EMAIL_WEBHOOK_URL).` Wire the endpoint to a
  transactional provider (Resend/Postmark/SES/Cloudflare Email Workers) or replace the `sendEmail`
  callback in `apps/realtime/src/auth-server.ts`.
- New production users must click the verification link before sign-in. Existing users created by
  the development bootstrap are already verified.
- Session revocation is immediate because every room verification reads D1 (`getSession`). There
  is no cookie-cache window.
- CORS reflects localhost, Rift Atlas origins, and any origins listed in
  `AUTH_TRUSTED_ORIGINS`; browser clients send credentials (`include`), so use an exact origin
  rather than `*`.
