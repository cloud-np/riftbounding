import { defineScenario } from "../format";

export default defineScenario({
  title:
    "Sigil of the Storm: a Conquer at 7 points draws instead, and the Conquer ability triggers once",
  event: "Riftbound Regional Qualifier Bologna (Ezreal) decklist",
  verification: "illustrative",
  sources: [
    {
      label:
        "Ezreal, Prodigal Explorer — RQ Bologna 1st place (Alanzq1) decklist: Sigil of the Storm, Traveling Merchant",
      url: "https://riftdecks.com/riftbound-metagame/deck-ezreal-prodigal-explorer-92125",
    },
  ],
  notes:
    "Not a real game. Ezreal's battlefield Sigil of the Storm and Traveling Merchant are from the cited Bologna winner's list (search-result snippet); P2's side is invented. At one point from victory, conquering without having scored every battlefield replaces the point with a draw (473.1.b.1), but the battlefield was still Scored, so \"When you conquer here\" triggers exactly once (473.2, 473.2.c).",
  rules: ["473.1.b.1", "473.2", "473.2.a", "473.2.c", "383.4.d.2.c"],
  tags: ["scoring", "final-point", "trigger", "battlefield"],
  expectFailure: {
    reason:
      '[BUG] at Victory Score - 1 a Conquer ability triggers twice: `scoreBattlefield` emits both `score_draw_instead` (which `triggerMatchesEvent` maps to `conquer` via data.kind) and an explicit `conquer` event, so every "When you conquer" source queues two triggers and the player gets an order prompt with two Sigil of the Storm triggers.',
    rule: '473.2.c "These will only trigger when the Battlefield is Scored; I.E. These cannot be triggered more than once per turn for a player."',
    atStep: 3,
  },
  position: {
    turn: { player: "P1", number: 10 },
    battlefields: [
      { name: "Sigil of the Storm" },
      { name: "Targon's Peak", controller: "P2", units: { P2: ["Pouty Poro"] } },
    ],
    players: {
      P1: {
        legend: "Ezreal, Prodigal Explorer",
        points: 7,
        hand: ["Rebuke"],
        base: ["Traveling Merchant"],
        deck: ["Fizz, Trickster", "Ezreal, Prodigy"],
        runes: { ready: { Chaos: 2, Mind: 1 } },
      },
      P2: { legend: "Annie, Dark Child", points: 5 },
    },
  },
  steps: [
    { by: "P1", move: "Traveling Merchant", to: "Sigil of the Storm" },
    { settle: true, expect: { events: ["score_draw_instead", "conquer"], points: { P1: 7 } } },
    {
      check: {
        chain: ["Sigil of the Storm (trigger)"],
        prompt: { kind: "choose-card", for: "P1" },
      },
      note: "one Conquer trigger on the chain, resolving into the rune choice (no trigger-order prompt)",
    },
    { by: "P1", choose: "Mind Rune" },
    { settle: true },
    {
      check: {
        chain: [],
        zones: { P1: { runes: { total: 2 }, hand: ["Fizz, Trickster", "Ezreal, Prodigy"] } },
      },
      note: "exactly one rune was recycled",
    },
  ],
});
