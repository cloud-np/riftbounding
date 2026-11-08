"use client";

import { useId, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { strings, t } from "@/components/lobby/strings";

const LOCALES = [
  { value: "en", label: "EN", lang: "en" },
  { value: "zh-CN", label: "简体中文", lang: "zh-CN" },
  { value: "fr", label: "FR", lang: "fr" },
  { value: "ko", label: "한국어", lang: "ko" },
] as const;

export interface AppHeaderProps {
  title: string;
  description?: string;
  /** Small uppercase line above the page title (Play.Riftatlas by default). */
  eyebrow?: string;
  signedIn: boolean;
  guestName?: string | null;
  locale: string;
  inRoom?: boolean;
  /** /customize swaps the Game history + Customize actions for "Back to Lobby". */
  backToLobby?: boolean;
  onLocaleChange: (locale: string) => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onOpenSearch: () => void;
  onOpenHistory: () => void;
  onOpenMembership: () => void;
  onOpenAccount: () => void;
}

function tooltipClass(extra = "") {
  return `pointer-events-none absolute right-full top-1/2 z-20 mr-2 -translate-y-1/2 translate-x-2 whitespace-nowrap rounded-full border border-[rgba(193,164,103,0.34)] bg-[rgba(13,12,22,0.95)] px-3 py-1.5 text-sm font-medium text-[#eef3ff] opacity-0 shadow-sm backdrop-blur transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 ${extra}`;
}

export function AppHeader({
  title,
  description,
  eyebrow = "Play.Riftatlas",
  signedIn,
  guestName,
  locale,
  inRoom = false,
  backToLobby = false,
  onLocaleChange,
  onSignIn,
  onSignUp,
  onOpenSearch,
  onOpenHistory,
  onOpenMembership,
  onOpenAccount,
}: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  return (
    <div
      className="hub-persistent-controls-frame pointer-events-none fixed z-170 transition-[top] duration-200 motion-reduce:transition-none top-3"
      style={{ ["--hub-scrollbar-width" as string]: "0px" }}
    >
      <header
        data-testid="simulator-lobby-header"
        data-hub-persistent-header="true"
        data-compact="false"
        data-phone-menu-open={menuOpen ? "true" : "false"}
        className="pointer-events-none relative mx-auto grid w-full max-w-7xl bg-[#07101c] transition-[background-color,border-color,box-shadow,padding,min-height] duration-200 motion-reduce:transition-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 border-b border-[rgba(141,176,232,0.2)] pb-4 after:absolute after:bottom-0 after:left-0 after:h-px after:w-36 after:bg-[linear-gradient(90deg,rgba(109,223,255,0.85),rgba(109,223,255,0))] sm:grid-rows-[auto_auto] sm:items-end sm:gap-x-3 sm:gap-y-2"
      >
        <div className="hub-header-brand pointer-events-auto col-span-2 col-start-1 row-start-1 flex min-w-0 items-center sm:col-span-1 gap-3 sm:row-span-2 sm:self-end">
          <a
            aria-label="Lobby"
            className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(116,239,255,0.6)]"
            href="/"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              width={314}
              height={362}
              decoding="async"
              className="w-auto transition-[height] duration-200 motion-reduce:transition-none h-16 sm:h-20"
              src="/riftbound/static/brand/rift-atlas/rift-atlas-mark-hollow-gold.webp"
            />
          </a>
          <div className="hub-header-heading min-w-0 space-y-1">
            <div className="hub-header-kicker flex min-w-0 flex-wrap items-center gap-1.5 sm:flex-nowrap min-h-6">
              <p className="hub-header-eyebrow text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9fdff2]">
                {eyebrow}
              </p>
              <div className="hub-header-navigation flex items-center gap-1">
                <nav aria-label="Card tools" className="flex items-center gap-1">
                  <a
                    href="https://riftatlas.com/cards"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="sim-card-browser-link"
                    aria-label={t("sim.cardBrowser")}
                    title={t("sim.openCardBrowser")}
                    className="inline-flex h-6 items-center gap-1 whitespace-nowrap border border-[rgba(132,167,205,0.24)] bg-[rgba(10,19,32,0.62)] px-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[#cfe8f7] transition-colors hover:border-[rgba(108,199,231,0.42)] hover:bg-[rgba(18,34,52,0.82)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(116,239,255,0.6)]"
                  >
                    <span className="hub-card-browser-label hidden lg:inline">
                      {t("sim.cardBrowser")}
                    </span>
                    <span className="hub-card-browser-short-label lg:hidden">
                      {t("common.cardBrowserShort")}
                    </span>
                    <Icon name="external-link" className="h-2.5 w-2.5" />
                  </a>
                  <button
                    type="button"
                    data-testid="sim-global-card-search-trigger"
                    aria-haspopup="dialog"
                    aria-keyshortcuts="Meta+K Control+K"
                    aria-label={t("sim.cardSearch.open")}
                    title={t("sim.cardSearch.open")}
                    onClick={onOpenSearch}
                    className="inline-flex h-6 min-w-11 shrink-0 items-center justify-center border border-[rgba(116,199,226,0.26)] bg-[rgba(9,20,33,0.68)] px-1.5 font-mono text-[0.6rem] font-semibold tracking-[-0.01em] text-[#b9dce9] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-[border-color,background-color,color] hover:border-[rgba(132,226,249,0.46)] hover:bg-[rgba(18,38,56,0.84)] hover:text-[#effcff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(116,239,255,0.62)]"
                  >
                    <kbd>Ctrl K</kbd>
                  </button>
                </nav>
              </div>
            </div>
            <h1 className="truncate whitespace-nowrap font-semibold text-gb-text-main text-lg sm:text-xl md:text-2xl">
              {title}
            </h1>
            {description && !inRoom ? (
              <p className="hub-header-description hidden max-w-2xl truncate text-[0.86rem] text-[#b9c7da] lg:block">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          id={`${menuId}-toggle`}
          className="lobby-phone-menu-toggle hidden h-11 w-11 items-center justify-center border border-[rgba(132,150,184,0.24)] text-text-soft"
          aria-label={menuOpen ? t("sim.menu.close") : t("sim.menu.open")}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <Icon name={menuOpen ? "close" : "menu"} className="h-5 w-5" />
        </button>

        <div className="hub-phone-account-actions pointer-events-none flex items-center justify-end gap-2 *:pointer-events-auto col-span-2 col-start-1 row-start-3 min-[480px]:col-span-1 min-[480px]:col-start-2 min-[480px]:row-start-2 sm:row-start-1 sm:self-start">
          <div
            data-testid="simulator-account-actions"
            className="flex min-h-8 flex-wrap items-center justify-end gap-2"
            id={menuId}
          >
            <span
              data-language-select=""
              className="group relative inline-flex shrink-0 align-middle"
            >
              <span
                aria-hidden="true"
                className="invisible inline-flex h-8 items-center whitespace-nowrap pl-6 pr-5 text-xs font-medium"
              >
                {LOCALES.find((entry) => entry.value === locale)?.label ?? "EN"}
              </span>
              <select
                aria-label={t("common.language")}
                data-testid="hub-locale-select"
                value={locale}
                onChange={(event) => onLocaleChange(event.currentTarget.value)}
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-[2px] border-0 bg-transparent py-0 pl-6 pr-5 text-xs font-medium transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 text-slate-200 hover:bg-white/5 hover:text-white focus-visible:ring-cyan-300/60 focus-visible:ring-offset-slate-950 scheme-dark"
              >
                {LOCALES.map((entry) => (
                  <option key={entry.value} value={entry.value} lang={entry.lang}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <Icon
                name="languages"
                className="pointer-events-none absolute left-1.5 top-1/2 size-3.5 -translate-y-1/2 opacity-60 text-cyan-100"
              />
              <Icon
                name="chevron-down"
                className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 opacity-50 text-slate-200"
              />
            </span>

            <a
              target="_blank"
              rel="noreferrer"
              aria-label="Contact Rift Atlas"
              title="Contact Rift Atlas"
              className="group relative items-center justify-center transition-colors duration-200 sm:inline-flex border-transparent bg-transparent hover:border-[rgba(193,164,103,0.44)] hover:bg-[rgba(34,26,47,0.72)] hub-phone-contact inline-flex h-8 w-8 rounded-[1px] border-0"
              href="https://riftatlas.com/contact"
            >
              <span className={tooltipClass()}>{t("common.contact")}</span>
              <Icon name="mail" className="h-5 w-5 shrink-0 text-[#eef3ff]/75" />
            </a>
            <a
              target="_blank"
              rel="noreferrer"
              aria-label="Join the Rift Atlas Discord"
              title="Join the Rift Atlas Discord"
              className="group relative items-center justify-center border-transparent bg-transparent transition-colors duration-200 hover:border-[rgba(193,164,103,0.44)] hover:bg-[rgba(34,26,47,0.72)] sm:inline-flex hub-phone-discord inline-flex h-8 w-8 rounded-[1px] border-0"
              href="https://discord.gg/8vfhVuUXmT"
            >
              <span className={tooltipClass()}>{t("common.discord")}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                aria-hidden="true"
                width={18}
                height={18}
                className="h-5.5 w-5.5 object-contain"
                src="/riftbound/static/Discord-Symbol-White.png"
              />
            </a>
            <a
              href="https://x.com/playriftatlas"
              target="_blank"
              rel="noreferrer"
              aria-label="Follow us on X"
              title="Follow us on X"
              data-x-button="true"
              className="group relative items-center justify-center border-transparent bg-transparent text-[#eef3ff]/70 transition-colors duration-200 hover:border-[rgba(193,164,103,0.44)] hover:bg-[rgba(34,26,47,0.72)] hover:text-[#eef3ff] inline-flex hub-phone-x h-8 w-8 rounded-[1px] border-0"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute z-20 whitespace-nowrap rounded-full border border-[rgba(193,164,103,0.34)] bg-[rgba(13,12,22,0.95)] px-3 py-1.5 text-sm font-medium text-[#eef3ff] opacity-0 shadow-sm backdrop-blur transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 left-0 top-full mt-2"
              >
                {t("common.followOnX")}
              </span>
              <Icon name="x-social" />
            </a>

            <div className="flex min-h-8 items-center justify-end gap-2 [&>button]:-my-1">
              <div className="flex min-h-8 items-center justify-end">
                {signedIn ? (
                  <button
                    type="button"
                    data-testid="simulator-guest-account"
                    className="border border-[rgba(111,216,193,0.44)] bg-[rgba(22,68,46,0.5)] px-3 py-1.5 text-xs font-medium text-[#d8fff1] transition-colors hover:border-[rgba(182,229,255,0.52)] hover:bg-[rgba(29,86,58,0.66)]"
                    onClick={onOpenAccount}
                    title={t("account.guestSignedIn")}
                  >
                    {guestName || "Guest"}
                  </button>
                ) : (
                  <div
                    data-simulator-signed-out-actions="true"
                    className="flex items-center gap-2 visible"
                  >
                    <a
                      className="border border-[rgba(132,150,184,0.36)] bg-[rgba(10,16,26,0.65)] px-3 py-1.5 text-xs font-medium text-text-main transition-colors hover:border-[rgba(182,229,255,0.45)] hover:bg-[rgba(18,28,44,0.82)]"
                      href="/sign-in?redirect_url=%2F"
                      onClick={(event) => {
                        event.preventDefault();
                        onSignIn();
                      }}
                    >
                      {t("common.signIn")}
                    </a>
                    <a
                      className="border border-[rgba(111,216,193,0.5)] bg-[rgba(22,68,46,0.62)] px-3 py-1.5 text-xs font-medium text-[#d8fff1] transition-colors hover:border-[rgba(182,229,255,0.52)] hover:bg-[rgba(29,86,58,0.74)]"
                      href="/sign-up?redirect_url=%2F"
                      onClick={(event) => {
                        event.preventDefault();
                        onSignUp();
                      }}
                    >
                      {t("common.signUp")}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="hub-phone-utility-actions pointer-events-auto min-w-0 col-start-1 row-start-2 w-auto justify-self-start sm:col-start-2 sm:justify-self-end">
          <div
            className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto"
            data-hub-utility-actions="true"
          >
            {backToLobby ? (
              <a
                aria-label="Back to Lobby"
                data-hub-page-action="lobby"
                className="btn-standard group relative inline-flex h-9 items-center justify-center gap-2 px-3"
                href="/"
              >
                <Icon name="chevron-left" className="h-4 w-4" />
                <span>Back to Lobby</span>
              </a>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!signedIn}
                  title={signedIn ? undefined : t("gameHistory.signIn")}
                  aria-label={t("sim.gameHistory")}
                  aria-haspopup="dialog"
                  data-hub-history-action="true"
                  onClick={onOpenHistory}
                  className="hub-game-history-trigger btn-standard group relative inline-flex h-9 items-center justify-center gap-2 px-3 disabled:opacity-40"
                >
                  <span
                    aria-hidden="true"
                    className={tooltipClass(
                      "max-sm:left-0 max-sm:right-auto max-sm:top-full max-sm:mt-2 max-sm:translate-y-0 lg:hidden",
                    )}
                  >
                    {t("sim.gameHistory")}
                  </span>
                  <Icon name="history" className="size-4" />
                  <span className="hub-game-history-label hidden xl:inline">
                    {t("sim.gameHistory")}
                  </span>
                  <span className="hub-game-history-short-label hidden lg:inline xl:hidden">
                    {t("sim.gameHistoryShort")}
                  </span>
                </button>

                <a
                  aria-label={t("sim.customize")}
                  data-hub-page-action="customize"
                  className="btn-standard group relative inline-flex h-9 w-9 items-center justify-center gap-2 px-0 sm:h-auto sm:w-auto sm:px-3"
                  href="/customize"
                >
                  <span
                    aria-hidden="true"
                    className={tooltipClass(
                      "max-sm:left-0 max-sm:right-auto max-sm:top-full max-sm:mt-2 max-sm:translate-y-0 sm:hidden",
                    )}
                  >
                    {t("sim.customize")}
                  </span>
                  <Icon name="palette" className="h-4 w-4" />
                  <span
                    data-cosmetic-new-dot="true"
                    className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 size-2 rounded-full bg-red-500 ring-2 ring-[#09111e]"
                  >
                    <span className="sr-only">{t("sim.newCosmetics")}</span>
                  </span>
                  <span className="sr-only sm:not-sr-only">{t("sim.customize")}</span>
                </a>
              </>
            )}

            <div className="hub-icon-rail inline-flex items-center gap-1 overflow-visible h-10">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={t("sim.membershipButton")}
                data-connected="false"
                data-membership-dialog-trigger="true"
                data-riftatlas-membership-button="true"
                onClick={onOpenMembership}
                className="group relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[2px] border-0 bg-transparent px-1 opacity-90 transition-[filter,opacity] duration-200 hover:bg-white/5 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,231,183,0.62)] h-11 sm:px-1.5"
              >
                <span
                  aria-hidden="true"
                  className="riftatlas-mark h-7"
                  style={{
                    ["--riftatlas-mark-light" as string]:
                      "url(/riftbound/static/membership/rift-atlas-membership-layers.webp)",
                    ["--riftatlas-mark-dark" as string]:
                      "url(/riftbound/static/membership/rift-atlas-membership-layers-dark.webp)",
                  }}
                >
                  <span className="riftatlas-mark-crest" />
                  <span className="riftatlas-mark-glow" />
                  <span className="riftatlas-mark-star" />
                </span>
                <span className="hidden whitespace-nowrap text-[0.78rem] font-medium text-[#e8eef7] sm:inline">
                  {t("sim.membership")}
                </span>
              </button>
              <a
                target="_blank"
                rel="noreferrer"
                aria-label="Support Rift Atlas on Buy Me a Coffee"
                title={t("common.support")}
                data-coffee-button="true"
                className="group relative items-center justify-center bg-transparent transition-[filter] duration-200 hover:brightness-125 sm:inline-flex inline-flex rounded-[1px] border-0 h-10 w-10"
                href="https://buymeacoffee.com/riftatlas"
              >
                <span className="pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#0B083D]/15 bg-[#FFF8C4]/95 px-3 py-1.5 text-sm font-semibold text-[#07062D] opacity-0 shadow-[0_8px_24px_-18px_rgba(247,220,0,0.95)] backdrop-blur transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 right-full mr-2 translate-x-2">
                  {t("common.buyMeACoffee")}
                </span>
                <Icon
                  name="coffee"
                  className="h-7 w-7 text-[#f7dc00] drop-shadow-[0_0_4px_rgba(247,220,0,0.2)]"
                  fill="#f7dc00"
                  stroke="#8a6d00"
                  strokeWidth={1.6}
                />
              </a>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}

export { LOCALES, strings };
