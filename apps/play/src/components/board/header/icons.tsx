import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Glyph({ size = 16, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </Glyph>
  );
}

export function RewindIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </Glyph>
  );
}

export function ForwardIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </Glyph>
  );
}

export function FullscreenIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </Glyph>
  );
}

export function ExitFullscreenIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 8h3a1 1 0 0 0 1-1V4" />
      <path d="M20 8h-3a1 1 0 0 1-1-1V4" />
      <path d="M4 16h3a1 1 0 0 1 1 1v3" />
      <path d="M20 16h-3a1 1 0 0 0-1 1v3" />
    </Glyph>
  );
}

export function NextIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="m5 4 10 8-10 8V4Z" />
      <path d="M19 4v16" />
    </Glyph>
  );
}

export function LeaveIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </Glyph>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Glyph>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="m20 6-11 11-5-5" />
    </Glyph>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="m18 6-12 12M6 6l12 12" />
    </Glyph>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="m6 9 6 6 6-6" />
    </Glyph>
  );
}

export function PanelLeftCloseIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="m16 9-3 3 3 3" />
    </Glyph>
  );
}

export function PanelLeftOpenIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="m13 9 3 3-3 3" />
    </Glyph>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </Glyph>
  );
}

export function SpacebarIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 8v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8" />
      <path d="M4 8h2M18 8h2" />
    </Glyph>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </Glyph>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </Glyph>
  );
}

export function EmoteIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01M15 9h.01" />
    </Glyph>
  );
}

export function DiceIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 8h.01M16 8h.01M8 16h.01M16 16h.01M12 12h.01" />
    </Glyph>
  );
}

export function ActionsIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </Glyph>
  );
}

export function TogglesIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="2" y="7" width="20" height="10" rx="5" />
      <circle cx="8" cy="12" r="2.4" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

export function TogglesActiveIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="2" y="7" width="20" height="10" rx="5" />
      <circle cx="16" cy="12" r="2.4" fill="currentColor" stroke="none" />
      <path d="M6.5 9.5h2M6.5 12h2M6.5 14.5h2" />
    </Glyph>
  );
}

export function CounterIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </Glyph>
  );
}

export function BuffIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3v18M3 12h18" />
      <path d="m6 6 3 3M18 6l-3 3M6 18l3-3M18 18l-3-3" />
    </Glyph>
  );
}

export function DuplicateIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </Glyph>
  );
}

export function LabelIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

export function GiveControlIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 12h13" />
      <path d="m13 7 5 5-5 5" />
      <circle cx="4" cy="12" r="2" />
    </Glyph>
  );
}

export function SwapSeatIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 7h12l-3-3" />
      <path d="M20 17H8l3 3" />
    </Glyph>
  );
}

export function TurnActionIcon(props: IconProps) {
  return (
    <Glyph {...props} strokeWidth={2.4}>
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </Glyph>
  );
}

export function InspectIcon(props: IconProps) {
  return (
    <Glyph {...props} strokeWidth={2.2}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </Glyph>
  );
}

export function DrawIcon(props: IconProps) {
  return (
    <Glyph {...props} strokeWidth={2.2}>
      <rect x="7" y="3" width="10" height="14" rx="1.5" />
      <path d="M5 7v12a2 2 0 0 0 2 2h8" />
    </Glyph>
  );
}

export function DeckIcon(props: IconProps) {
  return (
    <Glyph {...props} strokeWidth={2.2}>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M7 3h11a2 2 0 0 1 2 2v11" />
    </Glyph>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Glyph {...props} strokeWidth={2.2}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="m6 6 1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
    </Glyph>
  );
}

export function ResourceIcon(props: IconProps) {
  return (
    <Glyph {...props} strokeWidth={2.2}>
      <path d="M12 2s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
    </Glyph>
  );
}

export function BoardIcon(props: IconProps) {
  return (
    <Glyph {...props} strokeWidth={2.2}>
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <rect x="14" y="14" width="7" height="7" rx="1.2" />
    </Glyph>
  );
}

export function SpellIcon(props: IconProps) {
  return (
    <Glyph {...props} strokeWidth={2.2}>
      <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" />
      <path d="M18 16v4M16 18h4" />
    </Glyph>
  );
}

export function BattleIcon(props: IconProps) {
  return (
    <Glyph {...props} strokeWidth={2.2}>
      <path d="m4 4 7 7M14 14l6 6M4 20 20 4" />
      <path d="m15 4 5 5M4 15l5 5" />
    </Glyph>
  );
}

export function ScoreIcon(props: IconProps) {
  return (
    <Glyph {...props} strokeWidth={2.2}>
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9Z" />
    </Glyph>
  );
}

export function LegendXpIcon(props: IconProps) {
  return (
    <Glyph {...props} strokeWidth={2.2}>
      <circle cx="12" cy="9" r="5" />
      <path d="m8 14-2 7 6-3 6 3-2-7" />
    </Glyph>
  );
}

export function DotIcon(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={10}
      height={10}
      viewBox="0 0 10 10"
      aria-hidden="true"
      {...props}
    >
      <circle cx="5" cy="5" r="2" fill="currentColor" />
    </svg>
  );
}
