/**
 * Pure derivations shared by the setup prompt overlays. Kept free of React so they
 * can be unit-tested and reused by the local harness and live game screen.
 */

import { VARIANT_RULES } from "@rift/engine";
import type {
  DeckSections,
  DecklistEntry,
  PlayerBoard,
  Room,
  RoomPlayer,
} from "@rift/protocol";

export type SetupPromptKind =
  | "sideboarding"
  | "battlefield_pick"
  | "initiative_roll"
  | "first_player_choice"
  | "mulligan";

export const SETUP_PHASES: ReadonlySet<string> = new Set<SetupPromptKind>([
  "sideboarding",
  "battlefield_pick",
  "initiative_roll",
  "first_player_choice",
  "mulligan",
]);

export function isSetupPhase(phase: string | undefined): phase is SetupPromptKind {
  return !!phase && SETUP_PHASES.has(phase);
}

export function activePlayers(room: Room): RoomPlayer[] {
  return room.players.filter((player) => !!player.board && !player.leftAt);
}

export function playerById(room: Room, playerId: string | undefined | null): RoomPlayer | undefined {
  if (!playerId) return undefined;
  return room.players.find((player) => player.id === playerId);
}

export function orderPlayersForSeat(players: readonly RoomPlayer[]): RoomPlayer[] {
  return [...players].sort((a, b) => a.seat - b.seat);
}

/** Battlefield contributors (509396 `battlefieldContributorPolicy`). */
export function battlefieldContributorIds(room: Room): string[] {
  const active = orderPlayersForSeat(activePlayers(room));
  const variant = room.gameVariant ?? "duel";
  const policy = VARIANT_RULES[variant]?.battlefieldContributorPolicy ?? "every_player";
  if (policy === "all_except_first_player" && room.firstPlayerId) {
    return active.filter((player) => player.id !== room.firstPlayerId).map((player) => player.id);
  }
  return active.map((player) => player.id);
}

export function pendingBattlefieldPlayers(room: Room): RoomPlayer[] {
  const contributors = new Set(battlefieldContributorIds(room));
  return orderPlayersForSeat(activePlayers(room)).filter(
    (player) => contributors.has(player.id) && !player.selectedBattlefield,
  );
}

/** The seat the server will accept the next `select_battlefield` from. */
export function nextBattlefieldActorId(
  room: Room,
  controlledPlayerIds: readonly string[],
): string | null {
  const controlled = new Set(controlledPlayerIds);
  const pending = pendingBattlefieldPlayers(room).find((player) => controlled.has(player.id));
  return pending?.id ?? null;
}

export function battlefieldOptions(room: Room, player: RoomPlayer): string[] {
  const taken = new Set(
    room.players
      .filter((candidate) => candidate.id !== player.id && candidate.selectedBattlefield)
      .map((candidate) => candidate.selectedBattlefield!.trim().toLowerCase()),
  );
  return (player.battlefieldOptions ?? []).filter((name) => !taken.has(name.trim().toLowerCase()));
}

/** Engine `autoSelectLastBattlefields` leaves one option; hide the picker then. */
export function battlefieldLockedFor(player: RoomPlayer): boolean {
  return !!player.selectedBattlefield;
}

export function mulliganPendingPlayers(room: Room): RoomPlayer[] {
  const done = new Set(room.mulliganDonePlayerIds ?? []);
  return orderPlayersForSeat(activePlayers(room)).filter((player) => !done.has(player.id));
}

export function nextMulliganActorId(
  room: Room,
  controlledPlayerIds: readonly string[],
): string | null {
  const controlled = new Set(controlledPlayerIds);
  return mulliganPendingPlayers(room).find((player) => controlled.has(player.id))?.id ?? null;
}

export function mulliganSelectionCap(): number {
  return 2;
}

export function toggleMulliganSelection(selection: readonly string[], cardId: string): string[] {
  if (selection.includes(cardId)) return selection.filter((id) => id !== cardId);
  if (selection.length >= mulliganSelectionCap()) return [...selection];
  return [...selection, cardId];
}

export function handFor(player: RoomPlayer | undefined): NonNullable<PlayerBoard["hand"]> {
  return player?.board?.hand ?? [];
}

export function opponentPlayer(room: Room, viewerId: string): RoomPlayer | undefined {
  return orderPlayersForSeat(activePlayers(room)).find((player) => player.id !== viewerId);
}

export function mulliganOpponent(room: Room, viewerId: string): RoomPlayer | undefined {
  return opponentPlayer(room, viewerId);
}

/** First/second badge label for the first player. */
export function firstPlayerBadge(room: Room): string | null {
  if (!room.firstPlayerId) return null;
  return room.firstPlayerId;
}

export function mulliganKeptCount(room: Room, playerId: string): number | null {
  const redrawCount = room.mulliganPlaybackByPlayerId?.[playerId]?.redrawCount;
  return typeof redrawCount === "number" ? Math.max(0, 4 - redrawCount) : null;
}

export function revisableMulliganCount(room: Room, playerId: string): number {
  return room.mulliganPlaybackByPlayerId?.[playerId]?.redrawCount ?? 0;
}

export interface FirstPlayerChoiceOption {
  player: RoomPlayer;
  relation: "self" | "opponent" | "ally";
  label: string;
}

export function firstPlayerChoiceOptions(
  room: Room,
  viewerId: string,
  translate: (key: string, params?: Record<string, string | number>) => string | null,
): FirstPlayerChoiceOption[] {
  const seats = orderPlayersForSeat(activePlayers(room));
  const useGoldfish = room.roomMode === "single_player";
  if (useGoldfish) {
    return seats.map((player) => ({
      player,
      relation: player.id === viewerId ? "self" : "opponent",
      label:
        player.id === viewerId
          ? (translate("sim.playFirst") ?? "Play First")
          : (translate("sim.playSecond") ?? "Play Second"),
    }));
  }
  // The original draws the perspective player last so the opponent's option sits on top
  // (`opponent-above-self`); 3/4-player grids keep seat order (`t3`, 35qz:2162-2168).
  const players =
    seats.length === 2
      ? [...seats.filter((player) => player.id !== viewerId), ...seats.filter((player) => player.id === viewerId)]
      : seats;
  return players.map((player) => {
    const relation =
      player.id === viewerId
        ? "self"
        : room.teamIdByPlayerId?.[player.id] &&
            room.teamIdByPlayerId[player.id] === room.teamIdByPlayerId[viewerId]
          ? "ally"
          : "opponent";
    const label =
      players.length === 2 && room.roomMode !== "solo_lab"
        ? relation === "self"
          ? (translate("sim.youStart") ?? "You Start")
          : (translate("sim.opponentStarts") ?? "Opponent Starts")
        : (translate("sim.playerStarts", { playerName: player.name }) ?? `${player.name} Starts`);
    return { player, relation, label };
  });
}

export function canChooseFirstPlayer(
  room: Room,
  viewerId: string,
  controlledPlayerIds: readonly string[],
): boolean {
  if (!room.firstPlayerChooserId) return true;
  if (room.firstPlayerChooserId === viewerId) return true;
  if (!controlledPlayerIds.includes(room.firstPlayerChooserId)) return false;
  return true;
}

export function initiativePlayers(room: Room): RoomPlayer[] {
  return orderPlayersForSeat(activePlayers(room));
}

export function initiativeRolls(room: Room): Record<string, number> {
  return room.initiativeRolls ?? {};
}

/** The chooser is the single highest roll; ties restart the round. */
export function initiativeChooserId(room: Room): string | null {
  if (room.firstPlayerChooserId) return room.firstPlayerChooserId;
  const players = initiativePlayers(room);
  const rolls = initiativeRolls(room);
  if (players.length === 0) return null;
  if (!players.every((player) => typeof rolls[player.id] === "number")) return null;
  const high = Math.max(...players.map((player) => rolls[player.id] ?? 0));
  const winners = players.filter((player) => (rolls[player.id] ?? 0) === high);
  return winners.length === 1 ? (winners[0]?.id ?? null) : null;
}

export function initiativePendingPlayers(room: Room): RoomPlayer[] {
  const rolls = initiativeRolls(room);
  return initiativePlayers(room).filter((player) => typeof rolls[player.id] !== "number");
}

/* --------------------------------------------------------------- sideboarding */

export function deckSectionsFor(player: RoomPlayer | undefined): DeckSections | null {
  if (!player) return null;
  if (player.submittedDeck?.sections) return player.submittedDeck.sections;
  const deck = player.deck as { sections?: DeckSections } | undefined;
  if (deck?.sections) return deck.sections;
  if (player.sealedRegisteredDeckSections) return player.sealedRegisteredDeckSections;
  return null;
}

export function mergeDeckEntries(entries: readonly DecklistEntry[]): DecklistEntry[] {
  const merged = new Map<string, DecklistEntry>();
  for (const entry of entries) {
    const key = entry.cardCode ?? entry.name.trim().toLowerCase();
    const current = merged.get(key);
    if (current) merged.set(key, { ...current, count: current.count + entry.count });
    else merged.set(key, { ...entry });
  }
  return [...merged.values()];
}

export function totalCards(entries: readonly DecklistEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.count, 0);
}

export function clampDeckEntryCount(count: number): number {
  return Math.max(0, Math.min(99, Math.trunc(count)));
}

export interface SideboardLimit {
  mainDeckTarget: number;
  sideboardMax: number;
}

export function sideboardLimits(): SideboardLimit {
  return { mainDeckTarget: 40, sideboardMax: 10 };
}

/** Move one copy from `from` to `to` (card transfer rows in the original UI). */
export function transferEntry(
  from: readonly DecklistEntry[],
  to: readonly DecklistEntry[],
  key: string,
): { from: DecklistEntry[]; to: DecklistEntry[]; moved: boolean } {
  const nextFrom = [...from];
  const nextTo = [...to];
  const index = nextFrom.findIndex(
    (entry) => (entry.cardCode ?? entry.name.trim().toLowerCase()) === key,
  );
  if (index < 0) return { from: nextFrom, to: nextTo, moved: false };
  const entry = nextFrom[index]!;
  if (entry.count <= 1) nextFrom.splice(index, 1);
  else nextFrom[index] = { ...entry, count: entry.count - 1 };
  const targetIndex = nextTo.findIndex(
    (candidate) => (candidate.cardCode ?? candidate.name.trim().toLowerCase()) === key,
  );
  if (targetIndex >= 0) {
    const target = nextTo[targetIndex]!;
    nextTo[targetIndex] = { ...target, count: target.count + 1 };
  } else {
    nextTo.push({ ...entry, count: 1 });
  }
  return { from: nextFrom, to: nextTo, moved: true };
}
