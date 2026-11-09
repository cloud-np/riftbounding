"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { createTranslator } from "@rift/i18n";
import type { Room } from "@rift/protocol";

const t = createTranslator("en");

export function DisconnectBanner({
  room,
  viewerId,
  connectedPlayerIds,
  mode,
  onClaimWin,
}: {
  room: Room;
  viewerId?: string;
  connectedPlayerIds?: readonly string[];
  mode?: "multiplayer" | "solo_lab" | "single_player";
  onClaimWin?: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  // R4 bot-room: the server-driven seat has no client connection, so it can never "leave"
  // through presence. Keep it out of both the leftAt list and the disconnected lookup.
  const left = room.players.filter((player) => !player.isBot && player.leftAt);
  const disconnected =
    left.length > 0
      ? undefined
      : room.players.find(
          (player) =>
            !player.isBot &&
            !player.leftAt &&
            player.id !== viewerId &&
            connectedPlayerIds !== undefined &&
            !connectedPlayerIds.includes(player.id),
        );
  if (
    dismissed ||
    mode !== "multiplayer" ||
    room.phase !== "in_game" ||
    (left.length === 0 && !disconnected)
  ) {
    return null;
  }
  const player = left[0] ?? disconnected!;
  const returned = player.leftReason === "returned_to_lobby";
  const claimable = !!disconnected || room.matchTermination?.reason === "disconnect" || !returned;

  return (
    <motion.div
      className="pointer-events-none absolute inset-x-[0.76rem] top-[0.64rem] z-[175] mx-auto w-fit max-w-[40rem] overflow-hidden rounded-[0.24rem] border border-[rgba(132,158,190,0.3)] bg-[#070c15] shadow-[inset_0_0_0_1px_rgba(226,237,255,0.04),0_16px_36px_rgba(2,5,11,0.56)] backdrop-blur-[1px]"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      data-testid="opponent-left-overlay"
      data-player-id={player.id}
      data-departure-kind={disconnected ? "disconnect" : (player.leftReason ?? "disconnect")}
      role="alertdialog"
      aria-modal="true"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_48%,rgba(58,82,111,0.16),transparent_48%),linear-gradient(180deg,rgba(8,17,30,0.14),rgba(3,8,15,0.38))]"
      />
      <div
        aria-hidden="true"
        className={`absolute inset-x-[12%] top-0 h-px ${
          returned
            ? "bg-[linear-gradient(90deg,transparent,rgba(132,215,207,0.58),transparent)]"
            : "bg-[linear-gradient(90deg,transparent,rgba(217,134,143,0.54),transparent)]"
        }`}
      />
      <button
        type="button"
        className="absolute right-[0.5rem] top-[0.5rem] z-10 inline-flex h-8 w-8 items-center justify-center rounded-[0.18rem] border border-[rgba(182,199,220,0.24)] bg-[rgba(9,17,29,0.78)] text-[#cbd6e4] hover:border-[rgba(218,228,241,0.46)] hover:bg-[rgba(19,31,47,0.92)] hover:text-white"
        onClick={() => setDismissed(true)}
        aria-label={t("sim.dismissPlayerLeftOverlay") ?? "Dismiss"}
        data-testid="opponent-left-dismiss"
      >
        ×
      </button>
      <section className="pointer-events-auto relative z-1 flex items-center gap-4 py-3 pr-12 pl-4 max-[760px]:flex-wrap">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-[0.18rem] border text-lg shadow-[inset_0_0_0_1px_rgba(255,229,232,0.045)] max-[520px]:hidden ${
            returned
              ? "border-[rgba(132,215,207,0.34)] bg-[rgba(27,72,70,0.58)] text-[#bdece7]"
              : "border-[rgba(215,143,151,0.3)] bg-[rgba(72,34,42,0.56)] text-[#e8aeb5]"
          }`}
          aria-hidden="true"
        >
          {returned ? "↩" : "!"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[1.05rem] font-semibold tracking-[0.01em] text-[#f3f7fc] text-shadow-[0_2px_10px_rgba(0,0,0,0.42)]">
            {t(returned ? "sim.playerLeft.returnedTitle" : "sim.playerLeft.title") ??
              (returned ? "Player Returned to Lobby" : "Player Left")}
          </h2>
          <p className="mt-0.5 min-w-0 break-words text-[0.7rem] leading-[1.35] text-[#aebdd0]">
            {t(returned ? "sim.playerLeft.returnedDescription" : "sim.playerLeft.description", {
              playerName: player.name,
            }) ?? `${player.name} has left the game.`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 max-[760px]:ml-[3.75rem] max-[760px]:w-[calc(100%-3.75rem)] max-[760px]:justify-end">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[0.16rem] border border-[rgba(177,197,220,0.24)] bg-[rgba(10,20,35,0.66)] px-3.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#d9e2ed] hover:border-[rgba(211,224,239,0.44)] hover:bg-[rgba(19,34,54,0.84)]"
            data-testid="opponent-left-keep-playing"
          >
            {t("sim.replay.solo") ?? "Play both sides"}
          </button>
          {claimable ? (
            <button
              type="button"
              onClick={() => {
                setDismissed(true);
                onClaimWin?.();
              }}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[0.16rem] border border-[rgba(120,211,191,0.48)] bg-[rgba(25,76,72,0.64)] px-3.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#d8f8f3] hover:border-[rgba(174,239,231,0.66)] hover:bg-[rgba(33,94,88,0.78)]"
              data-testid="opponent-left-claim-win"
            >
              {t("sim.lifecycle.claimWin") ?? "Claim Win"}
            </button>
          ) : null}
        </div>
      </section>
    </motion.div>
  );
}
