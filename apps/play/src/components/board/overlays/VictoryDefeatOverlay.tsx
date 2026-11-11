"use client";

/**
 * Full-screen victory / defeat cinematic for ANY format (BO1, BO3 games, Practice vs Bot).
 *
 * VICTORY (gold): the viewer's avatar and Legend stand triumphant while the opponent's Legend is
 * desaturated, cracks and shatters into embers. DEFEAT (cold): the viewer's own Legend falls and
 * the opponent's stands. A line from the Legend (legend-lines.ts, seeded per game) types out under
 * it. After ~3.5s the buttons appear; BO3 hands over to {@link GameOverOverlay} on Continue
 * (or automatically), BO1 / practice continue to the board (NEXT / LEAVE) or go back to the lobby.
 *
 * Motion: Full = cinematic, Reduced = fades only, Off = static card + line (no animation).
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import type { CardInstance, Room, RoomPlayer } from "@rift/protocol";

import { CardVisual } from "../card/CardVisual";
import { useBoardTranslator, text } from "../sidebar/i18n";
import { useAnimationLevel } from "../theme/motion";
import { gameResultView } from "./game-over-state";
import { pickLegendLine } from "./legend-lines";

const SETTLE_MS = 3600;
/** BO3 hands over to the series dialog this long after the cinematic settles. */
const BO3_AUTO_ADVANCE_MS = 6000;

function legendOf(player: RoomPlayer | undefined): CardInstance | null {
  return player?.board?.legend?.[0] ?? null;
}

function initialOf(player: RoomPlayer | undefined): string {
  if (!player) return "?";
  return (player.isBot ? "B" : player.name.trim().charAt(0).toUpperCase()) || "P";
}

/** Typewriter reveal; instant when `enabled` is false. */
function useTypewriter(text: string, startDelayMs: number, enabled: boolean): string {
  const [count, setCount] = useState(enabled ? 0 : text.length);
  useEffect(() => {
    if (!enabled) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let interval: number | undefined;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        setCount((value) => {
          if (value + 1 >= text.length && interval) window.clearInterval(interval);
          return Math.min(text.length, value + 1);
        });
      }, 32);
    }, startDelayMs);
    return () => {
      window.clearTimeout(start);
      if (interval) window.clearInterval(interval);
    };
  }, [text, startDelayMs, enabled]);
  return text.slice(0, count);
}

const SHARDS = [
  "polygon(0 0, 52% 0, 38% 34%, 0 28%)",
  "polygon(52% 0, 100% 0, 100% 36%, 66% 30%, 38% 34%)",
  "polygon(0 28%, 38% 34%, 30% 66%, 0 70%)",
  "polygon(38% 34%, 66% 30%, 100% 36%, 74% 64%, 30% 66%)",
  "polygon(0 70%, 30% 66%, 44% 100%, 0 100%)",
  "polygon(30% 66%, 74% 64%, 100% 36%, 100% 100%, 44% 100%)",
];

const CRACK_PATH =
  "M52 0 L38 34 L46 48 L30 66 L44 100 M38 34 L0 28 M46 48 L74 64 L100 36 M66 30 L74 64 M30 66 L0 70";

function Fighter({
  player,
  isViewer,
  fallen,
  victor,
  side,
  animated,
  youLabel,
  opponentLabel,
}: {
  player: RoomPlayer | undefined;
  isViewer: boolean;
  fallen: boolean;
  victor: boolean;
  side: "self" | "opponent";
  animated: boolean;
  youLabel: string;
  opponentLabel: string;
}) {
  const legend = legendOf(player);
  const card = legend ? <CardVisual card={legend} side={side} variant="full" /> : null;
  return (
    <div className="vd-fighter" data-fallen={fallen || undefined} data-victor={victor || undefined} data-animated={animated || undefined}>
      <div className="vd-avatar" aria-hidden="true">
        <span className="vd-avatar-ring" />
        <span className="vd-avatar-face">{initialOf(player)}</span>
      </div>
      <div className="vd-name">
        {player?.name ?? opponentLabel}
        {isViewer ? <span className="vd-you">{youLabel}</span> : null}
      </div>
      <div className="vd-card-slot" data-legend-name={legend?.name}>
        {card ? (
          fallen ? (
            <>
              <div className="vd-card vd-card--whole">{card}</div>
              <svg className="vd-crack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path d={CRACK_PATH} />
              </svg>
              <div className="vd-shards" aria-hidden="true">
                {SHARDS.map((clip, index) => (
                  <div key={clip} className="vd-shard" style={{ clipPath: clip, ["--i" as string]: index }}>
                    <div className="vd-card">{card}</div>
                  </div>
                ))}
              </div>
              <div className="vd-embers" aria-hidden="true">
                {Array.from({ length: 22 }, (_, index) => (
                  <span
                    key={index}
                    style={{
                      ["--x" as string]: `${((index * 37) % 100) - 50}%`,
                      ["--d" as string]: `${(index % 7) * 0.12}s`,
                      ["--s" as string]: `${3 + (index % 4)}px`,
                      ["--r" as string]: `${40 + ((index * 13) % 60)}%`,
                    }}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="vd-card vd-card--standing">{card}</div>
          )
        ) : (
          <div className="vd-card vd-card--missing" />
        )}
      </div>
    </div>
  );
}

export function VictoryDefeatOverlay({
  room,
  viewerId,
  bo3,
  onLeave,
  locale,
}: {
  room: Room;
  viewerId: string;
  /** BO3: Continue / auto-advance reveals the series dialog underneath. */
  bo3: boolean;
  /** Back to lobby / leave (omit when the surface offers none). */
  onLeave?: () => void;
  /** UI locale; defaults to the document language. */
  locale?: string;
}) {
  const level = useAnimationLevel();
  const tr = useBoardTranslator(locale ?? (typeof document === "undefined" ? undefined : document.documentElement.lang));
  const result = useMemo(() => gameResultView(room, viewerId), [room, viewerId]);
  const [mounted, setMounted] = useState(false);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  useEffect(() => setMounted(true), []);

  const open = mounted && result.finished && dismissedKey !== result.gameKey;
  const animated = level === "full";
  const instant = level === "off";

  // Reset the timeline for each new result.
  useEffect(() => {
    if (!open) return;
    if (instant) {
      setSettled(true);
      return;
    }
    setSettled(false);
    const timer = window.setTimeout(() => setSettled(true), animated ? SETTLE_MS : 900);
    return () => window.clearTimeout(timer);
  }, [open, instant, animated, result.gameKey]);

  const dismiss = () => setDismissedKey(result.gameKey);

  useEffect(() => {
    if (!open || !settled || !bo3) return;
    const timer = window.setTimeout(() => setDismissedKey(result.gameKey), BO3_AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [open, settled, bo3, result.gameKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        if (settled) setDismissedKey(result.gameKey);
        else setSettled(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, settled, result.gameKey]);

  const viewer = room.players.find((player) => player.id === viewerId);
  const opponent =
    room.players.find((player) => player.id === result.loserId && player.id !== viewerId) ??
    room.players.find((player) => player.id === result.winnerId && player.id !== viewerId) ??
    room.players.find((player) => player.id !== viewerId);
  const line = useMemo(
    () =>
      pickLegendLine({
        legendName: legendOf(viewer)?.name,
        won: result.viewerWon,
        situations: result.situations,
        seed: result.gameKey,
      }),
    [viewer, result.viewerWon, result.situations, result.gameKey],
  );
  const typed = useTypewriter(line.text, animated ? 2600 : 0, animated);

  if (!open || typeof document === "undefined") return null;
  const won = result.viewerWon;
  const title = won ? text(tr, "rules.ui.gameResult.victory", "Victory") : text(tr, "rules.ui.gameResult.defeat", "Defeat");
  const youLabel = text(tr, "rules.ui.gameResult.you", "You");
  const opponentLabel = text(tr, "rules.ui.gameResult.opponent", "Opponent");
  const subtitle =
    room.gameOutcome?.reason === "concession" || room.matchTermination?.reason === "concession"
      ? won
        ? text(tr, "rules.ui.gameResult.opponentConceded", "Your opponent conceded")
        : text(tr, "rules.ui.gameResult.youConceded", "You conceded")
      : room.matchTermination?.reason === "disconnect"
        ? won
          ? text(tr, "rules.ui.gameResult.opponentLeft", "Your opponent left the game")
          : text(tr, "rules.ui.gameResult.youLeft", "You left the game")
        : `${result.winnerScore} – ${result.loserScore}`;

  return createPortal(
    <div
      className="vd-root"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="victory-defeat-overlay"
      data-outcome={won ? "victory" : "defeat"}
      data-level={level}
      data-settled={settled || undefined}
    >
      <div className="vd-backdrop" />
      {won ? <div className="vd-rays" aria-hidden="true" /> : null}
      <div className="vd-content">
        <h2 className="vd-title" data-testid="vd-title">
          {title}
        </h2>
        <p className="vd-sub">{subtitle}</p>
        <div className="vd-stage">
          <Fighter player={viewer} isViewer side="self" fallen={!won} victor={won} animated={animated} youLabel={youLabel} opponentLabel={opponentLabel} />
          <div className="vd-versus" aria-hidden="true" />
          <Fighter player={opponent} isViewer={false} side="opponent" fallen={won} victor={!won} animated={animated} youLabel={youLabel} opponentLabel={opponentLabel} />
        </div>
        <blockquote className="vd-line" data-testid="vd-line">
          <span className="vd-line-text" aria-label={line.text}>
            {`“${typed}${typed.length < line.text.length ? "" : "”"}`}
          </span>
          <cite className="vd-line-by" data-visible={typed.length >= line.text.length || undefined}>
            {"— "}
            {line.attribution}
          </cite>
        </blockquote>
        <div className="vd-actions" data-visible={settled || undefined}>
          <button type="button" className="vd-btn vd-btn--primary" onClick={dismiss} data-testid="vd-continue" disabled={!settled}>
            {text(tr, "rules.ui.gameResult.continue", "Continue")}
          </button>
          {onLeave && !bo3 ? (
            <button type="button" className="vd-btn" onClick={onLeave} data-testid="vd-leave" disabled={!settled}>
              {text(tr, "rules.ui.gameResult.backToLobby", "Back to Lobby")}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
