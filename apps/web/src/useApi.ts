import { useEffect, useState } from "react";
import { ApiError, get } from "./api";

export type Loaded<T> =
  { state: "loading" } | { state: "ok"; data: T } | { state: "notFound" } | { state: "error" };

/** GET `path` whenever it changes; 404 is its own state so pages can show "not found". */
export function useApi<T>(path: string): Loaded<T> {
  const [result, setResult] = useState<{ path: string; value: Loaded<T> }>({
    path,
    value: { state: "loading" },
  });

  useEffect(() => {
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
  }, [path]);

  // A new path shows "loading" at once instead of the previous page's data.
  return result.path === path ? result.value : { state: "loading" };
}
