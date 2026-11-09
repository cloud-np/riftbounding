/**
 * Bushwhack Trap (RAD-108) — "[Deploy] While you or an ally control this battlefield, that
 * player may hide an additional card here." [Deploy] is the engine's; the extra hide slot is a
 * `hide-limit` modifier, which the hide legality never reads (811.1.b / 107.3.b).
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Bushwhack Trap",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhile you or an ally control this battlefield, that player may hide an additional card here.",
  status: "partial",
  notes:
    "The extra facedown card ('hide an additional card here') needs the hide limit to read a `hide-limit` modifier; `planHide` only checks `facedownCardAt`, so the second card is still rejected (811.1.b, 107.3.b).",
  abilities: [{ kind: "passive", modifier: { kind: "hide-limit", amount: 1 } }],
});
