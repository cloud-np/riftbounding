/** Treasure Hunter (SFD-130) — "When I move, play a Gold gear token exhausted." (EX[152]) */
import { registerCardScript, token, WHEN_I_MOVE } from "../sdk";

registerCardScript({
  name: "Treasure Hunter",
  text: "When I move, play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: { op: "create", token: token("Gold", { exhausted: true, play: true }) },
    },
  ],
});
