# End-to-end suites

Two Playwright suites that play the product through the real UI: lobby, deck
import, room creation/join, every setup overlay, card drag & drop, end turn,
match log, chat, settings, rewind, and leaving a match.

There are **no `window.__riftDebug` calls** in either suite — setup and gameplay
are driven only by clicks, drags and typed input. Assertions read public
`data-*` attributes, visible text and zone contents.

- `solo.mjs` — atlas (`atlas` / `1234`) signs in, imports the fixture deck,
  creates a Solo Room, completes setup by clicking, plays a unit from hand to
  base, drags it to a battlefield, ends the turn, sends chat and opens settings.
  Then repeats the lobby/setup/play path as a guest.
- `multiplayer.mjs` — atlas hosts a private room and a guest joins by code. Each
  browser controls only its own seat through battlefield pick, initiative,
  first-player choice and mulligan. Both play a card (the other side sees it),
  chat both ways, request/approve a rewind, then the host leaves and the guest
  observes the result.
- `fixtures/atlas-standard.txt` — a legal 40-card Standard Constructed deck
  (legend + champion + main deck, 3 battlefields, 12 runes) generated from the
  `@rift/cards` catalog.
- `fixtures/card-types.json` — name → type for the fixture deck, used to choose
  a unit from the hand without asking the debug hook.

Playwright comes from `../../../.recon/tools-browser/node_modules/playwright`
and needs no install; the browser is `/usr/bin/chromium` by default. Node 22+
is required.

## URLs and environment

All scripts read their endpoints from the environment:

| variable        | default                 | meaning                                     |
| --------------- | ----------------------- | ------------------------------------------- |
| `PLAY_URL`      | `http://localhost:3070` | play app origin                             |
| `REALTIME_URL`  | `http://localhost:2001` | realtime worker the tests should exercise   |
| `CHROMIUM_PATH` | `/usr/bin/chromium`     | Chromium executable                         |
| `HEADLESS`      | `true`                  | set `false` to watch the run                |
| `E2E_TOUCH`     | unset                   | set `true` to create touch-enabled contexts |

The play app inlines its `NEXT_PUBLIC_REALTIME_HOST` / `NEXT_PUBLIC_AUTH_BASE`
at dev-server start, so start it with the same origin as `REALTIME_URL`:

```bash
cd apps/play
NEXT_DIST_DIR=.next-b18 NEXT_PUBLIC_REALTIME_HOST=localhost:2001 \
NEXT_PUBLIC_AUTH_BASE=http://localhost:2001 \
  pnpm exec next dev --port 3070
PLAY_URL=http://localhost:3070 REALTIME_URL=http://localhost:2001 node e2e/solo.mjs
```

## Running against the isolated B18 stack

The B18 stack uses realtime `:2001`, play `:3070`, `NEXT_DIST_DIR=.next-b18`.

```bash
# 1. isolated local D1 state + seeded atlas / 1234 account
WRANGLER_PERSIST_TO=/tmp/opencode/b18-realtime-state \
  pnpm --filter realtime auth:bootstrap

# 2. realtime worker on 2001 (persistence isolated from the default worker)
cd apps/realtime
pnpm exec wrangler dev --port 2001 \
  --persist-to /tmp/opencode/b18-realtime-state

# 3. play app on 3070 with its own dist dir
cd apps/play
NEXT_DIST_DIR=.next-b18 \
NEXT_PUBLIC_REALTIME_HOST=localhost:2001 \
NEXT_PUBLIC_AUTH_BASE=http://localhost:2001 \
  pnpm exec next dev --port 3070

# 4. tests (another terminal)
node apps/play/e2e/solo.mjs
node apps/play/e2e/multiplayer.mjs
# or: pnpm --filter play test:e2e
```

To use the default local stack instead (`pnpm dev`, play `:3000`, realtime
`:1999`):

```bash
PLAY_URL=http://localhost:3000 \
REALTIME_URL=http://localhost:1999 \
  node apps/play/e2e/solo.mjs
```

## Behavior notes

- Setup is considered complete when `[data-testid="game-state"]` reports
  `data-phase="in_game"`. The helpers click whatever the live overlay offers:
  the active battlefield row, enabled first-player buttons, the single-seat
  mulligan submit, the solo two-seat "Lock In Both" button, and sideboard
  lock-ins if a BO3 game reaches one.
- The solo/goldfish client controls both seats, so it clicks the opponent
  battlefield row when that row becomes active and uses "Lock In Both".
- Drag & drop is a real mouse drag on the `draggable` card (Chromium emits the
  HTML5 `dragstart` / `dragover` / `drop` chain). The test asserts
  `data-board-dragging="true"` mid-drag, so a pointer-only shortcut cannot
  silently replace it.
- The rewind step uses the sidebar `[data-testid="rewind-last-action"]` control.
  The confirmation/approve flow still runs through `rewind-confirmation` and
  `rewind-approve`.
- Failures write screenshots to `e2e/artifacts/` (gitignored) and exit non-zero.
  Each failure log includes the page URL, current phase and recent page errors.
