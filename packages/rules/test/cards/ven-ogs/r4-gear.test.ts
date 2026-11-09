/**
 * Wave R4 — Vendetta gear: burn/play triggers, control changes and activation costs.
 */
import { describe, expect, it } from "vitest";
import { getCardScript } from "../../../src";
import { fund } from "../../rules/effects/helpers";
import {
  activate,
  addPool,
  answer,
  boardOf,
  empowered,
  might,
  place,
  settle,
  withCards,
  zoneOf,
} from "./helpers";

describe("Wave R4 Vendetta gear", () => {
  it("[C:Endless Riches][R441][R428] play: banish hand and trash, then burn 7", () => {
    const s = withCards(["Endless Riches", "Caitlyn, Patrolling", "Treasure Hunter", "Hextech Ray"]);
    const oldTrash = place(s, "p1", "Hextech Ray", "trash");
    place(s, "p1", "Caitlyn, Patrolling", "hand");
    place(s, "p1", "Treasure Hunter", "hand");
    fund(s, "p1", "Endless Riches");
    s.as("p1").play("Endless Riches").expectOk();
    settle(s);
    expect(boardOf(s, "p1").hand).toHaveLength(0);
    expect(zoneOf(s, oldTrash.id)).toBe("banished");
    expect(boardOf(s, "p1").trash).toHaveLength(7);
  });

  it("[C:Forgotten Relic][R441] burning a unit gives a friendly unit +Might equal to its Might", () => {
    const s = withCards(["Forgotten Relic", "Caitlyn, Patrolling", "Whiteflame Protector"]);
    const friend = place(s, "p1", "Whiteflame Protector", "base");
    const burned = place(s, "p1", "Caitlyn, Patrolling", "deck");
    fund(s, "p1", "Forgotten Relic");
    s.as("p1").play("Forgotten Relic").expectOk();
    settle(s);
    expect(zoneOf(s, burned.id)).toBe("trash");
    // The only friendly unit is picked automatically (055): Whiteflame 8 + Caitlyn's 3.
    expect(might(s, friend.id)).toBe(11);
  });

  it("[C:Glowstone][R818] Empower then choose a player: they gain control and it is recalled", () => {
    const s = withCards(["Glowstone"]);
    const stone = place(s, "p1", "Glowstone", "base");
    addPool(s, "p1", 2, { any: 2 });
    activate(s, "p1", stone, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, stone.id)).toBe(true);
    activate(s, "p1", stone, "activated:1").expectOk();
    // 355.7: the player is chosen when the ability is activated.
    expect(s.room.rules!.prompt?.kind).toBe("choose-player");
    answer(s, ["p2"]);
    s.as("p2").pass().expectOk();
    settle(s);
    expect(s.host.findCard(s.room, stone.id)?.playerId).toBe("p2");
    expect(zoneOf(s, stone.id)).toBe("base");
  });

  it("[C:Glowstone][R317.1] at the end of your turn it kills itself and deals 5 to your units", () => {
    const s = withCards(["Glowstone", "Caitlyn, Patrolling"]);
    const stone = place(s, "p1", "Glowstone", "base");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(zoneOf(s, stone.id)).toBe("trash");
    expect(zoneOf(s, unit.id)).toBe("trash");
  });

  it("[C:Helm of Suppression][R827] Empower this for [4][Calm]", () => {
    const s = withCards(["Helm of Suppression"]);
    const helm = place(s, "p1", "Helm of Suppression", "base");
    addPool(s, "p1", 4, { Calm: 1 });
    activate(s, "p1", helm, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, helm.id)).toBe(true);
    expect(getCardScript("Helm of Suppression")?.status).toBe("partial");
  });

  it("[C:Sky Cruiser][R423.1] discard a gear, [1], [Tap]: deal 4 to a unit at a battlefield", () => {
    const s = withCards(["Sky Cruiser", "Rage Amplifier"], ["Whiteflame Protector"]);
    const cruiser = place(s, "p1", "Sky Cruiser", "base");
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    addPool(s, "p1", 1);
    activate(s, "p1", cruiser, "activated:0", { "target:0": enemy.id }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(4);
    expect(getCardScript("Sky Cruiser")?.status).toBe("partial");
  });

  it("[C:Shady Spectacles][C:Stargazer] partial scripts are registered", () => {
    expect(getCardScript("Shady Spectacles")?.status).toBe("partial");
    expect(getCardScript("Stargazer")?.status).toBe("partial");
  });
});
