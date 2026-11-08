"use client";

import type { CSSProperties } from "react";
import { motion } from "framer-motion";

import { createTranslator } from "@rift/i18n";
import type { Room, RoomPlayer } from "@rift/protocol";

import type { BoardSlotProps } from "../../slot-types";
import {
  BattlefieldDraftArt,
  SETUP_HEADING_BAND_CLASS,
  SETUP_PANEL_MOTION,
  SETUP_RANDOM_BUTTON_CLASS,
  SetupHeading,
} from "./SetupChrome";
import {
  battlefieldOptions,
  nextBattlefieldActorId,
  orderPlayersForSeat,
  activePlayers,
  battlefieldContributorIds,
} from "./setup-state";

const t = createTranslator("en");

interface BattlefieldPickOverlayProps extends Pick<BoardSlotProps, "state" | "viewerId" | "controlledPlayerIds" | "dispatch"> {}

const CARD_VARS = {
  "--bf-draft-w":
    "min(clamp(9.5rem,18vw,22rem), calc((100vw - 34rem) / 3), calc((100dvh - 14rem) / 1.436))",
  "--bf-draft-h": "calc(var(--bf-draft-w) * 0.718)",
} as unknown as CSSProperties;

function Row({
  room,
  player,
  viewerId,
  active,
  dispatch,
  rowKey,
}: {
  room: Room;
  player: RoomPlayer;
  viewerId: string;
  active: boolean;
  dispatch: BattlefieldPickOverlayProps["dispatch"];
  rowKey: string;
}) {
  const options = battlefieldOptions(room, player);
  const selected = player.selectedBattlefield;
  const isSelf = player.id === viewerId;
  return (
    <div
      className="relative grid place-items-center"
      data-testid={isSelf ? "battlefield-own-options" : "battlefield-opponent-options"}
      data-battlefield-player-id={player.id}
      data-battlefield-active={active ? "true" : "false"}
      aria-busy={false}
    >
      <div className={`${active ? "pointer-events-auto" : "pointer-events-none"} relative flex flex-col items-center justify-center`}>
        <div className="flex items-center justify-center gap-[1.1rem] max-[980px]:gap-[0.55rem]">
          {options.length > 0 ? (
            options.map((name, index) => {
              const isSelected = selected === name;
              return (
                <motion.button
                  key={`${rowKey}-bf-${name}`}
                  type="button"
                  layout
                  initial={{ opacity: 0, y: 34, scale: 0.9, rotate: 0 }}
                  animate={{ opacity: 1, y: -24, x: 0, rotate: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 178, damping: 24 }}
                  disabled={!active || !!selected}
                  onClick={() => {
                    if (!active || selected) return;
                    dispatch({ type: "select_battlefield", battlefield: name });
                  }}
                  aria-label={
                    t("sim.setup.chooseBattlefield", { battlefieldName: name }) ??
                    `Choose ${name}`
                  }
                  aria-pressed={isSelected}
                  data-testid={`${isSelf ? "battlefield-own" : "battlefield-opponent"}-option-${index}`}
                  data-battlefield-name={name}
                  className={`relative h-(--bf-draft-h) w-(--bf-draft-w) rounded-none border overflow-hidden shadow-[0_16px_28px_rgba(3,10,22,0.5)] ${
                    isSelected
                      ? "border-[rgba(139,222,189,0.66)]"
                      : "border-[rgba(188,165,122,0.38)]"
                  } ${active && !selected ? "cursor-pointer" : "cursor-default"}`}
                  style={CARD_VARS}
                >
                  <BattlefieldDraftArt name={name} />
                  <span className="pointer-events-none absolute inset-x-1 bottom-1 border border-[rgba(216,198,158,0.4)] bg-[rgba(5,12,23,0.88)] px-2 py-1 text-center text-[0.58rem] font-medium uppercase tracking-[0.12em] text-[#e8dcc1]">
                    {name}
                  </span>
                </motion.button>
              );
            })
          ) : (
            <div className="grid h-(--bf-draft-h) w-(--bf-draft-w) place-items-center border border-dashed border-[rgba(188,165,122,0.38)] bg-[rgba(14,26,48,0.82)] text-center text-[0.72rem] text-[#c6d5e7]">
              {t("sim.noBattlefields") ?? "No battlefields"}
            </div>
          )}
        </div>
        <button
          type="button"
          className={SETUP_RANDOM_BUTTON_CLASS}
          style={{ marginTop: "0.85rem" }}
          disabled={!active || !!selected || options.length === 0}
          onClick={() => {
            if (!active || selected) return;
            dispatch({ type: "select_battlefield", random: true });
          }}
          data-testid={isSelf ? "battlefield-own-random" : "battlefield-opponent-random"}
          data-setup-action="select-battlefield-random"
        >
          {t("sim.setup.chooseRandom") ?? "Choose Random"}
        </button>
      </div>
    </div>
  );
}

export function BattlefieldPickOverlay({
  state,
  viewerId,
  controlledPlayerIds,
  dispatch,
}: BattlefieldPickOverlayProps) {
  const active = orderPlayersForSeat(activePlayers(state));
  const viewer = active.find((player) => player.id === viewerId) ?? active[0];
  const opponent = active.find((player) => player.id !== viewer?.id);
  const nextActorId = nextBattlefieldActorId(state, controlledPlayerIds);
  const contributors = new Set(battlefieldContributorIds(state));
  const viewerIsContributor = !!viewer && contributors.has(viewer.id);
  const rows =
    active.length <= 2
      ? [opponent, viewer].filter((player): player is RoomPlayer => !!player)
      : active.filter((player) => contributors.has(player.id));

  if (!viewer) return null;

  return (
    <motion.div
      data-setup-overlay="battlefield"
      data-testid="battlefield-pick-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.992, transition: { duration: 0.32, ease: [0.33, 1, 0.68, 1] } }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none z-45 absolute inset-0 select-none"
    >
      <div className="absolute inset-x-0 top-[49.4%] z-20 -translate-y-1/2 flex justify-center">
        <div className={SETUP_HEADING_BAND_CLASS}>
          <SetupHeading>{t("sim.chooseBattlefield") ?? "Choose Battlefield"}</SetupHeading>
        </div>
      </div>

      {!viewerIsContributor ? (
        <div className="absolute inset-0 grid place-items-center px-4">
          <div className="max-w-xl rounded-[0.2rem] border border-[rgba(132,150,184,0.34)] bg-[linear-gradient(145deg,rgba(16,40,74,0.92),rgba(6,18,38,0.94))] px-7 py-6 text-center shadow-[inset_0_0_0_1px_rgba(232,214,176,0.1),0_16px_34px_rgba(2,8,19,0.46)]">
            <p className="m-0 text-[0.9rem] font-semibold uppercase tracking-[0.1em] text-[#ffe8bd]">
              {t("sim.setup.youGoFirst") ?? "You go first"}
            </p>
            <p className="mt-2 text-[0.74rem] leading-relaxed text-[#c6d5e7]">
              {t("sim.setup.firstPlayerBattlefieldWait") ??
                "The first player does not contribute a battlefield in this mode."}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="absolute inset-x-[2.2rem] top-[2.2rem] bottom-[1.8rem] grid grid-rows-2 gap-8 max-[980px]:inset-x-3 max-[980px]:top-[2.6rem] max-[980px]:bottom-4"
          style={{ ...CARD_VARS }}
        >
          {rows.map((player) => (
            <Row
              key={player.id}
              room={state}
              player={player}
              viewerId={viewerId}
              active={nextActorId === player.id}
              dispatch={dispatch}
              rowKey={player.id}
            />
          ))}
        </div>
      )}

      <p
        className="pointer-events-none absolute inset-x-0 bottom-[1.1rem] text-center text-[0.62rem] uppercase tracking-[0.1em] text-[#a8bdd6]"
        data-testid="battlefield-pick-status"
      >
        {nextActorId
          ? `${active.find((player) => player.id === nextActorId)?.name ?? ""} · ${
              t("sim.setup.chooseOrRandom") ?? "Choose / Random"
            }`
          : t("sim.setup.waiting") ?? "Waiting"}
      </p>
    </motion.div>
  );
}
