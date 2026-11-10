import type { DomainName } from "../theme/domain-colors";

/** Original single-colour glyphs, one per domain (24x24, drawn with currentColor). */
const SIGILS: Record<DomainName, React.ReactNode> = {
  Fury: (
    <path d="M12.4 1.8c.7 3.9 5.4 6 5.4 11.2a5.9 5.9 0 0 1-11.8 0c0-2.3 1-3.9 2.3-5 .1 1.9.9 3 2 3.4-.6-3.5.5-6.9 2.1-9.6Z" />
  ),
  Calm: (
    <>
      <path d="M3.2 15.5C4.5 8 10 3.5 20.8 3.2c.1 9.4-4.6 16.2-12.2 16.4-1.9 0-3.6-1-4.7-2.9Z" />
      <path d="M5 19.5C8.5 14 12.5 10.6 17 8.2" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  Mind: (
    <>
      <path d="M12 1.6 14.6 9.4 22.4 12 14.6 14.6 12 22.4 9.4 14.6 1.6 12 9.4 9.4Z" />
      <circle cx="12" cy="12" r="2.1" fill="rgba(0,0,0,0.4)" />
    </>
  ),
  Body: (
    <path d="M12 1.8 20.4 5.6v6.2c0 5.2-3.5 8.7-8.4 10.4C7.1 20.500 3.600 17 3.600 11.800V5.600Zm0 4.700-4.200 2v3.100c0 2.400 1.600 4.200 4.200 5.200 2.600-1 4.200-2.800 4.200-5.200V8.500Z" fillRule="evenodd" />
  ),
  Chaos: (
    <path
      d="M12 12.2c.2-1.300 1.800-1.700 2.600-.7.900 1.200.3 3-1.100 3.700-2.100 1-4.500-.5-4.800-2.800-.4-3 2-5.400 5-5.200 4 .3 6.500 4 5.600 7.900-1 4.400-5.500 6.900-9.800 5.900"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.300"
      strokeLinecap="round"
    />
  ),
  Order: (
    <>
      <circle cx="12" cy="12" r="4.600" />
      <path d="M12 1.600v3.600M12 18.800v3.600M1.600 12h3.600M18.800 12h3.600M4.600 4.600l2.500 2.500M16.900 16.900l2.500 2.500M19.400 4.600l-2.500 2.500M7.100 16.900l-2.500 2.500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  Unknown: <path d="M12 2.500 21 12l-9 9.500L3 12Z" />,
};

export function DomainSigil({ domain, className }: { domain: DomainName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className}>
      {SIGILS[domain]}
    </svg>
  );
}
