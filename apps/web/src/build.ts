/**
 * Stale-tab detection (#73): the API returns the deployed build id in `X-App-Build`; when it
 * differs from the id baked into this bundle, the tab runs old code against a new API. The app
 * then shows a reload banner, and api.ts stops sending writes (the API would refuse them anyway).
 */
import { useSyncExternalStore } from "react";

declare const __BUILD_ID__: string;

export const BUILD_ID = __BUILD_ID__;
export const BUILD_HEADER = "X-App-Build";

let stale = false;
const listeners = new Set<() => void>();

/** Checks a response from our API; marks the tab stale once the ids differ. */
export function noteBuild(res: Response): void {
  const server = res.headers.get(BUILD_HEADER);
  if (stale || BUILD_ID === "dev" || !server || server === BUILD_ID) return;
  stale = true;
  for (const listener of listeners) listener();
}

export const isStale = () => stale;

/** Headers every request to our API carries, so the API can refuse writes from an old tab. */
export const buildHeaders = (): Record<string, string> =>
  BUILD_ID === "dev" ? {} : { [BUILD_HEADER]: BUILD_ID };

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True once this tab is known to be older than the deployed app. */
export function useStale(): boolean {
  return useSyncExternalStore(subscribe, isStale);
}

/** Asks the API on window focus, so a tab left open over a deploy notices before the next click. */
export function watchFocus(): () => void {
  const check = () => {
    if (stale || document.visibilityState !== "visible") return;
    fetch("/api/health", { credentials: "same-origin" }).then(noteBuild, () => undefined);
  };
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", check);
  return () => {
    window.removeEventListener("focus", check);
    document.removeEventListener("visibilitychange", check);
  };
}
