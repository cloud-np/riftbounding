/**
 * Batch operation validators — original module 356081 (`cr.x`).
 */
import type { BattlefieldZone, Room, Zone } from "@rift/protocol";
import { isBoardZone } from "../state/board";

/** 780855 `S`: zones allowed in payment-batch toggles. */
export function isRevealableZone(zone: unknown): zone is Zone {
  return (
    typeof zone === "string" &&
    (isBoardZone(zone) ||
      zone === "banished" ||
      zone === "champion" ||
      zone === "legend" ||
      zone === "runeArea")
  );
}

/** 780855 `u`: zones allowed for card labels (field + champion/legend/runeArea). */
export function isLabelZone(zone: unknown): boolean {
  return (
    zone === "base" ||
    zone === "battlefieldA" ||
    zone === "battlefieldB" ||
    zone === "battlefieldC" ||
    zone === "battlefieldToken" ||
    zone === "champion" ||
    zone === "legend" ||
    zone === "runeArea"
  );
}

export function isValidLabelSlot(slot: unknown): slot is 0 | 1 | 2 {
  return typeof slot === "number" && Number.isInteger(slot) && slot >= 0 && slot < 3;
}

export type BatchKind = "payment_batch" | "rune_batch" | "floating_resource_batch";

interface Operation {
  type?: unknown;
  [key: string]: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

function opValid(kind: BatchKind, op: Operation): boolean {
  switch (op.type) {
    case "clear_floating_resources":
      return kind === "floating_resource_batch";
    case "adjust_floating_resource":
      return (
        kind !== "rune_batch" &&
        (op.resource === "energy" || op.resource === "power") &&
        typeof op.delta === "number" &&
        Number.isFinite(op.delta) &&
        Math.trunc(op.delta) !== 0
      );
    case "draw_rune":
      return kind === "rune_batch" && (op.exhausted === undefined || typeof op.exhausted === "boolean");
    case "set_rune_exhausted":
      return kind === "rune_batch" && nonEmptyString(op.cardId) && typeof op.exhausted === "boolean";
    case "send_rune_to_deck_bottom":
    case "recycle_rune_for_floating_energy":
      return kind !== "floating_resource_batch" && nonEmptyString(op.cardId);
    case "toggle_exhausted":
      return (
        kind === "payment_batch" &&
        isRevealableZone(op.zone) &&
        nonEmptyString(op.cardId) &&
        typeof op.expectedExhausted === "boolean"
      );
    case "set_card_label":
      return (
        kind === "payment_batch" &&
        isLabelZone(op.zone) &&
        nonEmptyString(op.cardId) &&
        isValidLabelSlot(op.slot) &&
        typeof op.label === "string"
      );
    default:
      return false;
  }
}

/** `cr.x`: returns null when valid, else the exact English error message. */
export function validateBatch(kind: BatchKind, operations: unknown): string | null {
  const generic = `Invalid ${kind.replaceAll("_", " ")} operations.`;
  if (!Array.isArray(operations) || operations.length === 0 || operations.length > 128) return generic;
  for (const raw of operations) {
    if (!isObject(raw)) return generic;
    if (!opValid(kind, raw)) {
      if (kind === "payment_batch") {
        if (raw.type === "toggle_exhausted" && typeof raw.expectedExhausted !== "boolean") {
          return "Expected exhaustion state is required.";
        }
        if (raw.type === "set_card_label" && !isValidLabelSlot(raw.slot)) {
          return "Invalid card label slot.";
        }
      }
      return generic;
    }
  }
  return null;
}

/** 356081 `L`: autoPay spec validator. */
export function isValidAutoPaySpec(spec: unknown): spec is { purpose: "play" | "empower"; zone: Zone; cardId: string } {
  if (!isObject(spec) || !nonEmptyString(spec.cardId)) return false;
  if (spec.purpose === "play") {
    return spec.zone === "hand" || spec.zone === "champion" || spec.zone === "banished";
  }
  if (spec.purpose === "empower") {
    return isLabelZone(spec.zone);
  }
  return false;
}

export { isBoardZone };
export type { BattlefieldZone, Room };
