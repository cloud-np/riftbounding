/** Breakneck Mech. */
import { enterReady, notIntrinsic, registerCardScript } from "../sdk";
import { MECHS } from "./custom";

registerCardScript({
  name: "Breakneck Mech",
  text: "Your Mechs have [Deflect] and [Ganking]. (Opponents must pay [Rune] to choose us with a spell or ability. We can move from battlefield to battlefield.)\nI enter ready if you control another Mech.",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Deflect"),
    ...notIntrinsic("Ganking"),
    { kind: "passive", modifier: { kind: "keyword", keyword: "Deflect", target: MECHS } },
    { kind: "passive", modifier: { kind: "keyword", keyword: "Ganking", target: MECHS } },
    enterReady({ kind: "exists", selector: { ...MECHS, excludeSource: true } }),
  ],
});
