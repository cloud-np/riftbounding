# Riftbounding

An exact functional + visual clone of the Rift Atlas Riftbound TCG simulator
(`play.riftatlas.com`) plus its launcher page (`riftatlas.com/play`).

## Layout

| path                | package          | what                                                                                  |
| ------------------- | ---------------- | ------------------------------------------------------------------------------------- |
| `apps/play`         | `play`           | the simulator (Next.js 16 App Router, port 3000) — `/` lobby, `/game` board           |
| `apps/site`         | `site`           | marketing/launcher site with `/play` (Next.js 16, port 3001)                          |
| `apps/realtime`     | `realtime`       | realtime game server on Cloudflare Workers (`partyserver` Durable Objects, port 1999) |
| `packages/protocol` | `@rift/protocol` | wire / action / game-state types (verbatim from `.recon/specs/types`)                 |
| `packages/engine`   | `@rift/engine`   | pure-TS rules engine (authoritative server + optimistic client)                       |
| `packages/cards`    | `@rift/cards`    | card catalog + card helpers, deck text/code parsing + validation                      |
| `packages/i18n`     | `@rift/i18n`     | locales / message catalogues                                                          |
| `packages/sync`     | `@rift/sync`     | patch diff/apply, snapshots and per-viewer redaction                                  |

Reconnaissance artifacts live in `.recon/` — `specs/` and `reports/` are tracked, the large
scraped dumps (`site/`, `pretty/`, `browser/`) are gitignored. The build contract and
parallel-work rules are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Run

Requires Node >= 22 and pnpm 12 (`corepack enable`).

```bash
pnpm install
pnpm dev          # play :3000 + site :3001 + realtime :1999 in parallel
pnpm typecheck    # tsc --noEmit in every package
pnpm test         # vitest in every package that has tests
pnpm build        # production builds (Next.js apps, wrangler dry-run)
pnpm format       # prettier
```

Run the pieces separately when you need isolated logs:

```bash
pnpm --filter realtime dev                         # wrangler on http://localhost:1999
pnpm --filter play dev                             # Next.js on http://localhost:3000
pnpm --filter site dev                             # Next.js on http://localhost:3001
```

The play app talks to the realtime worker at `localhost:1999` by default. Creating a room,
joining, matchmaking, the game board and the account sign-in all need that worker running.

## Environment variables

| variable                                 | default             | used by  | meaning                                                                                     |
| ---------------------------------------- | ------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_REALTIME_HOST`              | `localhost:1999`    | play     | realtime host (HTTP + websocket); `ws` is chosen automatically for localhost/private ranges |
| `NEXT_PUBLIC_AUTH_BASE`                  | realtime HTTP base  | play     | base URL for `/api/auth/*` (guest + Better Auth account sessions)                            |
| `NEXT_PUBLIC_STATIC_ASSET_BASE`          | `/riftbound/static` | play     | static UI assets (sounds, board chrome, …)                                                  |
| `NEXT_PUBLIC_CARD_ASSET_BASE`            | Rift Atlas CDN      | play     | card image CDN base                                                                         |
| `AUTH_SECRET`                            | dev fallback        | realtime | HS256 signing secret for guest JWTs; **set this in production**                              |
| `BETTER_AUTH_SECRET`                     | dev fallback        | realtime | Better Auth signing secret (32+ random chars in production)                                 |
| `BETTER_AUTH_URL`                        | request origin      | realtime | public auth base (`https://…/api/auth`) in production                                       |
| `AUTH_TRUSTED_ORIGINS`                   | localhost + Rift Atlas origins | realtime | extra browser origins allowed by Better Auth                                     |
| `ENVIRONMENT`                            | `development`       | realtime | `production` enables production auth behaviour (real email verification)                   |
| `AUTH_EMAIL_WEBHOOK_URL`                 | —                   | realtime | production mail transport: receives `{to,name,subject,html}` JSON POSTs                      |
| `AUTH_EMAIL_WEBHOOK_TOKEN`               | —                   | realtime | optional bearer token for the mail webhook                                                   |
| `NEXT_DIST_DIR`                          | `.next`             | play     | Next.js dist dir (useful when several dev servers share the repo)                           |

### Seeded development account

Real accounts use the product owner's `@cloud-np/auth` package (Better Auth + D1) inside the
realtime worker. See [`docs/AUTH.md`](docs/AUTH.md) for the full design, environment and production
notes. For local development the worker seeds one account automatically on every
`pnpm --filter realtime dev`:

- **username:** `atlas` (or the email `atlas@local.test`)
- **password:** `1234`

The seed is idempotent and dev-only; it runs from `apps/realtime/scripts/auth-bootstrap.mjs`. Do
not run that script against a production database. "Continue as guest" still works alongside
accounts and stores a separate guest JWT. The account dialog's **Create an account** path also
works: in development the worker auto-verifies the new user after sign-up, so no email delivery is
needed.

### Production D1 placeholder

`apps/realtime/wrangler.jsonc` ships the placeholder `database_id`
`00000000-0000-4000-8000-000000000001` for the `AUTH_DB` binding (`database_name`
`riftbound-auth`). Create a real D1 database and replace that `database_id` (or override the
binding in the deploy configuration) before deploying; the placeholder is not a real database id.
Apply `apps/realtime/migrations/0001_better_auth.sql` to it and configure the production auth
secrets listed above.

## Development / integration tests

Vitest covers the rules engine, sync helpers, cards/i18n, the realtime cores (including account
seeding) and the play runtime (including the `@rift/engine` / `@rift/sync` adapter wiring):

```bash
pnpm test
pnpm --filter play test
pnpm --filter realtime test
```

The Playwright integration scripts under `apps/play/e2e/` drive a real lobby ↔ realtime ↔ board
round trip. They use the browser bundled in `.recon/tools-browser` and `/usr/bin/chromium`
(no extra deps). Start the worker and a play dev server first:

```bash
pnpm --filter realtime dev
cd apps/play && NEXT_DIST_DIR=.next-b14 pnpm exec next dev --port 3040
# in another terminal
node apps/play/e2e/solo.mjs         # account sign-in → import deck → Solo Room → board → draws
node apps/play/e2e/multiplayer.mjs  # atlas hosts + guest joins by code → both reach /game
```

Screenshots land in `apps/play/.verify/integration/`. The scripts use the development-only
`window.__riftDebug.dispatch(...)` hook to advance setup phases while the in-game setup prompts UI
is still being built.
