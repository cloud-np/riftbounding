/**
 * Play-time choices — rules 355.3–355.13, 355.15, 403.2, 403.3, 411.2, 811.1.d.2.
 *
 * The play layer drives R2-effects' `requiredChoices` in rule order (mode → targets → X): each
 * spec is either already bound by the intent (validated against the offered options), forced
 * (exactly as many legal options as required → bound automatically, 411.2), empty (355.8: no
 * legal choice → the card cannot be played unless the choice is "up to"/"any number", 355.13),
 * or a real choice → returned as `pending` so the process opens a prompt. Specs are re-queried
 * after each binding so later choices can depend on earlier ones (e.g. targets of a mode).
 */
import type { Ability, ChoiceRecord, ChoiceValue, PromptOption, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import type { RulesFailure } from "../types";
import { fail } from "../types";
import { requiredChoices, type ChoiceSpec } from "../effects/choices";

export interface ChoiceBinding {
  ok: true;
  choices: ChoiceRecord;
  /** Keys whose values are Targets (355.7), for Deflect and 359.3.e. */
  targetKeys: string[];
  /** The first spec that needs a player decision, or null. */
  pending: ChoiceSpec | null;
}

export interface ChoiceBindContext {
  controller: string;
  sourceObjectId?: string;
  itemId?: string;
  /** 811.1.d.2: a spell played from facedown chooses from objects at this battlefield. */
  facedownAt?: string;
}

/** The value a chosen option binds under `ChoiceSpec.key`. */
export function optionValue(option: PromptOption): string | number {
  return option.value ?? option.objectId ?? option.cardId ?? option.playerId ?? option.zone ?? option.id;
}

function sameValue(a: unknown, option: PromptOption): boolean {
  return a === optionValue(option) || a === option.id;
}

/** 811.1.d.2: restrict object options to the facedown battlefield (unless the text forbids it). */
export function restrictToFacedown(room: Room, host: RulesHost, spec: ChoiceSpec, facedownAt: string | undefined): PromptOption[] {
  if (!facedownAt || spec.data?.hiddenUnrestricted === true) return spec.options;
  return spec.options.filter((option) => {
    const id = option.objectId ?? option.cardId;
    if (!id) return true; // players and zones are not "at" a battlefield
    return host.findCard(room, id)?.zone === facedownAt;
  });
}

/** 355.9/355.13/411.2: validate a bound value against the spec's legal options. */
export function validateBoundValue(spec: ChoiceSpec, options: readonly PromptOption[], value: ChoiceValue): RulesFailure | null {
  const values = Array.isArray(value) ? (value as Array<string | number>) : value === null ? [] : [value];
  if (values.length < spec.min || values.length > spec.max) {
    return fail("invalid_choice", spec.rule, `${spec.key}: choose ${spec.min}-${spec.max}`);
  }
  const used = new Set<string>();
  for (const entry of values) {
    const option = options.find((candidate) => sameValue(entry, candidate) && !used.has(candidate.id) && !candidate.disabled);
    if (!option) {
      return fail(spec.targeted ? "illegal_target" : "invalid_choice", spec.targeted ? "355.9" : spec.rule, `${spec.key}: ${String(entry)}`);
    }
    used.add(option.id);
  }
  return null;
}

/** Bind the values of `selected` options under the spec key (scalar for single choices). */
export function bindOptions(spec: ChoiceSpec, selected: readonly PromptOption[]): ChoiceValue {
  const values = selected.map(optionValue);
  if (spec.max <= 1) return values[0] ?? null;
  return values.every((value) => typeof value === "number") ? (values as number[]) : values.map(String);
}

const MAX_ROUNDS = 16;

/** Where choice specs come from: R2-effects' `requiredChoices`, or a built-in ability. */
export type ChoiceSpecProvider = (choices: ChoiceRecord) => ChoiceSpec[];

export function effectsSpecProvider(
  room: Room,
  host: RulesHost,
  ability: Ability,
  context: ChoiceBindContext,
): ChoiceSpecProvider {
  return (choices) =>
    requiredChoices(room, host, ability, {
      controller: context.controller,
      ...(context.sourceObjectId ? { sourceObjectId: context.sourceObjectId } : {}),
      ...(context.itemId ? { itemId: context.itemId } : {}),
      choices,
    });
}

export function bindChoices(
  room: Room,
  host: RulesHost,
  provider: ChoiceSpecProvider | undefined,
  context: ChoiceBindContext,
  initial: ChoiceRecord,
): ChoiceBinding | RulesFailure {
  const choices: ChoiceRecord = { ...initial };
  const targetKeys: string[] = [];
  if (!provider) return { ok: true, choices, targetKeys, pending: null };
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const specs = provider(choices);
    let progressed = false;
    for (const spec of specs) {
      if (spec.targeted && !targetKeys.includes(spec.key)) targetKeys.push(spec.key);
      const options = restrictToFacedown(room, host, spec, context.facedownAt).filter((option) => !option.disabled);
      if (Object.prototype.hasOwnProperty.call(choices, spec.key)) {
        const invalid = validateBoundValue(spec, options, choices[spec.key]!);
        if (invalid) return invalid;
        continue;
      }
      if (options.length < spec.min) {
        // 355.8 / 403.3: valid choices must exist for every required choice.
        return fail("no_legal_targets", spec.targeted ? "355.8" : spec.rule, spec.key);
      }
      if (options.length === 0) {
        // 355.13: "up to"/"any number" with no available target → zero targets.
        choices[spec.key] = spec.max <= 1 ? null : [];
        progressed = true;
        continue;
      }
      // 411.2: forced choices are made automatically.
      if (spec.min === spec.max && options.length === spec.min) {
        choices[spec.key] = bindOptions(spec, options);
        progressed = true;
        continue;
      }
      return { ok: true, choices, targetKeys, pending: { ...spec, options } };
    }
    if (!progressed) break;
  }
  return { ok: true, choices, targetKeys, pending: null };
}
