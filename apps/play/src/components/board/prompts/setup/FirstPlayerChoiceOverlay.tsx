"use client";

import { motion } from "framer-motion";

import { createTranslator } from "@rift/i18n";

import { staticAsset } from "@/lib/assets";

import type { BoardSlotProps } from "../../slot-types";
import { SETUP_HEADING_BAND_CLASS, SETUP_PANEL_MOTION, SetupHeading } from "./SetupChrome";
import {
  canChooseFirstPlayer,
  firstPlayerChoiceOptions,
  playerById,
} from "./setup-state";

const t = createTranslator("en");

interface FirstPlayerOverlayProps
  extends Pick<BoardSlotProps, "state" | "viewerId" | "controlledPlayerIds" | "dispatch" | "mode"> {}

const VISUALS = {
  self: "border-[rgba(140,221,191,0.58)] bg-[#0d2824] text-[#defdf1] hover:border-[rgba(176,246,218,0.84)] hover:brightness-115 hover:shadow-[inset_0_0_0_1px_rgba(219,255,243,0.07),0_12px_30px_rgba(2,8,19,0.28)] focus-visible:ring-[rgba(167,239,212,0.62)]",
  ally: "border-[rgba(111,186,214,0.68)] bg-[#112a34] text-[#dcf7ff] hover:border-[rgba(150,224,244,0.84)] hover:brightness-115 focus-visible:ring-[rgba(150,224,244,0.62)]",
  opponent:
    "border-[rgba(236,163,103,0.72)] bg-[#261714] text-[#ffe7cf] hover:border-[rgba(255,204,150,0.9)] hover:brightness-115 focus-visible:ring-[rgba(255,204,150,0.62)]",
} as const;

export function FirstPlayerChoiceOverlay({
  state,
  viewerId,
  controlledPlayerIds,
  dispatch,
}: FirstPlayerOverlayProps) {
  const goldfish = state.roomMode === "single_player";
  const chooser = playerById(state, state.firstPlayerChooserId);
  const canChoose = canChooseFirstPlayer(state, viewerId, controlledPlayerIds);
  const options = firstPlayerChoiceOptions(state, viewerId, t);
  const heading = !canChoose
    ? (t("sim.waitingFirstPlayerChoice", { playerName: chooser?.name ?? "" }) ??
      `Waiting for ${chooser?.name ?? "the winner"} to decide who goes first.`)
    : goldfish
      ? (t("sim.chooseGoldfishTurnOrder") ?? "Choose Goldfish Turn Order")
      : (t("sim.chooseWhoGoesFirst") ?? "Choose Who Goes First");
  const columns = options.length > 2;
  const showMetadata = !goldfish && options.length > 2;
  const relationLabel = (relation: "self" | "opponent" | "ally") =>
    relation === "self"
      ? (t("sim.you") ?? "You")
      : relation === "ally"
        ? (t("sim.setup.ally") ?? "Ally")
        : (t("sim.opponent") ?? "Opponent");

  const choose = (playerId: string) => {
    if (!canChoose) return;
    if (goldfish) {
      dispatch({
        type: "choose_single_player_turn_order",
        turnOrder: playerId === viewerId ? "play_first" : "play_second",
      });
      return;
    }
    dispatch({ type: "choose_first_player", firstPlayerId: playerId });
  };

  return (
    <section
      role="dialog"
      aria-label={heading}
      aria-live={goldfish ? undefined : "polite"}
      data-testid={goldfish ? "single-player-turn-order-overlay" : "first-player-choice-overlay"}
      data-setup-overlay="first-player-choice"
      className="pointer-events-none z-45 absolute inset-0 select-none"
    >
      <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
        <div className={SETUP_HEADING_BAND_CLASS}>
          <SetupHeading>{heading}</SetupHeading>
        </div>
      </div>

      <div
        data-choice-layout={
          columns ? "multiplayer-grid" : goldfish ? "self-above-opponent" : "opponent-above-self"
        }
        className={`absolute inset-x-[2.2rem] top-[2.2rem] bottom-[1.8rem] grid gap-[0.92rem] max-[980px]:inset-x-3 max-[980px]:top-[2.6rem] max-[980px]:bottom-4 ${
          columns ? "grid-cols-2 grid-rows-2" : "grid-rows-2"
        }`}
      >
        {options.map(({ player, relation, label }, index) => (
          <motion.button
            key={player.id}
            type="button"
            data-testid={`first-player-choice-${player.id}`}
            data-player-label={player.name}
            data-player-relation={relation}
            data-team-label={state.teamIdByPlayerId?.[player.id]}
            data-setup-action={goldfish ? "choose-turn-order" : "choose-first-player"}
            aria-label={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            disabled={!canChoose}
            onClick={() => choose(player.id)}
            style={{
              backgroundImage: `url(${staticAsset(
                relation === "self"
                  ? "setup/first-player-choice-self-v2.webp"
                  : "setup/first-player-choice-opponent-v2.webp",
              )})`,
            }}
            className={`pointer-events-auto relative cursor-pointer rounded-none border bg-cover bg-center px-[0.9rem] py-[0.8rem] transition-[border-color,filter,box-shadow] focus-visible:outline-none focus-visible:ring-2 disabled:cursor-default disabled:opacity-55 disabled:hover:brightness-100 ${VISUALS[relation]}`}
          >
            <p className="m-0 text-center text-[1.12rem] font-semibold uppercase tracking-[0.04em] text-shadow-[0_2px_12px_rgba(0,0,0,0.78)]">
              {label}
            </p>
            {showMetadata ? (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-white/76">
                <span className="rounded-[0.18rem] border border-white/22 bg-black/24 px-1.5 py-0.5">
                  {`P${player.seat + 1}`}
                </span>
                {state.teamIdByPlayerId?.[player.id] ? (
                  <span className="rounded-[0.18rem] border border-white/16 bg-black/18 px-1.5 py-0.5">
                    {`Team ${state.teamIdByPlayerId[player.id]}`}
                  </span>
                ) : null}
                <span className="rounded-[0.18rem] border border-white/16 bg-black/18 px-1.5 py-0.5">
                  {relationLabel(relation)}
                </span>
              </div>
            ) : null}
          </motion.button>
        ))}
      </div>
    </section>
  );
}
