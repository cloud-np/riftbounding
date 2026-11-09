"use client";

import type { RoomPlayer } from "@rift/protocol";
import { createTranslator } from "@rift/i18n";

import type { CardSide } from "../card/types";
import { useBoardInteractionOptional } from "../interaction/context";

const t = createTranslator("en");

export function IdentityBadge({
  player,
  side,
  clock,
  active,
  online,
}: {
  player: RoomPlayer;
  side: CardSide;
  clock?: string | null;
  active?: boolean;
  /** Presence; bots are always online (the server drives them without a transport). */
  online?: boolean;
}) {
  const variant = side === "self" ? "player" : "opponent";
  const hasTimer = !!clock;
  const interaction = useBoardInteractionOptional();
  const playerTarget = !!interaction?.strictPromptOptionIds.has(player.id);
  const isBot = !!player.isBot;
  const isOnline = isBot || (online ?? !player.leftAt);
  const hasBotBadge = isBot && !hasTimer;
  const avatarLabel =
    (isBot ? "B" : player.name.trim().charAt(0).toUpperCase()) || "P";
  return (
    <div
      data-player-identity-rail={side}
      data-target-player-id={player.id}
      data-strict-prompt-option={playerTarget ? "true" : undefined}
      data-strict-prompt-hover={
        playerTarget && interaction?.strictPromptHoverId === player.id ? "true" : undefined
      }
      onClick={
        playerTarget
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              interaction?.handlePlayerTargetClick(player.id);
            }
          : undefined
      }
      className={
        (side === "self"
          ? "absolute left-[calc(var(--track-edge-inset)+var(--score-track-rail-width)/2-var(--identity-badge-width)/2)] bottom-(--identity-badge-edge-inset) z-13 flex translate-x-(--identity-badge-player-nudge) items-center pointer-events-none"
          : "absolute top-(--identity-badge-edge-inset) right-[calc(var(--track-edge-inset)+var(--score-track-rail-width)/2-var(--identity-badge-width)/2)] z-13 flex -translate-x-(--identity-badge-opponent-nudge) items-center pointer-events-none") +
        (playerTarget ? " pointer-events-auto cursor-pointer" : "")
      }
      style={{ height: "var(--identity-badge-height)" }}
    >
      <div className="relative flex items-center justify-center">
        <div
          className="identityBadgeTotem relative h-(--identity-badge-height) w-(--identity-badge-width) pointer-events-none"
          data-identity-totem={variant}
          data-has-timer={hasTimer || hasBotBadge ? "true" : "false"}
          data-identity-online={isOnline ? "true" : "false"}
        >
          <div
            className={
              "identityBadgeFrame relative isolate grid h-(--identity-badge-height) w-(--identity-badge-width) min-w-0 grid-cols-[minmax(0,1fr)_auto] grid-rows-[minmax(0,1fr)_auto] items-center gap-x-[0.2rem] gap-y-[0.06rem] px-[0.38rem] py-[0.16rem] text-[#edf7ff] " +
              (side === "self" ? "identityBadgeFramePlayer text-[#edf8ff]" : "identityBadgeFrameOpponent")
            }
            data-active={active ?? false}
            data-variant={variant}
            data-player-identity-trigger={variant}
            data-has-badges="false"
          >
            <div className="relative z-2 col-start-1 row-start-1 flex h-full min-w-0 items-center justify-center gap-[0.24rem] px-[0.16rem] py-[0.04rem] text-center">
              <span
                data-identity-avatar="true"
                data-identity-avatar-bot={isBot ? "true" : undefined}
                className="relative grid h-[1.45rem] w-[1.45rem] shrink-0 place-items-center rounded-full border border-[rgba(194,214,238,0.48)] bg-[linear-gradient(150deg,rgba(47,74,108,0.98),rgba(21,39,62,0.98))] text-[0.68rem] font-black text-[#eaf7ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_6px_rgba(2,7,18,0.4)]"
                aria-hidden="true"
              >
                {avatarLabel}
                <span
                  data-identity-presence={isOnline ? "online" : "offline"}
                  className={`absolute -bottom-[0.08rem] -right-[0.08rem] h-[0.38rem] w-[0.38rem] rounded-full border border-[#07101c] ${
                    isOnline ? "bg-[#78ddb7]" : "bg-[#8fa0b5]"
                  }`}
                />
              </span>
              <div className="min-w-0" data-identity-player-name="true">
                <span className="block w-full truncate text-center text-[0.86rem] font-black leading-none tracking-normal [text-shadow:0_1px_0_rgba(3,8,20,0.96),0_0_7px_rgba(190,220,255,0.16)]">
                  {player.name}
                </span>
              </div>
            </div>
            <div
              className="relative z-2 col-start-2 row-start-1 flex shrink-0 items-center justify-end gap-[0.16rem]"
              data-identity-utilities="true"
            />
            {hasTimer ? (
              <div
                className={
                  "identityBadgeClock " +
                  (side === "self" ? "identityBadgeClockPlayer" : "identityBadgeClockOpponent")
                }
                data-variant={variant}
              >
                <span className="relative z-2 block text-center text-[0.64rem] font-bold leading-none tracking-[0.05em] tabular-nums text-[#eaf7ff]">
                  {clock}
                </span>
              </div>
            ) : hasBotBadge ? (
              <div
                className={
                  "identityBadgeClock " +
                  (side === "self" ? "identityBadgeClockPlayer" : "identityBadgeClockOpponent")
                }
                data-variant={variant}
                data-identity-bot-badge="true"
                title={t("sim.botBadge") ?? "Bot"}
              >
                <span className="relative z-2 block text-center text-[0.56rem] font-black uppercase leading-none tracking-[0.05em] text-[#bdece7]">
                  {t("sim.botBadge") ?? "Bot"}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
