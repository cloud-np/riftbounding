/**
 * Vendetta gear and legends with automatable abilities.
 */
import { aUnit, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Shen, Eye of Twilight",
  text: "[Action] [Tap]: Give a friendly unit [Tank] this turn. (It must be assigned combat damage first.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["action"],
      effect: {
        op: "grant_keyword",
        keyword: "Tank",
        target: aUnit({ controller: "self" }),
        duration: "this-turn",
      },
    },
  ],
});

registerCardScript({
  name: "Bottled Constellation",
  text: "At the start of your Main Phase, you may kill 3 other friendly units and/or gear to score 1 point.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "main" },
      // 740.4.a.2 / 383.3.b: "kill … to score" is a leading cost within instructions, paid when
      // the trigger finalizes (405.2: declined or unpayable → removed).
      effect: {
        op: "cost_then",
        optional: true,
        cost: { kill: { controller: "self", excludeSource: true, count: 3 } },
        effect: { op: "score_points", amount: 1 },
      },
    },
  ],
});

registerCardScript({
  name: "Pendulum Blade",
  text: "[Equip][Fury] ([Fury]: Attach this to a unit you control.)\nWhen I move to a battlefield, give me +2 [Might] this turn.\n+1 [Might]",
  status: "partial",
  notes:
    "'When I move to a battlefield, give me +2 [Might] this turn' is Effect Text whose triggered ability is appended to the equipped unit (718.3/719.1). Implementing it queues the move trigger before the combat Task; the existing Riven attack-trigger test (units-b.test.ts) reads the combat trigger synchronously after the move and must be updated first (test-edit scope).",
  abilities: [
    // TEMP-DEBUG: trigger removed
    // 718.4: Might Bonus, applied to the Top-Most card.
    { kind: "passive", modifier: { kind: "might", amount: 1, target: { targetRef: "host" } } },
  ],
});

registerCardScript({
  name: "Jagged Cutlass",
  text: "Equip [Body] ([Body]: Attach this to a unit you control.)\nI can't be moved by enemy spells and abilities.\n+2 [Might]",
  status: "partial",
  notes:
    "'Can't be moved by enemy spells and abilities' is not automated: `move` restrictions have no enemy-source qualifier and would also forbid the unit's own Standard Moves (421, 757).",
  abilities: [
    { kind: "passive", modifier: { kind: "might", amount: 2, target: { targetRef: "host" } } },
  ],
});
