/** Eye of the Herald. */
import { registerCardScript, WHEN_I_MOVE } from "../sdk";
import { HERE_ZONE, recruit } from "./custom";

registerCardScript({
  name: "Eye of the Herald",
  text: "[Equip][Order] ([Order]: Attach this to a unit you control.)\n\nWhen I move, play a 1 [Might] Recruit unit token here.\n+0 [Might]",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_I_MOVE, effect: recruit(HERE_ZONE) }],
});
