import type { BoardSettings, Room } from "@rift/protocol";

import type { GameActionIntent } from "../slot-types";

export const DEFAULT_BOARD_SETTINGS: BoardSettings = Object.freeze({
  showLegendXpCounter: false,
  stopAtBeginningPhase: false,
  skipDrawPhase: false,
  autoScoreFromHold: true,
});

export function boardSettingsForViewer(
  state: Pick<Room, "boardSettingsByPlayerId">,
  viewerId: string,
): BoardSettings {
  return {
    ...DEFAULT_BOARD_SETTINGS,
    ...(state.boardSettingsByPlayerId?.[viewerId] ?? {}),
  };
}

export type BoardToggleKey =
  | "stop-at-beginning"
  | "skip-draw-phase"
  | "auto-score-from-hold"
  | "xp-counter"
  | "battlefield-might";

export interface BoardToggleLabels {
  stopAtBeginning: string;
  skipDrawPhase: string;
  autoScoreFromHold: string;
  xpCounter: string;
  battlefieldMight: string;
}

export interface BoardToggleItem {
  key: BoardToggleKey;
  label: string;
  enabled: boolean;
  /** Action sent when the row is clicked (flips the current value); `null` for the local toggle. */
  nextIntent: GameActionIntent | null;
}

/** The exact five toggle keys from the original (`0xawjzm3yjpr1.js:22817-22848`). */
export function deriveBoardToggles(
  settings: BoardSettings & { showBattlefieldMight: boolean },
  labels: BoardToggleLabels,
): BoardToggleItem[] {
  return [
    {
      key: "stop-at-beginning",
      label: labels.stopAtBeginning,
      enabled: settings.stopAtBeginningPhase,
      nextIntent: {
        type: "set_stop_at_beginning_phase",
        enabled: !settings.stopAtBeginningPhase,
      },
    },
    {
      key: "skip-draw-phase",
      label: labels.skipDrawPhase,
      enabled: settings.skipDrawPhase,
      nextIntent: { type: "set_skip_draw_phase", enabled: !settings.skipDrawPhase },
    },
    {
      key: "auto-score-from-hold",
      label: labels.autoScoreFromHold,
      enabled: settings.autoScoreFromHold,
      nextIntent: {
        type: "set_auto_score_from_hold",
        enabled: !settings.autoScoreFromHold,
      },
    },
    {
      key: "xp-counter",
      label: labels.xpCounter,
      enabled: settings.showLegendXpCounter,
      nextIntent: {
        type: "set_show_legend_xp_counter",
        visible: !settings.showLegendXpCounter,
      },
    },
    {
      key: "battlefield-might",
      label: labels.battlefieldMight,
      enabled: settings.showBattlefieldMight,
      nextIntent: null,
    },
  ];
}

/** The action sent when a toggle row is clicked (flips the current value). */
export function boardToggleIntent(
  key: BoardToggleKey,
  nextEnabled: boolean,
): GameActionIntent | null {
  switch (key) {
    case "stop-at-beginning":
      return { type: "set_stop_at_beginning_phase", enabled: nextEnabled };
    case "skip-draw-phase":
      return { type: "set_skip_draw_phase", enabled: nextEnabled };
    case "auto-score-from-hold":
      return { type: "set_auto_score_from_hold", enabled: nextEnabled };
    case "xp-counter":
      return { type: "set_show_legend_xp_counter", visible: nextEnabled };
    case "battlefield-might":
      return null;
  }
}

export type DockActionKey =
  "counter" | "buff" | "duplicate" | "label" | "give-control" | "emote" | "dice";

export type ArmedCounter = "white" | "red" | null;

export interface DockActionLabels {
  counter: string;
  counterCancel: string;
  counterWhite: string;
  counterRed: string;
  buff: string;
  buffCancel: string;
  duplicate: string;
  duplicateCancel: string;
  label: string;
  labelCancel: string;
  giveControl: string;
  giveControlCancel: string;
  emote: string;
  dice: string;
}

export interface DockActionItem {
  key: DockActionKey;
  label: string;
  armed: boolean;
  /** Optional accent classes copied from the original armed states. */
  armedClass: string;
}

export interface DeriveDockActionsInput {
  counter: ArmedCounter;
  buffArmed: boolean;
  duplicateArmed: boolean;
  labelArmed: boolean;
  /** Strict (non-manual) play drops the manual label action. */
  hideLabel?: boolean;
  giveControlArmed: boolean;
  emoteActive: boolean;
  diceActive: boolean;
  labels: DockActionLabels;
}

export function deriveDockActions(input: DeriveDockActionsInput): DockActionItem[] {
  return deriveAllDockActions(input).filter((item) => !(input.hideLabel && item.key === "label"));
}

function deriveAllDockActions(input: DeriveDockActionsInput): DockActionItem[] {
  const counterName =
    input.counter === "white"
      ? input.labels.counterWhite
      : input.counter === "red"
        ? input.labels.counterRed
        : "";
  return [
    {
      key: "counter",
      label:
        input.counter === null
          ? input.labels.counter
          : `${input.labels.counterCancel} ${counterName}`.trim(),
      armed: input.counter !== null,
      armedClass:
        input.counter === "white"
          ? "bg-[rgba(241,246,255,0.94)] text-[#101c2e]"
          : input.counter === "red"
            ? "bg-[rgba(126,34,34,0.92)] text-[#ffe8e8]"
            : "",
    },
    {
      key: "buff",
      label: input.buffArmed ? input.labels.buffCancel : input.labels.buff,
      armed: input.buffArmed,
      armedClass: "bg-[rgba(36,106,77,0.86)] text-[#e2fff3]",
    },
    {
      key: "duplicate",
      label: input.duplicateArmed ? input.labels.duplicateCancel : input.labels.duplicate,
      armed: input.duplicateArmed,
      armedClass: "bg-[rgba(20,95,99,0.86)] text-[#e8fffd]",
    },
    {
      key: "label",
      label: input.labelArmed ? input.labels.labelCancel : input.labels.label,
      armed: input.labelArmed,
      armedClass: "bg-[rgba(111,86,28,0.86)] text-[#fff4d9]",
    },
    {
      key: "give-control",
      label: input.giveControlArmed ? input.labels.giveControlCancel : input.labels.giveControl,
      armed: input.giveControlArmed,
      armedClass: "bg-[rgba(26,91,111,0.86)] text-[#ddfbff]",
    },
    {
      key: "emote",
      label: input.labels.emote,
      armed: input.emoteActive,
      armedClass: "bg-[rgba(108,82,34,0.82)] text-[#fff1cd]",
    },
    {
      key: "dice",
      label: input.labels.dice,
      armed: input.diceActive,
      armedClass: "bg-[rgba(108,82,34,0.82)] text-[#fff1cd]",
    },
  ];
}
