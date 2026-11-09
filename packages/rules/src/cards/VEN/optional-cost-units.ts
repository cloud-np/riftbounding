/**
 * Vendetta units with a printed optional additional cost (204.2 / 355.1.a, offered and paid by
 * R2-play as `optional:0`) and an "if you paid the additional cost" play effect (356.4.f.1,
 * 383.2.a.1: part of the trigger condition, read from the permanent's `paidAdditionalCost`).
 */
import { registerCardScript } from "../registry";
import { PAID_ADDITIONAL, WHEN_PLAYED, aUnit, token } from "../dsl";
import { notIntrinsic } from "./shared";

const PAID_FLAG_NOTE =
  "The optional additional cost is offered/paid by R2-play (`optional:0`) and the play effect reads the paid flag (356.4.f.1).";

registerCardScript({
  name: "Masa, Crashing Thunder",
  text: "You may pay [Order] as an additional cost to play me.\nWhen you play me, if you paid the additional cost, [Stun] an enemy unit at a battlefield. (It doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: { op: "stun", target: aUnit({ controller: "opponent", zone: "battlefield" }) },
    },
  ],
});

registerCardScript({
  name: "Gust Monk",
  text: "You may pay [1] as an additional cost to play me.\nWhen you play me, if you paid the additional cost, banish a card from any trash to give a unit [Assault 2] this turn. (+2 [Might] while it's an attacker.)",
  status: "partial",
  notes: `"Banish a card from any trash to …" is a cost within the instruction: it is paid on resolution instead of when the trigger finalizes (cost_then has no banish-from-trash cost, 740.4.a.2). ${PAID_FLAG_NOTE}`,
  abilities: [
    ...notIntrinsic("Assault"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "banished",
            selector: { zone: "trash" },
            min: 1,
            max: 1,
            label: "Banish a card from any trash",
          },
          { op: "banish", target: { targetRef: "banished" } },
          {
            op: "if",
            condition: { kind: "did" },
            then: {
              op: "grant_keyword",
              keyword: "Assault", value: 2,
              target: aUnit({ targetRef: "target:0" }),
              duration: "this-turn",
            },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Zed, From the Shadows",
  text: 'You may discard 1 as an additional cost to play me.\nWhen you play me, if you paid the additional cost, play a 0 [Might] Shadow Clone unit token. (It has "When I attack, you may banish a unit from your trash. If you do, give me [Assault 4] this turn.")',
  status: "implemented",
  abilities: [
    // The catalog's Assault comes from the Shadow Clone's reminder text (135.2.d.3).
    ...notIntrinsic("Assault"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: { op: "create", token: token("Shadow Clone", { might: 0, play: true }) },
    },
  ],
});
