import { useCallback, useEffect, useState } from "react";
import { ApiError, get } from "./api";

export type Loaded<T> =
  { state: "loading" } | { state: "ok"; data: T } | { state: "notFound" } | { state: "error" };

/**
 * GET `path` whenever it changes (or `reload()` is called); 404 is its own state so pages can
 * show "not found". A null path loads nothing and stays "loading".
 */
export function useApi<T>(path: string | null): [Loaded<T>, () => void] {
  const [result, setResult] = useState<{ path: string | null; value: Loaded<T> }>({
    path,
    value: { state: "loading" },
  });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (path === null) return;
    let current = true;
    get<T>(path).then(
      (data) => {
        if (current) setResult({ path, value: { state: "ok", data } });
      },
      (err: unknown) => {
        const notFound = err instanceof ApiError && err.status === 404;
        if (current) setResult({ path, value: { state: notFound ? "notFound" : "error" } });
      },
    );
    return () => {
      current = false;
    };
  }, [path, version]);

  // A new path shows "loading" at once instead of the previous page's data.
  return [result.path === path ? result.value : { state: "loading" }, reload];
}
