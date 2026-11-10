"use client";

import type { RoomPlayer } from "@rift/protocol";
import { createTranslator } from "@rift/i18n";

import type { CardSide } from "../card/types";
import { useBoardInteractionOptional } from "../interaction/context";
import { useAnimationLevel } from "../theme/motion";

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
  const motion = useAnimationLevel();
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
      data-relation={side === "self" ? "self" : "opponent"}
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
            className="hero-plate relative isolate flex h-full w-full min-w-0 items-center gap-[0.42rem] px-[0.42rem] py-[0.28rem]"
            data-active={active ?? false}
            data-variant={variant}
            data-side={side}
            data-motion={motion}
            data-player-identity-trigger={variant}
            data-has-badges="false"
          >
            <span aria-hidden="true" className="hero-plate-sheen" />
            <span
              data-identity-avatar="true"
              data-identity-avatar-bot={isBot ? "true" : undefined}
              className="hero-medallion relative grid shrink-0 place-items-center"
              aria-hidden="true"
            >
              <span className="hero-medallion-ring" />
              <span className="hero-medallion-face">{avatarLabel}</span>
              <span
                data-identity-presence={isOnline ? "online" : "offline"}
                className="hero-presence"
              />
            </span>
            <div className="relative z-2 flex min-w-0 flex-1 flex-col justify-center gap-[0.2rem]">
              <div className="min-w-0" data-identity-player-name="true">
                <span className="hero-name block w-full truncate">{player.name}</span>
              </div>
              <div className="flex min-w-0 items-center gap-[0.3rem]" data-identity-utilities="true">
                {hasTimer ? (
                  <span
                    className={
                      "hero-chip hero-clock " +
                      (side === "self" ? "hero-chip-self" : "hero-chip-opponent")
                    }
                    data-variant={variant}
                  >
                    {clock}
                  </span>
                ) : hasBotBadge ? (
                  <span
                    className="hero-chip hero-bot"
                    data-variant={variant}
                    data-identity-bot-badge="true"
                    title={t("sim.botBadge") ?? "Bot"}
                  >
                    {t("sim.botBadge") ?? "Bot"}
                  </span>
                ) : null}
                <span
                  className="hero-turn"
                  data-active={active ?? false}
                  title={active ? "Active turn" : "Waiting"}
                >
                  <span className="hero-turn-dot" aria-hidden="true" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
