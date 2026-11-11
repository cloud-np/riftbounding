"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { createTranslator } from "@rift/i18n";
import type { AutoPassPrefs, AutoPassPrefsUpdate, WireAction } from "@rift/protocol";

import { segmentedActive, segmentedButton, segmentedInactive, smallNeutralButton } from "@/components/ui/buttonStyles";

import type { BoardSlotProps } from "../slot-types";
import {
  activePassUntil,
  autoNotices,
  autoPassIntent,
  autoPassPrefsFor,
  autoPassMode,
  autoPassSeat,
  fastModeUpdate,
  isBotGame,
  END_TURN_CHOICES,
  FORCED_CHOICES,
  passUntilIntent,
  prefsLeak,
  RESPONSE_CHOICES,
  type AutoNotice,
  type AutoPassChoice,
} from "./strict-auto-pass";
import { isStrictRoom } from "./strict-model";

const t = createTranslator("en");
const NOTICE_MS = 4_500;

export type StrictAutoPassPanelProps = Pick<
  BoardSlotProps,
  "state" | "viewerId" | "controlledPlayerIds" | "dispatch" | "dispatchAs"
> & {
  /** Start with the settings open (tests / storybook). */
  defaultOpen?: boolean;
};

function ChoiceRow<T extends string>({
  label,
  choices,
  value,
  onChange,
  testId,
}: {
  label: string;
  choices: readonly AutoPassChoice<T>[];
  value: T;
  onChange: (value: T) => void;
  testId: string;
}) {
  return (
    <fieldset className="m-0 grid gap-[0.18rem] border-0 p-0" data-testid={testId}>
      <legend className="mb-[0.12rem] p-0 text-[0.64rem] font-semibold uppercase tracking-[0.08em] text-[#c5d6ee]">
        {label}
      </legend>
      <div className="grid grid-cols-3 gap-[0.18rem]">
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            aria-pressed={value === choice.value}
            data-auto-pass-choice={choice.value}
            data-auto-pass-leaks={choice.leaks ? "true" : "false"}
            className={`${segmentedButton} ${value === choice.value ? segmentedActive : segmentedInactive} !min-h-9 !text-[0.68rem] leading-[1.15]`}
            onClick={() => onChange(choice.value)}
          >
            <span className="px-[0.1rem]">
              {t(choice.labelKey) ?? choice.fallback}
              {choice.leaks ? " ⚠" : ""}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Strict auto-pass controls (production; docs/rules/auto-pass.md): a compact pill that shows the
 * active override, a settings popover for the viewer's own seat, one-shot "pass until …"
 * buttons, and a fading notice whenever the rules layer acted automatically (log entries
 * `rules.auto.*`), so nobody wonders why a window closed by itself.
 */
export function StrictAutoPassPanel({
  state: room,
  viewerId,
  controlledPlayerIds,
  dispatch,
  dispatchAs,
  defaultOpen = false,
}: StrictAutoPassPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [notices, setNotices] = useState<AutoNotice[]>([]);
  const seenLogId = useRef<string | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const controlled = useMemo(
    () => (controlledPlayerIds.length > 0 ? controlledPlayerIds : [viewerId]),
    [controlledPlayerIds, viewerId],
  );
  const strict = isStrictRoom(room) && room.phase === "in_game";
  const seat = autoPassSeat(room, viewerId, controlled);
  const prefs: AutoPassPrefs | null = strict ? autoPassPrefsFor(room, seat) : null;
  const until = activePassUntil(room, prefs);
  const mode = autoPassMode(prefs);
  const botGame = isBotGame(room);
  const log = room.log;

  // Show only automatic actions that arrive while the board is open (never replay old ones).
  useEffect(() => {
    const last = log.at(-1)?.id ?? null;
    if (seenLogId.current === null) {
      seenLogId.current = last ?? "";
      return;
    }
    const from = log.findIndex((entry) => entry.id === seenLogId.current);
    const fresh = from >= 0 ? log.slice(from + 1) : [];
    seenLogId.current = last ?? seenLogId.current;
    const next = autoNotices(t, fresh);
    if (next.length === 0) return;
    setNotices((current) => [...current, ...next].slice(-4));
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setNotices((current) => current.filter((notice) => !next.some((entry) => entry.id === notice.id)));
    }, NOTICE_MS);
    timers.current.add(timer);
  }, [log]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  if (!strict) return null;

  const send = (intent: WireAction) => {
    if (seat !== viewerId && dispatchAs) dispatchAs(seat, intent);
    else dispatch(intent);
  };
  const update = (prefsUpdate: AutoPassPrefsUpdate) => send(autoPassIntent(prefsUpdate));
  const status = prefs?.hold
    ? (t("rules.ui.autoPass.hold") ?? "Full control (hold priority)")
    : until === "end_of_turn"
      ? (t("rules.ui.autoPass.activeUntilEndOfTurn") ?? "Passing until end of turn")
      : until === "opponent_action"
        ? (t("rules.ui.autoPass.activeUntilOpponent") ?? "Passing until the opponent acts")
        : null;

  return (
    <>
      <div
        className="pointer-events-none fixed left-[0.6rem] top-[2.9rem] z-[152] flex w-[7.8rem] flex-col-reverse items-start justify-end gap-[0.3rem]"
        data-testid="strict-auto-pass"
        data-auto-pass-seat={seat}
        data-auto-pass-until={until ?? ""}
        data-auto-pass-hold={prefs?.hold ? "true" : "false"}
      >
        {open && prefs ? (
          // A room that predates auto-pass shows the manual base the server merges into.
          <div
            className="pointer-events-auto grid w-[min(19rem,calc(100vw-1.2rem))] gap-[0.36rem] rounded-[0.3rem] border border-[rgba(193,210,235,0.38)] bg-[rgba(16,28,46,0.97)] p-[0.45rem] shadow-[0_10px_24px_rgba(2,7,18,0.58)]"
            role="dialog"
            aria-label={t("rules.ui.autoPass.open") ?? "Auto-pass settings"}
            data-testid="strict-auto-pass-settings"
          >
            <div className="grid gap-[0.2rem]" data-testid="strict-auto-pass-fast" data-auto-pass-mode={mode}>
              <label className="flex items-center justify-between gap-[0.5rem] font-[var(--font-ui,Inter,system-ui)] text-[0.85rem] font-semibold text-[var(--rb-text,#ece6da)]">
                <span>
                  {t("rules.ui.autoPass.fastMode") ?? "Fast mode"}
                  {mode === "custom" ? (
                    <span className="ml-[0.35rem] rounded-[0.2rem] bg-white/10 px-[0.3rem] py-[0.05rem] text-[0.65rem] font-medium text-[var(--rb-gold-bright,#f0d48a)]" data-testid="strict-auto-pass-custom">
                      {t("rules.ui.autoPass.custom") ?? "Custom"}
                    </span>
                  ) : null}
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="h-[1.1rem] w-[2rem] cursor-pointer accent-[#c8aa6e]"
                  checked={mode === "fast"}
                  aria-checked={mode === "fast"}
                  data-testid="strict-auto-pass-fast-switch"
                  onChange={(event) => update(fastModeUpdate(event.currentTarget.checked))}
                />
              </label>
              <p className="m-0 font-[var(--font-ui,Inter,system-ui)] text-[0.72rem] leading-[1.35] text-[var(--rb-text-dim,#a39d92)]" data-testid="strict-auto-pass-fast-hint">
                {botGame
                  ? (t("rules.ui.autoPass.fastModeBot") ?? "On by default — there's no opponent to read your timing.")
                  : (t("rules.ui.autoPass.fastModePvp") ??
                    "Auto-pass when you have no legal response. Your opponent can tell from the instant pass that you had none.")}
              </p>
            </div>
            <details className="grid gap-[0.36rem]" data-testid="strict-auto-pass-advanced">
              <summary className="cursor-pointer select-none text-[0.72rem] font-semibold text-[var(--rb-text-dim,#a39d92)]">
                {t("rules.ui.autoPass.advanced") ?? "Advanced"}
              </summary>
              <div className="mt-[0.36rem] grid gap-[0.36rem]">
            <label className="flex items-center justify-between gap-[0.4rem] text-[0.62rem] font-semibold text-[#eef5ff]">
              <span>{t("rules.ui.autoPass.ownItems") ?? "Pass on my own chain items"}</span>
              <input
                type="checkbox"
                checked={prefs.ownItems}
                data-testid="strict-auto-pass-own-items"
                onChange={(event) => update({ ownItems: event.currentTarget.checked })}
              />
            </label>
            <ChoiceRow
              label={t("rules.ui.autoPass.responses") ?? "Response windows"}
              choices={RESPONSE_CHOICES}
              value={prefs.responses}
              onChange={(responses) => update({ responses })}
              testId="strict-auto-pass-responses"
            />
            <ChoiceRow
              label={t("rules.ui.autoPass.forcedPrompts") ?? "Choices with one legal answer"}
              choices={FORCED_CHOICES}
              value={prefs.forcedPrompts}
              onChange={(forcedPrompts) => update({ forcedPrompts })}
              testId="strict-auto-pass-forced"
            />
            <ChoiceRow
              label={t("rules.ui.autoPass.endTurn") ?? "End my turn when there is nothing to do"}
              choices={END_TURN_CHOICES}
              value={prefs.endTurn}
              onChange={(endTurn) => update({ endTurn })}
              testId="strict-auto-pass-end-turn"
            />
            {prefsLeak(prefs) ? (
              <p className="m-0 text-[0.56rem] leading-[1.3] text-[#ffd59a]" data-testid="strict-auto-pass-leak-warning">
                ⚠ {t("rules.ui.autoPass.leakWarning") ?? "Reveals to your opponent that you had no option."}
              </p>
            ) : null}
              </div>
            </details>
            <label className="flex items-center justify-between gap-[0.4rem] text-[0.62rem] font-semibold text-[#eef5ff]">
              <span>{t("rules.ui.autoPass.hold") ?? "Full control (hold priority)"}</span>
              <input
                type="checkbox"
                checked={prefs.hold}
                data-testid="strict-auto-pass-hold"
                onChange={(event) => update({ hold: event.currentTarget.checked })}
              />
            </label>
            <p className="m-0 text-[0.54rem] leading-[1.3] text-[#9fb4cf]">
              {t("rules.ui.autoPass.holdHint") ?? "Hold Ctrl/⌘ while dropping a card to keep priority for that play."}
            </p>
          </div>
        ) : null}
        <div className="pointer-events-auto flex w-full flex-col items-stretch gap-[0.24rem]">
          <button
            type="button"
            className={`${smallNeutralButton} !border-[rgba(193,210,235,0.42)] !bg-[rgba(16,28,46,0.94)] !text-[#e3edfb] hover:!bg-[rgba(30,50,80,0.96)] disabled:!opacity-45 !min-h-7 !px-2 !text-[0.54rem] leading-[1.15]`}
            aria-expanded={open}
            aria-label={t("rules.ui.autoPass.open") ?? "Auto-pass settings"}
            data-testid="strict-auto-pass-toggle"
            onClick={() => setOpen((value) => !value)}
          >
            {t("rules.ui.autoPass.title") ?? "Auto-pass"}
            {status ? ` · ${status}` : ""}
          </button>
          {prefs ? (
            <div className={open ? "contents" : "hidden"}>
              <button
                type="button"
                className={`${smallNeutralButton} !border-[rgba(193,210,235,0.42)] !bg-[rgba(16,28,46,0.94)] !text-[#e3edfb] hover:!bg-[rgba(30,50,80,0.96)] disabled:!opacity-45 !min-h-7 !px-2 !text-[0.54rem] leading-[1.15] ${until === "end_of_turn" ? "!border-[rgba(255,214,126,0.6)] !text-[#fff0cf]" : ""}`}
                aria-pressed={until === "end_of_turn"}
                data-testid="strict-auto-pass-until-eot"
                onClick={() => send(passUntilIntent(room, prefs, "end_of_turn"))}
              >
                {until === "end_of_turn"
                  ? (t("rules.ui.autoPass.cancelPassUntil") ?? "Stop passing")
                  : (t("rules.ui.autoPass.passUntilEndOfTurn") ?? "Pass until end of turn")}
                <kbd className="ml-[0.2rem] rounded-[0.1rem] border border-white/20 bg-black/25 px-[0.18rem] text-[0.5rem]">
                  ⇧W
                </kbd>
              </button>
              <button
                type="button"
                className={`${smallNeutralButton} !border-[rgba(193,210,235,0.42)] !bg-[rgba(16,28,46,0.94)] !text-[#e3edfb] hover:!bg-[rgba(30,50,80,0.96)] disabled:!opacity-45 !min-h-7 !px-2 !text-[0.54rem] leading-[1.15] ${until === "opponent_action" ? "!border-[rgba(255,214,126,0.6)] !text-[#fff0cf]" : ""}`}
                aria-pressed={until === "opponent_action"}
                data-testid="strict-auto-pass-until-opponent"
                onClick={() => send(passUntilIntent(room, prefs, "opponent_action"))}
              >
                {until === "opponent_action"
                  ? (t("rules.ui.autoPass.cancelPassUntil") ?? "Stop passing")
                  : (t("rules.ui.autoPass.passUntilOpponent") ?? "Pass until the opponent acts")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {notices.length > 0 ? (
        <div
          className="pointer-events-none fixed left-1/2 top-[3.2rem] z-[155] grid w-[min(24rem,calc(100%-1rem))] -translate-x-1/2 gap-[0.18rem]"
          role="status"
          aria-live="polite"
          data-testid="strict-auto-notices"
        >
          {notices.map((notice) => (
            <p
              key={notice.id}
              className="m-0 rounded-[0.24rem] border border-[rgba(125,218,237,0.36)] bg-[rgba(9,25,45,0.92)] px-[0.5rem] py-[0.22rem] text-center text-[0.6rem] font-semibold text-[#d7f6fb] shadow-[0_6px_16px_rgba(2,7,18,0.45)]"
              data-auto-notice={notice.key}
            >
              {notice.text}
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}
