/**
 * Wave R4 Vendetta spells: group targeting (355.11/355.13), resolution-time choices and
 * effect-driven plays.
 */
import { registerCardScript } from "../registry";
import { aUnit, custom } from "../dsl";

registerCardScript({
  name: "Acceleration Gate",
  text: "Ready up to 4 units, gear and/or runes.",
  status: "implemented",
  abilities: [
    { kind: "spell", effect: { op: "custom", id: "ven:ready-up-to", params: { count: 4 } } },
  ],
});

const ORDER_UNIT = aUnit({
  controller: "opponent",
  targetRef: "target:0",
  anyNumber: true,
  group: { totalMight: { op: "lte", value: 5 } },
  where: custom("ven:has-domain", { domain: "order" }),
});

registerCardScript({
  name: "Decree of Discord",
  text: "Return any number of enemy Order ([Order]) units with total Might 5 or less to their owners' hands.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          // The zero-damage bind collects the group target on play (355.11.a); the second
          // instruction acts on the bound choice.
          { op: "deal", amount: 0, target: ORDER_UNIT },
          { op: "return_to_hand", target: { targetRef: "target:0" } },
        ],
      },
    },
  ],
});

const DECREE_OF_FOCUS_UNIT = aUnit({
  controller: "self",
  targetRef: "target:0",
  where: custom("ven:decree-focus-eligible"),
});

registerCardScript({
  name: "Decree of Focus",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a friendly unit that's in combat with an enemy Fury ([Fury]) unit or that's being chosen by an enemy Fury spell. Give it +4 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: { op: "temporary_might", amount: 4, target: DECREE_OF_FOCUS_UNIT },
    },
  ],
});

const REBUTTAL_SPELL = {
  chosen: true as const,
  cardType: "spell" as const,
  targetRef: "target:0",
  energyCost: { op: "lte" as const, value: 4 },
};

registerCardScript({
  name: "Rebuttal",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a spell with Energy cost no more than [4].\nYou may pay [Rune]. If you do, gain control of it and you may make new choices for it. Otherwise, counter it.",
  status: "partial",
  notes:
    "Control and the counter branch are automated. 'Make new choices' (751–755) is approximated by clearing the pending item's choices so its missing target/mode choices are re-asked at resolution: the all-at-once remake, the 753.2 negation when no legal choice exists and re-choosing a play location are not enforced.",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          // Zero-damage bind of the spell target (chain items are not units, so it does nothing).
          { op: "deal", amount: 0, target: REBUTTAL_SPELL },
          { op: "custom", id: "ven:rebuttal", params: { ref: "target:0" } },
        ],
      },
    },
  ],
});

const TEMPORAL_BREACH_UNIT = aUnit({ targetRef: "target:0" });

registerCardScript({
  name: "Temporal Breach",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nBanish a unit, then its owner plays it to the same location, ignoring its cost.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "deal", amount: 0, target: TEMPORAL_BREACH_UNIT },
          { op: "custom", id: "ven:banish-then-replay", params: { ref: "target:0" } },
        ],
      },
    },
  ],
});

const LOOKED_UNIT_OR_GEAR = {
  zone: "deck" as const,
  where: {
    kind: "and" as const,
    conditions: [{ kind: "in-ref" as const, ref: "looked" }, custom("ven:is-unit-or-gear")],
  },
};

registerCardScript({
  name: "Wild Claw",
  text: "Look at the top 5 cards of your Main Deck. You may banish a unit or gear from among them and play it, reducing its Energy cost by [5]. Recycle the rest. Then you may do this: Empower it. (It becomes Empowered if it's not already.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "look",
        amount: 5,
        then: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "chosen",
              selector: LOOKED_UNIT_OR_GEAR,
              min: 0,
              max: 1,
              label: "Banish a unit or gear and play it for [5] less?",
            },
            { op: "custom", id: "ven:wild-claw-play" },
          ],
        },
      },
    },
  ],
});
