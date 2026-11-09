/** Keeper of Masks. */
import { HERE, registerCardScript, token, WHEN_PLAYED } from "../sdk";
import { REFLECTION_READY } from "./custom";

registerCardScript({
  name: "Keeper of Masks",
  text: "[Hidden] (Hide now for [A] to react with later for [0].)\n[Temporary] (Kill me at the start of my controller's Beginning Phase, before scoring.)\nWhen you play me, play two Reflection unit tokens here. Then do this: They become copies of me.",
  status: "partial",
  notes:
    "The two Reflection tokens are played; 'They become copies of me' is missing: copy effects (446) are not implemented (only the tokens' [Temporary] is granted).",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "create",
        token: token("Reflection", { ...REFLECTION_READY, count: 2 }),
        zone: HERE,
      },
    },
  ],
});
