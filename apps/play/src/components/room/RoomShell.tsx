"use client";

import { useEffect, useId, useRef, useState } from "react";

import { createTranslator } from "@rift/i18n";

import { format, strings } from "@/components/lobby/strings";
import type {
  DeckRulesMode,
  GameVariant,
  MatchFormat,
  PlayMode,
  RoomSeat,
  RoomState,
  RulesMode,
} from "@/components/lobby/types";
import { Icon } from "@/components/ui/Icon";
import {
  roomReadyButton,
  roomSmallButton,
  roomStartButton,
  roomStartButtonIdle,
  roomStartButtonReady,
  segmentedActive,
  segmentedButton,
  segmentedInactive,
} from "@/components/ui/buttonStyles";

const VARIANTS: { value: GameVariant; label: string; capacity: number }[] = [
  { value: "duel", label: "1v1", capacity: 2 },
  { value: "free_for_all_3", label: "1v1v1", capacity: 3 },
  { value: "free_for_all_4", label: "1v1v1v1", capacity: 4 },
  { value: "teams_2v2", label: "2v2", capacity: 4 },
];

export function capacityOf(variant: GameVariant): number {
  return VARIANTS.find((entry) => entry.value === variant)?.capacity ?? 2;
}

export function variantLabel(variant: GameVariant): string {
  return VARIANTS.find((entry) => entry.value === variant)?.label ?? "1v1";
}

export interface RoomShellProps {
  room: RoomState;
  onCopyRoomCode: () => Promise<boolean> | boolean;
  onCopyInviteLink: () => Promise<boolean> | boolean;
  onLeaveRoom: () => void;
  onSetReady: (ready: boolean) => void;
  onTakeSeat: () => void;
  onSwitchToSpectator: () => void;
  onSwitchSeat: (seat: number) => void;
  onRandomizeTeams: () => void;
  onUpdateRoomSettings: (patch: {
    variant?: GameVariant;
    playMode?: PlayMode;
    format?: MatchFormat;
    deckRules?: DeckRulesMode;
    rulesMode?: RulesMode;
  }) => void;
  onStartMatch: () => void;
  onCreateNextGame: () => void;
  onReturnToLobby: () => void;
  onSendChat: (text: string) => void;
  onLoadDeck: () => void;
  onToast: (message: string, tone?: "info" | "success" | "error") => void;
}

export function RoomShell({
  room,
  onCopyRoomCode,
  onCopyInviteLink,
  onLeaveRoom,
  onSetReady,
  onTakeSeat,
  onSwitchToSpectator,
  onSwitchSeat,
  onRandomizeTeams,
  onUpdateRoomSettings,
  onStartMatch,
  onCreateNextGame,
  onReturnToLobby,
  onSendChat,
  onLoadDeck,
  onToast,
}: RoomShellProps) {
  const [setupOpen, setSetupOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [inviteState, setInviteState] = useState<"idle" | "copied" | "failed">("idle");
  const setupRef = useRef<HTMLElement>(null);
  const setupTriggerRef = useRef<HTMLButtonElement>(null);

  const me = room.seats.find((seat) => seat?.id === room.myId) ?? null;
  const isHost = room.hostId === room.myId;
  const occupied = room.seats.filter((seat): seat is RoomSeat => Boolean(seat));
  const capacity = capacityOf(room.variant);
  const seated = occupied.length;
  const readyCount = occupied.filter((seat) => seat.ready).length;
  const spectator = room.viewerRole === "spectator";
  const singlePlayer = room.roomMode === "single_player";
  const showStart = isHost && !spectator;
  const canStart = singlePlayer
    ? Boolean(me?.deckReady) && !room.started && !spectator
    : seated >= capacity && readyCount >= capacity && !room.started && !spectator;
  const startDisabledReason = singlePlayer
    ? "Load a deck to start the match."
    : seated < capacity
      ? format(strings["sim.lobby.waitingForSeats"], {
          count: capacity - seated,
          joined: seated,
          expected: capacity,
        })
      : readyCount < capacity
        ? format(strings["sim.lobby.waitingForReady"], {
            count: capacity - readyCount,
            ready: readyCount,
            expected: capacity,
          })
        : null;

  useEffect(() => {
    if (!setupOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (setupRef.current?.contains(target)) return;
      if (setupTriggerRef.current?.contains(target)) return;
      setSetupOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSetupOpen(false);
        setupTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [setupOpen]);

  useEffect(() => {
    if (!copiedCode) return;
    const timer = window.setTimeout(() => setCopiedCode(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copiedCode]);

  // Phone room shell: bring the room console's header up under the fixed lobby header
  // (the original phone layout focuses the room once it opens). `scroll-mt` reserves
  // the same 8rem the original `.lobby-shell` uses at narrow widths, so the header is
  // never obscured by the page header.
  const consoleRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 47.99rem)").matches) return;
    consoleRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, []);

  const copyCode = async () => {
    const ok = await onCopyRoomCode();
    if (ok) {
      setCopiedCode(true);
      onToast(strings["sim.roomCodeCopied"], "success");
    } else {
      onToast(strings["sim.copyFailed"], "error");
    }
  };

  const copyInvite = async () => {
    const ok = await onCopyInviteLink();
    setInviteState(ok ? "copied" : "failed");
    onToast(
      ok
        ? strings["sim.lobby.invite.copiedAnnouncement"]
        : strings["sim.lobby.invite.failedAnnouncement"],
      ok ? "success" : "error",
    );
    if (ok) {
      window.setTimeout(() => setInviteState("idle"), 1800);
    }
  };

  const summaryLabel = `${variantLabel(room.variant)} · ${
    room.playMode === "sealed" ? strings["common.sealed"] : strings["sim.constructed"]
  }`;
  const formatLabel = room.format === "bo3" ? strings["sim.bestOf3"] : strings["sim.bestOf1"];
  const deckRulesLabel =
    room.deckRules === "unrestricted"
      ? strings["current.unrestricted"]
      : strings["current.standard"];

  return (
    <section
      ref={consoleRef}
      data-lobby-room-console=""
      className="lobby-room-console scroll-mt-[8.5rem] grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_clamp(7.5rem,20dvh,10.5rem)] gap-0"
    >
      <div className="lobby-room-header grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2">
        <div className="lobby-invite-code-shell min-w-0">
          <button
            type="button"
            className="lobby-invite-code-card group relative grid h-full w-full min-w-0 items-center gap-x-2 gap-y-1 px-1 py-1 text-left transition-colors duration-150 hover:bg-[rgba(231,201,139,0.035)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(116,239,255,0.4)]"
            onClick={copyCode}
            aria-label={copiedCode ? strings["sim.roomCodeCopied"] : strings["sim.copyRoomCode"]}
          >
            <p className="lobby-invite-code-label text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#e7c98b]">
              Room Code
            </p>
            <code className="lobby-invite-code-value min-w-0 font-mono text-[1.34rem] tracking-[0.18em] whitespace-nowrap text-[#fff2d7] sm:text-[1.55rem]">
              {room.code}
            </code>
            <div className="flex items-center justify-end">
              <span className="lobby-invite-code-copy flex h-8 w-8 items-center justify-center bg-transparent text-[#bcd2eb] transition-[background-color,color] group-hover:bg-[rgba(116,239,255,0.07)] group-hover:text-[#e4f4ff]">
                <Icon
                  name={copiedCode ? "check" : "copy"}
                  className={`h-4 w-4 ${copiedCode ? "text-[#9ed7ff]" : ""}`}
                />
              </span>
            </div>
            <span
              className={`pointer-events-none absolute right-3 bottom-full z-20 mb-2 translate-y-1 border border-[rgba(116,239,255,0.24)] bg-[rgba(8,14,24,0.96)] px-2 py-1 text-[0.62rem] font-semibold tracking-[0.08em] whitespace-nowrap text-[#d7eaff] uppercase opacity-0 shadow-[0_8px_20px_rgba(0,0,0,0.28)] transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 ${
                copiedCode ? "translate-y-0 opacity-100" : ""
              }`}
              aria-live="polite"
            >
              {copiedCode ? strings["sim.copied"] : strings["sim.tapToCopy"]}
            </span>
          </button>
        </div>
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-center border border-[rgba(231,201,139,0.16)] bg-[rgba(83,55,30,0.26)] px-2.5 text-[0.66rem] font-semibold uppercase tracking-[0.1em] whitespace-nowrap text-[#e2c78d] transition-[border-color,background-color,color] duration-150 hover:border-[rgba(231,201,139,0.3)] hover:bg-[rgba(83,55,30,0.42)] hover:text-[#fff0c9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(231,201,139,0.4)]"
          onClick={onLeaveRoom}
        >
          {singlePlayer ? strings["sim.leaveRoomButton"] : strings["sim.backToLobby"]}
        </button>
      </div>

      <div
        data-lobby-room-status=""
        className="lobby-room-commandbar relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
      >
        <div className="min-w-0">
          <p
            className="truncate text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-[#eaf7ff]"
            title={`${summaryLabel} · ${formatLabel} · ${deckRulesLabel}`}
          >
            {summaryLabel}
          </p>
          <p className="truncate text-[0.58rem] uppercase tracking-[0.08em] text-text-dim">
            {formatLabel} · {deckRulesLabel}
          </p>
        </div>
        <div className="lobby-room-command-actions flex items-center justify-end gap-1">
          {isHost && !spectator ? (
            <button
              ref={setupTriggerRef}
              type="button"
              className={roomSmallButton}
              aria-label={strings["sim.editRoomSetup"]}
              aria-haspopup="dialog"
              aria-expanded={setupOpen}
              onClick={() => setSetupOpen((value) => !value)}
            >
              {strings["sim.roomSetup"]}
            </button>
          ) : null}
          {showStart ? (
            <button
              type="button"
              className={`${roomStartButton} ${canStart ? roomStartButtonReady : roomStartButtonIdle}`}
              disabled={!canStart}
              title={startDisabledReason ?? undefined}
              onClick={onStartMatch}
            >
              {strings["sim.startMatch"]}
            </button>
          ) : null}
        </div>
        {setupOpen && isHost ? (
          <RoomSetupPanel
            ref={setupRef}
            room={room}
            onChange={onUpdateRoomSettings}
            onDone={() => {
              setSetupOpen(false);
              setupTriggerRef.current?.focus();
            }}
          />
        ) : null}
      </div>

      <div
        data-lobby-room-workspace=""
        className="lobby-room-console-panel min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain px-1 pr-1 scrollbar-gutter-stable"
      >
        <div className="flex min-h-full flex-col">
          <div className="grid gap-1 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#9fdff2]">
                {singlePlayer
                  ? strings["sim.lobby.singlePlayerSetup"]
                  : strings["sim.lobby.playerReadiness"]}
              </p>
              {!singlePlayer ? (
                <div className="flex min-w-0 flex-wrap items-start justify-end gap-x-2 gap-y-1">
                  <span
                    className="pt-1 text-[0.58rem] uppercase tracking-[0.08em] text-text-dim"
                    aria-live="polite"
                  >
                    {variantLabel(room.variant)} · {readyCount}/{capacity} {strings["sim.ready"]}
                  </span>
                  {room.variant === "teams_2v2" && isHost ? (
                    <RandomizeTeamsButton
                      occupiedSeatCount={seated}
                      onRandomize={onRandomizeTeams}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="grid">
              {room.seats.map((seat, index) => (
                <SeatRow
                  key={seat?.id ?? `seat-${index}`}
                  seat={seat}
                  index={index}
                  room={room}
                  isSelf={!spectator && seat?.id === room.myId}
                  canTakeSeat={spectator}
                  onSetReady={onSetReady}
                  onTakeSeat={onTakeSeat}
                  onSwitchSeat={onSwitchSeat}
                  onInvite={copyInvite}
                  inviteState={inviteState}
                  onLoadDeck={onLoadDeck}
                />
              ))}
            </div>
          </div>

          <div className="inline-grid justify-items-end gap-0.5">
            <button
              type="button"
              className={`inline-flex min-w-20 items-center justify-center border bg-[rgba(13,29,46,0.54)] px-2.5 py-[0.34rem] text-[0.62rem] font-semibold uppercase tracking-[0.1em] transition-[border-color,background-color,color,transform] hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(116,239,255,0.4)] ${
                inviteState === "copied"
                  ? "border-[rgba(120,221,183,0.36)] text-[#d4ffea]"
                  : inviteState === "failed"
                    ? "border-[rgba(242,138,138,0.46)] text-[#ffd5d5]"
                    : "border-[rgba(132,150,184,0.2)] text-[#c7d5e7] hover:border-[rgba(116,239,255,0.32)] hover:text-[#f4fbff]"
              }`}
              aria-label={
                inviteState === "copied"
                  ? strings["sim.lobby.invite.copiedLabel"]
                  : inviteState === "failed"
                    ? strings["sim.lobby.invite.retryLabel"]
                    : strings["sim.lobby.invite.copyLabel"]
              }
              onClick={copyInvite}
            >
              {inviteState === "copied"
                ? strings["sim.lobby.invite.copied"]
                : inviteState === "failed"
                  ? strings["sim.lobby.invite.retry"]
                  : strings["sim.lobby.invite.invite"]}
            </button>
          </div>

          {room.matchComplete ? (
            <div className="my-2 grid gap-2 border border-[rgba(120,221,183,0.24)] bg-[rgba(17,41,37,0.42)] px-3 py-2.5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#d4ffea]">
                {strings["sim.matchComplete"]}
              </p>
              <p className="text-[0.72rem] leading-snug text-[#b9c7da]">
                {room.format === "bo3"
                  ? strings["sim.nextGameBo3Description"]
                  : strings["sim.nextGameDescription"]}
              </p>
              <div className="flex flex-wrap gap-2">
                {room.format === "bo3" && isHost ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center justify-center border border-[rgba(120,221,183,0.36)] bg-[rgba(17,41,37,0.72)] px-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#d4ffea] hover:border-[rgba(147,236,201,0.48)]"
                    onClick={onCreateNextGame}
                  >
                    {strings["sim.nextGame"]}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center border border-[rgba(132,150,184,0.24)] bg-[rgba(10,18,31,0.6)] px-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#c6d5e7] hover:border-[rgba(116,239,255,0.28)] hover:text-white"
                  onClick={onReturnToLobby}
                >
                  {strings["sim.backToLobby"]}
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-auto grid gap-1.5 border-t border-[rgba(176,188,206,0.1)] py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-[#9fdff2]">
                {room.spectators.length}{" "}
                {room.spectators.length === 1
                  ? strings["sim.spectator"]
                  : strings["sim.spectators"]}
              </p>
              {!spectator ? (
                <button
                  type="button"
                  className="inline-flex h-7 items-center justify-center border border-[rgba(132,150,184,0.15)] bg-[rgba(19,32,50,0.48)] px-2 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[#bfd1e4] transition-[border-color,background-color,color] duration-150 hover:border-[rgba(116,239,255,0.26)] hover:bg-[rgba(25,43,66,0.72)] hover:text-[#f4fbff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(116,239,255,0.36)]"
                  onClick={onSwitchToSpectator}
                >
                  {strings["sim.spectate"]}
                </button>
              ) : null}
            </div>
            {room.spectators.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {room.spectators.map((entry) => (
                  <span
                    key={entry.id}
                    className="max-w-full truncate bg-[rgba(255,255,255,0.025)] px-2 py-[0.18rem] text-[0.62rem] font-medium text-text-soft"
                  >
                    {entry.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <RoomChat
        roomCode={room.code}
        entries={room.chat}
        myId={room.myId}
        showPlayerNames={occupied.length > 2}
        onSend={onSendChat}
      />
    </section>
  );
}

function RandomizeTeamsButton({
  occupiedSeatCount,
  onRandomize,
}: {
  occupiedSeatCount: number;
  onRandomize: () => void;
}) {
  const id = useId();
  const available = occupiedSeatCount === 4;
  const hint = available
    ? undefined
    : format(strings["sim.lobby.randomizeUnavailable"], { count: occupiedSeatCount });
  return (
    <span className="inline-flex">
      <button
        type="button"
        className={`inline-flex h-7 items-center justify-center border px-2 text-[0.56rem] font-semibold uppercase tracking-[0.08em] transition-[border-color,background-color,color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(116,239,255,0.4)] disabled:cursor-not-allowed disabled:opacity-55 ${
          available
            ? "border-[rgba(116,239,255,0.24)] bg-[rgba(13,29,46,0.6)] text-[#d7eaff] hover:border-[rgba(159,223,242,0.42)] hover:text-[#f4fbff]"
            : "cursor-not-allowed border-[rgba(132,150,184,0.14)] bg-[rgba(10,18,31,0.4)] text-text-dim"
        }`}
        aria-disabled={!available}
        aria-describedby={hint ? id : undefined}
        title={hint}
        onClick={() => {
          if (available) onRandomize();
        }}
      >
        {available ? strings["sim.lobby.randomizeTeams"] : strings["sim.lobby.randomizeAtFull"]}
      </button>
      {hint ? (
        <span id={id} className="sr-only">
          {hint}
        </span>
      ) : null}
    </span>
  );
}

function SeatRow({
  seat,
  index,
  room,
  isSelf,
  canTakeSeat,
  onSetReady,
  onTakeSeat,
  onSwitchSeat,
  onInvite,
  inviteState,
  onLoadDeck,
}: {
  seat: RoomSeat | null;
  index: number;
  room: RoomState;
  isSelf: boolean;
  canTakeSeat: boolean;
  onSetReady: (ready: boolean) => void;
  onTakeSeat: () => void;
  onSwitchSeat: (seat: number) => void;
  onInvite: () => void;
  inviteState: "idle" | "copied" | "failed";
  onLoadDeck: () => void;
}) {
  const singlePlayer = room.roomMode === "single_player";
  const showPlayerLabels = capacityOf(room.variant) >= 3;
  const teamLabel = room.variant === "teams_2v2" ? (index % 2 === 0 ? 1 : 2) : null;
  const firstEmptySeat = room.seats.findIndex((entry) => !entry);
  const isSpectatorSelf = room.viewerRole === "spectator" && seat?.id === room.myId;

  return (
    <div
      className={`lobby-seat-row relative grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-[rgba(176,188,206,0.08)] px-2 py-2 transition-colors first:border-t-0 ${
        seat
          ? "hover:bg-[rgba(116,239,255,0.025)]"
          : "text-text-dim hover:bg-[rgba(255,255,255,0.012)]"
      } ${
        isSelf
          ? "bg-[linear-gradient(90deg,rgba(116,239,255,0.065),transparent_74%)] before:absolute before:inset-y-2 before:left-0 before:w-px before:bg-[rgba(116,239,255,0.72)]"
          : ""
      }`}
    >
      <div className="min-w-0">
        {showPlayerLabels ? (
          <p className="flex items-center gap-1.5 text-[0.58rem] uppercase tracking-[0.1em] text-text-dim">
            <span>P{index + 1}</span>
            {teamLabel ? (
              <span className="text-[0.56rem] tracking-[0.1em] text-[#cdb27a]">
                · {format(strings["sim.lobby.teamNumber"], { number: teamLabel })}
              </span>
            ) : null}
          </p>
        ) : null}
        <p className="truncate text-[0.82rem] font-medium leading-tight text-text-main">
          {seat ? (
            <>
              {seat.name}
              {seat.isBot ? (
                <span
                  data-bot-badge="true"
                  className="ml-1.5 text-[0.62rem] font-normal uppercase tracking-widest text-[#9fdff2]"
                >
                  {rulesText("sim.botBadge") ?? "Bot"}
                </span>
              ) : !isSpectatorSelf && seat.id === room.myId ? (
                <span className="ml-1.5 text-[0.62rem] font-normal uppercase tracking-widest text-text-dim">
                  {strings["sim.you"]}
                </span>
              ) : null}
            </>
          ) : singlePlayer && index === 1 ? (
            strings["sim.soloOpponent"]
          ) : (
            strings["sim.openSlot"]
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {seat ? (
          singlePlayer ? (
            seat.isBot ? (
              <span
                data-bot-badge="true"
                className="inline-flex items-center gap-1.5 text-[0.64rem] uppercase tracking-[0.1em] text-[#9fdff2]"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[rgba(159,223,242,0.72)]"
                  aria-hidden="true"
                />
                {rulesText("sim.botBadge") ?? "Bot"}
              </span>
            ) : seat.deckReady ? (
              <span className="inline-flex items-center gap-1.5 text-[0.64rem] uppercase tracking-[0.1em] text-text-soft">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#7bdeb7] shadow-[0_0_7px_rgba(123,222,183,0.34)]"
                  aria-hidden="true"
                />
                {strings["sim.deckLoaded"]}
              </span>
            ) : (
              <button type="button" className={roomReadyButton} onClick={onLoadDeck}>
                {strings["sim.loadDeckSeat"]}
              </button>
            )
          ) : isSelf ? (
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
              {room.variant === "teams_2v2" && index > 0 ? (
                <label className="inline-flex min-w-0 items-center gap-1.5 text-[0.56rem] font-semibold uppercase tracking-[0.08em] text-text-dim">
                  {strings["sim.lobby.seat"]}
                  <select
                    value={index}
                    onChange={(event) => onSwitchSeat(Number(event.currentTarget.value))}
                    aria-describedby={`seat-swap-hint-${room.code}`}
                    className="h-7 w-[5.75rem] min-w-0 border border-[rgba(132,150,184,0.22)] bg-[rgba(10,18,31,0.82)] px-1.5 font-semibold text-[0.58rem] tracking-[0.04em] text-[#d7eaff] normal-case focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(116,239,255,0.4)]"
                  >
                    {[1, 2, 3].map((seatIndex) => (
                      <option key={seatIndex} value={seatIndex}>
                        {`P${seatIndex + 1} · ${format(strings["sim.lobby.teamNumber"], {
                          number: seatIndex % 2 === 0 ? 1 : 2,
                        })} · ${room.seats[seatIndex]?.name ?? strings["sim.lobby.openSeat"]}`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                className={`${roomReadyButton} ${
                  seat.ready
                    ? "border-[rgba(120,221,183,0.3)] bg-[rgba(17,41,37,0.58)] text-[#d4ffea]"
                    : seat.deckReady
                      ? "border-[rgba(116,239,255,0.26)] bg-[rgba(13,29,46,0.72)] text-[#d7eaff]"
                      : "border-[rgba(116,239,255,0.26)] bg-[rgba(13,29,46,0.72)] text-[#d7eaff]"
                }`}
                onClick={() => {
                  if (!seat.deckReady) {
                    onLoadDeck();
                    return;
                  }
                  onSetReady(!seat.ready);
                }}
              >
                {seat.deckReady
                  ? seat.ready
                    ? strings["sim.ready"]
                    : strings["sim.readyUp"]
                  : strings["sim.loadDeckSeat"]}
              </button>
              <span id={`seat-swap-hint-${room.code}`} className="sr-only">
                {strings["sim.lobby.seatSwapHint"]}
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[0.64rem] uppercase tracking-[0.1em] text-text-soft">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  seat.ready
                    ? "bg-[#7bdeb7] shadow-[0_0_7px_rgba(123,222,183,0.34)]"
                    : "bg-[rgba(231,201,139,0.5)]"
                }`}
                aria-hidden="true"
              />
              {seat.ready ? strings["sim.ready"] : strings["sim.notReady"]}
            </span>
          )
        ) : singlePlayer && index === 1 ? (
          <span className="inline-flex items-center gap-1.5 text-[0.64rem] uppercase tracking-[0.1em] text-[#d7c092]">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[rgba(216,183,110,0.56)]"
              aria-hidden="true"
            />
            {strings["sim.soloOpponent"]}
          </span>
        ) : canTakeSeat && index === firstEmptySeat ? (
          <button
            type="button"
            className="inline-flex min-w-26 items-center justify-center border border-[rgba(116,239,255,0.26)] bg-[rgba(13,29,46,0.72)] px-2.5 py-[0.34rem] text-[0.68rem] uppercase tracking-[0.14em] text-[#d7eaff] transition-[border-color,background-color,color,transform] hover:-translate-y-px hover:border-[rgba(159,223,242,0.42)] hover:text-[#f4fbff]"
            onClick={onTakeSeat}
          >
            {strings["sim.takeSeat"]}
          </button>
        ) : (
          <button
            type="button"
            className={`inline-flex min-w-20 items-center justify-center border bg-[rgba(13,29,46,0.54)] px-2.5 py-[0.34rem] text-[0.62rem] font-semibold uppercase tracking-[0.1em] transition-[border-color,background-color,color,transform] hover:-translate-y-px ${
              inviteState === "copied"
                ? "border-[rgba(120,221,183,0.36)] text-[#d4ffea]"
                : "border-[rgba(132,150,184,0.2)] text-[#c7d5e7] hover:border-[rgba(116,239,255,0.32)] hover:text-[#f4fbff]"
            }`}
            onClick={onInvite}
          >
            {inviteState === "copied"
              ? strings["sim.lobby.invite.copied"]
              : strings["sim.lobby.invite.invite"]}
          </button>
        )}
      </div>
    </div>
  );
}

const RoomSetupPanel = ({
  ref,
  room,
  onChange,
  onDone,
}: {
  ref: React.RefObject<HTMLElement | null>;
  room: RoomState;
  onChange: (patch: {
    variant?: GameVariant;
    playMode?: PlayMode;
    format?: MatchFormat;
    deckRules?: DeckRulesMode;
    rulesMode?: RulesMode;
  }) => void;
  onDone: () => void;
}) => {
  const occupied = room.seats.filter(Boolean).length;
  const baseId = useId();
  return (
    <section
      ref={ref}
      id={`lobby-room-${room.code.toLowerCase()}-setup-panel`}
      data-hosted-room-setup=""
      aria-label={strings["sim.roomSetup"]}
      role="dialog"
      className="absolute inset-x-0 top-[calc(100%+0.45rem)] z-50 grid max-h-[min(27rem,calc(100dvh-14rem))] gap-3 overflow-x-hidden overflow-y-auto border border-[rgba(216,183,110,0.32)] bg-[linear-gradient(180deg,rgba(14,16,23,0.99),rgba(7,11,20,0.99))] px-4 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.58)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[rgba(216,183,110,0.14)] pb-2">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#e7c98b]">
            {strings["sim.roomSetup"]}
          </p>
          <p className="text-[0.62rem] text-text-dim">{strings["sim.lobby.allSettingsApply"]}</p>
        </div>
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center border border-[rgba(132,150,184,0.24)] bg-[rgba(10,18,31,0.7)] px-2.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-text-soft transition-colors hover:border-[rgba(196,208,226,0.38)] hover:text-text-main"
          onClick={onDone}
        >
          {strings["sim.done"]}
        </button>
      </div>

      <fieldset className="grid min-w-0 gap-1.5 border-0 p-0">
        <legend className="sr-only">{strings["sim.lobby.gameMode"]}</legend>
        <div className="flex items-center justify-between gap-3">
          <p
            aria-hidden="true"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#e7c98b]"
          >
            {strings["sim.lobby.gameMode"]}
          </p>
          <span className="text-[0.62rem] uppercase tracking-[0.12em] text-text-dim">
            {strings["sim.lobby.playerRange"]}
          </span>
        </div>
        <div className="lobby-game-variant-selector">
          <div className="lobby-game-variant-options grid gap-1.5">
            {VARIANTS.map((variant) => {
              const active = room.variant === variant.value;
              const disabled = variant.capacity < occupied;
              return (
                <button
                  key={variant.value}
                  type="button"
                  aria-pressed={active}
                  disabled={disabled}
                  title={disabled ? strings["sim.lobby.smallerModesUnlock"] : undefined}
                  onClick={() => onChange({ variant: variant.value })}
                  className={`${segmentedButton} ${active ? segmentedActive : segmentedInactive}`}
                >
                  <span className="truncate">{variant.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>

      <fieldset className="grid min-w-0 gap-1.5 border-0 p-0">
        <legend className="sr-only">{strings["sim.playMode"]}</legend>
        <p
          aria-hidden="true"
          className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#e7c98b]"
        >
          {strings["sim.playMode"]}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {(["constructed", "sealed"] as PlayMode[]).map((mode) => {
            const active = room.playMode === mode;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ playMode: mode })}
                className={`${segmentedButton} ${active ? segmentedActive : segmentedInactive}`}
              >
                <span className="truncate">
                  {mode === "constructed" ? strings["sim.constructed"] : strings["common.sealed"]}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="grid min-w-0 gap-1.5 border-0 p-0">
        <legend className="sr-only">{strings["current.quickMatchSettings.format"]}</legend>
        <p
          aria-hidden="true"
          className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#e7c98b]"
        >
          {strings["current.quickMatchSettings.format"]}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {(["bo1", "bo3"] as MatchFormat[]).map((formatValue) => {
            const active = room.format === formatValue;
            const disabled = formatValue === "bo3" && room.variant !== "duel";
            return (
              <button
                key={formatValue}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                title={
                  disabled ? "Three- and four-player rooms currently use Best of 1." : undefined
                }
                onClick={() => onChange({ format: formatValue })}
                className={`${segmentedButton} ${active ? segmentedActive : segmentedInactive}`}
              >
                <span className="truncate">{formatValue === "bo3" ? "BO3" : "BO1"}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {room.roomMode === "multiplayer" && room.playMode === "constructed" ? (
        <fieldset className="grid min-w-0 gap-1.5 border-0 p-0">
          <legend className="sr-only">{strings["current.deckRules"]}</legend>
          <p
            aria-hidden="true"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#e7c98b]"
          >
            {strings["current.deckRules"]}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {(["standard", "unrestricted"] as DeckRulesMode[]).map((mode) => {
              const active = room.deckRules === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={active}
                  aria-describedby={`${baseId}-${mode}`}
                  onClick={() => onChange({ deckRules: mode })}
                  className={`${segmentedButton} ${active ? segmentedActive : segmentedInactive}`}
                >
                  <span className="truncate">
                    {mode === "standard"
                      ? strings["current.standard"]
                      : strings["current.unrestricted"]}
                  </span>
                </button>
              );
            })}
          </div>
          <p id={`${baseId}-standard`} className="text-xs leading-snug text-[#8193aa]">
            {strings["current.standardLabel"]} {strings["current.officialDeckRules"]}
          </p>
        </fieldset>
      ) : null}

      <RulesModeFieldset
        rulesMode={room.rulesMode ?? "sandbox"}
        hintId={`${baseId}-rules-mode`}
        onChange={(rulesMode) => onChange({ rulesMode })}
      />
    </section>
  );
};

function RoomChat({
  roomCode,
  entries,
  myId,
  showPlayerNames,
  onSend,
}: {
  roomCode: string;
  entries: RoomState["chat"];
  myId: string;
  showPlayerNames: boolean;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [entries.length, roomCode]);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  const messageCountLabel = `${entries.length > 99 ? "99+" : entries.length} ${
    entries.length === 1 ? "message" : "messages"
  }`;

  return (
    <div
      data-lobby-chat-dock=""
      className="lobby-chat-region grid min-h-0 grid-rows-[auto_minmax(0,1fr)]"
    >
      <div className="flex items-center justify-between gap-2 pb-1.5">
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#9fdff2]">
          {strings["sim.lobbyChat"]}
        </p>
        <span className="text-[0.56rem] uppercase tracking-[0.08em] text-text-dim">
          {messageCountLabel}
        </span>
      </div>
      <section className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-[0.18rem]">
        <div className="relative min-h-0">
          <div
            role="log"
            aria-label={strings["sim.lobbyChatMessages"]}
            aria-live="polite"
            aria-relevant="additions"
            className="h-full min-h-0"
          >
            <ul
              ref={listRef}
              className="grid h-full min-h-0 auto-rows-min content-start gap-[0.08rem] overflow-x-hidden overflow-y-auto bg-[linear-gradient(180deg,rgba(9,15,28,0.26),rgba(7,12,22,0.12))] px-[0.2rem] py-[0.28rem] pr-[0.16rem] select-text scrollbar-gutter-stable"
            >
              {entries.length === 0 ? (
                <li className="px-1 py-[0.35rem] text-[0.74rem] text-text-dim">
                  {strings["sim.noMessagesYet"]}
                </li>
              ) : (
                entries.map((entry) => {
                  const self = entry.authorPlayerId === myId;
                  return (
                    <li
                      key={entry.id}
                      className={`w-fit max-w-[calc(100%-0.42rem)] cursor-text select-text px-[0.42rem] py-[0.24rem] ${
                        self
                          ? "justify-self-end bg-[rgba(22,58,49,0.72)]"
                          : "justify-self-start bg-[rgba(70,51,28,0.68)]"
                      }`}
                    >
                      <p className="min-w-0 select-text whitespace-pre-wrap [overflow-wrap:anywhere] text-[#e2ebf8] text-[0.76rem] leading-[1.24]">
                        {showPlayerNames ? (
                          <span className="mb-[0.12rem] block min-w-0 text-[0.66rem] font-semibold text-[#dbeefa]">
                            {self ? strings["sim.you"] : entry.author}
                          </span>
                        ) : null}
                        <span>{entry.text}</span>
                        <span
                          className="ml-[0.22rem] inline-block whitespace-nowrap align-baseline text-[0.62rem] leading-[1.1] text-[#c5d0df]"
                          aria-hidden="true"
                        >
                          {new Date(entry.at).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </p>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_4.25rem] items-center border border-[rgba(166,185,209,0.22)] bg-[rgba(20,32,49,0.76)] transition-[border-color,box-shadow] focus-within:border-[rgba(116,239,255,0.46)] focus-within:shadow-[0_0_0_2px_rgba(84,125,201,0.22)]">
          <input
            type="text"
            value={text}
            onChange={(event) => setText(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            maxLength={200}
            aria-label={strings["sim.lobbyChatMessage"]}
            placeholder={strings["sim.typeMessage"]}
            className="h-[1.7rem] w-full min-w-0 border-0 bg-transparent px-[0.45rem] py-0 text-[0.68rem] leading-none text-text-main outline-none placeholder:text-text-dim focus:bg-[rgba(43,62,86,0.18)]"
          />
          <button
            type="button"
            className="inline-flex h-[1.7rem] items-center justify-center border-0 border-l border-l-[rgba(166,185,209,0.18)] bg-[rgba(57,81,110,0.58)] px-[0.42rem] text-[0.64rem] font-semibold uppercase tracking-[0.06em] text-text-soft transition-[background-color,color] hover:bg-[rgba(66,92,124,0.78)] hover:text-text-main disabled:cursor-not-allowed disabled:opacity-55"
            disabled={text.trim().length === 0}
            onClick={send}
          >
            {strings["sim.send"]}
          </button>
        </div>
      </section>
    </div>
  );
}

const rulesText = createTranslator("en");

/** Host-only strict-rules toggle (R2-int): sends `set_lobby_rules_mode`. */
export function RulesModeFieldset({
  rulesMode,
  hintId,
  onChange,
}: {
  rulesMode: RulesMode;
  hintId: string;
  onChange: (mode: RulesMode) => void;
}) {
  return (
    <fieldset className="grid min-w-0 gap-1.5 border-0 p-0" data-lobby-rules-mode={rulesMode}>
      <legend className="sr-only">{rulesText("rules.ui.rulesMode") ?? "Rules"}</legend>
      <p
        aria-hidden="true"
        className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#e7c98b]"
      >
        {rulesText("rules.ui.rulesMode") ?? "Rules"}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {(["sandbox", "strict"] as RulesMode[]).map((mode) => {
          const active = rulesMode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={active}
              aria-describedby={hintId}
              onClick={() => onChange(mode)}
              className={`${segmentedButton} ${active ? segmentedActive : segmentedInactive}`}
            >
              <span className="truncate">
                {mode === "strict"
                  ? (rulesText("rules.ui.modeStrict") ?? "Strict")
                  : (rulesText("rules.ui.modeSandbox") ?? "Sandbox")}
              </span>
            </button>
          );
        })}
      </div>
      <p id={hintId} className="text-xs leading-snug text-[#8193aa]">
        {rulesText("rules.ui.rulesModeHint") ?? ""}
      </p>
    </fieldset>
  );
}
