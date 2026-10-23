import { APP_NAME } from "@prompt-hub/core";
import { Button, Heading, Spinner, Text } from "@primer/react";
import { useEffect, useState } from "react";
import { get, post, type Me } from "./api";
import { ResetCallback } from "./auth/ResetCallback";
import { SignIn } from "./auth/SignIn";

type Session = { kind: "loading" } | { kind: "signed-out" } | { kind: "signed-in"; me: Me };

/** Current session; the API renews an expired access token from the refresh cookie itself. */
async function resolveSession(): Promise<Session> {
  try {
    const { user } = await get<{ user: Me | null }>("/api/auth/session");
    return user ? { kind: "signed-in", me: user } : { kind: "signed-out" };
  } catch {
    return { kind: "signed-out" };
  }
}

const isResetCallback = () => window.location.pathname === "/auth/callback";

/** Session gate until the app shell (#24): sign-in, reset callback, or a minimal home. */
export function App() {
  const [session, setSession] = useState<Session>({ kind: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (isResetCallback()) return;
    let current = true;
    void resolveSession().then((s) => {
      if (current) setSession(s);
    });
    return () => {
      current = false;
    };
  }, [version]);

  if (isResetCallback()) {
    return (
      <ResetCallback
        onDone={() => {
          window.location.assign("/");
        }}
      />
    );
  }
  if (session.kind === "loading") {
    return (
      <main style={{ display: "grid", placeItems: "center", padding: 64 }}>
        <Spinner />
      </main>
    );
  }
  if (session.kind === "signed-out") {
    return (
      <SignIn
        onSignedIn={() => {
          setVersion((v) => v + 1);
        }}
      />
    );
  }

  return (
    <main
      style={{ maxWidth: 720, margin: "0 auto", padding: "64px 16px", display: "grid", gap: 16 }}
    >
      <Heading as="h1">{APP_NAME}</Heading>
      <Text as="p">
        Signed in as <b>{session.me.handle}</b>.
      </Text>
      <div>
        <Button
          onClick={() => {
            void post("/api/auth/sign-out").finally(() => {
              setSession({ kind: "signed-out" });
            });
          }}
        >
          Sign out
        </Button>
      </div>
    </main>
  );
}
