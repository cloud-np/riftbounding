/**
 * Game-object helpers for the effects layer — rules 107, 140–149, 179–187, 355.9.a, 740.
 *
 * Board facts live on `Room` (zones, controller = the board the card sits on, owner =
 * `ownerPlayerId`); per-object rules state lives on `rules.objects`. Battlefields are not cards
 * in a zone in this engine, so a battlefield is addressed by the pseudo-object id
 * `battlefield:<zone>` (its name comes from the contributing player's `selectedBattlefield`).
 *
 * Pure reads only (no mutation).
 */
import { getCardByName } from "@rift/cards";
import type { BattlefieldZone, CardInstance, ChainItem, Room } from "@rift/protocol";
import type { LocatedCard, RulesHost } from "../host";
import { hasUnitPresentAt, unitsPresentAt } from "../state/presence";

/** 107: zones that make up the Board for "on the board" checks. */
export function boardZoneList(room: Room, host: RulesHost): string[] {
  return ["base", ...host.battlefieldZones(room), "legend", "runeArea"];
}

/** Locations a permanent can be at (141.1.a.1): a Base or a Battlefield. */
export function locationZones(room: Room, host: RulesHost): string[] {
  return ["base", ...host.battlefieldZones(room)];
}

export function isBattlefieldZone(room: Room, host: RulesHost, zone: string | undefined): zone is BattlefieldZone {
  return !!zone && (host.battlefieldZones(room) as string[]).includes(zone);
}

export function isBoardZone(room: Room, host: RulesHost, zone: string | undefined): boolean {
  return !!zone && boardZoneList(room, host).includes(zone);
}

/** 355.10.a.1 public zones. */
export function isPublicZone(room: Room, host: RulesHost, zone: string): boolean {
  return isBoardZone(room, host, zone) || zone === "trash" || zone === "champion";
}

export const BATTLEFIELD_PREFIX = "battlefield:";

export function battlefieldObjectId(zone: string): string {
  return `${BATTLEFIELD_PREFIX}${zone}`;
}

export function battlefieldZoneOf(objectId: string): string | null {
  return objectId.startsWith(BATTLEFIELD_PREFIX) ? objectId.slice(BATTLEFIELD_PREFIX.length) : null;
}

/**
 * Name of the battlefield card at a zone. Assumption (documented in docs/rules/effects.md): the
 * n-th battlefield zone belongs to the n-th seated player (room order) that contributed a
 * battlefield. RULES-QUESTION(103.4): the engine does not store the zone → card mapping.
 */
export function battlefieldNameAt(room: Room, host: RulesHost, zone: string): string | null {
  const zones = host.battlefieldZones(room) as string[];
  const index = zones.indexOf(zone);
  if (index < 0) return null;
  const contributors = room.players.filter((player) => !!player.selectedBattlefield);
  return contributors[index]?.selectedBattlefield?.trim() ?? null;
}

/** The player that contributed the battlefield at `zone` (same assumption as above). */
export function battlefieldContributorAt(room: Room, host: RulesHost, zone: string): string | null {
  const zones = host.battlefieldZones(room) as string[];
  const index = zones.indexOf(zone);
  if (index < 0) return null;
  const contributors = room.players.filter((player) => !!player.selectedBattlefield);
  return contributors[index]?.id ?? null;
}

/** 190: the controller of a battlefield is the only player with units there (presence proxy). */
export function battlefieldController(room: Room, host: RulesHost, zone: string): string | null {
  const present = host.activePlayerIds(room).filter((id) => hasUnitPresentAt(room, host, id, zone));
  return present.length === 1 ? present[0]! : null;
}

export function findChainItem(room: Room, id: string): ChainItem | undefined {
  return room.rules?.chain.find((item) => item.id === id);
}

export function locate(room: Room, host: RulesHost, id: string): LocatedCard | null {
  if (!id || id.startsWith(BATTLEFIELD_PREFIX)) return null;
  return host.findCard(room, id);
}

/** Card type words, lower-cased ("unit", "gear", "spell", …). */
export function typeOf(room: Room, host: RulesHost, id: string): string {
  const zone = battlefieldZoneOf(id);
  if (zone) return "battlefield";
  const item = findChainItem(room, id);
  if (item) {
    if (item.kind === "activated" || item.kind === "triggered") return "ability";
    const snap = item.cardSnapshot;
    const info = snap ? host.cardInfo(room, snap.id) : null;
    return (info?.type ?? snap?.type ?? "spell").toLowerCase();
  }
  const info = host.cardInfo(room, id);
  return (info?.type ?? "").toLowerCase();
}

export function typeMatches(type: string, wanted: string): boolean {
  const want = wanted.toLowerCase();
  if (want === "any" || want === "object") return true;
  if (want === "card") return !["rune", "legend", "battlefield", "ability"].some((word) => type.includes(word));
  if (want === "permanent") return type.includes("unit") || type.includes("gear");
  return type.includes(want);
}

export function isUnit(room: Room, host: RulesHost, id: string): boolean {
  return typeOf(room, host, id).includes("unit");
}

export function isToken(card: CardInstance | undefined): boolean {
  return card?.source === "token";
}

/** 143.1 / 185.2.c tags (catalog subtypes; tokens carry their own). */
export function tagsOf(card: CardInstance | undefined): string[] {
  if (!card) return [];
  if (card.subtypes && card.subtypes.length > 0) return card.subtypes;
  const catalog = getCardByName(card.name) as { subtypes?: string[] } | undefined;
  const tags = catalog?.subtypes ?? [];
  if (tags.length > 0) return tags;
  // 187.1: a Recruit token has the Recruit tag even if the catalog row has none.
  if (isToken(card)) return [card.name.replace(/ token$/i, "")];
  return [];
}

/** Controller of an object (the board/zone list it sits in; chain items: their controller). */
export function controllerOf(room: Room, host: RulesHost, id: string): string | null {
  const zone = battlefieldZoneOf(id);
  if (zone) return battlefieldController(room, host, zone);
  const item = findChainItem(room, id);
  if (item) return item.controller;
  return locate(room, host, id)?.playerId ?? null;
}

export function ownerOf(room: Room, host: RulesHost, id: string): string | null {
  const item = findChainItem(room, id);
  if (item) return item.cardSnapshot?.ownerPlayerId ?? item.controller;
  const located = locate(room, host, id);
  if (!located) return null;
  return located.card.ownerPlayerId ?? located.playerId;
}

/** The location (base or battlefield zone) of a permanent, or null when not at one. */
export function locationOf(room: Room, host: RulesHost, id: string): string | null {
  const zone = battlefieldZoneOf(id);
  if (zone) return zone;
  const located = locate(room, host, id);
  if (!located) return null;
  return locationZones(room, host).includes(located.zone) ? located.zone : null;
}

/** 740.1: friendly / enemy relative to a player. */
export function relation(controller: string | null, player: string): "friendly" | "enemy" | "none" {
  if (!controller) return "none";
  return controller === player ? "friendly" : "enemy";
}

/** Printed energy/power cost (185.3.a.1: tokens cost 0). */
export function costsOf(
  room: Room,
  host: RulesHost,
  id: string,
): { energy: number; power: number } | null {
  const item = findChainItem(room, id);
  const cardId = item?.cardSnapshot?.id ?? id;
  if (item && !item.cardSnapshot) return { energy: 0, power: 0 };
  const located = item ? null : locate(room, host, id);
  if (located && isToken(located.card)) return { energy: 0, power: 0 };
  const info = host.cardInfo(room, cardId) ?? (item?.cardSnapshot ? cardInfoFromSnapshot(item.cardSnapshot) : null);
  if (!info) return null;
  return { energy: info.energyCost ?? 0, power: info.powerCost ?? 0 };
}

function cardInfoFromSnapshot(card: CardInstance): { energyCost?: number; powerCost?: number } {
  const catalog = getCardByName(card.name) as { energyCost?: number; powerCost?: number } | undefined;
  return {
    energyCost: card.energyCost ?? catalog?.energyCost,
    powerCost: card.powerCost ?? catalog?.powerCost,
  };
}

/** Name of an object (card name, chain item name, battlefield name). */
export function nameOf(room: Room, host: RulesHost, id: string): string | null {
  const zone = battlefieldZoneOf(id);
  if (zone) return battlefieldNameAt(room, host, zone);
  const item = findChainItem(room, id);
  if (item) return item.cardName ?? null;
  return locate(room, host, id)?.card.name ?? null;
}

/** Units at a location for one player (or all players). */
export function unitIdsAt(room: Room, host: RulesHost, zone: string, playerId?: string): string[] {
  return unitsPresentAt(room, host, zone, playerId).map((card) => card.id);
}

/** 719 / 435: the top-most card a card is attached to. */
export function attachedTo(room: Room, host: RulesHost, id: string): string | null {
  return locate(room, host, id)?.card.attachedToCardId ?? null;
}

/** Cards attached to a top-most card. */
export function attachmentsOf(room: Room, host: RulesHost, id: string): CardInstance[] {
  const located = locate(room, host, id);
  if (!located) return [];
  const out: CardInstance[] = [];
  for (const playerId of host.playerIds(room)) {
    for (const zone of locationZones(room, host)) {
      for (const card of host.zoneCards(room, playerId, zone)) {
        if (card.attachedToCardId === id) out.push(card);
      }
    }
  }
  return out;
}
