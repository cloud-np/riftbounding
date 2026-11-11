"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import { createTranslator } from "@rift/i18n";
import type { RewindConfirmation, Room } from "@rift/protocol";

import { staticAsset } from "@/lib/assets";

import type { GameActionIntent } from "../slot-types";
import { SafeImg } from "../card/SafeImg";

const t = createTranslator("en");
const rewind = (key: string, params?: Record<string, string | number>) =>
  t(`sim.rewind.${key}`, params) ?? null;

function playerName(players: { id: string; name: string }[], playerId: string | undefined): string {
  if (!playerId) return rewind("unknownPlayer") ?? "Unknown player";
  return (
    players.find((player) => player.id === playerId)?.name ??
    rewind("unknownPlayer") ??
    "Unknown player"
  );
}

function viewerMode(
  confirmation: RewindConfirmation,
  viewerId: string | null,
): "requester" | "approver" | "spectator" {
  if (!viewerId) return "spectator";
  if (viewerId === confirmation.requesterPlayerId) return "requester";
  const approvers = confirmation.approverPlayerIds ?? [confirmation.approverPlayerId];
  return approvers.includes(viewerId) ? "approver" : "spectator";
}

export function RewindConfirmationPanel({
  confirmation,
  players,
  viewerId,
  pending,
  onRespond,
}: {
  confirmation: RewindConfirmation;
  players: { id: string; name: string }[];
  viewerId: string | null;
  pending: boolean;
  onRespond: (response: "approve" | "decline" | "cancel") => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const mode = viewerMode(confirmation, viewerId);
  const requesterName = playerName(players, confirmation.requesterPlayerId);
  const approverName = playerName(players, confirmation.approverPlayerId);
  const count = confirmation.opponentMeaningfulActionCount;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = Math.max(0, confirmation.expiresAt - now);
  const progress = Math.min(
    1,
    remaining / Math.max(1, confirmation.expiresAt - confirmation.requestedAt),
  );

  const description =
    mode === "approver"
      ? confirmation.approverPlayerIds
        ? rewind("multiplayerApproverDescription", { requesterName, count })
        : rewind("approverDescription", { requesterName, count })
      : mode === "requester"
        ? confirmation.approverPlayerIds
          ? rewind("multiplayerRequesterDescription", { requesterName, count })
          : rewind("requesterDescription", { approverName, count })
        : confirmation.approverPlayerIds
          ? rewind("multiplayerSpectatorDescription", { requesterName, count })
          : rewind("spectatorDescription", { requesterName, approverName, count });
  const status =
    mode === "approver"
      ? rewind("approverStatus")
      : mode === "requester"
        ? confirmation.approverPlayerIds
          ? rewind("multiplayerWaitingStatus")
          : rewind("requesterStatus", { approverName })
        : rewind("spectatorStatus");
  const actionable = mode === "approver" || mode === "requester";

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-[0.58rem] z-[145] w-[min(29rem,calc(100%-1rem))] -translate-x-1/2 max-sm:top-auto max-sm:bottom-[calc(env(safe-area-inset-bottom)+0.62rem)]"
      data-rewind-confirmation={mode}
      data-testid="rewind-confirmation"
    >
      <section
        aria-live={mode === "approver" ? undefined : "polite"}
        aria-modal={mode === "approver" ? true : undefined}
        role={mode === "approver" ? "dialog" : "region"}
        className="pointer-events-auto relative overflow-hidden rounded-[0.58rem] border border-[rgba(157,194,234,0.42)] bg-[linear-gradient(112deg,rgba(13,27,47,0.94),rgba(18,37,58,0.9))] px-[0.76rem] pb-[0.7rem] pt-[0.65rem] text-[#eff8ff] shadow-[0_12px_36px_rgba(2,8,18,0.46),inset_0_1px_0_rgba(225,243,255,0.08)] backdrop-blur-xl"
      >
        <div className="flex items-start gap-[0.58rem]">
          <span
            aria-hidden="true"
            className="mt-[0.08rem] grid size-[1.88rem] shrink-0 place-items-center rounded-full border border-[rgba(139,194,235,0.36)] bg-[rgba(60,115,158,0.17)] text-lg text-[#bfe8ff]"
          >
            ↺
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.13em] text-[#d7f0ff]">
                {t("sim.rewind.title") ?? "Rewind approval"}
              </h2>
              <span className="text-[0.6rem] font-medium uppercase tracking-[0.1em] text-[#90b5cc]">
                {rewind("affected", { count }) ?? `${count} affected`}
              </span>
            </div>
            <p className="mb-0 mt-[0.22rem] text-[0.72rem] leading-[1.36] text-[#e9f5fc]">
              {description}
            </p>
            <p className="mb-0 mt-[0.16rem] text-[0.62rem] leading-[1.3] text-[#9fbfd3]">
              {status}
            </p>
          </div>
        </div>
        {actionable ? (
          <div className="mt-[0.58rem] flex flex-wrap justify-end gap-[0.38rem]">
            {mode === "approver" ? (
              <>
                <button
                  type="button"
                  className="min-h-[2rem] rounded-[0.38rem] border border-[rgba(125,179,217,0.34)] bg-[rgba(22,47,69,0.76)] px-[0.68rem] text-[0.66rem] font-medium text-[#d8eaf5] transition-colors hover:border-[rgba(172,212,239,0.58)] hover:bg-[rgba(35,65,88,0.88)] disabled:cursor-wait disabled:opacity-55"
                  disabled={pending}
                  onClick={() => onRespond("decline")}
                  data-testid="rewind-decline"
                >
                  {t("sim.rewind.keepCurrentState") ?? "Keep current state"}
                </button>
                <button
                  type="button"
                  className="min-h-[2rem] rounded-[0.38rem] border border-[rgba(120,211,191,0.54)] bg-[linear-gradient(180deg,rgba(35,105,91,0.86),rgba(20,76,66,0.9))] px-[0.74rem] text-[0.66rem] font-semibold text-[#e6fff8] shadow-[inset_0_1px_0_rgba(213,255,244,0.12)] transition-colors hover:border-[rgba(165,238,220,0.78)] disabled:cursor-wait disabled:opacity-55"
                  disabled={pending}
                  onClick={() => onRespond("approve")}
                  data-testid="rewind-approve"
                >
                  {t("sim.rewind.allow") ?? "Allow Rewind"}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="min-h-[2rem] rounded-[0.38rem] border border-[rgba(125,179,217,0.34)] bg-[rgba(22,47,69,0.76)] px-[0.72rem] text-[0.66rem] font-medium text-[#d8eaf5] transition-colors hover:border-[rgba(172,212,239,0.58)] disabled:cursor-wait disabled:opacity-55"
                disabled={pending}
                onClick={() => onRespond("cancel")}
                data-testid="rewind-cancel"
              >
                {t("sim.rewind.cancelRequest") ?? "Cancel request"}
              </button>
            )}
          </div>
        ) : null}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-[rgba(110,159,193,0.13)]"
        >
          <div
            className="h-full origin-left bg-[linear-gradient(90deg,#70d4bd,#8acdf5)] shadow-[0_0_8px_rgba(115,211,224,0.54)]"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      </section>
    </div>
  );
}

export function RewindClockOverlay({ visible, label }: { visible: boolean; label?: string }) {
  const accent = "#b8e1ff";
  const accentGlow = "rgba(79,166,255,0.34)";
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-150 grid place-items-center overflow-hidden rounded-[inherit]"
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      data-rewind-overlay={visible ? "true" : "false"}
      data-testid="rewind-clock"
      aria-hidden={!visible}
    >
      {visible ? (
        <div className="relative grid h-full w-full -translate-x-[15.2%] place-items-center max-[1100px]:translate-x-0">
          <div
            aria-hidden="true"
            className="absolute h-[min(28rem,58%)] w-[min(28rem,58%)] rounded-full mix-blend-screen"
            style={{
              background:
                "radial-gradient(circle, rgba(79,166,255,0.34) 0%, rgba(19,58,91,0.06) 22%, transparent 62%)",
            }}
          />
          <div className="relative grid h-[clamp(9.5rem,31vmin,19.5rem)] w-[clamp(9.5rem,31vmin,19.5rem)] place-items-center">
            <motion.div
              className="relative h-[90%] w-[90%]"
              aria-hidden="true"
              initial={{ opacity: 0, rotate: -18, scale: 0.52 }}
              animate={{
                opacity: [0, 0.86, 0.86, 0.86],
                rotate: [-18, -6, 0, 0],
                scale: [0.52, 1.19, 0.952, 1],
              }}
              transition={{ duration: 1.18, times: [0, 0.18, 0.58, 1], ease: [0.16, 0.88, 0.2, 1] }}
            >
              <SafeImg
                src={staticAsset("effects/rewind-clock-face-v1.webp")}
                alt=""
                draggable={false}
                decoding="async"
                loading="eager"
                className="absolute inset-0 h-full w-full select-none object-contain mix-blend-screen"
                style={{ filter: `drop-shadow(0 0 0.7rem ${accentGlow})` }}
              />
              <span className="absolute bottom-1/2 left-1/2 h-[25%] w-[0.22rem] -translate-x-1/2">
                <motion.span
                  className="absolute inset-0 origin-bottom rounded-full"
                  style={{ background: "#edf9ff", boxShadow: `0 0 0.48rem ${accentGlow}` }}
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 0.72, ease: "linear", repeat: Infinity }}
                />
              </span>
              <span className="absolute bottom-1/2 left-1/2 h-[17%] w-[0.29rem] -translate-x-1/2">
                <motion.span
                  className="absolute inset-0 origin-bottom rounded-full"
                  style={{ background: accent, boxShadow: `0 0 0.5rem ${accentGlow}` }}
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 8.64, ease: "linear", repeat: Infinity }}
                />
              </span>
              <span className="absolute left-1/2 top-1/2 h-[0.74rem] w-[0.74rem] -translate-x-1/2 -translate-y-1/2">
                <motion.span
                  className="absolute inset-0 rounded-[0.1rem] border-2"
                  style={{
                    borderColor: "#edf9ff",
                    background: accent,
                    boxShadow: `0 0 0.72rem ${accentGlow}`,
                  }}
                  initial={{ scale: 0.68, rotate: 45 }}
                  animate={{ scale: [0.68, 1.22, 0.95, 1], rotate: [45, 59, 45, 45] }}
                  transition={{
                    duration: 0.37,
                    times: [0, 0.42, 0.72, 1],
                    ease: [0.16, 0.88, 0.2, 1],
                  }}
                >
                  <span className="absolute inset-[0.18rem] rounded-[0.04rem] bg-[#edf9ff]" />
                </motion.span>
              </span>
            </motion.div>
            <div
              className="absolute left-1/2 top-[93%] flex -translate-x-1/2 items-baseline justify-center gap-[0.48rem] whitespace-nowrap text-[0.65rem] font-medium uppercase tracking-[0.26em]"
              style={{
                color: "#eef9ff",
                textShadow: "0 0.12rem 0.24rem rgba(3,12,23,0.9), 0 0 0.7rem rgba(79,166,255,0.34)",
              }}
            >
              <span>{label ?? t("sim.rewindLabel") ?? "Rewind"}</span>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}

export function RewindOverlay({
  state,
  viewerId,
  dispatch,
  forcedVisible = false,
}: {
  state: Room;
  viewerId: string;
  dispatch: (intent: GameActionIntent) => void;
  forcedVisible?: boolean;
}) {
  const confirmation = state.rewindConfirmation;
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(forcedVisible || !!confirmation);
  const latestLog = state.log[state.log.length - 1];
  const logSuggestsRewind =
    latestLog?.actionKind === "rewind" ||
    latestLog?.actionKind === "forward" ||
    /rewound|restored the timeline|restored timeline/i.test(latestLog?.text ?? "");

  useEffect(() => {
    if (confirmation || forcedVisible || logSuggestsRewind) {
      setVisible(true);
      const timer = window.setTimeout(
        () => {
          if (!state.rewindConfirmation) setVisible(false);
        },
        confirmation ? 10000 : 4200,
      );
      return () => window.clearTimeout(timer);
    }
    setVisible(false);
    return undefined;
  }, [confirmation, forcedVisible, logSuggestsRewind, state.rewindConfirmation]);

  const onRespond = (response: "approve" | "decline" | "cancel") => {
    if (!confirmation) return;
    setPending(true);
    dispatch({ type: "respond_rewind_confirmation", requestId: confirmation.requestId, response });
    window.setTimeout(() => setPending(false), 1200);
  };

  return (
    <>
      <RewindClockOverlay visible={visible} />
      {confirmation ? (
        <RewindConfirmationPanel
          confirmation={confirmation}
          players={state.players}
          viewerId={viewerId}
          pending={pending}
          onRespond={onRespond}
        />
      ) : null}
    </>
  );
}
