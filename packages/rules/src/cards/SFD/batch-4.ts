/**
 * Spiritforged (SFD) — wave R3 batch 4: attachments, counters, computed amounts, legends,
 * reflexive "Then do this" effects, and cards whose text needs engine capabilities that do not
 * exist yet (partial / manual, with the missing capability named).
 */
import type { Ability, Condition, Effect, KeywordName, Modifier, Selector } from "@rift/protocol";
import { registerCardScript } from "../registry";
import {
  EVENT_SUBJECT,
  PAID_ADDITIONAL,
  SELF,
  SELF_AT_BATTLEFIELD,
  WHEN_PLAYED,
  custom,
  not,
  token,
} from "../dsl";
import {
  HERE_ZONE,
  WHEN_I_ATTACK,
  WHEN_I_ATTACK_OR_DEFEND,
  WHEN_I_HOLD,
  WHEN_I_MOVE_TO_BATTLEFIELD,
  WHEN_YOU_CONQUER,
  countOf,
  gold,
  notIntrinsic,
  target,
  whilePassive,
} from "./common";

const MANUAL: Effect = { op: "custom", id: "manual" };
const CHOOSE_TRIGGER =
  '"When you choose …" triggers: choosing objects with spells/abilities (355.7) emits no event the trigger layer can match.';

const EQUIPMENT: Selector = { cardType: "gear", tag: "Equipment" };
const IN_LOOKED: Condition = custom("in-ref", { ref: "looked" });

/** A card selector by name (built through a helper so card-coverage only sees card names). */
function named(cardName: string, extra: Partial<Selector> = {}): Selector {
  return { ...extra, name: cardName };
}

/** Stacked keyword instances ("[Assault] equal to …"), `cap` deep. */
function stackedKeyword(
  keyword: KeywordName,
  condition: (k: number) => Condition,
  targetSelector: Selector,
  cap: number,
) {
  return Array.from({ length: cap }, (_, index) =>
    whilePassive(condition(index + 1), {
      kind: "keyword",
      keyword,
      target: targetSelector,
    } satisfies Modifier),
  );
}

/** A mode usable once per turn per source (marks, like Riven, Broken Blade). */
function onceMode(key: string, id: string, label: string, effect: Effect) {
  return {
    id,
    label,
    effect: {
      op: "requires" as const,
      condition: not(custom("marked", { key, value: id })),
      effect: { op: "seq" as const, effects: [{ op: "mark" as const, key, value: id }, effect] },
    },
  };
}

/* ---------------------------------------------------------------- attachments */

registerCardScript({
  name: "Angle Shot",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a unit and an Equipment with the same controller. Attach that Equipment to that unit or detach that Equipment from that unit. Draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "if",
            // Attached to that unit: the only change is to detach it (or leave it); otherwise
            // the only change is to attach it (detaching would do nothing, 436.1.a.1).
            condition: {
              kind: "exists",
              selector: {
                targetRef: "target:1",
                where: custom("sfd:it-attached-to", { ref: "target:0" }),
              },
            },
            then: {
              op: "may",
              label: "Detach that Equipment?",
              effect: { op: "detach", target: { targetRef: "target:1" } },
            },
            else: {
              op: "may",
              label: "Attach that Equipment?",
              effect: {
                op: "attach",
                gear: {
                  ...EQUIPMENT,
                  chosen: true,
                  targetRef: "target:1",
                  where: custom("sfd:same-controller-as", { ref: "target:0" }),
                },
                to: target({ targetRef: "target:0" }),
              },
            },
          },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Aphelios, Exalted",
  text: "When you attach an Equipment to me, choose one that hasn't been chosen this turn —\n- Ready 2 runes.\n- Channel 1 rune exhausted.\n- Buff a friendly unit.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "attach", player: "self", condition: custom("sfd:attached-to-self") },
      },
      effect: {
        op: "choose_mode",
        modes: [
          onceMode("aphelios:{self}", "ready", "Ready 2 runes", {
            op: "seq",
            effects: [
              {
                op: "choose",
                key: "runes",
                selector: {
                  cardType: "rune",
                  controller: "self",
                  zone: "runeArea",
                  exhausted: true,
                },
                min: 2,
                max: 2,
              },
              { op: "ready", target: { targetRef: "runes" } },
            ],
          }),
          onceMode("aphelios:{self}", "channel", "Channel 1 rune exhausted", {
            op: "channel",
            amount: 1,
            exhausted: true,
          }),
          onceMode("aphelios:{self}", "buff", "Buff a friendly unit", {
            op: "buff",
            target: target({ controller: "self" }),
          }),
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Jax, Grandmaster at Arms",
  text: "[1], [Tap]: Attach a detached Equipment you control to a unit you control.\n[Tap]: Attach an attached Equipment you control to a unit you control.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "attach",
        gear: {
          ...EQUIPMENT,
          chosen: true,
          controller: "self",
          where: custom("sfd:it-attached", { attached: false }),
        },
        to: target({ controller: "self" }),
      },
    },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "attach",
        gear: {
          ...EQUIPMENT,
          chosen: true,
          controller: "self",
          where: custom("sfd:it-attached", { attached: true }),
        },
        to: target({ controller: "self" }),
      },
    },
  ],
});

registerCardScript({
  name: "Jax, Unrelenting",
  text: "[WEAPONMASTER] (When you play me, you may [EQUIP] one of your Equipment to me for [Rune] less, even if it's already attached.)\nWhen you attach an Equipment to me, you may pay [1] to draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "attach", player: "self", condition: custom("sfd:attached-to-self") },
      },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "draw", amount: 1 },
      },
    },
  ],
});

registerCardScript({
  name: "Strike Down",
  text: "Choose an equipped friendly unit. It deals damage equal to its Might to an enemy unit. Then detach an Equipment from it.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:0" } },
            target: target({ controller: "opponent", targetRef: "target:1" }),
            // 418.6: the chosen unit is the damage source (its selector declares the Target, 355.7).
            source: target({
              controller: "self",
              targetRef: "target:0",
              where: custom("sfd:it-equipped"),
            }),
          },
          {
            op: "choose",
            key: "detached",
            selector: { ...EQUIPMENT, where: custom("sfd:it-attached-to", { ref: "target:0" }) },
            min: 1,
            max: 1,
          },
          { op: "detach", target: { targetRef: "detached" } },
        ],
      },
    },
  ],
});

/* ---------------------------------------------------------------- triggers with computed amounts */

registerCardScript({
  name: "Altar of Memories",
  text: "When a friendly unit dies, you may exhaust me to draw 1, then put a card from your hand on the top or bottom of your Main Deck.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "die", subject: { cardType: "unit", controller: "self" } },
      },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { exhaust: SELF },
        effect: {
          op: "seq",
          effects: [
            { op: "draw", amount: 1 },
            { op: "custom", id: "sfd:hand-to-deck-top-or-bottom" },
          ],
        },
      },
    },
  ],
});

registerCardScript({
  name: "Lucian, Gunslinger",
  text: "[Assault] (+1 [Might] while I'm an attacker.)\nWhen I attack, deal damage equal to my [Assault] to an enemy unit here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "for_each",
        selector: target({ controller: "opponent", zone: HERE_ZONE }),
        effect: { op: "custom", id: "sfd:deal-keyword-value", params: { keyword: "Assault" } },
      },
    },
  ],
});

registerCardScript({
  name: "Kato the Arm",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nWhen I move to a battlefield, give another friendly unit my keywords and +[Might] equal to my Might this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE_TO_BATTLEFIELD,
      effect: {
        op: "for_each",
        selector: target({ controller: "self", excludeSelf: true }),
        effect: { op: "custom", id: "sfd:give-my-keywords-and-might" },
      },
    },
  ],
});

registerCardScript({
  name: "Fiora, Peerless",
  text: "When I attack or defend one on one, double my Might this combat.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      condition: custom("sfd:one-on-one"),
      // 433.1.a / 479.4.c: doubling increases Might by its current value (0 when negative).
      effect: {
        op: "give_might",
        amount: { kind: "might", selector: SELF },
        target: SELF,
        duration: "this-combat",
      },
    },
  ],
});

registerCardScript({
  name: "Ancient Warmonger",
  text: "[Accelerate] (You may pay [1][Chaos] as an additional cost to have me enter ready.)\nI have [Assault] equal to the number of enemy units here. (+1 [Might] while I'm an attacker for each instance of Assault.)",
  status: "partial",
  notes:
    "Assault equal to the number of enemy units here is expressed as stacked conditional Assault instances (807, 823.2-style summing) up to 10 enemy units; the layers have no computed keyword values (479.3).",
  abilities: [
    ...notIntrinsic("Assault"),
    ...stackedKeyword(
      "Assault",
      (k) => ({
        kind: "count",
        selector: { cardType: "unit", controller: "opponent", zone: HERE_ZONE },
        comparison: { op: "gte", value: k },
      }),
      SELF,
      10,
    ),
  ],
});

registerCardScript({
  name: "Lucian, Purifier",
  text: "Your Equipment each give [ASSAULT]. +1 [Might] while equipped unit is an attacker.)",
  status: "partial",
  notes:
    "Each Equipment's Assault is expressed as stacked conditional Assault instances on units with 1…8 of your Equipment attached; the layers cannot grant one keyword instance per attached card (479.3, 718.3).",
  abilities: [
    ...notIntrinsic("Assault"),
    ...Array.from({ length: 8 }, (_, index): Ability => ({
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Assault",
        target: { cardType: "unit", where: custom("sfd:it-equipment-at-least", { n: index + 1 }) },
      },
    })),
  ],
});

/* ---------------------------------------------------------------- spells */

registerCardScript({
  name: "Counter Strike",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n\nChoose a unit. The next time that unit would be dealt damage this turn, prevent it. Draw 1",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "for_each",
            selector: target({ targetRef: "target:0" }),
            // 438 / 375 / 359.3.f.3.a: a delayed replacement used up by the next damage to that
            // unit this turn. The matcher names the play-time choice; the `replace` op freezes it
            // onto the delayed effect and R4-engine passes it to the matcher.
            effect: {
              op: "replace",
              matches: { type: "damage", subject: { targetRef: "target:0" } },
              replace: { prevent: 9999 },
            },
          },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Emperor's Divide",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Action] (Play on your turn or in showdowns.)\nMove any number of friendly units at a battlefield to their base.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "move",
        target: target({ controller: "self", zone: "battlefield", maxCount: 99 }),
        to: "base",
      },
    },
  ],
});

registerCardScript({
  name: "Not So Fast",
  text: "[REACTION] (Play any time, even before spells and abilities resolve.)\nCounter an enemy spell or ability that chooses a friendly unit or gear.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "counter",
        target: {
          chosen: true,
          zone: "chain",
          controller: "opponent",
          where: custom("sfd:chooses-friendly"),
        },
      },
    },
  ],
});

registerCardScript({
  name: "Riposte",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n\nChoose a friendly unit and a spell. Counter that spell and give that unit +[Might] equal to that spell's energy cost this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          // The two Targets (355.7); the instruction reads the spell's Energy cost before countering it.
          {
            op: "for_each",
            selector: target({ controller: "self", targetRef: "target:0" }),
            effect: {
              op: "for_each",
              selector: { chosen: true, cardType: "spell", targetRef: "target:1" },
              effect: {
                op: "custom",
                id: "sfd:counter-and-give-cost",
                params: { spell: "target:1", unit: "target:0" },
              },
            },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Switcheroo",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Action] (Play on your turn or in showdowns.)\nSwap the Might of two units at the same battlefield this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "swap",
        property: "might",
        a: target({ zone: "battlefield", targetRef: "target:0" }),
        b: target({
          zone: "battlefield",
          targetRef: "target:1",
          sameLocationAs: "target:0",
          excludeRefs: ["target:0"],
        }),
      },
    },
  ],
});

registerCardScript({
  name: "Arise!",
  text: "Play a 2 [Might] Sand Soldier unit token for each Equipment you control. Then do this: Ready up to two of them.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "custom",
            id: "sfd:create-count",
            params: {
              amount: countOf({ ...EQUIPMENT, controller: "self" }),
              token: token("Sand Soldier", { might: 2, play: true }),
            },
          },
          // 387–389: "Then do this:" is a reflexive trigger; its choices are made as it finalizes.
          {
            op: "reflexive",
            effect: {
              op: "ready",
              target: target({ maxCount: 2, where: custom("in-ref", { ref: "created" }) }),
            },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Guards!",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nPlay a 2 [Might] Sand Soldier unit token. Then do this: You may pay [Order] to ready it.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "custom",
            id: "sfd:create-count",
            params: { amount: 1, token: token("Sand Soldier", { might: 2, play: true }) },
          },
          {
            op: "reflexive",
            effect: {
              op: "cost_then",
              optional: true,
              cost: { power: { Order: 1 } },
              effect: { op: "ready", target: { targetRef: "created" } },
            },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Relentless Pursuit",
  text: '[Action] (Play on your turn or in showdowns.)\nMove a friendly unit. You may attach up to one Equipment with the same controller to it. This turn, that unit has "When I conquer, you may move me to my base."',
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "move",
            target: target({ controller: "self", targetRef: "target:0" }),
            to: { kind: "chosen", ref: "destination" },
          },
          {
            op: "attach",
            gear: {
              ...EQUIPMENT,
              chosen: true,
              maxCount: 1,
              targetRef: "target:1",
              where: custom("sfd:same-controller-as", { ref: "target:0" }),
            },
            to: { targetRef: "target:0" },
          },
          // The granted triggered ability for this turn, as a delayed trigger bound to that unit (393).
          {
            op: "delayed",
            trigger: {
              kind: "event",
              event: {
                type: "conquer",
                condition: custom("sfd:ref-present-at-event", { ref: "target:0" }),
              },
            },
            optional: true,
            duration: "this-turn",
            effect: { op: "move", target: { targetRef: "target:0" }, to: "base" },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Void Drone",
  text: "I cost [2] less to play from anywhere other than your hand.",
  status: "implemented",
  abilities: [
    whilePassive(custom("sfd:self-not-in-hand"), { kind: "cost", amount: -2, target: SELF }),
  ],
});

/* ---------------------------------------------------------------- Repeat spells */

registerCardScript({
  name: "Marching Orders",
  text: "[Action] (Play on your turn or in showdowns.)\n[Repeat][3] (You may pay the additional cost to repeat this spell's effect.)\nChoose a friendly unit anywhere and an enemy unit at a battlefield. They deal damage equal to their Mights to each other.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:0" } },
            target: target({ controller: "opponent", zone: "battlefield", targetRef: "target:1" }),
            source: target({ controller: "self", targetRef: "target:0" }),
          },
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:1" } },
            target: { targetRef: "target:0" },
            source: { targetRef: "target:1" },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Piercing Light",
  text: "[Repeat][2][Fury]  (You may pay the additional cost to repeat this spell's effect.)\nDeal 2 to a unit at a battlefield, then deal 2 to up to one other unit.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "deal", amount: 2, target: target({ zone: "battlefield", targetRef: "target:0" }) },
          {
            op: "deal",
            amount: 2,
            target: target({ maxCount: 1, targetRef: "target:1", excludeRefs: ["target:0"] }),
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Rocket Barrage",
  text: "[REPEAT][4][Mind] (You may pay the additional cost to repeat this spell's effect, and may make different choices.)\nChoose one —\n- Deal 4 to a unit in a base.\n- Kill a gear.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "deal",
            label: "Deal 4 to a unit in a base",
            effect: { op: "deal", amount: 4, target: target({ zone: "base" }) },
          },
          {
            id: "kill",
            label: "Kill a gear",
            effect: { op: "kill", target: { chosen: true, cardType: "gear" } },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Thwonk!",
  text: "[ACTION] (Play on your turn or in showdowns.)\n[REPEAT][2] (You may pay the additional cost to repeat this spell's effect.)\nStun an attacking unit. (It doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: { op: "stun", target: target({ where: custom("sfd:attacking", { ref: "it" }) }) },
    },
  ],
});

registerCardScript({
  name: "Hard Bargain",
  text: "[REACTION] (Play any time, even before spells and abilities resolve.)\n[REPEAT][2] (You may pay the additional cost to repeat this spell's effect.)\nCounter a spell unless its controller pays [2].",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "for_each",
            selector: { chosen: true, cardType: "spell", targetRef: "target:0" },
            effect: {
              op: "custom",
              id: "sfd:counter-unless-pay",
              params: { ref: "target:0", energy: 2 },
            },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Temptation",
  text: "[Repeat][2] (You may pay the additional cost to repeat this spell's effect.)\nMove an enemy unit to a location where there's a unit with the same controller.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "for_each",
            selector: target({ controller: "opponent", targetRef: "target:0" }),
            effect: { op: "custom", id: "sfd:move-to-ally-location", params: { ref: "target:0" } },
          },
        ],
      },
    },
  ],
});

/* ---------------------------------------------------------------- units */

registerCardScript({
  name: "Azir, Sovereign",
  text: "[ACCELERATE] (You may pay [1][Order] as an additional cost to have me enter ready.)\nWhen I attack, you may move any number of your token units to this battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "tokens",
            selector: {
              cardType: "unit",
              controller: "self",
              token: true,
              where: not(custom("sfd:ref-here", { ref: "it" })),
            },
            min: 0,
            max: 99,
          },
          { op: "move", target: { targetRef: "tokens" }, to: HERE_ZONE },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Glasc Mixologist",
  text: "[Deathknell] — You may play a unit with cost no more than [3] and no more than [Rune] from your trash, ignoring its cost. (When I die, get the effect.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "die", subject: SELF } },
      optional: true,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "revived",
            selector: {
              cardType: "unit",
              zone: "trash",
              owner: "self",
              energyCost: { op: "lte", value: 3 },
              powerCost: { op: "lte", value: 1 },
            },
            min: 1,
            max: 1,
          },
          { op: "play", target: { targetRef: "revived" }, cost: "ignored" },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Ornn, Blacksmith",
  text: "When you play me or when I hold, look at the top 4 cards of your Main Deck. You may reveal a gear from among them and draw it. Then recycle the rest.",
  status: "implemented",
  abilities: [
    ...[WHEN_PLAYED, WHEN_I_HOLD].map((trigger): Ability => ({
      kind: "triggered",
      trigger,
      effect: {
        op: "look",
        amount: 4,
        then: {
          op: "seq" as const,
          effects: [
            {
              op: "choose" as const,
              key: "found",
              selector: { zone: "deck" as const, cardType: "gear", where: IN_LOOKED },
              min: 0,
              max: 1,
            },
            { op: "reveal" as const, target: { targetRef: "found" } },
            { op: "custom" as const, id: "sfd:draw-ref", params: { ref: "found" } },
            {
              op: "recycle" as const,
              target: {
                zone: "deck" as const,
                where: {
                  kind: "and" as const,
                  conditions: [IN_LOOKED, not(custom("in-ref", { ref: "found" }))],
                },
              },
            },
          ],
        },
      },
    })),
  ],
});

registerCardScript({
  name: "Prize of Progress",
  text: "When you use an activated ability of a gear, give me +1 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "ability_activated",
          player: "self",
          condition: custom("sfd:event-source-gear"),
        },
      },
      effect: { op: "temporary_might", amount: 1, target: SELF },
    },
  ],
});

registerCardScript({
  name: "Renata Glasc, Mastermind",
  text: "[1][Mind]: Draw 1.\n[4][Mind][Mind][Mind][Mind], [Tap]: Score 1 point.\nUse my abilities only while I'm at a battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { energy: 1, power: { Mind: 1 } },
      effect: {
        op: "requires",
        condition: SELF_AT_BATTLEFIELD,
        rule: "377.2.b",
        effect: { op: "draw", amount: 1 },
      },
    },
    {
      kind: "activated",
      cost: { energy: 4, power: { Mind: 4 }, exhaust: SELF },
      effect: {
        op: "requires",
        condition: SELF_AT_BATTLEFIELD,
        rule: "377.2.b",
        effect: { op: "score_points", amount: 1 },
      },
    },
  ],
});

registerCardScript({
  name: "Renata Glasc, Industrialist",
  text: "Your tokens enter ready.",
  status: "partial",
  notes:
    'Unit tokens you play enter ready (369.3); gear tokens played "exhausted" (e.g. Gold) still enter exhausted — the `create` op only applies enter-ready replacements to units.',
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "custom",
        id: "enter-ready",
        params: { target: { token: true, controller: "self" } },
      },
    },
  ],
});

registerCardScript({
  name: "Renata Glasc, Chem-Baroness",
  text: "When you or an ally hold, you may exhaust me to play a Gold gear token exhausted.\nWhile your score is within 3 points of the Victory Score, your Gold [ADD] an additional [1].",
  status: "partial",
  notes:
    '"Your Gold [Add] an additional [1]": modifying the resources a token\'s Add ability produces (430.2) is not supported.',
  abilities: [
    ...notIntrinsic("Add"),
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "hold", condition: custom("sfd:event-player-friendly") },
      },
      effect: { op: "cost_then", optional: true, cost: { exhaust: SELF }, effect: gold() },
    },
  ],
});

registerCardScript({
  name: "Rumble, Hotheaded",
  text: "Your Mechs each have [Assault] (+1 [Might] while we're attackers.)\nWhen I conquer, you may recycle another friendly unit to play a Mech from your trash. Reduce its Energy cost by the Might of the unit you recycled.",
  status: "partial",
  notes:
    '"When I conquer, you may recycle another friendly unit to play a Mech from your trash, reducing its Energy cost by that unit\'s Might": the trigger is detected but resolves in the §6.4 manual window (effect plays cannot apply a computed cost reduction, 420.3/356.4).',
  abilities: [
    ...notIntrinsic("Assault"),
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Assault",
        target: { cardType: "unit", controller: "self", tag: "Mech" },
      },
    },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", subject: SELF } },
      optional: true,
      effect: MANUAL,
    },
  ],
});

registerCardScript({
  name: "Sivir, Battle Mistress",
  text: "When you recycle a rune, you may exhaust me to play a Gold gear token exhausted.\nWhen one or more enemy units die, ready me.",
  status: "partial",
  notes:
    '"When one or more enemy units die" triggers once per dying unit (simultaneous deaths are not batched into one trigger event, 383.1).',
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "recycle",
          player: "self",
          condition: custom("sfd:event-card-type", { type: "rune" }),
        },
      },
      effect: { op: "cost_then", optional: true, cost: { exhaust: SELF }, effect: gold() },
    },
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "die", subject: { cardType: "unit", controller: "opponent" } },
      },
      effect: { op: "ready", target: SELF },
    },
  ],
});

registerCardScript({
  name: "Irelia, Blade Dancer",
  text: "When you choose a friendly unit, you may exhaust me and pay [Rune] to ready it.\nWhen you conquer, you may pay [1] to ready me.",
  status: "partial",
  notes: `${CHOOSE_TRIGGER} The conquer trigger is automated.`,
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "ready", target: SELF },
      },
    },
  ],
});

registerCardScript({
  name: "Irelia, Fervent",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nWhen you choose or ready me, give me +1 [Might] this turn.",
  status: "partial",
  notes: `${CHOOSE_TRIGGER} "When you ready me" is automated for ready instructions (416); the Awaken step's ready-all (315.1) emits no per-unit event.`,
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "ready", subject: SELF } },
      effect: { op: "temporary_might", amount: 1, target: SELF },
    },
  ],
});

registerCardScript({
  name: "Soraka, Wanderer",
  text: "I must be assigned combat damage last.\nIf another unit you control here would die, if it has less Might than me, instead heal it, exhaust it, and recall it. (Send it to base. This isn't a move.)",
  status: "partial",
  notes:
    '"I must be assigned combat damage last" is exposed as the `assigned-last` modifier, which combat damage assignment (467.2.c) does not read yet.',
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "custom", id: "assigned-last", params: { target: SELF } },
    },
    {
      kind: "replacement",
      matches: {
        type: "kill",
        subject: {
          cardType: "unit",
          controller: "self",
          zone: HERE_ZONE,
          excludeSource: true,
          might: { op: "lt", value: { kind: "might", selector: SELF } },
        },
      },
      replace: {
        op: "seq",
        effects: [
          { op: "heal", amount: 999, target: EVENT_SUBJECT },
          { op: "exhaust", target: EVENT_SUBJECT },
          { op: "recall", target: EVENT_SUBJECT },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Ezreal, Dashing",
  text: "When I attack or defend, deal damage equal to my Might to an enemy unit here.\nI don't deal combat damage.\n[Mind]: [ACTION] — Move me to your base.",
  status: "partial",
  notes:
    "\"I don't deal combat damage\": no modifier removes a unit's combat damage (467.2.b) other than Stun.",
  abilities: [
    ...notIntrinsic("Action"),
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      effect: {
        op: "deal",
        amount: { kind: "might", selector: SELF },
        target: target({ controller: "opponent", zone: HERE_ZONE }),
        source: SELF,
      },
    },
    {
      kind: "activated",
      cost: { power: { Mind: 1 } },
      keywords: ["action"],
      effect: { op: "move", target: SELF, to: "base" },
    },
  ],
});

registerCardScript({
  name: "Azir, Emperor of the Sands",
  text: "Your Sand Soldiers have [Weaponmaster].\n[1], [Tap]: Play a 2 [Might] Sand Soldier unit token to your base. Use only if you've played an Equipment this turn.",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Weaponmaster"),
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Weaponmaster",
        target: named("Sand Soldier", { cardType: "unit", controller: "self" }),
      },
    },
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "requires",
        condition: custom("sfd:played-equipment-this-turn"),
        rule: "377.2.b",
        effect: {
          op: "create",
          token: token("Sand Soldier", { might: 2, play: true }),
          zone: "base",
        },
      },
    },
  ],
});

registerCardScript({
  name: "Vanguard Armory",
  text: "[Tap]: Play three 1 [Might] Recruit unit tokens. (You may play them to different locations.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: { op: "custom", id: "sfd:recruits-anywhere", params: { count: 3, token: "Recruit" } },
    },
  ],
});

registerCardScript({
  name: "Chemtech Cask",
  text: "When you play a spell on an opponent's turn, you may exhaust me to play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "played",
          player: "self",
          condition: {
            kind: "and",
            conditions: [
              custom("sfd:event-card-type", { type: "spell" }),
              { kind: "not", condition: { kind: "is-turn-player" } },
            ],
          },
        },
      },
      effect: { op: "cost_then", optional: true, cost: { exhaust: SELF }, effect: gold() },
    },
  ],
});

registerCardScript({
  name: "Bard, Mercurial",
  text: "You may exhaust your legend as an additional cost to play me. \n\nWhen you play me, if you paid the additional cost, move any number of your units to an open battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "movers",
            selector: { cardType: "unit", controller: "self" },
            min: 0,
            max: 99,
          },
          { op: "custom", id: "sfd:move-to-open-battlefield", params: { ref: "movers" } },
        ],
      },
    },
  ],
});
