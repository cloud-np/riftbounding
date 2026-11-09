/**
 * Radiance (RAD) wave R4 cards whose text needs a missing engine capability: they register a
 * `manual` script (the §6.4 fallback) and document the exact gap.
 */
import { notIntrinsic, registerCardScript } from "../sdk";

/** Evelynn, Agony's Embrace (RAD-153/175, legend) — play-from-facedown trigger + conditional discard. */
registerCardScript({
  name: "Evelynn, Agony's Embrace",
  text: "Once each turn, when you play a card from face down, draw 1. Then, if it's not your turn, discard 1.",
  status: "manual",
  notes:
    "Whether the played card came from face down is recorded only on its chain item, not on `card_played`/`unit_played` (811.6, 383.1); the once-per-turn trigger cannot be detected. The 'not your turn' discard branch is simple once the trigger exists.",
  abilities: [],
});

/** Evelynn, Consuming (RAD-090) — [Ambush]; play-from-facedown trigger. */
registerCardScript({
  name: "Evelynn, Consuming",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nWhen you play a card from face down, ready me and give me +1[Might] this turn.",
  status: "manual",
  notes:
    "A unit play effect has no facedown provenance: `unit_played` does not carry `playedFromFacedown` (811.6); [Ambush] is the printed keyword.",
  abilities: [...notIntrinsic("Reaction")],
});

/** Heimerdinger, Academy Instructor (RAD-132) — replaces a played unit token with a Mech token. */
registerCardScript({
  name: "Heimerdinger, Academy Instructor",
  text: "If you would play a unit token to a location while I'm at a battlefield, you may play a 3 [Might] Mech unit token to that same location instead.",
  status: "manual",
  notes:
    "Needs an optional replacement of a token play that keeps the proposed location and token-ness (370–375: optional replacements are only decided for kill/damage/recall, and the token proposal carries only its name/zone).",
  abilities: [],
});
