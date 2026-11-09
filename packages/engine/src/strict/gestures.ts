/**
 * Strict-room board gestures — §6.4 and the "act on the board, not from a list" contract.
 *
 * In a strict room the player manipulates the board exactly like the sandbox (drag a card from
 * hand to base/a battlefield, drag units, tap a card/rune/gear, drop a gear on a unit). This
 * module turns one such wire action into the one `rules_*` intent it means, or explains why the
 * gesture is illegal. It never mutates the room and never applies anything:
 * `applyGameAction` (packages/engine/src/engine.ts) applies the returned intent through the same
 * `applyRulesIntent` path as a hand-written `rules_*` action.
 *
 * Mapping (see docs/rules/gestures.md for the client contract):
 *
 * | gesture (wire action)                                   | strict intent                  |
 * |---------------------------------------------------------|--------------------------------|
 * | `move_card` hand/champion/trash/banished → base/bf      | `rules_play { cardId, location }` |
 * | `move_card` + `asHidden` (Hide)                         | `rules_play { cardId, hide, location }` |
 * | `chain_add` (spell/any card dragged to play)            | `rules_play { cardId }`        |
 * | `move_card` base/bf → base/bf (unit(s))                 | `rules_move { unitIds, to }`   |
 * | `toggle_exhausted` on a ready board object              | `rules_activate` (one ability) |
 * | `equip_card` gear (board) → unit                        | `rules_activate equip:<n>`     |
 * | `end_turn`                                              | `rules_end_turn`               |
 * | cosmetic/meta actions (§4)                              | passthrough to `gate()`        |
 * | §6.4 manual board actions for the manual player         | passthrough to `gate()`        |
 * | anything else (free-form manipulation)                  | `strict_mode_action` reject    |
 *
 * Ambiguity rule: a tap that matches several legal activated abilities is NOT guessed. It is
 * rejected with `ambiguous_gesture` and the candidate refs in `detail`; the client may resend
 * `toggle_exhausted` with an explicit `ability` (or send `rules_activate` itself, as the strict
 * panel already does). The rules layer has no public "open a prompt" entry point, so the engine
 * cannot open a choose-ability prompt without a rules-side change (reported to the lead).
 */
import type {
  ReasonCode,
  Room,
  RulesActivateIntent,
  RulesIntent,
  RulesMoveIntent,
  RulesPlayIntent,
  ZoneSelector,
} from "@rift/protocol";
import {
  activatedAbilitiesOf,
  explainIllegal,
  isCosmeticAction,
  isManualBoardAction,
  legalIntents,
  whoMayAct,
  type RulesHost,
} from "@rift/rules";

export type GestureAction = Record<string, unknown> & { type: string };

export type GestureTranslation =
  | { kind: "intent"; intent: RulesIntent }
  | { kind: "reject"; code: ReasonCode; rule?: string; detail?: string }
  | { kind: "passthrough" };

const GESTURE_CONTRACT = "contract:§4";
const ABILITY_RULE = "403.3";

/** 107: zones on the Board (Bases, Battlefield Zones, Legend Zones, Runes). */
const BATTLEFIELD_ZONES: ReadonlySet<string> = new Set([
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
]);

/** Non-Board zones a card can be played from (the rules layer decides any permission). */
const PLAY_SOURCES: ReadonlySet<string> = new Set(["hand", "champion", "trash", "banished"]);

/** Every Zone a hand/board play gesture may target for a Location (355.2). */
const PLAY_TARGETS: ReadonlySet<string> = new Set(["base", ...BATTLEFIELD_ZONES]);

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];
}

function reject(code: ReasonCode, rule?: string, detail?: string): GestureTranslation {
  return { kind: "reject", code, ...(rule ? { rule } : {}), ...(detail ? { detail } : {}) };
}

function intentOrReject(
  room: Room,
  actorId: string,
  intent: RulesIntent,
  host: RulesHost,
): GestureTranslation {
  const verdict = explainIllegal(room, actorId, intent, host);
  if (verdict.ok) return { kind: "intent", intent };
  return reject(verdict.code, verdict.rule, verdict.detail);
}

function playIntent(cardId: string, location?: string, hide = false): RulesPlayIntent {
  return {
    type: "rules_play",
    cardId,
    ...(location ? { location: location as ZoneSelector } : {}),
    ...(hide ? { hide: true } : {}),
  };
}

function activateIntent(objectId: string, ability: string, targets?: string[]): RulesActivateIntent {
  return {
    type: "rules_activate",
    objectId,
    ability,
    ...(targets && targets.length > 0 ? { targets } : {}),
  };
}

function moveIntent(unitIds: string[], to: string): RulesMoveIntent {
  return { type: "rules_move", unitIds, to: to as ZoneSelector };
}

/** The most plausible ability ref for explaining a source that has no legal activation. */
function plausibleAbilityRef(room: Room, host: RulesHost, objectId: string): string {
  const located = host.findCard(room, objectId);
  if (!located) return "activated:0";
  if (located.zone === "runeArea") return "rune:exhaust";
  const refs = activatedAbilitiesOf(room, host, located).map((entry) => entry.ref);
  return refs.find((ref) => ref.startsWith("equip:")) ?? refs.find((ref) => ref.startsWith("activated:")) ?? refs[0] ?? "activated:0";
}

/** A tap on a board object: activate its one legal ability, or explain/flag the ambiguity. */
function translateUse(
  room: Room,
  actorId: string,
  objectId: string,
  requested: string,
  host: RulesHost,
): GestureTranslation {
  const legal = legalIntents(room, actorId, host);
  const entries = legal.activatable.filter((entry) => entry.objectId === objectId);
  if (requested) {
    // The client disambiguated (or clicked one ability in a panel).
    return intentOrReject(room, actorId, activateIntent(objectId, requested), host);
  }
  if (entries.length === 1) {
    return intentOrReject(room, actorId, activateIntent(objectId, entries[0]!.ability), host);
  }
  if (entries.length > 1) {
    return reject(
      "ambiguous_gesture",
      ABILITY_RULE,
      `abilities: ${entries.map((entry) => entry.ability).join(", ")}`,
    );
  }
  // No legal activation now: explain the gesture as the ability it most plausibly meant (the
  // rules verdict carries the precise reason, e.g. not_main_phase / unit_exhausted / restricted).
  return intentOrReject(
    room,
    actorId,
    activateIntent(objectId, plausibleAbilityRef(room, host, objectId)),
    host,
  );
}

function translateMoveCard(
  room: Room,
  actorId: string,
  action: GestureAction,
  host: RulesHost,
): GestureTranslation {
  const from = str(action.from);
  const to = str(action.to);
  const cardId = str(action.cardId);
  if (!from || !to) return reject("strict_mode_action", GESTURE_CONTRACT, "move_card needs from/to");
  if (to === "chain") return reject("strict_mode_action", GESTURE_CONTRACT, "cards enter the chain by being played");

  // Hand/Champion/Trash/Banishment → Base/Battlefield is the play of a card (units/gear;
  // spells also arrive as chain_add). The rules layer checks any play permission.
  if (PLAY_SOURCES.has(from) && PLAY_TARGETS.has(to)) {
    if (!cardId) return reject("strict_mode_action", GESTURE_CONTRACT, "move_card needs a cardId");
    return intentOrReject(room, actorId, playIntent(cardId, to, action.asHidden === true), host);
  }

  // Base ⇄ Battlefield (and Battlefield → Battlefield with Ganking) is a Standard Move (449–455).
  const boardSource = from === "base" || BATTLEFIELD_ZONES.has(from);
  const boardTarget = to === "base" || BATTLEFIELD_ZONES.has(to);
  if (boardSource && boardTarget) {
    const unitIds = stringList(action.cardIds);
    const ids = unitIds.length > 0 ? unitIds : stringList(action.unitIds);
    if (ids.length === 0 && cardId) ids.push(cardId);
    if (ids.length === 0) return reject("strict_mode_action", GESTURE_CONTRACT, "move_card needs a cardId/cardIds");
    if (from === to) {
      // Same-zone reorder is a UI arrangement, not a strict game action.
      return reject("strict_mode_action", GESTURE_CONTRACT, "reordering a zone is not a game action");
    }
    return intentOrReject(room, actorId, moveIntent(ids, to), host);
  }

  return reject("strict_mode_action", GESTURE_CONTRACT, `${from} → ${to} is not a strict game action`);
}

function translateMove(
  room: Room,
  actorId: string,
  action: GestureAction,
  host: RulesHost,
): GestureTranslation {
  const cardId = str(action.cardId);
  const to = str(action.to);
  if (!to) return reject("strict_mode_action", GESTURE_CONTRACT, "move_card needs a destination");
  const ids = stringList(action.cardIds);
  const unitIds = ids.length > 0 ? ids : stringList(action.unitIds);
  if (unitIds.length === 0 && cardId) unitIds.push(cardId);
  if (unitIds.length === 0) return reject("strict_mode_action", GESTURE_CONTRACT, "move_card needs a cardId/cardIds");
  return intentOrReject(room, actorId, moveIntent(unitIds, to), host);
}

function translateChainAdd(
  room: Room,
  actorId: string,
  action: GestureAction,
  host: RulesHost,
): GestureTranslation {
  const from = str(action.from);
  const cardId = str(action.cardId);
  if (from === "battlefieldMarker") {
    return reject("strict_mode_action", GESTURE_CONTRACT, "a battlefield marker is not a card");
  }
  if (from === "runeArea" || from === "chain") {
    return reject("strict_mode_action", GESTURE_CONTRACT, `${from} is not a playable zone`);
  }
  if (!cardId) return reject("strict_mode_action", GESTURE_CONTRACT, "chain_add needs a cardId");
  // The sandbox's "drag the card out to play it" gesture; the rules layer decides the permission.
  return intentOrReject(room, actorId, playIntent(cardId), host);
}

function translateEquip(
  room: Room,
  actorId: string,
  action: GestureAction,
  host: RulesHost,
): GestureTranslation {
  const equipmentCardId = str(action.equipmentCardId);
  const unitCardId = str(action.unitCardId);
  if (action.asAttachment === true) {
    // 819.1.d: Quick-Draw's "when you play this, attach it" trigger is not implemented in the
    // rules layer yet, so there is no strict intent for a hand → unit attachment drop.
    return reject(
      "strict_mode_action",
      "819.1.d",
      "playing a Quick-Draw gear directly onto a unit is not a strict action; play the gear instead",
    );
  }
  if (!equipmentCardId || !unitCardId) {
    return reject("strict_mode_action", GESTURE_CONTRACT, "equip_card needs equipmentCardId/unitCardId");
  }
  const requested = str(action.ability);
  if (requested) {
    return intentOrReject(room, actorId, activateIntent(equipmentCardId, requested, [unitCardId]), host);
  }
  const legal = legalIntents(room, actorId, host);
  const entries = legal.activatable.filter(
    (entry) => entry.objectId === equipmentCardId && entry.ability.startsWith("equip:"),
  );
  if (entries.length === 1) {
    return intentOrReject(room, actorId, activateIntent(equipmentCardId, entries[0]!.ability, [unitCardId]), host);
  }
  if (entries.length > 1) {
    return reject(
      "ambiguous_gesture",
      ABILITY_RULE,
      `abilities: ${entries.map((entry) => entry.ability).join(", ")}`,
    );
  }
  const located = host.findCard(room, equipmentCardId);
  const refs = located ? activatedAbilitiesOf(room, host, located).map((entry) => entry.ref) : [];
  const ability = refs.find((ref) => ref.startsWith("equip:")) ?? "equip:0";
  return intentOrReject(room, actorId, activateIntent(equipmentCardId, ability, [unitCardId]), host);
}

function translateToggle(
  room: Room,
  actorId: string,
  action: GestureAction,
  host: RulesHost,
): GestureTranslation {
  const zone = str(action.zone);
  const cardId = str(action.cardId);
  if (!cardId) return reject("strict_mode_action", GESTURE_CONTRACT, "toggle_exhausted needs a cardId");
  if (zone !== "base" && zone !== "legend" && zone !== "runeArea" && !BATTLEFIELD_ZONES.has(zone)) {
    return reject("strict_mode_action", GESTURE_CONTRACT, `${zone || "that zone"} is not a board zone to use`);
  }
  if (typeof action.expectedExhausted !== "boolean") {
    return reject("strict_mode_action", GESTURE_CONTRACT, "toggle_exhausted needs expectedExhausted");
  }
  if (action.expectedExhausted === true) {
    // Readying is part of the Awaken step (369.3), not a discretionary board action.
    return reject("strict_mode_action", GESTURE_CONTRACT, "readying a card is not a strict game action");
  }
  // "Use" = exhaust/tap the object: exactly one legal activated ability, otherwise ask/explain.
  return translateUse(room, actorId, cardId, str(action.ability), host);
}

/**
 * Translate one non-`rules_*` gameplay action from a strict room (§4/§6.4).
 *
 * Pure and deterministic: it only reads the room through the rules view and never mutates it.
 * The caller applies an `intent` through `applyRulesIntent`, turns `reject` into the normal
 * action error (code/rule/detail) and lets `passthrough` continue to `gate()` + the sandbox
 * handler (cosmetic actions and the §6.4 manual window).
 */
export function translateGesture(
  room: Room,
  actorId: string,
  action: GestureAction,
  host: RulesHost,
): GestureTranslation {
  // Sandbox rooms have no strict layer (the caller never reaches this function in practice).
  if (room.rulesMode !== "strict" || room.phase !== "in_game" || !room.rules) {
    return { kind: "passthrough" };
  }
  // §4: dice, arrows/pings, board settings and card labels are always allowed.
  if (isCosmeticAction(action.type)) return { kind: "passthrough" };
  if (action.type.startsWith("rules_")) return { kind: "passthrough" };

  // 411.2: while a choice is pending, priority is irrelevant — answer the prompt first.
  const who = whoMayAct(room);
  if (who.kind === "prompt" && who.player === actorId) {
    return reject("prompt_pending", "411.2");
  }
  // §6.4: while the manual window is open, its player keeps the sandbox board actions.
  if (room.rules.manual && room.rules.manual.player === actorId && isManualBoardAction(action.type)) {
    return { kind: "passthrough" };
  }

  switch (action.type) {
    case "move_card":
      // Hand/Champion/Trash/Banishment → Base/Battlefield is a play; Base ⇄ Battlefield (and
      // Battlefield → Battlefield with Ganking) is a Standard Move. Everything else is not.
      return translateMoveCard(room, actorId, action, host);
    case "move_cards_to_trash_batch":
    case "move_off_board_cards_batch": {
      // Multi-card batches are free-form in the sandbox; the only strict multi-card gesture is a
      // multi-Unit Standard Move (send `move_card { cardIds, to }` instead).
      const to = str(action.to);
      const from = str(action.from);
      const batchMove =
        action.type === "move_off_board_cards_batch" &&
        (from === "base" || BATTLEFIELD_ZONES.has(from)) &&
        (to === "base" || BATTLEFIELD_ZONES.has(to));
      if (batchMove) return translateMove(room, actorId, action, host);
      return reject("strict_mode_action", GESTURE_CONTRACT, `${action.type} from ${from || "that zone"} is not a strict game action`);
    }
    case "chain_add":
      return translateChainAdd(room, actorId, action, host);
    case "toggle_exhausted":
      return translateToggle(room, actorId, action, host);
    case "equip_card":
      return translateEquip(room, actorId, action, host);
    case "end_turn":
      return intentOrReject(room, actorId, { type: "rules_end_turn" }, host);
    default:
      // Any other gameplay action (draws, runes, counters, might, score/XP, shuffles, zone
      // transfers, chain_resolve/chain_add markers, concession of board state, …) has no strict
      // meaning: the engine or the rules layer performs those operations.
      return reject("strict_mode_action", GESTURE_CONTRACT, `${action.type} is not a strict game action`);
  }
}
