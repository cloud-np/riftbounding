/**
 * Unleashed (UNL) R4 units.
 *
 * - Undying Legion (UNL-025): [Legion] "You may play me from your trash for [3] [Fury]." The
 *   permission is read by R2-play's play-permission registry (354, 420.1.a, 812).
 * - Keeper of Masks (UNL-081, errata): [Hidden], [Temporary]; when played, play two Reflection
 *   tokens here. "They become copies of me" is missing (446).
 * - LeBlanc, Deceiver (UNL-199, errata): when you conquer or hold, may discard 1 and exhaust me to
 *   play a ready Reflection token there; "it becomes a copy of another unit there" is missing
 *   (446).
 * - Revna the Lorekeeper (UNL-005), Jhin, Meticulous Killer (UNL-089), Arachnoid Horror (UNL-117),
 *   Rengar, Trophy Hunter (UNL-120), Evelynn, Entrancing (UNL-141): one line is blocked by a
 *   capability gap; see the lane report.
 * - Poppy, Defender of the Meek (UNL-178): the additional cost / discount cannot be automated
 *   (356.2.b.1) and the printed discount amount is missing from the catalog.
 * - Stalking Wolf (UNL-166, errata): the mandatory "kill a Bird, Cat, Dog, or Poro" cost cannot be
 *   expressed by the cost selector (357.2).
 */
import { registerCardScript } from "../registry";
import { HERE, SELF, WHEN_PLAYED, token } from "../dsl";
import { registerPlayPermission } from "../../play/permissions";
import { legionActive } from "../../play/keyword-helpers";

/** 812.2 / 420.1.a: [Legion] "You may play me from your trash for [3] [Fury]." */
registerPlayPermission((room, _host, query) => {
  if (query.zone !== "trash" || query.card.name !== "Undying Legion") return null;
  if (!legionActive(room, query.playerId, query.card.id)) return null;
  return {
    id: "unl:undying-legion",
    rule: "812.2",
    cost: { energy: 3, power: { Fury: 1 } },
  };
});

registerCardScript({
  name: "Undying Legion",
  text: "[Legion] You may play me from your trash for [3] [Fury]. (Get the effect if you've played another card this turn.)",
  status: "implemented",
  abilities: [],
});

const REFLECTION_READY = { exhausted: false, play: true, keywords: ["Temporary"] };

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

registerCardScript({
  name: "LeBlanc, Deceiver",
  text: "When you conquer or hold, you may discard 1 and exhaust me to play a ready Reflection unit token there. Then do this: It becomes a copy of another unit there. Give it [Temporary].",
  status: "partial",
  notes:
    "The optional discard/exhaust cost and the ready Reflection token are automated (383.3.b, 440). 'It becomes a copy of another unit there' is missing: copy effects (446) are not implemented.",
  abilities: [
    // The catalog's [Temporary] is the granted token keyword (reminder), not this legend's.
    { kind: "keyword", keyword: "Temporary", value: 0 },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: ["conquer", "hold"], player: "self" } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { discard: 1, exhaust: SELF },
        effect: {
          op: "create",
          token: token("Reflection", REFLECTION_READY),
          zone: { kind: "chosen", ref: "event-zone" },
        },
      },
    },
  ],
});

registerCardScript({
  name: "Revna the Lorekeeper",
  text: "[Ganking] (I can move from battlefield to battlefield.)\nWhen you play a spell, if you spent [4] or more, ready me.",
  status: "partial",
  notes:
    "'If you spent [4] or more' is not tracked (Amount `spent`, 357, 166.2): the ready trigger is not automated. [Ganking] is a printed keyword.",
  abilities: [],
});

registerCardScript({
  name: "Jhin, Meticulous Killer",
  text: "[Vision]  (When you play me, look at the top card of your deck. You may recycle it.)\n\nIf you've spent [4] or more to play a spell this turn, you may play me for [mind].",
  status: "partial",
  notes:
    "The alternative cost 'you may play me for [mind]' is gated on resources spent this turn, which are not tracked (357, 166.2); [Vision] is a printed keyword.",
  abilities: [],
});

registerCardScript({
  name: "Arachnoid Horror",
  text: "[Hunt 2] (When I conquer or hold, gain 2 XP.)\nI can be played to an occupied battlefield if an enemy unit is alone there.\nFriendly unit can be played to an occupied battlefield if an enemy unit is alone there.",
  status: "partial",
  notes:
    "The play-location permission to an occupied battlefield (355.2.b) cannot be registered by a card script; [Hunt 2] is a printed keyword.",
  abilities: [],
});

registerCardScript({
  name: "Rengar, Trophy Hunter",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nI can [Ambush] to a battlefield where there are enemy units, even if you don't have units there.",
  status: "partial",
  notes:
    "The widened [Ambush] location (822.1) cannot be registered by a card script: [Ambush] is still limited to battlefields where you have units.",
  abilities: [{ kind: "keyword", keyword: "Reaction", value: 0 }],
});

registerCardScript({
  name: "Evelynn, Entrancing",
  text: "[Hidden] (Hide now for [rune] to react with later for [0] .)\n[Backline] (I must be assigned combat damage last.)\nWhen you play me from facedown on your turn, you may move an enemy unit at a different location to my battlefield.",
  status: "partial",
  notes:
    "'When you play me from facedown' is not detectable: the facedown origin is gone when the unit-played event is emitted (811.1.b; see the [BUG] for Katarina, Reckless). [Hidden] and [Backline] are printed keywords.",
  abilities: [],
});

registerCardScript({
  name: "Poppy, Defender of the Meek",
  text: "You may spend 3 XP as an additional cost to play me. If you do, I cost less.\n[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\n[Tank] (I must be assigned combat damage first.)",
  status: "partial",
  notes:
    "The optional 3 XP additional cost and the cost reduction cannot be combined: a cost modifier cannot read the optional-cost choice (356.2.b.1, 366), and the catalog text is missing the reduction amount. [Ambush] and [Tank] are printed keywords.",
  abilities: [{ kind: "keyword", keyword: "Reaction", value: 0 }],
});

registerCardScript({
  name: "Stalking Wolf",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nAs an additional cost to play me, kill a Bird, Cat, Dog, or Poro you control. You may [Ambush] me to its battlefield, even if you don't have other units there.",
  status: "partial",
  notes:
    "The mandatory additional cost 'kill a Bird, Cat, Dog, or Poro' cannot be expressed by the cost selector (one tag only, 357.2) and the widened [Ambush] location cannot be registered; the printed [Ambush] works.",
  abilities: [{ kind: "keyword", keyword: "Reaction", value: 0 }],
});
