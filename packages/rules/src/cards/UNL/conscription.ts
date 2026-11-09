/** Conscription. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Conscription",
  text: "You may spend 5 XP as an additional cost to play this.\nChoose an enemy unit at a battlefield with 3  or less. If you paid the additional cost, choose any enemy unit at a battlefield instead. Take control of it, exhaust it, and recall it.",
  status: "manual",
  notes:
    "Taking control of a unit is not implemented (435). The alternative target (3 Might or less / any) also reads the optional-cost choice (355.1.a).",
  abilities: [],
});
