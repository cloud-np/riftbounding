/** Counter Strike. */
import { registerCardScript } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Counter Strike",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n\nChoose a unit. The next time that unit would be dealt damage this turn, prevent it. Draw 1",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "for_each",
            selector: target({ targetRef: "target:0" }),
            // 438 / 375 / 359.3.f.3.a: a delayed replacement used up by the next damage to that
            // unit this turn. The matcher names the play-time choice; the `replace` op freezes it
            // onto the delayed effect and R4-engine passes it to the matcher.
            effect: {
              op: "replace",
              matches: { type: "damage", subject: { targetRef: "target:0" } },
              replace: { prevent: 9999 },
            },
          },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});
