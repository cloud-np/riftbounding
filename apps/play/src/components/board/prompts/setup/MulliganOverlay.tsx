"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { motion } from "framer-motion";

import { createTranslator } from "@rift/i18n";
import type { Room, RoomPlayer } from "@rift/protocol";

import { CardArt } from "../../card/CardArt";
import { CardBack } from "../../card/CardBack";
import type { BoardSlotProps } from "../../slot-types";
import {
  SETUP_GREEN_CHIP_CLASS,
  SETUP_HEADING_BAND_CLASS,
  SETUP_PRIMARY_BUTTON_CLASS,
  SetupHeading,
} from "./SetupChrome";
import {
  activePlayers,
  mulliganKeptCount,
  nextMulliganActorId,
  orderPlayersForSeat,
  toggleMulliganSelection,
} from "./setup-state";

const t = createTranslator("en");

const MUL_VARS = {
  "--mul-card-w":
    "min(clamp(8.2rem,14vw,15.8rem), calc((100vw - 4.65rem) / 4), calc((100dvh - 14rem) / 2.8))",
  "--mul-card-h": "calc(var(--mul-card-w) * 1.4)",
} as unknown as CSSProperties;

interface PendingSubmit {
  playerId: string;
  cardIds: string[];
}

interface MulliganOverlayProps
  extends Pick<BoardSlotProps, "state" | "viewerId" | "controlledPlayerIds" | "dispatch" | "mode"> {}

function RowBadge({
  room,
  player,
  side,
}: {
  room: Room;
  player: RoomPlayer;
  side: "opponent" | "own";
}) {
  if (!room.firstPlayerId) return null;
  const first = room.firstPlayerId === player.id;
  const position =
    side === "own"
      ? "max-[600px]:left-1/2 max-[600px]:right-auto max-[600px]:top-[-2.8rem] max-[600px]:-translate-x-1/2 max-[600px]:ml-0 max-[600px]:mr-0 max-[600px]:text-[0.65rem] absolute right-full top-1/2 mr-[0.8rem] inline-flex shrink-0 -translate-y-1/2 items-center justify-center rounded-[0.3rem] border border-white/18 bg-black/22 px-[0.7rem] py-[0.28rem] text-[1.05rem] font-semibold tracking-[0.08em] text-white shadow-[0_8px_24px_rgba(0,0,0,0.28),inset_0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-[2px] max-[980px]:mr-[0.45rem] max-[980px]:px-[0.58rem] max-[980px]:py-[0.22rem] max-[980px]:text-[0.9rem]"
      : "max-[600px]:left-1/2 max-[600px]:top-[-0.3rem] max-[600px]:-translate-x-1/2 max-[600px]:ml-0 max-[600px]:text-[0.65rem] absolute left-full top-1/2 ml-[0.8rem] inline-flex shrink-0 -translate-y-1/2 items-center justify-center rounded-[0.3rem] border border-white/18 bg-black/22 px-[0.7rem] py-[0.28rem] text-[1.05rem] font-semibold tracking-[0.08em] text-white shadow-[0_8px_24px_rgba(0,0,0,0.28),inset_0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-[2px] max-[980px]:ml-[0.45rem] max-[980px]:px-[0.58rem] max-[980px]:py-[0.22rem] max-[980px]:text-[0.9rem]";
  return (
    <span className={position} data-mulligan-turn-badge={first ? "first" : "second"}>
      {first ? (t("sim.first") ?? "1st") : (t("sim.second") ?? "2nd")}
    </span>
  );
}

export function MulliganOverlay({
  state,
  viewerId,
  controlledPlayerIds,
  dispatch,
  mode,
}: MulliganOverlayProps) {
  const active = useMemo(() => orderPlayersForSeat(activePlayers(state)), [state]);
  const viewer = active.find((player) => player.id === viewerId) ?? active[0];
  const opponent = active.find((player) => player.id !== viewer?.id);
  const done = new Set(state.mulliganDonePlayerIds ?? []);
  const controlled = useMemo(() => new Set(controlledPlayerIds), [controlledPlayerIds]);
  const bothControlled =
    mode !== "multiplayer" &&
    active.length > 0 &&
    active.every((player) => controlled.has(player.id));
  const nextActorId = nextMulliganActorId(state, controlledPlayerIds);

  const [selectionByPlayer, setSelectionByPlayer] = useState<Record<string, string[]>>({});
  const selectionRef = useRef(selectionByPlayer);
  selectionRef.current = selectionByPlayer;
  const queueRef = useRef<PendingSubmit[]>([]);

  const roomKey = `${state.roomCode}:${state.phase}:${active.map((player) => player.id).join(",")}`;
  useEffect(() => {
    setSelectionByPlayer({});
    queueRef.current = [];
  }, [roomKey]);

  // Prune selections when cards leave a hand (mulligan resolution).
  useEffect(() => {
    setSelectionByPlayer((previous) => {
      let changed = false;
      const next: Record<string, string[]> = {};
      for (const player of active) {
        const hand = new Set((player.board?.hand ?? []).map((card) => card.id));
        const kept = (previous[player.id] ?? []).filter((id) => hand.has(id));
        next[player.id] = kept;
        if (kept.length !== (previous[player.id] ?? []).length) changed = true;
      }
      if (Object.keys(previous).length !== Object.keys(next).length) changed = true;
      return changed ? next : previous;
    });
  }, [active, state.mulliganDonePlayerIds]);

  const pump = useCallback(() => {
    const pending = active.filter((player) => !done.has(player.id));
    const next = pending.find((player) => controlled.has(player.id));
    if (!next) return;
    const index = queueRef.current.findIndex((item) => item.playerId === next.id);
    if (index < 0) return;
    const item = queueRef.current[index]!;
    queueRef.current.splice(index, 1);
    dispatch({ type: "submit_mulligan", cardIds: item.cardIds.slice(0, 2) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- done/active are derived from state
  }, [active, controlled, dispatch, state.mulliganDonePlayerIds]);

  useEffect(() => {
    if (queueRef.current.length > 0) pump();
  }, [pump, state.mulliganDonePlayerIds]);

  if (!viewer) return null;

  const bothPending =
    bothControlled && active.some((player) => !done.has(player.id)) && active.length > 1;
  const totalSelected = active.reduce(
    (sum, player) => sum + (selectionByPlayer[player.id]?.length ?? 0),
    0,
  );
  const viewerSelection = selectionByPlayer[viewer.id] ?? [];
  const canSubmitOwn = !done.has(viewer.id) && nextActorId === viewer.id;

  const enqueue = (entries: PendingSubmit[]) => {
    const existing = new Set(queueRef.current.map((item) => item.playerId));
    for (const entry of entries) if (!existing.has(entry.playerId)) queueRef.current.push(entry);
    pump();
  };

  const submitOwn = () => {
    if (!canSubmitOwn) return;
    enqueue([{ playerId: viewer.id, cardIds: viewerSelection }]);
  };

  const submitPlayer = (playerId: string) => {
    if (nextActorId !== playerId) return;
    enqueue([{ playerId, cardIds: selectionByPlayer[playerId] ?? [] }]);
  };

  const submitBoth = () => {
    if (!bothControlled) return;
    const entries = active
      .filter((player) => !done.has(player.id))
      .map((player) => ({ playerId: player.id, cardIds: selectionByPlayer[player.id] ?? [] }));
    enqueue(entries);
  };

  const toggle = (playerId: string, cardId: string) => {
    if (done.has(playerId) || nextActorId !== playerId) return;
    setSelectionByPlayer((previous) => ({
      ...previous,
      [playerId]: toggleMulliganSelection(previous[playerId] ?? [], cardId),
    }));
  };

  const renderRow = (player: RoomPlayer | undefined, side: "opponent" | "own") => {
    if (!player) return null;
    const isSelf = player.id === viewer.id;
    const cards = player.board?.hand ?? [];
    const slots = side === "opponent" ? Math.max(4, cards.length) : cards.length;
    const playerDone = done.has(player.id);
    const interactive =
      !playerDone &&
      nextActorId === player.id &&
      (isSelf || bothControlled);
    const selection = selectionByPlayer[player.id] ?? [];
    const kept = mulliganKeptCount(state, player.id);
    return (
      <div
        className={side === "opponent" ? "relative grid place-items-center" : "relative grid place-items-center"}
        data-mulligan-side={side}
        data-mulligan-player-id={player.id}
      >
        <div
          className={
            side === "opponent"
              ? `relative translate-y-[-1.1rem] ${interactive ? "pointer-events-auto" : "pointer-events-none"}`
              : "pointer-events-auto relative flex items-center justify-center"
          }
        >
          {side === "opponent" && playerDone ? (
            <span
              className="absolute left-1/2 bottom-full mb-[0.22rem] -translate-x-1/2 z-15 inline-flex min-h-10 min-w-[10rem] items-center justify-center rounded-[0.4rem] border border-[rgba(110,215,177,0.55)] bg-[#10261f] px-5 py-1 text-base font-semibold text-[#8ff6d3]"
              data-testid="mulligan-opponent-status"
            >
              {typeof kept === "number"
                ? (t("sim.opponentKept", { count: kept }) ?? `Opponent kept ${kept}`)
                : (t("sim.opponentLockedIn") ?? "Opponent Locked In")}
            </span>
          ) : null}
          <div className="relative flex items-center justify-center">
            <RowBadge room={state} player={player} side={side} />
            <div
              className="flex items-center justify-center gap-[1.1rem] max-[980px]:gap-[0.55rem]"
              style={{ ...MUL_VARS }}
              data-testid={side === "own" ? "mulligan-own-options" : "mulligan-opponent-options"}
              data-mulligan-active={interactive ? "true" : "false"}
              aria-busy={false}
            >
              {Array.from({ length: slots }).map((_, index) => {
                const card = cards[index];
                const cardSelected = !!card && selection.includes(card.id);
                const faceDown = side === "opponent" && !bothControlled;
                if (!card) {
                  return (
                    <span
                      key={`empty-${index}`}
                      className="relative h-(--mul-card-h) w-(--mul-card-w) overflow-hidden rounded-none border border-[rgba(184,166,136,0.38)] bg-[rgba(14,26,48,0.82)] shadow-[0_12px_24px_rgba(3,10,22,0.5)]"
                      style={{ ...MUL_VARS }}
                    >
                      <CardBack slot="deck" insetPx={0} />
                    </span>
                  );
                }
                return (
                  <motion.button
                    key={card.id}
                    type="button"
                    aria-pressed={cardSelected}
                    disabled={!interactive}
                    onClick={() => toggle(player.id, card.id)}
                    initial={{ opacity: 0, y: side === "opponent" ? -24 : 26, scale: 0.9 }}
                    animate={{
                      opacity: 1,
                      y: cardSelected ? (side === "opponent" ? 20 : -20) : side === "opponent" ? 20 : -20,
                      scale: cardSelected ? 0.92 : 1,
                    }}
                    transition={{
                      delay: 0.05 * index,
                      type: "spring",
                      stiffness: side === "opponent" ? 170 : 176,
                      damping: side === "opponent" ? 23 : 24,
                    }}
                    className={`relative h-(--mul-card-h) w-(--mul-card-w) rounded-none border overflow-hidden shadow-[0_16px_28px_rgba(3,10,22,0.5)] ${
                      side === "opponent" ? "bg-[rgba(14,26,48,0.82)]" : ""
                    } ${
                      cardSelected
                        ? "border-transparent brightness-[0.55] saturate-50"
                        : "border-transparent hover:brightness-110"
                    } ${interactive ? "cursor-pointer" : "cursor-default"}`}
                    style={{ ...MUL_VARS }}
                    data-testid={`mulligan-${side === "own" ? "own" : "opponent"}-card-${index}`}
                    data-card-id={card.id}
                    data-mulligan-selected={cardSelected ? "true" : "false"}
                  >
                    {faceDown ? (
                      <CardBack slot="deck" insetPx={0} />
                    ) : (
                      <CardArt
                        card={card}
                        profile="preview"
                        className="h-full w-full object-cover"
                        alt={card.name}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
          {side === "own" ? (
            <div className="absolute left-1/2 top-full -translate-x-1/2 translate-y-3 pointer-events-auto flex items-center gap-2">
              {bothControlled && bothPending ? (
                <button
                  type="button"
                  className={SETUP_PRIMARY_BUTTON_CLASS}
                  disabled={!canSubmitOwn}
                  onClick={submitBoth}
                  data-testid="mulligan-both-submit"
                  data-setup-action="submit-both-mulligans"
                >
                  {totalSelected > 0
                    ? (t("sim.lockInBothMulligan", { count: totalSelected }) ??
                      `Lock In Both · Mulligan ${totalSelected}`)
                    : (t("sim.lockInBothKeep") ?? "Lock In Both · Keep both")}
                </button>
              ) : playerDone ? (
                <span className={SETUP_GREEN_CHIP_CLASS} data-testid="mulligan-locked-in">
                  {t("sim.lockedIn") ?? "Locked In"}
                </span>
              ) : (
                <button
                  type="button"
                  className={SETUP_PRIMARY_BUTTON_CLASS}
                  disabled={!canSubmitOwn}
                  onClick={submitOwn}
                  data-testid="mulligan-submit"
                  data-setup-action="submit-mulligan"
                >
                  {viewerSelection.length > 0
                    ? (t("sim.mulliganCount", { count: viewerSelection.length }) ??
                      `Mulligan ${viewerSelection.length}`)
                    : (t("sim.keepHand") ?? "Keep Hand")}
                </button>
              )}
            </div>
          ) : bothControlled && !playerDone && nextActorId === player.id ? (
            <div className="absolute left-1/2 top-full z-30 -translate-x-1/2 translate-y-3 pointer-events-auto">
              <button
                type="button"
                className={SETUP_PRIMARY_BUTTON_CLASS}
                onClick={() => submitPlayer(player.id)}
                data-testid="mulligan-opponent-submit"
                data-setup-action="submit-mulligan-opponent"
              >
                {selection.length > 0
                  ? (t("sim.mulliganCount", { count: selection.length }) ?? `Mulligan ${selection.length}`)
                  : (t("sim.keepHand") ?? "Keep Hand")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      data-setup-overlay="mulligan"
      data-testid="mulligan-overlay"
      initial={{ opacity: 0, scale: 0.992, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.994, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] } }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none z-45 absolute inset-0 select-none"
    >
      <div className="absolute inset-x-0 top-[49.4%] z-20 -translate-y-1/2 flex justify-center">
        <div className={SETUP_HEADING_BAND_CLASS}>
          <SetupHeading>
            {bothControlled
              ? bothPending
                ? (t("sim.chooseBothMulligans") ?? "Choose Both Mulligans")
                : (t("sim.mulligan") ?? "Mulligan")
              : (t("sim.chooseYourMulligan") ?? "Choose Your Mulligan")}
          </SetupHeading>
        </div>
      </div>

      <div className="absolute inset-x-[2.2rem] top-[2.2rem] bottom-[1.8rem] grid grid-rows-2 gap-8 max-[980px]:inset-x-3 max-[980px]:top-[2.6rem] max-[980px]:bottom-4">
        {renderRow(opponent, "opponent")}
        {renderRow(viewer, "own")}
      </div>
    </motion.div>
  );
}
