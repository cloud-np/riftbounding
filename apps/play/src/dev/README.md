# `apps/play/src/dev` — local play harness (task B13)

A development-only page that runs the **real `@rift/engine`** against a `GameState` in the
browser, with the real board and the wave-2 slot plumbing wired up. No realtime server, no
server-authoritative reconciliation: every intent is applied locally with
`applyGameAction(state, actor, intent, { now: Date.now(), rng: seededPrng, mode: "solo_lab",
timeline })`. The engine timeline stays in a browser ref (it is server-only state in a real
match) so rewind/forward intents also work in the harness.

## Routes

| URL                      | what it does                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dev/play`              | Engine-created solo-lab duel. Starts in the real setup flow (`battlefield_pick` → `first_player_choice` → `mulligan`) with two legal 40-card decks. |
| `/dev/play?fixture=hero` | Deep clone of the board fixture room (`hero`). Also `autopay`, `conquer`, `ffa`, `mobile`.                                                          |
| `/dev/play?seed=42`      | Seeds deck shuffles/action RNG (default `1337`).                                                                                                    |
| `/dev/play?viewer=1`     | Initial viewer by seat, player id or display name. Both seats are always controlled.                                                                |

The fixture gallery itself is still at `/dev/board?fixture=hero`.

## Debug panel

Top-left overlay (kept clear of the right-hand sidebar/chain slots), all hooks are stable for scripts:

- `data-testid="debug-state"` — `data-phase`, `data-turn`, `data-viewer-id`,
  `data-active-player-id`, `data-hand-counts` (`p0,p1`), `data-deck-counts`.
- `data-testid="viewer-select"` — seat switcher (changes the rendered perspective only).
- `data-testid="debug-auto-setup"` — dispatches `auto_start_test_setup` (setup → in_game).
- `data-testid="debug-draw"` — dispatches `draw_cards { count: 1 }` as the viewer.
- `data-testid="debug-end-turn"` — dispatches `end_turn` with the observed turn state.
- `data-testid="debug-reset"` — rebuilds the initial room/RNG and clears the log.
- `data-testid="debug-intent-log"` / `data-testid="debug-intent"` — last **20** intents with
  actor, `data-ok`, `data-changed` and the engine error text for failures.
- `data-testid="debug-last-result"` — the newest result only.

Setup intents (`select_battlefield`, `submit_mulligan`, `roll_initiative`, …) don't carry an
actor. The harness tries the viewer first and then the other controlled seat(s), which is how
both local players can complete battlefields/mulligans without a server. Gameplay intents are
applied as the viewer (`end_turn`/`end_beginning_phase` use the active player).

## Wave-2 slot contract

All slots receive exactly `BoardSlotProps` from
`@/components/board/slot-types`:

```ts
interface BoardSlotProps {
  state: GameState; // @rift/protocol Room (projected / local)
  viewerId: string;
  controlledPlayerIds: string[]; // both seats in solo_lab / single_player
  dispatch: Dispatch; // (intent: GameActionIntent) => void
  mode: "multiplayer" | "solo_lab" | "single_player";
}
type GameActionIntent = WireAction; // @rift/protocol: GameplayAction | RoomShellAction
type Dispatch = (intent: GameActionIntent) => void;
```

> Names: the architecture doc calls this `GameActionIntent`; `@rift/protocol` currently exports
> the same union as `WireAction`, so `slot-types.ts` aliases it under the contract name. When a
> dedicated protocol alias lands, change only `slot-types.ts`.

Placeholder modules (replace the implementation, keep the exported names and `BoardSlotProps`):

| import                           | exports                                | owner                  |
| -------------------------------- | -------------------------------------- | ---------------------- |
| `@/components/board/sidebar`     | `SidebarSlot`                          | sidebar agent          |
| `@/components/board/prompts`     | `PromptsSlot`, `OverlaysSlot`          | prompts/overlays agent |
| `@/components/board/chain`       | `ChainSlot`                            | chain agent            |
| `@/components/board/interaction` | `BoardInteractionProvider`, `HandSlot` | interaction/hand agent |

`BoardInteractionProvider` takes `BoardSlotProps & { children }` and currently renders its
children unchanged. The real provider should keep the same wrapper role in `/dev/play`.

Minimal wave-2 usage:

```tsx
const slotProps: BoardSlotProps = { state, viewerId, controlledPlayerIds, dispatch, mode };

<BoardInteractionProvider {...slotProps}>
  <GameBoardView
    state={state}
    viewerId={viewerId}
    slots={{
      sidebar: <SidebarSlot {...slotProps} />,
      hand: <HandSlot {...slotProps} />,
      chain: <ChainSlot {...slotProps} />,
      prompts: <PromptsSlot {...slotProps} />,
      overlays: <OverlaysSlot {...slotProps} />,
    }}
  />
</BoardInteractionProvider>;
```

### Testing a slot through `/dev/play`

1. Implement the slot in its owned folder (keep the index export).
2. Run `pnpm --filter play dev` and open `http://localhost:3000/dev/play`
   (or `?fixture=hero` for an `in_game` room).
3. Click **Auto setup** to walk the engine through battlefields/first player/mulligans, then
   interact with your slot. **Draw 1** / **End turn** are quick state-change probes.
4. Use the viewer switcher to verify both seats; `controlledPlayerIds` contains both.
5. Check the intent log for the action `type`, actor and engine result — no server is involved.

## Files

- `LocalGameHarness.tsx` — client component, state, dispatch, debug panel.
- `localGame.ts` — fixture/room factory, seeded PRNG, viewer resolution, board-mode helper.
- `decks.ts` — deterministic legal deck builder from `@rift/cards`.

## Verify

```bash
pnpm --filter play typecheck
pnpm --filter play dev   # then GET /dev/play and /dev/play?fixture=hero
```
