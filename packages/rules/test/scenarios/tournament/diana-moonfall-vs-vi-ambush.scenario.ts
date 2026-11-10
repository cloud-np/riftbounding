import { defineScenario } from "../format";

export default defineScenario({
  title: "Reaction on the chain: Vi, Peacekeeper ambushes in response to Moonfall and takes the -2",
  event: "Riftbound Regional Qualifier Vancouver (Diana) vs RQ Utrecht (Azir) decklists",
  verification: "illustrative",
  sources: [
    {
      label:
        "Diana, Scorn of the Moon — RQ Vancouver 1st place (AlanZQ) decklist: Diana, Lunari, Ravenbloom Student, Moonfall (sideboard), Targon's Peak",
      url: "https://mobalytics.gg/riftbound/decks/diana-scorn-of-the-moon-vancouver-regional-qualifier-1st-alanzq",
    },
    {
      label:
        "Azir, Emperor of the Sands — RQ Utrecht 1st place (Squirtle) decklist: Vi, Peacekeeper, Seat of Power",
      url: "https://mobalytics.gg/riftbound/decks/azir-emperor-of-the-sands-utrecht-regional-qualifier-1st-squirtle",
    },
    {
      label: "Riot: Vancouver's Top Decks (event coverage)",
      url: "https://riftbound.leagueoflegends.com/en-us/news/organizedplay/vancouvers-top-decks/",
    },
  ],
  notes:
    "Not a real game. Cards come from the cited top-cut lists (search-result snippets; Moonfall is listed in Diana's sideboard); the Sand Soldier is the token Azir's legend creates. The line is invented to put a Reaction on the chain: Vi's Ambush (822.1.b \"I may be played to a battlefield where you control Units\" and \"I have [Reaction] as long as I'm being played to a battlefield where you control Units\") answers Moonfall in a closed showdown, resolves first (last in, first out) and is then hit by Moonfall's -2 [Might].",
  rules: ["822.1.b", "309.1.a", "338", "466.2.c.3.a", "467.2.c"],
  tags: ["reaction", "chain", "ambush", "showdown", "combat", "trigger"],
  position: {
    turn: { player: "P1", number: 10 },
    battlefields: [
      { name: "Targon's Peak" },
      {
        name: "Seat of Power",
        controller: "P2",
        units: { P2: [{ name: "Sand Soldier", token: true, label: "Soldier A" }] },
      },
    ],
    players: {
      P1: {
        legend: "Diana, Scorn of the Moon",
        points: 5,
        hand: ["Moonfall"],
        base: ["Diana, Lunari", "Ravenbloom Student"],
        runes: { ready: { Mind: 2, Chaos: 2 } },
      },
      P2: {
        legend: "Azir, Emperor of the Sands",
        points: 6,
        hand: ["Vi, Peacekeeper"],
        base: [{ name: "Sand Soldier", token: true, label: "Soldier B" }],
        runes: { ready: { Order: 3, Calm: 3 } },
      },
    },
  },
  steps: [
    {
      by: "P1",
      move: ["Diana, Lunari", "Ravenbloom Student"],
      to: "Seat of Power",
      expect: { combat: { at: "Seat of Power", attacker: "P1", defender: "P2" } },
    },
    {
      by: "P1",
      choose: false,
      note: "Diana, Lunari's showdown trigger: decline to pay [1] (the runes are needed for Moonfall)",
      expect: { chain: [], focus: "P1", state: "showdown_open" },
    },
    {
      by: "P1",
      play: "Moonfall",
      targets: ["Seat of Power"],
      note: '"Choose a battlefield where you have units": the battlefield is bound on play (355.7)',
      expect: { prompt: { kind: "choose-target", for: "P1" } },
    },
    {
      by: "P1",
      choose: "Soldier B",
      note: '"You may move up to one enemy unit to that battlefield": the Sand Soldier waiting in P2\'s base',
      expect: { chain: ["Moonfall"], priority: "P2", state: "showdown_closed" },
    },
    {
      by: "P2",
      play: "Vi, Peacekeeper",
      location: "Seat of Power",
      note: "Ambush: legal in the Closed State because Vi is played to a battlefield where P2 has units; a unit resolves as soon as it is finalized (337.2), above Moonfall",
      expect: {
        chain: ["Moonfall"],
        units: { "Vi, Peacekeeper": { at: "Seat of Power", might: 5 } },
        events: ["unit_played"],
      },
    },
    {
      by: "P1",
      pass: true,
      expect: { chain: ["Moonfall"], priority: "P2" },
    },
    {
      by: "P2",
      pass: true,
      note: "Moonfall resolves: Soldier B is moved in, then every enemy unit there gets -2 [Might] — Vi included",
      expect: {
        units: {
          "Vi, Peacekeeper": { at: "Seat of Power", might: 3 },
          "Soldier A": { might: 0 },
          "Soldier B": { at: "Seat of Power", might: 0 },
        },
        chain: ["Ravenbloom Student (trigger)"],
      },
    },
    {
      settle: true,
      expect: {
        units: { "Ravenbloom Student": { might: 3 }, "Diana, Lunari": { might: 3 } },
        prompt: { kind: "damage-assignment", for: "P1" },
      },
    },
    { by: "P1", assign: { "Vi, Peacekeeper": 4, "Soldier A": 1, "Soldier B": 1 } },
    { by: "P2", assign: { "Diana, Lunari": 3 } },
    { settle: true },
    {
      check: {
        dead: ["Vi, Peacekeeper", "Diana, Lunari"],
        alive: ["Ravenbloom Student"],
        control: { "Seat of Power": "P1" },
        points: { P1: 6, P2: 6 },
        combat: null,
      },
      note: "P1 wins the combat with Ravenbloom Student and conquers Seat of Power",
    },
  ],
});
