import type { BattlefieldZone, CardInstance, ChainEntry, Room } from "@rift/protocol";
import type { ActionHandler } from "../types";
import {
  battlefieldZones,
  cloneCard,
  isBattlefieldZone,
  pruneDeckPeek,
  resetDeckPeek,
  zoneList,
} from "../state/board";
import {
  battlefieldCount,
  beginningStepAllyControls,
  isTeamOrFfa,
  turnOrderStartingAt,
} from "../state/selectors";
import {
  cardForInstance,
  getCard,
  hasFlow,
  hasRepeat,
  isSpellCardType,
} from "../catalog";
import {
  applyBattlefieldConquerAction,
  assistRequiresFocus,
  clearOptionalPasses,
  resolveChainEntry,
} from "../rules/chain";
import { battlefieldOwnerByZone } from "../rules/victory";
import { logDraft } from "../log/entries";
import { bool, str } from "./common";

function chainCard(room: Room, entryId: string): ChainEntry | undefined {
  return room.chainEntries.find((entry) => entry.id === entryId);
}

function battlefieldTitle(room: Room, zone: BattlefieldZone, cardId: string, context: Parameters<ActionHandler>[0]["context"]): CardInstance {
  let name = "Battlefield";
  let cardCode: string | undefined;
  if (room.battlefieldBrushByZone?.[zone]) name = "Brush";
  else if (zone === "battlefieldToken") {
    name = room.sharedBattlefieldToken?.active ? room.sharedBattlefieldToken.title : "Baron Pit";
  } else {
    const owner = battlefieldOwnerByZone(room).find((entry) => entry.zone === zone)?.player;
    name = (owner?.selectedBattlefield ?? "").trim() || "Battlefield";
    cardCode = owner?.selectedBattlefieldCardCode;
  }
  return {
    id: cardId,
    name,
    source: "mainDeck",
    exhausted: false,
    createdAt: context.now,
    type: "Battlefield",
    isPlaceholder: true,
    ...(cardCode ? { cardCode } : {}),
  };
}

/** orig: 35qz5rkx7yexy.js:23988 "chain_add" */
export const chainAdd: ActionHandler = ({ room, playerIndex, player, board, action, context }) => {
  if (!player.board || player.leftAt) return;
  const rawId = typeof action.clientEntryId === "string" ? action.clientEntryId.trim().slice(0, 120) : "";
  const entryId = rawId || context.idFactory("chain");
  if (room.chainEntries.some((entry) => entry.id === entryId)) return;
  const from = str(action.from);
  let card: CardInstance | null = null;
  let fromZone: ChainEntry["fromZone"];

  if (from === "battlefieldMarker") {
    const zone = typeof action.battlefieldZone === "string" ? action.battlefieldZone : "";
    if (!isBattlefieldZone(zone)) return;
    card = battlefieldTitle(room, zone, str(action.cardId), context);
    fromZone = "battlefieldMarker";
  } else if (from === "runeArea") {
    return;
  } else {
    const list = from === "deck" ? board.deck : zoneList(board, from);
    const index = list.findIndex((entry) => entry.id === str(action.cardId));
    const source = list[index];
    if (!source) return;
    if (source.hidden && !(isBattlefieldZone(from) && isSpellCardType(source))) return;
    card = cloneCard(source);
    fromZone = from as ChainEntry["fromZone"];
    if (from === "banished") {
      delete card.banishedByCardId;
      delete card.banishedByHiddenSourcePlayerId;
      delete card.banishedUntilEndingPlayerId;
    }
    if (card.hidden) {
      delete card.hidden;
      delete card.revealedToPlayerIds;
      delete card.revealedToOpponent;
    }
    if (isSpellCardType(source)) {
      list.splice(index, 1);
      if (from === "deck") pruneDeckPeek(board);
    }
    if (from === "deck") {
      board.deck = list;
      if (board.deckPeek.cardIds.length === 0) resetDeckPeek(board);
    }
  }
  if (!card) return;

  const focus =
    assistRequiresFocus(room, player.id) ||
    (isTeamOrFfa(room) && room.chainEntries.some((entry) => entry.passesShowdownFocusOnResolution === true));
  if (isTeamOrFfa(room) && focus && room.chainEntries.length > 0) {
    const last = room.chainEntries[room.chainEntries.length - 1];
    if (last && last.passesShowdownFocusOnResolution !== true) {
      room.chainEntries[room.chainEntries.length - 1] = { ...last, passesShowdownFocusOnResolution: true };
    }
  }
  const entry: ChainEntry = {
    id: entryId,
    card: { ...card, id: entryId, exhausted: false },
    addedAt: context.now,
    fromZone,
    sourceCardId: card.id,
    byPlayerId: player.id,
    byPlayerName: player.name,
    passesShowdownFocusOnResolution:
      room.chainEntries.length === 0 && room.pendingBattlefieldConquerAssist ? focus : undefined,
  };
  room.chainEntries.unshift(entry);
  room.chainResolveVotes = [];
  clearOptionalPasses(room);
};

/** orig: 35qz5rkx7yexy.js:24120 "chain_set_repeat" */
export const chainSetRepeat: ActionHandler = ({ room, player, action, context }) => {
  const top = room.chainEntries[0];
  if (!top || top.id !== str(action.entryId) || top.byPlayerId !== player.id) return;
  if (!isSpellCardType(top.card) || !hasRepeat(top.card)) return;
  const enabled = bool(action.enabled);
  if (!!top.repeatEnabled === enabled) return;
  room.chainEntries[0] = { ...top, repeatEnabled: enabled };
  context.log(
    logDraft(enabled ? "markedRepeat" : "clearedRepeat", { card: top.card.name }, {
      authorPlayerId: player.id,
      actionKind: "spell",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:24139 "chain_set_flow" */
export const chainSetFlow: ActionHandler = ({ room, player, action }) => {
  const top = room.chainEntries[0];
  if (!top || top.id !== str(action.entryId) || top.byPlayerId !== player.id) return;
  if (!isSpellCardType(top.card) || !hasFlow(top.card)) return;
  const enabled = bool(action.enabled);
  if (!!top.flowEnabled === enabled) return;
  room.chainEntries[0] = { ...top, flowEnabled: enabled };
};

/** orig: 35qz5rkx7yexy.js:24158 "chain_set_resolve_vote" */
export const chainSetResolveVote: ActionHandler = ({ room, player, action }) => {
  const top = room.chainEntries[0];
  if (!top || str(action.entryId) !== top.id || typeof action.approved !== "boolean") return;
  const order = turnOrderStartingAt(room, top.byPlayerId);
  const voters = order.filter((id) => id !== top.byPlayerId);
  if (!voters.includes(player.id)) return;
  const votes = voters.filter((id) => room.chainResolveVotes.includes(id));
  const approved = bool(action.approved);
  if (votes.includes(player.id) === approved) return;
  room.chainResolveVotes = approved ? [...votes, player.id] : votes.filter((id) => id !== player.id);
};

/** orig: 35qz5rkx7yexy.js:24173 "chain_resolve" */
export const chainResolve: ActionHandler = ({ room, player, action }) => {
  const entryId = str(action.entryId);
  const top = room.chainEntries[0];
  if (!top || top.id !== entryId || top.byPlayerId !== player.id) return;
  const destination = typeof action.to === "string" ? action.to : undefined;
  resolveChainEntry(room, player.id, entryId, destination);
};

/** orig: 35qz5rkx7yexy.js:24255-24259 "battlefield_conquer_*" (cM) */
export const battlefieldConquer: ActionHandler = ({ room, playerIndex, action, context }) => {
  applyBattlefieldConquerAction(
    room,
    playerIndex,
    {
      type: action.type,
      ...(typeof action.zone === "string" ? { zone: action.zone } : {}),
      ...(action.passed !== undefined ? { passed: action.passed } : {}),
    },
    (draft) => context.log(draft),
  );
};
