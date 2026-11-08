"use client";

import type { RoomPlayer } from "@rift/protocol";

import type { CardSide } from "../card/types";

export function IdentityBadge({
  player,
  side,
  clock,
  active,
}: {
  player: RoomPlayer;
  side: CardSide;
  clock?: string | null;
  active?: boolean;
}) {
  const variant = side === "self" ? "player" : "opponent";
  const hasTimer = !!clock;
  return (
    <div
      data-player-identity-rail={side}
      className={
        side === "self"
          ? "absolute left-[calc(var(--track-edge-inset)+var(--score-track-rail-width)/2-var(--identity-badge-width)/2)] bottom-(--identity-badge-edge-inset) z-13 flex translate-x-(--identity-badge-player-nudge) items-center pointer-events-none"
          : "absolute top-(--identity-badge-edge-inset) right-[calc(var(--track-edge-inset)+var(--score-track-rail-width)/2-var(--identity-badge-width)/2)] z-13 flex -translate-x-(--identity-badge-opponent-nudge) items-center pointer-events-none"
      }
      style={{ height: "var(--identity-badge-height)" }}
    >
      <div className="relative flex items-center justify-center">
        <div
          className="identityBadgeTotem relative h-(--identity-badge-height) w-(--identity-badge-width) pointer-events-none"
          data-identity-totem={variant}
          data-has-timer={hasTimer ? "true" : "false"}
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
            <div className="relative z-2 col-start-1 row-start-1 grid h-full min-w-0 content-center justify-items-center gap-[0.06rem] px-[0.16rem] py-[0.04rem] text-center">
              <div className="w-full min-w-0" data-identity-player-name="true">
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
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
