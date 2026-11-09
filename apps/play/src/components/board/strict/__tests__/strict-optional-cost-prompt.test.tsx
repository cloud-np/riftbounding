/**
 * 355.1.a optional additional cost prompt on the production strict surface: a hand→battlefield
 * gesture with Azir, Sovereign opens the yes/no dialog with the translated Accelerate title;
 * only the controller sees it. Answering Yes continues the play and the Unit enters ready.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { applyGameAction } from "@rift/engine";
import type { Room } from "@rift/protocol";
import { redactRoomForViewer } from "@rift/sync";

import { scenario } from "../../../../../../../packages/rules/test/scenarios/dsl";
import { StrictPromptHost } from "../StrictPromptHost";

const noop = () => undefined;

function viewFor(room: Room, viewerId: string): Room {
  return redactRoomForViewer(room, {
    playerId: viewerId,
    viewerRole: "player",
    controlledPlayerIds: [viewerId],
  });
}

function renderHost(room: Room, viewerId: string): string {
  return renderToStaticMarkup(
    createElement(StrictPromptHost, {
      state: room,
      viewerId,
      controlledPlayerIds: [viewerId],
      dispatch: noop,
    }),
  );
}

function azirPromptRoom(): { room: Room; azirId: string; promptId: string; ctx: ReturnType<typeof scenario>["ctx"] } {
  const s = scenario({ extraCards: { p1: ["Azir, Sovereign"] }, p1: { energy: 5, power: { Order: 1 } } });
  if (!s.handCard("p1", "Azir, Sovereign")) s.moveDeckCardToHand("p1", "Azir, Sovereign");
  const azirId = s.handCard("p1", "Azir, Sovereign")!.id;
  const played = applyGameAction(s.room, "p1", { type: "move_card", from: "hand", to: "base", cardId: azirId }, s.ctx);
  if (!played.ok) throw new Error(played.error);
  const promptId = played.state.rules?.prompt?.id;
  if (!promptId) throw new Error("the gesture did not open the optional-cost prompt");
  return { room: played.state, azirId, promptId, ctx: s.ctx };
}

describe("strict optional additional cost prompt [R355.1.a][R805.6]", () => {
  it("renders the translated yes/no title for the controller and continues the play on Yes", () => {
    const { room, azirId, promptId, ctx } = azirPromptRoom();
    const html = renderHost(viewFor(room, "p1"), "p1");

    expect(html).toContain('data-testid="strict-prompt"');
    expect(html).toContain('data-prompt-kind="yes-no"');
    expect(html).toContain('data-prompt-reason="play.optional_cost"');
    expect(html).toContain("Pay Accelerate [1][Order] as an additional cost to have Azir, Sovereign enter ready?");
    expect(html).toContain("Yes");
    expect(html).toContain("No");

    // The opponent's view carries only the redacted shell, so no dialog is rendered for them.
    const opponent = renderHost(viewFor(room, "p2"), "p2");
    expect(opponent).not.toContain('data-testid="strict-prompt"');
    expect(opponent).not.toContain("Pay Accelerate");

    const answered = applyGameAction(
      room,
      "p1",
      { type: "rules_choose", promptId, answer: { optionIds: ["yes"] } },
      ctx,
    );
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    expect(answered.state.rules?.prompt).toBeNull();
    const azir = answered.state.players[0]?.board?.base.find((card) => card.id === azirId);
    expect(azir?.exhausted).toBe(false);
  });
});
