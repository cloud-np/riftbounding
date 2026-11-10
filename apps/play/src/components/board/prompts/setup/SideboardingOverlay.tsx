"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

import { createTranslator } from "@rift/i18n";
import { getCardById, getCardByName } from "@rift/cards";
import type { DeckSections, DecklistEntry, RoomPlayer } from "@rift/protocol";

import type { BoardSlotProps } from "../../slot-types";
import {
  SETUP_HEADING_BAND_CLASS,
  SETUP_PRIMARY_BUTTON_CLASS,
  SetupHeading,
  cardToInstance,
} from "./SetupChrome";
import {
  activePlayers,
  deckSectionsFor,
  mergeDeckEntries,
  orderPlayersForSeat,
  totalCards,
  transferEntry,
} from "./setup-state";
import {
  acceptedSkipCount,
  resolveSideboardSkipControlState,
  sideboardSkipRows,
} from "./sideboard-skip";
import { SafeImg } from "../../card/SafeImg";

const t = createTranslator("en");

const SKIP_OUTLINE_BUTTON =
  "min-w-48 rounded-none border border-[rgba(132,150,184,0.5)] bg-[rgba(8,14,24,0.72)] px-4 py-2 text-[0.76rem] uppercase tracking-widest text-(--text-soft) transition-[border-color,background,color] duration-140 hover:border-[rgba(224,194,135,0.68)] hover:bg-[rgba(18,28,45,0.94)] hover:text-[#fff0d2] focus-visible:border-[rgba(224,194,135,0.84)] focus-visible:outline-none disabled:cursor-default disabled:opacity-50 max-[720px]:w-full";
const SKIP_ACCEPT_BUTTON =
  "min-w-48 rounded-none border border-[rgba(110,215,177,0.62)] bg-[linear-gradient(180deg,rgba(22,91,74,0.92),rgba(10,52,47,0.94))] px-4 py-2 text-[0.76rem] font-semibold uppercase tracking-widest text-[#c9ffec] shadow-[inset_0_0_0_1px_rgba(191,255,231,0.08),0_8px_18px_rgba(3,10,22,0.36)] transition-[border-color,background,color] duration-140 hover:border-[rgba(139,240,201,0.84)] hover:bg-[linear-gradient(180deg,rgba(28,111,89,0.96),rgba(12,65,57,0.98))] focus-visible:border-[rgba(158,255,219,0.94)] focus-visible:outline-none disabled:cursor-default disabled:opacity-65 max-[720px]:w-full";
const SKIP_POPOVER =
  "absolute right-0 bottom-[calc(100%+0.5rem)] z-30 w-72 max-w-[calc(100vw-2rem)] rounded-[0.18rem] border border-[rgba(132,150,184,0.38)] bg-[linear-gradient(180deg,rgba(14,25,42,0.99),rgba(7,13,25,0.99))] p-2.5 text-left shadow-[0_16px_34px_rgba(3,8,18,0.56)]";
const SKIP_POPOVER_ARROW =
  "absolute right-8 -bottom-[0.36rem] h-3 w-3 rotate-45 border-r border-b border-[rgba(132,150,184,0.38)] bg-[#07101c]";
const SKIP_CANCEL_BUTTON =
  "mt-2 w-full rounded-[0.12rem] border border-[rgba(132,150,184,0.34)] bg-[rgba(8,14,24,0.66)] px-2.5 py-1.5 text-[0.65rem] uppercase tracking-[0.08em] text-(--text-soft) transition hover:border-[rgba(224,194,135,0.58)] hover:text-[#fff0d2] focus-visible:border-[rgba(224,194,135,0.8)] focus-visible:outline-none disabled:cursor-default disabled:opacity-50";
const SKIP_DECLINE_BUTTON =
  "mt-2 w-full rounded-[0.12rem] border border-[rgba(132,150,184,0.34)] bg-[rgba(8,14,24,0.66)] px-2.5 py-1.5 text-[0.65rem] uppercase tracking-[0.08em] text-(--text-soft) transition hover:border-[rgba(218,117,117,0.58)] hover:text-[#ffc5c5] focus-visible:border-[rgba(255,171,171,0.8)] focus-visible:outline-none disabled:cursor-default disabled:opacity-50";

function SkipPlayerRows({
  rows,
  ariaLabel,
}: {
  rows: Array<{ id: string; playerLabel: string; name: string; responseStatus: string; statusLabel: string }>;
  ariaLabel: string;
}) {
  return (
    <ul
      aria-label={ariaLabel}
      className="m-0 grid list-none gap-1 p-0"
      data-testid="sideboard-skip-player-status-list"
    >
      {rows.map((row) => (
        <li
          key={row.id}
          data-player-id={row.id}
          data-sideboard-skip-player-status={row.responseStatus}
          className={`flex min-w-0 items-center gap-2 rounded-[0.14rem] border px-2 py-1.5 text-[0.68rem] ${
            row.responseStatus === "accepted"
              ? "border-[rgba(110,215,177,0.28)] bg-[rgba(20,73,63,0.28)] text-[#a9f2d9]"
              : row.responseStatus === "declined"
                ? "border-[rgba(218,117,117,0.34)] bg-[rgba(69,28,35,0.42)] text-[#ffc5c5]"
                : "border-[rgba(132,150,184,0.22)] bg-[rgba(8,14,24,0.52)] text-[#c8d1de]"
          }`}
        >
          <span aria-hidden="true" className="grid size-3.5 shrink-0 place-items-center rounded-full border border-current text-[0.5rem]">
            {row.responseStatus === "accepted" ? "✓" : row.responseStatus === "declined" ? "×" : "…"}
          </span>
          <span className="shrink-0 font-semibold uppercase tracking-[0.08em] text-white/76">
            {row.playerLabel}
          </span>
          <span className="min-w-0 flex-1 truncate text-white/88" title={row.name}>
            {row.name}
          </span>
          <span className="shrink-0 font-medium">{row.statusLabel}</span>
        </li>
      ))}
    </ul>
  );
}

function SideboardReadinessStrip({
  rows,
  summaryLabel,
}: {
  rows: Array<{ id: string; playerLabel: string; name: string; relation: string; status: string; ready: boolean }>;
  summaryLabel: string;
}) {
  const readyCount = rows.reduce((count, row) => count + Number(row.ready), 0);
  return (
    <div
      aria-label={t("sim.setup.sideboardReadiness") ?? "Sideboard readiness"}
      aria-live="polite"
      className="pointer-events-none relative flex min-w-0 flex-1 items-stretch rounded-[0.16rem] border border-[rgba(132,150,184,0.28)] bg-[rgba(7,13,23,0.7)]"
      data-player-count={rows.length}
      data-ready-count={readyCount}
      data-setup-roster-density="compact"
      data-testid="sideboard-readiness-strip"
      role="status"
    >
      <span
        aria-hidden="true"
        className="flex shrink-0 items-center gap-1 border-r border-[rgba(132,150,184,0.22)] px-2 py-1 text-[0.56rem] font-semibold uppercase tracking-[0.08em] text-white/48"
      >
        <span className="max-[480px]:sr-only">{summaryLabel}</span>
        <span className="text-white/76">
          {readyCount}/{rows.length}
        </span>
      </span>
      <ul className="m-0 grid min-w-0 flex-1 grid-flow-col auto-cols-fr list-none divide-x divide-[rgba(132,150,184,0.18)] p-0">
        {rows.map((row, index) => (
          <li
            key={row.id}
            data-player-id={row.id}
            data-player-relation={row.relation}
            data-setup-status={row.status}
            className={`pointer-events-auto relative min-w-0 text-[0.58rem] font-semibold uppercase tracking-[0.06em] last:rounded-r-[0.12rem] ${
              row.relation === "self"
                ? "bg-[rgba(74,56,28,0.26)] shadow-[inset_0_0_0_1px_rgba(224,194,135,0.28)]"
                : "bg-[rgba(9,16,27,0.3)]"
            }`}
          >
            <span className="flex h-full min-w-0 items-center justify-center gap-1 px-1.5 py-1">
              <span className="shrink-0 text-white/82">{row.playerLabel}</span>
              <span
                className={`h-3 w-3 shrink-0 ${row.ready ? "text-[#8ff0cf]" : "text-[#9ba9bc]"}`}
                aria-hidden="true"
              >
                {row.ready ? "✓" : "•"}
              </span>
              <span
                aria-hidden="true"
                className={`pointer-events-none invisible absolute bottom-[calc(100%+0.4rem)] z-50 w-max max-w-[min(16rem,calc(100vw-2rem))] rounded-[0.14rem] border border-[rgba(132,150,184,0.38)] bg-[rgba(7,13,25,0.98)] px-2 py-1 text-[0.62rem] font-medium normal-case tracking-normal text-[#eef3fa] opacity-0 shadow-[0_8px_20px_rgba(3,8,18,0.48)] transition-opacity group-hover:visible group-hover:opacity-100 ${
                  index === 0
                    ? "left-0"
                    : index === rows.length - 1
                      ? "right-0"
                      : "left-1/2 -translate-x-1/2"
                }`}
              >
                {row.playerLabel}, {row.name}, {row.status}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface SideboardOverlayProps extends Pick<
  BoardSlotProps,
  | "state"
  | "viewerId"
  | "controlledPlayerIds"
  | "dispatch"
  | "mode"
  | "onRequestSideboardSkip"
  | "onRespondSideboardSkip"
> {}

interface SectionsState {
  mainDeck: DecklistEntry[];
  sideboard: DecklistEntry[];
  champion: DecklistEntry[];
  legend?: DecklistEntry[];
}

function initSections(player: RoomPlayer | undefined): SectionsState {
  const sections = deckSectionsFor(player);
  return {
    mainDeck: [...(sections?.mainDeck ?? [])],
    sideboard: [...(sections?.sideboard ?? [])],
    champion: [...(sections?.champion ?? [])],
    ...(sections?.legend ? { legend: [...sections.legend] } : {}),
  };
}

function entryKey(entry: DecklistEntry): string {
  return entry.cardCode ?? entry.name.trim().toLowerCase();
}

function entryArt(entry: DecklistEntry) {
  const card = getCardById(entry.cardCode) ?? getCardByName(entry.name);
  if (!card) return null;
  const instance = cardToInstance(card, "sideboard");
  return (
    <SafeImg
      src={card.imageUrl}
      alt={entry.name}
      loading="lazy"
      className="h-full w-full object-cover"
      data-card-art-source={card.imageUrl}
      data-card-id={instance.id}
    />
  );
}

function TransferRow({
  entry,
  direction,
  onClick,
}: {
  entry: DecklistEntry;
  direction: "main-to-secondary" | "secondary-to-main";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-setup-transfer-direction={direction}
      data-card-name={entry.name}
      onClick={onClick}
      className={`group relative grid w-full items-center gap-x-2 rounded-[0.18rem] border border-[rgba(132,150,184,0.18)] bg-[rgba(11,19,32,0.7)] px-2 py-[0.22rem] text-left transition ${
        direction === "main-to-secondary"
          ? "grid-cols-[2.58rem_auto_minmax(0,1fr)_auto] hover:border-[rgba(224,194,135,0.72)] hover:bg-[rgba(18,28,45,0.9)] focus-visible:border-[rgba(224,194,135,0.84)]"
          : "grid-cols-[auto_2.58rem_auto_minmax(0,1fr)] hover:border-[rgba(140,221,191,0.58)] hover:bg-[rgba(18,28,45,0.9)] focus-visible:border-[rgba(176,246,218,0.82)]"
      } focus-visible:outline-none`}
    >
      <span
        className={`inline-flex h-[1.32rem] w-[1.32rem] items-center justify-center rounded-none border text-[0.62rem] ${
          direction === "main-to-secondary"
            ? "border-[rgba(224,194,135,0.34)] bg-[rgba(60,44,20,0.72)] text-[#ffe8bd]"
            : "border-[rgba(140,221,191,0.34)] bg-[rgba(20,60,49,0.72)] text-[#b9f8dd]"
        }`}
        aria-hidden="true"
      >
        {direction === "main-to-secondary" ? "→" : "←"}
      </span>
      <span className="inline-flex min-w-[2.22rem] items-center justify-center rounded-none border border-[rgba(166,188,226,0.34)] bg-[rgba(23,36,59,0.96)] px-[0.26rem] py-[0.08rem] text-[0.81rem] font-bold leading-none text-[#eefcff]">
        x{entry.count}
      </span>
      <span className="relative h-[1.88rem] w-[2.58rem] overflow-hidden rounded-[0.18rem] bg-[linear-gradient(180deg,rgba(24,31,48,0.86),rgba(10,14,24,0.92))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
        {entryArt(entry)}
        <span className="pointer-events-none absolute inset-0 rounded-[0.18rem] shadow-[inset_0_0_0_2px_rgba(22,27,36,0.94)]" />
      </span>
      <p className="m-0 truncate text-[0.83rem] font-semibold leading-none text-[#eef4ff] [text-shadow:0_1px_1px_rgba(3,8,17,0.92)]">
        {entry.name}
      </p>
    </button>
  );
}

export function SideboardingOverlay({
  state,
  viewerId,
  controlledPlayerIds,
  dispatch,
  mode,
  onRequestSideboardSkip,
  onRespondSideboardSkip,
}: SideboardOverlayProps) {
  const active = useMemo(() => orderPlayersForSeat(activePlayers(state)), [state]);
  const controlled = useMemo(() => new Set(controlledPlayerIds), [controlledPlayerIds]);
  const bothControlled =
    mode !== "multiplayer" &&
    active.length > 1 &&
    active.every((player) => controlled.has(player.id));
  const [selectedSeatId, setSelectedSeatId] = useState(
    active.find((player) => controlled.has(player.id))?.id ?? viewerId,
  );
  const selectedPlayer = active.find((player) => player.id === selectedSeatId) ?? active[0];
  const roomKey = `${state.roomCode}:${active.map((player) => player.id).join(",")}`;
  const [sectionsByPlayer, setSectionsByPlayer] = useState<Record<string, SectionsState>>(() =>
    Object.fromEntries(active.map((player) => [player.id, initSections(player)])),
  );
  const sectionsRef = useRef(sectionsByPlayer);
  sectionsRef.current = sectionsByPlayer;
  const queueRef = useRef<string[]>([]);
  const done = new Set(state.sideboardDonePlayerIds ?? []);
  const nextActorId =
    active.find((player) => !done.has(player.id) && controlled.has(player.id))?.id ?? null;

  useEffect(() => {
    setSectionsByPlayer(
      Object.fromEntries(active.map((player) => [player.id, initSections(player)])),
    );
    setSelectedSeatId((current) =>
      active.some((player) => player.id === current)
        ? current
        : (active.find((player) => controlled.has(player.id))?.id ?? viewerId),
    );
    queueRef.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the room/series changes
  }, [roomKey]);

  const submit = (playerId: string) => {
    if (done.has(playerId) || nextActorId !== playerId) return;
    const sections = sectionsByPlayer[playerId];
    if (!sections) return;
    dispatch({
      type: "submit_sideboard",
      champion: mergeDeckEntries(sections.champion),
      mainDeck: mergeDeckEntries(sections.mainDeck),
      sideboard: mergeDeckEntries(sections.sideboard),
      ...(sections.legend ? { legend: mergeDeckEntries(sections.legend) } : {}),
    });
  };

  const pumpQueue = () => {
    const next = active.find((player) => !done.has(player.id) && controlled.has(player.id));
    if (!next) return;
    const index = queueRef.current.indexOf(next.id);
    if (index < 0) return;
    queueRef.current.splice(index, 1);
    submit(next.id);
  };

  useEffect(() => {
    if (queueRef.current.length > 0) pumpQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- driven by authoritative done ids
  }, [state.sideboardDonePlayerIds]);

  if (!selectedPlayer) return null;
  const sections = sectionsByPlayer[selectedPlayer.id] ?? initSections(selectedPlayer);
  const mainCount = totalCards(sections.mainDeck) + totalCards(sections.champion);
  const sideCount = totalCards(sections.sideboard);
  const allDone = active.every((player) => done.has(player.id));
  const canSubmitSelected = nextActorId === selectedPlayer.id;
  const bothPending = bothControlled && active.some((player) => !done.has(player.id));
  const skipRequest = state.sideboardSkipRequest;
  const skipRequester = skipRequest?.requesterPlayerId ?? null;
  const skipControl = resolveSideboardSkipControlState({
    roomMode: state.roomMode,
    matchFormat: state.matchFormat,
    playMode: state.playMode,
    request: skipRequest,
    playerId: viewerId,
  });
  const skipAccepted = acceptedSkipCount(skipRequest);
  const skipRows = sideboardSkipRows({
    players: active,
    request: skipRequest,
    playerLabel: (player) =>
      player.id === viewerId
        ? (t("sim.you") ?? "You")
        : (t("sim.opponent") ?? "Opponent"),
    labels: {
      accepted: t("sim.sideboardSkipAccepted") ?? "Accepted",
      declined: t("sim.sideboardSkipDeclinedStatus") ?? "Declined",
      pending: t("sim.sideboardSkipPending") ?? "Pending",
    },
  });
  const opponent = active.find((player) => player.id !== viewerId) ?? null;
  const readinessRows = active.map((player, index) => ({
    id: player.id,
    playerLabel:
      player.id === viewerId ? (t("sim.you") ?? "You") : (t("sim.opponent") ?? "Opponent"),
    name: player.name,
    relation: player.id === viewerId ? "self" : "opponent",
    status: done.has(player.id) ? (t("sim.ready") ?? "Ready") : (t("sim.setup.waiting") ?? "Waiting"),
    ready: done.has(player.id),
    index,
  }));
  const hasReadiness = active.length > 0 && controlledPlayerIds.length > 1;

  const skipSideboarding = () => {
    for (const player of active) {
      if (!done.has(player.id) && controlled.has(player.id)) {
        queueRef.current.push(player.id);
      }
    }
    pumpQueue();
  };

  const transfer = (from: "main" | "secondary", entry: DecklistEntry) => {
    if (!canSubmitSelected) return;
    setSectionsByPlayer((previous) => {
      const current = previous[selectedPlayer.id];
      if (!current) return previous;
      const key = entryKey(entry);
      const moved =
        from === "main"
          ? transferEntry(current.mainDeck, current.sideboard, key)
          : transferEntry(current.sideboard, current.mainDeck, key);
      if (!moved.moved) return previous;
      return {
        ...previous,
        [selectedPlayer.id]: {
          ...current,
          mainDeck: from === "main" ? moved.from : moved.to,
          sideboard: from === "main" ? moved.to : moved.from,
        },
      };
    });
  };

  return (
    <motion.section
      data-setup-overlay="sideboarding"
      data-testid="sideboarding-overlay"
      data-has-seat-tabs={bothControlled ? "true" : "false"}
      initial={{ opacity: 0, scale: 0.992, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.994, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] } }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none z-45 absolute inset-0 select-none"
    >
      <div className="absolute left-1/2 top-8 z-20 -translate-x-1/2 max-[980px]:top-6">
        <div className={SETUP_HEADING_BAND_CLASS}>
          <SetupHeading>{t("sim.sideboarding") ?? "Sideboarding"}</SetupHeading>
        </div>
      </div>

      {bothControlled ? (
        <div
          data-setup-seat-tabs="true"
          className="pointer-events-auto absolute right-3 top-3 z-30 flex items-center border border-[rgba(132,150,184,0.3)] bg-[rgba(7,13,23,0.9)] p-1 shadow-[0_8px_18px_rgba(3,10,22,0.4)]"
        >
          {active.map((player) => (
            <button
              key={player.id}
              type="button"
              aria-pressed={player.id === selectedSeatId}
              data-testid={`sideboard-seat-${player.id}`}
              onClick={() => setSelectedSeatId(player.id)}
              className={`min-w-28 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.09em] transition ${
                player.id === selectedSeatId
                  ? "bg-[rgba(35,78,119,0.92)] text-[#fff0d2]"
                  : "text-[#aebed1] hover:bg-[rgba(23,39,61,0.78)] hover:text-[#edf5ff]"
              }`}
            >
              {player.name}
              {done.has(player.id) ? ` · ${t("sim.ready") ?? "Ready"}` : ""}
            </button>
          ))}
        </div>
      ) : null}

      <div className="setup-sideboard-body absolute inset-x-[2.2rem] top-[5.05rem] bottom-8 max-[980px]:inset-x-3 max-[980px]:top-[4.7rem] max-[980px]:bottom-6">
        <div
          className="setup-sideboard-content mx-auto flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden"
          style={{ maxWidth: "clamp(34rem,58vw,50rem)" }}
        >
          <div className="flex items-center justify-between gap-2 text-[0.66rem] uppercase tracking-[0.08em] text-[#9fb5d4]">
            <span>{selectedPlayer.name}</span>
            <span className="text-[#ffe6b8]">
              {mainCount}/40 · {t("sim.sideboard") ?? "Sideboard"} {sideCount}/10
            </span>
          </div>
          <div className="setup-sideboard-lists pointer-events-auto relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-[clamp(0.7rem,1.2vw,1rem)] overflow-hidden max-[980px]:grid-cols-1">
            <section className="grid h-full min-h-0 overflow-hidden grid-rows-[auto_minmax(0,1fr)] rounded-none border border-[rgba(132,150,184,0.3)] bg-[rgba(8,14,24,0.62)]">
              <div className="flex items-center justify-between border-b border-[rgba(132,150,184,0.22)] px-3.5 py-1.5">
                <span className="text-[0.7rem] uppercase tracking-[0.08em] text-[#cbd9ec]">
                  {t("sim.mainDeck") ?? "Main Deck"}
                </span>
                <span className="rounded-none border border-[rgba(110,215,177,0.4)] bg-[rgba(20,73,63,0.36)] px-2 py-1 text-[0.7rem] uppercase tracking-[0.08em] text-[#8ff6d3]">
                  {mainCount}/39
                </span>
              </div>
              <div
                data-testid="sideboard-main-scroll"
                className="min-h-0 overflow-y-auto overflow-x-visible px-1.5 py-1.5"
              >
                <div className="grid content-start gap-1">
                  {sections.mainDeck.length > 0 ? (
                    sections.mainDeck.map((entry) => (
                      <TransferRow
                        key={entryKey(entry)}
                        entry={entry}
                        direction="main-to-secondary"
                        onClick={() => transfer("main", entry)}
                      />
                    ))
                  ) : (
                    <div className="rounded-none border border-dashed border-[rgba(132,150,184,0.22)] bg-[rgba(8,14,24,0.18)] px-3 py-4 text-[0.85rem] text-[#9fb0c7]">
                      {t("sim.noSideboardCards") ?? "No cards"}
                    </div>
                  )}
                </div>
              </div>
            </section>
            <section className="grid h-full min-h-0 overflow-hidden grid-rows-[auto_minmax(0,1fr)] rounded-none border border-[rgba(132,150,184,0.3)] bg-[rgba(8,14,24,0.62)]">
              <div className="flex items-center justify-between border-b border-[rgba(132,150,184,0.22)] px-3.5 py-1.5">
                <span className="text-[0.7rem] uppercase tracking-[0.08em] text-[#cbd9ec]">
                  {t("sim.sideboard") ?? "Sideboard"}
                </span>
                <span className="rounded-none border border-[rgba(166,188,226,0.34)] bg-[rgba(23,36,59,0.62)] px-2 py-1 text-[0.7rem] uppercase tracking-[0.08em] text-[#c6d5e7]">
                  {sideCount}/10
                </span>
              </div>
              <div
                data-testid="sideboard-secondary-scroll"
                className="min-h-0 overflow-y-auto overflow-x-visible px-1.5 py-1.5"
              >
                <div className="grid content-start gap-1">
                  {sections.sideboard.length > 0 ? (
                    sections.sideboard.map((entry) => (
                      <TransferRow
                        key={entryKey(entry)}
                        entry={entry}
                        direction="secondary-to-main"
                        onClick={() => transfer("secondary", entry)}
                      />
                    ))
                  ) : (
                    <div className="rounded-none border border-dashed border-[rgba(132,150,184,0.22)] bg-[rgba(8,14,24,0.18)] px-3 py-4 text-[0.85rem] text-[#9fb0c7]">
                      {t("sim.noExtraPoolCards") ?? "No extra pool cards"}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          <div
            data-testid="sideboarding-footer"
            data-sideboard-skip-state={skipControl}
            className="pointer-events-auto relative z-10 flex shrink-0 items-center justify-between gap-3 rounded-none border border-[rgba(132,150,184,0.24)] bg-[linear-gradient(180deg,rgba(10,18,31,0.94),rgba(7,12,22,0.98))] px-3.5 py-3 shadow-[0_-8px_18px_rgba(3,10,22,0.24)] max-[980px]:flex-col max-[980px]:items-stretch"
          >
            <div
              data-setup-sideboard-status
              data-has-status={allDone || hasReadiness ? "true" : "false"}
              className="flex min-h-6 min-w-0 flex-1 items-center gap-3 max-[980px]:flex-col max-[980px]:items-stretch"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-[0.82rem] text-[#ffd8c8]">
                    {allDone
                      ? (t("sim.bothDecksLockedIn") ?? "Both Decks Locked In")
                      : canSubmitSelected
                        ? `${selectedPlayer.name} · ${t("sim.mainDeck") ?? "Main Deck"} ${mainCount}/40`
                        : (t("sim.setup.waiting") ?? "Waiting")}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 max-[980px]:self-stretch">
                {hasReadiness ? (
                  <SideboardReadinessStrip
                    rows={readinessRows}
                    summaryLabel={t("sim.ready") ?? "Ready"}
                  />
                ) : bothControlled ? (
                  <span
                    className={`inline-flex items-center rounded-none border px-2 py-1 text-[0.7rem] uppercase tracking-[0.08em] max-[980px]:flex-1 max-[980px]:self-stretch ${
                      allDone
                        ? "border-[rgba(110,215,177,0.4)] bg-[rgba(20,73,63,0.36)] text-[#8ff6d3]"
                        : "border-[rgba(132,150,184,0.3)] bg-[rgba(11,19,32,0.7)] text-(--text-soft)"
                    }`}
                  >
                    {allDone
                      ? (t("sim.bothDecksReady") ?? "Both decks ready")
                      : active.some((player) => done.has(player.id))
                        ? (t("sim.lockedDecksCount", {
                            locked: active.filter((player) => done.has(player.id)).length,
                            total: active.length,
                          }) ?? "Decks locked")
                        : (t("sim.reviewBothTabsLockTogether") ?? "Review both tabs and lock together")}
                  </span>
                ) : opponent ? (
                  <span
                    className={`inline-flex items-center rounded-none border px-2 py-1 text-[0.7rem] uppercase tracking-[0.08em] max-[980px]:flex-1 max-[980px]:self-stretch ${
                      done.has(opponent.id)
                        ? "border-[rgba(110,215,177,0.4)] bg-[rgba(20,73,63,0.36)] text-[#8ff6d3]"
                        : "border-[rgba(132,150,184,0.3)] bg-[rgba(11,19,32,0.7)] text-(--text-soft)"
                    }`}
                  >
                    {done.has(opponent.id)
                      ? (t("sim.playerReady", { player: opponent.name }) ?? `${opponent.name} ready`)
                      : (t("sim.waitingForPlayer", { player: opponent.name }) ?? `Waiting for ${opponent.name}`)}
                  </span>
                ) : null}
              </div>
            </div>
            <div
              data-testid="sideboarding-footer-actions"
              className="flex shrink-0 items-center gap-2 self-end min-[980px]:ml-auto max-[980px]:self-stretch max-[720px]:flex-col"
            >
              {skipControl === "immediate" ? (
                <button
                  type="button"
                  className={SKIP_OUTLINE_BUTTON}
                  disabled={done.has(selectedPlayer.id)}
                  onClick={skipSideboarding}
                  data-testid="skip-sideboarding"
                >
                  {mode === "solo_lab"
                    ? active.length > 2
                      ? (t("sim.skipAllSideboards") ?? "Skip All Sideboards")
                      : (t("sim.skipBothSideboards") ?? "Skip Both Sideboards")
                    : (t("sim.skipSideboarding") ?? "Skip Sideboarding")}
                </button>
              ) : skipControl === "hidden" ? null : (
                <div className="relative shrink-0 max-[720px]:w-full">
                  {skipControl === "request" ? (
                    <button
                      type="button"
                      data-testid="request-sideboard-skip"
                      className={SKIP_OUTLINE_BUTTON}
                      disabled={!canSubmitSelected}
                      onClick={() => {
                        if (onRequestSideboardSkip) onRequestSideboardSkip();
                        else dispatch({ type: "request_sideboard_skip" });
                      }}
                    >
                      {t("sim.requestSkipSideboarding") ?? "Skip card swaps"}
                    </button>
                  ) : skipControl === "recipient_pending" ? (
                    <button
                      type="button"
                      aria-describedby="sideboard-skip-responder-message"
                      data-testid="accept-sideboard-skip-request"
                      className={SKIP_ACCEPT_BUTTON}
                      disabled={!canSubmitSelected}
                      onClick={() => {
                        if (onRespondSideboardSkip) onRespondSideboardSkip(true);
                        else dispatch({ type: "respond_sideboard_skip", response: "accept" });
                      }}
                    >
                      {t("sim.acceptSideboardSkip") ?? "Accept Skip"}
                    </button>
                  ) : skipControl === "declined" ? (
                    <button
                      type="button"
                      className="min-w-48 rounded-none border border-[rgba(218,117,117,0.52)] bg-[rgba(69,28,35,0.72)] px-4 py-2 text-[0.76rem] font-semibold uppercase tracking-widest text-[#ffc5c5] transition-[border-color,background,color] duration-140 focus-visible:border-[rgba(255,171,171,0.86)] focus-visible:outline-none disabled:cursor-default disabled:opacity-80 max-[720px]:w-full"
                      data-testid="sideboard-skip-declined-status"
                      disabled
                    >
                      {t("sim.sideboardSkipDeclined") ?? "Skip Declined"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={skipControl === "recipient_accepted_waiting" ? SKIP_ACCEPT_BUTTON : SKIP_OUTLINE_BUTTON}
                      data-testid="sideboard-skip-request-status"
                      disabled
                    >
                      {skipControl === "requester_waiting"
                        ? (t("sim.skipSideboardingRequestWaiting", {
                            accepted: skipAccepted,
                            total: active.length,
                          }) ?? `Skip requested · ${skipAccepted}/${active.length}`)
                        : (t("sim.skipSideboardingAcceptedWaiting", {
                            accepted: skipAccepted,
                            total: active.length,
                          }) ?? `Skip accepted · ${skipAccepted}/${active.length}`)}
                    </button>
                  )}
                  {skipControl === "requester_waiting" ||
                  (skipControl === "declined" && skipRequester === viewerId) ? (
                    <section
                      aria-atomic="true"
                      aria-label={t("sim.sideboardSkipRequestStatus") ?? "Skip request status"}
                      aria-live="polite"
                      className={SKIP_POPOVER}
                      data-sideboard-skip-popover-kind="requester"
                      data-testid="sideboard-skip-popover"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#f2e5ca]">
                          {skipControl === "declined"
                            ? (t("sim.sideboardSkipDeclined") ?? "Skip Declined")
                            : (t("sim.skipSideboarding") ?? "Skip Sideboarding")}
                        </p>
                        <span className="shrink-0 text-[0.62rem] text-(--text-soft)">
                          {t("sim.sideboardSkipAcceptedCount", {
                            accepted: skipAccepted,
                            total: active.length,
                          }) ?? `${skipAccepted}/${active.length} accepted`}
                        </span>
                      </div>
                      <SkipPlayerRows
                        rows={skipRows}
                        ariaLabel={t("sim.sideboardSkipPlayerStatuses") ?? "Player responses"}
                      />
                      {skipControl === "requester_waiting" ? (
                        <button
                          type="button"
                          data-testid="cancel-sideboard-skip-request"
                          className={SKIP_CANCEL_BUTTON}
                          disabled={!canSubmitSelected}
                          onClick={() => {
                            if (onRespondSideboardSkip) onRespondSideboardSkip(false);
                            else dispatch({ type: "respond_sideboard_skip", response: "cancel" });
                          }}
                        >
                          {t("sim.cancelSkipRequest") ?? "Cancel Request"}
                        </button>
                      ) : null}
                      <span aria-hidden="true" className={SKIP_POPOVER_ARROW} />
                    </section>
                  ) : skipControl === "recipient_pending" ||
                    skipControl === "recipient_accepted_waiting" ||
                    skipControl === "declined" ? (
                    <section
                      aria-atomic="true"
                      aria-label={t("sim.sideboardSkipRequest") ?? "Skip card swaps request"}
                      aria-live="polite"
                      className={SKIP_POPOVER}
                      data-sideboard-skip-popover-kind="responder"
                      data-testid="sideboard-skip-popover"
                    >
                      <p className="m-0 text-[0.72rem] leading-relaxed text-[#e5eaf2]" id="sideboard-skip-responder-message">
                        {skipControl === "declined"
                          ? (t("sim.sideboardSkipDeclinedBy", {
                              player:
                                active.find((player) => player.id === skipRequest?.declinedPlayerId)?.name ??
                                (t("sim.opponent") ?? "Opponent"),
                            }) ?? "Player declined. Keep sideboarding.")
                          : skipControl === "recipient_accepted_waiting"
                            ? (t("sim.sideboardSkipAcceptedWaitingForPlayers") ?? "Accepted. Waiting for everyone else.")
                            : (t("sim.sideboardSkipRequestMessage", {
                                player:
                                  active.find((player) => player.id === skipRequester)?.name ??
                                  (t("sim.opponent") ?? "Opponent"),
                              }) ?? "An opponent wants to skip card swaps.")}
                      </p>
                      {skipControl !== "declined" ? (
                        <button
                          type="button"
                          data-testid="decline-sideboard-skip-request"
                          className={SKIP_DECLINE_BUTTON}
                          disabled={!canSubmitSelected}
                          onClick={() => {
                            if (onRespondSideboardSkip) onRespondSideboardSkip(false);
                            else dispatch({ type: "respond_sideboard_skip", response: "decline" });
                          }}
                        >
                          {t("sim.declineSkipRequest") ?? "Decline"}
                        </button>
                      ) : null}
                      <span aria-hidden="true" className={SKIP_POPOVER_ARROW} />
                    </section>
                  ) : null}
                </div>
              )}
              {bothPending ? (
                <button
                  type="button"
                  className={SETUP_PRIMARY_BUTTON_CLASS}
                  disabled={!bothControlled}
                  onClick={() => {
                    for (const player of active) {
                      if (!done.has(player.id)) queueRef.current.push(player.id);
                    }
                    pumpQueue();
                  }}
                  data-testid="lock-in-both-decks"
                  data-setup-action="submit-both-sideboards"
                >
                  {t("sim.lockInBothDecks") ?? "Lock In Both Decks"}
                </button>
              ) : null}
              <button
                type="button"
                className={SETUP_PRIMARY_BUTTON_CLASS}
                disabled={!canSubmitSelected || done.has(selectedPlayer.id)}
                onClick={() => submit(selectedPlayer.id)}
                data-testid="lock-in-sideboard"
                data-setup-action="submit-sideboard"
              >
                {done.has(selectedPlayer.id)
                  ? (t("sim.sideboardLockedIn") ?? "Sideboard Locked In")
                  : (t("sim.lockInSideboard") ?? "Lock In Sideboard")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
