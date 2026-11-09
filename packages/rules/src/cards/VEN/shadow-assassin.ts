/** Shadow Assassin. */
import { whilePassive as conditional, registerCardScript, SELF } from "../sdk";

const SHADOW_ASSASSIN = "Shadow Assassin";

registerCardScript({
  name: "Shadow Assassin",
  text: "I enter ready if you have a card with my name in your trash.",
  status: "implemented",
  abilities: [
    conditional(
      { kind: "exists", selector: { zone: "trash", owner: "self", name: SHADOW_ASSASSIN } },
      { kind: "enter-ready", target: SELF },
    ),
  ],
});
