import { syncDefinitions, type PromptDetail, type VariableDef } from "@prompt-hub/core";
import { Banner, Button, FormControl, Heading, Textarea, TextInput } from "@primer/react";
import { useState } from "react";
import { ApiError, patch, post, put } from "../api";
import { useI18n } from "../i18n";

/**
 * Edit mode of a prompt: title, text and variable defaults/descriptions. "Save" edits the current
 * version in place; "Save as new version" keeps it in History and makes the edit the next one.
 * A changed title is saved on its own (titles are not versioned).
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
  const [busy, setBusy] = useState<"save" | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Definitions follow the text as it is typed: new variables appear, removed ones disappear.
  const shown = syncDefinitions(body, defs);

  function setDef(name: string, field: "default" | "description", value: string) {
    const next = shown.map((d) => (d.name === name ? { ...d, [field]: value } : d));
    setDefs(next);
  }

  async function save(asNewVersion: boolean) {
    setBusy(asNewVersion ? "new" : "save");
    setError(null);
    try {
      if (title.trim() !== detail.title) await patch(apiItem, { title });
      const changed =
        body !== detail.version.body ||
        JSON.stringify(shown) !== JSON.stringify(detail.version.variables);
      const content = {
        body,
        variables: shown.map((d) => ({
          name: d.name,
          ...(d.default ? { default: d.default } : {}),
          ...(d.description ? { description: d.description } : {}),
        })),
      };
      // A new version only on request (even unchanged: a snapshot before experimenting).
      if (asNewVersion) await post(apiVersions, content);
      else if (changed) await put(apiVersions, content);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.generic"));
      setBusy(null);
    }
  }

  return (
    <form
      className="ph-prompt"
      onSubmit={(e) => {
        e.preventDefault();
        void save(false);
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
        <div className="ph-row">
          <Button
            type="submit"
            variant="primary"
            loading={busy === "save"}
            disabled={busy !== null}
          >
            {t("form.save")}
          </Button>
          <Button loading={busy === "new"} disabled={busy !== null} onClick={() => void save(true)}>
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
