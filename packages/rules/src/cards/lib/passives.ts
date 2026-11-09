/**
 * Passive-ability builders for card scripts (F2/F5).
 */
import type { Ability, Condition, Modifier, Selector } from "@rift/protocol";
import { SELF } from "./selectors";
import { countAtLeast, xpAtLeast } from "./conditions";

/** A passive ability (365.1). */
export function passive(modifier: Modifier): Ability {
  return { kind: "passive", modifier };
}

/** 364.3.a / 727.1.b: `modifier` applies only while `condition` holds (a Dependent Ability). */
export function whileModifier(condition: Condition, modifier: Modifier): Modifier {
  return { kind: "while", condition, modifier };
}

/** 364.3.a: a conditional passive ability. */
export function whilePassive(condition: Condition, modifier: Modifier): Ability {
  return passive(whileModifier(condition, modifier));
}

/** 824.1.b.1: "[Level N] …" — the passive applies while you have N or more XP. */
export function atLevel(n: number, modifier: Modifier): Ability {
  return whilePassive(xpAtLeast(n), modifier);
}

/** 369.3 / EX[134]: "I enter ready." as a modifier. */
export const ENTER_READY_MODIFIER: Modifier = { kind: "enter-ready", target: SELF };

/** 369.3 / EX[134]: "I enter ready." */
export const ENTER_READY: Ability = passive(ENTER_READY_MODIFIER);

/** "I enter ready", optionally only while `condition` holds as I enter. */
export function enterReady(condition?: Condition): Ability {
  return condition ? whilePassive(condition, ENTER_READY_MODIFIER) : ENTER_READY;
}

/**
 * One passive per threshold of `selector`'s count ("for each …"): the layers sum fixed amounts
 * (356.4, 479.4), so the i-th instance applies while at least i objects match. `extra` conditions
 * (e.g. "while I'm on the board") are and-ed in.
 */
export function perCount(selector: Selector, steps: number, build: (index: number) => Modifier, extra: Condition[] = []): Ability[] {
  return Array.from({ length: steps }, (_, index) =>
    whilePassive(extra.length > 0 ? { kind: "and", conditions: [...extra, countAtLeast(selector, index + 1)] } : countAtLeast(selector, index + 1), build(index)),
  );
}

/**
 * "[Show Off] [Object]" (832): a passive the play layer turns into the `showOff` play-time
 * choice. `selector` filters the hand/board candidates (zone and controller are set for you);
 * `count` > 1 for sets ("five units …").
 */
export function showOff(selector: Selector, count?: number): Ability {
  return passive({ kind: "show-off", selector, ...(count ? { count } : {}) });
}
