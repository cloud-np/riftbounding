/**
 * Bushwhack Trap (RAD-108) — "[Deploy] While you or an ally control this battlefield, that
 * player may hide an additional card here." [Deploy] is the engine's; the extra hide slot is a
 * `hide-limit` modifier read by the hide legality (107.3.b.1).
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Bushwhack Trap",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhile you or an ally control this battlefield, that player may hide an additional card here.",
  status: "partial",
  notes:
    "The extra facedown slot is honoured (107.3.b.1). Not automated: when the occupancy drops again (this leaves the board), the controller trashing the excess facedown card (107.3.b.2).",
  abilities: [{ kind: "passive", modifier: { kind: "hide-limit", amount: 1 } }],
});
