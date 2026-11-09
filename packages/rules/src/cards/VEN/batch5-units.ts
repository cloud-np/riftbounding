/**
 * Wave R4 Vendetta units: move/attack triggers, play effects, static combat restrictions and
 * replacements that R3-engine unblocked (group targeting 355.11, optional replacements 371.2,
 * damage-split 355.14).
 */
import { SELF_EMPOWERED, WHEN_I_ATTACK, WHEN_I_DEFEND, empower, notIntrinsic } from "./shared";
import { aUnit, custom, HERE, not, registerCardScript, registerCustomCondition, SELF, unitsPresentAt, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Blade Twirler",
  text: "The first time I move each turn, choose a player. They [Burn 1]. (They put the top card of their Main Deck into their trash.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "move", subject: SELF } },
      limit: { kind: "once-per-turn" },
      effect: {
        op: "seq",
        effects: [
          // 355.7: the player is chosen when the trigger finalizes; the zero draw only binds it.
          { op: "draw", amount: 0, player: { kind: "chosen", ref: "player" } },
          { op: "burn", amount: 1, target: { controller: { kind: "chosen", ref: "player" } } },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Dame the Despoiler",
  text: "[Empower][5][Body] ([5][Body]: Empower me. Use only if not Empowered.)\n[Empowered] When I attack or defend, choose a unit here. Increase my Might to its Might this turn, then give me +1 [Might] this turn.",
  status: "implemented",
  abilities: [
    empower({ energy: 5, power: { Body: 1 } }),
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: ["attack", "defend"], subject: SELF } },
      condition: SELF_EMPOWERED,
      effect: {
        op: "seq",
        effects: [
          { op: "choose", key: "unit", selector: { cardType: "unit", zone: HERE }, min: 1, max: 1, label: "Choose a unit here" },
          { op: "custom", id: "ven:increase-might-to-chosen" },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Jayce, Hammer in Hand",
  text: "When I become ready, choose one to give me this turn --\n• [Assault 2] (+2 [Might] while I'm an attacker)\n• [Deflect 2] (Opponents must pay [Rune][Rune] to choose me with a spell or ability.)\n• [Ganking] (I can move from battlefield to battlefield.)",
  status: "partial",
  notes:
    "The 'when I become ready' trigger fires for effect-driven readies (416), but the Beginning Phase 'ready all' emits one ready_all event and no per-object ready events (315.1), so it does not trigger there.",
  abilities: [
    ...notIntrinsic("Assault"),
    ...notIntrinsic("Deflect"),
    ...notIntrinsic("Ganking"),
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "ready", subject: SELF } },
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "assault",
            label: "[Assault 2]",
            effect: { op: "grant_keyword", keyword: "Assault", value: 2, target: SELF, duration: "this-turn" },
          },
          {
            id: "deflect",
            label: "[Deflect 2]",
            effect: { op: "grant_keyword", keyword: "Deflect", value: 2, target: SELF, duration: "this-turn" },
          },
          {
            id: "ganking",
            label: "[Ganking]",
            effect: { op: "grant_keyword", keyword: "Ganking", target: SELF, duration: "this-turn" },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Profiteer",
  text: "When you play me, you may disempower something you control to empower a legend, unit, or gear.",
  status: "partial",
  notes:
    "'Disempower something you control' is a cost within the instructions (740.4.a.2); the Cost shape has no disempower part, so it is paid on resolution after the may decision. Choices cover board units/gear; a legend can be neither the disempowered object nor the empowerment target (selector zones do not combine the legend zone with board zones).",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "may",
        label: "Disempower something you control to empower a legend, unit, or gear?",
        effect: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "source",
              selector: { empowered: true, controller: "self" },
              min: 1,
              max: 1,
              label: "Choose something you control to disempower",
            },
            { op: "disempower", target: { targetRef: "source" } },
            {
              op: "choose",
              key: "target",
              selector: { cardType: "permanent", controller: "self" },
              min: 1,
              max: 1,
              label: "Choose a legend, unit, or gear to empower",
            },
            { op: "empower", target: { targetRef: "target" } },
          ],
        },
      },
    },
  ],
});

/** Sacred Protector: I'm at a battlefield with exactly one other face-up unit my controller controls. */
registerCustomCondition("ven:at-battlefield-with-exactly-one-other-friendly", (ctx) => {
  const source = ctx.env.sourceObjectId;
  const located = source ? ctx.host.findCard(ctx.room, source) : null;
  if (!source || !located) return false;
  if (!(ctx.host.battlefieldZones(ctx.room) as string[]).includes(located.zone)) return false;
  const others = unitsPresentAt(ctx.room, ctx.host, located.zone).filter(
    (card) => card.id !== source && ctx.host.findCard(ctx.room, card.id)?.playerId === located.playerId,
  );
  return others.length === 1;
});

registerCardScript({
  name: "Sacred Protector",
  text: "I don't deal combat damage unless I'm at a battlefield with exactly one other unit you control.",
  status: "implemented",
  // 467.2.a/b: no combat damage contribution unless paired.
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "while",
        condition: not(custom("ven:at-battlefield-with-exactly-one-other-friendly")),
        modifier: { kind: "no-combat-damage", target: SELF },
      },
    },
  ],
});

registerCardScript({
  name: "Sandstone Chimera",
  text: "While I'm at a battlefield, players only channel 1 rune at the start of their Channel Phase.",
  status: "implemented",
  abilities: [
    {
      kind: "replacement",
      matches: {
        type: "channel",
        condition: {
          kind: "and",
          conditions: [{ kind: "self-state", state: "at-battlefield" }, { kind: "is-phase", phase: "channel" }],
        },
      },
      replace: { op: "custom", id: "ven:channel-one" },
    },
  ],
});

registerCardScript({
  name: "Tail-Cloaked Matriarch",
  text: "[Empower][2][Chaos] ([2][Chaos]: Empower me. Use only if not Empowered.)\nWhen I become [Empowered], you may choose a unit in your trash with Energy cost no more than [3] and Power cost no more than [Rune]. Play it to your base, ignoring its cost.",
  status: "implemented",
  abilities: [
    empower({ energy: 2, power: { Chaos: 1 } }),
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "empower", subject: SELF } },
      effect: {
        op: "may",
        label: "Play a unit from your trash?",
        effect: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "unit",
              selector: {
                cardType: "unit",
                zone: "trash",
                controller: "self",
                energyCost: { op: "lte", value: 3 },
                powerCost: { op: "lte", value: 1 },
              },
              min: 1,
              max: 1,
              label: "Choose a unit in your trash",
            },
            { op: "play", target: { targetRef: "unit" }, cost: "ignored", location: "base" },
          ],
        },
      },
    },
  ],
});

registerCardScript({
  name: "Kharox",
  text: "[Empower][6][Chaos][Chaos] ([6][Chaos][Chaos]: Empower me. Use only if not Empowered.)\nWhen I become [Empowered], choose an opponent. They [Burn 3]. Then you may do this: Choose a unit in their trash and play it, ignoring its cost.",
  status: "implemented",
  abilities: [
    empower({ energy: 6, power: { Chaos: 2 } }),
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "empower", subject: SELF } },
      effect: {
        op: "seq",
        effects: [
          // 355.7: choose an opponent when the trigger finalizes.
          { op: "draw", amount: 0, player: { kind: "chosen", ref: "opponent" } },
          { op: "burn", amount: 3, target: { controller: { kind: "chosen", ref: "opponent" } } },
          {
            op: "may",
            label: "Play a unit from their trash?",
            effect: {
              op: "seq",
              effects: [
                {
                  op: "choose",
                  key: "unit",
                  selector: {
                    cardType: "unit",
                    zone: "trash",
                    owner: { kind: "chosen", ref: "opponent" },
                  },
                  min: 1,
                  max: 1,
                  label: "Choose a unit in their trash",
                },
                { op: "play", target: { targetRef: "unit" }, cost: "ignored", location: "base" },
              ],
            },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Otterpus",
  text: "If a player would score 1 point from conquering or holding during their first and second turn, they draw 1 instead.",
  status: "implemented",
  abilities: [
    {
      kind: "replacement",
      matches: {
        type: "score",
        condition: custom("ven:first-or-second-turn"),
        data: { kind: "conquer" },
      },
      replace: { op: "custom", id: "ven:draw-instead-of-score" },
    },
    {
      kind: "replacement",
      matches: {
        type: "score",
        condition: custom("ven:first-or-second-turn"),
        data: { kind: "hold" },
      },
      replace: { op: "custom", id: "ven:draw-instead-of-score" },
    },
  ],
});

registerCardScript({
  name: "Ravenbloom Prefect",
  text: "When an opponent plays a gear, you may banish me to banish it.",
  status: "partial",
  notes:
    "'Banish me' is a cost within the instructions (740.4.a.2) with no Cost part for banish; it is paid on resolution, so declining to banish me still banishes the gear.",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "gear_played", player: "opponent" } },
      effect: {
        op: "may",
        label: "Banish me to banish that gear?",
        effect: {
          op: "seq",
          effects: [
            { op: "banish", target: SELF },
            { op: "banish", target: { targetRef: "event" } },
          ],
        },
      },
    },
  ],
});
