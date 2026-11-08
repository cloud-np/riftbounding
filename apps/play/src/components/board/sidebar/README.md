# Board sidebar (B10)

`SidebarSlot` is the 270px right-hand column: room header (turn/phase · clock · series score ·
room code · settings/rewind/fullscreen), `PLAY AS …` / NEXT / LEAVE controls, MATCH LOG, Resolve
(S), CHAT, and the responsive tablet overlay.

## Slot contract

It accepts `BoardSlotProps` plus optional wiring props:

| prop                                                           | purpose                                                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `chat?: SidebarChatBinding`                                    | `useChat(runtime)` fits this shape (`entries`, `canSend`, `authorId`, `send`, `publishTyping`, `typingPlayers`). Omit it and the panel keeps local messages. |
| `onCardHover(card, anchor)` / `onCardHoverEnd`                 | Overrides the default `useCardHoverPreview()` integration from `board/interaction`.                                                                          |
| `onSwitchSeat`, `onNextGame`, `onLeaveRoom`, `onReturnToLobby` | Live-room wiring. Without them, `riftbound:*` DOM events are emitted for the shell to handle.                                                                |
| `onCopyRoomCode`, `onResolve`, `onBoardEmote`                  | Optional overrides for header/resolve/emote actions.                                                                                                         |
| `clocksByPlayerId`, `actionClockMsByPlayerId`                  | Identity clocks / BO3 timing breakdown.                                                                                                                      |
| `settings?: SettingsMenuProps`                                 | Overrides for the game-settings popover.                                                                                                                     |
| `chain?: ReactNode`                                            | Chain panel rendered between Resolve and Chat (the original sidebar order).                                                                                  |

## Integration points owned by other agents

1. `GameBoardView` mounts the one canonical `board/dock/ActionDock` in the self action area; the
   removed `board/menus/BoardActionDock` duplicate is gone.
2. `GameBoardView` uses `board/header/BoardTurnControls`, so `END TURN` dispatches
   `end_turn`/`end_beginning_phase` with `observed` and switch-seat reaches the shell.
3. `GameScreen` / `LocalGameHarness` pass `onSwitchSeat`/`onNextGame`/`onLeaveRoom`/
   `onReturnToLobby` plus `chat={useChat(runtime)}`; the `riftbound:*` DOM-event fallbacks are only
   used by isolated harnesses.
4. The game shell can render the sidebar as an overlay below 1100px; `SidebarSlot` portals its own
   trigger + overlay so it works even when the shell hides `[data-slot="sidebar"]`.
