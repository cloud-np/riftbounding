/** Soulspinner. */
import { notIntrinsic, registerCardScript } from "../sdk";

registerCardScript({
  name: "Soulspinner",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)",
  status: "implemented",
  abilities: [...notIntrinsic("Reaction")],
});
