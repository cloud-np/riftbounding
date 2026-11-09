/**
 * Play locations — rules 148.1.a.1, 149.2, 355.2, 355.2.a, 355.2.b, 358.3, 359.2.c/d, 449.2,
 * 451.2, 811.1.d.1, 822 (Ambush), 830 (Deploy).
 *
 * The valid Locations a permanent may be played to, each with the permission it relies on:
 *
 * | card | locations | rule |
 * |---|---|---|
 * | Unit | own Base, Battlefields the player controls | 355.2.a |
 * | Unit with Ambush | + Battlefields where the player has Units (and Reaction there) | 822.1.b |
 * | Non-Unit Gear | own Base only | 149.2, 359.2.d |
 * | Gear with Deploy | any Battlefield, never the Base | 830.1.b |
 * | played from facedown | only the battlefield it was hidden at | 811.1.d.1 / 811.1.d.1.a |
 *
 * A Unit can never be played to a Battlefield that already has Units of 2 other players
 * (451.2 / 358.3), and the restriction layer may forbid a location (355.17.b, R2-effects).
 */
import type { Room, RuleRef } from "@rift/protocol";
import type { CardInfo, RulesHost } from "../host";
import type { RulesFailure } from "../types";
import { fail } from "../types";
import { restrictionFor } from "../layers/restrictions";
import { controlsBattlefield, hasVisibleUnitAt, playersWithUnitsAt } from "./control";
import { hasKeyword } from "./keywords";
import { typeOf } from "./card-info";

export interface LocationOption {
  zone: string;
  rule: RuleRef;
  /** 822.1.b: valid only through Ambush (the card then has Reaction). */
  viaAmbush?: boolean;
}

export interface LocationQuery {
  playerId: string;
  cardId: string;
  info: CardInfo | null;
  keywords: readonly string[];
  /** 811.1.d.1: the battlefield a facedown card was hidden at. */
  facedownAt?: string;
  /** 355.2.b: Locations an effect makes valid for this play. */
  extraLocations?: readonly string[];
  /** 355.17: a mandatory requirement — followed when possible (restrictions still win, 355.17.b). */
  requiredLocations?: readonly string[];
}

function tooCrowded(room: Room, host: RulesHost, playerId: string, zone: string): boolean {
  return playersWithUnitsAt(room, host, zone).filter((id) => id !== playerId).length >= 2;
}

function restricted(room: Room, host: RulesHost, query: LocationQuery, zone: string): boolean {
  return !!restrictionFor(room, host, { kind: "play", playerId: query.playerId, cardId: query.cardId, to: zone });
}

/** Every valid location for a permanent (empty for spells). */
export function playLocations(room: Room, host: RulesHost, query: LocationQuery): LocationOption[] {
  const options = baseLocations(room, host, query);
  const { unit } = typeOf(query.info);
  // 355.2.b: an effect's permission makes more Locations valid (restrictions/crowding still apply).
  for (const zone of query.extraLocations ?? []) {
    if (options.some((option) => option.zone === zone)) continue;
    if (zone !== "base" && !(host.battlefieldZones(room) as string[]).includes(zone)) continue;
    if (restricted(room, host, query, zone)) continue;
    if (unit && zone !== "base" && tooCrowded(room, host, query.playerId, zone)) continue;
    options.push({ zone, rule: "355.2.b" });
  }
  // 355.17: a mandatory requirement is followed when it can be.
  const required = query.requiredLocations;
  if (required && required.length > 0) {
    const kept = options.filter((option) => required.includes(option.zone));
    if (kept.length > 0) return kept.map((option) => ({ ...option, rule: "355.17" }));
  }
  return options;
}

function baseLocations(room: Room, host: RulesHost, query: LocationQuery): LocationOption[] {
  const { unit, gear } = typeOf(query.info);
  if (!unit && !gear) return [];
  const battlefields = host.battlefieldZones(room) as string[];
  const out: LocationOption[] = [];
  const add = (option: LocationOption) => {
    if (out.some((entry) => entry.zone === option.zone)) return;
    if (restricted(room, host, query, option.zone)) return;
    if (unit && option.zone !== "base" && tooCrowded(room, host, query.playerId, option.zone)) return;
    out.push(option);
  };
  if (query.facedownAt) {
    add({ zone: query.facedownAt, rule: "811.1.d.1" });
    return out;
  }
  if (!unit) {
    if (hasKeyword(query.keywords, "Deploy")) {
      for (const zone of battlefields) add({ zone, rule: "830.1.b.1" });
      return out;
    }
    add({ zone: "base", rule: "149.2" });
    return out;
  }
  add({ zone: "base", rule: "355.2.a" });
  for (const zone of battlefields) {
    if (controlsBattlefield(room, host, query.playerId, zone)) add({ zone, rule: "355.2.a" });
  }
  if (hasKeyword(query.keywords, "Ambush")) {
    for (const zone of battlefields) {
      if (hasVisibleUnitAt(room, host, query.playerId, zone)) add({ zone, rule: "822.1.b", viaAmbush: true });
    }
  }
  return out;
}

/**
 * 355.2 / 358.5: validate a requested location (or pick the default) before any mutation.
 * Units default to the Base and Non-Unit Gear to the Base (R1 behaviour); a Deploy gear or a
 * facedown card with a single valid location uses it (411.2). Spells report "base".
 */
export function chooseLocation(
  room: Room,
  host: RulesHost,
  query: LocationQuery,
  requested: unknown,
): { ok: true; location: string; option: LocationOption | null } | RulesFailure {
  if (requested !== undefined && typeof requested !== "string") return fail("invalid_location", "355.2");
  const { unit, gear } = typeOf(query.info);
  if (!unit && !gear) return { ok: true, location: "base", option: null };
  const options = playLocations(room, host, query);
  if (requested === undefined) {
    const base = options.find((option) => option.zone === "base");
    if (base) return { ok: true, location: "base", option: base };
    if (options.length === 1) return { ok: true, location: options[0]!.zone, option: options[0]! };
    return fail("invalid_location", unit ? "355.2.a" : gearRule(query), "choose a location");
  }
  const option = options.find((entry) => entry.zone === requested);
  if (option) return { ok: true, location: option.zone, option };
  return fail("invalid_location", locationFailureRule(room, host, query, requested), requested);
}

function gearRule(query: LocationQuery): RuleRef {
  if (query.facedownAt) return "811.1.d.1.a";
  return hasKeyword(query.keywords, "Deploy") ? "830.1.b" : "359.2.d";
}

function locationFailureRule(room: Room, host: RulesHost, query: LocationQuery, requested: string): RuleRef {
  const { unit } = typeOf(query.info);
  if (query.facedownAt) return unit ? "811.1.d.1" : "811.1.d.1.a";
  if (!unit) return gearRule(query);
  const battlefields = host.battlefieldZones(room) as string[];
  if (battlefields.includes(requested)) {
    if (restricted(room, host, query, requested)) return "355.17.b";
    if (tooCrowded(room, host, query.playerId, requested)) return "451.2";
  }
  return "355.2.a";
}
