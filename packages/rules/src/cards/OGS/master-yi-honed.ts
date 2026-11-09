/** Master Yi, Honed (OGS-009 — EX[134] (369.3): "I enter ready" replaces entering exhausted.) */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Master Yi, Honed",
  text: "[GANKING] (I can move from battlefield to battlefield.)\nI enter ready.",
  status: "implemented",
  abilities: [{ kind: "passive", modifier: { kind: "custom", id: "enter-ready", params: { target: SELF } } }],
});
