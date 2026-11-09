/** Soul Shepherd (UNL-077) — passive (365.1): your token units (179) have +1 [Might] (479.4). */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Soul Shepherd",
  text: "Your token units have +1 [might].",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: 1,
        target: { cardType: "unit", controller: "self", token: true },
      },
    },
  ],
});
