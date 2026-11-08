import { describe, expect, it } from "vitest";
import { scenario } from "../scenarios/dsl";

describe("RulesHost generic primitives (R1-SPLIT-R freeze + R1-PREP-E owner-relative moves)", () => {
  it("supports generic zone/visibility/counter/control operations", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter", "Rebuke"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    const host = s.host;

    // createToken
    const tokenId = host.createToken(s.room, "p1", "Treasure Hunter", "base");
    expect(tokenId).toBeTruthy();

    // reveal/hide
    expect(host.reveal(s.room, unit.id)).toBe(true);
    expect(host.findCard(s.room, unit.id)?.card.revealedToOpponent).toBe(true);
    expect(host.hide(s.room, unit.id)).toBe(true);
    expect(host.findCard(s.room, unit.id)?.card.hidden).toBe(true);

    // counters
    expect(host.adjustCounter(s.room, unit.id, "charge", 2)).toBe(2);
    expect(host.adjustCounter(s.room, unit.id, "charge", -1)).toBe(1);

    // lookAtTop / searchZone
    expect(host.lookAtTop(s.room, "p1", "deck", 3)).toHaveLength(3);
    expect(host.searchZone(s.room, "p1", "hand", { name: "Rebuke" })).toHaveLength(1);

    // move within/between zones with position
    const handCard = s.handCard("p1", "Rebuke")!;
    expect(host.moveCardTo(s.room, "p1", "hand", "deck", handCard.id, "top")).toBe(true);
    expect(host.findCard(s.room, handCard.id)?.zone).toBe("deck");
    expect(host.moveCardTo(s.room, "p1", "deck", "hand", handCard.id, "bottom")).toBe(true);

    // banish / returnToHand
    expect(host.banish(s.room, handCard.id)).toBe(true);
    expect(host.findCard(s.room, handCard.id)?.zone).toBe("banished");
    expect(host.returnToHand(s.room, handCard.id)).toBe(true);
    expect(host.findCard(s.room, handCard.id)?.zone).toBe("hand");

    // attach/detach
    const other = s.findBoardCardAnywhere("Caitlyn, Patrolling") ?? unit;
    expect(host.attach(s.room, tokenId!, other.id)).toBe(true);
    expect(host.findCard(s.room, tokenId!)?.card.attachedToCardId).toBe(other.id);
    expect(host.detach(s.room, tokenId!)).toBe(true);
    expect(host.findCard(s.room, tokenId!)?.card.attachedToCardId).toBeUndefined();

    // setController moves a board card to the other player's board.
    expect(host.reveal(s.room, unit.id)).toBe(true);
    expect(host.setController(s.room, unit.id, "p2")).toBe(true);
    expect(host.findCard(s.room, unit.id)?.playerId).toBe("p2");

    // owner-relative move (R1-PREP-E): the controlled card goes to its OWNER's zone, not the
    // controller's. 412 "return to owner's hand / trash / deck / banish".
    expect(host.moveCardToOwnerZone(s.room, unit.id, "hand")).toBe(true);
    expect(host.findCard(s.room, unit.id)).toMatchObject({ playerId: "p1", zone: "hand" });

    // Same helper for an already owner-held card, with a deck position ("top" = draw end).
    expect(host.moveCardToOwnerZone(s.room, handCard.id, "deck", "top")).toBe(true);
    expect(host.findCard(s.room, handCard.id)).toMatchObject({ playerId: "p1", zone: "deck" });
    expect(host.lookAtTop(s.room, "p1", "deck", 1)[0]?.id).toBe(handCard.id);
    expect(host.moveCardToOwnerZone(s.room, handCard.id, "banished")).toBe(true);
    expect(host.findCard(s.room, handCard.id)?.zone).toBe("banished");
    expect(host.moveCardToOwnerZone(s.room, handCard.id, "trash")).toBe(true);
    expect(host.findCard(s.room, handCard.id)?.zone).toBe("trash");
  });
});
