import type { CardInstance } from "@rift/protocol";

/**
 * How much of the previous card each attached card exposes to the right, as a fraction of the
 * card width. A quarter is enough for the gear's frame, part of its art and its bottom-right
 * stat badge, and matches the reference app's attached-equipment peek.
 */
export const ATTACHED_FAN_STEP = 0.26;

/** The slot width a top-most card needs so its attachment fan never reaches a neighbour. */
export function attachedFanWidth(count: number): string {
  const attached = Math.max(0, Math.trunc(count));
  if (attached === 0) return "var(--card-width)";
  return `calc(var(--card-width) * ${Number((1 + attached * ATTACHED_FAN_STEP).toFixed(4))})`;
}

/** Left offset of one attached card inside the host's reserved slot. */
export function attachedCardOffset(index: number): string {
  const rank = Math.max(0, Math.trunc(index));
  return `calc(var(--card-width) * ${Number(((rank + 1) * ATTACHED_FAN_STEP).toFixed(4))})`;
}

/**
 * Paint order: the unit sits above all gear; the first attached gear sits above later gear, so
 * every card exposes its own right-hand strip in attach order.
 */
export function attachedFanZIndex(index: number, count: number): number {
  return Math.max(1, Math.trunc(count) - Math.trunc(index));
}

export interface AttachedCardGroups {
  /** Cards that are not attached to another card in the same zone list. */
  topLevel: CardInstance[];
  /** Attached gear (and any other attachment) keyed by its top-most host card id. */
  byHostId: Map<string, CardInstance[]>;
}

/**
 * Split one board zone list into top-most cards and the attachments tucked behind them.
 *
 * The authoritative board representation (sandbox `equip_card` and the strict `attach` op)
 * keeps attached cards in the same zone list with `attachedToCardId` pointing at the host.
 * Cards whose host is not in this list stay top-level so a stale/moving attachment never
 * disappears from the board.
 */
export function groupAttachedCards(cards: readonly CardInstance[]): AttachedCardGroups {
  const ids = new Set(cards.map((card) => card.id));
  const byHostId = new Map<string, CardInstance[]>();
  const attachedIds = new Set<string>();
  for (const card of cards) {
    const hostId = card.attachedToCardId;
    if (!hostId || hostId === card.id || !ids.has(hostId)) continue;
    const list = byHostId.get(hostId) ?? [];
    list.push(card);
    byHostId.set(hostId, list);
    attachedIds.add(card.id);
  }
  return {
    topLevel: cards.filter((card) => !attachedIds.has(card.id)),
    byHostId,
  };
}
