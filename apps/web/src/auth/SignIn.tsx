import { Banner, Button, FormControl, Link, Text, TextInput } from "@primer/react";
import { useState } from "react";
import { ApiError, post } from "../api";
import { useI18n } from "../i18n";
import { AuthCard } from "./AuthCard";

/** Sign-in form with an inline "forgot password" mode. Sign-up does not exist. */
export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"sign-in" | "reset">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "sign-in") {
        await post("/api/auth/sign-in", { email, password });
        onSignedIn();
      } else {
        await post("/api/auth/reset", { email });
        setNotice(t("auth.resetSent"));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title={mode === "sign-in" ? t("auth.signInTitle") : t("auth.resetTitle")}>
      {error && (
        <Banner variant="critical" title="Error" hideTitle description={error} layout="compact" />
      )}
      {notice && (
        <Banner variant="success" title="Sent" hideTitle description={notice} layout="compact" />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: "grid", gap: 16 }}
      >
        <FormControl required>
          <FormControl.Label>{t("auth.email")}</FormControl.Label>
          <TextInput
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            block
          />
        </FormControl>
        {mode === "sign-in" && (
          <FormControl required>
            <FormControl.Label>{t("auth.password")}</FormControl.Label>
            <TextInput
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              block
            />
          </FormControl>
        )}
        <Button type="submit" variant="primary" block loading={busy}>
          {mode === "sign-in" ? t("auth.signIn") : t("auth.sendLink")}
        </Button>
      </form>
      <Text as="p" style={{ fontSize: 14, margin: 0 }}>
        <Link
          as="button"
          onClick={() => {
            setMode(mode === "sign-in" ? "reset" : "sign-in");
            setError(null);
            setNotice(null);
          }}
        >
          {mode === "sign-in" ? t("auth.forgot") : t("auth.back")}
        </Link>
      </Text>
      <Text as="p" style={{ fontSize: 12, margin: 0, color: "var(--fgColor-muted)" }}>
        {t("auth.closed")}
      </Text>
    </AuthCard>
  );
}
