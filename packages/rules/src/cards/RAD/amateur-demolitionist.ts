/** Amateur Demolitionist (RAD-001) — "When you play me, play a Bomb gear token to a battlefield." (440.2.c, 830.1.b) */
import { registerCardScript, WHEN_PLAYED } from "../sdk";
import { playBombs } from "./custom";

registerCardScript({
  name: "Amateur Demolitionist",
  text: "When you play me, play a Bomb gear token to a battlefield. (It has [Deploy]. When it dies, deal 2 to an enemy there and kill your other Bombs there.)",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: playBombs(1) }],
});
