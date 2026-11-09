/**
 * Wave R4 Vendetta Empower units and cards whose missing piece is an engine capability rather
 * than the script (card-name choices, from-facedown plays, ignored keywords).
 */
import { registerCardScript } from "../registry";
import { SELF, aUnit } from "../dsl";
import { SELF_EMPOWERED, empower } from "./shared";

registerCardScript({
  name: "Mel, Defiant Soul",
  text: "[Empower] - Discard a spell (Pay the cost: Empower me. Use only if not Empowered.)\nWhen I become [Empowered], banish an enemy unit at a battlefield with 3 [Might] or less.",
  status: "partial",
  notes:
    "The Empower cost is 'Discard a spell', but `Cost.discard` has no card-type filter (423.1.a), so any card can be discarded.",
  abilities: [
    {
      kind: "activated",
      cost: { discard: 1 },
      effect: { op: "requires", condition: { kind: "not", condition: SELF_EMPOWERED }, rule: "827.1.c.1", effect: { op: "empower", target: SELF } },
    },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "empower", subject: SELF } },
      effect: {
        op: "banish",
        target: aUnit({ controller: "opponent", zone: "battlefield", might: { op: "lte", value: 3 } }),
      },
    },
  ],
});

/**
 * Gangplank's Empowered replacement: the stun branch is a game action (`stun`) and can be
 * replaced; "give me -[Might]" and "return me to hand" are not interceptable actions, and the
 * "spell or ability that chooses me" qualifier has no choice record on the event.
 */
registerCardScript({
  name: "Gangplank, Naval",
  text: "[Empower][C][C] ([C][C]: Empower me. Use only if not Empowered.)\n[Empowered] If a spell or ability that chooses me would stun me, give me -[Might], or return me to hand, give me +3 [Might] this turn instead.",
  status: "partial",
  notes:
    "Only the stun branch is automated: 'would stun me' is a replaceable action (424), but Might decreases are applied directly by the arithmetic layer and return-to-hand is not intercepted; the 'spell or ability that chooses me' qualifier is not recorded on those events.",
  abilities: [
    empower({ power: { any: 2 } }),
    {
      kind: "replacement",
      matches: { type: "stun", subject: SELF, condition: SELF_EMPOWERED },
      replace: { op: "temporary_might", amount: 3, target: SELF },
    },
  ],
});

registerCardScript({
  name: "Mask Mother",
  text: "When you discard me, you may pay [1] to give a friendly unit +2 [Might] this turn.",
  status: "partial",
  notes:
    "A trigger of a card in a non-board zone is not detected (385/383.1): discarding Mask Mother never queues the ability.",
  abilities: [],
});

registerCardScript({
  name: "Fallen Feline",
  text: "When you play me, name a spell.\nWhile I'm at a battlefield, opponents can't play spells with that name.",
  status: "partial",
  notes:
    "Naming a card (a free card-name choice) and a persistent name-based 'can't be played' restriction are not supported: the restriction layer reads static modifiers and there is no name-choice state.",
  abilities: [],
});

registerCardScript({
  name: "Tornado Warrior",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen you play me from face down, you may empower something here. Disempower it at end of turn.",
  status: "partial",
  notes:
    "A unit played from face down cannot be told apart at its play trigger: the `unit_played` event carries no origin zone (811.6) and the chain item is removed before triggers are detected.",
  abilities: [],
});

registerCardScript({
  name: "Dune Surfer",
  text: "You ignore [Tank] while assigning combat damage here.",
  status: "partial",
  notes:
    "`ignore-keyword` (764–767) has no consumer in combat damage assignment yet; the Tank profile still applies while assigning damage here.",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "custom",
        id: "ignore-keyword",
        params: { keyword: "Tank", action: "assign-combat-damage", here: true },
      },
    },
  ],
});
