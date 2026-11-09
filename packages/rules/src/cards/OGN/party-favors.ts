/**
 * Party Favors (OGN-071) — "Each other player chooses Cards or Runes. For each player that chooses
 * Cards, you and that player each draw 1. For each player that chooses Runes, you and that player
 * each channel 1 rune exhausted."
 *
 * Registers `ogn-oz:party-favors`. Every other player chooses in Turn Order (decisions made on
 * resolution by other players, 355.18); once all have chosen, each choice is carried out in that
 * order: Cards → the controller and that player each draw 1 (414); Runes → each channels 1 rune
 * exhausted (431.2.a).
 */
import type { Effect } from "@rift/protocol";
import { opponentsOf, registerCardScript, registerCustomEffect, RESOLVED } from "../sdk";

registerCustomEffect("ogn-oz:party-favors", (_params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const me = machine.env.controller;
  const others = opponentsOf(context.room, context.step.host, me);
  const vars = machine.env.vars;
  const answer = machine.frame.answer;
  if (answer !== undefined) {
    const pending = others.find((player) => vars[`favors:${player}`] === undefined);
    const choice = Array.isArray(answer) ? answer[0] : answer;
    if (pending) vars[`favors:${pending}`] = choice === "runes" ? "runes" : "cards";
    machine.frame.answer = undefined;
  }
  const next = others.find((player) => vars[`favors:${player}`] === undefined);
  if (next) {
    return machine.ask({
      kind: "choose-mode",
      playerId: next,
      options: [
        { id: "cards", label: "Cards" },
        { id: "runes", label: "Runes" },
      ],
      min: 1,
      max: 1,
      rule: "355.18",
      promptKey: "rules.prompt.cardsOrRunes",
      data: { answer: "options" },
    });
  }
  const frames: Array<{ effect: Effect }> = [];
  for (const player of others) {
    const pair = [me, player];
    for (const who of pair) {
      frames.push({
        effect:
          vars[`favors:${player}`] === "runes"
            ? { op: "channel", amount: 1, exhausted: true, player: { kind: "player", id: who } }
            : { op: "draw", amount: 1, player: { kind: "player", id: who } },
      });
    }
  }
  machine.push(...frames);
  return RESOLVED;
});

registerCardScript({
  name: "Party Favors",
  text: "Each other player chooses Cards or Runes.\nFor each player that chooses Cards, you and that player each draw 1.\nFor each player that chooses Runes, you and that player each channel 1 rune exhausted.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "custom", id: "ogn-oz:party-favors" } }],
});
