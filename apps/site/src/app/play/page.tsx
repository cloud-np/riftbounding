import type { Metadata } from "next";

import {
  ArrowRightIcon,
  CrosshairIcon,
  EyeIcon,
  FlaskConicalIcon,
  KeyRoundIcon,
  Layers3Icon,
  LanguagesIcon,
  MessageCircleIcon,
  PackageOpenIcon,
  PaletteIcon,
  SmartphoneIcon,
} from "../components/icons";
import { MotionPreview } from "../components/motion-preview";
import "./launcher.css";

const PLAY_URL = (process.env.NEXT_PUBLIC_PLAY_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const SITE_URL = "https://riftatlas.com";
const SOCIAL_CARD =
  "https://assets.riftatlas-workers.com/riftbound/static/brand/rift-atlas/rift-atlas-social-card.webp?v=20260713";

export const metadata: Metadata = {
  title: "Play Riftbound Online - Multiplayer, Solo & Sealed | Rift Atlas",
  description:
    "Play Riftbound online at play.riftatlas.com: find a quick match, host a private room, play solo, play constructed or sealed, and spectate games.",
  keywords: [
    "Riftbound",
    "Riftbound cards",
    "Riftbound card database",
    "Riftbound card search",
    "play Riftbound online",
    "Riftbound simulator",
    "Riftbound deck builder",
    "Riftbound sealed simulator",
    "TCG",
    "trading card game",
    "League of Legends",
    "card database",
    "card search",
    "deck builder",
    "sealed simulator",
    "play simulator",
    "Rift Atlas",
  ],
  authors: [{ name: "Rift Atlas" }],
  creator: "Rift Atlas",
  publisher: "Rift Atlas",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://riftatlas.com/play",
    languages: {
      en: "https://riftatlas.com/play",
      "zh-CN": "https://riftatlas.com/zh-CN/play",
      fr: "https://riftatlas.com/fr/play",
      ko: "https://riftatlas.com/ko/play",
      "x-default": "https://riftatlas.com/play",
    },
  },
  openGraph: {
    title: "Play Riftbound Online - Rift Atlas",
    description:
      "Launch the unofficial Rift Atlas simulator for quick matchmaking, private rooms, solo practice, constructed and sealed play, and spectating at play.riftatlas.com.",
    url: "https://riftatlas.com/play",
    images: [{ url: SOCIAL_CARD }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Play Riftbound Online - Rift Atlas",
    description:
      "Launch the unofficial Rift Atlas simulator for quick matchmaking, private rooms, solo practice, constructed and sealed play, and spectating at play.riftatlas.com.",
    images: [SOCIAL_CARD],
  },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" }],
    apple: [{ url: "/apple-touch-icon.png?v=20260713" }],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Play Riftbound Online",
  url: "https://riftatlas.com/play",
  description:
    "Launch page for the unofficial Rift Atlas online simulator with matchmaking, private rooms, solo practice, sealed play, and spectating.",
  mainEntity: {
    "@type": "WebApplication",
    name: "Rift Atlas Simulator",
    alternateName: "Play Riftbound Online",
    url: "https://play.riftatlas.com/",
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    isAccessibleForFree: true,
    browserRequirements: "Requires JavaScript for interactive play.",
    featureList: [
      "Quick matchmaking",
      "Private room-code multiplayer",
      "Solo deck testing",
      "Constructed and sealed play",
      "Spectating",
      "Saved-deck and decklist import",
      "Rewind, auto-pay, and showdown assistance",
    ],
    description:
      "Unofficial fan-made Riftbound online simulator for quick matchmaking, private rooms, solo practice, constructed and sealed play, spectating, and play quality-of-life tools.",
  },
};

const DOMAIN_ICONS = ["body", "calm", "chaos", "fury", "mind", "order"] as const;

const MODES = [
  {
    key: "quickMatch",
    icon: CrosshairIcon,
    title: "Quick Match",
    body: "Constructed or Sealed, Best of 1 or Best of 3, against the next player in the queue.",
  },
  {
    key: "privateRoom",
    icon: KeyRoundIcon,
    title: "Private Room",
    body: "Duel, free-for-all or 2v2 with up to four players. Invite friends or share the room code.",
  },
  {
    key: "soloRoom",
    icon: FlaskConicalIcon,
    title: "Solo Room",
    body: "Test a deck on your own, or play both sides of a game.",
  },
  {
    key: "spectate",
    icon: EyeIcon,
    title: "Spectate",
    body: "Enter a room code to watch a match in progress.",
  },
];

const FEATURES = [
  {
    key: "rewind",
    title: "Rewind",
    body: "Take back your last action instead of rebuilding the board by hand.",
    posterSrc: "/play/rewind-60fps-20260909.webp",
    motionSrc: "/play/rewind-60fps-20260909.mp4",
    alt: "Rift Atlas simulator showing a recycled card action being rewound.",
    width: 1440,
    height: 1000,
  },
  {
    key: "auto-pay",
    title: "Auto-pay",
    body: "Auto-pay exhausts and recycles the runes a card needs, and the match log records every payment.",
    posterSrc: "/play/auto-pay-60fps-20260909.webp",
    motionSrc: "/play/auto-pay-60fps-20260909.mp4",
    alt: "Rift Atlas simulator showing automatic payment for a card cost.",
    width: 1440,
    height: 700,
  },
  {
    key: "conquer",
    title: "Conquer prompts",
    body: "When a unit takes a battlefield, a prompt beside it offers the right reward, such as Conquer + Score. In showdowns it also shows who has focus and lets you pass it.",
    posterSrc: "/play/conquer-60fps-20261008.webp",
    motionSrc: "/play/conquer-60fps-20261008.mp4",
    alt: "Rift Atlas simulator showing a unit moving to a battlefield and the conquer and score prompt.",
    width: 840,
    height: 660,
  },
];

const TABLE_FEATURES = [
  {
    key: "bringDeckTitle",
    icon: Layers3Icon,
    title: "Deck import",
    body: "Paste a list or deck code, or open any Rift Atlas deck straight in the simulator.",
  },
  {
    key: "sealedTitle",
    icon: PackageOpenIcon,
    title: "Sealed",
    body: "Open packs, build from your pool, and take it into Quick Match or a room.",
  },
  {
    key: "friendsTitle",
    icon: MessageCircleIcon,
    title: "Friends & messages",
    body: "Add friends by code, chat, and invite them straight into your room.",
  },
  {
    key: "customizeTitle",
    icon: PaletteIcon,
    title: "Customize",
    body: "Playmats, sleeves, board lines and emotes.",
  },
  {
    key: "mobileTitle",
    icon: SmartphoneIcon,
    title: "Phones and tablets",
    body: "A touch layout made for small screens, with nothing to install.",
  },
  {
    key: "languagesTitle",
    icon: LanguagesIcon,
    title: "English, 简体中文, Français, 한국어",
    body: "Switch languages any time. Card text and artwork follow your language where available, with English used when a translation is missing.",
  },
];

export default function PlayLauncherPage() {
  return (
    <div
      id="main-content"
      tabIndex={-1}
      data-riftbound-locale-focus-fallback="true"
      className="min-h-0 flex-1 outline-none"
    >
      <main className="IcFxxa_page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <section aria-labelledby="play-page-title" className="IcFxxa_container IcFxxa_hero">
          <div className="IcFxxa_heroTop">
            <div>
              <p className="IcFxxa_eyebrow">Rift Atlas / Simulator</p>
              <h1 id="play-page-title" className="font-brand IcFxxa_title">
                Play Riftbound
                <br />
                <span>online.</span>
              </h1>
            </div>
            <div className="IcFxxa_heroIntro">
              <p className="IcFxxa_intro">
                Find an opponent in Quick Match, host a room for friends, or test a deck on your
                own, right in your browser.
              </p>
              <div className="IcFxxa_actions">
                <a
                  href={`${PLAY_URL}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="IcFxxa_primaryButton"
                  data-testid="play-launch-simulator"
                >
                  Open simulator
                  <ArrowRightIcon size={16} />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                <a className="IcFxxa_textLink" href={`${SITE_URL}/decks`}>
                  Choose a deck
                  <ArrowRightIcon size={16} />
                </a>
              </div>
              <p className="IcFxxa_finePrint">Free to play · No download required</p>
            </div>
          </div>
          <figure className="IcFxxa_board">
            <div className="IcFxxa_boardBar">
              <span data-testid="play-domain-icons" className="IcFxxa_domains" aria-hidden="true">
                {DOMAIN_ICONS.map((domain) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={domain}
                    alt=""
                    loading="lazy"
                    width={18}
                    height={18}
                    decoding="async"
                    style={{ color: "transparent" }}
                    src={`/riftbound/static/icons/${domain}.webp`}
                  />
                ))}
              </span>
              <a
                href={`${PLAY_URL}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="IcFxxa_hostLink"
                data-testid="play-board-simulator-link"
              >
                play.riftatlas.com
                <ArrowRightIcon size={16} />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Rift Atlas simulator with Rebuke on the chain targeting the opposing Kai'Sa, Survivor at a battlefield."
              width={1800}
              height={1000}
              decoding="async"
              className="IcFxxa_boardImage"
              style={{ color: "transparent" }}
              src="/play/board-chain-20260908.webp"
            />
          </figure>
        </section>

        <section
          aria-labelledby="ways-to-play-title"
          className="IcFxxa_container IcFxxa_modesSection"
        >
          <h2 id="ways-to-play-title" className="IcFxxa_sectionTitle">
            Ways to play
          </h2>
          <ul data-testid="play-mode-grid" className="IcFxxa_modes">
            {MODES.map(({ key, icon: Icon, title, body }) => (
              <li key={key} className="IcFxxa_mode">
                <Icon size={22} />
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="play-tools-title" className="IcFxxa_toolsSection">
          <div className="IcFxxa_container">
            <h2 id="play-tools-title" className="IcFxxa_sectionTitle">
              Play tools
            </h2>
            <div className="IcFxxa_features">
              {FEATURES.map((feature) => (
                <article
                  key={feature.key}
                  aria-labelledby={`play-feature-${feature.key}`}
                  data-testid={`play-feature-${feature.key}`}
                  className="IcFxxa_feature"
                >
                  <div className="IcFxxa_featureCopy">
                    <h3 id={`play-feature-${feature.key}`}>{feature.title}</h3>
                    <p>{feature.body}</p>
                  </div>
                  <div
                    data-testid={`play-feature-${feature.key}-media`}
                    className="IcFxxa_featureMedia"
                  >
                    <MotionPreview
                      label={feature.title}
                      posterSrc={feature.posterSrc}
                      motionSrc={feature.motionSrc}
                      alt={feature.alt}
                      width={feature.width}
                      height={feature.height}
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="play-table-title"
          className="IcFxxa_container IcFxxa_tableSection"
        >
          <h2 id="play-table-title" className="IcFxxa_sectionTitle">
            More features
          </h2>
          <ul data-testid="play-table-features" className="IcFxxa_tableFeatures">
            {TABLE_FEATURES.map(({ key, icon: Icon, title, body }) => (
              <li key={key}>
                <Icon size={20} />
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="IcFxxa_container IcFxxa_endActions">
          <a
            href={`${PLAY_URL}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="IcFxxa_primaryButton"
            data-testid="play-launch-simulator-footer"
          >
            Open simulator
            <ArrowRightIcon size={16} />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a className="IcFxxa_textLink" href={`${SITE_URL}/decks`}>
            Choose a deck
            <ArrowRightIcon size={16} />
          </a>
          <a
            href="https://discord.gg/8vfhVuUXmT"
            target="_blank"
            rel="noopener noreferrer"
            className="IcFxxa_textLink"
          >
            Join the Discord
            <ArrowRightIcon size={16} />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </main>
    </div>
  );
}
