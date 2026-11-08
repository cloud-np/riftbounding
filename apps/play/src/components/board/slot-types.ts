/**
 * Wave-2 board slot contract.
 *
 * Every slot component receives exactly these props from the game shell / local harness.
 * Slots are presentational + dispatch-only: they never own authoritative state.
 *
 * `GameActionIntent` is the protocol's wire action union (`GameplayAction | RoomShellAction`).
 * The engine accepts any `{ type: string }` action, so setup actions (`select_battlefield`,
 * `submit_mulligan`, …) and gameplay actions (`draw_cards`, `move_card`, …) both flow through
 * the same dispatch function.
 */
import type { ActionClock, GameState, WireAction } from "@rift/protocol";
import type { PresenceSnapshot } from "@/runtime/presence";

/** One client→server intent: a gameplay action or a room/setup shell action. */
export type GameActionIntent = WireAction;

/** Dispatch one intent through the local engine (harness) or the server (real game). */
export type Dispatch = (intent: GameActionIntent, actorOverride?: string) => void;

/** Dispatch a gameplay intent as another seat this client controls (solo lab / practice). */
export type DispatchAs = (playerId: string, intent: GameActionIntent) => void;

export interface BoardSlotProps {
  /** The projected room — authoritative, or the harness's local engine state. */
  state: GameState;
  /** Seat the board is rendered from. */
  viewerId: string;
  /** Seats this client may act for (`solo_lab` / `single_player` control both). */
  controlledPlayerIds: string[];
  dispatch: Dispatch;
  mode: "multiplayer" | "solo_lab" | "single_player";
  /**
   * Solo-lab / practice actor override. The original sends gameplay intents as the
   * seat that owns the card/chain entry (`room_shell_action.actorPlayerId` on the
   * wire) so one client can play both sides without switching perspective.
   */
  dispatchAs?: DispatchAs;
  /** Live action clock projection (`actionClock` snapshot from the realtime room). */
  actionClock?: ActionClock | null;
  /** Currently connected seats (presence snapshot); used for the disconnect claim banner. */
  connectedPlayerIds?: readonly string[];
  /** Realtime presence (remote board emotes / card pings). */
  presence?: PresenceSnapshot;
  /** Shell callbacks (fall back to `riftbound:*` DOM events only when omitted). */
  onSwitchSeat?: (playerId: string) => void;
  onNextGame?: () => void;
  onLeaveRoom?: () => void;
  onReturnToLobby?: () => void;
  onClaimWin?: () => void;
  onBoardEmote?: (emoteId: string) => void;
  /** BO3 winner-confirmation dialog open state (original `resultDialogOpen` / NEXT). */
  resultDialogOpen?: boolean;
  onResultDialogDismiss?: () => void;
  onRequestSideboardSkip?: () => void;
  onRespondSideboardSkip?: (accepted: boolean) => void;
}
