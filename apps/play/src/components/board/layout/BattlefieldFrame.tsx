"use client";

/** Procedural ornate frame pieces for a battlefield panel (corner brackets + rune notches). */

function Corner({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 40"
      className={`bf-corner ${className}`}
      focusable="false"
    >
      <path d="M2 38 V10 Q2 2 10 2 H38" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M7 38 V13 Q7 7 13 7 H38" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.55" />
      <path d="M2 2 L12 2 L2 12 Z" fill="currentColor" opacity="0.5" />
      <circle cx="13" cy="13" r="2.1" fill="currentColor" />
      <path d="M20 2 L23 5 L20 8 L17 5 Z" fill="currentColor" opacity="0.85" />
      <path d="M2 20 L5 23 L8 20 L5 17 Z" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export function BattlefieldCorners() {
  return (
    <>
      <span aria-hidden="true" className="bf-frame-edge" />
      <Corner className="bf-corner-tl" />
      <Corner className="bf-corner-tr" />
      <Corner className="bf-corner-bl" />
      <Corner className="bf-corner-br" />
    </>
  );
}
