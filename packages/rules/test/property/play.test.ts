/**
 * Play-domain properties [R356][R357][R358.5][R411.2]:
 *
 * - every play/activation `legalIntents` lists is accepted by `applyRulesIntent` (affordable,
 *   legal location/choices) and `explainIllegal` agrees with the write path for random explicit
 *   payment plans and optional costs;
 * - Rune Pools never go negative and a Pending chain item always has its play prompt open.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fc from "fast-check";
import type { Room, RulesIntent } from "@rift/protocol";
import { applyRulesIntent, explainIllegal, whoMayAct } from "../../src";
import { assertInvariants, candidateIntents, clearPropertyScripts, mulberry32, registerPropertyScripts } from "./generators";
import { scenario, type RulesScenario } from "../scenarios/dsl";

beforeAll(() => registerPropertyScripts());
afterAll(() => clearPropertyScripts());

function buildPlayScenario(seed: number): RulesScenario {
  return scenario({
    seed,
    roomCode: `PLAY-${seed}`,
    p1: { hand: ["Rebuke", "Treasure Hunter", "Clockwork Keeper", "Reckless Innovator", "Meditation"], energy: 6, power: { Calm: 1, Chaos: 2 } },
    p2: { hand: ["Defy", "En Garde", "Caitlyn, Patrolling", "Blade of the Exile"], energy: 6, power: { Calm: 2 } },
  });
}

function playInvariants(room: Room): string | null {
  const rules = room.rules;
  if (!rules) return "missing RulesState";
  for (const [player, pool] of Object.entries(rules.pools)) {
    if (pool.energy < 0) return `negative Energy for ${player}`;
    for (const [domain, value] of Object.entries(pool.power)) {
      if ((value ?? 0) < 0) return `negative ${domain} Power for ${player}`;
    }
  }
  for (const item of rules.chain) {
    if (item.status !== "pending") continue;
    if (item.process && rules.prompt?.sourceItemId !== item.id) return "pending play item without its prompt (411.2)";
  }
  return null;
}

/** Random variations of a play/activate intent (explicit plans, optional costs, bogus ids). */
function variants(s: RulesScenario, intent: RulesIntent, random: () => number): RulesIntent[] {
  if (intent.type !== "rules_play" && intent.type !== "rules_activate") return [];
  const runes = s.room.players.flatMap((player) => player.board?.runeArea ?? []).map((rune) => rune.id);
  const pick = () => runes[Math.floor(random() * runes.length)] ?? "nope";
  return [
    { ...intent, plan: { poolEnergy: Math.floor(random() * 4) } },
    { ...intent, plan: { exhaustRunes: [pick()], recycleRunes: random() < 0.5 ? [pick()] : [] } },
    { ...intent, optionalCosts: random() < 0.5 ? ["accelerate"] : ["optional:0"] },
    { ...intent, targets: ["not-a-card"] },
  ];
}

function runPlaySequence(seed: number, steps = 40): string | null {
  const random = mulberry32(seed);
  const s = buildPlayScenario(seed);
  for (let index = 0; index < steps; index += 1) {
    if (s.room.gameOutcome) break;
    const options = candidateIntents(s, random);
    if (options.length === 0) return whoMayAct(s.room).kind === "none" ? null : `no intent at step ${index}`;
    for (const option of options) {
      if (option.intent.type !== "rules_play" && option.intent.type !== "rules_activate") continue;
      const applied = applyRulesIntent(s.host.cloneRoom(s.room), option.player, option.intent, s.ctx, s.host);
      if (!applied.ok) return `listed ${option.intent.type} rejected: ${applied.code} (${applied.rule}) at step ${index}`;
      for (const variant of variants(s, option.intent, random)) {
        const explained = explainIllegal(s.room, option.player, variant, s.host);
        const result = applyRulesIntent(s.host.cloneRoom(s.room), option.player, variant, s.ctx, s.host);
        if (explained.ok !== result.ok) {
          return `explain/apply disagree on ${JSON.stringify(variant)}: explain=${JSON.stringify(explained)} apply=${result.ok ? "ok" : `${result.code} (${result.rule})`}`;
        }
        if (!explained.ok && !result.ok && (explained.code !== result.code || explained.rule !== result.rule)) {
          return `explain/apply verdicts differ: ${explained.code}/${explained.rule} vs ${result.code}/${result.rule}`;
        }
      }
    }
    const picked = options[Math.floor(random() * options.length)]!;
    s.as(picked.player).apply(picked.intent);
    const error = s.lastError();
    if (error) return `picked ${picked.intent.type} rejected: ${error.code} (${error.rule}) at step ${index}`;
    const problem = assertInvariants(s.room) ?? playInvariants(s.room);
    if (problem) return `${problem} at step ${index}`;
  }
  return null;
}

describe("play properties [R356][R357][R358.5][R411.2]", () => {
  it(
    "[R357][R420.2.a][R411.2] listed plays are accepted, explain agrees with apply, pools stay non-negative",
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 2 ** 30 }), (seed) => {
          const problem = runPlaySequence(seed);
          expect(problem, `seed ${seed}: ${problem}`).toBeNull();
        }),
        { numRuns: 25 },
      );
    },
    180_000,
  );
});
