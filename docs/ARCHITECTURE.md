# Riftbounding — Architecture & Build Contract

Goal: exact functional + visual clone of the Riftbound simulator at play.riftatlas.com (and its launcher page riftatlas.com/play). Source of truth for behaviour/visuals = the recon specs in `.recon/specs/` (+ screenshots in `.recon/screens/`, walkthrough in `.recon/reports/01-browser-walkthrough.md`, prettified original bundles in `.recon/pretty/`). When a spec and the original bundle disagree, the bundle wins. Keep original names, wire string values, CSS class names (`gb-*`, `data-*` hooks), i18n keys and UI copy verbatim.

## Scope

From now on the project covers **only**:

1. **The simulator** — lobby → rooms → game board, realtime, engine.
2. **Building decks.**

Nothing else is in scope: no Creator Studio / customize, no membership, no game history, no launcher-site polish. `apps/site` and the `/customize` page stay as-is and get no further work.

## Layout (pnpm workspace)

| Path              | Package                                              | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| packages/protocol | @rift/protocol                                       | Types only: GameState, actions (wire names), messages, room/shell types. Seeded from `.recon/specs/types/`.                                                                                                                                                                                                                                                                                                                                                       |
| packages/cards    | @rift/cards                                          | Card DB (`.recon/specs/data/cards.json`), tokens, image URL builder + fallback + resize buckets, deck text parse/export, deck codes encode/decode, deck validation (exact messages), sealed kits/configs.                                                                                                                                                                                                                                                         |
| packages/i18n     | @rift/i18n                                           | UI catalogs en/fr/ko/zh-CN, game-log sentence templates + renderer (structured log entry → localized sentence), locale-aware card text.                                                                                                                                                                                                                                                                                                                           |
| packages/engine   | @rift/engine                                         | Pure deterministic port of the original client/server transition function (`35qz5rkx7yexy.js` ~22719–24296 `cU`/`cV` + helper modules 375934 move-legality, 487939 scoring, 856014/856018 conquer/showdown, 888811 auto-pay, 371460 card helpers, rewind, victory, mulligan/initiative/battlefield-pick/first-player flow, BO3 sideboarding). No I/O, no Date.now/Math.random inside — time and RNG come from the ActionContext.                                  |
| packages/sync     | @rift/sync                                           | Wire-level helpers shared by server and client: message envelopes/validators, patch-op diff (prev→next state ⇒ patch ops, the 21 original op kinds) and patch apply, snapshot (per-viewer redaction of hidden info: opponent hand, deck order, face-down cards).                                                                                                                                                                                                  |
| apps/realtime     | Cloudflare Worker (partyserver Durable Objects)      | Parties `match`, `matchmaking`, `coordinator`, (`account` later). HTTP room API (`POST /parties/coordinator/global-enam-v1` create_room; `POST /parties/match/<CODE>` join_room/take_seat/…). Runs @rift/engine authoritatively; sends authoritative_snapshot / patch_commit / resume_ack / room_shell_sync; ping/pong + close codes 4007/4008/4009/4010/4014. Guest auth: `POST /api/auth/token` issues an HS256 JWT {sub, name} (secret from env, dev default). |
| apps/play         | Next.js 16 app (play.riftatlas.com clone), port 3000 | `/` lobby + room shell, `/game` board, `/customize` (later). Client runtime: external store + useSyncExternalStore, PartySocket connection, optimistic apply via @rift/engine, server reconciliation, sounds.                                                                                                                                                                                                                                                     |
| apps/site         | Next.js 16 app (riftatlas.com clone), port 3001      | `/play` launcher page only (+ its header/footer).                                                                                                                                                                                                                                                                                                                                                                                                                 |

## Engine public API (contract — all agents code against this)

```ts
// @rift/engine
export function createInitialGameState(config: GameSetupConfig): GameState;   // room → game start (decks, seats, variant, format, mode)
export function applyGameAction(state: GameState, actorPlayerId: string, action: GameActionIntent, ctx: ActionContext):
  | { ok: true; state: GameState; log: GameLogEntry[]; sound?: string | null }
  | { ok: false; error: string; errorCode?: string };
export function getLegalActions?(state: GameState, playerId: string): string[]; // optional helper
export interface ActionContext { now: number; rng: () => number; mode: "multiplayer" | "solo_lab" | "single_player"; }
```

Type names come from @rift/protocol (rename there if the original names differ, but keep these function names). The client applies the same function optimistically; the server's result is authoritative.

## Deck builder (in scope)

The builder lives in `apps/play` so a built deck can go straight into the simulator.

| Route                  | What                                                                                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/decks/new`           | New builder. Restores the single localStorage draft; `?clearDraft=1` clears the draft + bookmark scope first (and is removed from the URL afterwards).                                  |
| `/decks/[savedDeckId]` | Saved-deck editor (the original route shape — not `/edit`). Signed-in accounts load `getSavedDeckEditorSnapshot`; guests keep their local draft and see “Sign in to load a saved deck.” |

Owned paths: `apps/play/src/app/decks/**`, `apps/play/src/components/deckbuilder/**`, `apps/play/e2e/decks.mjs`, `packages/cards/**`.

- UI: light `BuilderHeader` + split catalog/workspace (`58% / 14px / 1fr`, 28–72% resizer), catalog section tabs/search/filter popover/view popover/sort/group/24-card paging, List / Full Art / Stats, section-gated pools with Legend→Champion→Main Deck auto-advance, copy limits + toasts, issues popover, import dialog (Deck List / Use Deck Code), export menu (deck text / deck code), guide editor, card detail modal, discard dialog, art picker, Mobile bottom-sheet drawer (<1024px).
- Persistence: `riftatlas_deckbuilder_draft_v1` holds exactly the original v5 shape (including `linkedSavedDeckId`, `lastSavedSignature`, `startingLegendVacant`); preferences use `riftatlas_deckbuilder_list_preferences_v1`, bookmarks the original v1/v2 scope keys, pending saves `riftatlas_deckbuilder_pending_auth_action_v1` (sessionStorage).
- Save/Play use the shared saved-deck client runtime (`apps/play/src/runtime/decks.ts`: `upsertSavedDeck`, `getSavedDeckEditorSnapshot`, …) against the realtime worker. Play: signed-in → save if dirty then `/?savedDeckId=<id>`; guest → local `encodeDecklistToDeckCode` then `/?deckCode=<code>` (deck codes are a local codec in `@rift/cards`; no server lookup).
- `@rift/cards` additions are additive in `packages/cards/src/deck-builder.ts`: `MAX_*`/`REQUIRED_*`/`NEEKO_*` constants, `totalCards`, `getCardCopyLimit`, `getMainDeckSafetyLimitError`, `isDeckReadyForMatch`, `parseDecklist` (catalog validation default off like the original), Neeko/Additional-Legend helpers (`getMaximumLegendCount`, `countStartingLegends`, `getNeekoLegendOptionEntries`, `setStartingLegend`, `removeLegendEntry`, `replaceEntryPrint`, `orderStartingLegendFirst`), `areCardDomainsWithinIdentity`, builder catalog eligibility (including the narrower champion `name.startsWith(tag)` filter) and ban wrappers. Existing exports/behaviour are unchanged; `parseDeckText` still defaults to no catalog validation unless `validateCatalog: true` is passed.
- Deliberate deviations from the original site: community/public pages, deck index/library, publishing/private flows, share-to-friend, wallpapers and live TCGPlayer pricing are out of scope (the card detail modal only shows a TCGPlayer link when the card record has one — current data does not). Guest “Play in Simulator” is allowed through a local deck code instead of the original sign-in gate so guests can build and immediately play.

## Product decisions (phase 1)

- Auth: no Clerk. Guest identity (display name) → JWT from the realtime worker. Keep the original "Sign in / Sign up" UI chrome, but the account dialog offers "Continue as guest" so every play path works locally.
- Persistence: saved decks + settings in localStorage (same keys as original where known). No Convex. Game history/community decks/friends/judges/reports/metafy/pricing/ads: render the original UI where it is part of the lobby look, but non-functional or hidden behind a feature flag.
- Assets: static UI assets (board, cardbacks, icons, tokens, sounds, rive, fonts) are copied into `apps/play/public/riftbound/static/...` (same relative paths as the CDN). Card images keep loading from `https://assets.riftatlas-workers.com/riftbound/cards/...` by default, configurable via `NEXT_PUBLIC_CARD_ASSET_BASE`.
- Modes in scope now: solo_lab, single_player (practice / two-sided), multiplayer duel (host room + join by code), quick match duel. FFA-3/4, 2v2, BO3 sideboarding, sealed: engine supports them where the port naturally covers it; UI later.

## Saved decks

The original builder/library uses Convex (`savedDecks.*`, spec 05 §8.2). The clone keeps the same
function names and payload semantics but stores decks in the realtime worker's D1 database
(`AUTH_DB`, migration [`apps/realtime/migrations/0002_saved_decks.sql`](../apps/realtime/migrations/0002_saved_decks.sql)).
Only Better Auth **account** sessions own a server library; guest JWTs are rejected with
`account_required` and guests keep the browser draft (`riftatlas_deckbuilder_draft_v1`).

Client contract: [`apps/play/src/runtime/decks.ts`](../apps/play/src/runtime/decks.ts) (re-exported
from `@/runtime`). Server: [`apps/realtime/src/decks.ts`](../apps/realtime/src/decks.ts). All
requests send `Authorization: Bearer <Better Auth session token>`; CORS is the worker's usual
localhost/Rift Atlas reflection.

| Function                       | HTTP route                           | Notes                                                                                                                                                                  |
| ------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listSavedDeckSummaries`       | `GET /api/decks`                     | `{decks: SavedDeckSummary[]}`, sorted `lastUsedAt DESC, updatedAt DESC`.                                                                                               |
| `upsertSavedDeck`              | `POST /api/decks/upsert`             | `{deckId?, name, deckSections, guideHtml, revision?}`; omit `deckId` to create. Returns `{deck: {id, name, guideHtml, status, legalityVersion, revision, updatedAt}}`. |
| `createSavedDeck`              | `POST /api/decks/create`             | `{name, decklistRaw}` → `{deck: {id, legalityVersion, revision, status}}` (lobby Save Deck).                                                                           |
| `getSavedDeckEditorSnapshot`   | `GET /api/decks/:id/editor`          | `{deck: snapshot \| null}`; includes `deckContent` and `guideHtml`.                                                                                                    |
| `getSavedDeckWorkspaceState`   | `GET /api/decks/:id/workspace`       | Snapshot without `deckContent`.                                                                                                                                        |
| `resolveSavedDeckForPlay`      | `GET /api/decks/:id/resolve`         | Honours `knownRevision`/`knownLegalityVersion`/`knownStatus` → `unchanged`; otherwise `found` / `missing` / `unavailable`.                                             |
| `resolveSavedDeckForPlayFresh` | `GET /api/decks/:id/resolve?fresh=1` | Always re-reads; records `lastUsedAt` unless `recordUse=0`. Lobby selection path.                                                                                      |
| `renameSavedDeck`              | `POST /api/decks/:id/rename`         | `{name, revision?}` → `{result: {previousRevision, legalityVersion, revision, status}}`.                                                                               |
| `deleteSavedDeck`              | `DELETE /api/decks/:id`              | → `{result: {id}}`.                                                                                                                                                    |

`SavedDeckSummary` is `{id, name, status: "ready" | "incomplete", identity, featureCardId?,
featureCardImageUrl?, lastUsedAt, updatedAt, publishedDeckId?}`; `deckContent` is
`{kind:"parsedDeck", parsedDeck}` or `{kind:"deckCode", deckCode}`. Rows store the raw decklist
text plus normalized section entries, name, guide HTML, `revision`, `legalityVersion`, `status`,
identity/feature card and timestamps. Saves compute status with `@rift/cards` (Standard
Constructed); server validation also enforces the 20,000-character decklist cap.

**Optimistic concurrency:** updates/renames increment `revision`. Passing a stale `revision`
returns `409 {error:"revision_conflict", currentRevision}`. Omitting it is last-write-wins (the
original `upsertSavedDeck` call site does not send it). Every row is scoped by `user_id`; another
user's deck behaves as missing (`null` editor snapshot, `{kind:"missing"}` resolve, `404` for
mutations).

**Lobby integration** (`apps/play/src/components/lobby`): NEW DECK navigates to `/decks/new`;
signed-in users' **Choose Deck** lists summaries and loads the selection with
`resolveSavedDeckForPlayFresh` (edit links go to `/decks/<id>/edit`). The launcher supports
`?savedDeckId=<id>` for accounts and `?deckCode=<code>` for guests, then cleans the URL. Room
create/join, matchmaking and `submit_deck` send the original `constructedDeckRegistration`
(`packages/protocol` `ConstructedDeckRegistration`), carrying the decklist plus saved-deck metadata;
rooms retain it per player.

## Parallel-work rules (IMPORTANT)

1. Only edit files inside the paths your task assigns you. Read anything.
2. Do NOT run `pnpm install`/`pnpm add` or edit lockfiles/root package.json. If you need a dependency, stop and list it in your final report.
3. Do NOT run `next dev` or `next build` unless your task explicitly says so (multiple agents share the apps). Verify with `pnpm --filter <pkg> typecheck` and `pnpm --filter <pkg> test`.
4. Write tests (vitest) for pure logic. Keep code idiomatic TypeScript, strict mode, no `any` unless unavoidable.
5. Final answer: concise report — what you built (files), what is verified (commands + results), deviations from the original, open issues, deps needed.
