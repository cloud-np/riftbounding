/** Evelynn, Entrancing. */
import { aUnit, custom, HERE, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Evelynn, Entrancing",
  text: "[Hidden] (Hide now for [rune] to react with later for [0] .)\n[Backline] (I must be assigned combat damage last.)\nWhen you play me from facedown on your turn, you may move an enemy unit at a different location to my battlefield.",
  status: "implemented",
  notes:
    "'When you play me from facedown' is automated from the play event's `data.playedFromFacedown` (811.6). [Hidden] and [Backline] are printed keywords.",
  abilities: [
    {
      kind: "triggered",
      // 811.6: the facedown provenance is on the 383.4.a play event (`data.playedFromFacedown`).
      trigger: {
        kind: "event",
        event: {
          type: "unit_played",
          subject: SELF,
          player: "self",
          data: { playedFromFacedown: true },
          condition: { kind: "is-turn-player", player: "self" },
        },
      },
      effect: {
        op: "may",
        effect: {
          op: "move",
          target: aUnit({ controller: "opponent", where: custom("unl:enemy-at-other-location") }),
          to: HERE,
        },
      },
    },
  ],
});
