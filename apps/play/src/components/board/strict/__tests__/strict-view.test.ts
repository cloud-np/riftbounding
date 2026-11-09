/**
 * Strict UI against a real strict room (R2-int): `@rift/engine` setup + per-viewer redaction
 * (`@rift/sync`) + server-side rendering of the strict components.
 */
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  applyGameAction,
  createInitialGameState,
  strictLegalIntents,
  strictWhoMayAct,
} from "@rift/engine";
import { createTranslator } from "@rift/i18n";
import type { DeckSections, Prompt, Room } from "@rift/protocol";
import { redactRoomForViewer } from "@rift/sync";

import { RulesModeFieldset } from "@/components/room/RoomShell";
import { StrictPromptDialog } from "../StrictPromptDialog";
import { StrictRulesPanel } from "../StrictRulesPanel";

const DECKS = path.resolve(
  __dirname,
  "../../../../../../../packages/rules/test/fixtures/decks.json",
);
const decks = JSON.parse(fs.readFileSync(DECKS, "utf8")) as Record<
  "deckA" | "deckB",
  { raw: string; sections: DeckSections }
>;

let seed = 99;
const ctx = () => ({
  now: 1_760_000_000_000,
  rng: () => {
    seed = (1664525 * seed + 0x3c6ef35f) >>> 0;
    return seed / 0x100000000;
  },
  mode: "multiplayer" as const,
});

function inGame(rulesMode: "strict" | "sandbox"): Room {
  let room = createInitialGameState({
    roomCode: "UI1",
    createdAt: 1,
    phase: "mulligan",
    shuffleDecks: false,
    hostPlayerId: "p1",
    players: [
      { id: "p1", name: "Alice", submittedDeck: decks.deckA, decklistRaw: decks.deckA.raw },
      { id: "p2", name: "Bob", submittedDeck: decks.deckB, decklistRaw: decks.deckB.raw },
    ],
  });
  room.firstPlayerId = "p1";
  if (rulesMode === "strict") room.rulesMode = "strict";
  for (const player of room.players) player.selectedBattlefield = "Bandle Tree";
  for (const actor of ["p1", "p2"]) {
    const result = applyGameAction(room, actor, { type: "submit_mulligan", cardIds: [] }, ctx());
    if (!result.ok) throw new Error(result.error);
    room = result.state;
  }
  return room;
}

const noop = () => undefined;

function panel(room: Room, viewerId: string): string {
  return renderToStaticMarkup(
    createElement(StrictRulesPanel, {
      state: room,
      viewerId,
      controlledPlayerIds: [viewerId],
      dispatch: noop,
    }),
  );
}

describe("strict UI on a real strict room (R2-int)", () => {
  it("[R128.4][R312] legal intents computed on each viewer's redacted room match the server's", () => {
    const room = inGame("strict");
    for (const viewer of ["p1", "p2"]) {
      const view = redactRoomForViewer(room, { playerId: viewer, viewerRole: "player" });
      expect(strictLegalIntents(view, viewer)).toEqual(strictLegalIntents(room, viewer));
      expect(strictWhoMayAct(view)).toEqual(strictWhoMayAct(room));
    }
  });

  it("renders the strict panel only in strict rooms; sandbox renders nothing", () => {
    expect(panel(inGame("sandbox"), "p1")).toBe("");
    const room = inGame("strict");
    const html = panel(redactRoomForViewer(room, { playerId: "p1", viewerRole: "player" }), "p1");
    expect(html).toContain('data-testid="strict-rules-panel"');
    expect(html).toContain("You have priority");
    expect(html).toContain("End turn");
    expect(html).toContain("Concede");
  });

  it("[R410][§5] the waiting player sees why End turn is unavailable", () => {
    const room = inGame("strict");
    const html = panel(redactRoomForViewer(room, { playerId: "p2", viewerRole: "player" }), "p2");
    expect(html).toContain("Alice has priority");
    expect(html).toMatch(/title="[^"]*\(rule [^"]+\)"/u);
  });

  it("[R467.2.c] opens the damage-assignment dialog for the assigner only", () => {
    const room = inGame("strict");
    const unit = room.players[0]!.board!.hand[0]!;
    const prompt: Prompt = {
      id: "dmg-1",
      kind: "damage-assignment",
      playerId: "p1",
      promptKey: "rules.prompt.combatDamageAssignment",
      rule: "467.2.c",
      options: [{ id: unit.id, objectId: unit.id }],
      data: {
        reason: "combat.damage_assignment",
        battlefield: "battlefieldA",
        assignerId: "p1",
        total: 2,
        targets: [{ objectId: unit.id, lethal: 3, tier: 1 }],
        suggested: [{ targetId: unit.id, amount: 2 }],
      },
    };
    room.rules = { ...room.rules!, prompt };
    const own = panel(redactRoomForViewer(room, { playerId: "p1", viewerRole: "player" }), "p1");
    expect(own).toContain('data-testid="strict-prompt"');
    expect(own).toContain("Assign 2 damage");
    expect(own).toContain(`data-strict-target="${unit.id}"`);
    const other = panel(redactRoomForViewer(room, { playerId: "p2", viewerRole: "player" }), "p2");
    expect(other).not.toContain('data-testid="strict-prompt"');
    expect(other).toContain("Waiting for Alice: Assign combat damage");
  });

  it("[R411.2] renders option prompts with a Confirm gate", () => {
    const room = inGame("strict");
    const html = renderToStaticMarkup(
      createElement(StrictPromptDialog, {
        room,
        prompt: {
          id: "pick",
          kind: "choose-battlefield",
          playerId: "p1",
          promptKey: "rules.prompt.chooseShowdownBattlefield",
          options: [
            { id: "battlefieldA", zone: "battlefieldA" },
            { id: "battlefieldB", zone: "battlefieldB" },
          ],
          min: 1,
          max: 1,
          data: { reason: "stage_showdown" },
        },
        t: createTranslator("en"),
        onAnswer: noop,
      }),
    );
    expect(html).toContain("Choose the battlefield for the next showdown");
    expect(html).toContain("Battlefield A");
    expect(html).toContain('data-strict-options="single"');
  });

  it("renders the host's rules-mode toggle with the active mode pressed", () => {
    const html = renderToStaticMarkup(
      createElement(RulesModeFieldset, { rulesMode: "strict", hintId: "h", onChange: noop }),
    );
    expect(html).toContain('data-lobby-rules-mode="strict"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*Strict/su);
    expect(html).toContain("Sandbox");
  });
});
