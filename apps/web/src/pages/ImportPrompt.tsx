import {
  decodePromptFile,
  isPromptFileName,
  MAX_PROMPT_FILE_BYTES,
  orderMeta,
  parsePromptFile,
  suggestSlug,
  type PromptFile,
} from "@prompt-hub/core";
import { Banner, Button, FormControl, Heading, Textarea, TextInput } from "@primer/react";
import { useState } from "react";
import { ApiError, post } from "../api";
import { useI18n, type MessageKey } from "../i18n";
import { TagChips } from "../shell/Tags";

/** A dropped or picked file → prompt fields, or a message key explaining why not (#56). */
export async function readPromptFile(
  file: File,
): Promise<{ file: PromptFile } | { error: MessageKey; line?: number }> {
  if (!isPromptFileName(file.name)) return { error: "import.type" };
  if (file.size > MAX_PROMPT_FILE_BYTES) return { error: "import.size" };
  const text = decodePromptFile(new Uint8Array(await file.arrayBuffer()));
  if (text === null) return { error: "import.encoding" };
  const parsed = parsePromptFile(file.name, text);
  if (!parsed.ok) {
    return parsed.line === undefined
      ? { error: "import.frontMatter" }
      : { error: "import.frontMatterLine", line: parsed.line };
  }
  return { file: parsed.file };
}

/**
 * Preview of an imported file before anything is saved: title, URL slug and text can be changed;
 * topics, meta and variable defaults from front matter are shown and sent along.
 */
export function ImportPrompt({
  file,
  action,
  folder,
  urlPrefix,
  onCreated,
  onCancel,
}: {
  file: PromptFile;
  /** `POST` target: `/api/projects/{handle}/{project}/prompts`. */
  action: string;
  folder: string[];
  urlPrefix: string;
  onCreated: (slug: string) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(file.title.slice(0, 200));
  const [slug, setSlug] = useState(suggestSlug(file.title));
  const [body, setBody] = useState(file.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = orderMeta(file.meta);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post(action, {
        folder,
        slug,
        title,
        body,
        variables: file.variables,
        tags: file.tags,
        meta: file.meta,
      });
      onCreated(slug);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.generic"));
      setBusy(false);
    }
  }

  return (
    <form
      className="ph-box ph-form ph-pad"
      aria-label={t("import.title")}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Heading as="h2" className="ph-h2">
        {t("import.title")}
      </Heading>
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
      <FormControl required>
        <FormControl.Label>{t("form.body")}</FormControl.Label>
        <Textarea
          block
          className="ph-mono"
          rows={10}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
          }}
        />
      </FormControl>
      {(file.tags.length > 0 || meta.length > 0 || file.variables.length > 0) && (
        <div className="ph-stack ph-small">
          <TagChips tags={file.tags} />
          {meta.length > 0 && (
            <p className="ph-muted ph-m0">
              {t("import.meta", { names: meta.map(([k]) => k).join(", ") })}
            </p>
          )}
          {file.variables.length > 0 && (
            <p className="ph-muted ph-m0">
              {t("import.variables", { names: file.variables.map((v) => v.name).join(", ") })}
            </p>
          )}
        </div>
      )}
      <div className="ph-row">
        <Button type="submit" variant="primary" loading={busy}>
          {t("import.create")}
        </Button>
        <Button onClick={onCancel}>{t("form.cancel")}</Button>
      </div>
    </form>
  );
}
