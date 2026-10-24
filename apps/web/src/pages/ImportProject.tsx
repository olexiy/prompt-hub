import { readProjectZip, type ProjectBundle, type ZipError } from "@prompt-hub/core";
import { Banner, Button, FormControl, Heading, TextInput } from "@primer/react";
import { useState } from "react";
import { ApiError, post } from "../api";
import { useI18n, type MessageKey } from "../i18n";

const ZIP_ERRORS: Record<ZipError, MessageKey> = {
  notZip: "zip.notZip",
  unsafePath: "zip.unsafePath",
  tooManyEntries: "zip.tooManyEntries",
  tooLarge: "zip.tooLarge",
  fileTooLarge: "zip.fileTooLarge",
  tooDeep: "zip.tooDeep",
  badProjectJson: "zip.badProjectJson",
  badFile: "zip.badFile",
  empty: "zip.empty",
  invalid: "zip.invalid",
};

/** Upper bound for the archive itself before it is even opened (the contents have their own). */
const MAX_ZIP_BYTES = 20 * 1024 * 1024;

/** A picked `.zip` → bundle for the preview, or a message (#57). Runs entirely in the browser. */
export async function readZipFile(
  file: File,
): Promise<{ bundle: ProjectBundle; skipped: string[] } | { error: MessageKey; detail: string }> {
  if (!file.name.toLowerCase().endsWith(".zip")) return { error: "zip.notZip", detail: "" };
  if (file.size > MAX_ZIP_BYTES) return { error: "zip.tooLarge", detail: "" };
  const result = readProjectZip(new Uint8Array(await file.arrayBuffer()), file.name);
  if (!result.ok) return { error: ZIP_ERRORS[result.error], detail: result.detail ?? "" };
  return { bundle: result.bundle, skipped: result.skipped };
}

/**
 * Preview of an archive before the project is created: name and URL slug can be changed; counts,
 * the first prompts and skipped files are shown. Nothing is saved until "Create project".
 */
export function ImportProject({
  bundle,
  skipped,
  urlPrefix,
  onCreated,
  onCancel,
}: {
  bundle: ProjectBundle;
  skipped: string[];
  urlPrefix: string;
  onCreated: (slug: string) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(bundle.name);
  const [slug, setSlug] = useState(bundle.slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post("/api/projects/import", { ...bundle, name, slug });
      onCreated(slug);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.generic"));
      setBusy(false);
    }
  }

  const shown = bundle.prompts.slice(0, 8);
  return (
    <form
      className="ph-box ph-form ph-pad"
      aria-label={t("zip.importTitle")}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Heading as="h2" className="ph-h2">
        {t("zip.importTitle")}
      </Heading>
      {error && (
        <Banner variant="critical" title={error} hideTitle description={error} layout="compact" />
      )}
      <FormControl required>
        <FormControl.Label>{t("form.name")}</FormControl.Label>
        <TextInput
          block
          value={name}
          maxLength={100}
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
      <p className="ph-m0">
        {t("zip.counts", {
          folders: String(bundle.folders.length),
          prompts: String(bundle.prompts.length),
        })}
      </p>
      <ul className="ph-muted ph-small ph-m0">
        {shown.map((p) => (
          <li key={[...p.folder, p.slug].join("/")}>
            <span className="ph-mono">{[...p.folder, p.slug].join("/")}</span> — {p.title}
          </li>
        ))}
        {bundle.prompts.length > shown.length && (
          <li>{t("zip.andMore", { count: String(bundle.prompts.length - shown.length) })}</li>
        )}
      </ul>
      {skipped.length > 0 && (
        <p className="ph-muted ph-small ph-m0">
          {t("zip.skipped", { files: skipped.slice(0, 10).join(", ") })}
        </p>
      )}
      <div className="ph-row">
        <Button type="submit" variant="primary" loading={busy}>
          {t("zip.create")}
        </Button>
        <Button onClick={onCancel}>{t("form.cancel")}</Button>
      </div>
    </form>
  );
}
