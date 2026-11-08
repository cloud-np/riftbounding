"use client";

/**
 * Ping flash — verbatim port of module 766225 (`25vik2nxxo51i.js:7271-7759`).
 *
 * Six stacked layers (flash, glow, aura, ring, inner-ring, core) plus four
 * corner brackets. Animation timing / opacity / scale keyframes and the
 * `--gb-ping-*` custom properties match the original. The keyframes themselves
 * live in the compiled original stylesheet (`gbPingFlash`, `gbPingPulse`,
 * `gbPingInnerPulse`, `gbPingCornerPulse`).
 */
import type { CSSProperties } from "react";

export type PingVariant = "hand" | "battlefieldMarker" | "marker";

interface PingStyle {
  outerInset: string;
  innerInset: string;
  outerRadius: string;
  innerRadius: string;
  glowInset: string;
  glowRadius: string;
  cornerInset: string;
  cornerSize: string;
  glowShadow: string;
  ringShadow: string;
  innerRingShadow: string;
  cornerShadow: string;
}

export const PING_STYLES: Record<PingVariant, PingStyle> = {
  hand: {
    outerInset: "0.12rem",
    innerInset: "0.24rem",
    outerRadius: "var(--card-radius-tight)",
    innerRadius: "var(--card-radius-tight)",
    glowInset: "-0.24rem",
    glowRadius: "calc(var(--card-radius-tight) + 0.24rem)",
    cornerInset: "0.18rem",
    cornerSize: "0.56rem",
    glowShadow:
      "0 0 26px rgba(255,183,90,0.28),0 0 46px rgba(255,154,56,0.18),0 0 72px rgba(255,132,33,0.1)",
    ringShadow:
      "0 0 0 1px rgba(255,226,177,0.5),0 0 28px rgba(255,172,84,0.62),0 0 48px rgba(255,145,52,0.34),0 0 72px rgba(255,126,28,0.12),inset 0 0 18px rgba(255,207,124,0.36)",
    innerRingShadow: "0 0 16px rgba(255,206,126,0.28),inset 0 0 12px rgba(255,218,154,0.22)",
    cornerShadow: "0 0 10px rgba(255,198,112,0.26)",
  },
  battlefieldMarker: {
    outerInset: "0.04rem",
    innerInset: "0.16rem",
    outerRadius: "0.16rem",
    innerRadius: "0.12rem",
    glowInset: "-0.28rem",
    glowRadius: "0.34rem",
    cornerInset: "0.12rem",
    cornerSize: "0.78rem",
    glowShadow:
      "0 0 26px rgba(255,183,90,0.28),0 0 46px rgba(255,154,56,0.18),0 0 72px rgba(255,132,33,0.1)",
    ringShadow:
      "0 0 0 1px rgba(255,226,177,0.5),0 0 28px rgba(255,172,84,0.62),0 0 48px rgba(255,145,52,0.34),0 0 72px rgba(255,126,28,0.12),inset 0 0 18px rgba(255,207,124,0.36)",
    innerRingShadow: "0 0 16px rgba(255,206,126,0.28),inset 0 0 12px rgba(255,218,154,0.22)",
    cornerShadow: "0 0 10px rgba(255,198,112,0.26)",
  },
  marker: {
    outerInset: "0.18rem",
    innerInset: "0.32rem",
    outerRadius: "0.42rem",
    innerRadius: "0.38rem",
    glowInset: "-0.18rem",
    glowRadius: "0.6rem",
    cornerInset: "0.24rem",
    cornerSize: "0.68rem",
    glowShadow:
      "0 0 24px rgba(255,183,90,0.24),0 0 40px rgba(255,154,56,0.14),0 0 58px rgba(255,132,33,0.08)",
    ringShadow:
      "0 0 0 1px rgba(255,226,177,0.46),0 0 24px rgba(255,172,84,0.52),0 0 40px rgba(255,145,52,0.26),0 0 62px rgba(255,126,28,0.1),inset 0 0 16px rgba(255,207,124,0.3)",
    innerRingShadow: "0 0 14px rgba(255,206,126,0.22),inset 0 0 10px rgba(255,218,154,0.18)",
    cornerShadow: "0 0 8px rgba(255,198,112,0.22)",
  },
};

export function pingDuration(durationMs: number): number {
  return Math.min(1.5 * durationMs, 2400);
}

export function pingDelay(delayMs: number): number {
  return 1.5 * delayMs;
}

	type AnimationSpec = {
	  name: string;
	  durationMs: number;
	  delayMs?: number;
	  timingFunction: string;
	  opacity: readonly [number, number, number, number];
	  scale: readonly [number, number, number, number];
	};

const CORNER_BORDER = { borderColor: "rgba(255,226,186,0.95)" } as const;

export function pingAnimationStyle(style: CSSProperties, spec: AnimationSpec): CSSProperties {
  return {
    ...style,
    animationName: spec.name,
    animationDuration: `${pingDuration(spec.durationMs)}ms`,
    animationTimingFunction: spec.timingFunction,
    animationDelay: `${pingDelay(spec.delayMs ?? 0)}ms`,
    animationFillMode: "both",
    animationIterationCount: 1,
    transformOrigin: "center",
    willChange: "opacity, transform",
    "--gb-ping-opacity-0": String(spec.opacity[0]),
    "--gb-ping-opacity-1": String(spec.opacity[1]),
    "--gb-ping-opacity-2": String(spec.opacity[2]),
    "--gb-ping-opacity-3": String(spec.opacity[3]),
    "--gb-ping-scale-0": String(spec.scale[0]),
    "--gb-ping-scale-1": String(spec.scale[1]),
    "--gb-ping-scale-2": String(spec.scale[2]),
    "--gb-ping-scale-3": String(spec.scale[3]),
  } as CSSProperties;
}

export function PingOverlay({
  variant = "hand",
  eventId,
}: {
  variant?: PingVariant;
  eventId: number;
}) {
  const style = PING_STYLES[variant];
  return (
    <span
      className="pointer-events-none absolute inset-0 z-20"
      data-ping-overlay={variant}
      data-ping-event-id={String(eventId)}
      aria-hidden="true"
    >
      <span
        className="absolute inset-0"
        data-ping-overlay-inner="true"
      >
        <span
          className="absolute"
          data-ping-overlay-layer="flash"
          style={pingAnimationStyle(
            {
              inset: style.outerInset,
              borderRadius: style.outerRadius,
              background:
                "radial-gradient(circle_at_50%_42%,rgba(255,251,236,1)_0%,rgba(255,221,160,0.92)_26%,rgba(255,179,79,0.48)_54%,rgba(255,147,44,0.16)_72%,transparent_88%)",
              mixBlendMode: "screen",
            },
            {
              name: "gbPingFlash",
              durationMs: 440,
              timingFunction: "cubic-bezier(0.2, 0.9, 0.2, 1)",
              opacity: [0, 1, 0.42, 0],
              scale: [0.72, 0.98, 1.04, 1.08],
            },
          )}
        />
        <span
          className="absolute"
          data-ping-overlay-layer="glow"
          style={pingAnimationStyle(
            {
              inset: style.glowInset,
              borderRadius: style.glowRadius,
              background:
                "radial-gradient(circle_at_50%_50%,rgba(255,225,164,0.22)_0%,rgba(255,171,72,0.16)_38%,rgba(255,142,41,0.08)_58%,transparent_78%)",
              boxShadow: style.glowShadow,
            },
            {
              name: "gbPingPulse",
              durationMs: 1180,
              timingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              opacity: [0, 0.82, 0.34, 0],
              scale: [0.92, 1.02, 1.1, 1.16],
            },
          )}
        />
        <span
          className="absolute"
          data-ping-overlay-layer="aura"
          style={pingAnimationStyle(
            {
              inset: style.outerInset,
              borderRadius: style.outerRadius,
              background:
                "radial-gradient(circle_at_50%_50%,rgba(255,240,214,0.22)_0%,rgba(255,189,103,0.14)_42%,transparent_72%)",
              boxShadow:
                "0 0 26px rgba(255,181,88,0.42),0 0 42px rgba(255,159,64,0.28),0 0 60px rgba(255,137,38,0.12),inset 0 0 18px rgba(255,233,196,0.18)",
            },
            {
              name: "gbPingPulse",
              durationMs: 1050,
              timingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              opacity: [0, 0.95, 0.24, 0],
              scale: [0.9, 1.02, 1.12, 1.18],
            },
          )}
        />
        <span
          className="absolute border-2"
          data-ping-overlay-layer="ring"
          style={pingAnimationStyle(
            {
              inset: style.outerInset,
              borderRadius: style.outerRadius,
              borderColor: "rgba(255,238,212,0.98)",
              boxShadow: style.ringShadow,
            },
            {
              name: "gbPingPulse",
              durationMs: 1720,
              timingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              opacity: [0.2, 1, 0.46, 0],
              scale: [0.88, 0.99, 1.08, 1.18],
            },
          )}
        />
        <span
          className="absolute border-[1.5px]"
          data-ping-overlay-layer="inner-ring"
          style={pingAnimationStyle(
            {
              inset: style.innerInset,
              borderRadius: style.innerRadius,
              borderColor: "rgba(255,245,226,0.92)",
              boxShadow: style.innerRingShadow,
            },
            {
              name: "gbPingInnerPulse",
              durationMs: 1380,
              delayMs: 60,
              timingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              opacity: [0.12, 0.94, 0.36, 0],
              scale: [0.9, 0.98, 1.05, 1.12],
            },
          )}
        />
        <span
          className="absolute"
          data-ping-overlay-layer="core"
          style={pingAnimationStyle(
            {
              inset: style.outerInset,
              borderRadius: style.outerRadius,
              background:
                "radial-gradient(circle_at_50%_42%,rgba(255,235,196,0.42),rgba(255,174,78,0.14)_52%,transparent_82%)",
            },
            {
              name: "gbPingPulse",
              durationMs: 1440,
              delayMs: 40,
              timingFunction: "cubic-bezier(0.18, 1, 0.3, 1)",
              opacity: [0, 0.78, 0.26, 0],
              scale: [0.94, 1, 1.06, 1.1],
            },
          )}
        />
        {(
          [
            ["corner-top-left", { left: style.cornerInset, top: style.cornerInset }, "border-l-[2.5px] border-t-[2.5px]"],
            ["corner-top-right", { right: style.cornerInset, top: style.cornerInset }, "border-r-[2.5px] border-t-[2.5px]"],
            ["corner-bottom-left", { left: style.cornerInset, bottom: style.cornerInset }, "border-l-[2.5px] border-b-[2.5px]"],
            ["corner-bottom-right", { right: style.cornerInset, bottom: style.cornerInset }, "border-r-[2.5px] border-b-[2.5px]"],
          ] as const
        ).map(([layer, position, borderClass]) => (
          <span
            key={layer}
            className={`absolute ${borderClass}`}
            data-ping-overlay-layer={layer}
            style={pingAnimationStyle(
              {
                ...CORNER_BORDER,
                ...position,
                width: style.cornerSize,
                height: style.cornerSize,
                boxShadow: style.cornerShadow,
              },
              {
                name: "gbPingCornerPulse",
                durationMs: 1560,
                timingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                opacity: [0.18, 1, 0.44, 0],
                scale: [0.86, 0.98, 1.05, 1.12],
              },
            )}
          />
        ))}
      </span>
    </span>
  );
}
