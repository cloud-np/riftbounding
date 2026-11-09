import { defineScenario } from "../format";

export default defineScenario({
  title:
    "Hidden Tideturner: hide on your turn, play it facedown in the opponent's attack and swap Diana in",
  event: "Riftbound Regional Qualifier Vancouver (Diana) vs RQ Utrecht (Azir) decklists",
  verification: "illustrative",
  sources: [
    {
      label:
        "Diana, Scorn of the Moon — RQ Vancouver 1st place (AlanZQ) decklist: Tideturner, Diana, Lunari, Ravenbloom Student, Targon's Peak",
      url: "https://mobalytics.gg/riftbound/decks/diana-scorn-of-the-moon-vancouver-regional-qualifier-1st-alanzq",
    },
    {
      label:
        "Azir, Emperor of the Sands — RQ Utrecht 1st place (Squirtle) decklist: Azir, Sovereign, Seat of Power",
      url: "https://mobalytics.gg/riftbound/decks/azir-emperor-of-the-sands-utrecht-regional-qualifier-1st-squirtle",
    },
    {
      label: "Riftbound Core Rules 2026-10-09, 811.1.d.3 (the Tideturner example)",
    },
  ],
  notes:
    'Not a real game. Cards come from the cited top-cut lists (search-result snippets). The line is invented, following the official Tideturner example in 811.1.d.3: "Because its play effect has a targeting restriction that can never be fulfilled by a unit at its battlefield, its target may be chosen freely from among the available options." It exercises the Hide discretionary action (811.1.b, no chain: 811.1.c.2), playing from facedown on the next turn with [Reaction] for no base cost (811.1.b, 811.6), a play trigger, and a unit joining a combat as a Defender (466.2.c.3.a).',
  rules: ["811.1.b", "811.1.c.2", "811.1.c.3", "811.1.d.3", "811.6", "466.2.c.3.a", "315.2.b"],
  tags: ["hidden", "facedown", "reaction", "trigger", "combat", "turn-cycle"],
  position: {
    turn: { player: "P1", number: 6 },
    battlefields: [
      { name: "Targon's Peak", controller: "P1", units: { P1: ["Ravenbloom Student"] } },
      {
        name: "Seat of Power",
        controller: "P2",
        units: { P2: [{ name: "Sand Soldier", token: true }] },
      },
    ],
    players: {
      P1: {
        legend: "Diana, Scorn of the Moon",
        points: 4,
        hand: ["Tideturner"],
        base: ["Diana, Lunari"],
        runes: { ready: { Chaos: 1, Mind: 1 } },
      },
      P2: {
        legend: "Azir, Emperor of the Sands",
        points: 4,
        base: ["Azir, Sovereign"],
        runes: { ready: { Calm: 2, Order: 2 } },
      },
    },
  },
  steps: [
    {
      by: "P1",
      hide: "Tideturner",
      at: "Targon's Peak",
      note: "pay [A] to hide it facedown at a battlefield P1 controls",
      expect: { chain: [], state: "neutral_open", zones: { P1: { hand: [] } }, events: ["hide"] },
    },
    { by: "P1", endTurn: true, expect: { turnPlayer: "P2", points: { P2: 5 } } },
    {
      by: "P2",
      move: "Azir, Sovereign",
      to: "Targon's Peak",
      expect: { combat: { at: "Targon's Peak", attacker: "P2", defender: "P1" } },
    },
    { settle: true },
    {
      by: "P2",
      choose: [],
      note: "Azir, Sovereign's attack trigger: P2 leaves the Sand Soldier holding Seat of Power",
      expect: { chain: [], state: "showdown_open", focus: "P2" },
    },
    { by: "P2", pass: true, expect: { focus: "P1" } },
    {
      by: "P1",
      play: "Tideturner",
      note: "from facedown: [Reaction] since the next turn, base cost ignored (811.1.b); a facedown play opens a chain (811.1.c.3)",
      expect: {
        units: { Tideturner: { at: "Targon's Peak" } },
        chain: ["Tideturner (trigger)"],
        prompt: { kind: "yes-no", for: "P1" },
        zones: { P1: { runes: { ready: 1 } } },
      },
    },
    { settle: true },
    { by: "P1", choose: true, note: '"you may choose a unit you control at another location"' },
    {
      settle: true,
      note: "the swap resolves: Tideturner goes to base, Diana, Lunari arrives and becomes a Defender (466.2.c.3.a)",
      expect: {
        units: { Tideturner: { at: "base" }, "Diana, Lunari": { at: "Targon's Peak" } },
        events: ["swap"],
        prompt: { kind: "damage-assignment", for: "P2" },
      },
    },
    {
      by: "P2",
      assign: { "Diana, Lunari": 3, "Ravenbloom Student": 1 },
      note: "Azir's 4 Might: lethal to Diana first, the rest to the Student",
    },
    { settle: true },
    {
      check: {
        dead: ["Azir, Sovereign", "Diana, Lunari"],
        alive: ["Ravenbloom Student", "Tideturner"],
        units: { "Ravenbloom Student": { damage: 0 } },
        control: { "Targon's Peak": "P1" },
        points: { P1: 4, P2: 5 },
        combat: null,
        turnPlayer: "P2",
      },
      note: "5 defending Might kills Azir; P1 keeps Targon's Peak, so P2 does not conquer",
    },
  ],
});
