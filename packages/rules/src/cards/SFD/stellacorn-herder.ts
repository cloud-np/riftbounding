/** Stellacorn Herder (SFD-048) — "When I move, draw 1." */
import { registerCardScript, WHEN_I_MOVE } from "../sdk";

registerCardScript({
  name: "Stellacorn Herder",
  text: "When i move, draw 1.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_I_MOVE, effect: { op: "draw", amount: 1 } }],
});
