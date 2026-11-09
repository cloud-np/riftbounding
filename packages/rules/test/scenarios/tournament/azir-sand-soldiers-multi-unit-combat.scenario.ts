import { defineScenario } from "../format";

export default defineScenario({
  title: "Azir, Sovereign brings the Sand Soldiers: multi-unit combat and damage assignment",
  event: "Riftbound Regional Qualifier Utrecht (Azir) vs RQ Vancouver (Diana) decklists",
  verification: "illustrative",
  sources: [
    {
      label:
        "Azir, Emperor of the Sands — RQ Utrecht 1st place (Squirtle) decklist: Azir, Sovereign champion, Trifarian War Camp",
      url: "https://mobalytics.gg/riftbound/decks/azir-emperor-of-the-sands-utrecht-regional-qualifier-1st-squirtle",
    },
    {
      label:
        "Diana, Scorn of the Moon — RQ Vancouver 1st place (AlanZQ) decklist: Diana, Lunari, Ravenbloom Student, Targon's Peak",
      url: "https://mobalytics.gg/riftbound/decks/diana-scorn-of-the-moon-vancouver-regional-qualifier-1st-alanzq",
    },
  ],
  notes:
    "Not a real game. Legends, champions, units and battlefields come from the two cited top-cut lists (read from search-result snippets; the full pages could not be fetched). The board, the turn and every decision are invented to exercise Azir, Sovereign's attack trigger (moving token units into the combat, 466.2.c.3.a) and a two-sided multi-unit damage assignment (467.2.c).",
  rules: ["466.2.c.3.a", "467.2.c", "468.3", "468.5", "471.1"],
  tags: ["combat", "damage-assignment", "trigger", "conquer"],
  position: {
    turn: { player: "P1", number: 9 },
    battlefields: [
      { name: "Trifarian War Camp" },
      {
        name: "Targon's Peak",
        controller: "P2",
        units: { P2: ["Diana, Lunari", "Ravenbloom Student"] },
      },
    ],
    players: {
      P1: {
        legend: "Azir, Emperor of the Sands",
        points: 5,
        base: [
          "Azir, Sovereign",
          { name: "Sand Soldier", token: true, label: "Soldier A" },
          { name: "Sand Soldier", token: true, label: "Soldier B" },
        ],
        runes: { ready: { Calm: 2, Order: 2 } },
      },
      P2: {
        legend: "Diana, Scorn of the Moon",
        points: 5,
        runes: { exhausted: { Chaos: 3, Mind: 2 } },
      },
    },
  },
  steps: [
    {
      by: "P1",
      move: "Azir, Sovereign",
      to: "Targon's Peak",
      note: "Azir attacks alone; his trigger may bring the token units",
      expect: { combat: { at: "Targon's Peak", attacker: "P1", defender: "P2" } },
    },
    { settle: true },
    {
      by: "P1",
      choose: ["Soldier A", "Soldier B"],
      note: "both Sand Soldiers join the combat and gain the Attacker designation",
      expect: {
        units: {
          "Soldier A": { at: "Targon's Peak", might: 2 },
          "Soldier B": { at: "Targon's Peak", might: 2 },
          "Azir, Sovereign": { at: "Targon's Peak", might: 4 },
        },
        chain: [],
      },
    },
    {
      settle: true,
      expect: { prompt: { kind: "damage-assignment", for: "P1" } },
    },
    {
      by: "P1",
      assign: { "Diana, Lunari": 4, "Ravenbloom Student": 4 },
      note: "the Attacker assigns first (467.2.c): 8 Might split over both defenders",
      expect: { prompt: { kind: "damage-assignment", for: "P2" } },
    },
    {
      by: "P2",
      assign: { "Soldier A": 2, "Soldier B": 2, "Azir, Sovereign": 1 },
      note: "the Defender's 5 Might kills both tokens and nicks Azir",
    },
    { settle: true },
    {
      check: {
        dead: ["Diana, Lunari", "Ravenbloom Student"],
        alive: ["Azir, Sovereign"],
        units: { "Azir, Sovereign": { at: "Targon's Peak", damage: 0 } },
        control: { "Targon's Peak": "P1" },
        points: { P1: 6, P2: 5 },
        combat: null,
        state: "neutral_open",
        priority: "P1",
      },
      note: "P1 wins the combat, conquers Targon's Peak for a point; 468.1.a.1 heals the survivor",
    },
  ],
});
