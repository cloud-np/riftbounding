const footerLinkClass =
  "rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const FOOTER_LINKS = [
  { label: "Patch Notes", href: "https://riftatlas.com/changelog" },
  { label: "Legal Notice", href: "https://riftatlas.com/legal-notice" },
  { label: "Privacy Policy", href: "https://riftatlas.com/privacy-policy" },
  { label: "Terms of Service", href: "https://riftatlas.com/terms-of-service" },
  { label: "Media Kit", href: "https://riftatlas.com/media-kit" },
  { label: "Contact", href: "https://riftatlas.com/contact" },
];

export function SiteFooter() {
  return (
    <footer
      role="contentinfo"
      data-site-footer=""
      className="border-t border-border/70 bg-background/85 backdrop-blur-sm"
    >
      <div
        data-testid="site-footer-inner"
        className="flex w-full flex-col gap-3 px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-4 md:px-6 lg:px-8"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Rift Atlas was created under Riot Games&apos; &quot;Legal Jibber Jabber&quot; policy
            using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.
          </p>
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground"
          >
            {FOOTER_LINKS.map((link) => (
              <a key={link.href} className={footerLinkClass} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
