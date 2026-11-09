/** Shadowcloaked Lurker. */
import { registerCardScript, SELF } from "../sdk";
import { perCount } from "./custom";

const SHADOWCLOAKED_LURKER = "Shadowcloaked Lurker";

registerCardScript({
  name: "Shadowcloaked Lurker",
  text: "I cost [2] less for each card with my name in your trash.",
  status: "implemented",
  // 366.2.a: applies while I'm in hand; my printed cost is [5], so three copies reduce it to 0.
  abilities: perCount({ zone: "trash", owner: "self", name: SHADOWCLOAKED_LURKER }, 3, () => ({
    kind: "cost",
    amount: -2,
    target: SELF,
  })),
});
