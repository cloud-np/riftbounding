/**
 * Wave R4 Vendetta gear: play/burn triggers, self-control changes and static cost effects that
 * the current cost layer can or cannot enforce.
 */
import { registerCardScript } from "../registry";
import { SELF, aUnit } from "../dsl";
import { SELF_EMPOWERED, empower } from "./shared";

registerCardScript({
  name: "Endless Riches",
  text: "When you play this, banish your hand and trash, then [Burn 7]\nSkip your draw phase.\nYou may play cards from your trash.\nIf a card would go to your trash from anywhere other than your Main Deck, banish it instead.",
  status: "partial",
  notes:
    "The play trigger is automated. 'Skip your draw phase' is a permanent repeated skip (the skip op is one-shot); 'you may play cards from your trash' is a general play permission the play layer does not grant; and the trash→banish replacement applies to every zone change without an action hook (444/422).",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "gear_played", subject: SELF } },
      effect: {
        op: "seq",
        effects: [
          { op: "custom", id: "ven:banish-hand-and-trash" },
          { op: "burn", amount: 7, target: {} },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Forgotten Relic",
  text: "When you play this or at the start of your Beginning Phase, [Burn 1]. When you burn a unit this way, do this: Give a friendly unit +[Might] equal to the burned card's Might this turn. (To Burn 1, put the top card of your Main Deck into your trash.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "gear_played", subject: SELF } },
      effect: {
        op: "seq",
        effects: [
          { op: "burn", amount: 1, target: {} },
          { op: "custom", id: "ven:give-burned-might" },
        ],
      },
    },
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      effect: {
        op: "seq",
        effects: [
          { op: "burn", amount: 1, target: {} },
          { op: "custom", id: "ven:give-burned-might" },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Glowstone",
  text: "[Empower][Rune][Rune] ([Rune][Rune]: Empower me. Use only if not Empowered.)\nDisempower this, [Tap]: Choose a player. They gain control of this and recall it. (Send it to their base.)\nAt the end of your turn, kill this and deal 5 to all units you control.",
  status: "partial",
  notes:
    "'Disempower this' is part of the activation cost (357.2) but the Cost shape has no disempower part, so it is the first instruction on resolution and the ability is rejected unless Glowstone is Empowered.",
  abilities: [
    empower({ power: { any: 2 } }),
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "requires",
        condition: SELF_EMPOWERED,
        rule: "357.2",
        effect: {
          op: "seq",
          effects: [
            { op: "disempower", target: SELF },
            { op: "draw", amount: 0, player: { kind: "chosen", ref: "player" } },
            { op: "custom", id: "ven:control-and-recall", params: { source: "self", playerRef: "player" } },
          ],
        },
      },
    },
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "ending" },
      effect: {
        op: "seq",
        effects: [
          { op: "kill", target: SELF },
          { op: "deal", amount: 5, target: { cardType: "unit", controller: "self" } },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Helm of Suppression",
  text: "[Empower][4][Calm] ([4][Calm]: Empower this. Use only if not Empowered.)\nOpponents' spells cost [1] more. If this is [Empowered], they cost [1][Rune] more instead.",
  status: "partial",
  notes:
    "Cost modifiers only apply to the modifier controller's plays (`layers/costs.ts` skips modifiers whose controller is not the payer), so an opponent-cost increase cannot be expressed (356.3).",
  abilities: [empower({ energy: 4, power: { Calm: 1 } })],
});

registerCardScript({
  name: "Shady Spectacles",
  text: "[Equip][1][Order] ([1][Order]: Attach this to a unit you control.)\nAs this is attached to a unit, choose another friendly unit. The equipped unit becomes a copy of that unit for as long as this is attached to it.\n(I am a copy of the chosen unit.)\n+0 [Might]",
  status: "partial",
  notes:
    "Copy effects (446) are not implemented, so the equipped unit does not become a copy of the chosen friendly unit. The built-in Equip ability now attaches (818.1.c.2).",
  abilities: [],
});

registerCardScript({
  name: "Sky Cruiser",
  text: "Discard a gear, [1], [Tap]: Deal 4 to a unit at a battlefield.",
  status: "partial",
  notes:
    "The discard cost is paid with any card: `Cost.discard` has no card-type filter (423.1.a), so 'a gear' is not enforced.",
  abilities: [
    {
      kind: "activated",
      cost: { discard: 1, energy: 1, exhaust: SELF },
      effect: { op: "deal", amount: 4, target: aUnit({ zone: "battlefield" }) },
    },
  ],
});

registerCardScript({
  name: "Stargazer",
  text: "Spells with [Flow] you play from your trash cost [2] less, to a minimum of [1].",
  status: "partial",
  notes:
    "The cost layer has no origin-zone query (to tell 'from your trash'), no per-discount minimum of [1] (356.4.c) and no Flow-keyword filter for cards off the board; no cost modifier is registered to avoid applying a wrong discount.",
  abilities: [],
});
