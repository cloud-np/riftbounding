/**
 * Radiance (RAD) script builders (lane-local; pure data helpers, no registration).
 */
import type {
  Ability,
  CardTypeName,
  Condition,
  Effect,
  KeywordName,
  Modifier,
  PlayerSelector,
  Selector,
  ZoneSelector,
} from "@rift/protocol";
import type { RadAmount } from "./custom";
import { custom, SELF } from "../sdk";

/**
 * The catalog keyword list includes keywords that only appear in reminder text, in granted text
 * ("Your gear have [Deflect]") or in another object's text (a token's [Deflect]); they are not the
 * card's own (135.2.d.3, 727.1.b). Marked with value 0 so the layers ignore the printed copy.
 */
export { notIntrinsic } from "../sdk";

/** "I enter ready." — 369.3 replacement (EX[134]). */
export { ENTER_READY } from "../sdk";
/** A conditional modifier (364.3.a) — `whileModifier` from `cards/lib`. */
export { whileModifier as conditional } from "../sdk";

/** A zone bound to a choice/variable key (a chosen battlefield's id resolves to its zone). */
export function zoneRef(ref: string): ZoneSelector {
  return { kind: "chosen", ref };
}

/** "Choose a battlefield" — a battlefield target (355.7; battlefields are objects, 053.3). */
export function aBattlefield(ref: string, extra: Partial<Selector> = {}): Selector {
  return { chosen: true, cardType: "battlefield", targetRef: ref, ...extra };
}

/** `it` is a face-up unit or gear (107.3: a facedown card is neither). */
export const UNIT_OR_GEAR: Condition = {
  kind: "and",
  conditions: [custom("rad:unit-or-gear"), custom("rad:face-up")],
};

/** "… equal to <value>": run `effect` with the value substituted for `{kind:"x"}` / "$X" / "{X}". */
export function letX(amount: RadAmount, effect: Effect): Effect {
  return { op: "custom", id: "rad:let-x", params: { amount, effect } };
}

/**
 * "Choose an opponent" (355.7: a player target, chosen when the ability is played) for abilities
 * whose later instructions read `{ kind: "chosen", ref: "opponent" }` from a field the choice scan
 * does not cover (`choose.chooser`, a selector's controller). The zero-amount draw only binds the
 * choice; drawing 0 does nothing (414.4).
 */
export const CHOOSE_OPPONENT: Effect = {
  op: "draw",
  amount: 0,
  player: { kind: "chosen", ref: "opponent" },
};

/** The value placeholder for numeric fields that only accept numbers (e.g. `TokenSpec.count`). */
export const X_NUMBER = "$X" as unknown as number;

/** "Draw it" — the referenced card goes from the Main Deck to hand as a draw. */
export function drawCard(ref: string): Effect {
  return { op: "custom", id: "core:draw-ref", params: { ref } };
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

export { costLessForEach } from "../sdk";

/**
 * "Opponents can't play <type> this turn" — a play restriction (054.1) on every card of that type
 * the opponents could play, in each zone a card can be played from (420.1.a, 811.1.b, 354).
 */
export function opponentsCantPlay(cardType: CardTypeName): Effect {
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
