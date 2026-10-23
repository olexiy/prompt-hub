/**
 * GitHub-like URLs of the web app: `/{handle}/{project}/{folder…}/{prompt}`.
 * Reserved words (`settings`, `auth`, …) are app routes; every other segment must be a valid slug,
 * so a malformed URL becomes "not found" instead of reaching the API.
 */
import { isValidSlug } from "./slug";

export type Route =
  | { name: "home" }
  | { name: "settings" }
  | { name: "resetCallback" }
  | { name: "user"; handle: string }
  | { name: "project"; handle: string; project: string }
  | { name: "item"; handle: string; project: string; path: string[] }
  | { name: "notFound" };

/** Deepest folder nesting plus the prompt itself; deeper URLs are not found. */
export const MAX_ITEM_DEPTH = 8;

export function parseRoute(pathname: string): Route {
  const segments = pathname.split("/").filter((s) => s !== "");
  if (segments.length === 0) return { name: "home" };
  if (segments.length === 1 && segments[0] === "settings") return { name: "settings" };
  if (segments.length === 2 && segments[0] === "auth" && segments[1] === "callback") {
    return { name: "resetCallback" };
  }
  if (!segments.every(isValidSlug)) return { name: "notFound" };

  const [handle, project, ...path] = segments as [string, ...string[]];
  if (project === undefined) return { name: "user", handle };
  if (path.length === 0) return { name: "project", handle, project };
  if (path.length > MAX_ITEM_DEPTH) return { name: "notFound" };
  return { name: "item", handle, project, path };
}

/** Path of a route, the inverse of `parseRoute` for links. */
export function routePath(route: Route): string {
  switch (route.name) {
    case "home":
      return "/";
    case "settings":
      return "/settings";
    case "resetCallback":
      return "/auth/callback";
    case "user":
      return `/${route.handle}`;
    case "project":
      return `/${route.handle}/${route.project}`;
    case "item":
      return `/${[route.handle, route.project, ...route.path].join("/")}`;
    case "notFound":
      return "/";
  }
}
