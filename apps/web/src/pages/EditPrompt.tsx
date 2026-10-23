import { syncDefinitions, type PromptDetail, type VariableDef } from "@prompt-hub/core";
import { Banner, Button, FormControl, Heading, Textarea, TextInput } from "@primer/react";
import { useState } from "react";
import { ApiError, patch, post } from "../api";
import { useI18n } from "../i18n";

/**
 * Edit mode of a prompt: title, text and variable defaults/descriptions. Saving creates a new
 * version (the old one stays in History); a changed title is saved on its own.
 */
export function EditPrompt({
  detail,
  apiItem,
  apiVersions,
  onSaved,
  onCancel,
}: {
  detail: PromptDetail;
  apiItem: string;
  apiVersions: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(detail.title);
  const [body, setBody] = useState(detail.version.body);
  const [defs, setDefs] = useState<VariableDef[]>(detail.version.variables);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Definitions follow the text as it is typed: new variables appear, removed ones disappear.
  const shown = syncDefinitions(body, defs);

  function setDef(name: string, field: "default" | "description", value: string) {
    const next = shown.map((d) => (d.name === name ? { ...d, [field]: value } : d));
    setDefs(next);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (title.trim() !== detail.title) await patch(apiItem, { title });
      const changed =
        body !== detail.version.body ||
        JSON.stringify(shown) !== JSON.stringify(detail.version.variables);
      if (changed) {
        const variables = shown.map((d) => ({
          name: d.name,
          ...(d.default ? { default: d.default } : {}),
          ...(d.description ? { description: d.description } : {}),
        }));
        await post(apiVersions, { body, variables, message });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.generic"));
      setBusy(false);
    }
  }

  return (
    <form
      className="ph-prompt"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="ph-box ph-form ph-pad ph-main-col">
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
        <FormControl>
          <FormControl.Label>{t("form.body")}</FormControl.Label>
          <Textarea
            block
            className="ph-mono"
            rows={14}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
            }}
          />
          <FormControl.Caption>{t("form.bodyHint")}</FormControl.Caption>
        </FormControl>
        <FormControl>
          <FormControl.Label>{t("prompt.message")}</FormControl.Label>
          <TextInput
            block
            value={message}
            maxLength={500}
            onChange={(e) => {
              setMessage(e.target.value);
            }}
          />
        </FormControl>
        <div className="ph-row">
          <Button type="submit" variant="primary" loading={busy}>
            {t("prompt.saveVersion")}
          </Button>
          <Button onClick={onCancel}>{t("form.cancel")}</Button>
        </div>
      </div>
      <aside className="ph-box ph-form ph-pad">
        <Heading as="h2" className="ph-h2">
          {t("prompt.variables")}
        </Heading>
        {shown.length === 0 && <p className="ph-muted">{t("prompt.noVariables")}</p>}
        {shown.map((d) => (
          <fieldset key={d.name} className="ph-fieldset">
            <legend className="ph-mono">{d.name}</legend>
            <FormControl>
              <FormControl.Label>{t("prompt.defaultLabel")}</FormControl.Label>
              <TextInput
                block
                value={d.default ?? ""}
                maxLength={10_000}
                onChange={(e) => {
                  setDef(d.name, "default", e.target.value);
                }}
              />
            </FormControl>
            <FormControl>
              <FormControl.Label>{t("prompt.descriptionLabel")}</FormControl.Label>
              <TextInput
                block
                value={d.description ?? ""}
                maxLength={500}
                onChange={(e) => {
                  setDef(d.name, "description", e.target.value);
                }}
              />
            </FormControl>
          </fieldset>
        ))}
      </aside>
    </form>
  );
}
