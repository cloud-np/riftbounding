# Lobby & room shell components (B7)

Presentational React components + a local-mock container for the play lobby and the
in-lobby room shell. Everything below is client-safe (`"use client"` at the container
boundary; leaf components are presentational).

## Tree

| file | role |
| --- | --- |
| `LobbyContainer.tsx` | owns all local lobby state (guest session, deck, saved decks, quick-match settings, mock rooms, dialogs, toasts) and the page-level layout |
| `DeckPanel.tsx` | deck portrait, counters, List/Stats tabs, private-deck toggle, Import/New/Choose/Save actions |
| `DeckList.tsx` / `DeckStats.tsx` | deck-list sections and statistics panel |
| `DeckImportDialog.tsx` | "Import Deck" dialog: paste area, live validation, Use Deck Code popover |
| `DeckPickerDialog.tsx` | saved-deck library (choose/delete/import) |
| `SidePanel.tsx` | Player name, Quick Match (Constructed / Radiance · Pre-Rift, settings popover, Find Random Match), Private play (Host/Solo/Room code + Join) |
| `BuilderStory.tsx`, `PromoRail.tsx`, `TournamentPromo.tsx` | announcement bar, left promo rotator, Convergence tournament rail |
| `deck-adapter.ts` | **only** place that imports `@rift/cards` (parse/export/validation/deck codes/catalog/image helpers). Replace with direct `@rift/cards` calls if its API drifts. |
| `strings.ts` | English copy keyed with the original `sim.*` / `current.*` catalog keys. Swap for `@rift/i18n` when available. |
| `types.ts` | shared lobby/room types |

Shell components live in `src/components/shell/` (`AppHeader`, `AppFooter`,
`AccountDialog`, `CardSearchDialog`, `GameHistoryDialog`, `MembershipDialog`,
`EntryShell`, `hub-theme.css`). The room shell is
`src/components/room/RoomShell.tsx`. Shared primitives are in `src/components/ui/`
(`Icon`, `Modal`, `NativeDialog`, `ToastStack`, `buttonStyles`).

## Integration contract (realtime runtime → room shell)

`RoomShell` is fully presentational:

```ts
interface RoomShellProps {
  room: RoomState;                    // seats, chat, spectators, variant/format/mode
  onCopyRoomCode: () => Promise<boolean> | boolean;
  onCopyInviteLink: () => Promise<boolean> | boolean;
  onLeaveRoom: () => void;
  onSetReady: (ready: boolean) => void;
  onTakeSeat: () => void;
  onSwitchToSpectator: () => void;
  onSwitchSeat: (seat: number) => void;
  onRandomizeTeams: () => void;
  onUpdateRoomSettings: (patch: {
    variant?: GameVariant; playMode?: PlayMode; format?: MatchFormat; deckRules?: DeckRulesMode;
  }) => void;
  onStartMatch: () => void;
  onCreateNextGame: () => void;
  onReturnToLobby: () => void;
  onSendChat: (text: string) => void;
  onLoadDeck: () => void;
  onToast: (message: string, tone?: "info" | "success" | "error") => void;
}
```

`RoomState` is defined in `src/components/lobby/types.ts`:

```ts
interface RoomState {
  code: string;
  origin: "private" | "solo" | "practice";
  roomMode: "multiplayer" | "solo_lab" | "single_player";
  hostId: string;
  myId: string;
  mySeat: number | null;
  viewerRole: "player" | "spectator";
  variant: GameVariant;   // duel | free_for_all_3 | free_for_all_4 | teams_2v2
  playMode: PlayMode;     // constructed | sealed
  format: MatchFormat;    // bo1 | bo3
  deckRules: DeckRulesMode;
  seats: (RoomSeat | null)[];
  chat: RoomChatEntry[];
  spectators: RoomSpectator[];
  started: boolean;
  matchComplete: boolean;
  gameNumber: number;
}
```

The future lobby integration should replace the mock setters in `LobbyContainer` with
`room_shell_sync` state and emit actions over the PartySocket (create_room, join_room,
take_seat, set_lobby_ready, switch_lobby_seat, randomize_teams, update lobby settings,
start_match, send chat). The presentational props do not change.

## Local mock behaviour (phase 1)

- **Auth**: `AccountDialog` keeps the original SSO/email chrome and adds a
  “Continue as guest” display-name form. Guest session is stored under
  `riftbound_simulator_guest_session_v1`; display name under the original key
  `riftbound_simulator_player_name`.
- **Persistence** (localStorage): `riftbound_simulator_saved_decks_v1` (saved decks;
  the original stores these server-side), `riftbound_simulator_deck_draft`,
  `riftbound_simulator_deck_draft_saved_deck_id`, `riftbound_simulator_private_deck`,
  `riftbound_simulator_play_mode`, `riftbound_simulator_quick_match_table`,
  `riftbound_simulator_tournament_promo_collapsed_v4` (matches the original collapse key),
  and the `riftbound_locale` cookie. Saved decks are an array of
  `{ id, name, raw, updatedAt }`.
- **Deck import/validation** is real: `@rift/cards` parsing, catalog validation and
  deck codes are used. Import is enabled only when `parseDeckText(...).valid`.
- **Host Room / Solo Room / Join** create local mock rooms (Join accepts any code of
  at least 4 characters) so the room shell can be exercised. `Start Match` marks the
  mock room started and, after a short delay, match-complete so the BO3
  “Create next game” control is reachable.
- **Find Random Match** requires a valid deck; after a short delay it opens a mock
  room matching the selected table (bots fill the other seats).
- **Radiance · Pre-Rift** toggles the card-pool label (and is only enabled for signed-in
  guests); sealed pool creation itself is out of scope for phase 1.
- **New Deck** opens the import editor with an empty paste box instead of navigating
  to the website deck builder; **Match settings** is the original inline popover
  (aria-label "Match settings"), not a detached modal.
- **Locale** updates the `<select>`, cookie and `document.lang`; localized catalogs are
  not wired yet (phase 1 keeps English copy).
- **Card search** (Ctrl/⌘+K) searches the real `@rift/cards` catalog and opens the
  card page on riftatlas.com.

## Layout notes

Custom CSS from the original (hub tokens, `.lobby-*` rules, phone-header overrides,
account variables) lives in `src/components/shell/hub-theme.css` so the app-level
`globals.css` stays owned by the shared scaffold. Do not rename the original
`data-testid`/`data-*` hooks or CSS class hooks; the visual verification suite uses
them.
