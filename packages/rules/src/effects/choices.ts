/**
 * Play-time choices — rules 355, 355.7, 355.8, 358.
 *
 * Owner: R2-effects. Consumer: R2-play (`process of play` 355/358 and `legalIntents`).
 * Semantics: `requiredChoices` reports the play-time choices still to be made for `ability`,
 * given the choices already bound in `ctx.choices`, in rule order (mode -> targets -> X). It
 * returns `[]` when nothing is needed or the card is unscripted. `validateChoices` answers
 * whether the bound choices are complete and legal now; resolution also uses it to detect
 * mistargeting (355.8 / 358).
 *
 * Signature is a cross-agent contract: keep it stable.
 */
import type {
  Ability,
  ChoiceRecord,
  PromptKind,
  PromptOption,
  Room,
  RuleRef,
  Verdict,
} from "@rift/protocol";
import type { RulesHost } from "../host";

export interface ChoiceSpec {
  /** Key under `ChainItem.choices` where the answer is stored, e.g. "mode", "target:0", "x". */
  key: string;
  /** A core PromptKind: choose-mode | choose-target | choose-card | choose-player | ... */
  kind: PromptKind;
  min: number;
  max: number;
  /** 355.7: chosen objects/players/zones are Targets unless the text says otherwise. */
  targeted: boolean;
  /** The currently legal options; `[]` means no legal choice. */
  options: PromptOption[];
  /** e.g. "355.7". */
  rule: RuleRef;
  label?: string;
  data?: Record<string, unknown>;
}

export interface ChoiceContext {
  controller: string;
  sourceObjectId?: string;
  itemId?: string;
  choices: ChoiceRecord;
}

export function requiredChoices(
  room: Room,
  host: RulesHost,
  ability: Ability,
  ctx: ChoiceContext,
): ChoiceSpec[] {
  // Stub (R2-effects): no scripts are parsed yet, so nothing is required.
  void room;
  void host;
  void ability;
  void ctx;
  return [];
}

export function validateChoices(
  room: Room,
  host: RulesHost,
  ability: Ability,
  ctx: ChoiceContext,
): Verdict {
  // Stub (R2-effects): every bound choice is treated as complete and legal.
  void room;
  void host;
  void ability;
  void ctx;
  return { ok: true };
}
