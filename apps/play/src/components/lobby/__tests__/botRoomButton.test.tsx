import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SidePanel } from "../SidePanel";

function renderPanel(): string {
  return renderToStaticMarkup(
    createElement(SidePanel, {
      signedIn: true,
      playerName: "Alice",
      onPlayerNameChange: () => undefined,
      settings: { table: "duel", format: "bo1", cardPool: "standard" },
      onSettingsChange: () => undefined,
      settingsOpen: false,
      onSettingsOpenChange: () => undefined,
      searching: false,
      onFindMatch: () => undefined,
      onCancelSearch: () => undefined,
      onHostRoom: () => undefined,
      onSoloRoom: () => undefined,
      onBotRoom: () => undefined,
      joinCode: "",
      onJoinCodeChange: () => undefined,
      onJoin: () => undefined,
      onRequireAuth: () => undefined,
      playModeTab: "constructed",
      onPlayModeTabChange: () => undefined,
      radianceDeck: false,
    }),
  );
}

describe("practice-vs-bot lobby button (R4 bot-room)", () => {
  it("renders a Practice vs Bot action next to Solo Room", () => {
    const markup = renderPanel();
    expect(markup).toContain('data-bot-room="true"');
    expect(markup).toContain("Practice vs Bot");
    expect(markup).toContain("Solo Room");
  });
});
