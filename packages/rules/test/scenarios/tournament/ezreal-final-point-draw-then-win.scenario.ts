import { defineScenario } from "../format";

export default defineScenario({
  title: "Final Point by Conquer: draw instead at 7, then win by scoring every battlefield",
  event: "Riftbound Regional Qualifier Bologna (Ezreal) vs RQ Houston (Annie) decklists",
  verification: "illustrative",
  sources: [
    {
      label:
        "Ezreal, Prodigal Explorer — RQ Bologna 1st place (Alanzq1) decklist: Ezreal, Prodigy, Traveling Merchant, Void Gate",
      url: "https://mobalytics.gg/riftbound/decks/ezreal-prodigal-explorer-bologna-regional-qualifier-1st-alanzq1",
    },
    {
      label: "Riot: The Best Decks out of Bologna (event coverage)",
      url: "https://riftbound.leagueoflegends.com/en-us/news/organizedplay/the-best-decks-out-of-bologna",
    },
    {
      label: "Annie, Dark Child — RQ Houston 1st place (Dhawally) decklist: Pouty Poro",
      url: "https://mobalytics.gg/riftbound/decks/annie-dark-child-1st-houston-regional-qualifier-dhawally",
    },
  ],
  notes:
    "Not a real game. Cards come from the cited top-cut lists (read from search-result snippets); P2's battlefield (Targon's Peak) is not from the Annie list, whose battlefields the snippets did not show. The board and the line are invented to exercise the Final Point rule: 473.1.b.1 \"If the player has Scored every Battlefield this turn, that player Gains the Final Point. If the player has not Scored every Battlefield this turn, that player draws a card instead.\"",
  rules: ["473.1.b", "473.1.b.1", "472", "471.1", "474"],
  tags: ["scoring", "final-point", "conquer", "victory", "trigger"],
  position: {
    turn: { player: "P1", number: 12 },
    battlefields: [
      { name: "Void Gate" },
      { name: "Targon's Peak", controller: "P2", units: { P2: ["Pouty Poro"] } },
    ],
    players: {
      P1: {
        legend: "Ezreal, Prodigal Explorer",
        points: 7,
        hand: ["Rebuke"],
        base: ["Traveling Merchant", "Ezreal, Prodigy"],
        deck: ["Fizz, Trickster", "Ezreal, Prodigy", "Traveling Merchant"],
        runes: { ready: { Chaos: 2, Mind: 2 } },
      },
      P2: {
        legend: "Annie, Dark Child",
        points: 6,
        runes: { exhausted: { Fury: 3, Chaos: 3 } },
      },
    },
  },
  steps: [
    {
      by: "P1",
      move: "Traveling Merchant",
      to: "Void Gate",
      note: "an empty, uncontrolled battlefield: the Merchant's move trigger resolves, then a non-combat showdown",
      expect: { chain: ["Traveling Merchant (trigger)"] },
    },
    {
      settle: true,
      expect: { events: ["score_draw_instead", "conquer"], noEvents: ["score"] },
    },
    {
      check: {
        points: { P1: 7 },
        control: { "Void Gate": "P1" },
        zones: { P1: { hand: ["Fizz, Trickster", "Ezreal, Prodigy"], trash: ["Rebuke"] } },
      },
      note: "Merchant: discard Rebuke, draw Fizz; 473.1.b.1: one point short and Targon's Peak not scored yet, so the Conquer draws Ezreal, Prodigy instead of scoring",
    },
    {
      by: "P1",
      move: "Ezreal, Prodigy",
      to: "Targon's Peak",
      expect: { combat: { at: "Targon's Peak", attacker: "P1", defender: "P2" } },
    },
    { settle: true },
    {
      check: {
        dead: ["Pouty Poro"],
        control: { "Targon's Peak": "P1" },
        points: { P1: 8 },
        winner: "P1",
      },
      note: "both battlefields scored this turn: this Conquer gains the Final Point and P1 wins (474)",
    },
  ],
});
