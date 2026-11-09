/** Ornn's Forge. */
import { custom, registerCardScript, whilePassive } from "../sdk";

registerCardScript({
  name: "Ornn's Forge",
  text: "While you control this battlefield, the first friendly non-token gear played each turn costs [1] less.",
  status: "implemented",
  abilities: [
    whilePassive(
      {
        kind: "and",
        conditions: [
          custom("sfd:controls-source-battlefield"),
          custom("sfd:no-nontoken-gear-played-this-turn"),
        ],
      },
      {
        kind: "cost-adjust",
        energy: -1,
        target: { cardType: "gear", controller: "self", token: false },
      },
    ),
  ],
});
