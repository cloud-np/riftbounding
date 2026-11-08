"use client";

import type { ReactNode } from "react";

export interface CardFlipProps {
  faceDown: boolean;
  front: ReactNode;
  back: ReactNode;
  duration?: number;
  initialRotationDeg?: number;
}

/**
 * 3D card-face flip shell (module 612518). `faceDown` rotates the shell 180°
 * while both faces stay mounted, matching the original backface-hidden markup.
 */
export function CardFlip({ faceDown, front, back, duration = 0.32, initialRotationDeg }: CardFlipProps) {
  const rotation = faceDown ? 180 : 0;
  return (
    <div className="absolute inset-0 perspective-[980px]">
      <div
        data-card-face-rotation={rotation}
        data-card-face-initial={initialRotationDeg}
        className="gb-card-face relative w-full h-full motion-reduce:transition-none!"
        style={{
          transform: rotation === 0 ? "none" : `rotateY(${rotation}deg)`,
          transformStyle: "preserve-3d",
          transitionProperty: "transform",
          transitionDuration: `${duration}s`,
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
          ["--card-face-initial-rotation" as string]: `${initialRotationDeg ?? rotation}deg`,
        }}
      >
        <div
          data-card-face="front"
          className="absolute inset-0 motion-reduce:transition-none! backface-hidden [-webkit-backface-visibility:hidden]"
          style={{
            transitionProperty: "visibility",
            transitionDuration: "0s",
            visibility: faceDown ? "hidden" : "visible",
          }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-(--card-radius-main)">{front}</div>
        </div>
        <div
          data-card-face="back"
          className="absolute inset-0 motion-reduce:transition-none! backface-hidden [-webkit-backface-visibility:hidden] transform-[rotateY(180deg)]"
          style={{
            transitionProperty: "visibility",
            transitionDuration: "0s",
            visibility: faceDown ? "visible" : "hidden",
          }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-(--card-radius-main)">{back}</div>
        </div>
      </div>
    </div>
  );
}
