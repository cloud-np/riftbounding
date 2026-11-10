import { defineScenario } from "../format";

export default defineScenario({
  title: 'Moonfall with zero "up to one" targets chosen on play resolves without a new choice',
  event: "Riftbound Regional Qualifier Vancouver (Diana) vs RQ Utrecht (Azir) decklists",
  verification: "illustrative",
  sources: [
    {
      label:
        "Diana, Scorn of the Moon — RQ Vancouver 1st place (AlanZQ) decklist: Moonfall (sideboard), Ravenbloom Student, Targon's Peak",
      url: "https://mobalytics.gg/riftbound/decks/diana-scorn-of-the-moon-vancouver-regional-qualifier-1st-alanzq",
    },
    {
      label: "Azir, Emperor of the Sands — RQ Utrecht 1st place (Squirtle) decklist: Seat of Power",
      url: "https://mobalytics.gg/riftbound/decks/azir-emperor-of-the-sands-utrecht-regional-qualifier-1st-squirtle",
    },
  ],
  notes:
    'Not a real game; cards from the cited lists (search-result snippets). Moonfall reads "Choose a battlefield where you have units. You may move up to one enemy unit to that battlefield." Its targets are chosen on play (355.5); choosing zero of an "up to" choice is legal and the spell is then played without that target (355.13). The engine stores the empty choice on play but asks again on resolution (with options re-evaluated at that time), letting the controller pick a unit that was never chosen on play. With one unit chosen on play there is no second prompt (see diana-moonfall-vs-vi-ambush).',
  rules: ["355.5", "355.13", "355.8"],
  tags: ["targets", "choice", "spell"],
  position: {
    turn: { player: "P1", number: 8 },
    battlefields: [
      { name: "Targon's Peak", controller: "P1", units: { P1: ["Ravenbloom Student"] } },
      { name: "Seat of Power" },
    ],
    players: {
      P1: {
        legend: "Diana, Scorn of the Moon",
        points: 3,
        hand: ["Moonfall"],
        runes: { ready: { Mind: 2, Chaos: 2 } },
      },
      P2: {
        legend: "Azir, Emperor of the Sands",
        points: 3,
        base: [{ name: "Sand Soldier", token: true }],
      },
    },
  },
  steps: [
    {
      by: "P1",
      play: "Moonfall",
      targets: ["Targon's Peak"],
      expect: { prompt: { kind: "choose-target", for: "P1" } },
    },
    {
      by: "P1",
      choose: [],
      note: "no enemy unit is chosen: the spell is played without that target (355.13)",
      expect: { chain: ["Moonfall"], priority: "P2" },
    },
    { by: "P2", pass: true },
    {
      check: {
        prompt: null,
        units: { "Sand Soldier": { at: "base" } },
        zones: { P1: { trash: ["Moonfall"] } },
      },
      note: "Moonfall resolves with no enemy unit to move and no second choice",
    },
  ],
});
