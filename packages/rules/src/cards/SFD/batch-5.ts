/**
 * Spiritforged (SFD) — wave R3 batch 5: cost passives, control changes, play-from-elsewhere,
 * reveal-and-banish cards, and the cards whose text needs engine capabilities that do not exist
 * yet (partial / manual, with the missing capability named).
 */
import type { Selector } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { SELF, WHEN_PLAYED, aUnit, custom } from "../dsl";
import { HERE_ZONE, WHEN_I_ATTACK, WHEN_YOU_CONQUER, whilePassive } from "./common";

const EQUIPMENT: Selector = { cardType: "gear", tag: "Equipment" };

registerCardScript({
  name: "Ornn's Forge",
  text: "While you control this battlefield, the first friendly non-token gear played each turn costs [1] less.",
  status: "implemented",
  abilities: [
    whilePassive(
      {
        kind: "and",
        conditions: [
          custom("sfd:controls-source-battlefield"),
          custom("sfd:no-nontoken-gear-played-this-turn"),
        ],
      },
      {
        kind: "custom",
        id: "cost-adjust",
        params: { energy: -1, target: { cardType: "gear", controller: "self", token: false } },
      },
    ),
  ],
});

registerCardScript({
  name: "Card Sharp",
  text: "When you play me, you and each opponent may play a Gold gear token exhausted. For each opponent who did, you play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "custom", id: "sfd:card-sharp" } },
  ],
});

registerCardScript({
  name: "Hostile Takeover",
  text: "[Hidden] (Hide now for [Power] to react with later for [0].) \n\nTake control of an enemy unit at a battlefield. \nReady it. (Start a combat if other enemies are there. Otherwise, conquer.)\nLose control of that unit and recall it at end of turn. (Send it to base. This isn't a move.)",
  status: "partial",
  notes:
    'The reminder "(Start a combat if other enemies are there. Otherwise, conquer.)": taking control of a unit at a battlefield does not start a showdown/combat or establish control for a conquer (463, 468.5, 471); the control change, ready and end-of-turn release are automated.',
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "opponent", zone: "battlefield" }),
        effect: {
          op: "seq",
          effects: [
            { op: "custom", id: "sfd:take-control", params: { target: { targetRef: "it" } } },
            { op: "ready", target: { targetRef: "it" } },
            { op: "custom", id: "sfd:release-at-end-of-turn", params: { ref: "it" } },
          ],
        },
      },
    },
  ],
});

registerCardScript({
  name: "Arcane Shift",
  text: "[Action] (Play on your turn or in showdowns.)\nBanish a friendly unit, then its owner plays it, ignoring its cost. Deal 3 to an enemy unit at a battlefield. Banish this.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "custom", id: "sfd:bind", params: { from: "target:0", to: "shifted" } },
          { op: "banish", target: { targetRef: "target:0" } },
          { op: "play", target: { targetRef: "shifted" }, cost: "ignored" },
          {
            op: "deal",
            amount: 3,
            target: aUnit({ controller: "opponent", zone: "battlefield", targetRef: "target:1" }),
          },
          { op: "custom", id: "sfd:banish-this-spell" },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Azir, Ascendant",
  text: "[Calm]: [Action] — Choose a unit you control. Move me to its location and it to my original location. If it's equipped, you may attach one of its Equipment to me. Use only once per turn.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      keywords: ["action"],
      cost: { power: { Calm: 1 } },
      limit: { kind: "once-per-turn" },
      effect: {
        op: "seq",
        effects: [
          {
            op: "swap",
            a: SELF,
            b: aUnit({ controller: "self", targetRef: "target:0" }),
            property: "zone",
          },
          {
            op: "if",
            condition: {
              kind: "exists",
              selector: { ...EQUIPMENT, where: custom("sfd:it-attached-to", { ref: "target:0" }) },
            },
            then: {
              op: "may",
              label: "Attach one of its Equipment to me?",
              effect: {
                op: "attach",
                gear: {
                  ...EQUIPMENT,
                  pick: "controller",
                  where: custom("sfd:it-attached-to", { ref: "target:0" }),
                },
                to: SELF,
              },
            },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Rell, Magnetic",
  text: "[Tank] (I must be assigned combat damage first.)\nWhen I attack, you may play an Equipment with Energy cost no more than [2], ignoring its cost. If you do, then do this: Attach it to me.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      optional: true,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "equipment",
            selector: {
              ...EQUIPMENT,
              zone: "hand",
              owner: "self",
              energyCost: { op: "lte", value: 2 },
            },
            min: 1,
            max: 1,
          },
          { op: "play", target: { targetRef: "equipment" }, cost: "ignored" },
          {
            op: "if",
            condition: custom("did"),
            then: {
              op: "reflexive",
              effect: { op: "attach", gear: { targetRef: "equipment" }, to: SELF },
            },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Here to Help",
  text: "[HIDDEN]  (Hide now for [Rune] to react with later for [0].)\n[ACTION] (Play on your turn or in showdowns.)\n\nYou may play a unit from hand to a battlefield you control, reducing its cost by [3].",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "unit",
            selector: { cardType: "unit", zone: "hand", owner: "self" },
            min: 0,
            max: 1,
          },
          {
            op: "custom",
            id: "sfd:play-card",
            params: {
              target: { targetRef: "unit" },
              energy: 3,
              location: "controlled-battlefield",
            },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Void Rush",
  text: "Reveal the top 2 cards of your Main Deck. You may banish one, then play it, reducing its cost by [2]. Draw any you didn't banish.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "custom",
        id: "sfd:reveal-banish-play",
        params: { reveal: 2, reduce: 2, rest: "draw" },
      },
    },
  ],
});

registerCardScript({
  name: "Rek'Sai, Void Burrower",
  text: "When you conquer, you may exhaust me to reveal the top 2 cards of your Main Deck. You may banish one, then play it. Recycle the rest.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { exhaust: SELF },
        effect: {
          op: "custom",
          id: "sfd:reveal-banish-play",
          params: { reveal: 2, rest: "recycle" },
        },
      },
    },
  ],
});

registerCardScript({
  name: "Fizz, Trickster",
  text: "When you play me, you may play a spell from your trash with Energy cost no more than [3], ignoring its Energy cost. Then recycle it. (You must still pay its Power cost.)",
  status: "partial",
  notes:
    '"Then recycle it": a spell played from the trash goes back to the trash after it resolves; there is no hook that recycles a played card as it finishes resolving (417, 420.3, 401), so recycling it is left to the manual window.',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "spell",
            selector: {
              cardType: "spell",
              zone: "trash",
              owner: "self",
              energyCost: { op: "lte", value: 3 },
            },
            min: 1,
            max: 1,
          },
          {
            op: "custom",
            id: "sfd:play-card",
            params: { target: { targetRef: "spell" }, energy: "ignore" },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Jayce, Man of Progress",
  text: "When you play me, you may kill a friendly gear. If you do, you may play a gear with Energy cost no more than [7] from hand this turn, ignoring its Energy cost. (You must still pay its Power cost.)",
  status: "partial",
  notes:
    '"You may play a gear … from hand this turn": the permission is not kept for the rest of the turn (no turn-long play permission, 420.3); the gear is chosen and played immediately while the trigger resolves, with its Power cost paid (356.1.b.1).',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "seq",
        effects: [
          {
            op: "kill",
            target: aUnit({ cardType: "gear", controller: "self", targetRef: "target:0" }),
          },
          {
            op: "if",
            condition: custom("did"),
            then: {
              op: "seq",
              effects: [
                {
                  op: "choose",
                  key: "gear",
                  selector: {
                    cardType: "gear",
                    zone: "hand",
                    owner: "self",
                    energyCost: { op: "lte", value: 7 },
                  },
                  min: 0,
                  max: 1,
                },
                {
                  op: "custom",
                  id: "sfd:play-card",
                  params: { target: { targetRef: "gear" }, energy: "ignore" },
                },
              ],
            },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Rek'Sai, Swarm Queen",
  text: "When I attack, you may reveal the top 2 cards of your Main Deck. You may banish one, then play it. If it is a unit, you may play it here. Recycle the rest.",
  status: "partial",
  notes:
    '"If it is a unit, you may play it here": a banished unit is always played here when that is possible; the choice of playing it to base instead (355.2.b) is not offered.',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      optional: true,
      effect: {
        op: "custom",
        id: "sfd:reveal-banish-play",
        params: { reveal: 2, rest: "recycle", location: HERE_ZONE },
      },
    },
  ],
});

registerCardScript({
  name: "Vex, Cheerless",
  text: "While I'm in combat, friendly spells cost [1][Rune] less to a minimum of [1], and enemy spells cost [1][Rune] more.",
  status: "partial",
  notes:
    "Friendly spells cost [1][Rune] less while I'm in combat; \"to a minimum of [1]\" is not enforced (356.6 floors at 0), and the increase for enemy spells is not applied: cost passives only affect their controller's plays (366.2, 475-479).",
  abilities: [
    whilePassive(custom("sfd:self-in-combat"), {
      kind: "custom",
      id: "cost-adjust",
      params: { energy: -1, power: { any: -1 }, target: { cardType: "spell", controller: "self" } },
    }),
  ],
});

registerCardScript({
  name: "Jax, Unmatched",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nYour Equipment everywhere have [Quick-Draw]. (Each gains [Reaction]. When you play it, attach it to a unit you control.)",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Quick-Draw",
        target: { ...EQUIPMENT, controller: "self" },
      },
    },
  ],
});

registerCardScript({
  name: "Rek'Sai, Breacher",
  text: "[ACCELERATE] (You may pay [1] [Fury] as an additional cost to have me enter ready.)\n[ASSAULT] (+1 [Might] while I'm an attacker.)\nFriendly units played from anywhere other than a player's hand have [ACCELERATE]",
  status: "partial",
  notes:
    '"Friendly units played from anywhere other than a player\'s hand have [Accelerate]": the grant applies as a unit is played from the trash/banishment/deck, which no passive can express (366.2, 727.1.b); only the printed Accelerate and Assault are automated.',
  abilities: [],
});

registerCardScript({
  name: "Sivir, Mercenary",
  text: "[Accelerate] (You may pay [1][Chaos] as an additional cost to have me enter ready.)\nIf you've spent at least [Rune][Rune] this turn, I have +2 [Might] and [Ganking]. (I can move from battlefield to battlefield.)",
  status: "partial",
  notes:
    '"If you\'ve spent at least [Rune][Rune] this turn, I have +2 [Might] and [Ganking]": resources spent this turn are not tracked (amount kind `spent` evaluates to 0, 165/167); only the printed Accelerate and Ganking keyword are automated.',
  abilities: [],
});

registerCardScript({
  name: "Sivir, Ambitious",
  text: "[Deflect 2] (Opponents must pay [Rune][Rune] to choose me with a spell or Ability.)\nWhen I conquer after an attack, if you assigned 5 or more excess damage to enemy units, you may deal that much to an enemy unit.",
  status: "partial",
  notes:
    '"When I conquer after an attack, if you assigned 5 or more excess damage to enemy units, you may deal that much": excess combat damage assigned is not recorded (467.2); only Deflect 2 is automated.',
  abilities: [],
});

registerCardScript({
  name: "Tianna Crownguard",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nWhile I'm at a battlefield, opponents can't gain points.",
  status: "partial",
  notes:
    "\"While I'm at a battlefield, opponents can't gain points\": score restrictions are evaluated without a subject, so no passive restriction can match (470, restrictions.ts requires an object); only Deflect is automated.",
  abilities: [],
});

registerCardScript({
  name: "Yone, Blademaster",
  text: "[Weaponmaster] (When you play me, you may [Equip] one of your Equipment to me for [Rune] less, even if it's already attached.)\nWhen I conquer a battlefield that was uncontrolled, deal damage equal to my Might to an enemy unit in a base.",
  status: "partial",
  notes:
    '"When I conquer a battlefield that was uncontrolled, deal damage equal to my Might to an enemy unit in a base": the conquer event does not record whether the battlefield was uncontrolled (468.5, 471). Weaponmaster is the engine\'s.',
  abilities: [],
});

registerCardScript({
  name: "Akshan, Mischievous",
  text: "[Weaponmaster]\nYou may pay [Body][Body] as an additional cost to play me.\nWhen you play me, if you paid the additional cost, move an enemy gear to your base. You control it until I leave the board. If it's an Equipment, attach it to me.",
  status: "partial",
  notes:
    'The optional [Body][Body] additional cost is not a payable Cost (357.2), and "You control it until I leave the board" (a delayed passive tied to another object\'s presence, 391.4) is not supported. Weaponmaster is the engine\'s.',
  abilities: [],
});

registerCardScript({
  name: "Rengar, Pouncing",
  text: "[REACTION] (Play any time, even before spells and abilities resolve, including to a battlefield you control.)\n[ASSAULT 2] (+2 [Might] while I'm an attacker)\nI can be played to a battlefield you're attacking.",
  status: "partial",
  notes:
    '"I can be played to a battlefield you\'re attacking": per-card play locations are not supported (355.2.b, 355.17); only the printed Reaction and Assault 2 are automated.',
  abilities: [],
});

registerCardScript({
  name: "Gearhead",
  text: "[Accelerate] (You may pay [1][Mind] as an additional cost to have me enter ready.)\nEach Equipment attached to me gives double its base Might bonus.",
  status: "partial",
  notes:
    '"Each Equipment attached to me gives double its base Might bonus": an Equipment\'s Might bonus is not readable as an amount, so the doubling cannot be expressed (718.4); only the printed Accelerate is automated.',
  abilities: [],
});

registerCardScript({
  name: "Needlessly Large Yordle",
  text: "[Shield 5] (+5 [Might] while I'm a defender.)\n[TANK] (I must be assigned combat damage first.)\nI cost [2][Calm] less for each point you scored from holding this turn.",
  status: "partial",
  notes:
    '"I cost [2][Calm] less for each point you scored from holding this turn": points scored from holding are not tracked separately from conquering (472, 356.4); only the printed Shield 5 and Tank are automated.',
  abilities: [],
});

registerCardScript({
  name: "Ancient Henge",
  text: "[Tap]: [Reaction] — Pay any amount of Energy to [Add] that much [Rune]. (Abilities that add resources can't be reacted to.)",
  status: "manual",
  notes:
    '"Pay any amount of Energy to [Add] that much Rune": a variable-amount cost converted into resources has no cost/amount form (357, 165); the Reaction Add ability resolves in the manual window.',
  abilities: [],
});

registerCardScript({
  name: "Hextech Anomaly",
  text: "[Tap]: [Reaction] — Pay any amount of [Rune] to [Add] that much Energy. (Abilities that add resources can't be reacted to.)",
  status: "manual",
  notes:
    '"Pay any amount of [Rune] to [Add] that much Energy": a variable-amount cost converted into resources has no cost/amount form (357, 165); the Reaction Add ability resolves in the manual window.',
  abilities: [],
});

registerCardScript({
  name: "Assembly Rig",
  text: "[1][Fury], Recycle a unit from your trash, [Tap]: Play a 3  Mech unit token to your base.",
  status: "manual",
  notes:
    'Its cost "Recycle a unit from your trash" is not a payable cost in the engine (cost-text unsupported, 203.3, 417.6).',
  abilities: [],
});

registerCardScript({
  name: "Black Market Broker",
  text: "When you play a card from face down, play a Gold gear token exhausted.",
  status: "manual",
  notes:
    '"When you play a card from face down": playing from face down (811) is not recorded on the play events, so the trigger cannot be detected (811.1.b, 420.4).',
  abilities: [],
});

registerCardScript({
  name: "Dauntless Vanguard",
  text: "You may play me to an occupied enemy battlefield.",
  status: "manual",
  notes:
    '"You may play me to an occupied enemy battlefield": per-card play locations are not supported (355.2.b, 355.17).',
  abilities: [],
});

registerCardScript({
  name: "Ezreal, Prodigal Explorer",
  text: "[Tap]: [REACTION] — Draw 1. Use only if you've chosen enemy units and/or gear twice this turn with spells or unit abilities.",
  status: "manual",
  notes:
    '"Use only if you\'ve chosen enemy units and/or gear twice this turn with spells or unit abilities": the number of choices made per turn is not tracked (355.7).',
  abilities: [],
});

registerCardScript({
  name: "Forge of the Fluft",
  text: 'While you control this battlefield, friendly legends have "[Tap]: Attach an Equipment you control to a unit you control."',
  status: "manual",
  notes:
    "\"Friendly legends have '[Tap]: Attach an Equipment you control to a unit you control'\": passives cannot grant activated abilities to other objects (366, 718).",
  abilities: [],
});

registerCardScript({
  name: "Forgotten Monument",
  text: "Players can't score here until their third turn.",
  status: "manual",
  notes:
    '"Players can\'t score here until their third turn": score restrictions are evaluated without a subject, so no passive restriction can match (470, 054.1), and turn counts per player are not tracked.',
  abilities: [],
});

registerCardScript({
  name: "Irelia, Graceful",
  text: "Your spells that choose me cost [1] or [Rune] less.",
  status: "manual",
  notes:
    '"Your spells that choose me cost [1] or [Rune] less": a cost passive cannot see the chosen targets of the spell being played (356.4, 355.7), and the component discount is not expressible (356.4.c).',
  abilities: [],
});

registerCardScript({
  name: "Jae Medarda",
  text: "When you choose me with a spell, draw 1.",
  status: "manual",
  notes:
    '"When you choose me with a spell, draw 1": choosing objects with spells/abilities (355.7) emits no event the trigger layer can match.',
  abilities: [],
});

registerCardScript({
  name: "Legion Quartermaster",
  text: "As an additional cost to play me, return a friendly gear to its owner's hand.",
  status: "manual",
  notes:
    '"As an additional cost to play me, return a friendly gear to its owner\'s hand": a non-standard additional cost is not payable (357.2, 356.2).',
  abilities: [],
});

registerCardScript({
  name: "Marai Spire",
  text: "While you control this battlefield, friendly [Repeat] costs cost [1] less.",
  status: "manual",
  notes:
    '"Friendly [Repeat] costs cost [1] less": Repeat costs are not a cost component the cost layer can adjust (356.4.c, 820.1).',
  abilities: [],
});

registerCardScript({
  name: "Minotaur Reckoner",
  text: "Units can't move to base.",
  status: "manual",
  notes:
    '"Units can\'t move to base": a move restriction ignores the destination of the move (restrictionFor does not read `to`, 054.1, 421).',
  abilities: [],
});

registerCardScript({
  name: "Ornn, Fire Below the Mountain",
  text: "[Tap]: [REACTION] — [ADD] [Rune]. Use only to play gear or use gear abilities. (Abilities that add resources can't be reacted to.)",
  status: "manual",
  notes:
    '"[Add] [Rune]. Use only to play gear or use gear abilities": resources restricted to certain uses have no representation in the Rune Pool (165, 167).',
  abilities: [],
});

registerCardScript({
  name: "Perched Grimwyrm",
  text: "Play me only to a battlefield you conquered this turn. (You can't play me anywhere else.)",
  status: "manual",
  notes:
    '"Play me only to a battlefield you conquered this turn": per-card play-location requirements are not supported (355.2.b, 355.17).',
  abilities: [],
});

registerCardScript({
  name: "Rockfall Path",
  text: "Units can't be played here.",
  status: "manual",
  notes:
    '"Units can\'t be played here": a play restriction cannot see the location a unit is played to (054.1, 355.2).',
  abilities: [],
});

registerCardScript({
  name: "Spirit Wheel",
  text: "When you choose a friendly unit, you may pay [1] and exhaust this to draw 1.",
  status: "manual",
  notes:
    '"When you choose a friendly unit": choosing objects with spells/abilities (355.7) emits no event the trigger layer can match.',
  abilities: [],
});

registerCardScript({
  name: "Temporal Portal",
  text: "[Rune], [Tap]: Give the next spell you play this turn [Repeat] equal to its cost. (You may pay the additional cost to repeat the spell's effect.)",
  status: "manual",
  notes:
    '"Give the next spell you play this turn [Repeat] equal to its cost": granting Repeat with a computed value to a future play is not supported (820.1, 420.5).',
  abilities: [],
});

registerCardScript({
  name: "Void Hatchling",
  text: "If you would reveal cards from a deck, look at the top card first. You may recycle it. Then reveal those cards.",
  status: "manual",
  notes:
    '"If you would reveal cards from a deck, look at the top card first": a replacement of reveal events (425, 375) is not supported by the interceptor.',
  abilities: [],
});
