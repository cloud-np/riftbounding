/** Herald of Spring (UNL-034) — [Hunt] (823, engine keyword) and a Play Effect gaining 2 XP (730.1). */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Herald of Spring",
  text: "[Hunt] (When I conquer or hold, gain 1 XP.)\nWhen you play me, gain 2 XP.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "gain_xp", amount: 2 } }],
});
