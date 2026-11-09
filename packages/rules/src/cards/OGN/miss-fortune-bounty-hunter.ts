/**
 * Miss Fortune, Bounty Hunter (OGN-267, legend) — "[Tap]: Give a unit [GANKING] this turn."
 * (801.3.a; Ganking 810.) The catalog's Ganking is the granted keyword, not the legend's own.
 */
import { aUnit, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Miss Fortune, Bounty Hunter",
  text: "[Tap]: Give a unit [GANKING] this turn. (It can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Ganking" },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: { op: "grant_keyword", keyword: "Ganking", target: aUnit(), duration: "this-turn" },
    },
  ],
});
