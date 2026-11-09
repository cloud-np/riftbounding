/**
 * Strict response windows from real rooms: showdown/combo focus and chain priority. The holder
 * sees the identical respond banner whether or not a legal response exists; the opponent sees only
 * the neutral waiting line.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Room } from "@rift/protocol";
import { redactRoomForViewer } from "@rift/sync";

import { BoardInteractionProvider } from "@/components/board/interaction";
import { ChainSlot } from "@/components/board/chain";
import { GameBoardView } from "@/components/board/layout/GameBoardView";
import { StrictPromptHost } from "../StrictPromptHost";

import { placeUnit, setControl } from "../../../../../../../packages/rules/test/rules/combat/helpers";
import { scenario, type RulesScenario } from "../../../../../../../packages/rules/test/scenarios/dsl";

const noop = () => undefined;

function viewFor(room: Room, viewerId: string): Room {
  return redactRoomForViewer(room, {
    playerId: viewerId,
    viewerRole: "player",
    controlledPlayerIds: [viewerId],
  });
}

function slotProps(room: Room, viewerId: string) {
  return {
    state: room,
    viewerId,
    controlledPlayerIds: [viewerId],
    dispatch: noop,
    mode: "multiplayer" as const,
  };
}

function renderBoard(room: Room, viewerId: string): string {
  const props = slotProps(room, viewerId);
  return renderToStaticMarkup(
    createElement(BoardInteractionProvider, {
      ...props,
      children: createElement(GameBoardView, {
        state: room,
        viewerId,
        layoutHints: {
          showScoreTrack: true,
          connectedPlayerIds: ["p1", "p2"],
          battlefields: {
            own: { zone: "battlefieldA", name: "Altar to Unity" },
            opponent: { zone: "battlefieldB", name: "Bandle Tree" },
          },
        },
        slots: {
          chain: createElement(ChainSlot, { ...props, embedded: true }),
          prompts: createElement(StrictPromptHost, props),
        },
      }),
    }),
  );
}

function renderChain(room: Room, viewerId: string): string {
  return renderToStaticMarkup(createElement(ChainSlot, slotProps(room, viewerId)));
}

function activeAttr(html: string, attr: string): number {
  const escaped = attr.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return (html.match(new RegExp(`(?<!\\[)${escaped}="true"`, "gu")) ?? []).length;
}

/** p1 moves a vanilla unit to their battlefield → non-combat showdown with p1 focus. */
function showdownRoom(withReaction: boolean): { s: RulesScenario; gustId?: string } {
  const s = scenario({
    extraCards: { p1: withReaction ? ["Brazen Buccaneer", "Gust"] : ["Brazen Buccaneer"] },
  });
  placeUnit(s, "p1", "Brazen Buccaneer", "base", "showdown-unit");
  s.as("p1").move("Brazen Buccaneer", "battlefieldA").expectOk();
  // Keep the probe deterministic: only the chosen Reaction is left in hand.
  const board = s.room.players[0]!.board!;
  board.hand = board.hand.filter((card) => withReaction && card.name === "Gust");
  // No-response probe: no ready rune abilities either.
  if (!withReaction) board.runeArea = [];
  return { s, gustId: s.handCard("p1", "Gust")?.id };
}

function combatRoom(): RulesScenario {
  const s = scenario({ battlefields: { p2: "Bandle Tree" } });
  placeUnit(s, "p2", "Treasure Hunter", "battlefieldA", "def-0");
  setControl(s.room, "battlefieldA", "p2");
  placeUnit(s, "p1", "Astral Heron", "base", "atk-0");
  s.as("p1").move("Astral Heron", "battlefieldA").expectOk();
  return s;
}

function chainRoom(): RulesScenario {
  const s = scenario({ p1: { hand: ["Gust", "Defy"], energy: 3, power: { Calm: 1 } } });
  const target = placeUnit(s, "p2", "Treasure Hunter", "battlefieldA", "chain-target");
  s.as("p1").play("Gust", { hold: true, choices: { "target:0": target.id } }).expectOk();
  return s;
}

describe("strict response windows", () => {
  it("showdown focus with a legal Reaction: banner + playable highlight + Pass", () => {
    const { s, gustId } = showdownRoom(true);
    expect(s.room.rules?.showdown?.kind).toBe("non_combat");
    expect(s.room.rules?.focus).toBe("p1");
    const html = renderBoard(viewFor(s.room, "p1"), "p1");
    expect(html).toContain('data-testid="strict-response-banner"');
    expect(html).toContain("Showdown at Altar to Unity");
    expect(html).toContain("You have focus: play an Action or Reaction, or Pass");
    expect(html).toContain('data-testid="strict-response-pass"');
    expect(html).not.toContain('data-testid="strict-response-empty-hint"');
    expect(activeAttr(html, "data-strict-playable")).toBeGreaterThan(0);
    expect(gustId).toBeTruthy();
    expect(html).toContain(`data-card-id="${gustId}"`);
  });

  it("showdown focus with no legal response: same banner, local hint, no auto-pass", () => {
    const { s } = showdownRoom(false);
    const focusBefore = s.room.rules?.focus;
    const passesBefore = [...(s.room.rules?.passes ?? [])];
    const html = renderBoard(viewFor(s.room, "p1"), "p1");
    expect(html).toContain('data-testid="strict-response-banner"');
    expect(html).toContain("Showdown at Altar to Unity");
    expect(html).toContain('data-testid="strict-response-empty-hint"');
    expect(html).toContain("No playable responses right now");
    expect(activeAttr(html, "data-strict-playable")).toBe(0);
    // Rendering is local; the authoritative room did not advance on its own.
    expect(s.room.rules?.focus).toBe(focusBefore);
    expect(s.room.rules?.passes).toEqual(passesBefore);
    // The holder's Pass is the existing rules_pass and advances focus only when a human sends it.
    s.as("p1").pass().expectOk();
    expect(s.room.rules?.focus).toBe("p2");
  });

  it("combat focus window shows the Combat banner and hides response options from the opponent", () => {
    const s = combatRoom();
    expect(s.room.rules?.showdown?.kind).toBe("combat");
    expect(s.room.rules?.focus).toBe("p1");
    const holder = renderBoard(viewFor(s.room, "p1"), "p1");
    expect(holder).toContain("Combat at Altar to Unity");
    expect(holder).toContain('data-strict-response-kind="combat"');
    expect(holder).toContain("You have focus");

    const opponent = renderBoard(viewFor(s.room, "p2"), "p2");
    expect(opponent).not.toContain('data-testid="strict-response-banner"');
    expect(opponent).not.toContain('data-testid="strict-response-empty-hint"');
    expect(renderChain(viewFor(s.room, "p2"), "p2")).toContain("Waiting for Alice (focus)");
  });

  it("chain priority window shows Respond-to banner and neutral opponent waiting line", () => {
    const s = chainRoom();
    expect(s.room.rules?.chain.length).toBeGreaterThan(0);
    expect(s.room.rules?.priority).toBe("p1");
    const holder = renderBoard(viewFor(s.room, "p1"), "p1");
    expect(holder).toContain('data-testid="strict-response-banner"');
    expect(holder).toContain("Respond to Gust");
    expect(holder).toContain("You have priority: play an Action or Reaction, or Pass");
    expect(holder).toContain('data-strict-response-window="priority"');

    const opponent = renderBoard(viewFor(s.room, "p2"), "p2");
    expect(opponent).not.toContain('data-testid="strict-response-banner"');
    expect(opponent).not.toContain("You have priority");
    expect(renderChain(viewFor(s.room, "p2"), "p2")).toContain("Waiting for Alice (priority)");
  });

  it("showdown opponent view stays neutral and never sees the holder's option hint", () => {
    const { s } = showdownRoom(true);
    const opponent = renderBoard(viewFor(s.room, "p2"), "p2");
    expect(opponent).not.toContain('data-testid="strict-response-banner"');
    expect(opponent).not.toContain("You have focus");
    expect(opponent).not.toContain("No playable responses right now");
    expect(renderChain(viewFor(s.room, "p2"), "p2")).toContain("Waiting for Alice (focus)");
  });

  it("prompt banner takes precedence over the response banner", () => {
    const { s } = showdownRoom(true);
    expect(s.room.rules?.focus).toBe("p1");
    s.room.rules!.prompt = {
      id: "prompt-precedence",
      kind: "yes-no",
      playerId: "p1",
      options: [{ id: "yes" }, { id: "no" }],
      min: 1,
      max: 1,
      data: { reason: "play.choice" },
    };
    const html = renderBoard(viewFor(s.room, "p1"), "p1");
    expect(html).toContain('data-testid="strict-prompt"');
    expect(html).not.toContain('data-testid="strict-response-banner"');
  });
});
