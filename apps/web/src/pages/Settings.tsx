import { LOCALES, THEMES, type Locale, type Theme } from "@prompt-hub/core";
import {
  Banner,
  Button,
  FormControl,
  Heading,
  Radio,
  RadioGroup,
  Select,
  TextInput,
} from "@primer/react";
import { useState } from "react";
import type { Me } from "../api";
import { LANGUAGE_NAMES, useI18n } from "../i18n";

/** Account settings (mockup: account): handle (read-only for now), language and theme. */
export function Settings({
  me,
  onSave,
}: {
  me: Me;
  onSave: (changes: { locale: Locale; theme: Theme }) => Promise<void>;
}) {
  const { t } = useI18n();
  const [locale, setLocale] = useState<Locale>(me.locale);
  const [theme, setTheme] = useState<Theme>(me.theme);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    try {
      await onSave({ locale, theme });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="ph-settings">
      <nav className="ph-settings-nav" aria-label={t("settings.title")}>
        <a href="#profile">{t("settings.profile")}</a>
        <a href="#appearance">{t("settings.appearance")}</a>
      </nav>
      <div className="ph-settings-main">
        <Heading as="h1" className="ph-h2" id="profile">
          {t("settings.profile")}
        </Heading>
        <FormControl disabled>
          <FormControl.Label>{t("settings.handle")}</FormControl.Label>
          <TextInput value={me.handle} readOnly className="ph-mono" />
          <FormControl.Caption>
            {t("settings.handleHint", { url: `${window.location.host}/${me.handle}` })}
          </FormControl.Caption>
        </FormControl>

        <Heading as="h2" className="ph-h2" id="appearance">
          {t("settings.appearance")}
        </Heading>
        <form
          className="ph-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <FormControl>
            <FormControl.Label>{t("settings.language")}</FormControl.Label>
            <Select
              value={locale}
              onChange={(e) => {
                setLocale(e.target.value as Locale);
                setStatus("idle");
              }}
            >
              {LOCALES.map((l) => (
                <Select.Option key={l} value={l}>
                  {LANGUAGE_NAMES[l]}
                </Select.Option>
              ))}
            </Select>
          </FormControl>
          <RadioGroup
            name="theme"
            onChange={(value) => {
              if (value) setTheme(value as Theme);
              setStatus("idle");
            }}
          >
            <RadioGroup.Label>{t("settings.theme")}</RadioGroup.Label>
            {THEMES.map((th) => (
              <FormControl key={th}>
                <Radio value={th} checked={theme === th} />
                <FormControl.Label>{t(`theme.${th}`)}</FormControl.Label>
              </FormControl>
            ))}
          </RadioGroup>
          <div className="ph-row">
            <Button type="submit" variant="primary" loading={status === "saving"}>
              {t("settings.save")}
            </Button>
            {status === "saved" && (
              <span className="ph-muted" role="status">
                {t("settings.saved")}
              </span>
            )}
          </div>
          {status === "error" && (
            <Banner
              variant="critical"
              title={t("settings.saveError")}
              hideTitle
              description={t("settings.saveError")}
              layout="compact"
            />
          )}
        </form>
      </div>
    </div>
  );
}
