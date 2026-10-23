import { renderPrompt, tokenizePrompt, type PromptDetail } from "@prompt-hub/core";
import { AlertIcon, CopyIcon } from "@primer/octicons-react";
import { Button, FormControl, Heading, Label, Spinner, TextInput } from "@primer/react";
import { useState } from "react";
import { useI18n } from "../i18n";
import { useApi } from "../useApi";
import { NotFound } from "./Placeholder";

/**
 * `/{handle}/{project}/{prompt}` (mockup: prompt): the body with variables filled in as you
 * type, the Variables panel and Copy. Rendering is the shared core function, so the copy is
 * exactly what the preview shows.
 */
export function PromptPage({
  handle,
  project,
  prompt,
}: {
  handle: string;
  project: string;
  prompt: string;
}) {
  const { t } = useI18n();
  const loaded = useApi<PromptDetail>(`/api/projects/${handle}/${project}/prompts/${prompt}`);
  const [values, setValues] = useState<Record<string, string>>({});
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  if (loaded.state === "loading") {
    return (
      <div className="ph-center">
        <Spinner />
      </div>
    );
  }
  if (loaded.state === "notFound") return <NotFound />;
  if (loaded.state === "error") return <p className="ph-muted">{t("error.load")}</p>;

  const { title, version } = loaded.data;
  const defs = version.variables;
  const defaults = new Map(defs.map((d) => [d.name, d.default]));
  const { text, unfilled } = renderPrompt(version.body, values, defs);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="ph-stack">
      <Heading as="h1" className="ph-h3 ph-title">
        {title}
      </Heading>
      <div className="ph-prompt">
        <div className="ph-box ph-main-col">
          <div className="ph-box-head">
            <Label variant="success">{t("prompt.live")}</Label>
            <b>v{version.number}</b>
          </div>
          <pre className="ph-prompt-body" data-testid="prompt-preview">
            {tokenizePrompt(version.body).map((s, i) => {
              if ("text" in s) return s.text;
              const value = values[s.variable] || defaults.get(s.variable);
              return value ? (
                <mark key={i} className="ph-var-filled" title={s.variable}>
                  {value}
                </mark>
              ) : (
                <mark key={i} className="ph-var-empty">
                  {s.placeholder}
                </mark>
              );
            })}
          </pre>
          <div className="ph-stats ph-muted">
            <span>{t("prompt.chars", { count: String(text.length) })}</span>
            <span>{t("prompt.variablesCount", { count: String(defs.length) })}</span>
          </div>
        </div>
        <aside className="ph-box">
          <form
            className="ph-form ph-pad"
            onSubmit={(e) => {
              e.preventDefault();
              void copy();
            }}
          >
            <Heading as="h2" className="ph-h2">
              {t("prompt.variables")}{" "}
              <span className="ph-muted ph-small">{t("prompt.fillThenCopy")}</span>
            </Heading>
            {defs.length === 0 && <p className="ph-muted">{t("prompt.noVariables")}</p>}
            {defs.map((d) => (
              <FormControl key={d.name}>
                <FormControl.Label>
                  <span className="ph-mono">{d.name}</span>
                </FormControl.Label>
                <TextInput
                  block
                  value={values[d.name] ?? ""}
                  placeholder={d.default ?? ""}
                  onChange={(e) => {
                    setValues((v) => ({ ...v, [d.name]: e.target.value }));
                    setCopyState("idle");
                  }}
                />
                {(d.default ?? d.description) && (
                  <FormControl.Caption>
                    {d.description ?? t("prompt.default", { value: d.default ?? "" })}
                  </FormControl.Caption>
                )}
              </FormControl>
            ))}
            {unfilled.length > 0 && (
              <p className="ph-warn" role="note">
                <AlertIcon /> {t("prompt.unfilled", { names: unfilled.join(", ") })}
              </p>
            )}
            <Button type="submit" variant="primary" leadingVisual={CopyIcon} block>
              {t("prompt.copy")}
            </Button>
            <p className="ph-muted ph-small" aria-live="polite">
              {copyState === "copied" && t("prompt.copied")}
              {copyState === "failed" && t("prompt.copyFailed")}
            </p>
          </form>
        </aside>
      </div>
    </div>
  );
}
