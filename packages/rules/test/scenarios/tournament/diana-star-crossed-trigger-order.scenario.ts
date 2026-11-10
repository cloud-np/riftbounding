import { defineScenario } from "../format";

export default defineScenario({
  title: "Trigger ordering: one spell triggers Ravenbloom Student and Abandoned Hall together",
  event: "Riftbound Regional Qualifier Vancouver (Diana) vs RQ Utrecht (Azir) decklists",
  verification: "illustrative",
  sources: [
    {
      label:
        "Diana, Scorn of the Moon — RQ Vancouver 1st place (AlanZQ) decklist: Abandoned Hall, Ravenbloom Student, Tideturner, Diana, Lunari, Star-Crossed (sideboard)",
      url: "https://mobalytics.gg/riftbound/decks/diana-scorn-of-the-moon-vancouver-regional-qualifier-1st-alanzq",
    },
    {
      label:
        "Azir, Emperor of the Sands — RQ Utrecht 1st place (Squirtle) decklist: Vi, Peacekeeper, Seat of Power",
      url: "https://mobalytics.gg/riftbound/decks/azir-emperor-of-the-sands-utrecht-regional-qualifier-1st-squirtle",
    },
  ],
  notes:
    'Not a real game; cards from the cited top-cut lists (search-result snippets; Star-Crossed is in Diana\'s sideboard). The board is invented so that one spell triggers two abilities of the same player at once — Ravenbloom Student ("When you play a spell, give me +1 [Might] this turn.") and Abandoned Hall ("When a player plays a spell, they may give a unit they control here +1 [Might] this turn.") — and that player orders them (383.3.d). Star-Crossed is a [Reaction] ("Return a friendly unit and an enemy unit to their owners hands.").',
  rules: ["383.3.d", "420.4.a", "355.7", "190.6"],
  tags: ["trigger", "trigger-order", "battlefield", "reaction", "spell"],
  position: {
    turn: { player: "P1", number: 9 },
    battlefields: [
      {
        name: "Abandoned Hall",
        controller: "P1",
        units: { P1: ["Ravenbloom Student", "Diana, Lunari"] },
      },
      { name: "Seat of Power", controller: "P2", units: { P2: ["Vi, Peacekeeper"] } },
    ],
    players: {
      P1: {
        legend: "Diana, Scorn of the Moon",
        points: 5,
        hand: ["Star-Crossed"],
        base: ["Tideturner"],
        runes: { ready: { Chaos: 3, Mind: 1 } },
      },
      P2: {
        legend: "Azir, Emperor of the Sands",
        points: 6,
        runes: { exhausted: { Calm: 3, Order: 3 } },
      },
    },
  },
  steps: [
    {
      by: "P1",
      play: "Star-Crossed",
      targets: ["Tideturner", "Vi, Peacekeeper"],
      note: "return P1's own Tideturner (to hide it again later) and P2's Vi",
      expect: { chain: ["Star-Crossed"], priority: "P2" },
    },
    {
      by: "P2",
      pass: true,
      note: 'Star-Crossed resolves; both "when ... plays a spell" abilities trigger at once',
      expect: {
        zones: { P1: { hand: ["Tideturner"] }, P2: { hand: ["Vi, Peacekeeper"] } },
        prompt: { kind: "order", for: "P1" },
      },
    },
    {
      by: "P1",
      order: ["Abandoned Hall", "Ravenbloom Student"],
      expect: { chain: ["Abandoned Hall (trigger)", "Ravenbloom Student (trigger)"] },
    },
    {
      by: "P1",
      choose: true,
      note: 'Abandoned Hall\'s "they may" is decided as the trigger goes on the chain (403.1)',
      expect: { prompt: { kind: "choose-target", for: "P1" } },
    },
    { by: "P1", choose: "Ravenbloom Student", note: "the unit here that gets +1 [Might]" },
    { settle: true },
    {
      check: {
        chain: [],
        units: { "Ravenbloom Student": { might: 4 }, "Diana, Lunari": { might: 3 } },
        control: { "Seat of Power": null, "Abandoned Hall": "P1" },
      },
      note: "+1 from its own trigger and +1 from Abandoned Hall; Seat of Power is left Uncontrolled without units (190.4.c)",
    },
  ],
});
