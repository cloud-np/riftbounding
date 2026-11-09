/** Demacian Diplomat (UNL-092) — a Play Effect (383.4.a) that gains XP (730.1). */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED } from "../dsl";

registerCardScript({
  name: "Demacian Diplomat",
  text: "When you play me, gain 1 XP.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "gain_xp", amount: 1 } }],
});
