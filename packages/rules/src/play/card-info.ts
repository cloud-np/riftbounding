/**
 * `CardInfo` for a card that is not in a zone the host can see (a card on the chain, 354).
 *
 * `host.cardInfo` only finds cards in player zones; a played card lives in
 * `ChainItem.cardSnapshot` while it is Pending. This mirrors the host's catalog lookup (instance
 * fields first, catalog second) so the process of play can keep reading characteristics.
 */
import { resolveCard } from "@rift/cards";
import type { CardInstance, Room } from "@rift/protocol";
import type { CardInfo, RulesHost } from "../host";

export function snapshotInfo(card: CardInstance): CardInfo {
  const catalog = resolveCard(card.cardCode, card.name);
  const info: CardInfo = {
    objectId: card.id,
    name: catalog?.name ?? card.name,
    type: catalog?.type ?? card.type ?? "Card",
    keywords: [...(card.keywords ?? catalog?.keywords ?? [])],
  };
  const might = card.might ?? catalog?.might;
  if (typeof might === "number") info.might = might;
  const energy = card.energyCost ?? catalog?.energyCost;
  if (typeof energy === "number") info.energyCost = energy;
  const power = card.powerCost ?? catalog?.powerCost;
  if (typeof power === "number") info.powerCost = power;
  const domains = card.domains ?? catalog?.domains;
  if (domains) info.domains = [...domains];
  const text = card.text ?? catalog?.text;
  if (text) info.text = text;
  return info;
}

/** Host info when the card is in a zone; snapshot info otherwise. */
export function infoFor(room: Room, host: RulesHost, card: CardInstance): CardInfo {
  return host.cardInfo(room, card.id) ?? snapshotInfo(card);
}

export function typeOf(info: Pick<CardInfo, "type"> | null | undefined): { unit: boolean; gear: boolean; spell: boolean } {
  const type = (info?.type ?? "").toLowerCase();
  return { unit: type.includes("unit"), gear: type.includes("gear"), spell: type.includes("spell") };
}
