/** Hold 'Em (RAD-070) — "This costs [2] less if you've played a unit or gear to a battlefield this turn. Give a unit +3 [Might] this turn." */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Hold 'Em",
  text: "[Action] (Play on your turn or in showdowns.)\nThis costs [2] less if you've played a unit or gear to a battlefield this turn.\nGive a unit +3 [Might] this turn.",
  status: "partial",
  notes:
    "The [2] discount needs a per-turn record of where units/gear were played (356.4; no play-location history).",
  abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: 3, target: aUnit() } }],
});
