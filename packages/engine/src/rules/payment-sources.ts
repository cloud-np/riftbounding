/**
 * Payment-source predicates and the shared card-label updater (`dX`).
 * Source helpers mirror 872901 (gold/conduit/seal/honeyfruit) and 437381 (`dX`).
 */
import type { CardInstance, PlayerBoard } from "@rift/protocol";
import { getCard } from "../catalog";
import { zoneList } from "../state/board";

export { getCard };

function resolvedName(card: Partial<CardInstance>): string {
  return (getCard(card.cardCode, card.name)?.name ?? card.name ?? "").trim().toLowerCase();
}

export function isGoldToken(card: CardInstance): boolean {
  return card.source === "token" && resolvedName(card).replace(/[^a-z0-9]+/g, "").includes("gold");
}

export function isEnergyConduit(card: CardInstance): boolean {
  return resolvedName(card) === "energy conduit";
}

export function isSeal(card: CardInstance): boolean {
  return resolvedName(card).startsWith("seal of ");
}

export function isHoneyfruit(card: CardInstance): boolean {
  return resolvedName(card) === "honeyfruit";
}

export function isSpendableLegend(card: CardInstance): boolean {
  const record = getCard(card.cardCode, card.name);
  const isLegend = (record?.type ?? card.type ?? "").trim().toLowerCase() === "legend";
  if (!isLegend) return false;
  const text = (record?.text ?? card.text ?? "").trim().toLowerCase();
  return (
    text.includes("use only to play spells") ||
    text.includes("use only to play gear or use gear abilities")
  );
}

export const EMPOWERED_LABEL = "Empowered";

export function normalizeLabelText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 24);
}

export function normalizeLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean)
    .slice(0, 3);
}

function empoweredSlotForAdd(card: CardInstance): 0 | 1 | 2 | null {
  const labels = normalizeLabels(card.customLabels);
  if (labels.some((label) => label.toLowerCase() === EMPOWERED_LABEL.toLowerCase())) return null;
  return labels.length < 3 ? (labels.length as 0 | 1 | 2) : null;
}

/** 552379 `b`: find an existing "Empowered" label slot (no keyword requirement). */
export function findEmpoweredSlot(card: CardInstance): 0 | 1 | 2 | null {
  const labels = normalizeLabels(card.customLabels);
  const index = labels.findIndex((label) => label.toLowerCase() === EMPOWERED_LABEL.toLowerCase());
  return index >= 0 && index < 3 ? (index as 0 | 1 | 2) : null;
}

export { empoweredSlotForAdd };

/** 437381 `dX`: set/clear one label slot; returns false when nothing changed. */
export function applyLabel(
  board: PlayerBoard,
  zone: string,
  cardId: string,
  slot: number,
  label: string,
): boolean {
  if (!Number.isInteger(slot) || slot < 0 || slot > 2) return false;
  const list = zoneList(board, zone);
  const index = list.findIndex((card) => card.id === cardId);
  const card = list[index];
  if (!card || card.hidden) return false;
  const normalized = normalizeLabelText(label);
  const labels = normalizeLabels(card.customLabels);
  const current = labels[slot];
  const next = normalized || undefined;
  if (current === next) return false;
  if (next) labels[slot] = next;
  else labels.splice(slot, 1);
  const compact = normalizeLabels(labels);
  const copy = { ...card };
  if (compact.length > 0) copy.customLabels = compact;
  else delete copy.customLabels;
  if (copy.empowerTriggerUsed && findEmpoweredSlot(copy) === null) delete copy.empowerTriggerUsed;
  list[index] = copy;
  return true;
}

export { isGearCardType } from "../catalog";
