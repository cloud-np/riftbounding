/**
 * Unleashed (UNL) R4 cards left to the §6.4 manual window.
 *
 * Each of these needs an engine capability that is still missing; the note names the exact rule
 * and the lane report's capability-gap table has the card lists.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Prepared Neophyte",
  text: "If you've spent [4] or more to play a spell this turn, I have +4 [might] .",
  status: "manual",
  notes:
    "Resources spent this turn are not tracked (Amount `spent`, 357, 166.2), so the conditional +4 Might cannot be applied.",
  abilities: [],
});

registerCardScript({
  name: "Shadow Watcher",
  text: "If a friendly unit died during your Beginning Phase this turn, I enter ready.",
  status: "manual",
  notes:
    "Per-turn history 'a friendly unit died during your Beginning Phase this turn' is not tracked (383.1.b, 429).",
  abilities: [],
});

registerCardScript({
  name: "Towering Pairofant",
  text: "[Assault] (+1[Might] while I'm an attacker.)\nIf a unit died this turn, I enter ready.",
  status: "manual",
  notes:
    "[Assault] is a printed keyword. 'If a unit died this turn, I enter ready' needs per-turn death history (383.1.b, 429), which is not tracked.",
  abilities: [],
});

registerCardScript({
  name: "Bone Skewer",
  text: "[Hidden] (Hide now for [A] to react with later for [0].)\nChoose a battlefield. An opponent reveals their hand. You may choose a unit from it. They play that unit to that battlefield, ignoring any and all costs. If they do, then do this: [Stun] it. (It doesn't deal combat damage this turn.)",
  status: "manual",
  notes:
    "Revealing a hand, choosing a unit among it and making that opponent play it ignoring costs needs effect-driven plays by another player (355.7, 420.3, 425); [Hidden] is a printed keyword.",
  abilities: [],
});

registerCardScript({
  name: "Conscription",
  text: "You may spend 5 XP as an additional cost to play this.\nChoose an enemy unit at a battlefield with 3  or less. If you paid the additional cost, choose any enemy unit at a battlefield instead. Take control of it, exhaust it, and recall it.",
  status: "manual",
  notes:
    "Taking control of a unit is not implemented (435). The alternative target (3 Might or less / any) also reads the optional-cost choice (355.1.a).",
  abilities: [],
});

registerCardScript({
  name: "Heedless Resurrection",
  text: "[Reaction] (Play at any time, even before spells and abilities resolve.)\nAs an additional cost to play this, kill a friendly unit.\nPlay a unit from the trash that costs no more Energy and no more Power that the killed unit, ignoring its cost.",
  status: "manual",
  notes:
    "Playing a card from the Trash for an effect (420.3, 354) and comparing the killed unit's printed cost are not implemented; [Reaction] is a printed keyword.",
  abilities: [],
});

registerCardScript({
  name: "Lotus Trap",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a unit. Double all damage that would be dealt to it this turn.",
  status: "manual",
  notes:
    "Damage doubling is a replacement effect that is not expressible (433.1.b, `double` returns manual for damage); [Hidden] and [Reaction] are printed keywords.",
  abilities: [],
});

registerCardScript({
  name: "Mageseeker Investigator",
  text: "Opponents must pay [Rune] for each unit beyond the first to move multiple units to my battlefield at the same time.",
  status: "manual",
  notes:
    "Movement taxes / player-scoped move restrictions are not implemented (451, 054.1); moving several units at once is not a Standard Move.",
  abilities: [],
});

registerCardScript({
  name: "Syndra, Transcendent",
  text: "While I'm in a showdown, your spells have [Repeat] . (You may pay the additional cost to repeat the spell's effect.)",
  status: "manual",
  notes:
    "Granting [Repeat] to spells is not implemented (820); the play layer reads Repeat from printed text only.",
  abilities: [],
});

registerCardScript({
  name: "Determined Sentry",
  text: "I can't move to base.",
  status: "manual",
  notes:
    "A destination-qualified move restriction ('can't move to base') cannot be expressed: the restriction layer knows the mover and the destination only as a plain query and has no destination filter (055, 421).",
  abilities: [],
});

registerCardScript({
  name: "Undying Loyalty",
  text: "This costs [2] less if you choose a Bird, Cat, Dog or Poro.\nPlay a unit with cost no more than [2] and no more than [Rune] from your trash, ignoring its cost.",
  status: "manual",
  notes:
    "Playing a unit from the Trash for an effect (420.3, 354) is not implemented; the discount also reads a choice (356.2.b.1).",
  abilities: [],
});

registerCardScript({
  name: "Zilean, Time Mage",
  text: "Once each turn, if you would play a token unit while I'm at a battlefield, you may play that token and an additional copy of it instead.",
  status: "manual",
  notes:
    "Replacing a token play with two token plays (a replacement of the play event, 375/186) is not implemented.",
  abilities: [],
});

registerCardScript({
  name: "Frigid Jewel",
  text: "When you draw your second card each turn, give a friendly unit +2 [might] this turn.",
  status: "manual",
  notes:
    "The Nth-card-drawn-per-turn history is not tracked (429); the trigger cannot be detected without it.",
  abilities: [],
});

registerCardScript({
  name: "The List",
  text: "As you play this, name a tag. (For example, Miss Fortune, Demacia, and Poro are tags.)\n[Tap]: Give a unit with the named tag -2 [Might] this turn.",
  status: "manual",
  notes:
    "Naming a tag as a play-time choice and remembering it on the gear (143) is not implemented; neither is reading the named tag from an activated ability.",
  abilities: [],
});

registerCardScript({
  name: "Forgotten Signpost",
  text: "[Action]  Exhaust a unit you control, [tap] : Move a different unit you control to the location of the unit you exhausted to pay for this ability.",
  status: "manual",
  notes:
    "The activated ability exhausts two objects (a chosen unit and itself): `Cost.exhaust` holds one selector (357.2), and the effect must read the cost object's location.",
  abilities: [],
});

registerCardScript({
  name: "Forgotten Library",
  text: "While you control this battlefield, when you play a spell, if you spend [4] or more [predict] . (Look at the top card of your Main Deck. You may recycle it.)",
  status: "manual",
  notes:
    "Resources spent this turn are not tracked (Amount `spent`, 357, 166.2); the spell trigger cannot be gated on the amount spent.",
  abilities: [],
});

registerCardScript({
  name: "Gardens of Becoming",
  text: "Units here have \"[Tap]: Gain 1 XP.\"",
  status: "manual",
  notes:
    "Granting an activated ability to other objects is not implemented (135, 143).",
  abilities: [],
});

registerCardScript({
  name: "The Academy",
  text: "When you hold here, give your next spell this turn [repeat] equal to its base cost. (You may pay the additional cost to repeat the spell's effect.)",
  status: "manual",
  notes:
    "Granting [Repeat] to the next spell (and deriving its cost from the spell's base cost) is not implemented (820, 420.5).",
  abilities: [],
});

registerCardScript({
  name: "Trapping Grounds",
  text: "When you conquer here, if you assigned 3 or more excess damage, play a 1 [might] Bird unit token with [Deflect] .",
  status: "manual",
  notes:
    "Excess damage assigned in combat is not recorded (467.2.c.4), so the intervening condition cannot be checked.",
  abilities: [],
});

registerCardScript({
  name: "Jhin, Virtuoso",
  text: "When you play a spell, if you spent [4] or more, you may banish it. Then, if there are four spells banished with me, put each in its trash, channel 4 runes, and draw 1.",
  status: "manual",
  notes:
    "Resources spent this turn are not tracked (357, 166.2) and spells banished 'with me' are not remembered (428).",
  abilities: [],
});

registerCardScript({
  name: "Vi, Piltover Enforcer",
  text: "When you conquer, if you assigned 3 or more excess damage, you may exhaust me to ready a unit.",
  status: "manual",
  notes:
    "Excess damage assigned in combat is not recorded (467.2.c.4), so the intervening condition cannot be checked.",
  abilities: [],
});

registerCardScript({
  name: "Ivern, Green Father",
  text: "When you conquer or hold, you may exhaust me to replace that battlefield with a Brush battlefield token. (Bird, Cat, Dog, Poro, and Ivern units have +1 [might] in Brush. It can be swapped back when scored.)",
  status: "manual",
  notes:
    "Replacing a battlefield with a battlefield token (186) is not implemented; the Brush token's Might passive exists but battlefield replacement does not.",
  abilities: [],
});
