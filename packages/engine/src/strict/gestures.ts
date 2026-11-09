/**
 * Strict-room board gestures — §6.4 and the "act on the board, not from a list" contract.
 *
 * In a strict room the player manipulates the board exactly like the sandbox (drag a card from
 * hand to base/a battlefield, drag units, tap a card/rune/gear, drop a card onto another card).
 * This module turns one such wire action into the one `rules_*` intent it means, or explains why
 * the gesture is illegal. It never mutates the room and never applies anything:
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
 * | hand card dropped on a target object                    | `rules_play { cardId, choices:{<target key>:[id]} }` |
 * | hand permanent dropped on a card at a battlefield       | `rules_play { cardId, location:<battlefield> }` |
 * | `move_card` base/bf → base/bf (unit(s))                 | `rules_move { unitIds, to }`   |
 * | board object dropped on a target object                 | `rules_activate { objectId, ability, choices:{…} }` |
 * | board unit dropped on a card at a battlefield (no ability targets it) | `rules_move { unitIds, to:<battlefield> }` |
 * | `toggle_exhausted` on a ready board object              | `rules_activate` (one ability) |
 * | `equip_card` gear (board) → unit                        | `rules_activate equip:<n>`     |
 * | `equip_card` Quick-Draw gear (hand) → unit              | `rules_play { cardId, location:"base" }` (trigger prompts) |
 * | object click while a single-option prompt is open       | `rules_choose { promptId, answer:{ optionIds:[id] } }` |
 * | `end_turn`                                              | `rules_end_turn`               |
 * | cosmetic/meta actions (§4)                              | passthrough to `gate()`        |
 * | §6.4 manual board actions for the manual player         | passthrough to `gate()`        |
 * | anything else (free-form manipulation)                  | `strict_mode_action` reject    |
 *
 * Targeting contract (C2): `choices[<ChoiceSpec.key>]` holds `string[]` of option ids. A drop
 * binds the FIRST required target spec (rule order mode → targets → X) whose legal options
 * include the dropped object; every other choice is left unanswered so the engine opens its
 * normal prompts. Nothing else is guessed. A drop on a card at a battlefield of a permanent that
 * has no such target spec is a play to that battlefield (the existing location row).
 *
 * Ambiguity rule: a gesture that matches several legal activated abilities is NOT guessed. It is
 * rejected with `ambiguous_gesture` and the candidate refs in `detail`; the client may resend the
 * gesture with an explicit `ability`, or send `rules_activate` itself. The rules layer has no
 * public "open a prompt" entry point, so the engine cannot open a choose-ability prompt without a
 * rules-side change (reported to the lead).
 */
import type {
  ChoiceRecord,
  Prompt,
  PromptOption,
  ReasonCode,
  Room,
  RulesActivateIntent,
  RulesChooseIntent,
  RulesIntent,
  RulesMoveIntent,
  RulesPlayIntent,
  ZoneSelector,
} from "@rift/protocol";
import {
  activatedAbilitiesOf,
  cardKeywords,
  explainIllegal,
  hasKeyword,
  isCosmeticAction,
  isManualBoardAction,
  legalIntents,
  lookupAbility,
  requiredChoices,
  type ActivatedAbilityInfo,
  type ChoiceSpec,
  type RulesHost,
} from "@rift/rules";

export type GestureAction = Record<string, unknown> & { type: string };

export type GestureTranslation =
  | { kind: "intent"; intent: RulesIntent }
  | { kind: "reject"; code: ReasonCode; rule?: string; detail?: string }
  | { kind: "passthrough" };

const GESTURE_CONTRACT = "contract:§4";
const ABILITY_RULE = "403.3";
const TARGET_RULE = "355.9";

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

/** 411.2 prompts whose options are board objects/zones: a click can answer them. */
const OBJECT_PROMPT_KINDS: ReadonlySet<string> = new Set([
  "choose-target",
  "choose-card",
  "choose-battlefield",
]);

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    : [];
}

function isBattlefieldZone(zone: string): boolean {
  return BATTLEFIELD_ZONES.has(zone);
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

function playIntent(
  cardId: string,
  location?: string,
  hide = false,
  choices?: ChoiceRecord,
): RulesPlayIntent {
  return {
    type: "rules_play",
    cardId,
    ...(location ? { location: location as ZoneSelector } : {}),
    ...(hide ? { hide: true } : {}),
    ...(choices && Object.keys(choices).length > 0 ? { choices } : {}),
  };
}

function activateIntent(
  objectId: string,
  ability: string,
  options: { targets?: string[]; choices?: ChoiceRecord } = {},
): RulesActivateIntent {
  const { targets, choices } = options;
  return {
    type: "rules_activate",
    objectId,
    ability,
    ...(targets && targets.length > 0 ? { targets } : {}),
    ...(choices && Object.keys(choices).length > 0 ? { choices } : {}),
  };
}

function moveIntent(unitIds: string[], to: string): RulesMoveIntent {
  return { type: "rules_move", unitIds, to: to as ZoneSelector };
}

function chooseIntent(promptId: string, optionIds: string[]): RulesChooseIntent {
  return { type: "rules_choose", promptId, answer: { optionIds } };
}

/** The object a targeting gesture dropped onto (additive wire fields; see docs). */
function targetObjectId(action: GestureAction): string {
  return str(action.targetCardId) || str(action.targetObjectId);
}

/** Option ids/aliases that identify one object across prompt/spec options. */
function optionMatches(option: PromptOption, id: string): boolean {
  return option.id === id || option.objectId === id || option.cardId === id || option.zone === id;
}

function firstTargetBinding(
  specs: readonly ChoiceSpec[],
  targetId: string,
): { key: string; value: string } | null {
  for (const spec of specs) {
    if (!spec.targeted) continue;
    const option = spec.options.find((entry) => !entry.disabled && optionMatches(entry, targetId));
    if (option) return { key: spec.key, value: option.id };
  }
  return null;
}

function firstZoneBinding(
  specs: readonly ChoiceSpec[],
  zone: string,
): { key: string; value: string } | null {
  for (const spec of specs) {
    if (!spec.targeted) continue;
    const option = spec.options.find(
      (entry) => !entry.disabled && (entry.zone === zone || entry.id === zone),
    );
    if (option) return { key: spec.key, value: option.id };
  }
  return null;
}

function boundChoices(binding: { key: string; value: string }): ChoiceRecord {
  return { [binding.key]: [binding.value] };
}

/* ---------------------------------------------------------------- choices / target specs */

/** Play-time choices of the card's spell ability (empty for units/gear/unscripted cards). */
function playChoiceSpecs(room: Room, host: RulesHost, actorId: string, cardId: string): ChoiceSpec[] {
  const info = host.cardInfo(room, cardId);
  const spell = info ? lookupAbility(info.name, "spell")?.ability : undefined;
  if (!spell) return [];
  return requiredChoices(room, host, spell, {
    controller: actorId,
    sourceObjectId: cardId,
    choices: {},
  });
}

/** The most plausible ability ref for explaining a source that has no legal activation. */
function plausibleAbilityRef(room: Room, host: RulesHost, objectId: string): string {
  const located = host.findCard(room, objectId);
  if (!located) return "activated:0";
  if (located.zone === "runeArea") return "rune:exhaust";
  const refs = activatedAbilitiesOf(room, host, located).map((entry) => entry.ref);
  return (
    refs.find((ref) => ref.startsWith("equip:")) ??
    refs.find((ref) => ref.startsWith("activated:")) ??
    refs[0] ??
    "activated:0"
  );
}

/* ---------------------------------------------------------------- prompt clicks (411.2) */

/** The object/zone ids a click or drop refers to, most specific first. */
function actionObjectIds(action: GestureAction): string[] {
  const ids: string[] = [];
  const add = (value: unknown) => {
    const id = str(value);
    if (id && !ids.includes(id)) ids.push(id);
  };
  add(action.targetCardId);
  add(action.targetObjectId);
  switch (action.type) {
    case "toggle_exhausted":
      add(action.cardId);
      add(action.zone);
      break;
    case "move_card":
      add(action.cardId);
      add(action.to);
      break;
    case "chain_add":
      add(action.cardId);
      break;
    case "equip_card":
      add(action.unitCardId);
      add(action.equipmentCardId);
      break;
    case "move_off_board_cards_batch":
    case "move_cards_to_trash_batch":
      for (const id of stringList(action.cardIds)) add(id);
      break;
    default:
      break;
  }
  return ids;
}

/**
 * 411.2: while an object-selecting prompt is open for the actor, a click/drop on one of its
 * options answers it with `rules_choose`. Only prompts that need exactly one selection are
 * answered; a multi-selection prompt is left to the client's accumulate-then-confirm flow.
 */
function translatePromptClick(
  room: Room,
  actorId: string,
  action: GestureAction,
  host: RulesHost,
): GestureTranslation | null {
  const prompt: Prompt | null = room.rules?.prompt ?? null;
  if (!prompt || prompt.playerId !== actorId) return null;
  if (!OBJECT_PROMPT_KINDS.has(prompt.kind)) return reject("prompt_pending", "411.2");

  const candidates = actionObjectIds(action);
  if (candidates.length === 0) return reject("prompt_pending", "411.2");
  const options = (prompt.options ?? []).filter((option) => !option.disabled);
  const option = options.find((entry) => candidates.some((id) => optionMatches(entry, id)));
  if (!option) {
    return reject("invalid_choice", "411.2", `${candidates[0]} is not an option of prompt ${prompt.id}`);
  }
  const max = prompt.max ?? options.length;
  if (max > 1) {
    return reject(
      "invalid_choice",
      "411.2",
      `${prompt.id}: choose ${Math.max(0, prompt.min ?? 1)}-${max}; accumulate clicks and send rules_choose on confirm`,
    );
  }
  return intentOrReject(room, actorId, chooseIntent(prompt.id, [option.id]), host);
}

/* ---------------------------------------------------------------- tap / activate */

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

/* ---------------------------------------------------------------- targeting */

/** 818.1.b.1: Equip targets a visible Unit its controller controls on the Board. */
function equipTargetAccepted(
  room: Room,
  host: RulesHost,
  actorId: string,
  gearId: string,
  targetId: string,
): boolean {
  if (targetId === gearId) return false;
  const located = host.findCard(room, targetId);
  if (!located || located.playerId !== actorId || located.card.hidden) return false;
  if (located.zone !== "base" && !isBattlefieldZone(located.zone)) return false;
  const info = host.cardInfo(room, targetId);
  return !!info?.type.toLowerCase().includes("unit");
}

/** The first target spec of `entry` that accepts `targetId`, or null. */
function abilityTargetBinding(
  room: Room,
  host: RulesHost,
  actorId: string,
  objectId: string,
  entry: ActivatedAbilityInfo,
  targetId: string,
): { key: string; value: string } | null {
  if (entry.builtin === "equip") {
    return equipTargetAccepted(room, host, actorId, objectId, targetId)
      ? { key: "target:0", value: targetId }
      : null;
  }
  if (entry.builtin || entry.manual) return null;
  const specs = requiredChoices(room, host, entry.ability, {
    controller: actorId,
    sourceObjectId: objectId,
    choices: {},
  });
  return firstTargetBinding(specs, targetId);
}

/**
 * Explain a board-object → object gesture that matched no legal ability: bind the target to the
 * first target spec of the most plausible ability so the rules verdict names the reason
 * (illegal_target / no_legal_targets / insufficient_resources / …).
 */
function explainUntargetable(
  room: Room,
  actorId: string,
  objectId: string,
  targetId: string,
  host: RulesHost,
): GestureTranslation {
  const located = host.findCard(room, objectId);
  const abilities = located ? activatedAbilitiesOf(room, host, located) : [];
  for (const entry of abilities) {
    if (entry.builtin === "equip") {
      return intentOrReject(
        room,
        actorId,
        activateIntent(objectId, entry.ref, { choices: { "target:0": [targetId] } }),
        host,
      );
    }
    if (entry.builtin || entry.manual) continue;
    const specs = requiredChoices(room, host, entry.ability, {
      controller: actorId,
      sourceObjectId: objectId,
      choices: {},
    });
    const spec = specs.find((candidate) => candidate.targeted);
    if (spec) {
      return intentOrReject(
        room,
        actorId,
        activateIntent(objectId, entry.ref, { choices: boundChoices({ key: spec.key, value: targetId }) }),
        host,
      );
    }
  }
  return reject(
    "illegal_target",
    TARGET_RULE,
    `${objectId} has no activated ability that targets ${targetId}`,
  );
}

/**
 * A board object dragged/clicked onto another object.
 *
 * Order: one legal ability whose first target spec accepts the target → activate it; several →
 * `ambiguous_gesture`; none + `moveFallback` and a Unit target sits at another battlefield → a
 * Standard Move there (144/449); else the most specific rejection.
 */
function translateObjectTarget(
  room: Room,
  actorId: string,
  objectId: string,
  targetId: string,
  host: RulesHost,
  options: { requested?: string; onlyEquip?: boolean; moveFallback?: boolean } = {},
): GestureTranslation {
  if (!objectId) return reject("strict_mode_action", GESTURE_CONTRACT, "a target gesture needs a dragged object");
  if (!targetId) return reject("strict_mode_action", GESTURE_CONTRACT, "a target gesture needs a target object");
  if (objectId === targetId) return reject("illegal_target", TARGET_RULE, "an object cannot target itself");

  const requested = options.requested ?? "";
  const located = host.findCard(room, objectId);
  const allAbilities = located ? activatedAbilitiesOf(room, host, located) : [];
  const legal = legalIntents(room, actorId, host);
  const entries = legal.activatable
    .filter(
      (entry) =>
        entry.objectId === objectId && (!options.onlyEquip || entry.ability.startsWith("equip:")),
    )
    .flatMap((entry) => {
      const full = allAbilities.find((candidate) => candidate.ref === entry.ability);
      return full ? [full] : [];
    });
  if (requested) {
    const entry = allAbilities.find((candidate) => candidate.ref === requested);
    if (!entry) return reject("illegal_action", ABILITY_RULE, `${requested} is not an activated ability`);
    const binding = abilityTargetBinding(room, host, actorId, objectId, entry, targetId);
    if (!binding) {
      return reject("illegal_target", TARGET_RULE, `${requested} does not target ${targetId}`);
    }
    return intentOrReject(
      room,
      actorId,
      activateIntent(objectId, requested, { choices: boundChoices(binding) }),
      host,
    );
  }

  const candidates = entries.flatMap((entry) => {
    const binding = abilityTargetBinding(room, host, actorId, objectId, entry, targetId);
    return binding ? [{ ability: entry.ref, binding }] : [];
  });
  if (candidates.length === 1) {
    const candidate = candidates[0]!;
    return intentOrReject(
      room,
      actorId,
      activateIntent(objectId, candidate.ability, { choices: boundChoices(candidate.binding) }),
      host,
    );
  }
  if (candidates.length > 1) {
    return reject(
      "ambiguous_gesture",
      ABILITY_RULE,
      `abilities: ${candidates.map((candidate) => candidate.ability).join(", ")}`,
    );
  }

  if (options.moveFallback) {
    const dragged = host.findCard(room, objectId);
    const draggedInfo = dragged ? host.cardInfo(room, objectId) : null;
    const target = host.findCard(room, targetId);
    const targetZone = target?.zone ?? (isBattlefieldZone(targetId) ? targetId : "");
    if (
      dragged &&
      draggedInfo?.type.toLowerCase().includes("unit") &&
      isBattlefieldZone(targetZone) &&
      targetZone !== dragged.zone
    ) {
      return intentOrReject(room, actorId, moveIntent([objectId], targetZone), host);
    }
  }
  return explainUntargetable(room, actorId, objectId, targetId, host);
}

/* ---------------------------------------------------------------- play gestures */

/**
 * A card being played, optionally dropped onto a target object.
 *
 * A matching target spec binds the object up front. A permanent (unit/gear) with no such spec
 * and a target at a battlefield is played to that battlefield (the existing location row). A
 * spell that does not target the object is rejected with the rules verdict.
 */
function translatePlay(
  room: Room,
  actorId: string,
  cardId: string,
  targetId: string,
  location: string | undefined,
  hide: boolean,
  host: RulesHost,
): GestureTranslation {
  if (!cardId) return reject("strict_mode_action", GESTURE_CONTRACT, "a play needs a cardId");
  const specs = playChoiceSpecs(room, host, actorId, cardId);
  const info = host.cardInfo(room, cardId);
  const permanent = !!info && /unit|gear/i.test(info.type);

  if (targetId) {
    const binding = firstTargetBinding(specs, targetId);
    if (binding) {
      return intentOrReject(room, actorId, playIntent(cardId, undefined, hide, boundChoices(binding)), host);
    }
    const zoneBinding = isBattlefieldZone(targetId) ? firstZoneBinding(specs, targetId) : null;
    if (zoneBinding) {
      return intentOrReject(room, actorId, playIntent(cardId, undefined, hide, boundChoices(zoneBinding)), host);
    }
    const targetZone = host.findCard(room, targetId)?.zone ?? "";
    const battlefield = isBattlefieldZone(targetZone)
      ? targetZone
      : isBattlefieldZone(targetId)
        ? targetId
        : "";
    if (permanent && battlefield) {
      return intentOrReject(room, actorId, playIntent(cardId, battlefield, hide), host);
    }
    const mode = specs.find((spec) => spec.key === "mode");
    if (mode) {
      return reject(
        "ambiguous_gesture",
        "355.3",
        `mode: ${mode.options.map((option) => option.id).join(", ")}`,
      );
    }
    const targeted = specs.find((spec) => spec.targeted);
    if (targeted) {
      // Same verdict as the targeted play: illegal_target / no_legal_targets with its rule.
      return intentOrReject(
        room,
        actorId,
        playIntent(cardId, undefined, hide, boundChoices({ key: targeted.key, value: targetId })),
        host,
      );
    }
    return reject("illegal_target", TARGET_RULE, `card ${cardId} does not target ${targetId}`);
  }

  // No target object: a drop on a battlefield may bind a choose-battlefield spec (355.4).
  if (location && isBattlefieldZone(location)) {
    const binding = firstZoneBinding(specs, location);
    if (binding) {
      return intentOrReject(room, actorId, playIntent(cardId, undefined, hide, boundChoices(binding)), host);
    }
  }
  return intentOrReject(room, actorId, playIntent(cardId, location, hide), host);
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
  const targetId = targetObjectId(action);
  if (!from || !to) return reject("strict_mode_action", GESTURE_CONTRACT, "move_card needs from/to");
  if (to === "chain") {
    return reject("strict_mode_action", GESTURE_CONTRACT, "cards enter the chain by being played");
  }

  // Hand/Champion/Trash/Banishment → Base/Battlefield is the play of a card (units/gear;
  // spells also arrive as chain_add). The rules layer checks any play permission.
  if (PLAY_SOURCES.has(from) && PLAY_TARGETS.has(to)) {
    return translatePlay(room, actorId, cardId, targetId, to, action.asHidden === true, host);
  }

  // Base ⇄ Battlefield (and Battlefield → Battlefield with Ganking) is a Standard Move (449–455),
  // unless the gesture drops the object onto another object (a targeting gesture).
  const boardSource = from === "base" || isBattlefieldZone(from);
  const boardTarget = to === "base" || isBattlefieldZone(to);
  if (boardSource && boardTarget) {
    if (targetId) {
      return translateObjectTarget(room, actorId, cardId, targetId, host, { moveFallback: true });
    }
    const unitIds = stringList(action.cardIds);
    const ids = unitIds.length > 0 ? unitIds : stringList(action.unitIds);
    if (ids.length === 0 && cardId) ids.push(cardId);
    if (ids.length === 0) {
      return reject("strict_mode_action", GESTURE_CONTRACT, "move_card needs a cardId/cardIds");
    }
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
  if (unitIds.length === 0) {
    return reject("strict_mode_action", GESTURE_CONTRACT, "move_card needs a cardId/cardIds");
  }
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
  return translatePlay(room, actorId, cardId, targetObjectId(action), undefined, false, host);
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
    // 819.1.d: a Quick-Draw gear dropped from hand onto a Unit is played; its keyword trigger
    // then prompts for the attach target (the trigger's choice cannot be carried by rules_play).
    const info = host.cardInfo(room, equipmentCardId);
    if (!info || !hasKeyword(cardKeywords(room, host, equipmentCardId, info), "Quick-Draw")) {
      return reject(
        "strict_mode_action",
        "819.1.d",
        "that gear has no Quick-Draw; attach it with its Equip ability instead",
      );
    }
    return intentOrReject(room, actorId, playIntent(equipmentCardId, "base"), host);
  }
  if (!equipmentCardId || !unitCardId) {
    return reject("strict_mode_action", GESTURE_CONTRACT, "equip_card needs equipmentCardId/unitCardId");
  }
  return translateObjectTarget(room, actorId, equipmentCardId, unitCardId, host, {
    ...(str(action.ability) ? { requested: str(action.ability) } : {}),
    onlyEquip: true,
  });
}

function translateToggle(
  room: Room,
  actorId: string,
  action: GestureAction,
  host: RulesHost,
): GestureTranslation {
  const zone = str(action.zone);
  const cardId = str(action.cardId);
  const targetId = targetObjectId(action);
  if (!cardId) return reject("strict_mode_action", GESTURE_CONTRACT, "toggle_exhausted needs a cardId");
  if (zone !== "base" && zone !== "legend" && zone !== "runeArea" && !isBattlefieldZone(zone)) {
    return reject("strict_mode_action", GESTURE_CONTRACT, `${zone || "that zone"} is not a board zone to use`);
  }
  if (typeof action.expectedExhausted !== "boolean") {
    return reject("strict_mode_action", GESTURE_CONTRACT, "toggle_exhausted needs expectedExhausted");
  }
  if (action.expectedExhausted === true) {
    // Readying is part of the Awaken step (369.3), not a discretionary board action.
    return reject("strict_mode_action", GESTURE_CONTRACT, "readying a card is not a strict game action");
  }
  const requested = str(action.ability);
  if (targetId) {
    return translateObjectTarget(room, actorId, cardId, targetId, host, {
      ...(requested ? { requested } : {}),
    });
  }
  // "Use" = exhaust/tap the object: exactly one legal activated ability, otherwise ask/explain.
  return translateUse(room, actorId, cardId, requested, host);
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

  // 411.2: a pending object-selecting prompt takes the next click/drop as its answer.
  const prompted = translatePromptClick(room, actorId, action, host);
  if (prompted) return prompted;
  // Any other pending prompt still demands an answer first.
  if (room.rules.prompt && room.rules.prompt.playerId === actorId) {
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
        (from === "base" || isBattlefieldZone(from)) &&
        (to === "base" || isBattlefieldZone(to));
      if (batchMove) return translateMove(room, actorId, action, host);
      return reject(
        "strict_mode_action",
        GESTURE_CONTRACT,
        `${action.type} from ${from || "that zone"} is not a strict game action`,
      );
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
      // transfers, chain_resolve, concession of board state, …) has no strict meaning: the engine
      // or the rules layer performs those operations.
      return reject("strict_mode_action", GESTURE_CONTRACT, `${action.type} is not a strict game action`);
  }
}
