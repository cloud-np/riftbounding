/** Hostile Takeover. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Hostile Takeover",
  text: "[Hidden] (Hide now for [Power] to react with later for [0].) \n\nTake control of an enemy unit at a battlefield. \nReady it. (Start a combat if other enemies are there. Otherwise, conquer.)\nLose control of that unit and recall it at end of turn. (Send it to base. This isn't a move.)",
  status: "partial",
  notes:
    'The reminder "(Start a combat if other enemies are there. Otherwise, conquer.)": taking control of a unit at a battlefield does not start a showdown/combat or establish control for a conquer (463, 468.5, 471); the control change, ready and end-of-turn release are automated.',
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "opponent", zone: "battlefield" }),
        effect: {
          op: "seq",
          effects: [
            { op: "custom", id: "core:take-control", params: { target: { targetRef: "it" } } },
            { op: "ready", target: { targetRef: "it" } },
            { op: "custom", id: "sfd:release-at-end-of-turn", params: { ref: "it" } },
          ],
        },
      },
    },
  ],
});
