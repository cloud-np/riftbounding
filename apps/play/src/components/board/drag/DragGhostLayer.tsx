"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { GameCardFace } from "../card/GameCardFace";
import type { DragSession } from "./drag-types";
import {
  createGhostMotionState,
  resetGhostMotion,
  sampleGhostPointer,
  stepGhostFrame,
} from "./ghost-physics";

export interface DragGhostLayerProps {
  session: DragSession | null;
  /** Deck drop position indicator active → the original uses z-2147483500. */
  deckPositionActive?: boolean;
}

/**
 * `ux` — fixed-position custom drag ghost (`0xawjzm3yjpr1.js:34969-35262`).
 * Starts parked at -9999px, follows document drag/pointer samples with the
 * exact spring in `ghost-physics.ts`.
 */
export function DragGhostLayer({ session, deckPositionActive = false }: DragGhostLayerProps) {
  const motionRef = useRef(createGhostMotionState());
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!session) return;
    const motion = motionRef.current;
    resetGhostMotion(motion);
    motion.active = true;
    motion.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    motion.targetX = session.startX;
    motion.targetY = session.startY;
    motion.lastPointerX = session.startX;
    motion.lastPointerY = session.startY;
    motion.lastPointerTs = 0;
    motion.lastFrameTs = 0;
    sampleGhostPointer(motion, { x: session.startX, y: session.startY, timestamp: session.startTimestamp });

    const element = elementRef.current;
    if (element) {
      const frame = stepGhostFrame(motion, performance.now());
      element.style.transform = frame.transform;
    }

    const onPointer = (event: DragEvent | PointerEvent) => {
      if (!motion.active) return;
      sampleGhostPointer(motion, { x: event.clientX, y: event.clientY, timestamp: event.timeStamp });
      if (motion.reduceMotion && elementRef.current) {
        const frame = stepGhostFrame(motion, performance.now());
        elementRef.current.style.transform = frame.transform;
      }
    };
    const rafRef = { current: 0 };
    const onFrame = (now: number) => {
      const current = motionRef.current;
      if (!current.active) return;
      const frame = stepGhostFrame(current, now);
      if (elementRef.current) {
        elementRef.current.style.transform = frame.transform;
        elementRef.current
          .querySelectorAll<HTMLElement>("[data-card-counter-frame], .card-banish-frame")
          .forEach((node) => node.style.setProperty("--card-counter-drag-roll", frame.rollDeg));
      }
      rafRef.current = window.requestAnimationFrame(onFrame);
    };
    rafRef.current = window.requestAnimationFrame(onFrame);

    document.addEventListener("dragover", onPointer, true);
    document.addEventListener("pointermove", onPointer, true);
    window.addEventListener("drag", onPointer as EventListener, true);

    return () => {
      window.cancelAnimationFrame(rafRef.current);
      document.removeEventListener("dragover", onPointer, true);
      document.removeEventListener("pointermove", onPointer, true);
      window.removeEventListener("drag", onPointer as EventListener, true);
      const current = motionRef.current;
      current.active = false;
      resetGhostMotion(current);
    };
  }, [session]);

  if (!session || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={elementRef}
      data-card-drag-ghost="true"
      className={
        "pointer-events-none fixed left-0 top-0 will-change-transform " +
        (deckPositionActive ? "z-[2147483500]" : "z-[2147483550]")
      }
      style={{ transform: "translate3d(-9999px,-9999px,0)" }}
    >
      <div
        className="relative w-(--card-width) min-w-(--card-width) h-(--card-height) rounded-(--card-radius-main) border-none bg-transparent shadow-none"
        style={
          {
            ["--card-width" as string]: `${session.cardWidthPx}px`,
            ["--card-height" as string]: `${session.cardHeightPx}px`,
            ["--card-radius-main" as string]: "0.22rem",
            width: `${session.cardWidthPx}px`,
            height: `${session.cardHeightPx}px`,
          } as React.CSSProperties
        }
      >
        <div className="absolute inset-0 origin-center overflow-hidden rounded-[0.22rem] border border-[rgba(165,184,207,0.22)] bg-[linear-gradient(165deg,rgba(49,73,99,0.96),rgba(34,53,74,0.94))] shadow-[inset_0_0_0_1px_rgba(188,206,228,0.06),0_10px_20px_rgba(4,10,24,0.42)]">
          {session.card ? (
            <GameCardFace
              card={session.card}
              profile="board"
              labels={session.card.customLabels}
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-[0.6rem] font-bold uppercase tracking-[0.08em] text-[#d5e3ff]">
              {session.kind === "battlefieldMarker" ? "Battlefield" : "Card"}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
