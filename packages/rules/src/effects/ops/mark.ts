/**
 * `mark` — per-turn bookkeeping in `RulesHistory.effects.marks` (reset each turn), e.g. "choose
 * one that hasn't been chosen this turn". A string value is appended to a list; other values
 * replace the marker. Keys may contain `{self}`, replaced by the source object id.
 */
import type { ChoiceValue } from "@rift/protocol";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";

registerEffectOp("mark", (effect, context) => {
  if (effect.op !== "mark") return { status: "manual", reason: "effect_not_implemented:mark" };
  const rules = context.room.rules;
  if (!rules) return RESOLVED;
  const source = context.machine?.env.sourceObjectId ?? "";
  const key = effect.key.replace("{self}", source);
  const history = (rules.history.effects ??= {});
  const marks = (history.marks ??= {});
  const value: ChoiceValue = effect.value ?? true;
  if (typeof value === "string") {
    const existing = marks[key];
    const list = Array.isArray(existing) ? (existing as string[]) : [];
    if (!list.includes(value)) marks[key] = [...list, value];
  } else {
    marks[key] = value;
  }
  return RESOLVED;
});
