import { suggestSlug } from "@prompt-hub/core";
import { Banner, Button, FormControl, Textarea, TextInput } from "@primer/react";
import { useState } from "react";
import { ApiError, post } from "../api";
import { useI18n } from "../i18n";

/**
 * "New project" and "New prompt" form: name/title, URL slug suggested from it (editable), and a
 * description or the prompt text. The server validates again; its message is shown on failure.
 */
export function CreateForm({
  kind,
  action,
  urlPrefix,
  onCreated,
  onCancel,
}: {
  kind: "project" | "prompt";
  action: string;
  urlPrefix: string;
  onCreated: (slug: string) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const effectiveSlug = slugTouched ? slug : suggestSlug(name);

  async function submit() {
    setBusy(true);
    setError(null);
    const body =
      kind === "project"
        ? { slug: effectiveSlug, name, description: text }
        : { slug: effectiveSlug, title: name, body: text };
    try {
      await post(action, body);
      onCreated(effectiveSlug);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.generic"));
      setBusy(false);
    }
  }

  return (
    <form
      className="ph-box ph-form ph-pad"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {error && (
        <Banner variant="critical" title={error} hideTitle description={error} layout="compact" />
      )}
      <FormControl required>
        <FormControl.Label>
          {kind === "project" ? t("form.name") : t("form.title")}
        </FormControl.Label>
        <TextInput
          block
          value={name}
          maxLength={kind === "project" ? 100 : 200}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
      </FormControl>
      <FormControl required>
        <FormControl.Label>{t("form.slug")}</FormControl.Label>
        <TextInput
          block
          className="ph-mono"
          value={effectiveSlug}
          maxLength={64}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
        />
        <FormControl.Caption>
          {t("form.slugHint", { url: `${urlPrefix}/${effectiveSlug || "…"}` })}
        </FormControl.Caption>
      </FormControl>
      <FormControl required={kind === "prompt"}>
        <FormControl.Label>
          {kind === "project" ? t("form.description") : t("form.body")}
        </FormControl.Label>
        <Textarea
          block
          className={kind === "prompt" ? "ph-mono" : ""}
          rows={kind === "prompt" ? 10 : 3}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
        {kind === "prompt" && <FormControl.Caption>{t("form.bodyHint")}</FormControl.Caption>}
      </FormControl>
      <div className="ph-row">
        <Button type="submit" variant="primary" loading={busy}>
          {t("form.create")}
        </Button>
        <Button onClick={onCancel}>{t("form.cancel")}</Button>
      </div>
    </form>
  );
}
