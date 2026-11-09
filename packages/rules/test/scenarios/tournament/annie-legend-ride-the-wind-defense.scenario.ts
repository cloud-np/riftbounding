import { defineScenario } from "../format";

export default defineScenario({
  title:
    "Annie's legend readies 2 runes at end of turn; Ride the Wind joins the defense on the opponent's turn",
  event: "Riftbound Regional Qualifier Houston (Annie) vs RQ Bologna (Ezreal) decklists",
  verification: "illustrative",
  sources: [
    {
      label:
        "Annie, Dark Child — RQ Houston 1st place (Dhawally) decklist: Annie, Stubborn, Ride the Wind, Cleave, Pouty Poro",
      url: "https://mobalytics.gg/riftbound/decks/annie-dark-child-1st-houston-regional-qualifier-dhawally",
    },
    {
      label:
        "Annie, Dark Child deck guide — 1st place, Regional Qualifier Houston (spell recursion with Annie, Stubborn)",
      url: "https://animealley.ca/blogs/the-synergy-lab/annie-dark-child-riftbound-deck-guide",
    },
    {
      label:
        "Ezreal, Prodigal Explorer — RQ Bologna 1st place (Alanzq1) decklist: Ezreal, Prodigy, Void Gate",
      url: "https://mobalytics.gg/riftbound/decks/ezreal-prodigal-explorer-bologna-regional-qualifier-1st-alanzq1",
    },
  ],
  notes:
    'Not a real game; cards from the cited top-cut lists (search-result snippets); P1\'s battlefield (Altar to Unity) is not from the Annie list. The line is invented around the deck\'s documented plan (spell recursion): Annie, Stubborn\'s play trigger ("When you play me, return a spell from your trash to your hand."), the legend\'s end-of-turn trigger (Annie, Dark Child: "At the end of your turn, ready up to 2 runes.") and an [Action] spell played in the opponent\'s combat showdown (Ride the Wind: "Move a friendly unit and ready it.") so the unit becomes a Defender (466.2.c.3.a).',
  rules: ["355.5.b", "317", "347", "466.2.c.3.a", "164.2"],
  tags: ["legend", "trigger", "showdown", "combat", "turn-cycle"],
  position: {
    turn: { player: "P1", number: 10 },
    battlefields: [
      { name: "Altar to Unity", controller: "P1", units: { P1: ["Pouty Poro"] } },
      {
        name: "Void Gate",
        controller: "P2",
        units: { P2: [{ name: "Ezreal, Prodigy", label: "Ezreal (Void Gate)" }] },
      },
    ],
    players: {
      P1: {
        legend: "Annie, Dark Child",
        points: 6,
        hand: ["Annie, Stubborn"],
        trash: ["Ride the Wind", "Cleave"],
        runes: { ready: { Fury: 3, Chaos: 2 } },
      },
      P2: {
        legend: "Ezreal, Prodigal Explorer",
        points: 6,
        base: [{ name: "Ezreal, Prodigy", label: "Ezreal (base)" }],
        runes: { ready: { Chaos: 3, Mind: 2 } },
      },
    },
  },
  steps: [
    {
      by: "P1",
      play: "Annie, Stubborn",
      note: "[4] + [Chaos]: four runes exhausted, one of them recycled for the Power (exhausted runes are recycled first)",
      expect: {
        units: { "Annie, Stubborn": { at: "base" } },
        chain: ["Annie, Stubborn (trigger)"],
        zones: { P1: { runes: { ready: 1, total: 4 } } },
      },
    },
    {
      by: "P1",
      choose: "Ride the Wind",
      note: "the trigger's target (355.5.b: chosen when it triggers, not when Annie was played)",
      expect: { chain: ["Annie, Stubborn (trigger)"], priority: "P1" },
    },
    {
      settle: true,
      expect: { chain: [], zones: { P1: { hand: ["Ride the Wind"], trash: ["Cleave"] } } },
    },
    {
      by: "P1",
      endTurn: true,
      note: "Annie, Dark Child triggers at the end of P1's turn",
      expect: {
        chain: ["Annie, Dark Child (trigger)"],
        prompt: { kind: "choose-target", for: "P1" },
      },
    },
    {
      by: "P1",
      choose: ["Fury Rune@P1", "Fury Rune@P1"],
      note: "ready up to 2 runes: two of P1's exhausted Fury runes",
    },
    {
      settle: true,
      note: "P2's turn begins: P2 Holds Void Gate (315.2.b); P1 keeps two ready Fury runes and a ready Chaos rune",
      expect: {
        turnPlayer: "P2",
        points: { P2: 7 },
        zones: { P1: { runes: { ready: 3, exhausted: 1 } } },
      },
    },
    {
      by: "P2",
      move: "Ezreal (base)",
      to: "Altar to Unity",
      expect: { combat: { at: "Altar to Unity", attacker: "P2", defender: "P1" }, focus: "P2" },
    },
    { by: "P2", pass: true, expect: { focus: "P1", state: "showdown_open" } },
    {
      by: "P1",
      play: "Ride the Wind",
      targets: ["Annie, Stubborn", "Altar to Unity"],
      note: "an [Action] is legal for the Focus holder in an Open showdown, even on the opponent's turn; [2] + [Chaos]: the Chaos rune is exhausted for [1], then recycled for the Power",
      expect: {
        chain: ["Ride the Wind"],
        priority: "P2",
        zones: { P1: { runes: { ready: 1, total: 3 } } },
      },
    },
    {
      by: "P2",
      pass: true,
      note: "Annie, Stubborn moves in ready and becomes a Defender (466.2.c.3.a)",
      expect: {
        chain: [],
        units: { "Annie, Stubborn": { at: "Altar to Unity", exhausted: false } },
      },
    },
    { settle: true, expect: { prompt: { kind: "damage-assignment", for: "P2" } } },
    { by: "P2", assign: { "Annie, Stubborn": 3 } },
    { settle: true },
    {
      check: {
        dead: ["Ezreal (base)", "Annie, Stubborn"],
        alive: ["Pouty Poro", "Ezreal (Void Gate)"],
        control: { "Altar to Unity": "P1", "Void Gate": "P2" },
        points: { P1: 6, P2: 7 },
        combat: null,
        zones: { P1: { trash: ["Cleave", "Ride the Wind", "Annie, Stubborn"] } },
      },
      note: "5 defending Might beats Ezreal's 3: P2 does not conquer and stays one point short",
    },
  ],
});
