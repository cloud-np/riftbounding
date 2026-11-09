/**
 * Chain (the stack) derivations: priority participants, resolve votes, modifier
 * keywords and the custom drag MIME (`application/x-riftbound-chain-entry`).
 */

import type { CardInstance, ChainEntry, Room, RoomPlayer, WireAction, Zone } from "@rift/protocol";

export const CHAIN_ENTRY_MIME = "application/x-riftbound-chain-entry";

const ROOM_CARD_ZONES = [
  "hand",
  "base",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
  "trash",
  "banished",
  "champion",
  "legend",
  "runeArea",
  "deck",
  "runeDeck",
] as const;

function findRoomCard(room: Room, cardId: string): CardInstance | undefined {
  for (const player of room.players) {
    const board = player.board as unknown as Record<string, unknown> | undefined;
    if (!board) continue;
    for (const zone of ROOM_CARD_ZONES) {
      const list = board[zone];
      if (!Array.isArray(list)) continue;
      const found = (list as CardInstance[]).find((card) => card.id === cardId);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * The board renders `chainEntries`, and a strict chain item is projected from `rules.chain`.
 * Triggered / activated items have no `cardSnapshot` (they are not card plays), so the
 * projection can only carry the source card's name. Attach the source card's printed identity
 * from its still-public board location so the existing chain card art/name renders. Hidden
 * chain cards keep their redacted placeholder (card backs only).
 */
export function chainDisplayEntry(entry: ChainEntry, room: Room): ChainEntry {
  if (entry.card.hidden || entry.card.isPlaceholder) return entry;
  const source = entry.sourceCardId ? findRoomCard(room, entry.sourceCardId) : undefined;
  if (!source) return entry;
  return {
    ...entry,
    card: {
      ...entry.card,
      name: entry.card.name.trim() ? entry.card.name : source.name,
      cardCode: entry.card.cardCode ?? source.cardCode,
      imageUrl: entry.card.imageUrl ?? source.imageUrl,
      type: entry.card.type ?? source.type,
    },
  };
}

/**
 * R4 gestures: in a strict room the sandbox chain/priority controls (Approve A, Resolve S,
 * showdown pass focus/response) mean "pass priority/focus", so send `rules_pass` directly.
 * Sandbox rooms keep their original vote/resolve actions. (The engine also maps these actions,
 * but sending the rules intent keeps the client independent of the server mapping.)
 */
export function chainControlIntent(room: Room, action: WireAction): WireAction {
  if (room.rulesMode === "strict" && room.phase === "in_game" && room.rules) {
    return { type: "rules_pass" };
  }
  return action;
}

export interface ChainEntryDragPayload {
  entryId: string;
  cardId: string;
}

export interface ChainPriority {
  latest: ChainEntry | null;
  owner: RoomPlayer | undefined;
  participants: RoomPlayer[];
  approvedPlayerIds: string[];
  allApproved: boolean;
  viewerIsOwner: boolean;
  viewerApproved: boolean;
  viewerIsParticipant: boolean;
  canApprove: boolean;
  canResolve: boolean;
  requiresExplicitOwnerPass: boolean;
  statusLabel: "ready" | "approved" | "pending" | "waiting";
}

export function activeChainPlayers(room: Room): RoomPlayer[] {
  return room.players.filter((player) => !!player.board && !player.leftAt);
}

export function chainOwner(room: Room): RoomPlayer | undefined {
  const entry = room.chainEntries[0];
  if (!entry) return undefined;
  return room.players.find((player) => player.id === entry.byPlayerId);
}

export function chainPriority(room: Room, viewerId: string, mode: string): ChainPriority {
  const latest = room.chainEntries[0] ?? null;
  const owner = latest
    ? room.players.find((player) => player.id === latest.byPlayerId)
    : undefined;
  const active = activeChainPlayers(room);
  const participants = latest
    ? active.filter((player) => player.id !== latest.byPlayerId)
    : [];
  const participantIds = new Set(participants.map((player) => player.id));
  const approvedPlayerIds = (room.chainResolveVotes ?? []).filter((id) => participantIds.has(id));
  const allApproved = participants.length === 0 || participants.every((player) => approvedPlayerIds.includes(player.id));
  const viewerIsOwner = !!latest && latest.byPlayerId === viewerId;
  const viewerIsParticipant = participantIds.has(viewerId);
  const viewerApproved = approvedPlayerIds.includes(viewerId);
  const canApprove = !!latest && !viewerIsOwner && viewerIsParticipant && !viewerApproved;
  const canResolve = !!latest && viewerIsOwner && (allApproved || mode !== "multiplayer");
  const requiresExplicitOwnerPass = false;
  const statusLabel: ChainPriority["statusLabel"] = !latest
    ? "waiting"
    : allApproved
      ? "approved"
      : viewerApproved
        ? "ready"
        : "pending";
  return {
    latest,
    owner,
    participants,
    approvedPlayerIds,
    allApproved,
    viewerIsOwner,
    viewerApproved,
    viewerIsParticipant,
    canApprove,
    canResolve,
    requiresExplicitOwnerPass,
    statusLabel,
  };
}

export function keywordsOf(entry: ChainEntry | null | undefined): string[] {
  return (entry?.card.keywords ?? []).map((keyword) => keyword.toLowerCase());
}

export function hasRepeatKeyword(entry: ChainEntry | null | undefined): boolean {
  const keywords = keywordsOf(entry);
  return keywords.includes("repeat") || /\brepeat\b/i.test(entry?.card.text ?? "");
}

export function hasFlowKeyword(entry: ChainEntry | null | undefined): boolean {
  const keywords = keywordsOf(entry);
  return keywords.includes("flow") || /\bflow\b/i.test(entry?.card.text ?? "");
}

export function isTimeWarpCard(entry: ChainEntry | null | undefined): boolean {
  if (!entry) return false;
  if (entry.card.cardCode === "OGN-122") return true;
  return /take a turn after this one/i.test(entry.card.text ?? "");
}

export function resolveDestination(entry: ChainEntry): Zone {
  return entry.flowEnabled ? "banished" : "trash";
}

export function chainDropMimeTypes(): string[] {
  return [CHAIN_ENTRY_MIME, "application/x-riftbound-card"];
}

export function writeChainEntryDrag(
  dataTransfer: DataTransfer,
  entry: Pick<ChainEntry, "id" | "card">,
): void {
  const payload: ChainEntryDragPayload = { entryId: entry.id, cardId: entry.card.id };
  dataTransfer.setData(CHAIN_ENTRY_MIME, JSON.stringify(payload));
  dataTransfer.setData("application/x-riftbound-chain-entry", JSON.stringify(payload));
  dataTransfer.setData("text/plain", entry.card.name);
  dataTransfer.effectAllowed = "move";
}

export function readChainEntryDrag(dataTransfer: DataTransfer): ChainEntryDragPayload | null {
  const raw = dataTransfer.getData(CHAIN_ENTRY_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ChainEntryDragPayload>;
    if (typeof parsed.entryId !== "string" || typeof parsed.cardId !== "string") return null;
    return { entryId: parsed.entryId, cardId: parsed.cardId };
  } catch {
    return null;
  }
}

export interface ChainBoardCardDrag {
  zone: Zone;
  cardId: string;
  hidden?: boolean;
}

export function readBoardCardDrag(dataTransfer: DataTransfer): ChainBoardCardDrag | null {
  const raw = dataTransfer.getData("application/x-riftbound-card");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ChainBoardCardDrag>;
    if (typeof parsed.cardId !== "string" || typeof parsed.zone !== "string") return null;
    return {
      zone: parsed.zone as Zone,
      cardId: parsed.cardId,
      ...(typeof parsed.hidden === "boolean" ? { hidden: parsed.hidden } : {}),
    };
  } catch {
    return null;
  }
}

/** Default `to` for `chain_resolve`: flow resolves to banished, everything else to trash. */
export function chainResolveDestination(entry: ChainEntry): Zone {
  return entry.flowEnabled ? "banished" : "trash";
}

/** Status copy shown in the panel header (uses the original i18n sentences). */
export function prioritySummary(
  priority: ChainPriority,
  translate: (key: string, params?: Record<string, string | number>) => string | null,
): string {
  if (!priority.latest) return translate("sim.tablet.emptyChain") ?? "The chain is empty";
  const passed = priority.approvedPlayerIds.length;
  const total = priority.participants.length;
  if (total === 0) return translate("sim.ready") ?? "Ready";
  if (priority.allApproved) return translate("sim.priorityPassedCount", { passed, total }) ?? `${passed}/${total} approved`;
  const waiting = priority.participants.find((player) => !priority.approvedPlayerIds.includes(player.id));
  if (waiting) {
    return (
      translate("sim.priorityPassedWithPlayer", {
        passed,
        total,
        playerName: waiting.name,
      }) ?? `${passed}/${total} passed · ${waiting.name} has priority`
    );
  }
  return translate("sim.priorityPassedCount", { passed, total }) ?? `${passed}/${total} approved`;
}
