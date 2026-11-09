import type { CardInstance } from "@rift/protocol";

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
