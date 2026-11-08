"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion } from "framer-motion";

/**
 * Battlefield materialise keyframes (chunk `0xawjzm3yjpr1.js` ~60, `S`/`N`):
 * 1.5 s with five keyframe stops and a crossing cubic-bezier. Used for cards that
 * appear on the board (and by the flight/effect layers).
 */
export function Materialize({
  children,
  alreadyOnBoard = false,
  className,
  style,
  animate = true,
}: {
  children: ReactNode;
  alreadyOnBoard?: boolean;
  className?: string;
  style?: CSSProperties;
  animate?: boolean;
}) {
  const initial = alreadyOnBoard
    ? { opacity: 0.8, scale: 1, y: 0, filter: "brightness(0.9) saturate(0.7)" }
    : { opacity: 0, scale: 0.84, y: 14, filter: "brightness(0.2) saturate(0.5)" };
  const animation = alreadyOnBoard
    ? {
        opacity: [0.8, 0.75, 0.9, 1, 1],
        scale: [1, 0.93, 0.92, 1.05, 1],
        y: [0, 8, 8, -3, 0],
        filter: [
          "brightness(0.9) saturate(0.7)",
          "brightness(0.9) saturate(0.7)",
          "brightness(0.42) saturate(0.7)",
          "brightness(1.6) saturate(1.2)",
          "brightness(1) saturate(1)",
        ],
      }
    : {
        opacity: [0, 0.2, 0.9, 1, 1],
        scale: [0.84, 0.86, 0.92, 1.05, 1],
        y: [14, 13, 8, -3, 0],
        filter: [
          "brightness(0.2) saturate(0.5)",
          "brightness(0.2) saturate(0.5)",
          "brightness(0.42) saturate(0.7)",
          "brightness(1.6) saturate(1.2)",
          "brightness(1) saturate(1)",
        ],
      };
  return (
    <motion.div
      className={className}
      style={style}
      initial={animate ? initial : false}
      animate={animate ? animation : undefined}
      transition={{
        duration: 1.5,
        times: [0, 0.2, 0.4733, 0.5933, 1],
        ease: [0.16, 0.84, 0.24, 1],
      }}
      data-materialise={alreadyOnBoard ? "already-on-board" : "entering"}
    >
      {children}
    </motion.div>
  );
}
