/**
 * Edge-case audit helpers (docs/rules/edge-cases-audit.md).
 *
 * Thin wrappers over the scenario DSL (read-only) and the shared combat/card helpers so every
 * edge-case test builds a real strict duel through the real engine host.
 */
import type { CardInstance, GameEvent, Prompt } from "@rift/protocol";
import { scenario, type RulesScenario } from "../scenarios/dsl";
import { boardOf, placeUnit, setControl } from "../rules/combat/helpers";

export { boardOf, placeUnit, setControl };
export type S = RulesScenario;

/** A duel on two battlefields without a Victory Score modifier (p2's Aspirant's Climb adds 1). */
export function duel(extra: { p1?: string[]; p2?: string[] } = {}): S {
  return scenario({ battlefields: { p2: "Bandle Tree" }, extraCards: extra });
}

/** Board zones a strict-board click can reach today (base, battlefields, hand, legend, champion). */
export const CLICKABLE_ZONES: ReadonlySet<string> = new Set([
  "base",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "hand",
  "legend",
  "champion",
  "runeArea",
]);

export interface OptionLocation {
  id: string;
  owner: string | null;
  zone: string | null;
}

/** Where each card/object option of a prompt currently lives (null zone = not a card). */
export function optionLocations(s: S, prompt: Prompt): OptionLocation[] {
  return (prompt.options ?? []).map((option) => {
    const id = option.cardId ?? option.objectId ?? null;
    const located = id ? s.host.findCard(s.room, id) : null;
    return { id: option.id, owner: located?.playerId ?? null, zone: located?.zone ?? null };
  });
}

/**
 * Pass Priority/Focus with whoever holds it, answering prompts with `answer` (default: the first
 * `min` options), until `until` holds, nothing is pending, or the guard runs out. Collects events.
 */
export function drive(
  s: S,
  options: { until?: () => boolean; answer?: (prompt: Prompt) => string[] | null; guard?: number } = {},
): GameEvent[] {
  const events: GameEvent[] = [];
  for (let step = 0; step < (options.guard ?? 40); step += 1) {
    if (options.until?.()) break;
    const rules = s.room.rules!;
    if (s.room.gameOutcome) break;
    if (rules.prompt) {
      const ids = options.answer?.(rules.prompt) ?? rules.prompt.options?.slice(0, rules.prompt.min ?? 1).map((o) => o.id) ?? [];
      s.as(rules.prompt.playerId).choose({ optionIds: ids }).expectOk();
      events.push(...s.events());
      continue;
    }
    if (rules.chain.length === 0 && !rules.showdown && !rules.combat) break;
    const actor = rules.priority ?? rules.focus;
    if (!actor) break;
    s.as(actor).pass().expectOk();
    events.push(...s.events());
  }
  return events;
}

/** End p1's turn, then p2's, and settle every chain on the way (p1's next Main Phase). */
export function nextOwnTurn(s: S): GameEvent[] {
  const events: GameEvent[] = [];
  s.as(s.room.rules!.turn.player).endTurn().expectOk();
  events.push(...s.events(), ...drive(s));
  s.as(s.room.rules!.turn.player).endTurn().expectOk();
  events.push(...s.events(), ...drive(s));
  return events;
}

export function exhausted(s: S, card: CardInstance): boolean | null {
  return s.host.isExhausted(s.room, card.id);
}
