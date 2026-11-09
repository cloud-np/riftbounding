/**
 * Teemo, Strategist (OGN-121, Origins errata) — "[Hidden] When I defend, choose an enemy unit here
 * and reveal the top 5 cards of your Main Deck. Deal 1 to that unit for each card with [Hidden]
 * revealed this way, then recycle the revealed cards."
 *
 * [Hidden] (811) is the play layer's. The defend trigger (383.4.f) targets an enemy unit at Teemo's
 * battlefield when it finalizes (403.2). Registers `ogn:reveal-top`: reveals the top `count`
 * cards of the controller's Main Deck (425; they stay there, 425.1.a.2) and binds them to `key`.
 * One deal instruction for the number of revealed [Hidden] cards (418.8), then the revealed cards
 * are recycled (417.5 random order).
 */
import { aUnit, HERE, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Teemo, Strategist",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen I defend, choose an enemy unit here and reveal the top 5 cards of your Main Deck. Deal 1 to that unit for each card with [Hidden] revealed this way, then recycle the revealed cards.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "defend", subject: SELF } },
      effect: {
        op: "seq",
        effects: [
          { op: "custom", id: "ogn:reveal-top", params: { count: 5, key: "revealed" } },
          {
            op: "deal",
            amount: { kind: "count", selector: { targetRef: "revealed", keyword: "Hidden" } },
            target: aUnit({ controller: "opponent", zone: HERE }),
          },
          { op: "recycle", target: { targetRef: "revealed" } },
        ],
      },
    },
  ],
});
