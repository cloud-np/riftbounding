/**
 * Prerender / hydration fallback from the original app: the branded "Opening
 * RiftAtlas…" card plus the sr-only SEO block that always lives in the lobby DOM.
 */
export function SeoBlock() {
  return (
    <section className="sr-only" aria-labelledby="simulator-seo-title">
      <h1 id="simulator-seo-title">Play Riftbound Online with Rift Atlas</h1>
      <p>
        Rift Atlas is an unofficial fan-made Riftbound online simulator for players who want to
        create room-code matches, paste or import decks, and play games in the browser.
      </p>
      <p>
        The simulator supports multiplayer rooms, goldfish testing, sealed practice, battlefield
        setup, manual board controls, rewind, auto-pay, and other quality-of-life tools for smoother
        remote play.
      </p>
      <p>
        Rift Atlas uses assets owned by Riot Games under Riot Games&apos; &quot;Legal Jibber
        Jabber&quot; policy. Riot Games does not endorse or sponsor this project.
      </p>
      <ul>
        <li>Play Riftbound online with private room codes.</li>
        <li>Paste or import decklists before launching a match.</li>
        <li>Practice hands with goldfish mode and sealed pools.</li>
        <li>Use manual board controls for flexible tabletop-style play.</li>
      </ul>
    </section>
  );
}

export function EntryShell() {
  return (
    <main
      data-testid="simulator-shell"
      className="hub-theme relative isolate flex min-h-dvh flex-col items-center px-6 pb-10 pt-[max(2.5rem,calc((100dvh-30rem)/2))] text-text-main"
    >
      <header
        data-testid="simulator-entry-header"
        className="flex flex-col items-center gap-2 text-center"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          src="/riftbound/static/brand/rift-atlas/rift-atlas-mark-hollow-gold.webp"
          className="h-20 w-auto"
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9fdff2]">
          Play.Riftatlas
        </p>
        <h1 className="text-2xl font-semibold">RiftAtlas</h1>
      </header>
      <div
        data-testid="simulator-entry-loading"
        role="status"
        className="mt-8 flex items-center gap-3 border border-[rgba(132,150,184,0.24)] bg-[rgba(10,18,31,0.72)] px-5 py-4 text-sm text-text-soft"
      >
        <span
          className="size-4 shrink-0 rounded-full border-2 border-[rgba(159,223,242,0.2)] border-t-[#9fdff2] motion-safe:animate-spin"
          aria-hidden="true"
        />
        Opening RiftAtlas…
      </div>
    </main>
  );
}
