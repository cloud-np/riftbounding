import { strings } from "@/components/lobby/strings";

export function AppFooter() {
  return (
    <div className="mt-auto grid gap-3 pt-2 min-[1280px]:col-span-3 min-[1280px]:row-start-2">
      <footer className="px-1 py-1">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <p className="max-w-none text-[0.72rem] leading-5 text-text-dim">
            {strings["footer.disclaimer"]}
          </p>
          <nav
            aria-label={strings["footer.legal"]}
            className="flex flex-wrap items-center gap-y-2 text-text-dim gap-x-3 text-[0.74rem]"
          >
            <a
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-text-main"
              href="https://riftatlas.com/changelog"
            >
              {strings["footer.patchNotes"]}
            </a>
            <a
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-text-main"
              href="https://riftatlas.com/legal-notice"
            >
              {strings["footer.legalNotice"]}
            </a>
            <a
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-text-main"
              href="https://riftatlas.com/privacy-policy"
            >
              {strings["footer.privacy"]}
            </a>
            <a
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-text-main"
              href="https://riftatlas.com/terms-of-service"
            >
              {strings["footer.terms"]}
            </a>
            <a
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-text-main"
              href="https://riftatlas.com/contact"
            >
              {strings["footer.contact"]}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
