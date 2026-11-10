"use client";

/**
 * FX director: diffs consecutive rooms, derives events and schedules their choreography.
 * Pointer-events are off on every layer; everything is cancelled on unmount / level change.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { Room } from "@rift/protocol";

import { useAnimationLevel } from "../theme/motion";
import { FxContext, type FxLevel } from "./context";
import { deriveFxEvents, fxEventKey } from "./derive-fx-events";
import { CardCache, syncBoardVars, type CardGeneration } from "./dom";
import * as fx from "./effects";
import { ParticleCanvas } from "./ParticleCanvas";
import type { ParticleEngine } from "./particles";
import type { FxEvent } from "./types";

const MAX_ACTIVE = 14;
const DEDUPE_MS = 1500;

/** Time the timeline cursor advances after starting an event (ms). */
function gapAfter(event: FxEvent): number {
  switch (event.type) {
    case "turn_start":
      return 250;
    case "card_played":
      return event.fromZone === "none" ? 120 : 520;
    case "unit_moved":
      return 280;
    case "spell_cast":
      return event.isViewer ? 450 : 700;
    case "spell_resolved":
      return 520;
    case "showdown_start":
      return 650;
    case "combat_clash":
      return 900;
    default:
      return 0;
  }
}

function priority(event: FxEvent): number {
  switch (event.type) {
    case "combat_clash":
    case "unit_died":
    case "card_played":
    case "showdown_start":
      return 2;
    case "card_drawn":
      return 0;
    default:
      return 1;
  }
}

export function FxDirector({ state, viewerId }: { state: Room; viewerId: string }) {
  const level = useAnimationLevel();
  const [layers, setLayers] = useState<{ stage: HTMLDivElement; top: HTMLDivElement } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ParticleEngine | null>(null);
  const ctxRef = useRef<FxContext | null>(null);
  const cacheRef = useRef(new CardCache());
  const prevRef = useRef<Room | null>(null);
  const prevViewerRef = useRef<string | null>(null);
  const seenRef = useRef(new Map<string, number>());

  // (Re)build the context whenever the layers mount or the level changes.
  useEffect(() => {
    if (!layers || level === "off") return;
    const ctx = new FxContext(layers.stage, layers.top, () => engineRef.current, level as FxLevel, viewerId);
    ctxRef.current = ctx;
    syncBoardVars(layers.stage);
    return () => {
      ctx.dispose();
      if (ctxRef.current === ctx) ctxRef.current = null;
    };
    // viewerId handled separately below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, level]);

  useEffect(() => {
    if (ctxRef.current) ctxRef.current.viewerId = viewerId;
  }, [viewerId]);

  useLayoutEffect(() => {
    if (!layers) {
      stageRef.current && topRef.current && setLayers({ stage: stageRef.current, top: topRef.current });
    }
  });

  useLayoutEffect(() => {
    const cache = cacheRef.current;
    const prev = prevRef.current;
    const viewerChanged = prevViewerRef.current !== null && prevViewerRef.current !== viewerId;
    prevRef.current = state;
    prevViewerRef.current = viewerId;
    const ctx = ctxRef.current;
    const lastLog = state.log?.[state.log.length - 1]?.actionKind;
    const jumped = lastLog === "rewind" || lastLog === "forward";
    if (
      ctx &&
      !ctx.disposed &&
      prev &&
      prev !== state &&
      prev.phase === "in_game" &&
      !viewerChanged &&
      !jumped &&
      !document.hidden
    ) {
      let events: FxEvent[] = [];
      try {
        events = deriveFxEvents(prev, state, viewerId);
      } catch {
        events = [];
      }
      if (events.length > 0) schedule(ctx, events, cache.map, seenRef.current);
    }
    cache.refresh();
  }, [state, viewerId]);

  useEffect(() => {
    const onResize = () => cacheRef.current.refresh();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (typeof document === "undefined" || level === "off") return null;
  return createPortal(
    <div className="fx-root" data-fx-root="true" aria-hidden="true">
      <div ref={stageRef} className="fx-stage" />
      <ParticleCanvas engineRef={engineRef} />
      <div ref={topRef} className="fx-top" />
    </div>,
    document.body,
  );
}

function schedule(ctx: FxContext, events: FxEvent[], gen: CardGeneration, seen: Map<string, number>) {
  const now = Date.now();
  for (const [key, at] of seen) if (now - at > DEDUPE_MS) seen.delete(key);
  let cursor = 0;
  for (const event of events) {
    const key = fxEventKey(event);
    if (seen.has(key)) continue;
    seen.set(key, now);
    if (ctx.active >= MAX_ACTIVE && priority(event) < 2) continue;
    const delay = cursor;
    cursor += gapAfter(event);
    const run = start(ctx, event, gen, delay);
    if (!run) continue;
    ctx.active += 1;
    void run
      .catch(() => undefined)
      .finally(() => {
        ctx.active -= 1;
      });
  }
}

function start(ctx: FxContext, event: FxEvent, gen: CardGeneration, delay: number): Promise<unknown> | null {
  switch (event.type) {
    case "card_played":
      return fx.playCard(ctx, event, gen, delay);
    case "unit_moved":
      return fx.moveUnit(ctx, event, gen, delay);
    case "spell_cast":
      return fx.castSpell(ctx, event, gen, delay);
    case "spell_resolved":
      return fx.resolveSpell(ctx, event, gen, delay);
    case "showdown_start":
      return fx.showdownStart(ctx, event, delay);
    case "combat_clash":
      return fx.combatClash(ctx, event, gen, delay);
    case "unit_died":
      return fx.unitDied(ctx, event, gen, delay);
    case "damage":
      return fx.nonCombatDamage(ctx, event, delay);
    case "might_buff":
      return fx.mightBuff(ctx, event, delay);
    case "conquer":
      return fx.conquer(ctx, event, delay);
    case "score":
      return fx.scoreOrb(ctx, event, delay);
    case "turn_start":
      return fx.turnStart(ctx, event, delay);
    case "card_drawn":
      return null;
  }
}
