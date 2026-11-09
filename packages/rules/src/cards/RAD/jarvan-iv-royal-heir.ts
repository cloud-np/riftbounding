/** Jarvan IV, Royal Heir (RAD-133) — "[Assault] [Tank] When I attack, you may move a unit you control to my battlefield." */
import { aUnit, HERE, registerCardScript, WHEN_I_ATTACK } from "../sdk";

registerCardScript({
  name: "Jarvan IV, Royal Heir",
  text: "[Assault] (+1 [Might] while I'm attacking.)\n[Tank] (I must be assigned combat damage first.)\nWhen I attack, you may move a unit you control to my battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "may",
        effect: {
          op: "move",
          target: aUnit({ controller: "self", excludeSource: true }),
          to: HERE,
        },
      },
    },
  ],
});
