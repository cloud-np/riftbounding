/**
 * Helpers for the Origins O–Z card-script suites (wave R3, lane `ogn-oz`). Read-only use of the
 * shared scenario DSL and R2-effects helpers; nothing here changes engine behaviour.
 */
import type { CardInstance } from "@rift/protocol";
import { scenario } from "../../scenarios/dsl";
import { boardOf, fund, place } from "../../rules/effects/helpers";
import { boardCard, handNames, passBoth, resolveAll, withCards } from "../helpers";
export { boardCard, handNames, passBoth, resolveAll, withCards };

export type S = ReturnType<typeof scenario>;

/** Pass until the named card's item has left the chain (or a prompt opens). */
export function resolveItem(s: S, cardName: string, guard = 12): void {
  for (let index = 0; index < guard; index += 1) {
    const rules = s.room.rules!;
    if (rules.prompt) return;
    if (!rules.chain.some((item) => item.cardName === cardName)) return;
    const who = rules.priority;
    if (!who) return;
    s.as(who).pass().expectOk();
  }
}

/** Fund and play a card from hand for `player`; the opponent passes so it resolves. */
export function playAndResolve(
  s: S,
  player: string,
  name: string,
  options: { choices?: Record<string, unknown>; location?: string } = {},
): void {
  fund(s, player, name);
  s.as(player).play(name, options).expectOk();
}

/** Put a legend card (added through `extraCards`) into the player's legend zone. */
export function placeLegend(s: S, player: string, name: string): CardInstance {
  const board = boardOf(s, player) as unknown as Record<string, CardInstance[]>;
  board.legend!.splice(0, board.legend!.length);
  return place(s, player, name, "legend");
}

export function setMight(
  s: S,
  id: string,
  might: number,
  extra: Record<string, unknown> = {},
): void {
  s.room.rules!.objects[id] = { ...(s.room.rules!.objects[id] ?? {}), baseMight: might, ...extra };
}

/**
 * Drive the room until nothing is open (no chain, showdown, combat or prompt): passes priority /
 * focus and answers each prompt with `answer(prompt)` (default: its first option).
 */
export function driveAll(
  s: S,
  answer: (prompt: NonNullable<NonNullable<S["room"]["rules"]>["prompt"]>) => string[] = (
    prompt,
  ) => (prompt.options?.[0] ? [prompt.options[0].id] : []),
  guard = 30,
): void {
  for (let index = 0; index < guard; index += 1) {
    const rules = s.room.rules!;
    if (rules.prompt) {
      s.as(rules.prompt.playerId)
        .choose({ optionIds: answer(rules.prompt) })
        .expectOk();
      continue;
    }
    if (rules.chain.length === 0 && !rules.showdown && !rules.combat) return;
    const who = rules.priority ?? rules.focus;
    if (!who) return;
    s.as(who).pass().expectOk();
  }
}

/** Put a basic rune of `domain` (catalog code `cardCode`) on top of the player's Rune Deck. */
export function stackRune(s: S, player: string, domain: string, cardCode: string): CardInstance {
  const runeDeck = boardOf(s, player).runeDeck;
  const template = runeDeck[0]!;
  const rune = {
    ...template,
    id: `${player}-stacked-${cardCode}`,
    name: `${domain} Rune`,
    cardCode,
    imageUrl: `/cards/${cardCode}.webp`,
    domains: [domain],
  } as CardInstance;
  runeDeck.push(rune);
  return rune;
}

