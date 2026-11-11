"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GameState } from "@rift/protocol";

import { EmoteWheel, type Emote } from "../emotes";
import { ActionsIcon, TogglesActiveIcon, TogglesIcon } from "../header/icons";
import { useBoardTranslator } from "../sidebar/i18n";
import { setLocalGameSettings, useLocalGameSettings } from "../settings/settings-values";
import type { Dispatch } from "../slot-types";
import {
  boardSettingsForViewer,
  boardToggleIntent,
  deriveBoardToggles,
  type ArmedCounter,
  type BoardToggleItem,
} from "./dock-items";

const ACTION_ROW_CLASS =
  "dock-row group/action relative inline-flex h-[2.22rem] w-full shrink-0 items-center justify-start whitespace-nowrap px-[0.68rem] text-(length:--board-action-font-size) font-semibold leading-none uppercase tracking-[0.055em] text-[#ece6da] transition-[background-color,color] duration-120 disabled:cursor-default disabled:opacity-[0.45] hover:enabled:bg-[rgba(200,170,110,0.12)] hover:enabled:text-[#ece6da] focus-visible:outline-2 focus-visible:outline-[rgba(236,230,218,0.72)] focus-visible:outline-offset-[-1px]";

const TOGGLE_ROW_CLASS =
  "dock-row group/action relative inline-flex h-[2.22rem] w-full shrink-0 items-center justify-start whitespace-nowrap px-[0.68rem] text-(length:--board-action-font-size) font-semibold leading-none uppercase tracking-[0.055em] text-[#ece6da] transition-[background-color,color] duration-120 disabled:cursor-default disabled:opacity-[0.45] hover:enabled:bg-[rgba(200,170,110,0.12)] hover:enabled:text-[#ece6da] focus-visible:outline-2 focus-visible:outline-[rgba(236,230,218,0.72)] focus-visible:outline-offset-[-1px] relative w-full px-[0.72rem] pr-[4.34rem] text-left normal-case tracking-[0.03em]";

const PANEL_CLASS =
  "dock-panel absolute bottom-[calc(100%+0.34rem)] right-0 z-170 m-0 flex w-max max-w-[calc(100vw-1rem)] items-center justify-center overflow-hidden rounded-[0.18rem] border shadow-[inset_0_1px_0_rgba(255,255,255,0.065),0_12px_24px_rgba(9,7,5,0.28)] backdrop-blur-xl backdrop-saturate-150 transition-[max-height,opacity,border-color,background-color,transform] duration-160 ease-[cubic-bezier(0.2,0.7,0.2,1)]";

const PANEL_OPEN =
  "max-h-[18.2rem] translate-y-0 border-[rgba(236,230,218,0.26)] bg-[rgba(19,17,15,0.82)] opacity-100 pointer-events-auto";
const PANEL_CLOSED =
  "max-h-0 translate-y-[0.18rem] border-transparent bg-transparent opacity-0 pointer-events-none";

const TRIGGER_CLASS =
  "dock-trigger group/action relative grid place-items-center rounded-[0.16rem] border border-[rgba(236,230,218,0.24)] bg-[rgba(29,27,25,0.66)] text-[#ece6da] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_5px_12px_rgba(9,7,5,0.18)] backdrop-blur-md backdrop-saturate-150 transition-[border-color,background-color,color,box-shadow] duration-140 hover:border-[rgba(236,230,218,0.4)] hover:bg-[rgba(42,40,38,0.72)] hover:text-[#ece6da] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_7px_16px_rgba(10,8,6,0.22)] focus-visible:outline-2 focus-visible:outline-[rgba(236,230,218,0.72)] focus-visible:outline-offset-1 disabled:cursor-default disabled:opacity-[0.45]";
const ACTIONS_TRIGGER_SIZE = "h-[2.52rem] w-[3.26rem]";
const TOGGLES_TRIGGER_SIZE =
  "h-[2.52rem] w-[3.26rem] rounded-l-[0.08rem] rounded-r-[0.18rem] -ml-px";

const TOGGLE_TRIGGER_STATE =
  "border-[rgba(236,230,218,0.34)] bg-[rgba(43,41,39,0.72)] text-[#ece6da] shadow-[inset_0_1px_0_rgba(236,230,218,0.08),0_5px_12px_rgba(9,7,5,0.2)]";

function ToggleSwitch({ enabled, on, off }: { enabled: boolean; on: string; off: string }) {
  return (
    <span
      className={`relative inline-flex h-[1.18rem] w-[2.72rem] shrink-0 items-center rounded-[0.16rem] border px-[0.12rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition-[border-color,background-color] duration-150 ${
        enabled
          ? "border-[rgba(200,170,110,0.4)] bg-[rgba(70,68,66,0.88)] text-[#ece6da]"
          : "border-[rgba(163,157,146,0.24)] bg-[rgba(36,34,32,0.88)] text-[#ece6da]"
      }`}
    >
      <span
        className={`pointer-events-none absolute inset-y-0 flex items-center text-[0.54rem] font-bold uppercase tracking-[0.075em] transition-[left,right,justify-content] duration-150 ${
          enabled
            ? "left-[0.26rem] right-[1.12rem] justify-start"
            : "left-[1.12rem] right-[0.26rem] justify-end"
        }`}
      >
        {enabled ? on : off}
      </span>
      <span
        className={`pointer-events-none absolute top-1/2 inline-flex h-[0.82rem] w-[0.82rem] -translate-y-1/2 items-center justify-center rounded-[0.08rem] bg-[linear-gradient(180deg,rgba(236,230,218,0.98),rgba(236,230,218,0.96))] text-[rgba(98,96,94,0.9)] shadow-[inset_0_1px_0_rgba(245,250,255,0.72),0_1px_2px_rgba(14,12,10,0.24)] transition-[left,right,transform] duration-150 ${
          enabled ? "right-[0.18rem]" : "left-[0.18rem]"
        }`}
      >
        <span className="inline-grid h-[0.42rem] grid-cols-3 gap-[0.055rem]">
          <span className="w-[0.08rem] rounded-full bg-current opacity-70" />
          <span className="w-[0.08rem] rounded-full bg-current opacity-70" />
          <span className="w-[0.08rem] rounded-full bg-current opacity-70" />
        </span>
      </span>
    </span>
  );
}

export interface BoardActionDockProps {
  state: GameState;
  viewerId: string;
  dispatch: Dispatch;
  locale?: string;
  busy?: boolean;
  /** Optional interaction wiring; when omitted the dock keeps local armed state. */
  armedCounter?: ArmedCounter;
  buffArmed?: boolean;
  duplicateArmed?: boolean;
  labelArmed?: boolean;
  /** Strict (non-manual) play: no manual card labels. */
  hideLabel?: boolean;
  giveControlArmed?: boolean;
  emoteActive?: boolean;
  diceActive?: boolean;
  onArmCounter?: (counter: ArmedCounter) => void;
  onArmBuff?: (armed: boolean) => void;
  onArmDuplicate?: (armed: boolean) => void;
  onArmLabel?: (armed: boolean) => void;
  onArmGiveControl?: (armed: boolean) => void;
  onOpenEmoteWheel?: (anchor: { x: number; y: number }) => void;
  onOpenDiceWheel?: (anchor: { x: number; y: number }) => void;
  onBoardEmote?: (emoteId: string) => void;
  showBattlefieldMight?: boolean;
  onShowBattlefieldMightChange?: (visible: boolean) => void;
}

export function BoardActionDock({
  state,
  viewerId,
  dispatch,
  locale,
  busy = false,
  armedCounter,
  buffArmed,
  duplicateArmed,
  labelArmed,
  hideLabel = false,
  giveControlArmed,
  emoteActive,
  diceActive,
  onArmCounter,
  onArmBuff,
  onArmDuplicate,
  onArmLabel,
  onArmGiveControl,
  onOpenEmoteWheel,
  onOpenDiceWheel,
  onBoardEmote,
  showBattlefieldMight,
  onShowBattlefieldMightChange,
}: BoardActionDockProps) {
  const t = useBoardTranslator(locale);
  const localSettings = useLocalGameSettings();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);
  const togglesButtonRef = useRef<HTMLButtonElement | null>(null);
  const [panel, setPanel] = useState<"actions" | "toggles" | null>(null);
  const [localCounter, setLocalCounter] = useState<ArmedCounter>(null);
  const [localBuff, setLocalBuff] = useState(false);
  const [localDuplicate, setLocalDuplicate] = useState(false);
  const [localLabel, setLocalLabel] = useState(false);
  const [localGiveControl, setLocalGiveControl] = useState(false);
  const [diceMenu, setDiceMenu] = useState(false);
  const [diceAnchor, setDiceAnchor] = useState<{ x: number; y: number } | null>(null);
  const [emoteAnchor, setEmoteAnchor] = useState<{ x: number; y: number } | null>(null);

  const counter = armedCounter === undefined ? localCounter : armedCounter;
  const buff = buffArmed ?? localBuff;
  const duplicate = duplicateArmed ?? localDuplicate;
  const label = labelArmed ?? localLabel;
  const giveControl = giveControlArmed ?? localGiveControl;
  const emoteOpenExternally = emoteActive === true;
  const diceOpenExternally = diceActive === true;

  const boardSettings = useMemo(
    () => ({
      ...boardSettingsForViewer(state, viewerId),
      showBattlefieldMight: showBattlefieldMight ?? localSettings.showBattlefieldMight,
    }),
    [localSettings.showBattlefieldMight, showBattlefieldMight, state, viewerId],
  );

  const toggles = useMemo(
    () =>
      deriveBoardToggles(boardSettings, {
        stopAtBeginning: t("sim.stopAtBeginningPhase") ?? "Stop At Beginning Phase",
        skipDrawPhase: t("current.skipDrawPhase") ?? "Skip Draw Phase",
        autoScoreFromHold: t("sim.autoScoreFromHold") ?? "Auto Score From Hold",
        xpCounter: t("sim.xpCounter") ?? "XP Counter",
        battlefieldMight: t("sim.battlefieldMight.toggleLabel") ?? "Battlefield Might",
      }),
    [boardSettings, t],
  );

  const anyToggleEnabled = toggles.some((toggle) => toggle.enabled);

  const setCounter = useCallback(
    (next: ArmedCounter) => {
      if (onArmCounter) onArmCounter(next);
      else setLocalCounter(next);
    },
    [onArmCounter],
  );
  const setBuff = useCallback(
    (next: boolean) => {
      if (onArmBuff) onArmBuff(next);
      else setLocalBuff(next);
    },
    [onArmBuff],
  );
  const setDuplicate = useCallback(
    (next: boolean) => {
      if (onArmDuplicate) onArmDuplicate(next);
      else setLocalDuplicate(next);
    },
    [onArmDuplicate],
  );
  const setLabel = useCallback(
    (next: boolean) => {
      if (onArmLabel) onArmLabel(next);
      else setLocalLabel(next);
    },
    [onArmLabel],
  );
  const setGiveControl = useCallback(
    (next: boolean) => {
      if (onArmGiveControl) onArmGiveControl(next);
      else setLocalGiveControl(next);
    },
    [onArmGiveControl],
  );

  useEffect(() => {
    if (panel === null && !diceMenu && emoteAnchor === null) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-emote-wheel]")) return;
      setPanel(null);
      setDiceMenu(false);
      setEmoteAnchor(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPanel(null);
      setDiceMenu(false);
      setEmoteAnchor(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [diceMenu, emoteAnchor, panel]);

  const clickAnchor = (element: HTMLElement | null) => {
    const rect = element?.getBoundingClientRect();
    return {
      x: rect ? rect.left + rect.width / 2 : window.innerWidth - 80,
      y: rect ? rect.top - 95 : window.innerHeight - 150,
    };
  };

  const toggleBoardSetting = (toggle: BoardToggleItem) => {
    if (toggle.nextIntent) {
      dispatch(toggle.nextIntent);
      return;
    }
    const next = !toggle.enabled;
    if (onShowBattlefieldMightChange) onShowBattlefieldMightChange(next);
    else setLocalGameSettings({ showBattlefieldMight: next });
  };

  const armCounter = (next: ArmedCounter) => {
    setCounter(next);
    setPanel(null);
  };

  const togglePanel = (next: "actions" | "toggles") => {
    setPanel((current) => (current === next ? null : next));
    setDiceMenu(false);
    setEmoteAnchor(null);
  };

  return (
    <div
      ref={rootRef}
      data-help-anchor="board-controls"
      className="pointer-events-auto relative z-150 inline-flex items-center"
    >
      <button
        ref={actionsButtonRef}
        type="button"
        className={`${TRIGGER_CLASS} ${ACTIONS_TRIGGER_SIZE} ${
          panel === "actions"
            ? "border-[rgba(236,230,218,0.42)] bg-[rgba(42,40,38,0.72)] text-[#ece6da]"
            : ""
        } ${anyToggleEnabled ? "rounded-r-[0.08rem]" : "rounded-[0.18rem]"}`}
        disabled={busy}
        onClick={() => togglePanel("actions")}
        aria-pressed={panel === "actions"}
        aria-label={t("current.openBoardActionPanel") ?? "Open board action panel."}
        aria-expanded={panel === "actions"}
      >
        <ActionsIcon className="h-[1.42rem] w-[1.42rem]" />
        <span className="board-control-label" aria-hidden="true">
          {t("sim.actions") ?? "Actions"}
        </span>
      </button>

      <button
        ref={togglesButtonRef}
        type="button"
        className={`${TRIGGER_CLASS} ${TOGGLES_TRIGGER_SIZE} ${
          anyToggleEnabled ? TOGGLE_TRIGGER_STATE : ""
        } ${panel === "toggles" ? "border-[rgba(236,230,218,0.42)] bg-[rgba(42,40,38,0.72)] text-[#ece6da]" : ""}`}
        disabled={busy}
        onClick={() => togglePanel("toggles")}
        aria-label={t("current.openBoardTogglesPanel") ?? "Open board toggles panel."}
        aria-expanded={panel === "toggles"}
      >
        {anyToggleEnabled ? (
          <TogglesActiveIcon className="h-[1.53rem] w-[1.53rem]" />
        ) : (
          <TogglesIcon className="h-[1.53rem] w-[1.53rem]" />
        )}
        <span className="board-control-label" aria-hidden="true">
          {t("sim.toggles") ?? "Toggles"}
        </span>
      </button>

      <div
        data-board-action-panel="actions"
        aria-hidden={panel !== "actions"}
        inert={panel !== "actions"}
        className={`${PANEL_CLASS} ${panel === "actions" ? PANEL_OPEN : PANEL_CLOSED}`}
      >
        <div className="inline-flex min-w-37 flex-col items-stretch divide-y divide-[rgba(236,230,218,0.12)]">
          <div className="group/counter-option relative inline-flex w-full">
            <button
              type="button"
              className={`${ACTION_ROW_CLASS} ${
                counter === "white"
                  ? "bg-[rgba(236,230,218,0.94)] text-[#1a1816]"
                  : counter === "red"
                    ? "bg-[rgba(126,34,34,0.92)] text-[#ffe8e8]"
                    : ""
              }`}
              disabled={busy}
              onClick={() => armCounter(counter ? null : "white")}
              aria-pressed={counter !== null}
              aria-label={
                counter
                  ? (t("sim.cancelCounterActionAria", {
                      counter:
                        counter === "white"
                          ? (t("sim.counterPlus") ?? "+ Counter")
                          : (t("sim.counterMinus") ?? "- Counter"),
                    }) ?? "Cancel counter action")
                  : (t("sim.armCounterActionAria") ?? "Arm counter action")
              }
            >
              {counter
                ? (t("sim.cancelCounter", {
                    counter:
                      counter === "white"
                        ? (t("sim.counterPlus") ?? "+ Counter")
                        : (t("sim.counterMinus") ?? "- Counter"),
                  }) ?? "Cancel counter")
                : (t("sim.addCountersShortcut") ?? "Add Counters (C)")}
            </button>
            {counter === null ? (
              <div className="absolute inset-0 grid grid-cols-2 overflow-visible opacity-0 pointer-events-none transition-opacity duration-120 group-hover/counter-option:opacity-100 group-hover/counter-option:pointer-events-auto">
                <button
                  type="button"
                  className="group/action relative h-full overflow-visible border-r border-[rgba(236,230,218,0.16)] bg-[rgba(102,32,36,0.94)] text-[1.22rem] font-black leading-none text-[#ffe8e8] transition-[background-color,color] hover:bg-[rgba(126,39,43,0.96)]"
                  disabled={busy}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    armCounter("red");
                  }}
                  aria-label={t("current.applyMinusCounter") ?? "Apply minus counter"}
                >
                  -
                </button>
                <button
                  type="button"
                  className="group/action relative h-full overflow-visible bg-[rgba(236,230,218,0.96)] text-[1.22rem] font-black leading-none text-[#292725] transition-[background-color,color] hover:bg-[rgba(236,230,218,0.98)]"
                  disabled={busy}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    armCounter("white");
                  }}
                  aria-label={t("current.applyPlusCounter") ?? "Apply plus counter"}
                >
                  +
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className={`${ACTION_ROW_CLASS} ${buff ? "bg-[rgba(36,106,77,0.86)] text-[#e2fff3]" : ""}`}
            disabled={busy}
            onClick={() => {
              setBuff(!buff);
              setPanel(null);
            }}
            aria-pressed={buff}
            aria-label={
              buff
                ? (t("sim.cancelBuffActionAria") ?? "Cancel buff action")
                : (t("sim.armBuffActionAria") ?? "Arm buff action")
            }
          >
            {buff
              ? (t("sim.cancelBuff") ?? "Cancel Buff")
              : (t("sim.applyBuffShortcut") ?? "Apply Buff (B)")}
          </button>

          <button
            type="button"
            className={`${ACTION_ROW_CLASS} ${duplicate ? "bg-[rgba(73,71,69,0.86)] text-[#ece6da]" : ""}`}
            disabled={busy}
            onClick={() => {
              setDuplicate(!duplicate);
              setPanel(null);
            }}
            aria-pressed={duplicate}
            aria-label={
              duplicate
                ? (t("sim.cancelDuplicateActionAria") ?? "Cancel duplicate action")
                : (t("sim.armDuplicateActionAria") ?? "Arm duplicate action")
            }
          >
            {duplicate
              ? (t("sim.cancelDuplicateShortcut") ?? "Cancel Duplicate (⇧C)")
              : (t("sim.duplicateShortcut") ?? "Duplicate (⇧C)")}
          </button>

          {hideLabel ? null : (
          <button
            type="button"
            className={`${ACTION_ROW_CLASS} ${label ? "bg-[rgba(111,86,28,0.86)] text-[#fff4d9]" : ""}`}
            disabled={busy}
            onClick={() => {
              setLabel(!label);
              setPanel(null);
            }}
            aria-pressed={label}
            aria-label={
              label
                ? (t("sim.cancelLabelActionAria") ?? "Cancel card label action")
                : (t("sim.armLabelActionAria") ?? "Arm card label action")
            }
          >
            {label
              ? (t("sim.cancelLabelShortcut") ?? "Cancel Label (L)")
              : (t("sim.labelCardShortcut") ?? "Label Card (L)")}
          </button>
          )}

          <button
            type="button"
            className={`${ACTION_ROW_CLASS} ${giveControl ? "bg-[rgba(73,71,69,0.86)] text-[#ece6da]" : ""}`}
            disabled={busy}
            onClick={() => {
              setGiveControl(!giveControl);
              setPanel(null);
            }}
            aria-pressed={giveControl}
            aria-label={
              giveControl
                ? (t("sim.cancelGiveControlActionAria") ?? "Cancel give control action")
                : (t("sim.armGiveControlActionAria") ?? "Arm give control action")
            }
          >
            {giveControl
              ? (t("sim.cancelGiveControl") ?? "Cancel Give Control")
              : (t("sim.giveControl") ?? "Give Control")}
          </button>

          <button
            type="button"
            className={`${ACTION_ROW_CLASS} ${emoteOpenExternally || emoteAnchor ? "bg-[rgba(108,82,34,0.82)] text-[#fff1cd]" : ""}`}
            disabled={busy}
            onClick={(event) => {
              const anchor = clickAnchor(event.currentTarget);
              if (onOpenEmoteWheel) onOpenEmoteWheel(anchor);
              else setEmoteAnchor(anchor);
              setPanel(null);
            }}
            aria-pressed={emoteOpenExternally || emoteAnchor !== null}
            aria-label={t("current.openEmoteWheelShortcutE") ?? "Open emote wheel. Shortcut: E."}
          >
            {t("sim.emoteShortcut") ?? "Emote (E)"}
          </button>

          <button
            type="button"
            className={`${ACTION_ROW_CLASS} ${diceOpenExternally || diceMenu ? "bg-[rgba(108,82,34,0.82)] text-[#fff1cd]" : ""}`}
            disabled={busy}
            onClick={(event) => {
              const anchor = clickAnchor(event.currentTarget);
              if (onOpenDiceWheel) onOpenDiceWheel(anchor);
              else {
                setDiceAnchor(anchor);
                setDiceMenu((current) => !current);
              }
              setPanel(null);
            }}
            aria-pressed={diceOpenExternally || diceMenu}
            aria-label={t("current.openDiceWheelShortcutShiftR") ?? "Choose a die and roll it."}
          >
            {t("sim.rollDieShortcut") ?? "Roll a die (Shift+R)"}
          </button>
        </div>
      </div>

      <div
        data-board-action-panel="toggles"
        aria-hidden={panel !== "toggles"}
        inert={panel !== "toggles"}
        className={`${PANEL_CLASS} ${panel === "toggles" ? PANEL_OPEN : PANEL_CLOSED}`}
      >
        <div className="inline-flex min-w-47 flex-col items-stretch divide-y divide-[rgba(236,230,218,0.12)]">
          {toggles.map((toggle) => (
            <button
              key={toggle.key}
              type="button"
              className={`${TOGGLE_ROW_CLASS} ${toggle.enabled ? "bg-[rgba(71,69,67,0.54)] text-[#ece6da]" : ""}`}
              disabled={busy}
              onClick={() => toggleBoardSetting(toggle)}
              data-board-toggle={toggle.key}
              data-board-toggle-label={toggle.label}
              aria-pressed={toggle.enabled}
              aria-label={
                toggle.enabled
                  ? (t("current.disableSetting", { setting: toggle.label }) ??
                    `Disable ${toggle.label}`)
                  : (t("current.enableSetting", { setting: toggle.label }) ??
                    `Enable ${toggle.label}`)
              }
            >
              <span className="min-w-0 justify-self-start text-left text-[0.72rem] font-semibold uppercase tracking-[0.045em]">
                {toggle.label}
              </span>
              <span className="absolute right-[0.72rem] top-1/2 w-[2.72rem] -translate-y-1/2">
                <ToggleSwitch
                  enabled={toggle.enabled}
                  on={t("sim.on") ?? "On"}
                  off={t("sim.off") ?? "Off"}
                />
              </span>
            </button>
          ))}
        </div>
      </div>

      {diceMenu && diceAnchor ? (
        <div
          data-dice-menu="true"
          className="absolute bottom-[calc(100%+0.42rem)] right-0 z-170 flex items-center gap-[0.18rem] rounded-[0.22rem] border border-[rgba(236,230,218,0.3)] bg-[rgba(19,17,15,0.96)] p-[0.3rem] shadow-[0_12px_24px_rgba(9,7,5,0.4)]"
          style={{ maxWidth: "calc(100vw - 1rem)" }}
        >
          {([4, 6, 8, 10, 12, 20] as const).map((sides) => (
            <button
              key={sides}
              type="button"
              className="inline-flex h-[1.8rem] min-w-[1.8rem] items-center justify-center rounded-[0.16rem] border border-[rgba(236,230,218,0.24)] bg-[rgba(40,38,36,0.9)] text-[0.68rem] font-bold text-[#ece6da] transition-colors hover:bg-[rgba(65,63,61,0.94)]"
              onClick={() => {
                dispatch({ type: "roll_die", sides });
                setDiceMenu(false);
              }}
            >
              d{sides}
            </button>
          ))}
        </div>
      ) : null}

      <EmoteWheel
        open={emoteAnchor !== null}
        anchor={emoteAnchor}
        locale={locale}
        onClose={() => setEmoteAnchor(null)}
        onSelect={(emote: Emote) => onBoardEmote?.(emote.id)}
      />
    </div>
  );
}
