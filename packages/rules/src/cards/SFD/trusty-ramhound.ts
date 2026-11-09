/** Trusty Ramhound. */
import { registerCardScript, SELF, whilePassive } from "../sdk";
import { HERE_ZONE } from "./custom";

registerCardScript({
  name: "Trusty Ramhound",
  text: "While you have another unit here, I have +1 [Might].",
  status: "implemented",
  abilities: [
    whilePassive(
      {
        kind: "exists",
        selector: { cardType: "unit", controller: "self", zone: HERE_ZONE, excludeSource: true },
      },
      { kind: "might", amount: 1, target: SELF },
    ),
  ],
});
