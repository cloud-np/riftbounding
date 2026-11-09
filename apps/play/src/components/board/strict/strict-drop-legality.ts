import { strictLegalIntents, strictTargetOptions } from "@rift/engine";
import type { Room } from "@rift/protocol";

/**
 * Per-drag legality snapshot: one `legalIntents` + one target-options pass per dragged source,
 * computed at drag start. Hover/dragover only does set lookups (the engine still validates at
 * drop time).
 */
export interface StrictDragLegality {
  /** Zones a non-targeting play/move may be dropped on. */
  zones: ReadonlySet<string>;
  /** Battlefield zones offered by a battlefield-targeting choice. */
  targetZones: ReadonlySet<string>;
  /** Object ids offered by a target choice (or an Equip's unit targets). */
  targetIds: ReadonlySet<string>;
  /** Battlefields where this card may be hidden (811.1.b). */
  hideZones: ReadonlySet<string>;
}

function findSourceCard(room: Room, source: { cardId: string; zone: string }) {
  for (const player of room.players) {
    const board = player.board as unknown as Record<string, unknown> | undefined;
    if (!board) continue;
    const list = board[source.zone];
    if (!Array.isArray(list)) continue;
    const found = (list as Array<{ id?: string; type?: string }>).find(
      (card) => card?.id === source.cardId,
    );
    if (found) return found;
  }
  return undefined;
}

export function computeStrictDragLegality(
  room: Room,
  actorId: string,
  source: { cardId: string; zone: string },
): StrictDragLegality {
  const zones = new Set<string>();
  const targetZones = new Set<string>();
  const hideZones = new Set<string>();
  const targetIds = new Set<string>();
  const legal = strictLegalIntents(room, actorId);
  const playable = legal?.playable?.find((entry) => entry.cardId === source.cardId);
  for (const zone of playable?.locations ?? []) zones.add(zone);
  const hideable = legal?.hideable?.find((entry) => entry.cardId === source.cardId);
  for (const zone of hideable?.locations ?? []) hideZones.add(zone);
  for (const move of legal?.moves ?? []) {
    if (move.unitIds.includes(source.cardId)) zones.add(move.to);
  }
  const targets = strictTargetOptions(room, actorId, source.cardId);
  for (const id of targets.targetIds) targetIds.add(id);
  for (const zone of targets.targetZones) targetZones.add(zone);
  // A targetless spell still plays through any battlefield/base drop (the engine turns the
  // gesture into `rules_play`/`chain_add`); targeted spells must snap to a legal target.
  const isSpell = /spell/i.test(findSourceCard(room, source)?.type ?? "");
  if (isSpell && targetIds.size === 0) {
    zones.add("base");
    for (const zone of ["battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"]) {
      zones.add(zone);
    }
  }
  return { zones, targetZones, targetIds, hideZones };
}

const cache = new WeakMap<Room, Map<string, StrictDragLegality>>();

/** Dev/test counter: one increment per actual (cached-out) drag-source computation. */
export const strictDropLegalityStats = { computeCount: 0 };

// Room-revision-scoped cache: one entry per dragged card.
export function cachedStrictDragLegality(
  room: Room,
  actorId: string,
  source: { cardId: string; zone: string },
): StrictDragLegality {
  let bySource = cache.get(room);
  if (!bySource) {
    bySource = new Map();
    cache.set(room, bySource);
  }
  const key = `${actorId}:${source.zone}:${source.cardId}`;
  const existing = bySource.get(key);
  if (existing) return existing;
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const computed = computeStrictDragLegality(room, actorId, source);
  strictDropLegalityStats.computeCount += 1;
  if (process.env.NODE_ENV === "development") {
    console.debug(
      `[strict-drag] ${source.cardId} ${source.zone}: ${computed.zones.size} zones, ` +
        `${computed.targetIds.size} targets, ${computed.hideZones.size} hide, ` +
        `${Math.max(0, (typeof performance !== "undefined" ? performance.now() : Date.now()) - started).toFixed(1)}ms`,
    );
  }
  bySource.set(key, computed);
  return computed;
}

/**
 * The only hovered card a drop may carry as `targetCardId`.
 *
 * Strict rooms: deliberate targeting only — the card must be in the cached legal target set,
 * and a Hide drop never carries a target. A plain zone drop (e.g. a unit moved battlefield →
 * Base that lands over a base card) must not smuggle the hovered card into the gesture; the
 * engine tolerates such incidental ids but the rules contract treats them as targeting.
 * Sandbox keeps the old equip/target behaviour.
 */
export function strictDropTargetCard<T extends { id: string }>(
  hoverCard: T | null,
  legality: StrictDragLegality | null,
  options: { strict: boolean; hide?: boolean },
): T | null {
  if (!hoverCard || options.hide) return null;
  if (!options.strict) return hoverCard;
  return legality?.targetIds.has(hoverCard.id) ? hoverCard : null;
}

/** O(1) hover check against the current drag's cached legality. */
export function strictDropAllowed(
  legality: StrictDragLegality,
  input: { zone: string; targetId?: string | null; hide?: boolean },
): boolean {
  if (input.hide) return legality.hideZones.has(input.zone);
  if (input.targetId && legality.targetIds.has(input.targetId)) return true;
  if (legality.targetZones.has(input.zone)) return true;
  if (legality.targetIds.size > 0 && legality.zones.size === 0) return false;
  return legality.zones.has(input.zone);
}
