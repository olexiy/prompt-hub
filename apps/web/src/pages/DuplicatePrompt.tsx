import type { PromptDetail } from "@prompt-hub/core";
import { Banner, Button, FormControl, Heading, TextInput } from "@primer/react";
import { useState } from "react";
import { ApiError, post } from "../api";
import { useI18n } from "../i18n";

/**
 * "Duplicate" on a prompt (#51): title and URL slug of the copy, prefilled with "(copy)" and
 * `-copy`. The copy lands in the same folder with the current version as v1.
 */
export function DuplicatePrompt({
  detail,
  apiCopy,
  urlPrefix,
  onCreated,
  onCancel,
}: {
  detail: PromptDetail;
  /** `POST` target: `/api/projects/{handle}/{project}/copy/{path}`. */
  apiCopy: string;
  /** Host and folder URL the new slug is appended to, for the address hint. */
  urlPrefix: string;
  onCreated: (slug: string) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(t("prompt.copySuffix", { title: detail.title }).slice(0, 200));
  const [slug, setSlug] = useState(`${detail.slug}-copy`.slice(0, 64));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post(apiCopy, { slug, title });
      onCreated(slug);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.generic"));
      setBusy(false);
    }
  }

  return (
    <form
      className="ph-box ph-form ph-pad"
      aria-label={t("prompt.duplicateTitle")}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Heading as="h2" className="ph-h2">
        {t("prompt.duplicateTitle")}
      </Heading>
      <p className="ph-muted ph-m0">{t("prompt.duplicateHint")}</p>
      {error && (
        <Banner variant="critical" title={error} hideTitle description={error} layout="compact" />
      )}
      <FormControl required>
        <FormControl.Label>{t("form.title")}</FormControl.Label>
        <TextInput
          block
          value={title}
          maxLength={200}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
        />
      </FormControl>
      <FormControl required>
        <FormControl.Label>{t("form.slug")}</FormControl.Label>
        <TextInput
          block
          className="ph-mono"
          value={slug}
          maxLength={64}
          onChange={(e) => {
            setSlug(e.target.value);
          }}
        />
        <FormControl.Caption>
          {t("form.slugHint", { url: `${urlPrefix}/${slug || "…"}` })}
        </FormControl.Caption>
      </FormControl>
      <div className="ph-row">
        <Button type="submit" variant="primary" loading={busy}>
          {t("prompt.duplicate")}
        </Button>
        <Button onClick={onCancel}>{t("form.cancel")}</Button>
      </div>
    </form>
  );
}
