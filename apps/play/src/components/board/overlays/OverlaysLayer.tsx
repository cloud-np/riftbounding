"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Room } from "@rift/protocol";

import { CardFlightLayer } from "../effects/CardFlightLayer";
import { FxDirector } from "../fx/FxDirector";
import { ParticleBurstLayer, type BurstRequest } from "../effects/ParticleBurst";
import { EmoteFlightLayer } from "../emotes/EmoteFlightLayer";
import type { BoardSlotProps } from "../slot-types";
import { BaronNashorOverlay } from "./BaronNashorOverlay";
import { DiceResultOverlay } from "./DiceResultOverlay";
import { DisconnectBanner } from "./DisconnectBanner";
import { PresenceEffects } from "./PresenceEffects";
import { GameOverOverlay } from "./GameOverOverlay";
import { RewindOverlay } from "./RewindOverlay";
import { TimeWarpSweep } from "./TimeWarpSweep";

function latestRoll(room: Room) {
  const rolls = room.recentDieRolls ?? (room.lastDieRoll ? [room.lastDieRoll] : []);
  const latest = rolls[rolls.length - 1] ?? null;
  if (!latest) return null;
  return Date.now() - latest.rolledAt < 5000 ? latest : null;
}

function rectCenter(selector: string): { x: number; y: number; size: number } | null {
  if (typeof document === "undefined") return null;
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    size: Math.max(48, Math.min(rect.width, rect.height) * 0.7),
  };
}

export function OverlaysLayer(props: BoardSlotProps) {
  const { state, viewerId, dispatch } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousRef = useRef<Room | null>(null);
  const previousBaronRef = useRef(false);
  const [bursts, setBursts] = useState<BurstRequest[]>([]);
  const [baronVisible, setBaronVisible] = useState(false);
  const [sweepTrigger, setSweepTrigger] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const lastLogId = useRef<string | null>(null);
  const lastRollId = useRef<string | null>(null);

  // Keep the "recent die roll" window live.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 400);
    return () => window.clearInterval(timer);
  }, []);

  const spawnBurst = useCallback((center: { x: number; y: number; size: number } | null) => {
    if (!center) return;
    const container = containerRef.current?.getBoundingClientRect();
    if (!container) return;
    const request: BurstRequest = {
      id: `burst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      x: center.x - container.left,
      y: center.y - container.top,
      radius: center.size,
    };
    setBursts((current) => [...current, request].slice(-4));
  }, []);

  // Score increases and fresh conquer prompts emit a burst.
  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = state;
    if (!previous) return;
    // Score bursts are handled by the FX director (fx/FxDirector).
    const previousAssist = previous.pendingBattlefieldConquerAssist?.zone;
    const assist = state.pendingBattlefieldConquerAssist?.zone;
    if (assist && assist !== previousAssist) {
      spawnBurst(rectCenter(`[data-battlefield-marker="${assist}"]`));
    }
  }, [spawnBurst, state, viewerId]);

  // Baron Pit reveal.
  useEffect(() => {
    const active = !!state.sharedBattlefieldToken?.active;
    if (active && !previousBaronRef.current) setBaronVisible(true);
    previousBaronRef.current = active;
  }, [state.sharedBattlefieldToken?.active]);

  // Rewind / forward sweeps.
  useEffect(() => {
    const log = state.log[state.log.length - 1] ?? null;
    if (!log || log.id === lastLogId.current) return;
    lastLogId.current = log.id;
    if (log.actionKind === "rewind" || log.actionKind === "forward") {
      setSweepTrigger((value) => value + 1);
    }
  }, [state.log]);

  useEffect(() => {
    if (state.rewindConfirmation) setSweepTrigger((value) => value + 1);
  }, [state.rewindConfirmation?.requestId]);

  const roll = useMemo(() => {
    void now;
    return latestRoll(state);
  }, [now, state]);

  useEffect(() => {
    if (roll && roll.id !== lastRollId.current) {
      lastRollId.current = roll.id;
    }
  }, [roll]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0"
      data-overlays-layer="true"
    >
      <CardFlightLayer state={state} viewerId={viewerId} />
      <FxDirector state={state} viewerId={viewerId} />
      <ParticleBurstLayer
        bursts={bursts}
        onDone={(id) => setBursts((current) => current.filter((burst) => burst.id !== id))}
      />
      <RewindOverlay state={state} viewerId={viewerId} dispatch={dispatch} />
      <TimeWarpSweep trigger={sweepTrigger} />
      <DiceResultOverlay roll={roll} />
      <BaronNashorOverlay visible={baronVisible} onDone={() => setBaronVisible(false)} />
      <GameOverOverlay
        room={state}
        viewerId={viewerId}
        controlledPlayerIds={props.controlledPlayerIds}
        resultDialogOpen={props.resultDialogOpen}
        onDismiss={props.onResultDialogDismiss}
        canReturnToLobby={state.roomMode === "multiplayer" && !!props.onReturnToLobby}
        onReturnToLobby={props.onReturnToLobby}
        onLeaveRoom={props.onLeaveRoom}
        dispatch={dispatch}
      />
      <EmoteFlightLayer room={state} viewerId={viewerId} presence={props.presence} />
      <PresenceEffects viewerId={viewerId} presence={props.presence} />
      <DisconnectBanner
        room={state}
        viewerId={viewerId}
        connectedPlayerIds={props.connectedPlayerIds}
        mode={props.mode}
        onClaimWin={props.onClaimWin}
      />
    </div>
  );
}
