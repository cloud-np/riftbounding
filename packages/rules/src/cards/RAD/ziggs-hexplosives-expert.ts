/** Ziggs, Hexplosives Expert (RAD-141, legend) — "[1][Rune], [Tap]: Play a Bomb gear token to a battlefield." */
import { registerCardScript, SELF } from "../sdk";
import { playBombs } from "./custom";

registerCardScript({
  name: "Ziggs, Hexplosives Expert",
  text: "[1][Rune], [Tap]: Play a Bomb gear token to a battlefield. (It has [Deploy]. When it dies, deal 2 to an enemy there and kill your other Bombs there.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { energy: 1, power: { any: 1 }, exhaust: SELF },
      effect: playBombs(1),
    },
  ],
});
