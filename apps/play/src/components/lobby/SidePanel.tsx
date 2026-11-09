"use client";

import { useEffect, useId, useRef } from "react";
import { createTranslator } from "@rift/i18n";

import { strings } from "./strings";
import type { LobbyQuickMatchSettings, LobbyTable, MatchFormat, CardPool } from "./types";
import { Icon } from "@/components/ui/Icon";
import {
  goldActionButton,
  primaryActionButton,
  segmentedActive,
  segmentedButton,
  segmentedInactive,
} from "@/components/ui/buttonStyles";

const TABLES: { value: LobbyTable; label: string; players: number }[] = [
  { value: "duel", label: "1v1", players: 2 },
  { value: "ffa3", label: "1v1v1", players: 3 },
  { value: "ffa4", label: "1v1v1v1", players: 4 },
  { value: "teams", label: "2v2", players: 4 },
];

const RADIANCE_DECK_LOCK = "Deck uses Radiance cards";

const uiText = createTranslator("en");

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />
    </svg>
  );
}

export function quickMatchSummary(settings: LobbyQuickMatchSettings): string {
  const table = TABLES.find((entry) => entry.value === settings.table)?.label ?? "1v1";
  const pool = settings.cardPool === "radiance" ? "Radiance" : "Standard";
  // Original `lX(...).label`, `o8(gameVariant) ? null : matchFormat.toUpperCase()`, poolLabel
  // joined with " · ": 3/4-player tables never show a BO format.
  const parts = [table, settings.table === "duel" ? (settings.format === "bo3" ? "BO3" : "BO1") : null, pool];
  return parts.filter(Boolean).join(" · ");
}

interface MatchSettingsPanelProps {
  settings: LobbyQuickMatchSettings;
  onChange: (settings: LobbyQuickMatchSettings) => void;
  onDone: () => void;
  /** Deck contains Radiance (RAD-*) cards: the Standard pool is locked. */
  radianceDeck: boolean;
}

export function MatchSettingsPanel({
  settings,
  onChange,
  onDone,
  radianceDeck,
}: MatchSettingsPanelProps) {
  const ref = useRef<HTMLElement>(null);
  const baseId = useId();

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (ref.current?.contains(target)) return;
      const trigger = document.querySelector("[data-quick-match-change]");
      if (trigger?.contains(target)) return;
      onDone();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDone();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onDone]);

  return (
    <section
      ref={ref}
      role="dialog"
      aria-label={strings["current.quickMatchSettings.title"]}
      data-quick-match-settings-panel="true"
      className="@container absolute inset-x-0 top-[calc(100%+0.35rem)] z-40 grid scroll-m-2 gap-3.5 border border-[rgba(216,183,110,0.32)] bg-[linear-gradient(180deg,rgba(14,16,23,0.99),rgba(7,11,20,0.99))] px-3.5 pt-2.5 pb-3.5 shadow-[0_18px_44px_rgba(0,0,0,0.58)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[rgba(216,183,110,0.14)] pb-2">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#e7c98b]">
          {strings["current.quickMatchSettings.title"]}
        </p>
        <button
          type="button"
          className="inline-flex min-h-8 items-center justify-center border border-[rgba(132,150,184,0.24)] bg-[rgba(10,18,31,0.7)] px-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-text-soft transition-colors hover:border-[rgba(196,208,226,0.38)] hover:text-text-main pointer-coarse:min-h-11"
          onClick={onDone}
        >
          {strings["sim.done"]}
        </button>
      </div>

      <fieldset className="grid min-w-0 gap-1.5 border-0 p-0 @min-[26rem]:grid-cols-[6.5rem_minmax(0,1fr)] @min-[26rem]:items-center @min-[26rem]:gap-x-3">
        <legend className="sr-only">Table</legend>
        <p
          aria-hidden="true"
          className="text-[0.68rem] leading-tight font-semibold uppercase tracking-[0.14em] text-[#e7c98b]"
        >
          {strings["current.quickMatchSettings.table"]}
        </p>
        <div className="grid min-w-0 gap-1.5 grid-cols-4">
          {TABLES.map((table, index) => {
            const active = settings.table === table.value;
            return (
              <button
                key={table.value}
                type="button"
                aria-pressed={active}
                aria-describedby={index === 0 ? `${baseId}-recommended` : undefined}
                onClick={() => onChange({ ...settings, table: table.value })}
                className={`${segmentedButton} ${active ? segmentedActive : segmentedInactive}`}
              >
                <span className="truncate">{table.label}</span>
                {index === 0 ? (
                  <span
                    aria-hidden="true"
                    data-quick-match-recommended={strings["current.quickMatchSettings.recommended"]}
                    className="absolute top-0 right-0 p-0.5 text-[#f0b46c] after:absolute after:bottom-full after:left-0 after:z-50 after:mb-1 after:hidden after:w-max after:max-w-56 after:rounded-sm after:border after:border-white/15 after:bg-[#0b1422] after:px-2 after:py-1 after:text-left after:text-[0.68rem] after:leading-snug after:font-medium after:tracking-normal after:text-[#eaf7ff] after:shadow-xl after:content-[attr(data-quick-match-recommended)] hover:after:block"
                  >
                    <FlameIcon className="size-3" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <span id={`${baseId}-recommended`} className="sr-only">
          {strings["current.quickMatchSettings.recommended"]}
        </span>
      </fieldset>
      <fieldset className="grid min-w-0 gap-1.5 border-0 p-0 @min-[26rem]:grid-cols-[6.5rem_minmax(0,1fr)] @min-[26rem]:items-center @min-[26rem]:gap-x-3">
        <legend className="sr-only">Format</legend>
        <p
          aria-hidden="true"
          className="text-[0.68rem] leading-tight font-semibold uppercase tracking-[0.14em] text-[#e7c98b]"
        >
          {strings["current.quickMatchSettings.format"]}
        </p>
        <div className="grid min-w-0 gap-1.5 grid-cols-2">
          {(["bo1", "bo3"] as MatchFormat[]).map((formatValue) => {
            const active = settings.format === formatValue;
            const disabled = settings.table !== "duel";
            return (
              <button
                key={formatValue}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                title={disabled ? "3-4 player tables are always Best of 1." : undefined}
                onClick={() => onChange({ ...settings, format: formatValue })}
                className={`${segmentedButton} ${active ? segmentedActive : segmentedInactive} disabled:cursor-not-allowed disabled:opacity-45`}
              >
                <span className="truncate">{formatValue === "bo3" ? "BO3" : "BO1"}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="grid min-w-0 gap-1.5 border-0 p-0 @min-[26rem]:grid-cols-[6.5rem_minmax(0,1fr)] @min-[26rem]:items-center @min-[26rem]:gap-x-3">
        <legend className="sr-only">Card pool</legend>
        <p
          aria-hidden="true"
          className="text-[0.68rem] leading-tight font-semibold uppercase tracking-[0.14em] text-[#e7c98b]"
        >
          {strings["current.quickMatchSettings.cardPool"]}
        </p>
        <div className="grid min-w-0 gap-1.5 grid-cols-2">
          {(
            [
              { value: "standard", label: strings["current.quickMatchSettings.standardPool"] },
              { value: "radiance", label: strings["current.quickMatchSettings.originsPool"] },
            ] as { value: CardPool; label: string }[]
          ).map((pool, index) => {
            const active = settings.cardPool === pool.value;
            const locked = radianceDeck && pool.value === "standard";
            return (
              <button
                key={pool.value}
                type="button"
                aria-pressed={active}
                aria-disabled={locked || undefined}
                aria-describedby={
                  locked
                    ? `${baseId}-radiance-lock`
                    : index === 1
                      ? `${baseId}-pool-recommended`
                      : undefined
                }
                data-quick-match-locked={locked ? RADIANCE_DECK_LOCK : undefined}
                onClick={() => {
                  if (locked) return;
                  onChange({ ...settings, cardPool: pool.value });
                }}
                className={`${segmentedButton} ${active ? segmentedActive : segmentedInactive} ${
                  locked
                    ? "cursor-not-allowed border-[rgba(132,150,184,0.14)] bg-[rgba(10,18,31,0.5)] text-[rgba(189,208,232,0.42)] after:pointer-events-none after:absolute after:bottom-full after:left-0 after:z-50 after:mb-1 after:hidden after:w-max after:max-w-56 after:rounded-sm after:border after:border-white/15 after:bg-[#0b1422] after:px-2 after:py-1 after:text-left after:text-[0.68rem] after:leading-snug after:font-medium after:tracking-normal after:text-[#eaf7ff] after:shadow-xl after:content-[attr(data-quick-match-locked)] hover:after:block focus-visible:after:block"
                    : ""
                }`}
              >
                <span className="truncate">{pool.label}</span>
                {locked ? (
                  <span aria-hidden="true" className="absolute top-0 right-0 p-0.5">
                    <Icon name="lock" className="size-3" strokeWidth={2.2} />
                  </span>
                ) : index === 1 ? (
                  <span
                    aria-hidden="true"
                    data-quick-match-recommended={strings["current.quickMatchSettings.recommended"]}
                    className="absolute top-0 right-0 p-0.5 text-[#f0b46c] after:pointer-events-none after:absolute after:bottom-full after:right-0 after:z-50 after:mb-1 after:hidden after:w-max after:max-w-56 after:rounded-sm after:border after:border-white/15 after:bg-[#0b1422] after:px-2 after:py-1 after:text-left after:text-[0.68rem] after:leading-snug after:font-medium after:tracking-normal after:text-[#eaf7ff] after:shadow-xl after:content-[attr(data-quick-match-recommended)] hover:after:block"
                  >
                    <FlameIcon className="size-3" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <span id={`${baseId}-pool-recommended`} className="sr-only">
          {strings["current.quickMatchSettings.recommended"]}
        </span>
        {radianceDeck ? (
          <p
            id={`${baseId}-radiance-lock`}
            className="text-xs leading-snug text-[#8193aa] @min-[26rem]:col-start-2"
          >
            {strings["current.quickMatchSettings.deckUsesRadianceCards"]}
          </p>
        ) : null}
      </fieldset>
    </section>
  );
}

export interface SidePanelProps {
  signedIn: boolean;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  settings: LobbyQuickMatchSettings;
  onSettingsChange: (settings: LobbyQuickMatchSettings) => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  searching: boolean;
  onFindMatch: () => void;
  onCancelSearch: () => void;
  onHostRoom: () => void;
  onSoloRoom: () => void;
  /** Practice a strict-rules duel against the server-driven bot. */
  onBotRoom: () => void;
  joinCode: string;
  onJoinCodeChange: (code: string) => void;
  onJoin: () => void;
  onRequireAuth: (reason: string) => void;
  joinError?: string | null;
  playModeTab: "constructed" | "radiance";
  onPlayModeTabChange: (mode: "constructed" | "radiance") => void;
  /** Deck contains Radiance cards, so Standard is locked and the Radiance pool is active. */
  radianceDeck: boolean;
}

export function SidePanel({
  signedIn,
  playerName,
  onPlayerNameChange,
  settings,
  onSettingsChange,
  settingsOpen,
  onSettingsOpenChange,
  searching,
  onFindMatch,
  onCancelSearch,
  onHostRoom,
  onSoloRoom,
  onBotRoom,
  joinCode,
  onJoinCodeChange,
  onJoin,
  onRequireAuth,
  joinError,
  playModeTab,
  onPlayModeTabChange,
  radianceDeck,
}: SidePanelProps) {
  const gate = (action: () => void) => {
    if (!signedIn) {
      onRequireAuth(strings["sim.signInToPlay"]);
      return;
    }
    action();
  };
  const summary = quickMatchSummary(settings);

  return (
    <section className="lobby-side-panel lobby-entry-panel grid min-w-0 self-start gap-0">
      <section className="grid gap-3 border-b border-[rgba(112,196,214,0.12)] pb-5">
        <label
          htmlFor="right-rail-player-name"
          className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#b9d6e4]"
        >
          {strings["sim.player"]}
        </label>
        <div className="relative h-11">
          <input
            id="right-rail-player-name"
            className="input-field mb-0! h-full w-full border-[rgba(112,196,214,0.26)] bg-[rgba(10,18,33,0.82)] px-3 py-[0.45rem]"
            placeholder={strings["sim.playerNamePlaceholder"]}
            maxLength={24}
            type="text"
            value={playerName}
            onChange={(event) => onPlayerNameChange(event.currentTarget.value)}
          />
        </div>
      </section>

      <div className="relative grid content-start">
        <section
          className="grid gap-3 border-b border-[rgba(176,188,206,0.16)] py-4"
          aria-labelledby="lobby-quick-match-heading"
        >
          <h2
            id="lobby-quick-match-heading"
            className="text-[0.82rem] font-semibold uppercase tracking-[0.14em] text-[#d4dde9]"
          >
            {strings["sim.quickMatch"]}
          </h2>
          <fieldset className="min-w-0 border-0 p-0">
            <legend className="sr-only">{strings["sim.playMode"]}</legend>
            <div className="grid items-center grid-cols-1">
              <div className="grid grid-cols-2 gap-1 border border-[rgba(132,150,184,0.2)] bg-[rgba(6,12,22,0.72)] p-1">
                <button
                  type="button"
                  aria-pressed={playModeTab === "constructed"}
                  onClick={() => onPlayModeTabChange("constructed")}
                  className={`relative inline-flex min-w-0 items-center justify-center gap-1.5 font-semibold uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#74efff] disabled:cursor-not-allowed min-h-10 px-2 text-[0.76rem] tracking-[0.1em] pointer-coarse:min-h-11 ${
                    playModeTab === "constructed"
                      ? "bg-[rgba(29,67,83,0.94)] text-[#eaf7ff] shadow-[inset_0_0_0_1px_rgba(116,239,255,0.6)]"
                      : "text-[#bdd0e8] hover:bg-[rgba(132,150,184,0.08)] hover:text-[#eaf7ff]"
                  }`}
                >
                  <span className="truncate">{strings["sim.constructed"]}</span>
                </button>
                <button
                  type="button"
                  title={!signedIn ? strings["sim.signInRadiance"] : undefined}
                  aria-pressed={playModeTab === "radiance"}
                  disabled={!signedIn}
                  onClick={() => onPlayModeTabChange("radiance")}
                  className={`relative inline-flex min-w-0 items-center justify-center gap-1.5 font-semibold uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#74efff] disabled:cursor-not-allowed min-h-10 px-2 pr-9 text-[0.76rem] tracking-[0.1em] pointer-coarse:min-h-11 ${
                    playModeTab === "radiance"
                      ? "bg-[rgba(29,67,83,0.94)] text-[#eaf7ff] shadow-[inset_0_0_0_1px_rgba(116,239,255,0.6)]"
                      : "text-[#d8bd84] opacity-85"
                  }`}
                >
                  <span className="grid min-w-0 justify-items-center gap-0.5 leading-none">
                    <span className="relative block">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-x-4 -inset-y-2 bg-[radial-gradient(closest-side,rgba(196,204,255,0.2),rgba(196,204,255,0.06)_55%,transparent)]"
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={strings["sim.radiance"]}
                        loading="lazy"
                        width={1069}
                        height={280}
                        className="relative h-6 w-auto"
                        src="/riftbound/static/sets/radiance-wordmark.webp"
                      />
                    </span>
                    <span className="text-[0.56rem] tracking-[0.18em]">
                      {strings["sim.preRift"]}
                    </span>
                  </span>
                  {!signedIn ? (
                    <Icon name="lock" className="h-3.5 w-3.5 shrink-0" strokeWidth={2.1} />
                  ) : null}
                  <span className="zZWz6q_hanger">
                    <span aria-hidden="true" className="zZWz6q_pin" />
                    <span className="zZWz6q_swing">
                      <span aria-hidden="true" className="zZWz6q_string" />
                      <span className="zZWz6q_tag">NEW</span>
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </fieldset>

          <form
            className="grid gap-3 lobby-quick-match-actions"
            onSubmit={(event) => {
              event.preventDefault();
              if (searching) onCancelSearch();
              else gate(onFindMatch);
            }}
          >
            <div className="relative" data-quick-match-settings="true">
              <div className="flex min-h-11 min-w-0 items-center gap-2 border border-[rgba(132,150,184,0.18)] bg-[rgba(10,18,31,0.56)] pr-1 pl-3 pointer-coarse:min-h-12">
                <p
                  className="min-w-0 flex-1 truncate text-[0.82rem] font-semibold tracking-[0.03em] text-[#dbe7f6]"
                  title={summary}
                  data-quick-match-summary="true"
                >
                  {summary}
                </p>
                <button
                  type="button"
                  data-quick-match-change="true"
                  aria-haspopup="dialog"
                  aria-expanded={settingsOpen}
                  onClick={() => onSettingsOpenChange(!settingsOpen)}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 px-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#9fdff2] transition-colors hover:bg-[rgba(19,32,50,0.62)] hover:text-[#eaf7ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(116,239,255,0.48)] disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:min-h-11"
                >
                  <Icon name="sliders" className="size-3.5" strokeWidth={2.1} />
                  <span>{strings["sim.change"]}</span>
                </button>
              </div>
              {settingsOpen ? (
                <MatchSettingsPanel
                  settings={settings}
                  onChange={onSettingsChange}
                  onDone={() => onSettingsOpenChange(false)}
                  radianceDeck={radianceDeck}
                />
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[10rem] flex-1">
                <span title={!signedIn ? strings["sim.signInToPlay"] : undefined}>
                  <button
                    type="submit"
                    className={`${primaryActionButton} h-12! w-full min-w-0 sm:w-full sm:min-w-0 px-4! text-[0.82rem]!`}
                    aria-busy={searching}
                  >
                    {searching ? strings["sim.cancelSearch"] : strings["sim.findRandomMatch"]}
                  </button>
                </span>
              </div>
            </div>
            {searching ? (
              <p
                className="flex flex-wrap items-center gap-2 border border-[rgba(116,239,255,0.22)] bg-[rgba(10,18,31,0.6)] px-2.5 py-2 text-[0.72rem] text-[#d7eaff]"
                role="status"
              >
                <span
                  className="size-3 shrink-0 rounded-full border-2 border-[rgba(159,223,242,0.2)] border-t-[#9fdff2] motion-safe:animate-spin"
                  aria-hidden="true"
                />
                {strings["sim.searchingOpponent"]}
                <button
                  type="button"
                  className="ml-auto text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-[#9fdff2] underline-offset-2 hover:underline"
                  onClick={onCancelSearch}
                >
                  {strings["sim.cancelSearch"]}
                </button>
              </p>
            ) : null}
          </form>
        </section>

        <section className="lobby-private-play-section grid gap-5 pt-5">
          <div className="grid gap-3">
            <header className="flex items-center gap-3">
              <h2 className="text-[0.82rem] font-semibold uppercase tracking-[0.15em] text-[#f1dfba]">
                {strings["sim.lobby.privatePlay"]}
              </h2>
            </header>
            <div className="grid gap-2 lobby-private-play-actions">
              <span title={!signedIn ? strings["sim.signInToPlay"] : undefined}>
                <button
                  type="button"
                  className={`${primaryActionButton} h-12! min-w-0! w-full sm:w-full sm:min-w-0 px-2! text-[0.82rem]! whitespace-nowrap`}
                  aria-busy="false"
                  onClick={() => gate(onHostRoom)}
                >
                  {strings["sim.hostRoom"]}
                </button>
              </span>
              <span title={!signedIn ? strings["sim.signInToPlay"] : undefined}>
                <button
                  type="button"
                  className={`${goldActionButton} h-12! min-w-0! w-full sm:w-full sm:min-w-0 px-2! text-[0.82rem]! whitespace-nowrap`}
                  aria-busy="false"
                  onClick={() => gate(onSoloRoom)}
                >
                  {strings["sim.soloRoom"]}
                </button>
              </span>
              <span title={!signedIn ? strings["sim.signInToPlay"] : undefined}>
                <button
                  type="button"
                  data-bot-room="true"
                  className={`${goldActionButton} h-12! min-w-0! w-full sm:w-full sm:min-w-0 px-2! text-[0.82rem]! whitespace-nowrap`}
                  aria-busy="false"
                  onClick={() => gate(onBotRoom)}
                >
                  {uiText("sim.practiceVsBot") ?? "Practice vs Bot"}
                </button>
              </span>
            </div>
          </div>

          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              gate(onJoin);
            }}
          >
            <label
              htmlFor="join-code"
              className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#e7c98b]"
            >
              {strings["sim.roomCode"]}
            </label>
            <div className="grid gap-2 lobby-room-code-actions">
              <input
                id="join-code"
                className="input-field mb-0 h-11 border-[rgba(116,239,255,0.2)] bg-[rgba(7,16,30,0.88)] font-mono tracking-[0.18em] uppercase"
                placeholder={strings["sim.roomCodePlaceholder"]}
                maxLength={10}
                type="text"
                value={joinCode}
                onChange={(event) => onJoinCodeChange(event.currentTarget.value.toUpperCase())}
              />
              <span title={!signedIn ? strings["sim.signInToPlay"] : undefined}>
                <button
                  type="submit"
                  className={`${goldActionButton} sm:w-auto sm:min-w-[10rem] h-11 w-full min-w-0 sm:w-full sm:min-w-0 text-[0.78rem]`}
                  aria-busy="false"
                >
                  {strings["sim.joinSpectate"]}
                </button>
              </span>
            </div>
            {joinError ? (
              <p className="text-[0.72rem] text-[#ffd5d5]" role="alert">
                {joinError}
              </p>
            ) : null}
          </form>
        </section>
      </div>
    </section>
  );
}
