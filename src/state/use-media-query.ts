import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query and re-render when it changes. Used to drive
 * the phone-vs-desktop layout swap (so the same components reflow rather than
 * forking into mobile/desktop twins). SSR-safe-ish: falls back to `false` when
 * `matchMedia` is unavailable (e.g. jsdom without a polyfill).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** The phone breakpoint: below this the app switches to the tabbed layout. */
export const PHONE_QUERY = "(max-width: 640px)";
