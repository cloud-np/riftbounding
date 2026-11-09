/** Master Yi, Tempered. */
import { atLevel, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Master Yi, Tempered",
  text: "[Hunt 2] (When I conquer or hold, gain 2 XP.)\n[Level 6] I have [Deflect] and [Ganking]. (While you have 6+ XP, opponents must pay [Rune] to choose me with a spell or ability and I can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Deflect" },
    { kind: "suppress-printed-keyword", keyword: "Ganking" },
    atLevel(6, { kind: "keyword", keyword: "Deflect", target: SELF }),
    atLevel(6, { kind: "keyword", keyword: "Ganking", target: SELF }),
  ],
});
