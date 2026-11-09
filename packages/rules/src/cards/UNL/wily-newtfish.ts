/** Wily Newtfish. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Wily Newtfish",
  text: "If you've gained XP this turn, I have +1[Might] and [Ganking]. (I can move from battlefield to battlefield.)",
  status: "manual",
  notes:
    "Not automated: whether you gained XP this turn is not tracked (728–733); the +1 Might and [Ganking] are never applied. The catalog's [Ganking] is conditional text (suppressed), so the card is a vanilla 4 Might unit.",
  abilities: [{ kind: "suppress-printed-keyword", keyword: "Ganking" }],
});
