/**
 * Tiny History-API router: the current pathname as React state, `navigate()` and a Link that
 * navigates without a page load. URL parsing lives in @prompt-hub/core (`parseRoute`).
 */
import { Link } from "@primer/react";
import { useSyncExternalStore, type ComponentProps, type MouseEvent } from "react";

const NAVIGATE_EVENT = "ph:navigate";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(NAVIGATE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(NAVIGATE_EVENT, onChange);
  };
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

/** A query parameter of the current URL, e.g. `q` on `/search?q=` (#55); "" when missing. */
export function useQueryParam(name: string): string {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name) ?? "",
  );
}

export function navigate(to: string): void {
  if (to === window.location.pathname + window.location.search) return;
  window.history.pushState(null, "", to);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
  window.scrollTo(0, 0);
}

/** Plain left clicks navigate in-app; modified clicks (new tab, …) keep browser behaviour. */
export function handleLinkClick(event: MouseEvent<HTMLElement>, href: string): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  event.preventDefault();
  navigate(href);
}

export function RouterLink({
  href,
  onClick,
  ...props
}: ComponentProps<typeof Link> & { href: string }) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (!e.defaultPrevented) handleLinkClick(e, href);
      }}
    />
  );
}
