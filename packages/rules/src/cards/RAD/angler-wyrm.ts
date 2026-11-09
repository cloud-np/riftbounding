/**
 * Angler Wyrm (RAD-113) — "[Deflect] [Tap]: Choose an opponent. They must move a unit they control
 * to my battlefield." The opponent picks the unit (355.18); nothing happens while I'm not at a
 * battlefield or when all their units are already there (355.4.a).
 */
import { HERE, not, registerCardScript, SELF, SELF_AT_BATTLEFIELD } from "../sdk";
import { CHOOSE_OPPONENT } from "./custom";

registerCardScript({
  name: "Angler Wyrm",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\n[Tap]: Choose an opponent. They must move a unit they control to my battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "seq",
        effects: [
          CHOOSE_OPPONENT,
          {
            op: "if",
            condition: SELF_AT_BATTLEFIELD,
            then: {
              op: "seq",
              effects: [
                {
                  op: "choose",
                  key: "moved",
                  chooser: { kind: "chosen", ref: "opponent" },
                  selector: {
                    cardType: "unit",
                    controller: { kind: "chosen", ref: "opponent" },
                    where: not({
                      kind: "exists",
                      selector: { targetRef: "it", sameLocationAs: "self" },
                    }),
                  },
                },
                { op: "move", target: { targetRef: "moved" }, to: HERE },
              ],
            },
          },
        ],
      },
    },
  ],
});
