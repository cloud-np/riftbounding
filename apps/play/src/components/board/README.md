# Board — wave 1 (B6)

Presentational clone of the Riftbound board. No store, no engine, no network.

## Entry point

```tsx
import { GameBoardView } from "@/components/board/layout/GameBoardView";

<GameBoardView
  state={room} // @rift/protocol Room
  viewerId={playerId}
  layoutHints={hints} // optional presentational overrides
  slots={{ sidebar, hand, prompts, overlays, chain }}
  onCardEvent={(event) => {}}
/>;
```

`GameBoardView` measures itself with a `ResizeObserver` and ports the original
metrics (`computeBoardLayout` / `computeHandFan` / `computeScoreTrack` in
`layout/board-metrics.ts`). Card size is derived from the measured board exactly
like the original board chunk.

## Slots for wave 2

| slot       | container                                                 | notes                                                                                                                                                                  |
| ---------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sidebar`  | `<aside data-slot="sidebar">`, width `--chain-lane-width` | The original right-hand column: room header, actions, match log, Resolve, chain and chat. Below 1100px the panel portals its own overlay trigger.                      |
| `hand`     | self `[data-player-area="hand"]` section                  | Replaces the built-in fan. Use the exported `HAND_FAN_SLOT_CLASS` and `computeHandFan` if you want the exact geometry.                                                 |
| `chain`    | inside the sidebar (`<SidebarSlot chain={…} />`)          | When no sidebar slot is supplied the board falls back to a dedicated chain lane. The lane width is the original `chainLaneWidthRem` metric (static, even while empty). |
| `prompts`  | `[data-board-slot="prompts"]` (absolute, z-150)           | Always rendered, empty by default.                                                                                                                                     |
| `overlays` | `[data-board-slot="overlays"]` (absolute, z-140)          | Target arrows, emotes, pings, drag ghost.                                                                                                                              |

The default `sidebar` fallback is a dashed `.board-slot-placeholder` so the
layout keeps the original 270px column until the real panel is plugged in.

## Fixtures

- `hero` — screenshot 49 (turn 5, 4–0, 5-card hand, HAND REVEALED)
- `autopay` — screenshot 52 (exhausted Mind rune, auto-pay preview id)
- `conquer` — screenshot 53 (pending conquer assist, selected battlefield unit)
- `ffa` — 4-player compact opponent rails + 4 battlefield columns (Baron Pit)
- `mobile` — same as hero at 390px (sidebar hidden, compressed desktop layout)

Dev route: `/dev/board?fixture=hero&bare=1` (bare hides the fixture switcher).
`/game` currently renders the `hero` fixture.

## Assets

`@/lib/assets` builds local static URLs (`/riftbound/static/...`, configurable
through `NEXT_PUBLIC_STATIC_ASSET_BASE`) and card-art URLs through
`@rift/cards` (`NEXT_PUBLIC_CARD_ASSET_BASE`, CDN by default). The second asset
tree (`/cosmetics`, `/board-lines`, `/points-rail`, `/ui`, …) is served from the
local copy via rewrites in `next.config.ts`.

## Notes / known gaps

- The original compiled stylesheet (`src/styles/riftbound-app.css`) is imported
  verbatim, so every `gb-*` class and all 35 keyframes are available.
- `board.webp` in the recon tree is a full-board marketing screenshot, not a
  playmat texture; the default playmat is painted with gradients + contours.
  Custom playmats/sleeves/token art resolve from `identity.boardCustomization`
  and the opponent-cosmetics setting applies the original playmat dim +
  `sleeveFilter` (module 533812 `d`).
- Board emotes use the original Poro Rive file (`cosmetics/poro/pals.riv`,
  artboard = emote id, `Reaction` state machine) and the original flight physics
  (3200 ms Poro / 1080 ms base). Card pings use the original six-layer
  `gbPing*` overlay (module 766225).
- The SVG displacement glass filter is still a follow-up; the compiled
  `gb-board-glass*` layer is present.
- Phone-portrait is a compressed desktop board (the original phone game shell is
  wave-2). `data-tablet-layout` is false until that shell lands.
