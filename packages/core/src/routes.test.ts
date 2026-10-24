import { describe, expect, it } from "vitest";
import { MAX_ITEM_DEPTH, parseRoute, routePath, type Route } from "./routes";

describe("parseRoute", () => {
  it.each<[string, Route]>([
    ["/", { name: "home" }],
    ["", { name: "home" }],
    ["/settings", { name: "settings" }],
    ["/settings/", { name: "settings" }],
    ["/search", { name: "search" }],
    ["/auth/callback", { name: "resetCallback" }],
    ["/olexiy", { name: "user", handle: "olexiy" }],
    ["/olexiy/comfy-h3", { name: "project", handle: "olexiy", project: "comfy-h3" }],
    [
      "/olexiy/comfy-h3/shots/bus-stop-9s",
      { name: "item", handle: "olexiy", project: "comfy-h3", path: ["shots", "bus-stop-9s"] },
    ],
  ])("%s", (path, route) => {
    expect(parseRoute(path)).toEqual(route);
  });

  it.each([
    "/Olexiy",
    "/olexiy/Comfy",
    "/olexiy/a_b",
    "/olexiy/-x",
    "/settings/extra",
    "/auth",
    "/api/me",
    "/olexiy/settings",
    "/%3Cscript%3E",
  ])("%s is not found", (path) => {
    expect(parseRoute(path)).toEqual({ name: "notFound" });
  });

  it("limits the folder depth", () => {
    const deep = (n: number) =>
      `/u/p/${Array.from({ length: n }, (_, i) => `f${String(i)}`).join("/")}`;
    expect(parseRoute(deep(MAX_ITEM_DEPTH)).name).toBe("item");
    expect(parseRoute(deep(MAX_ITEM_DEPTH + 1)).name).toBe("notFound");
  });

  it("routePath round-trips", () => {
    for (const path of ["/", "/settings", "/auth/callback", "/a", "/a/b", "/a/b/c/d"]) {
      expect(routePath(parseRoute(path))).toBe(path);
    }
  });
});
