/**
 * Evaluation environment for the Effect DSL — §6.2, 355, 359.3.e/f.
 *
 * `EffectEnv` is plain JSON (it is stored inside a resolution prompt when the interpreter has to
 * wait for a player, 355.18 / 411.2). It carries the controller, the source, the play-time
 * choices bound on the chain item (355) and the resolution variables the interpreter records
 * (affected objects, illegal targets, last-known information, …).
 */
import type { GameEvent, Room, TargetSnapshot } from "@rift/protocol";
import type { RulesHost } from "../host";

export type AbilityKindTag =
  | "spell"
  | "activated"
  | "triggered"
  | "add"
  | "replacement"
  | "delayed"
  | "passive"
  | "effect";

/** Last-known information about an object (359.3.e.13 "look back"). */
export interface LastKnown {
  controller?: string | null;
  owner?: string | null;
  zone?: string | null;
  might?: number | null;
  name?: string | null;
  type?: string | null;
}

export interface EffectEnv {
  controller: string;
  sourceObjectId?: string;
  sourceName?: string;
  itemId?: string;
  kind?: AbilityKindTag;
  /** Play-time choices bound on the chain item (355); read-only during resolution. */
  choices: Record<string, unknown>;
  /** Resolution variables (`$did`, `$affected`, `$legal:<key>`, `$lki`, `choose` results, …). */
  vars: Record<string, unknown>;
  /** The event that triggered this ability (383.2.c.3.b, 359.3.f.3). */
  event?: GameEvent;
  /** The current `for_each` element (`"it"`). */
  it?: string | null;
  /** Target zones noted when the item finalized (359.3.e.2/4). */
  snapshot?: Record<string, TargetSnapshot>;
}

/** Read context for selectors / amounts / conditions. */
export interface EvalContext {
  room: Room;
  host: RulesHost;
  env: EffectEnv;
  /** Layer recursion depth (478.1.c): > 0 sees base values and object-level modifiers only. */
  depth?: number;
}

export function makeEnv(partial: Partial<EffectEnv> & { controller: string }): EffectEnv {
  return {
    choices: {},
    vars: {},
    ...partial,
  };
}

export function lkiOf(env: EffectEnv, id: string): LastKnown | undefined {
  const table = env.vars.$lki as Record<string, LastKnown> | undefined;
  return table?.[id];
}

export function setLki(env: EffectEnv, id: string, info: LastKnown): void {
  const table = ((env.vars.$lki as Record<string, LastKnown> | undefined) ??= {});
  env.vars.$lki = table;
  table[id] = { ...(table[id] ?? {}), ...info };
}

/** Normalize a choice value (string | string[] | unknown) to an id list. */
export function idsOf(value: unknown): string[] {
  if (typeof value === "string") return value.length > 0 ? [value] : [];
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  return [];
}
