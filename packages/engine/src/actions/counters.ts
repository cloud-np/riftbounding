import type { CardInstance, PlayerBoard, Room } from "@rift/protocol";
import type { ActionHandler } from "../types";
import {
  cloneCard,
  isFieldZone,
  zoneList,
} from "../state/board";
import {
  cardMight,
  getCard,
  isGearCardType,
  isUnitCardType,
} from "../catalog";
import {
  cardOwnerId,
  resolveOwnerIndex,
} from "../state/selectors";
import { findEmpoweredSlot as labelEmpoweredSlot } from "../rules/payment-sources";
import { hasIvernLegend } from "../rules/victory";
import { bool, int, str } from "./common";
import { logDraft } from "../log/entries";

const MIGHT_TEXT = /(?:^|[\n,.])\s*([+-]\d+)\s*(?:\[Might\]|Might)\s*[.!]?\s*$/i;
const FLAVOR_TEXT = /^[\t ]*flavou?r text[\t \r]*$/imu;
const COUNTED_LABELS = new Set(["buff", "shield", "assault", "disarm", "empowered", "deflect"]);
const MAX_LABELS = 3;

/** 286700 `f`: might bonuses from attached gear with "+N [Might]" text. */
export function equipmentMightBonus(card: CardInstance, zone: readonly CardInstance[]): number {
  let total = 0;
  for (const gear of zone) {
    if (gear.attachedToCardId !== card.id || gear.hidden || gear.isPlaceholder || !isGearCardType(gear)) continue;
    const text = gear.text?.trim() || getCard(gear.cardCode, gear.name)?.text;
    const cleaned = (text ?? "").split(FLAVOR_TEXT, 1)[0]?.trim() ?? "";
    const match = MIGHT_TEXT.exec(cleaned);
    if (match) total += Number(match[1]);
  }
  return total;
}

function clampCounter(value: number): number {
  return Math.max(-99, Math.min(99, Math.trunc(value)));
}

/** orig: 35qz5rkx7yexy.js:23619 "adjust_card_might" */
export const adjustCardMight: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const delta = Math.trunc(Number(action.delta));
  if (delta === 0 || !Number.isFinite(delta)) return;
  const zone = str(action.zone);
  const list = zoneList(board, zone);
  const index = list.findIndex((card) => card.id === str(action.cardId));
  const card = list[index];
  if (!card || card.hidden || !isUnitCardType(card)) return;
  const current = card.temporaryMightBuff ?? 0;
  const next = Math.max(0, Math.min(99, Math.trunc(current + delta)));
  if (current === next) return;
  const copy = { ...card };
  if (next > 0) copy.temporaryMightBuff = next;
  else delete copy.temporaryMightBuff;
  list[index] = copy;
  room.players[playerIndex]!.board = board;
  context.log(
    logDraft(copy.temporaryMightBuff ? "appliedBuff" : "consumedBuff", { card: copy.name }, {
      authorPlayerId: context.actorId,
      actionKind: "board",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:23641 "adjust_card_counter" */
export const adjustCardCounter: ActionHandler = ({ room, playerIndex, board, action }) => {
  const delta = Math.trunc(Number(action.delta));
  if (!Number.isFinite(delta)) return;
  const zone = str(action.zone);
  const list = zoneList(board, zone);
  const index = list.findIndex((card) => card.id === str(action.cardId));
  const card = list[index];
  if (!card || card.hidden) return;
  const field = action.counter === "red" ? "redCounter" : "whiteCounter";
  const existing = card[field];
  const hasExisting = typeof existing === "number" && Number.isFinite(existing);
  const might = cardMight(card);
  const initialize =
    !hasExisting &&
    action.initializeAtUnitMight === true &&
    action.counter === "white" &&
    isUnitCardType(card) &&
    typeof might === "number" &&
    Number.isFinite(might);
  const base = hasExisting ? (existing as number) : initialize ? clampCounter((might as number) + equipmentMightBonus(card, list)) : 0;
  const next = clampCounter(base + delta);
  if (hasExisting && base === next) return;
  list[index] = { ...card, [field]: next };
  room.players[playerIndex]!.board = board;
};

/** orig: 35qz5rkx7yexy.js:23671 "clear_card_counter" */
export const clearCardCounter: ActionHandler = ({ room, playerIndex, board, action }) => {
  const list = zoneList(board, str(action.zone));
  const index = list.findIndex((card) => card.id === str(action.cardId));
  const card = list[index];
  if (!card || card.hidden) return;
  const field = action.counter === "red" ? "redCounter" : "whiteCounter";
  if (!(field in card)) return;
  const copy = { ...card };
  delete copy[field];
  list[index] = copy;
  room.players[playerIndex]!.board = board;
};

/* ------------------------------------------------------------------ labels (552379) */

function normalizeLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 24);
}

function normalizeLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean)
    .slice(0, MAX_LABELS);
}

function parseCountedLabel(value: string): { label: string; count: number | null } {
  const match = value.trim().match(/^(.*?)(?:\s+(\d+))?$/);
  const label = match?.[1] ?? value;
  return COUNTED_LABELS.has(label.toLowerCase())
    ? { label, count: Math.max(1, Math.min(99, Number(match?.[2] ?? 1))) }
    : { label: value.trim(), count: null };
}

function adjustCountedLabel(value: string, delta: number): string | null {
  const parsed = parseCountedLabel(value);
  if (parsed.count === null) return null;
  const next = Math.max(0, Math.min(99, parsed.count + delta));
  return next === 0 ? "" : next === 1 ? parsed.label : `${parsed.label} ${next}`;
}

function isBuffLabel(value: string): boolean {
  return parseCountedLabel(value).label.toLowerCase() === "buff";
}

function canBuffCard(zone: string, card: CardInstance): boolean {
  return (isFieldZone(zone) || zone === "champion") && !card.hidden && isUnitCardType(card);
}

function setCardLabel(
  board: PlayerBoard,
  zone: string,
  cardId: string,
  slot: number,
  label: string,
): PlayerBoard | null {
  const list = zoneList(board, zone);
  const index = list.findIndex((card) => card.id === cardId);
  const card = list[index];
  if (!card || card.hidden) return null;
  const normalized = normalizeLabel(label);
  const labels = normalizeLabels(card.customLabels);
  const current = labels[slot];
  const next = normalized || undefined;
  if (current === next) return null;
  if (next) labels[slot] = next;
  else labels.splice(slot, 1);
  const compact = normalizeLabels(labels);
  const copy = { ...card };
  if (compact.length > 0) copy.customLabels = compact;
  else delete copy.customLabels;
  if (copy.empowerTriggerUsed && labelEmpoweredSlot(copy) === null) delete copy.empowerTriggerUsed;
  list[index] = copy;
  return board;
}

/** orig: 35qz5rkx7yexy.js:23782 "set_card_label" */
export const setCardLabelAction: ActionHandler = ({ room, playerIndex, player, action, context }) => {
  const zone = str(action.zone);
  if (!(isFieldZone(zone) || zone === "champion" || zone === "legend" || zone === "runeArea")) return;
  if (typeof action.slot !== "number" || !Number.isInteger(action.slot) || action.slot < 0 || action.slot > 2) return;
  const ownerIndex = resolveOwnerIndex(
    room,
    playerIndex,
    action.owner === "opponent" ? "opponent" : "self",
    typeof action.targetPlayerId === "string" ? action.targetPlayerId : undefined,
  );
  const ownerBoard = room.players[ownerIndex]?.board;
  if (ownerIndex < 0 || !ownerBoard) return;
  const list = zoneList(ownerBoard, zone);
  const card = list.find((entry) => entry.id === str(action.cardId));
  if (!card) return;

  if (action.countDelta !== undefined) {
    if (action.countDelta !== 1 && action.countDelta !== -1) return;
    const current = normalizeLabels(card.customLabels)[action.slot];
    const next = current === undefined ? str(action.label) : adjustCountedLabel(current, action.countDelta);
    if (next === null) return;
    if (setCardLabel(ownerBoard, zone, card.id, action.slot, next)) {
      room.players[ownerIndex]!.board = ownerBoard;
    }
    return;
  }

  if (ownerIndex === playerIndex && typeof action.label === "string" && isBuffLabel(action.label) && canBuffCard(zone, card)) {
    const index = list.findIndex((entry) => entry.id === card.id);
    const target = list[index];
    if (target && !((target.temporaryMightBuff ?? 0) > 0)) {
      list[index] = { ...target, temporaryMightBuff: 1 };
      room.players[ownerIndex]!.board = ownerBoard;
      context.log(
        logDraft("appliedBuff", { card: target.name }, {
          authorPlayerId: player.id,
          actionKind: "board",
          at: context.now,
        }),
      );
    }
    return;
  }

  if (setCardLabel(ownerBoard, zone, card.id, action.slot, str(action.label))) {
    room.players[ownerIndex]!.board = ownerBoard;
  }
};

/** orig: 35qz5rkx7yexy.js:23217 "set_battlefield_brush" */
export const setBattlefieldBrush: ActionHandler = ({ room, player, action, context }) => {
  const zone = str(action.zone);
  const active = bool(action.active);
  if (!["battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"].includes(zone)) return;
  if ((active && !hasIvernLegend(player)) || !!room.battlefieldBrushByZone?.[zone as keyof typeof room.battlefieldBrushByZone] === active) {
    return;
  }
  const map: Partial<Record<string, boolean>> = { ...(room.battlefieldBrushByZone ?? {}) };
  if (active) map[zone] = true;
  else delete map[zone];
  const any = map.battlefieldA || map.battlefieldB || map.battlefieldC || map.battlefieldToken;
  room.battlefieldBrushByZone = any ? (map as Room["battlefieldBrushByZone"]) : undefined;
  if (active) {
    context.log(
      logDraft("replacedWithBrush", { zone }, {
        authorPlayerId: player.id,
        actionKind: "board",
        at: context.now,
      }),
    );
  }
};
