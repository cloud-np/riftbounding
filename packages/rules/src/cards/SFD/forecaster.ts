/** Forecaster. */
import { notIntrinsic, registerCardScript } from "../sdk";
import { MECHS } from "./custom";

registerCardScript({
  name: "Forecaster",
  text: "Your Mechs have [Vision]. (When you play us, look at the top card of your Main Deck. You may recycle it.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Vision"),
    { kind: "passive", modifier: { kind: "keyword", keyword: "Vision", target: MECHS } },
  ],
});
