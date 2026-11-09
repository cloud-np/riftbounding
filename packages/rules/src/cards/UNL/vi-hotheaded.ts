/** Vi, Hotheaded (UNL-030) — [Deflect] (809, engine keyword); "[2][Fury]: Double my Might this turn." (433.1.a, 479.4.c) */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Vi, Hotheaded",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\n[2][Fury]: Double my Might this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { energy: 2, power: { Fury: 1 } },
      effect: { op: "double", target: SELF, property: "might" },
    },
  ],
});
