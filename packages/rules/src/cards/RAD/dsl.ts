/**
 * Radiance (RAD) script builders (lane-local; pure data helpers, no registration).
 */
import type {
  Ability,
  Condition,
  Effect,
  KeywordName,
  Modifier,
  PlayerSelector,
  Selector,
  ZoneSelector,
} from "@rift/protocol";
import { SELF, custom } from "../dsl";
import type { RadAmount } from "./custom";

/**
 * The catalog keyword list includes keywords that only appear in reminder text, in granted text
 * ("Your gear have [Deflect]") or in another object's text (a token's [Deflect]); they are not the
 * card's own (135.2.d.3, 727.1.b). Marked with value 0 so the layers ignore the printed copy.
 */
export function notIntrinsic(...keywords: KeywordName[]): Ability[] {
  return keywords.map((keyword) => ({ kind: "keyword" as const, keyword, value: 0 }));
}

/** "I enter ready." — 369.3 replacement (EX[134]). */
export const ENTER_READY: Ability = {
  kind: "passive",
  modifier: { kind: "custom", id: "enter-ready", params: { target: SELF } },
};

/** A conditional passive (364.3.a). */
export function conditional(condition: Condition, modifier: Modifier): Modifier {
  return { kind: "custom", id: "conditional", params: { condition, modifier } };
}

/** A zone bound to a choice/variable key (a chosen battlefield's id resolves to its zone). */
export function zoneRef(ref: string): ZoneSelector {
  return { kind: "chosen", ref };
}

/** "Choose a battlefield" — a battlefield target (355.7; battlefields are objects, 053.3). */
export function aBattlefield(ref: string, extra: Partial<Selector> = {}): Selector {
  return { chosen: true, cardType: "battlefield", targetRef: ref, ...extra };
}

/** `it` is a unit or a gear. */
export const UNIT_OR_GEAR: Condition = custom("rad:unit-or-gear");

/** "… equal to <value>": run `effect` with the value substituted for `{kind:"x"}` / "$X" / "{X}". */
export function letX(amount: RadAmount, effect: Effect): Effect {
  return { op: "custom", id: "rad:let-x", params: { amount, effect } };
}

/** The value placeholder for numeric fields that only accept numbers (e.g. `TokenSpec.count`). */
export const X_NUMBER = "$X" as unknown as number;

/** "Draw it" — the referenced card goes from the Main Deck to hand as a draw. */
export function drawCard(ref: string): Effect {
  return { op: "custom", id: "rad:draw-card", params: { ref } };
}

/** Per-player "the first time each turn" guard pair for a battlefield trigger. */
export function oncePerPlayerPerTurn(
  key: string,
  effect: Effect,
): { condition: Condition; effect: Effect } {
  const unmarked = custom("rad:event-player-unmarked", { key });
  return {
    condition: unmarked,
    effect: {
      op: "if",
      condition: unmarked,
      then: {
        op: "seq",
        effects: [{ op: "custom", id: "rad:mark-event-player", params: { key } }, effect],
      },
    },
  };
}

/**
 * "I cost [N] less for each …" (356.4): one [N] discount per object counted, up to `max` (the
 * card's printed Energy cost, 356.6 floors the total at 0). Each step is a conditional cost
 * passive that applies from the hand (366.2.a).
 */
export function costLessForEach(selector: Selector, per: number, max: number): Ability[] {
  return Array.from({ length: max }, (_, index) => ({
    kind: "passive" as const,
    modifier: conditional(
      { kind: "count", selector, comparison: { op: "gte", value: index + 1 } },
      { kind: "cost", amount: -per, target: SELF },
    ),
  }));
}

/**
 * "Opponents can't play <type> this turn" — a play restriction (054.1) on every card of that type
 * the opponents could play, in each zone a card can be played from (420.1.a, 811.1.b, 354).
 */
export function opponentsCantPlay(cardType: string): Effect {
  const zones: ZoneSelector[] = ["hand", "champion", "trash", "banished", "deck", "battlefield"];
  return {
    op: "seq",
    effects: zones.map((zone) => ({
      op: "continuous" as const,
      duration: "this-turn" as const,
      modifier: {
        kind: "restriction" as const,
        restriction: "play",
        target: { cardType, owner: "opponent" as PlayerSelector, zone },
      },
    })),
  };
}
