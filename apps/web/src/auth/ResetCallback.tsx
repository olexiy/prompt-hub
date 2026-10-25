import { Banner, Button, FormControl, TextInput } from "@primer/react";
import { useEffect, useState } from "react";
import { ApiError, post } from "../api";
import { useI18n } from "../i18n";
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
  const { t } = useI18n();
  const [tokens] = useState(readFragment);
  const [state, setState] = useState<"checking" | "ready" | "invalid">(
    tokens ? "checking" : "invalid",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Whose password this is, from the API: a link made for another account shows it here (#61).
  const [email, setEmail] = useState("");

  useEffect(() => {
    history.replaceState(null, "", window.location.pathname);
    if (!tokens) return;
    post<{ email: string }>("/api/auth/session", tokens).then(
      (res) => {
        setEmail(res.email);
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
      setError(err instanceof ApiError ? err.message : t("error.generic"));
    } finally {
      setBusy(false);
    }
  }

  if (state === "invalid") {
    return (
      <AuthCard title={t("auth.resetTitle")}>
        <Banner
          variant="critical"
          title={t("auth.invalidLinkTitle")}
          hideTitle
          layout="compact"
          description={t("auth.invalidLink")}
        />
        <Button as="a" href="/">
          {t("auth.toSignIn")}
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("auth.newPasswordTitle")}>
      {email && <p style={{ margin: 0 }}>{t("auth.newPasswordFor", { email })}</p>}
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
          <FormControl.Label>{t("auth.newPassword")}</FormControl.Label>
          <TextInput
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
            block
          />
          <FormControl.Caption>{t("auth.newPasswordHint")}</FormControl.Caption>
        </FormControl>
        <Button type="submit" variant="primary" block loading={busy} disabled={state !== "ready"}>
          {t("auth.savePassword")}
        </Button>
      </form>
    </AuthCard>
  );
}
