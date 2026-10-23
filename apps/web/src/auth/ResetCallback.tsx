import { Banner, Button, FormControl, TextInput } from "@primer/react";
import { useEffect, useState } from "react";
import { ApiError, post } from "../api";
import { AuthCard } from "./AuthCard";

interface RecoveryTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Tokens from the reset link's URL fragment (#access_token=…&refresh_token=…&expires_in=…). */
function readFragment(): RecoveryTokens | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const expiresIn = Number(params.get("expires_in"));
  return accessToken && refreshToken && expiresIn ? { accessToken, refreshToken, expiresIn } : null;
}

/**
 * Landing page of the password-reset email (/auth/callback). Hands the tokens to the API once
 * (they become HttpOnly cookies), wipes them from the URL, then asks for the new password.
 */
export function ResetCallback({ onDone }: { onDone: () => void }) {
  const [tokens] = useState(readFragment);
  const [state, setState] = useState<"checking" | "ready" | "invalid">(
    tokens ? "checking" : "invalid",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    history.replaceState(null, "", window.location.pathname);
    if (!tokens) return;
    post("/api/auth/session", tokens).then(
      () => {
        setState("ready");
      },
      () => {
        setState("invalid");
      },
    );
  }, [tokens]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post("/api/auth/password", { password });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (state === "invalid") {
    return (
      <AuthCard title="Reset your password">
        <Banner
          variant="critical"
          title="Invalid link"
          hideTitle
          layout="compact"
          description="This link is invalid or has expired. Request a new one."
        />
        <Button as="a" href="/">
          Back to sign in
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      {error && (
        <Banner variant="critical" title="Error" hideTitle layout="compact" description={error} />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: "grid", gap: 16 }}
      >
        <FormControl required disabled={state !== "ready"}>
          <FormControl.Label>New password</FormControl.Label>
          <TextInput
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
            block
          />
          <FormControl.Caption>At least 12 characters.</FormControl.Caption>
        </FormControl>
        <Button type="submit" variant="primary" block loading={busy} disabled={state !== "ready"}>
          Save password
        </Button>
      </form>
    </AuthCard>
  );
}
