/**
 * Vendetta units (batch 4): combat-end, move and play triggers built from the plain DSL.
 */
import { SELF_EMPOWERED, whileEmpowered } from "./shared";
import { custom, HERE, registerCardScript, SELF, WHEN_I_MOVE, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Mournful Witness",
  text: "When a combat that I was in ends, empower me. (I become Empowered if I'm not already.)\n[Empowered] I have +2 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      // 468.7.b: `combat_end` names the battlefield; every unit there was in the combat (466).
      trigger: { kind: "event", event: { type: "combat_end", zone: HERE } },
      effect: { op: "empower", target: SELF },
    },
    whileEmpowered({ kind: "might", amount: 2, target: SELF }),
  ],
});
void SELF_EMPOWERED;

registerCardScript({
  name: "Shadow Order Disciple",
  text: "When I move, you may [Burn 1] to give me +1 [Might] this turn. (To Burn 1, put the top card of your Main Deck into your trash.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: {
        op: "may",
        effect: {
          op: "seq",
          effects: [
            { op: "burn", amount: 1, target: {} },
            {
              op: "if",
              condition: { kind: "did" },
              then: { op: "temporary_might", amount: 1, target: SELF },
            },
          ],
        },
      },
    },
  ],
});

registerCardScript({
  name: "Pakaa Protector",
  text: "When I move, reveal the top card of your Main Deck. If it's a unit, draw it. Otherwise, put it in your trash and give me +2[Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      // 425 reveal / 441 trash: the revealed card is the top card of the Main Deck (`looked`).
      effect: {
        op: "look",
        amount: 1,
        then: {
          op: "seq",
          effects: [
            { op: "reveal", target: { targetRef: "looked" } },
            {
              op: "if",
              condition: {
                kind: "exists",
                selector: { targetRef: "looked", cardType: "unit", zone: "deck" },
              },
              then: { op: "draw", amount: 1 },
              else: {
                op: "seq",
                effects: [
                  { op: "burn", amount: 1, target: {} },
                  { op: "temporary_might", amount: 2, target: SELF },
                ],
              },
            },
          ],
        },
      },
    },
  ],
});

registerCardScript({
  name: "Jayce, Brilliant Inventor",
  text: "When you play me or the first time you play a non-token gear each turn, you may ready something besides me that's exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "ready",
        target: { chosen: true, exhausted: true, excludeSource: true, cardType: "permanent" },
      },
    },
    {
      kind: "triggered",
      // "the first time" each turn: the once-per-turn limit counts triggers (383.2.b).
      trigger: {
        kind: "event",
        event: { type: "gear_played", player: "self", subject: { cardType: "gear", token: false } },
      },
      limit: { kind: "once-per-turn" },
      optional: true,
      effect: {
        op: "ready",
        target: { chosen: true, exhausted: true, excludeSource: true, cardType: "permanent" },
      },
    },
  ],
});
