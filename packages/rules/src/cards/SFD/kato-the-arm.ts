/** Kato the Arm. */
import { registerCardScript } from "../sdk";
import { target, WHEN_I_MOVE_TO_BATTLEFIELD } from "./custom";

registerCardScript({
  name: "Kato the Arm",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nWhen I move to a battlefield, give another friendly unit my keywords and +[Might] equal to my Might this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE_TO_BATTLEFIELD,
      effect: {
        op: "for_each",
        selector: target({ controller: "self", excludeSelf: true }),
        effect: { op: "custom", id: "sfd:give-my-keywords-and-might" },
      },
    },
  ],
});
