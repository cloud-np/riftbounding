import { defineScenario } from "../format";

export default defineScenario({
  title: "Combat showdown with responses: Rebuke bounces Annie, Cleave waits for the Open State",
  event: "Riftbound Regional Qualifier Houston (Annie) vs RQ Bologna (Ezreal) decklists",
  verification: "illustrative",
  sources: [
    {
      label:
        "Annie, Dark Child — RQ Houston 1st place (Dhawally) decklist: Annie, Stubborn, Cleave, Pouty Poro",
      url: "https://mobalytics.gg/riftbound/decks/annie-dark-child-1st-houston-regional-qualifier-dhawally",
    },
    {
      label: "Riot: From Garen to Annie, RQ Houston's Top Decks (event coverage)",
      url: "https://riftbound.leagueoflegends.com/en-us/news/announcements/from-garen-to-annie-rq-houstons-top-decks",
    },
    {
      label:
        "Ezreal, Prodigal Explorer — RQ Bologna 1st place (Alanzq1) decklist: Ezreal, Prodigy, Rebuke, Void Gate",
      url: "https://riftdecks.com/riftbound-metagame/deck-ezreal-prodigal-explorer-92125",
    },
  ],
  notes:
    "Not a real game. Every card is from the cited top-cut lists (search-result snippets); P1's battlefield (Altar to Unity) is not from the Annie list. The line is a common competitive pattern invented to exercise a combat showdown with responses: the defender's Action (Rebuke) closes the state, the attacker's Action (Cleave) is refused until the chain resolves (309.1.a), and Assault only counts while attacking (Cleave: \"Give a unit [ASSAULT 3] this turn. (+3 [Might] while it's an attacker.)\").",
  rules: ["309.1", "309.1.a", "466.2.c.1.a", "347", "467.2", "468.5"],
  tags: ["showdown", "chain", "closed-state", "combat", "keyword"],
  position: {
    turn: { player: "P1", number: 8 },
    battlefields: [
      { name: "Altar to Unity" },
      { name: "Void Gate", controller: "P2", units: { P2: ["Ezreal, Prodigy"] } },
    ],
    players: {
      P1: {
        legend: "Annie, Dark Child",
        points: 4,
        hand: ["Cleave"],
        base: ["Annie, Stubborn", "Pouty Poro"],
        runes: { ready: { Fury: 2, Chaos: 1 } },
      },
      P2: {
        legend: "Ezreal, Prodigal Explorer",
        points: 5,
        hand: ["Rebuke"],
        runes: { ready: { Chaos: 4 } },
      },
    },
  },
  steps: [
    {
      by: "P1",
      move: ["Annie, Stubborn", "Pouty Poro"],
      to: "Void Gate",
      note: "5 Might attacks 3: the attacker opens the combat showdown with Focus (466.2.c.1.a)",
      expect: { combat: { at: "Void Gate", attacker: "P1" }, focus: "P1", state: "showdown_open" },
    },
    { by: "P1", pass: true, note: "P1 passes Focus", expect: { focus: "P2" } },
    {
      by: "P2",
      play: "Rebuke",
      targets: ["Annie, Stubborn"],
      note: '"Return a unit at a battlefield to its owner\'s hand."',
      expect: { chain: ["Rebuke"], state: "showdown_closed", priority: "P1" },
    },
    {
      by: "P1",
      play: "Cleave",
      targets: ["Pouty Poro"],
      reject: { code: "closed_state_requires_reaction", rule: "309.1.a" },
      note: "Cleave is an [Action], not a [Reaction]: illegal while the chain exists",
    },
    {
      by: "P1",
      pass: true,
      expect: {
        chain: [],
        units: { "Annie, Stubborn": { at: "hand" } },
        state: "showdown_open",
        zones: { P2: { trash: ["Rebuke"] } },
      },
    },
    {
      check: { combat: { at: "Void Gate" }, focus: "P1", alive: ["Pouty Poro", "Ezreal, Prodigy"] },
      note: "the Rebuke resolved; the showdown is Open again and Focus is back with P1",
    },
    {
      by: "P1",
      play: "Cleave",
      targets: ["Pouty Poro"],
      note: "now legal: the state is Open",
      expect: { chain: ["Cleave"], priority: "P2" },
    },
    {
      by: "P2",
      pass: true,
      expect: { chain: [], units: { "Pouty Poro": { might: 5, keywords: ["Assault"] } } },
    },
    { settle: true },
    {
      check: {
        dead: ["Ezreal, Prodigy"],
        units: { "Pouty Poro": { at: "Void Gate", damage: 0 } },
        control: { "Void Gate": "P1" },
        points: { P1: 5, P2: 5 },
        zones: { P1: { hand: ["Annie, Stubborn"], trash: ["Cleave"] } },
      },
      note: "Poro attacks for 5 and survives Ezreal's 3 (lethal is checked against its 5 Might); P1 conquers",
    },
  ],
});
