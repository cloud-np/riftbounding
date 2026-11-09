/**
 * Last Caress (RAD-154, errata) — "[Reaction] The next unit you play this turn, even from face
 * down, can be played to any battlefield. When you play it, [Buff] it." (355.2.b, 420.1.a)
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Last Caress",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nThe next unit you play this turn, even from face down, can be played to any battlefield. When you play it, [Buff] it. (Give it a +1 [Might] buff if it doesn't have one.)",
  status: "partial",
  notes:
    'The delayed [Buff] for the next unit is automated. "Can be played to any battlefield" is a play-location permission; the play layer only accepts extra locations from effect-driven plays (355.2.b), so a normal next-unit play cannot use it.',
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "delayed",
        trigger: { kind: "event", event: { type: "unit_played", player: "self" } },
        duration: "this-turn",
        once: true,
        effect: { op: "buff", target: { targetRef: "event" } },
      },
    },
  ],
});
