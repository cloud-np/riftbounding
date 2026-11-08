/** Treasure Hunter (SFD-130) — "When I move, play a Gold gear token exhausted." (EX[152]) */
import { registerCardScript } from "../registry";
import { WHEN_I_MOVE } from "../dsl";

registerCardScript({
  name: "Treasure Hunter",
  text: "When I move, play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: { op: "create", token: { name: "Gold", exhausted: true, play: true } },
    },
  ],
});
