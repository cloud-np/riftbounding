/**
 * Brynhir Thundersong (OGN-026) — "When you play me, opponents can't play cards this turn."
 *
 * A delayed passive (391.4) of `play` restrictions (054.1) on the opponents' cards in every zone a
 * card can be played from (hand, Chosen Champion zone, facedown at a battlefield, trash, banished
 * zone). The process of play consults `restrictionFor`; the effect-driven `play` op (420.3) does not.
 */
import type { Effect, ZoneSelector } from "@rift/protocol";
import { registerCardScript, WHEN_PLAYED } from "../sdk";

const ZONES: ZoneSelector[] = ["hand", "champion", "battlefield", "trash", "banished"];

function noPlay(zone: ZoneSelector): Effect {
  return {
    op: "continuous",
    duration: "this-turn",
    modifier: {
      kind: "restriction",
      restriction: "play",
      target: { zone, controller: "opponent" },
    },
  };
}

registerCardScript({
  name: "Brynhir Thundersong",
  text: "When you play me, opponents can't play cards this turn.",
  status: "partial",
  notes:
    "Plays made by effects (420.3, the play op) do not consult restrictionFor, so they are not prevented (054.1).",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "seq", effects: ZONES.map(noPlay) } },
  ],
});
