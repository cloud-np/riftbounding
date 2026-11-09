/**
 * Acceptable Losses (OGN-179) — "Each player kills one of their gear."
 *
 * Each player, in Turn Order (303.2.a), chooses one of their own gear on resolution (not a target:
 * the instruction is "each player kills", 355.7); the chosen gear are then killed together (429).
 * `ogn-an:players-choose` is shared with Cull the Weak and King's Edict.
 */
import type { Effect, Selector } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { registerCustomEffect } from "../../effects/ops";
import { RESOLVED } from "../../effects/execute";
import { matchingIds, playersInTurnOrder } from "../../effects/evaluate";
import { evalContextOf, optionFor, recordOutcome } from "../../effects/targets";
import { controllerOf } from "../../effects/objects";

/**
 * Players choose objects one after another and the picks are bound to `key` (355.18 picks, not
 * targets). `players`: "each" (Turn Order from the Turn Player, 303.2.a) or "others-from-next"
 * (every other player, starting with the player after the controller). `own`: each player picks
 * among objects they control. `distinct`: an object already picked cannot be picked again.
 */
registerCustomEffect("ogn-an:players-choose", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const ctx = evalContextOf(context);
  const { room, host, env } = ctx;
  const key = String(params.key ?? "picked");
  const selector = (params.selector ?? {}) as Selector;
  const count = typeof params.count === "number" ? params.count : 1;
  const all = playersInTurnOrder(room, host);
  let order = all;
  if (params.players === "others-from-next") {
    const at = all.indexOf(env.controller);
    order = [...all.slice(at + 1), ...all.slice(0, Math.max(0, at))].filter(
      (id) => id !== env.controller,
    );
  }
  const picked = Array.isArray(env.vars[key]) ? [...(env.vars[key] as string[])] : [];
  const start =
    typeof machine.frame.data?.index === "number" ? (machine.frame.data.index as number) : 0;
  for (let index = start; index < order.length; index += 1) {
    const player = order[index]!;
    const pool = matchingIds(ctx, selector).filter(
      (id) =>
        (params.own !== true || controllerOf(room, host, id) === player) &&
        (params.distinct !== true || !picked.includes(id)),
    );
    const n = Math.min(count, pool.length);
    if (n === 0) continue;
    let chosen: string[];
    if (pool.length <= count) {
      chosen = pool;
    } else if (machine.frame.answer !== undefined && machine.frame.data?.index === index) {
      const answer = machine.frame.answer;
      chosen = (Array.isArray(answer) ? answer : [answer]).filter(
        (id): id is string => typeof id === "string" && pool.includes(id),
      );
      machine.frame.answer = undefined;
      if (chosen.length !== n) chosen = pool.slice(0, n);
    } else {
      machine.frame.data = { index };
      env.vars[key] = picked;
      return machine.ask({
        kind: "choose-card",
        playerId: player,
        options: pool.map((id) => optionFor(ctx, id)),
        min: n,
        max: n,
        rule: "355.18",
        promptKey: (params.label as string | undefined) ?? "rules.prompt.choose",
        data: { answer: "objects" },
      });
    }
    picked.push(...chosen);
    env.vars[key] = picked;
  }
  machine.frame.data = undefined;
  env.vars[key] = picked;
  recordOutcome(context, picked, picked.length > 0);
  return RESOLVED;
});

/** "Each player kills one of their <type>" (choose in Turn Order, then kill together). */
export function eachPlayerKillsOne(cardType: string): Effect {
  return {
    op: "seq",
    effects: [
      {
        op: "custom",
        id: "ogn-an:players-choose",
        params: { key: "doomed", selector: { cardType }, own: true, count: 1 },
      },
      { op: "kill", target: { targetRef: "doomed" } },
    ],
  };
}

registerCardScript({
  name: "Acceptable Losses",
  text: "[ACTION] (Play on your turn or in showdowns.)\nEach player kills one of their gear.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: eachPlayerKillsOne("gear") }],
});
