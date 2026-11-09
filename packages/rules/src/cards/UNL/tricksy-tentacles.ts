/** Tricksy Tentacles. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Tricksy Tentacles",
  text: "Move any number of enemy units with the same controller and a total Might of 8 or less to a single location.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "move",
        target: {
          chosen: true,
          cardType: "unit",
          controller: "opponent",
          anyNumber: true,
          // 355.11: the group as a whole is from one controller with total Might 8 or less.
          group: { sameController: true, totalMight: { op: "lte", value: 8 } },
        },
        to: { kind: "chosen", ref: "destination" },
      },
    },
  ],
});
