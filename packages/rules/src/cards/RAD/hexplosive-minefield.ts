/**
 * Hexplosive Minefield (RAD-142) — "Kill any number of friendly Bomb tokens. At end of turn, play
 * that many Bomb tokens to a single battlefield." (390–393: the delayed trigger's battlefield is
 * chosen when it triggers, 355.5.b)
 */
import { registerCardScript, token } from "../sdk";
import { letX, zoneRef } from "./custom";

/** The value placeholder for numeric fields that only accept numbers (e.g. `TokenSpec.count`). */
const X_NUMBER = "$X" as unknown as number;

registerCardScript({
  name: "Hexplosive Minefield",
  text: "[Action] (Play on your turn or in showdowns.)\nKill any number of friendly Bomb tokens. At end of turn, play that many Bomb tokens to a single battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "kill",
            target: { chosen: true, name: "Bomb", token: true, controller: "self", maxCount: 99 },
          },
          letX(
            { amount: { kind: "count", selector: { targetRef: "it" } } },
            {
              op: "delayed",
              trigger: { kind: "turn-end" },
              effect: {
                op: "create",
                token: token("Bomb", { count: X_NUMBER, play: true }),
                zone: zoneRef("bomb"),
              },
            },
          ),
        ],
      },
    },
  ],
});
