/**
 * Cost builders for card scripts (F5): Empower, "costs less for each …".
 */
import type { Ability, Condition, Cost, Selector } from "@rift/protocol";
import { SELF } from "./selectors";
import { not, SELF_EMPOWERED } from "./conditions";
import { perCount, whilePassive } from "./passives";

/** 827.1.c.1: "[Empower] [Cost]" is short for "[Cost]: Empower this. Use only if not Empowered." */
export function empower(cost: Cost): Ability {
  return {
    kind: "activated",
    cost,
    effect: {
      op: "requires",
      condition: not(SELF_EMPOWERED),
      rule: "827.1.c.1",
      effect: { op: "empower", target: SELF },
    },
  };
}

/** 828.1.c: an "[Empowered] …" passive applies only while the source is Empowered. */
export function whileEmpowered(modifier: Parameters<typeof whilePassive>[1]): Ability {
  return whilePassive(SELF_EMPOWERED, modifier);
}

/**
 * "I cost [per] less for each <selector>" (356.4): one −`per` Energy cost passive per threshold,
 * up to `max` steps. `target` is the discounted card (default: me); `extra` conditions are and-ed.
 */
export function costLessForEach(selector: Selector, per: number, max: number, options: { target?: Selector; extra?: Condition[] } = {}): Ability[] {
  return perCount(selector, max, () => ({ kind: "cost", amount: -per, target: options.target ?? SELF }), options.extra);
}
