/**
 * Unleashed (UNL) R4 spells:
 *
 * - Alpha Strike (UNL-192): "Choose a friendly unit. It deals damage equal to its Might split
 *   among enemy units at battlefields. Then for each unit this kills, gain 1 XP." (355.14,
 *   418.6.b.3, 730.1)
 * - Tricksy Tentacles (UNL-054): "Move any number of enemy units with the same controller and a
 *   total Might of 8 or less to a single location." (355.11, 355.13, 421)
 * - Curtain Call (UNL-182): a four-mode spell with three separate [Repeat] costs; each paid
 *   instance repeats the instructions and must choose an unused mode (820.1.c/d, 820.2, 355.3).
 * - Repulse (UNL-106): counter an enemy spell or ability that chooses the chosen friendly unit and
 *   no other friendly unit (355.7, 426).
 * - Mirror Image (UNL-200, errata): play a ready Reflection token; the copy instruction is missing
 *   (446, see the lane report).
 */
import { registerCardScript } from "../registry";
import { aUnit, custom, token } from "../dsl";
import type { Effect } from "@rift/protocol";
import { registerAdditionalCosts } from "../../play/additional-costs";

const REFLECTION = { exhausted: false, play: true, keywords: ["Temporary" as const] };

registerCardScript({
  name: "Alpha Strike",
  text: "[Action] (Play on your turn or in showdowns.)\nChoose a friendly unit. It deals damage equal to its Might split among enemy units at battlefields.\nThen for each unit this kills, do this: Gain 1 XP.",
  status: "partial",
  notes:
    "The split damage is automated (355.14). \"For each unit this kills\" is read as each affected unit left with lethal damage when the spell resolves: deaths happen in the following Cleanup, so a death replaced by another effect still gains the XP (730.1).",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "deal_split",
            amount: { kind: "might", selector: { targetRef: "friend" } },
            source: { chosen: true, targetRef: "friend", cardType: "unit", controller: "self" },
            target: {
              chosen: true,
              targetRef: "foes",
              cardType: "unit",
              controller: "opponent",
              zone: "battlefield",
            },
          },
          // "for each unit this kills" (730.1): the split's affected units with lethal damage.
          { op: "custom", id: "unl:xp-per-kill" },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Tricksy Tentacles",
  text: "Move any number of enemy units with the same controller and a total Might of 8 or less to a single location.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "move",
        target: {
          chosen: true,
          cardType: "unit",
          controller: "opponent",
          anyNumber: true,
          // 355.11: the group as a whole is from one controller with total Might 8 or less.
          group: { sameController: true, totalMight: { op: "lte", value: 8 } },
        },
        to: { kind: "chosen", ref: "destination" },
      },
    },
  ],
});

const CURTAIN_CALL_MODES: Array<{ id: string; effect: Effect }> = [
  { id: "draw", effect: { op: "draw", amount: 1 } },
  { id: "deal2", effect: { op: "deal", amount: 2, target: aUnit({ zone: "battlefield" }) } },
  { id: "deal3", effect: { op: "deal", amount: 3, target: aUnit({ zone: "base" }) } },
  { id: "might", effect: { op: "temporary_might", amount: -4, target: aUnit({ zone: "battlefield" }) } },
];

// "[Repeat] -[1] / [rune] / [1] [rune]": three separate optional additional costs, each of which
// repeats the instructions once (820.1.c/.d). The "/" alternatives are not the parser's grammar.
registerAdditionalCosts("Curtain Call", [
  { id: "repeat", optional: true, cost: { energy: 1 }, rule: "820.1.c", label: "Repeat" },
  { id: "repeat:1", optional: true, cost: { power: { any: 1 } }, rule: "820.1.c", label: "Repeat" },
  {
    id: "repeat:2",
    optional: true,
    cost: { energy: 1, power: { any: 1 } },
    rule: "820.1.c",
    label: "Repeat",
  },
]);

registerCardScript({
  name: "Curtain Call",
  text: "[Repeat] -[1] / [rune] / [1] [rune] (You may pay each additional cost to repeat this spell's effect.)\n\nChoose one you haven't already chosen -\n    ᛫ Draw 1\n    ᛫ Deal 2 to a unit at a battlefield.\n    ᛫ Deal 3 to a unit at a base.\n    ᛫ Give a unit at a Battlefield -4 [might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          // 820.2 / 355.3: each execution picks a mode not chosen by an earlier execution.
          {
            op: "custom",
            id: "unl:curtain-call-mode",
            params: { modes: CURTAIN_CALL_MODES.map((mode) => mode.id) },
          },
          {
            op: "choose_mode",
            modes: CURTAIN_CALL_MODES.map((mode) => ({
              id: mode.id,
              label: mode.id,
              effect: mode.effect,
            })),
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Repulse",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a friendly unit at a battlefield. Counter an enemy spell or ability that chooses it and no other friendly unit.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "for_each",
            selector: aUnit({ targetRef: "target:0", zone: "battlefield", controller: "self" }),
            effect: {
              op: "counter",
              target: {
                chosen: true,
                targetRef: "target:1",
                zone: "chain",
                controller: "opponent",
                where: custom("unl:item-chooses-only", { ref: "target:0" }),
              },
            },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Mirror Image",
  text: "Choose a unit. Play a ready Reflection unit token to your base. Then do this: It becomes a copy of that unit. Give it [Temporary]. (Kill it at the start of its controller's Beginning Phase, before scoring.)",
  status: "partial",
  notes:
    "The chosen unit and the ready Reflection token are automated. 'It becomes a copy of that unit' is missing: copy effects (446) are not implemented.",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Temporary" },
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          // Bind the printed "Choose a unit" target; the copy instruction that would use it is
          // not implemented (446). A 0 Might change is a no-op.
          { op: "temporary_might", amount: 0, target: aUnit() },
          { op: "create", token: token("Reflection", REFLECTION), zone: "base" },
        ],
      },
    },
  ],
});
