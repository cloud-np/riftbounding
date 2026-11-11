/**
 * Pure room-diff → FX event derivation.
 *
 * Opponent actions reach the client as patches with only an action type, so every visual effect
 * is derived by diffing the previous rendered room against the next one. The returned array is
 * already a timeline: turn → plays/moves/spells → showdown → clash → damage → deaths → buffs →
 * conquer → score → draws.
 */
import type { BattlefieldZone, CardInstance, Room, Zone } from "@rift/protocol";

import { unitMightView } from "../card/might";
import type { ClashUnit, FxEvent, FxFromZone } from "./types";

export const BATTLEFIELD_ZONES: readonly BattlefieldZone[] = [
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
];
const FIELD_ZONES: readonly Zone[] = ["base", ...BATTLEFIELD_ZONES, "battlefieldToken"];
const ALL_ZONES: readonly Zone[] = [
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
  "deck",
  "runeDeck",
  "runeArea",
];

const MAX_EVENTS = 24;

interface Loc {
  zone: Zone;
  playerId: string;
  card: CardInstance;
}

type ZoneIndex = Map<string, Loc>;

export function isBattlefieldZone(zone: string): zone is BattlefieldZone {
  return zone === "battlefieldA" || zone === "battlefieldB" || zone === "battlefieldC";
}

function isFieldZone(zone: Zone): boolean {
  return FIELD_ZONES.includes(zone);
}

export function isSpellCard(card: CardInstance): boolean {
  if (card.type) return /spell/i.test(card.type);
  return card.might == null;
}

/** Units (and champions) that fight; gear / spells / runes do not. */
export function isUnitLikeCard(card: CardInstance): boolean {
  if (card.type) return /unit/i.test(card.type) && !/gear/i.test(card.type);
  return card.might != null;
}

function boardCards(room: Room, playerId: string, zone: Zone): CardInstance[] {
  const board = room.players.find((player) => player.id === playerId)?.board;
  return ((board as unknown as Record<string, CardInstance[] | undefined> | undefined)?.[zone] ??
    []) as CardInstance[];
}

function indexRoom(room: Room): ZoneIndex {
  const index: ZoneIndex = new Map();
  for (const player of room.players) {
    for (const zone of ALL_ZONES) {
      for (const card of boardCards(room, player.id, zone)) {
        index.set(card.id, { zone, playerId: player.id, card });
      }
    }
  }
  return index;
}

function objectState(room: Room, id: string) {
  return room.rules?.objects?.[id];
}

/** Might the card is currently showing (the rules engine's effective Might in strict rooms). */
export function effectiveMight(room: Room, card: CardInstance): number {
  return unitMightView(room, card).current ?? 0;
}

function damageOf(room: Room, id: string): number {
  return objectState(room, id)?.damage ?? 0;
}

function unitsAt(room: Room, zone: Zone): Array<{ card: CardInstance; playerId: string }> {
  const units: Array<{ card: CardInstance; playerId: string }> = [];
  for (const player of room.players) {
    for (const card of boardCards(room, player.id, zone)) {
      if (isUnitLike(card)) units.push({ card, playerId: player.id });
    }
  }
  return units;
}

function isUnitLike(card: CardInstance): boolean {
  return isUnitLikeCard(card);
}

function controlOf(room: Room, zone: BattlefieldZone): string | null {
  const owners = new Set(unitsAt(room, zone).map((unit) => unit.playerId));
  return owners.size === 1 ? [...owners][0]! : null;
}

function collectStrings(value: unknown, out: string[], depth = 0): void {
  if (depth > 4 || value == null) return;
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out, depth + 1);
  else if (typeof value === "object")
    for (const item of Object.values(value as Record<string, unknown>))
      collectStrings(item, out, depth + 1);
}

/** Target ids of a chain entry: board arrows first, strict chain choices second. */
function targetsOfEntry(room: Room, entryId: string, card: CardInstance, known: ZoneIndex): string[] {
  const targets = new Set<string>();
  for (const arrows of Object.values(room.targetArrowsByPlayer ?? {})) {
    for (const arrow of arrows ?? []) {
      if (arrow.sourceCardId === card.id) targets.add(arrow.targetCardId);
    }
  }
  const chainItem = room.rules?.chain?.find((item) => item.id === entryId);
  if (chainItem?.choices) {
    const strings: string[] = [];
    collectStrings(chainItem.choices, strings);
    for (const value of strings) if (value !== card.id && known.has(value)) targets.add(value);
  }
  return [...targets];
}

function isViewerId(viewerId: string, playerId: string): boolean {
  return viewerId === playerId;
}

function clashUnit(
  prevRoom: Room,
  nextRoom: Room,
  card: CardInstance,
  playerId: string,
  nextIndex: ZoneIndex,
  sandboxLethal: boolean,
): ClashUnit {
  const next = nextIndex.get(card.id);
  const died = !next || !isFieldZone(next.zone);
  let damage = 0;
  if (nextRoom.rules) {
    const before = damageOf(prevRoom, card.id);
    if (died) damage = Math.max(1, effectiveMight(prevRoom, card) - before);
    else damage = Math.max(0, damageOf(nextRoom, card.id) - before);
  } else if (died && sandboxLethal) {
    damage = Math.max(1, effectiveMight(prevRoom, card));
  }
  return { id: card.id, card, playerId, damage, died, might: effectiveMight(prevRoom, card) };
}

function deriveClash(
  prev: Room,
  next: Room,
  nextIndex: ZoneIndex,
): { events: FxEvent[]; clashIds: Set<string>; startKey: BattlefieldZone | null } {
  const clashIds = new Set<string>();
  const strictCombat = next.rules?.combat ?? prev.rules?.combat ?? null;
  if (next.rules && strictCombat && (prev.rules?.combat || next.rules.combat)) {
    const battlefield = strictCombat.battlefield;
    const participants = new Map<string, { card: CardInstance; playerId: string }>();
    for (const unit of unitsAt(prev, battlefield)) participants.set(unit.card.id, unit);
    for (const unit of unitsAt(next, battlefield)) {
      if (!participants.has(unit.card.id)) participants.set(unit.card.id, unit);
    }
    const attackers: ClashUnit[] = [];
    const defenders: ClashUnit[] = [];
    let total = 0;
    for (const { card, playerId } of participants.values()) {
      const designation =
        objectState(prev, card.id)?.designation ?? objectState(next, card.id)?.designation;
      const isAttacker = designation
        ? designation === "attacker"
        : playerId === strictCombat.attacker;
      const unit = clashUnit(prev, next, card, playerId, nextIndex, false);
      total += unit.damage;
      (isAttacker ? attackers : defenders).push(unit);
    }
    const anyHurt = [...attackers, ...defenders].some((unit) => unit.damage > 0 || unit.died);
    if (!anyHurt || attackers.length === 0 || defenders.length === 0) {
      return { events: [], clashIds, startKey: null };
    }
    for (const unit of [...attackers, ...defenders]) clashIds.add(unit.id);
    return {
      events: [{ type: "combat_clash", battlefield, attackers, defenders, totalDamage: total }],
      clashIds,
      startKey: battlefield,
    };
  }
  if (next.rules) return { events: [], clashIds, startKey: null };

  // Sandbox heuristic: a contested battlefield lost units to trash/banished.
  const events: FxEvent[] = [];
  for (const battlefield of BATTLEFIELD_ZONES) {
    const before = unitsAt(prev, battlefield);
    const owners = new Set(before.map((unit) => unit.playerId));
    if (owners.size < 2) continue;
    const gone = before.filter((unit) => {
      const location = nextIndex.get(unit.card.id);
      return !location || location.zone === "trash" || location.zone === "banished";
    });
    if (gone.length === 0) continue;
    const attackerId =
      prev.activeTurnPlayerId && owners.has(prev.activeTurnPlayerId)
        ? prev.activeTurnPlayerId
        : before[0]!.playerId;
    const attackers: ClashUnit[] = [];
    const defenders: ClashUnit[] = [];
    let total = 0;
    for (const { card, playerId } of before) {
      const unit = clashUnit(prev, next, card, playerId, nextIndex, true);
      total += unit.damage;
      clashIds.add(card.id);
      (playerId === attackerId ? attackers : defenders).push(unit);
    }
    events.push({ type: "combat_clash", battlefield, attackers, defenders, totalDamage: total });
  }
  return { events, clashIds, startKey: null };
}

export function deriveFxEvents(prev: Room, next: Room, viewerId: string): FxEvent[] {
  if (next.phase !== "in_game") return [];
  const prevIndex = indexRoom(prev);
  const nextIndex = indexRoom(next);
  const prevChainIds = new Set((prev.chainEntries ?? []).map((entry) => entry.id));
  const nextChainIds = new Set((next.chainEntries ?? []).map((entry) => entry.id));
  const prevChainCards = new Set((prev.chainEntries ?? []).map((entry) => entry.card.id));

  const turn: FxEvent[] = [];
  const plays: FxEvent[] = [];
  const showdown: FxEvent[] = [];
  const damage: FxEvent[] = [];
  const deaths: FxEvent[] = [];
  const buffs: FxEvent[] = [];
  const conquers: FxEvent[] = [];
  const scores: FxEvent[] = [];
  const draws: FxEvent[] = [];

  // Turn start.
  if (
    next.activeTurnPlayerId &&
    (next.activeTurnPlayerId !== prev.activeTurnPlayerId ||
      (next.turnNumber ?? 0) > (prev.turnNumber ?? 0))
  ) {
    turn.push({
      type: "turn_start",
      playerId: next.activeTurnPlayerId,
      isViewer: isViewerId(viewerId, next.activeTurnPlayerId),
      turnNumber: next.turnNumber ?? 0,
    });
  }

  // Cards entering the field / moving on it / dying / being drawn.
  const drawCounts = new Map<string, number>();
  for (const [id, now] of nextIndex) {
    const before = prevIndex.get(id);
    const inField = isFieldZone(now.zone);
    if (inField && (!before || !isFieldZone(before.zone))) {
      if (before && (before.zone === "deck" || before.zone === "runeDeck" || before.zone === "runeArea"))
        continue;
      const fromZone: FxFromZone = before
        ? before.zone
        : prevChainCards.has(id)
          ? "chain"
          : "none";
      if (before == null && now.card.source !== "token" && fromZone === "none") {
        // Redacted opponent hand: an unseen card appearing on the board came from hand.
        plays.push({
          type: "card_played",
          card: now.card,
          playerId: now.playerId,
          isViewer: isViewerId(viewerId, now.playerId),
          fromZone: "hand",
          toZone: now.zone,
        });
        continue;
      }
      plays.push({
        type: "card_played",
        card: now.card,
        playerId: now.playerId,
        isViewer: isViewerId(viewerId, now.playerId),
        fromZone,
        toZone: now.zone,
      });
      continue;
    }
    if (inField && before && isFieldZone(before.zone) && before.zone !== now.zone) {
      if (isUnitLike(now.card)) {
        plays.push({
          type: "unit_moved",
          card: now.card,
          playerId: now.playerId,
          isViewer: isViewerId(viewerId, now.playerId),
          fromZone: before.zone,
          toZone: now.zone,
        });
      }
      continue;
    }
    if (now.zone === "hand" && (!before || before.zone === "deck" || before.zone === "runeDeck")) {
      drawCounts.set(now.playerId, (drawCounts.get(now.playerId) ?? 0) + 1);
    }
  }
  for (const [playerId, count] of drawCounts) {
    draws.push({ type: "card_drawn", playerId, isViewer: isViewerId(viewerId, playerId), count });
  }

  // Spells on the chain.
  for (const entry of next.chainEntries ?? []) {
    if (prevChainIds.has(entry.id) || !isSpellCard(entry.card)) continue;
    plays.push({
      type: "spell_cast",
      card: entry.card,
      playerId: entry.byPlayerId,
      isViewer: isViewerId(viewerId, entry.byPlayerId),
      chainEntryId: entry.id,
      targetIds: targetsOfEntry(next, entry.id, entry.card, nextIndex),
    });
  }
  for (const entry of prev.chainEntries ?? []) {
    if (nextChainIds.has(entry.id) || !isSpellCard(entry.card)) continue;
    plays.push({
      type: "spell_resolved",
      card: entry.card,
      playerId: entry.byPlayerId,
      isViewer: isViewerId(viewerId, entry.byPlayerId),
      chainEntryId: entry.id,
      targetIds: targetsOfEntry(prev, entry.id, entry.card, prevIndex).filter((id) =>
        nextIndex.has(id),
      ),
    });
  }

  // Showdown start.
  const prevShowdown = prev.rules?.showdown ?? null;
  const nextShowdown = next.rules?.showdown ?? null;
  const prevCombat = prev.rules?.combat ?? null;
  const nextCombat = next.rules?.combat ?? null;
  if (next.rules) {
    if (nextShowdown && nextShowdown.battlefield !== prevShowdown?.battlefield) {
      showdown.push({
        type: "showdown_start",
        battlefield: nextShowdown.battlefield,
        kind: nextShowdown.kind,
        startedBy: nextShowdown.startedBy,
      });
    } else if (nextCombat && nextCombat.battlefield !== prevCombat?.battlefield && !nextShowdown) {
      showdown.push({
        type: "showdown_start",
        battlefield: nextCombat.battlefield,
        kind: "combat",
        startedBy: nextCombat.attacker,
      });
    }
  } else {
    for (const battlefield of BATTLEFIELD_ZONES) {
      const before = new Set(unitsAt(prev, battlefield).map((unit) => unit.playerId));
      const after = new Set(unitsAt(next, battlefield).map((unit) => unit.playerId));
      if (after.size >= 2 && before.size < 2) {
        showdown.push({ type: "showdown_start", battlefield, kind: "combat" });
      }
    }
  }

  // Combat clash.
  const clash = deriveClash(prev, next, nextIndex);

  // Deaths.
  for (const [id, before] of prevIndex) {
    if (!isFieldZone(before.zone) || !isUnitLike(before.card)) continue;
    const now = nextIndex.get(id);
    let toZone: Zone | null = null;
    if (now && (now.zone === "trash" || now.zone === "banished")) toZone = now.zone;
    else if (!now && before.card.source === "token") toZone = "trash";
    if (!toZone) continue;
    deaths.push({
      type: "unit_died",
      card: before.card,
      playerId: before.playerId,
      fromZone: before.zone,
      toZone,
      inCombat: clash.clashIds.has(id),
    });
  }

  // Damage (non-combat) and might buffs on surviving units.
  for (const [id, now] of nextIndex) {
    const before = prevIndex.get(id);
    if (!before || !isFieldZone(now.zone) || !isFieldZone(before.zone) || !isUnitLike(now.card))
      continue;
    if (clash.clashIds.has(id)) continue;
    const hurt = damageOf(next, id) - damageOf(prev, id);
    if (hurt > 0) {
      damage.push({ type: "damage", card: now.card, playerId: now.playerId, amount: hurt });
    }
    const gain = effectiveMight(next, now.card) - effectiveMight(prev, before.card);
    if (gain > 0) {
      buffs.push({ type: "might_buff", card: now.card, playerId: now.playerId, amount: gain });
    }
  }

  // Conquer + score.
  const conquerByPlayer = new Map<string, BattlefieldZone[]>();
  for (const battlefield of BATTLEFIELD_ZONES) {
    const after = controlOf(next, battlefield);
    if (after && after !== controlOf(prev, battlefield)) {
      conquers.push({
        type: "conquer",
        battlefield,
        playerId: after,
        isViewer: isViewerId(viewerId, after),
      });
      conquerByPlayer.set(after, [...(conquerByPlayer.get(after) ?? []), battlefield]);
    }
  }
  for (const player of next.players) {
    const before = prev.players.find((candidate) => candidate.id === player.id)?.board?.score ?? 0;
    const delta = (player.board?.score ?? 0) - before;
    if (delta <= 0) continue;
    const scoredNow = next.battlefieldScoredThisTurnByPlayer?.[player.id];
    const scoredBefore = prev.battlefieldScoredThisTurnByPlayer?.[player.id];
    const sources: BattlefieldZone[] = [];
    for (const battlefield of BATTLEFIELD_ZONES) {
      if (scoredNow?.[battlefield] && !scoredBefore?.[battlefield]) sources.push(battlefield);
    }
    for (const battlefield of conquerByPlayer.get(player.id) ?? []) {
      if (!sources.includes(battlefield)) sources.push(battlefield);
    }
    let remaining = delta;
    for (const battlefield of sources) {
      if (remaining <= 0) break;
      scores.push({
        type: "score",
        playerId: player.id,
        isViewer: isViewerId(viewerId, player.id),
        delta: 1,
        battlefield,
        source: conquerByPlayer.get(player.id)?.includes(battlefield) ? "conquer" : "hold",
      });
      remaining -= 1;
    }
    if (remaining > 0) {
      scores.push({
        type: "score",
        playerId: player.id,
        isViewer: isViewerId(viewerId, player.id),
        delta: remaining,
        battlefield: null,
        source: "other",
      });
    }
  }

  const events = [
    ...turn,
    ...plays,
    ...showdown,
    ...clash.events,
    ...damage,
    ...deaths,
    ...buffs,
    ...conquers,
    ...scores,
    ...draws,
  ];
  return events.length > MAX_EVENTS ? events.slice(0, MAX_EVENTS) : events;
}

/** Stable key used to dedupe the same change arriving as optimistic then authoritative. */
export function fxEventKey(event: FxEvent): string {
  switch (event.type) {
    case "card_played":
      return `play:${event.card.id}:${event.toZone}`;
    case "spell_cast":
      return `cast:${event.chainEntryId}`;
    case "spell_resolved":
      return `resolve:${event.chainEntryId}`;
    case "unit_moved":
      return `move:${event.card.id}:${event.toZone}`;
    case "showdown_start":
      return `showdown:${event.battlefield}`;
    case "combat_clash":
      return `clash:${event.battlefield}:${event.attackers.map((unit) => unit.id).join(",")}`;
    case "damage":
      return `damage:${event.card.id}:${event.amount}`;
    case "unit_died":
      return `die:${event.card.id}`;
    case "might_buff":
      return `buff:${event.card.id}:${event.amount}`;
    case "score":
      return `score:${event.playerId}:${event.battlefield ?? "-"}:${event.delta}`;
    case "conquer":
      return `conquer:${event.battlefield}:${event.playerId}`;
    case "turn_start":
      return `turn:${event.playerId}:${event.turnNumber}`;
    case "card_drawn":
      return `draw:${event.playerId}:${event.count}`;
  }
}
