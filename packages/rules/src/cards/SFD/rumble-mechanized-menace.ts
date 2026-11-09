/** Rumble, Mechanized Menace. */
import { notIntrinsic, registerCardScript } from "../sdk";
import { MECHS } from "./custom";

registerCardScript({
  name: "Rumble, Mechanized Menace",
  text: "Your Mechs have [SHIELD]. (+1 [Might] while they're defenders.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Shield"),
    { kind: "passive", modifier: { kind: "keyword", keyword: "Shield", target: MECHS } },
  ],
});
