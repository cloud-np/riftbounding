import { describe, expect, it } from "vitest";
import { scenario } from "../scenarios/dsl";

describe("turn structure [R314]", () => {
  it("[R315.1][R315.3.b.1][R315.4.b] first turn runs Awaken → Beginning → Channel 2 → Draw 1 → Main", () => {
    const s = scenario();
    s.expectPhase("main").expectPriority("p1").expectFocus(null).expectWho("priority", "p1");

    expect(s.room.rules?.turn.number).toBe(1);
    expect(s.room.activeTurnPlayerId).toBe("p1");
    expect(s.room.activeTurnStep).toBe("main");
    // Channeled two runes and drew one (the scenario's deck is deterministic).
    expect(s.room.players[0]?.board?.runeArea.length).toBeGreaterThanOrEqual(2);
  });

  it("[R312.2.a] only the Turn Player has Priority in Neutral Open Main", () => {
    const s = scenario();
    const p1 = s.expectLegal("p1");
    const p2 = s.expectLegal("p2");
    expect(p1.canEndTurn).toBe(true);
    expect(p2.canEndTurn).toBe(false);
    expect(p2.playableCardIds).toEqual([]);
    expect(p2.canPass).toBe(false);
  });

  it("[R313.5] no player has Focus in a Neutral State", () => {
    const s = scenario();
    s.expectState("neutral_open").expectFocus(null);
  });

  it("[R309.1][R310.2] playing a card creates a Chain → Neutral Closed; only Reactions are legal", () => {
    const s = scenario({
      p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } },
      p2: { hand: ["Gust"], energy: 1 },
    });
    // 355.8: Rebuke ("return a unit at a battlefield to its owner's hand") needs a legal target,
    // and so does P2's Reaction. Gust replaces Defy here: Defy can only counter a spell that
    // costs no more than [Rune], and Rebuke costs two.
    s.placeFromDeck("p2", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").play("Rebuke").expectOk();
    s.expectState("neutral_closed");
    expect(s.room.rules?.chain.length).toBe(1);
    expect(s.room.chainEntries.length).toBe(1);
    expect(s.room.rules?.priority).toBe("p2");

    const p2 = s.expectLegal("p2");
    const gust = s.handCard("p2", "Gust");
    expect(gust && p2.playableCardIds.includes(gust.id)).toBe(true);
    const p1Legal = s.expectLegal("p1");
    expect(p1Legal.canEndTurn).toBe(false);
  });

  it("[R317.3] ending the turn starts the next player's full Start of Turn", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } } });
    const turn1 = s.room.rules?.turn.number;
    s.as("p1").endTurn().expectOk();

    expect(s.room.rules?.turn.player).toBe("p2");
    expect(s.room.rules?.turn.number).toBe(turn1! + 1);
    s.expectPhase("main").expectPriority("p2").expectWho("priority", "p2");
  });

  it("[R165][R316.3] each player's Rune Pool empties when Main begins", () => {
    const s = scenario({ p1: { energy: 4 } });
    s.as("p1").endTurn().expectOk();
    expect(s.room.rules?.pools.p1?.energy).toBe(0);
    expect(s.room.players[0]?.board?.floatingEnergy).toBe(0);
  });

  it("[R487.7] in a duel the player going second channels an extra Rune on their first Channel Phase", () => {
    const s = scenario();
    expect(s.room.players[1]?.board?.runeArea.length).toBe(0);
    s.as("p1").endTurn().expectOk();
    expect(s.room.rules?.turn.player).toBe("p2");
    expect(s.room.players[1]?.board?.runeArea.length).toBe(3);
  });

  it("[R734–R738] an Additional Turn is inserted after the current turn without changing Turn Order", () => {
    const s = scenario();
    s.room.pendingExtraTurns = [{ sourceEntryId: "time_warp", playerId: "p1" }];
    s.as("p1").endTurn().expectOk();
    // The queued Additional Turn belongs to P1; the normal queue resumes with P2 afterwards.
    expect(s.room.rules?.turn.player).toBe("p1");
    s.as("p1").endTurn().expectOk();
    expect(s.room.rules?.turn.player).toBe("p2");
  });
});
