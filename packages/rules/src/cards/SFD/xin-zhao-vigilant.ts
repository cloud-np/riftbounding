/** Xin Zhao, Vigilant. */
import { enterReady, registerCardScript } from "../sdk";

registerCardScript({
  name: "Xin Zhao, Vigilant",
  text: "[Tank] (I must be assigned combat damage first.)\nI enter ready if you have two or more other units in your base.",
  status: "implemented",
  abilities: [
    enterReady({
      kind: "count",
      selector: { cardType: "unit", controller: "self", zone: "base", excludeSource: true },
      comparison: { op: "gte", value: 2 },
    }),
  ],
});
