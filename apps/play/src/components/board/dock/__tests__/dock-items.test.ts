import { describe, expect, it } from "vitest";

import {
  boardSettingsForViewer,
  boardToggleIntent,
  deriveBoardToggles,
  deriveDockActions,
  type DockActionLabels,
} from "../dock-items";

const labels = {
  stopAtBeginning: "Stop At Beginning Phase",
  skipDrawPhase: "Skip Draw Phase",
  autoScoreFromHold: "Auto Score From Hold",
  xpCounter: "XP Counter",
  battlefieldMight: "Battlefield Might",
};

const dockLabels: DockActionLabels = {
  counter: "Add Counters (C)",
  counterCancel: "Cancel",
  counterWhite: "+ Counter",
  counterRed: "- Counter",
  buff: "Apply Buff (B)",
  buffCancel: "Cancel Buff",
  duplicate: "Duplicate (⇧C)",
  duplicateCancel: "Cancel Duplicate (⇧C)",
  label: "Label Card (L)",
  labelCancel: "Cancel Label (L)",
  giveControl: "Give Control",
  giveControlCancel: "Cancel Give Control",
  emote: "Emote (E)",
  dice: "Roll a die (Shift+R)",
};

describe("boardSettingsForViewer", () => {
  it("defaults to the original board settings", () => {
    expect(boardSettingsForViewer({}, "p1")).toEqual({
      showLegendXpCounter: false,
      stopAtBeginningPhase: false,
      skipDrawPhase: false,
      autoScoreFromHold: true,
    });
  });

  it("reads the viewer's settings", () => {
    expect(
      boardSettingsForViewer(
        {
          boardSettingsByPlayerId: {
            p1: {
              showLegendXpCounter: true,
              stopAtBeginningPhase: true,
              skipDrawPhase: true,
              autoScoreFromHold: false,
            },
          },
        },
        "p1",
      ),
    ).toEqual({
      showLegendXpCounter: true,
      stopAtBeginningPhase: true,
      skipDrawPhase: true,
      autoScoreFromHold: false,
    });
  });
});

describe("deriveBoardToggles", () => {
  it("emits the exact five original toggle keys", () => {
    const toggles = deriveBoardToggles(
      {
        showLegendXpCounter: false,
        stopAtBeginningPhase: false,
        skipDrawPhase: false,
        autoScoreFromHold: true,
        showBattlefieldMight: true,
      },
      labels,
    );
    expect(toggles.map((toggle) => toggle.key)).toEqual([
      "stop-at-beginning",
      "skip-draw-phase",
      "auto-score-from-hold",
      "xp-counter",
      "battlefield-might",
    ]);
    expect(toggles.map((toggle) => toggle.label)).toEqual(Object.values(labels));
  });

  it("builds the next-value wire intent for every server toggle", () => {
    const toggles = deriveBoardToggles(
      {
        showLegendXpCounter: true,
        stopAtBeginningPhase: false,
        skipDrawPhase: true,
        autoScoreFromHold: true,
        showBattlefieldMight: false,
      },
      labels,
    );
    expect(toggles[0]?.nextIntent).toEqual({ type: "set_stop_at_beginning_phase", enabled: true });
    expect(toggles[1]?.nextIntent).toEqual({ type: "set_skip_draw_phase", enabled: false });
    expect(toggles[2]?.nextIntent).toEqual({ type: "set_auto_score_from_hold", enabled: false });
    expect(toggles[3]?.nextIntent).toEqual({ type: "set_show_legend_xp_counter", visible: false });
    expect(toggles[4]?.nextIntent).toBeNull();
  });
});

describe("boardToggleIntent", () => {
  it("matches the original wire payloads", () => {
    expect(boardToggleIntent("stop-at-beginning", true)).toEqual({
      type: "set_stop_at_beginning_phase",
      enabled: true,
    });
    expect(boardToggleIntent("skip-draw-phase", false)).toEqual({
      type: "set_skip_draw_phase",
      enabled: false,
    });
    expect(boardToggleIntent("auto-score-from-hold", true)).toEqual({
      type: "set_auto_score_from_hold",
      enabled: true,
    });
    expect(boardToggleIntent("xp-counter", true)).toEqual({
      type: "set_show_legend_xp_counter",
      visible: true,
    });
    expect(boardToggleIntent("battlefield-might", true)).toBeNull();
  });
});

describe("deriveDockActions", () => {
  it("derives the seven original action rows", () => {
    const actions = deriveDockActions({
      counter: null,
      buffArmed: false,
      duplicateArmed: false,
      labelArmed: false,
      giveControlArmed: false,
      emoteActive: false,
      diceActive: false,
      labels: dockLabels,
    });
    expect(actions.map((action) => action.key)).toEqual([
      "counter",
      "buff",
      "duplicate",
      "label",
      "give-control",
      "emote",
      "dice",
    ]);
    expect(actions.every((action) => !action.armed)).toBe(true);
  });

  it("switches labels when armed", () => {
    const actions = deriveDockActions({
      counter: "white",
      buffArmed: true,
      duplicateArmed: true,
      labelArmed: true,
      giveControlArmed: true,
      emoteActive: true,
      diceActive: true,
      labels: dockLabels,
    });
    expect(actions[0]?.label).toBe("Cancel + Counter");
    expect(actions[1]?.label).toBe("Cancel Buff");
    expect(actions[2]?.label).toBe("Cancel Duplicate (⇧C)");
    expect(actions[3]?.label).toBe("Cancel Label (L)");
    expect(actions[4]?.label).toBe("Cancel Give Control");
    expect(actions.every((action) => action.armed)).toBe(true);
  });
});
