import type { SVGProps } from "react";

/**
 * Minimal inline icon set (Lucide geometry, verbatim path data where the original
 * rendered DOM exposed it). Keeping icons local avoids pulling a new dependency.
 */
export type IconName =
  | "external-link"
  | "mail"
  | "languages"
  | "chevron-down"
  | "chevron-right"
  | "chevron-left"
  | "history"
  | "palette"
  | "menu"
  | "close"
  | "heart"
  | "arrow-up-right"
  | "lock"
  | "lock-keyhole"
  | "upload"
  | "plus"
  | "folder-open"
  | "save"
  | "sliders"
  | "info"
  | "trophy"
  | "ticket"
  | "users"
  | "search"
  | "copy"
  | "check"
  | "play"
  | "shuffle"
  | "log-out"
  | "user"
  | "eye"
  | "image"
  | "download"
  | "trash"
  | "message"
  | "sparkles"
  | "flag"
  | "clock"
  | "list"
  | "chart"
  | "x-social"
  | "discord"
  | "coffee";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  className?: string;
}

export function Icon({ name, className, strokeWidth = 2, ...rest }: IconProps) {
  const common = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
    ...rest,
  };

  switch (name) {
    case "external-link":
      return (
        <svg {...common} className={`lucide lucide-external-link ${className ?? ""}`}>
          <path d="M15 3h6v6" />
          <path d="M10 14 21 3" />
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common} className={`lucide lucide-mail ${className ?? ""}`}>
          <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
          <rect x="2" y="4" width="20" height="16" rx="2" />
        </svg>
      );
    case "languages":
      return (
        <svg {...common} className={`lucide lucide-languages ${className ?? ""}`}>
          <path d="m5 8 6 6" />
          <path d="m4 14 6-6 2-3" />
          <path d="M2 5h12" />
          <path d="M7 2h1" />
          <path d="m22 22-5-10-5 10" />
          <path d="M14 18h6" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...common} className={`lucide lucide-chevron-down ${className ?? ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...common} className={`lucide lucide-chevron-right ${className ?? ""}`}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case "chevron-left":
      return (
        <svg {...common} className={`lucide lucide-chevron-left ${className ?? ""}`}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
    case "history":
      return (
        <svg {...common} className={`lucide lucide-rotate-ccw-clock ${className ?? ""}`}>
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l4 2" />
        </svg>
      );
    case "palette":
      return (
        <svg {...common} className={`lucide lucide-palette ${className ?? ""}`}>
          <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
        </svg>
      );
    case "menu":
      return (
        <svg {...common} className={`lucide lucide-menu ${className ?? ""}`}>
          <path d="M4 5h16" />
          <path d="M4 12h16" />
          <path d="M4 19h16" />
        </svg>
      );
    case "close":
      return (
        <svg {...common} className={`lucide lucide-x ${className ?? ""}`}>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common} className={`lucide lucide-heart ${className ?? ""}`}>
          <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
        </svg>
      );
    case "arrow-up-right":
      return (
        <svg {...common} className={`lucide lucide-arrow-up-right ${className ?? ""}`}>
          <path d="M7 7h10v10" />
          <path d="M7 17 17 7" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common} className={`lucide lucide-lock ${className ?? ""}`}>
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case "lock-keyhole":
      return (
        <svg {...common} className={`lucide lucide-lock-keyhole ${className ?? ""}`}>
          <circle cx="12" cy="16" r="1" />
          <rect x="3" y="10" width="18" height="12" rx="2" />
          <path d="M7 10V7a5 5 0 0 1 10 0v3" />
        </svg>
      );
    case "upload":
      return (
        <svg {...common} className={`lucide lucide-upload ${className ?? ""}`}>
          <path d="M12 3v12" />
          <path d="m17 8-5-5-5 5" />
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common} className={`lucide lucide-plus ${className ?? ""}`}>
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
      );
    case "folder-open":
      return (
        <svg {...common} className={`lucide lucide-folder-open ${className ?? ""}`}>
          <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case "save":
      return (
        <svg {...common} className={`lucide lucide-save ${className ?? ""}`}>
          <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
          <path d="M7 3v4a1 1 0 0 0 1 1h7" />
        </svg>
      );
    case "sliders":
      return (
        <svg {...common} className={`lucide lucide-sliders-horizontal ${className ?? ""}`}>
          <path d="M10 5H3" />
          <path d="M12 19H3" />
          <path d="M14 3v4" />
          <path d="M16 17v4" />
          <path d="M21 12h-9" />
          <path d="M21 19h-5" />
          <path d="M21 5h-7" />
          <path d="M8 10v4" />
          <path d="M8 12H3" />
        </svg>
      );
    case "info":
      return (
        <svg {...common} className={`lucide lucide-info ${className ?? ""}`}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common} className={`lucide lucide-trophy ${className ?? ""}`}>
          <path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2" />
          <path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2" />
          <path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3" />
          <path d="M4 22h16" />
          <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" />
          <path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...common} className={`lucide lucide-ticket ${className ?? ""}`}>
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
          <path d="M13 5v2" />
          <path d="M13 17v2" />
          <path d="M13 11v2" />
        </svg>
      );
    case "users":
      return (
        <svg {...common} className={`lucide lucide-users ${className ?? ""}`}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <path d="M16 3.128a4 4 0 0 1 0 7.744" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <circle cx="9" cy="7" r="4" />
        </svg>
      );
    case "search":
      return (
        <svg {...common} className={`lucide lucide-search ${className ?? ""}`}>
          <path d="m21 21-4.34-4.34" />
          <circle cx="11" cy="11" r="8" />
        </svg>
      );
    case "copy":
      return (
        <svg {...common} className={`lucide lucide-copy ${className ?? ""}`}>
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      );
    case "check":
      return (
        <svg {...common} className={`lucide lucide-check ${className ?? ""}`}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "play":
      return (
        <svg {...common} className={`lucide lucide-play ${className ?? ""}`}>
          <path d="M6 3 20 12 6 21z" />
        </svg>
      );
    case "shuffle":
      return (
        <svg {...common} className={`lucide lucide-shuffle ${className ?? ""}`}>
          <path d="m18 14 4 4-4 4" />
          <path d="m18 2 4 4-4 4" />
          <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" />
          <path d="M2 6h1.972a4 4 0 0 1 3.6 2.2" />
          <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />
        </svg>
      );
    case "log-out":
      return (
        <svg {...common} className={`lucide lucide-log-out ${className ?? ""}`}>
          <path d="m16 17 5-5-5-5" />
          <path d="M21 12H9" />
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        </svg>
      );
    case "user":
      return (
        <svg {...common} className={`lucide lucide-user ${className ?? ""}`}>
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "eye":
      return (
        <svg {...common} className={`lucide lucide-eye ${className ?? ""}`}>
          <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "image":
      return (
        <svg {...common} className={`lucide lucide-image ${className ?? ""}`}>
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      );
    case "download":
      return (
        <svg {...common} className={`lucide lucide-download ${className ?? ""}`}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="m7 10 5 5 5-5" />
          <path d="M12 15V3" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common} className={`lucide lucide-trash-2 ${className ?? ""}`}>
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      );
    case "message":
      return (
        <svg {...common} className={`lucide lucide-message-circle ${className ?? ""}`}>
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...common} className={`lucide lucide-sparkles ${className ?? ""}`}>
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        </svg>
      );
    case "flag":
      return (
        <svg {...common} className={`lucide lucide-flag ${className ?? ""}`}>
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" x2="4" y1="22" y2="15" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common} className={`lucide lucide-clock ${className ?? ""}`}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "list":
      return (
        <svg {...common} className={`lucide lucide-list ${className ?? ""}`}>
          <path d="M3 5h.01" />
          <path d="M3 12h.01" />
          <path d="M3 19h.01" />
          <path d="M8 5h13" />
          <path d="M8 12h13" />
          <path d="M8 19h13" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common} className={`lucide lucide-chart-column ${className ?? ""}`}>
          <path d="M3 3v16a2 2 0 0 0 2 2h16" />
          <path d="M18 17V9" />
          <path d="M13 17V5" />
          <path d="M8 17v-3" />
        </svg>
      );
    case "x-social":
      return (
        <svg
          {...common}
          fill="currentColor"
          stroke="none"
          viewBox="0 0 24 24"
          className={`h-[18px] w-[18px] shrink-0 ${className ?? ""}`}
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "coffee":
      return (
        <svg {...common} className={`lucide lucide-coffee ${className ?? ""}`}>
          <path d="M10 2v2" />
          <path d="M14 2v2" />
          <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
          <path d="M6 2v2" />
        </svg>
      );
    case "discord":
      return (
        <svg
          {...common}
          fill="currentColor"
          stroke="none"
          viewBox="0 0 24 24"
          className={`h-5 w-5 shrink-0 ${className ?? ""}`}
        >
          <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.036A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      );
    default:
      return null;
  }
}
