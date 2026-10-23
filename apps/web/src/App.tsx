import { APP_NAME, type HealthResponse } from "@prompt-hub/core";
import { Heading, Label, Text } from "@primer/react";
import { useEffect, useState } from "react";

type ApiState = { kind: "loading" } | { kind: "ok"; data: HealthResponse } | { kind: "error" };

/** Skeleton page: proves React, Primer and the API Worker are wired together. Replaced by the app shell in #24. */
export function App() {
  const [api, setApi] = useState<ApiState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Health check failed: ${String(res.status)}`);
        return res.json() as Promise<HealthResponse>;
      })
      .then((data) => {
        setApi({ kind: "ok", data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setApi({ kind: "error" });
      });
    return () => {
      controller.abort();
    };
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 16px" }}>
      <Heading as="h1">{APP_NAME}</Heading>
      <Text as="p">Store, version and reuse AI prompts. The skeleton is running.</Text>
      <Text as="p">
        API: {api.kind === "loading" && <Label>checking…</Label>}
        {api.kind === "ok" && <Label variant="success">{api.data.status}</Label>}
        {api.kind === "error" && <Label variant="danger">unreachable</Label>}
      </Text>
    </main>
  );
}
