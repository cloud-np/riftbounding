import { defineScenario } from "../format";

export default defineScenario({
  title: "Viktor's legend makes a Recruit, Hold scores the 7th point, the Recruit conquers the 8th",
  event: "Riftbound Regional Qualifier Utrecht — 1st (Azir) and 2nd (Viktor) place decklists",
  verification: "illustrative",
  sources: [
    {
      label: "Viktor, Herald of the Arcane — RQ Utrecht 2nd place (Rednaxell) decklist",
      url: "https://mobalytics.gg/riftbound/decks/viktor-herald-of-the-arcane-utrecht-regional-qualifier-2nd-rednaxell",
    },
    {
      label:
        "Azir, Emperor of the Sands — RQ Utrecht 1st place (Squirtle) decklist: Trifarian War Camp",
      url: "https://mobalytics.gg/riftbound/decks/azir-emperor-of-the-sands-utrecht-regional-qualifier-1st-squirtle",
    },
    {
      label: "Riot: Utrecht's Top Decks (event coverage)",
      url: "https://riftbound.leagueoflegends.com/en-us/news/organizedplay/utrechts-top-decks/",
    },
  ],
  notes:
    "Not a real game and not the Utrecht final: only the legends and Trifarian War Camp come from the cited 1st/2nd place lists (search-result snippets); Viktor's battlefield (Bandle Tree) and the whole board are invented. It exercises a legend's activated ability (Viktor: \"[1], [Tap]: Play a 1 [Might] Recruit unit token.\"), a full turn cycle, Hold scoring in the Beginning Phase (315.2.b, 471.2) and the Final Point through a Conquer once every battlefield was scored this turn (473.1.b.1).",
  rules: ["315.2.b", "471.2", "471.1", "473.1.b.1", "474", "143.4"],
  tags: ["legend", "scoring", "hold", "final-point", "victory", "turn-cycle"],
  position: {
    turn: { player: "P1", number: 11 },
    battlefields: [
      {
        name: "Bandle Tree",
        controller: "P1",
        units: { P1: [{ name: "Recruit", token: true, label: "Old Recruit" }] },
      },
      { name: "Trifarian War Camp" },
    ],
    players: {
      P1: {
        legend: "Viktor, Herald of the Arcane",
        points: 6,
        runes: { ready: { Order: 1, Mind: 1 } },
      },
      P2: {
        legend: "Azir, Emperor of the Sands",
        points: 5,
        runes: { ready: { Calm: 3, Order: 3 } },
      },
    },
  },
  steps: [
    {
      by: "P1",
      activate: "Viktor, Herald of the Arcane",
      note: "pay [1] and exhaust the legend",
    },
    { settle: true },
    {
      check: {
        zones: { P1: { legendExhausted: true, base: ["Recruit"] } },
        units: { "Recruit@base": { exhausted: true } },
      },
      note: "the token enters exhausted (143.4), so it cannot move this turn",
    },
    {
      by: "P1",
      move: "Recruit@base",
      to: "Trifarian War Camp",
      reject: { code: "unit_exhausted" },
    },
    { by: "P1", endTurn: true, expect: { turnPlayer: "P2", priority: "P2" } },
    {
      by: "P2",
      endTurn: true,
      note: "P1's Beginning Phase: units ready, P1 Holds Bandle Tree (315.2.b), channels and draws",
      expect: {
        turnPlayer: "P1",
        phase: "main",
        points: { P1: 7, P2: 5 },
        units: { "Recruit@base": { exhausted: false } },
        zones: { P1: { legendExhausted: false } },
        events: ["hold"],
      },
    },
    {
      by: "P1",
      move: "Recruit@base",
      to: "Trifarian War Camp",
      note: "Bandle Tree was already scored this turn by Hold, so this Conquer gains the Final Point",
    },
    { settle: true },
    {
      check: {
        control: { "Trifarian War Camp": "P1", "Bandle Tree": "P1" },
        points: { P1: 8 },
        winner: "P1",
      },
    },
  ],
});
