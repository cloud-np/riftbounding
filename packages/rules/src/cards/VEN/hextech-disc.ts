/** Hextech Disc. */
import { empower, registerCardScript, SELF, SELF_EMPOWERED, token } from "../sdk";
import { DISEMPOWER_COST_GAP } from "./custom";

registerCardScript({
  name: "Hextech Disc",
  text: "[Empower] - [Tap] (Pay the cost: Empower this. Use only if not Empowered.)\nDisempower this, [1], [Tap]: Play a 3 [Might] Mech unit token to your base.",
  status: "partial",
  notes: DISEMPOWER_COST_GAP,
  abilities: [
    empower({ exhaust: SELF }),
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "requires",
        condition: SELF_EMPOWERED,
        rule: "357.2",
        effect: {
          op: "seq",
          effects: [
            { op: "disempower", target: SELF },
            { op: "create", token: token("Mech", { might: 3, play: true, zone: "base" }) },
          ],
        },
      },
    },
  ],
});
