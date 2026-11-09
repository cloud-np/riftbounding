/**
 * Repeat — rule 820.
 *
 * 820.1.d: "You may pay [Cost] as an additional cost as you play this. If you do, execute the
 * instructions of this chain item one additional time during resolution."
 *
 * Two responsibilities live here:
 *
 * 1. **Play-time choices (820.2, 820.2.a).** Each paid Repeat instance runs the instructions
 *    again, and the repeated execution's choices are made at the usual time (Make Relevant
 *    Choices) and may differ from the first execution's choices. The play layer asks one extra
 *    full choice set per paid instance, stored as `repeat:<run>:<key>` on `ChainItem.choices`
 *    (`target:0` of run 1 is `repeat:1:target:0`). Deflect on a repeated target choice is charged
 *    separately (809.1.c: "for each time they choose me").
 * 2. **Execution count (820.1.d.1, 820.3).** `repeatExecutions` counts the paid instances; the
 *    resolution loop in `timing/fepr/resolve.ts` runs the script once per execution.
 *
 * Scripts that still implement the repeat themselves ("if you paid the Repeat cost" workaround)
 * set `CardScript.repeatHandled`; R4-cards removes those workarounds and the flag.
 */
import type { Ability, ChoiceRecord, Room } from "@rift/protocol";
import type { CardInfo, RulesHost } from "../host";
import type { RulesFailure } from "../types";
import { getCardScript } from "../cards/registry";
import { requiredChoices, validateChoices, type ChoiceSpec } from "../effects/choices";
import { deflectCostsForTargets, type AdditionalCostSpec } from "./additional-costs";
import { bindChoices, bindOptions, restrictToFacedown } from "./choices";

/** 820.1.c.2 / 820.3: one optional cost id per Repeat instance ("repeat", "repeat:1", …). */
const REPEAT_COST_ID = /^repeat(?::\d+)?$/;

/** 820.1.c.2 / 820.3: how many additional executions the chosen optional costs pay for. */
export function repeatExecutions(optionalCosts: readonly string[]): number {
  let count = 0;
  for (const id of optionalCosts) if (REPEAT_COST_ID.test(id)) count += 1;
  return count;
}

/** 820.1.d: the script executes the repeat itself (pre-engine-Repeat workaround). */
export function repeatHandledByScript(cardName: string | undefined): boolean {
  return cardName ? getCardScript(cardName)?.repeatHandled === true : false;
}

/** The choice key of execution `run` (1 = first repeated execution): `repeat:<run>:<key>`. */
export function repeatChoiceKey(run: number, key: string): string {
  return `repeat:${run}:${key}`;
}

/** The choices of one repeated execution, stripped back to the script's base keys. */
export function repeatRunChoices(choices: ChoiceRecord, run: number): ChoiceRecord {
  const prefix = `repeat:${run}:`;
  const out: ChoiceRecord = {};
  for (const [key, value] of Object.entries(choices)) {
    if (!key.startsWith(prefix)) continue;
    out[key.slice(prefix.length)] = value;
  }
  return out;
}

function sourceController(room: Room, host: RulesHost, info: CardInfo): string {
  const id = info.objectId;
  if (!id || !room.rules) return "";
  const item = room.rules.chain.find((entry) => entry.cardSnapshot?.id === id || entry.id === id);
  if (item) return item.controller;
  return host.findCard(room, id)?.playerId ?? "";
}

export interface RepeatChoiceBinding {
  ok: true;
  /** `request.choices` plus every bound `repeat:<run>:<key>`. */
  choices: ChoiceRecord;
  /** 355.7 target keys of the repeated executions (for Deflect, 809.1.c). */
  targetKeys: string[];
  /** The first repeated-execution choice that still needs a decision, or null. */
  pending: ChoiceSpec | null;
}

/**
 * 355.7 / 809.1.c: the keys whose bound values are Targets of the first execution. The normal
 * choice walker omits a choice that is already bound from its specs (so `CorePlan.targetKeys`
 * does not see it); Deflect is owed "for each time they choose me", including a target supplied
 * up front by the intent. Walk the specs in rule order, binding the provided values, to recover
 * the keys that are actually bound.
 */
export function targetedChoiceKeys(
  room: Room,
  host: RulesHost,
  ability: Ability,
  ctx: { controller: string; sourceObjectId?: string; itemId?: string; facedownAt?: string },
  choices: ChoiceRecord,
): string[] {
  const out: string[] = [];
  const bound: ChoiceRecord = {};
  for (let round = 0; round < 16; round += 1) {
    const specs = requiredChoices(room, host, ability, {
      controller: ctx.controller,
      ...(ctx.sourceObjectId ? { sourceObjectId: ctx.sourceObjectId } : {}),
      ...(ctx.itemId ? { itemId: ctx.itemId } : {}),
      choices: bound,
    });
    const spec = specs.find((entry) => !(entry.key in bound));
    if (!spec) break;
    if (spec.targeted && !out.includes(spec.key)) out.push(spec.key);
    if (Object.prototype.hasOwnProperty.call(choices, spec.key)) {
      bound[spec.key] = choices[spec.key]!;
      continue;
    }
    const options = restrictToFacedown(room, host, spec, ctx.facedownAt).filter((option) => !option.disabled);
    // 411.2: forced choices are bound by the process of play as well; stop at a real pending one.
    if (spec.min === spec.max && options.length === spec.min) {
      bound[spec.key] = bindOptions(spec, options);
      continue;
    }
    break;
  }
  return out;
}

/**
 * 820.2 / 820.2.a: bind one full choice set per paid Repeat instance under `repeat:<run>:<key>`.
 * Reuses the normal choice walker (`requiredChoices` + `bindChoices`) so forced choices,
 * 355.8/355.13 empties, option lists and 355.11 groups behave exactly like the first execution.
 */
export function bindRepeatChoices(
  room: Room,
  host: RulesHost,
  info: CardInfo | null,
  ability: Ability | undefined,
  request: { choices: ChoiceRecord; optionalCosts: readonly string[] },
): RepeatChoiceBinding | RulesFailure {
  const unchanged = (): RepeatChoiceBinding => ({ ok: true, choices: { ...request.choices }, targetKeys: [], pending: null });
  if (!info || !ability) return unchanged();
  if (repeatHandledByScript(info.name)) return unchanged();
  const runs = repeatExecutions(request.optionalCosts);
  if (runs === 0) return unchanged();

  const controller = sourceController(room, host, info);
  const sourceObjectId = info.objectId;
  const targetKeys: string[] = [];
  let choices: ChoiceRecord = { ...request.choices };
  for (let run = 1; run <= runs; run += 1) {
    const provider = (current: ChoiceRecord): ChoiceSpec[] =>
      requiredChoices(room, host, ability, {
        controller,
        ...(sourceObjectId ? { sourceObjectId } : {}),
        choices: repeatRunChoices(current, run),
      }).map((spec) => ({ ...spec, key: repeatChoiceKey(run, spec.key) }));
    const bound = bindChoices(
      room,
      host,
      provider,
      { controller, ...(sourceObjectId ? { sourceObjectId } : {}) },
      choices,
    );
    if (!bound.ok) return bound;
    choices = bound.choices;
    for (const key of bound.targetKeys) if (!targetKeys.includes(key)) targetKeys.push(key);
    if (bound.pending) return { ok: true, choices, targetKeys, pending: bound.pending };
    // 355.9 / 358.1: a value supplied up front for this execution is not re-offered by
    // `requiredChoices` (bound keys are omitted), so validate the completed execution explicitly.
    const legal = validateChoices(room, host, ability, {
      controller,
      ...(sourceObjectId ? { sourceObjectId } : {}),
      choices: repeatRunChoices(choices, run),
    });
    if (!legal.ok) return legal;
  }
  return { ok: true, choices, targetKeys, pending: null };
}

/** 809.1.c: Deflect owed for the repeated executions' target choices. */
export function repeatDeflectCosts(
  room: Room,
  host: RulesHost,
  playerId: string,
  choices: ChoiceRecord,
  targetKeys: readonly string[],
): AdditionalCostSpec[] {
  return deflectCostsForTargets(room, host, playerId, choices, targetKeys);
}
