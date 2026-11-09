/** Trapping Grounds. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Trapping Grounds",
  text: "When you conquer here, if you assigned 3 or more excess damage, play a 1 [might] Bird unit token with [Deflect] .",
  status: "manual",
  notes:
    "Excess damage assigned in combat is not recorded (467.2.c.4), so the intervening condition cannot be checked.",
  abilities: [],
});
