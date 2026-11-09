/** Evelynn, Consuming (RAD-090) — [Ambush]; play-from-facedown trigger. */
import { notIntrinsic, registerCardScript } from "../sdk";

registerCardScript({
  name: "Evelynn, Consuming",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nWhen you play a card from face down, ready me and give me +1[Might] this turn.",
  status: "manual",
  notes:
    "A unit play effect has no facedown provenance: `unit_played` does not carry `playedFromFacedown` (811.6); [Ambush] is the printed keyword.",
  abilities: [...notIntrinsic("Reaction")],
});
