"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";

import { getCardById } from "@rift/cards";

import { soundAsset } from "@/lib/assets";

import { Materialize } from "../effects/Materialize";

let audio: HTMLAudioElement | null = null;

export function playBaronSound(): void {
  if (typeof window === "undefined") return;
  try {
    audio ??= new Audio(soundAsset("baron_nashor.webm"));
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  } catch {
    // best effort
  }
}

export function BaronNashorOverlay({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  useEffect(() => {
    if (!visible) return;
    playBaronSound();
    const timer = window.setTimeout(onDone, 3400);
    return () => window.clearTimeout(timer);
  }, [onDone, visible]);

  if (!visible) return null;
  const card = getCardById("UNL-147") ?? getCardById("UNL-147A");
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-[170] grid place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 0.84, 0.24, 1] }}
      data-baron-nashor="true"
      data-testid="baron-nashor-overlay"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(65,32,108,0.38),rgba(8,4,18,0.5)_52%,rgba(2,4,10,0.12))]" />
      <div className="relative flex flex-col items-center gap-4">
        <Materialize>
          <div className="relative h-[min(19rem,36vh)] w-[min(13.6rem,25.6vh)] overflow-hidden rounded-[0.5rem] border border-[rgba(224,194,135,0.55)] bg-[#0a101e] shadow-[0_0_60px_rgba(139,84,255,0.55),0_24px_50px_rgba(0,0,0,0.6)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- catalog card art */}
            <img
              src={card?.imageUrl ?? "/cards/UNL-147.webp"}
              alt="Baron Nashor"
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(5,8,16,0),rgba(5,8,16,0.9))] px-3 pb-2 pt-8 text-center text-[0.72rem] font-black uppercase tracking-[0.22em] text-[#efe0ff]">
              Baron Nashor
            </span>
          </div>
        </Materialize>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="rounded-none border border-[rgba(199,176,131,0.55)] bg-[linear-gradient(145deg,rgba(35,20,60,0.94),rgba(10,7,22,0.96))] px-[1.2rem] py-[0.45rem] text-center text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-[#e9d9ff] shadow-[0_14px_32px_rgba(3,2,10,0.6)]"
        >
          Baron Pit Awakens
        </motion.div>
      </div>
    </motion.div>
  );
}
