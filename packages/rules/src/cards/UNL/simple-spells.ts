/**
 * Unleashed spells whose text is one or two plain game actions (no card-specific logic):
 * Moonlight Affliction (479.4), Lunar Boon (423/414), Soul Harvest (429), The Ruination (429,
 * 355.5.a "all"), Sprite Burst (440.2.c tokens; the Sprite token's [Temporary] comes from the
 * catalog token), Vault Breaker (801.3.a keyword grants with a duration).
 */
import { registerCardScript } from "../registry";
import { aUnit, token } from "../dsl";

registerCardScript({
  name: "Moonlight Affliction",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nGive a unit -10 [might] this turn.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: -10, target: aUnit() } }],
});

registerCardScript({
  name: "Lunar Boon",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nDiscard 1, then draw 2.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "discard", amount: 1 },
          { op: "draw", amount: 2 },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Soul Harvest",
  text: "Kill a unit at a battlefield with 3 [Might] or less.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "kill",
        target: aUnit({ zone: "battlefield", might: { op: "lte", value: 3 } }),
      },
    },
  ],
});

registerCardScript({
  name: "The Ruination",
  text: "Kill all units.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "kill", target: { cardType: "unit", all: true } } }],
});

registerCardScript({
  name: "Sprite Burst",
  text: "Play two ready 3[Might] Sprite unit tokens with [Temporary]. (Kill each at the start of its controller's Beginning Phase, before scoring.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "create",
        token: token("Sprite", { count: 2, might: 3, exhausted: false, play: true }),
      },
    },
  ],
});

registerCardScript({
  name: "Vault Breaker",
  text: "[Action] (Play on your turn or in showdowns.)\nGive a unit [Assault 2] and [Ganking] this turn. (+2 [Might] while it's an attacker. It can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "grant_keyword",
            keyword: "Assault", value: 2,
            target: aUnit({ targetRef: "target:0" }),
            duration: "this-turn",
          },
          {
            op: "grant_keyword",
            keyword: "Ganking",
            target: { targetRef: "target:0" },
            duration: "this-turn",
          },
        ],
      },
    },
  ],
});
