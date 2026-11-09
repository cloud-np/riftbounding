/** Vi, Piltover Enforcer. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Vi, Piltover Enforcer",
  text: "When you conquer, if you assigned 3 or more excess damage, you may exhaust me to ready a unit.",
  status: "manual",
  notes:
    "Excess damage assigned in combat is not recorded (467.2.c.4), so the intervening condition cannot be checked.",
  abilities: [],
});
