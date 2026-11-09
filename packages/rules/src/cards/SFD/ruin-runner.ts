/** Ruin Runner (SFD-105 — EX[286] (757.1)) */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Ruin Runner",
  text: "I can't be chosen by enemy spells and abilities.",
  status: "implemented",
  abilities: [{ kind: "passive", modifier: { kind: "restriction", restriction: "be-targeted:enemy", target: SELF } }],
});
