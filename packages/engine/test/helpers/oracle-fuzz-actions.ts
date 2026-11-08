/**
 * Legal-ish random action generator for the heavy oracle fuzz.
 *
 * Every payload is drawn from the *current* room (real card ids in the zones the handler
 * reads, real chain-entry ids, payment groups, counters, tokens, deck-peek ids, arrows,
 * Time Warp, Flow/Repeat, conquer stages). If a precondition truly cannot be produced the
 * generator still emits a syntactically valid action with a `missing-*` id, so coverage of
 * the wire type is guaranteed; that action is then a noop in both engines.
 *
 * The generator is deterministic: all choices come from the supplied `random()`.
 */
import type { CardInstance, ChainEntry, PlayerBoard, Room } from "@rift/protocol";

export type FuzzAction = Record<string, unknown> & { type: string };
export interface FuzzStep {
  actor: string;
  action: FuzzAction;
}

const FIELD_ZONES = ["battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"] as const;
const LABEL_ZONES = [
  "base",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
  "legend",
  "runeArea",
] as const;
const BOARD_ZONES = [
  "hand",
  "base",
  "trash",
  "banished",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
  "champion",
  "legend",
  "runeArea",
] as const;

function pick<T>(random: () => number, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

function coin(random: () => number): boolean {
  return random() < 0.5;
}

type Player = Room["players"][number];

function hasBoard(player: Player): player is Player & { board: PlayerBoard } {
  return !!player.board && !player.leftAt;
}

function playersWithBoards(room: Room): Array<Player & { board: PlayerBoard }> {
  return room.players.filter(hasBoard);
}

function zoneCards(board: PlayerBoard, zone: string): CardInstance[] {
  switch (zone) {
    case "hand":
      return board.hand;
    case "base":
      return board.base;
    case "trash":
      return board.trash;
    case "banished":
      return board.banished;
    case "battlefieldA":
      return board.battlefieldA;
    case "battlefieldB":
      return board.battlefieldB;
    case "battlefieldC":
      return board.battlefieldC ?? [];
    case "battlefieldToken":
      return board.battlefieldToken;
    case "champion":
      return board.champion;
    case "legend":
      return board.legend;
    case "runeArea":
      return board.runeArea;
    case "deck":
      return board.deck;
    case "runeDeck":
      return board.runeDeck;
    default:
      return [];
  }
}

function typeOf(card: CardInstance): string {
  return String(card.type ?? "").toLowerCase();
}

function isUnit(card: CardInstance): boolean {
  return typeOf(card).includes("unit");
}

function isGear(card: CardInstance): boolean {
  return typeOf(card).includes("gear");
}

function named(card: CardInstance, needle: string): boolean {
  return String(card.name ?? "").toLowerCase().includes(needle.toLowerCase());
}

function findCard(
  room: Room,
  predicate: (card: CardInstance, player: Player, zone: string) => boolean,
): { player: Player & { board: PlayerBoard }; card: CardInstance; zone: string } | null {
  for (const player of playersWithBoards(room)) {
    for (const zone of BOARD_ZONES) {
      const card = zoneCards(player.board, zone).find((candidate) =>
        predicate(candidate, player, zone),
      );
      if (card) return { player, card, zone };
    }
  }
  return null;
}

function actorBoard(room: Room, actorId: string): { player: Player & { board: PlayerBoard }; board: PlayerBoard } | null {
  const player = room.players.find((candidate) => candidate.id === actorId);
  return player && player.board ? { player: player as Player & { board: PlayerBoard }, board: player.board } : null;
}

function otherPlayer(
  room: Room,
  actorId: string,
  random: () => number,
): (Player & { board: PlayerBoard }) | undefined {
  return pick(random, playersWithBoards(room).filter((player) => player.id !== actorId));
}

function defaultActor(room: Room, random: () => number): Player {
  const active = room.players.find((player) => player.id === room.activeTurnPlayerId && hasBoard(player));
  const candidates = playersWithBoards(room);
  if (active && random() < 0.7) return active;
  return pick(random, candidates) ?? room.players[0]!;
}

function cardId(card: CardInstance | undefined, fallback = "missing-card"): string {
  return card?.id ?? fallback;
}

function observed(room: Room): Record<string, unknown> {
  return {
    turnNumber: room.turnNumber,
    activePlayerId: room.activeTurnPlayerId,
    activeStep: room.activeTurnStep,
  };
}

function firstZoneCard(
  board: PlayerBoard,
  zones: readonly string[],
  predicate?: (card: CardInstance) => boolean,
): { card: CardInstance; zone: string } | null {
  for (const zone of zones) {
    const card = zoneCards(board, zone).find((candidate) => !predicate || predicate(candidate));
    if (card) return { card, zone };
  }
  return null;
}

/* ------------------------------------------------------------------ payment helpers */

function paymentOperations(room: Room, actorId: string, random: () => number): Record<string, unknown>[] {
  const actor = actorBoard(room, actorId);
  const ops: Record<string, unknown>[] = [];
  if (!actor) return ops;
  const board = actor.board;
  const readyRune = board.runeArea.find((rune) => !rune.exhausted);
  if (readyRune) {
    ops.push({
      type: "toggle_exhausted",
      zone: "runeArea",
      cardId: readyRune.id,
      expectedExhausted: false,
    });
  }
  const resource = coin(random) ? "energy" : "power";
  const available = resource === "energy" ? board.floatingEnergy : board.floatingPower;
  if (available > 0) {
    ops.push({ type: "adjust_floating_resource", resource, delta: -1 });
  }
  const labelled = firstZoneCard(board, ["base", "battlefieldA", "legend", "runeArea"]);
  if (labelled) {
    ops.push({
      type: "set_card_label",
      zone: labelled.zone,
      cardId: labelled.card.id,
      slot: Math.floor(random() * 3),
      label: pick(random, ["Buff", "Shield 2", "Empowered", ""]) ?? "",
    });
  }
  if (ops.length === 0) ops.push({ type: "adjust_floating_resource", resource: "energy", delta: 1 });
  return ops;
}

function runeOperations(board: PlayerBoard, random: () => number): Record<string, unknown>[] {
  const ops: Record<string, unknown>[] = [];
  const rune = pick(random, board.runeArea);
  const choice = Math.floor(random() * 4);
  if (choice === 0) ops.push({ type: "draw_rune", exhausted: coin(random) });
  else if (rune) {
    if (choice === 1) ops.push({ type: "set_rune_exhausted", cardId: rune.id, exhausted: !rune.exhausted });
    else if (choice === 2) ops.push({ type: "send_rune_to_deck_bottom", cardId: rune.id });
    else ops.push({ type: "recycle_rune_for_floating_energy", cardId: rune.id });
  } else {
    ops.push({ type: "draw_rune" });
  }
  return ops;
}

function floatingOperations(board: PlayerBoard, random: () => number): Record<string, unknown>[] {
  if (coin(random)) return [{ type: "clear_floating_resources" }];
  return [
    {
      type: "adjust_floating_resource",
      resource: coin(random) ? "energy" : "power",
      delta: coin(random) ? 1 : -1,
    },
  ];
}

/* ------------------------------------------------------------------ builder */

export function buildFuzzAction(type: string, room: Room, random: () => number): FuzzStep {
  const fallbackActor = defaultActor(room, random);
  const actorId = fallbackActor.id;
  const actor = actorBoard(room, actorId);
  const board = actor?.board;

  switch (type) {
    case "roll_die":
      return { actor: actorId, action: { type, sides: pick(random, [4, 6, 8, 10, 12, 20]) } };

    case "set_show_legend_xp_counter":
      return { actor: actorId, action: { type, visible: coin(random) } };
    case "set_stop_at_beginning_phase":
      return { actor: actorId, action: { type, enabled: coin(random) } };
    case "set_skip_draw_phase":
      return { actor: actorId, action: { type, enabled: coin(random) } };
    case "set_auto_score_from_hold":
      return { actor: actorId, action: { type, enabled: coin(random) } };
    case "end_beginning_phase":
      return { actor: room.activeTurnPlayerId ?? actorId, action: { type, observed: observed(room) } };
    case "end_turn":
      return { actor: room.activeTurnPlayerId ?? actorId, action: { type, observed: observed(room) } };
    case "set_extra_turn": {
      const entry = room.chainEntries.find(
        (candidate) => isTimeWarpEntry(candidate) || candidate.byPlayerId === actorId,
      );
      const pending = room.pendingExtraTurns ?? [];
      const enabled = !pending.some((candidate) => candidate.sourceEntryId === entry?.id);
      return {
        actor: entry?.byPlayerId ?? actorId,
        action: { type, entryId: entry?.id ?? "missing-chain", enabled },
      };
    }
    case "set_score":
      return { actor: actorId, action: { type, score: Math.floor(random() * 10) - (coin(random) ? 1 : 0) } };
    case "adjust_score":
      return { actor: actorId, action: { type, delta: pick(random, [-2, -1, 1, 2]) } };
    case "floating_resource_batch":
      return { actor: actorId, action: { type, operations: board ? floatingOperations(board, random) : [{ type: "clear_floating_resources" }] } };
    case "adjust_floating_resource":
      return {
        actor: actorId,
        action: {
          type,
          resource: coin(random) ? "energy" : "power",
          delta: coin(random) ? 1 : -1,
        },
      };
    case "clear_floating_resources":
      return { actor: actorId, action: { type } };
    case "adjust_legend_xp":
      return { actor: actorId, action: { type, delta: pick(random, [-2, -1, 1, 2]) } };

    case "set_hand_reveal": {
      const target = coin(random) ? otherPlayer(room, actorId, random) : undefined;
      return {
        actor: actorId,
        action: {
          type,
          reveal: !(board?.handRevealToOpponent ?? false),
          ...(target ? { targetPlayerId: target.id } : {}),
          ...(coin(random) ? { audience: pick(random, ["all_other_players", "teammates", "opponents"]) } : {}),
        },
      };
    }
    case "toggle_exhausted": {
      const found = board ? firstZoneCard(board, ["runeArea", "base", "battlefieldA", "battlefieldB", "legend"]) : null;
      return {
        actor: actorId,
        action: {
          type,
          zone: found?.zone ?? "base",
          cardId: cardId(found?.card),
          expectedExhausted: found?.card.exhausted ?? false,
        },
      };
    }
    case "draw_rune":
      return { actor: actorId, action: { type, exhausted: coin(random) } };
    case "send_rune_to_deck_bottom":
      return { actor: actorId, action: { type, cardId: cardId(pick(random, board?.runeArea ?? [])) } };
    case "recycle_rune_for_floating_energy":
      return {
        actor: actorId,
        action: {
          type,
          cardId: cardId(pick(random, board?.runeArea ?? [])),
          ...(coin(random) ? { paymentGroupOrigin: "auto_pay_button" } : {}),
        },
      };
    case "send_to_rune_deck":
      return {
        actor: actorId,
        action: {
          type,
          from: "runeArea",
          cardId: cardId(pick(random, board?.runeArea ?? [])),
          position: coin(random) ? "top" : "bottom",
        },
      };
    case "draw_cards":
      return {
        actor: actorId,
        action: {
          type,
          count: 1 + Math.floor(random() * 3),
          ...(coin(random) ? { to: pick(random, ["hand", "base", "battlefieldA", "banished"]) } : {}),
        },
      };
    case "payment_batch":
      return { actor: actorId, action: { type, operations: paymentOperations(room, actorId, random) } };
    case "rune_batch":
      return { actor: actorId, action: { type, operations: board ? runeOperations(board, random) : [{ type: "draw_rune" }] } };
    case "create_token": {
      const zone = pick(random, ["base", "battlefieldA", "battlefieldB", "battlefieldToken"]) ?? "base";
      return {
        actor: actorId,
        action: {
          type,
          zone,
          name: pick(random, ["Recruit", "Baron Nashor", "Turret", "Clone"]) ?? "Recruit",
          count: 1 + (coin(random) ? 1 : 0),
          ...(coin(random) ? { exhausted: coin(random) } : {}),
          ...(coin(random) ? { clientCardIds: [`card_cfuzz_${Math.floor(random() * 1e6)}`] } : {}),
        },
      };
    }
    case "set_battlefield_brush": {
      const ivern = findCard(
        room,
        (card, _player, zone) => zone === "legend" && named(card, "Ivern"),
      );
      const owner = ivern?.player ?? actor?.player;
      const zone = pick(random, FIELD_ZONES) ?? "battlefieldA";
      const active = !room.battlefieldBrushByZone?.[zone];
      return { actor: owner?.id ?? actorId, action: { type, zone, active } };
    }
    case "duplicate_card": {
      const found = board
        ? firstZoneCard(board, ["hand", "base", "battlefieldA", "battlefieldB"])
        : null;
      const target = otherPlayer(room, actorId, random);
      const useOpponent = !!target && coin(random);
      const opponentCard = useOpponent ? firstZoneCard(target!.board, ["base", "battlefieldA"]) : null;
      return {
        actor: actorId,
        action: {
          type,
          zone: opponentCard?.zone ?? found?.zone ?? "hand",
          cardId: cardId(opponentCard?.card ?? found?.card),
          ...(useOpponent ? { owner: "opponent", targetPlayerId: target!.id } : {}),
          ...(coin(random) ? { clientCardId: `card_cfuzz_${Math.floor(random() * 1e6)}` } : {}),
        },
      };
    }
    case "peek_deck_top":
      return {
        actor: actorId,
        action: { type, count: 1 + Math.floor(random() * 4), zone: coin(random) ? "runeDeck" : "deck" },
      };
    case "peek_deck_bottom":
      return { actor: actorId, action: { type } };
    case "clear_deck_peek":
      return { actor: actorId, action: { type, zone: coin(random) ? "runeDeck" : "deck" } };
    case "dismiss_deck_peek":
      return { actor: actorId, action: { type, zone: coin(random) ? "runeDeck" : "deck" } };
    case "recycle_deck_peek_card": {
      const peek = board?.deckPeek?.cardIds ?? [];
      return {
        actor: actorId,
        action: { type, cardId: pick(random, peek) ?? "missing-peek", zone: coin(random) ? "runeDeck" : "deck" },
      };
    }
    case "put_deck_peek_card_on_top": {
      const peek = board?.deckPeek?.cardIds ?? [];
      return {
        actor: actorId,
        action: { type, cardId: pick(random, peek) ?? "missing-peek", zone: coin(random) ? "runeDeck" : "deck" },
      };
    }
    case "set_deck_peek_card_reveal": {
      const peek = board?.deckPeek?.cardIds ?? [];
      return {
        actor: actorId,
        action: {
          type,
          cardId: pick(random, peek) ?? "missing-peek",
          reveal: coin(random),
          zone: coin(random) ? "runeDeck" : "deck",
          ...(coin(random) ? { targetPlayerId: otherPlayer(room, actorId, random)?.id } : {}),
          ...(coin(random) ? { audience: pick(random, ["all_other_players", "teammates", "opponents"]) } : {}),
          ...(coin(random) ? { autoRevealNewCards: coin(random) } : {}),
        },
      };
    }
    case "set_deck_peek_cards_reveal": {
      const peek = board?.deckPeek?.cardIds ?? [];
      return {
        actor: actorId,
        action: {
          type,
          cardIds: peek.length > 0 ? peek.slice(0, 1 + Math.floor(random() * peek.length)) : ["missing-peek"],
          reveal: coin(random),
          zone: coin(random) ? "runeDeck" : "deck",
          ...(coin(random) ? { autoRevealNewCards: coin(random) } : {}),
        },
      };
    }
    case "shuffle_deck":
      return { actor: actorId, action: { type, ...(coin(random) ? { preserveRecycledBottom: true } : {}) } };
    case "set_card_revealed_to_opponent": {
      const found = board ? firstZoneCard(board, ["base", "hand", "battlefieldA", "battlefieldB"]) : null;
      return {
        actor: actorId,
        action: {
          type,
          zone: found?.zone ?? "hand",
          cardId: cardId(found?.card),
          revealed: !(found?.card.revealedToOpponent ?? false),
          ...(coin(random) ? { targetPlayerId: otherPlayer(room, actorId, random)?.id } : {}),
          ...(coin(random) ? { audience: pick(random, ["all_other_players", "teammates", "opponents"]) } : {}),
        },
      };
    }
    case "set_card_hidden": {
      const hidden = findCard(room, (card) => card.hidden === true);
      const target = hidden && hidden.player.id === actorId ? hidden : null;
      const hand = board ? firstZoneCard(board, ["hand"]) : null;
      if (target) {
        return {
          actor: actorId,
          action: { type, zone: target.zone, cardId: target.card.id, hidden: false },
        };
      }
      return {
        actor: actorId,
        action: {
          type,
          zone: hand?.zone ?? "hand",
          cardId: cardId(hand?.card),
          hidden: true,
        },
      };
    }
    case "take_top_from_deck": {
      const source = board ? firstZoneCard(board, ["base", "battlefieldA"], (card) => isGear(card)) : null;
      return {
        actor: actorId,
        action: {
          type,
          to: pick(random, ["hand", "base", "battlefieldA", "banished"]) ?? "hand",
          ...(source && coin(random) && coin(random) ? { sourceCardId: source.card.id } : {}),
        },
      };
    }
    case "unlink_banished_card": {
      for (const player of playersWithBoards(room)) {
        for (const other of playersWithBoards(room)) {
          const linked = other.board.banished.find((card) => !!card.banishedByCardId);
          if (!linked) continue;
          const source = player.board.base.find((card) => card.id === linked.banishedByCardId) ??
            [...player.board.battlefieldA, ...player.board.battlefieldB].find(
              (card) => card.id === linked.banishedByCardId,
            );
          if (source) {
            return { actor: player.id, action: { type, cardId: linked.id, zone: "battlefieldA", targetCardId: linked.id } };
          }
        }
      }
      return { actor: actorId, action: { type, cardId: "missing-banished" } };
    }
    case "dockside_banish_unit": {
      const source = findCard(room, (card, _player, zone) =>
        (FIELD_ZONES as readonly string[]).includes(zone) && named(card, "Dockside Lock-Up"),
      );
      const zone = (source?.zone ?? "battlefieldA") as string;
      const target = source
        ? findCard(room, (card, player, candidateZone) =>
            player.id !== source.player.id &&
            candidateZone === zone &&
            isUnit(card) &&
            !card.hidden,
          )
        : null;
      return {
        actor: source?.player.id ?? actorId,
        action: {
          type,
          zone,
          cardId: source?.card.id ?? "missing-dockside",
          targetCardId: target?.card.id ?? "missing-target",
        },
      };
    }
    case "dockside_play_banished": {
      const source = findCard(room, (card, _player, zone) =>
        (FIELD_ZONES as readonly string[]).includes(zone) && named(card, "Dockside Lock-Up"),
      );
      const linked = source
        ? findCard(room, (card) => card.banishedByCardId === source.card.id && isUnit(card))
        : null;
      return {
        actor: source?.player.id ?? actorId,
        action: {
          type,
          zone: source?.zone ?? "battlefieldA",
          cardId: source?.card.id ?? "missing-dockside",
          banishedCardId: linked?.card.id ?? "missing-banished",
          to: pick(random, ["base", "battlefieldA", "battlefieldB"]) ?? "base",
        },
      };
    }
    case "kharox_play_from_trash": {
      const source = findCard(
        room,
        (card) =>
          named(card, "Kharox") &&
          !card.empowerTriggerUsed &&
          (card.customLabels ?? []).some((label) => String(label).toLowerCase() === "empowered"),
      );
      const target = source
        ? playersWithBoards(room).find(
            (player) =>
              player.id !== source.player.id &&
              player.board.trash.some((card) => isUnit(card)),
          )
        : undefined;
      const trashCard = target?.board.trash.find((card) => isUnit(card));
      return {
        actor: source?.player.id ?? actorId,
        action: {
          type,
          zone: source?.zone ?? "base",
          cardId: source?.card.id ?? "missing-kharox",
          targetPlayerId: target?.id ?? "missing-player",
          trashCardId: trashCard?.id ?? "missing-trash",
          to: pick(random, ["base", "battlefieldA"]) ?? "base",
        },
      };
    }
    case "take_card_from_deck": {
      const card = pick(random, board?.deck ?? []);
      return {
        actor: actorId,
        action: {
          type,
          cardId: cardId(card),
          to: pick(random, ["hand", "base", "battlefieldA", "banished"]) ?? "hand",
        },
      };
    }
    case "equip_card": {
      const gear = board
        ? firstZoneCard(board, ["base", "hand"], (card) => isGear(card))
        : null;
      const unit = board ? firstZoneCard(board, ["base", "battlefieldA", "battlefieldB"], (card) => isUnit(card)) : null;
      return {
        actor: actorId,
        action: {
          type,
          equipmentCardId: cardId(gear?.card),
          unitCardId: cardId(unit?.card),
          ...(gear?.zone === "hand" ? { asAttachment: true } : {}),
        },
      };
    }
    case "adjust_card_might": {
      const found = board ? firstZoneCard(board, LABEL_ZONES) : null;
      return {
        actor: actorId,
        action: { type, zone: found?.zone ?? "base", cardId: cardId(found?.card), delta: pick(random, [-2, -1, 1, 2]) },
      };
    }
    case "adjust_card_counter": {
      const found = board ? firstZoneCard(board, LABEL_ZONES) : null;
      return {
        actor: actorId,
        action: {
          type,
          zone: found?.zone ?? "base",
          cardId: cardId(found?.card),
          counter: coin(random) ? "white" : "red",
          delta: pick(random, [-2, -1, 1, 2]),
          ...(coin(random) ? { initializeAtUnitMight: coin(random) } : {}),
        },
      };
    }
    case "clear_card_counter": {
      const found = board
        ? firstZoneCard(board, LABEL_ZONES, (card) => !!card.whiteCounter || !!card.redCounter)
        : null;
      return {
        actor: actorId,
        action: {
          type,
          zone: found?.zone ?? "base",
          cardId: cardId(found?.card),
          counter: found?.card.redCounter ? "red" : "white",
        },
      };
    }
    case "animate_orianna_gear": {
      const legend = findCard(room, (card, _player, zone) => zone === "legend" && named(card, "Orianna"));
      const gear = legend
        ? firstZoneCard(legend.player.board, ["base", ...FIELD_ZONES], (card) => isGear(card))
        : null;
      return {
        actor: legend?.player.id ?? actorId,
        action: {
          type,
          legendId: legend?.card.id ?? "missing-legend",
          zone: gear?.zone ?? "base",
          cardId: cardId(gear?.card),
        },
      };
    }
    case "choose_neeko_legend": {
      const neeko = findCard(room, (card) => named(card, "Neeko, Blending In"));
      const returnCopy = neeko
        ? room.players
            .flatMap((player) => player.board?.legend ?? [])
            .find((card) => card.neekoSourceCardId === neeko.card.id)
        : undefined;
      const additional = neeko?.player.board.additionalLegends?.[0];
      const legendId = returnCopy ? null : (additional?.id ?? null);
      return {
        actor: neeko?.player.id ?? actorId,
        action: {
          type,
          neekoCardId: neeko?.card.id ?? "missing-neeko",
          zone: neeko?.zone ?? "base",
          legendId,
        },
      };
    }
    case "set_card_label": {
      const found = board ? firstZoneCard(board, LABEL_ZONES) : null;
      return {
        actor: actorId,
        action: {
          type,
          zone: found?.zone ?? "base",
          cardId: cardId(found?.card),
          slot: Math.floor(random() * 3),
          label: pick(random, ["Buff", "Shield 2", "Empowered", "", "Marked 1"]) ?? "Buff",
          ...(coin(random) ? { countDelta: coin(random) ? 1 : -1 } : {}),
          ...(coin(random) ? { owner: "opponent", targetPlayerId: otherPlayer(room, actorId, random)?.id } : {}),
        },
      };
    }

    case "move_card": {
      const pairs: Array<[string, string]> = [
        ["hand", "base"],
        ["hand", "battlefieldA"],
        ["hand", "battlefieldB"],
        ["base", "battlefieldA"],
        ["base", "battlefieldB"],
        ["battlefieldA", "base"],
        ["battlefieldB", "base"],
        ["base", "hand"],
        ["battlefieldA", "hand"],
        ["battlefieldA", "battlefieldB"],
        ["base", "trash"],
        ["battlefieldA", "trash"],
        ["hand", "trash"],
        ["deck", "hand"],
      ];
      const valid = board
        ? pairs.filter(([from]) => zoneCards(board, from).length > 0)
        : [];
      const pair = pick(random, valid) ?? ["hand", "base"] as [string, string];
      const card = board ? pick(random, zoneCards(board, pair[0])) : undefined;
      return {
        actor: actorId,
        action: {
          type,
          from: pair[0],
          to: pair[1],
          cardId: cardId(card),
          ...(coin(random) ? { toIndex: Math.floor(random() * 4) } : {}),
          ...(coin(random) ? { asHidden: coin(random) } : {}),
        },
      };
    }
    case "move_cards_to_trash_batch": {
      const from = pick(random, ["base", "battlefieldA", "battlefieldB", "hand"]) ?? "base";
      const cards = board ? zoneCards(board, from) : [];
      const ids = cards.slice(0, 1 + Math.floor(random() * Math.min(2, Math.max(1, cards.length)))).map((card) => card.id);
      return { actor: actorId, action: { type, from, cardIds: ids.length > 0 ? ids : ["missing-card"] } };
    }
    case "move_off_board_cards_batch": {
      const from = pick(random, ["battlefieldA", "battlefieldB"]) ?? "battlefieldA";
      const cards = board ? zoneCards(board, from) : [];
      const ids = cards.slice(0, 1 + Math.floor(random() * Math.min(2, Math.max(1, cards.length)))).map((card) => card.id);
      return {
        actor: actorId,
        action: {
          type,
          from,
          to: pick(random, ["base", "hand"]) ?? "base",
          cardIds: ids.length > 0 ? ids : ["missing-card"],
        },
      };
    }
    case "recycle_all_trash_to_deck":
      return { actor: actorId, action: { type } };
    case "transfer_card_control": {
      const found = board ? firstZoneCard(board, ["base", "battlefieldA", "battlefieldB"]) : null;
      return {
        actor: actorId,
        action: {
          type,
          zone: found?.zone ?? "base",
          cardId: cardId(found?.card),
          targetPlayerId: otherPlayer(room, actorId, random)?.id ?? "missing-player",
        },
      };
    }
    case "send_to_deck": {
      const found = board ? firstZoneCard(board, ["hand", "base", "battlefieldA", "trash"]) : null;
      return {
        actor: actorId,
        action: {
          type,
          from: found?.zone ?? "hand",
          cardId: cardId(found?.card),
          position: coin(random) ? "top" : "bottom",
        },
      };
    }

    case "chain_add": {
      const priorityCards = board
        ? [...board.hand, ...board.base].filter(
            (card) =>
              named(card, "Time Warp") ||
              (card.keywords ?? []).some((keyword) => /^(repeat|flow)$/i.test(String(keyword))),
          )
        : [];
      const card = pick(random, priorityCards) ?? (board ? pick(random, board.hand) : undefined);
      if (coin(random) && coin(random)) {
        return {
          actor: actorId,
          action: {
            type,
            from: "battlefieldMarker",
            cardId: `marker-${Math.floor(random() * 1e6)}`,
            battlefieldZone: pick(random, FIELD_ZONES),
            ...(coin(random) ? { clientEntryId: `chain_q${Math.floor(random() * 1e6)}` } : {}),
          },
        };
      }
      return {
        actor: actorId,
        action: {
          type,
          from: "hand",
          cardId: cardId(card),
          ...(coin(random) ? { clientEntryId: `chain_q${Math.floor(random() * 1e6)}` } : {}),
        },
      };
    }
    case "chain_set_repeat": {
      const top = room.chainEntries[0];
      return {
        actor: top?.byPlayerId ?? actorId,
        action: { type, entryId: top?.id ?? "missing-chain", enabled: !(top?.repeatEnabled ?? false) },
      };
    }
    case "chain_set_flow": {
      const top = room.chainEntries[0];
      return {
        actor: top?.byPlayerId ?? actorId,
        action: { type, entryId: top?.id ?? "missing-chain", enabled: !(top?.flowEnabled ?? false) },
      };
    }
    case "chain_set_resolve_vote": {
      const top = room.chainEntries[0];
      const voter = top
        ? pick(random, room.players.filter((player) => player.id !== top.byPlayerId))
        : undefined;
      return {
        actor: voter?.id ?? actorId,
        action: { type, entryId: top?.id ?? "missing-chain", approved: coin(random) },
      };
    }
    case "chain_resolve": {
      const top = room.chainEntries[0];
      return {
        actor: top?.byPlayerId ?? actorId,
        action: {
          type,
          entryId: top?.id ?? "missing-chain",
          ...(coin(random) ? { to: pick(random, ["trash", "banished", "hand", "deck_top", "deck_bottom"]) } : {}),
        },
      };
    }

    case "battlefield_conquer_pass_focus":
    case "battlefield_conquer_pass_response":
    case "battlefield_conquer_set_optional_pass":
    case "battlefield_conquer_dismiss":
    case "battlefield_conquer_confirm": {
      const assist = room.pendingBattlefieldConquerAssist;
      const zone = assist?.zone ?? "battlefieldA";
      const multiplayer = room.players.length > 2;
      const defender = assist?.actualDefenderPlayerId ?? assist?.defenderPlayerId;
      let conquerActor = actorId;
      if (assist) {
        if (type === "battlefield_conquer_pass_response") {
          conquerActor = defender ?? assist.attackerPlayerId;
        } else if (type === "battlefield_conquer_set_optional_pass") {
          const third = playersWithBoards(room).find(
            (player) => player.id !== assist.attackerPlayerId && player.id !== defender,
          );
          conquerActor = third?.id ?? defender ?? assist.attackerPlayerId;
        } else if (type === "battlefield_conquer_pass_focus") {
          conquerActor =
            assist.stage === "defender_response"
              ? (defender ?? assist.attackerPlayerId)
              : assist.attackerPlayerId;
        } else {
          conquerActor = assist.attackerPlayerId;
        }
      }
      return {
        actor: conquerActor,
        action: { type, zone, ...(type === "battlefield_conquer_set_optional_pass" ? { passed: coin(random) } : {}) },
      };
    }

    case "rewind_last_action":
    case "forward_last_rewind":
      return { actor: actorId, action: { type } };
    case "respond_rewind_confirmation": {
      const pending = room.rewindConfirmation;
      if (!pending) {
        return {
          actor: actorId,
          action: { type, requestId: "missing-request", response: "decline" },
        };
      }
      const approvers = pending.approverPlayerIds ?? [pending.approverPlayerId];
      const canCancel = coin(random);
      const actor = canCancel
        ? pending.requesterPlayerId
        : (pick(random, approvers) ?? pending.approverPlayerId);
      return {
        actor,
        action: {
          type,
          requestId: pending.requestId,
          response: canCancel ? "cancel" : coin(random) ? "approve" : "decline",
        },
      };
    }

    case "target_arrow_add":
    case "target_arrow_remove":
    case "target_arrow_remove_from_source":
    case "target_arrow_clear_all": {
      if (type === "target_arrow_clear_all") return { actor: actorId, action: { type } };
      const own = board ? [...board.base, ...board.battlefieldA, ...board.battlefieldB] : [];
      const all = playersWithBoards(room).flatMap((player) => [
        ...player.board.base,
        ...player.board.battlefieldA,
        ...player.board.battlefieldB,
        ...player.board.legend,
      ]);
      const existing = pick(random, room.targetArrowsByPlayer?.[actorId] ?? []);
      const source = existing?.sourceCardId ?? cardId(pick(random, own));
      const target = existing?.targetCardId ?? cardId(pick(random, all));
      const sourceAnchor = existing?.sourceAnchor ?? "board";
      const targetAnchor = existing?.targetAnchor ?? "board";
      if (type === "target_arrow_remove_from_source") {
        return { actor: actorId, action: { type, sourceCardId: source, sourceAnchor } };
      }
      return { actor: actorId, action: { type, sourceCardId: source, targetCardId: target, sourceAnchor, targetAnchor } };
    }

    default:
      return { actor: actorId, action: { type } };
  }
}

function isTimeWarpEntry(entry: ChainEntry): boolean {
  return entry.card?.cardCode === "OGN-122" || /time warp/i.test(entry.card?.name ?? "");
}

/** All 70 transition actions the original bundle can execute (cU 66 + 4 arrow actions). */
export function oracleActionTypes(original: { raw: { cU: Record<string, unknown> } }): string[] {
  return [
    ...Object.keys(original.raw.cU),
    "target_arrow_add",
    "target_arrow_remove",
    "target_arrow_remove_from_source",
    "target_arrow_clear_all",
  ];
}

/** Deterministic shuffle (Fisher–Yates) over a copy. */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other]!, copy[index]!];
  }
  return copy;
}
