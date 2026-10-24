import { renderPrompt, tokenizePrompt, type PromptDetail } from "@prompt-hub/core";
import {
  AlertIcon,
  CopyIcon,
  DuplicateIcon,
  FileDirectoryIcon,
  HistoryIcon,
  PencilIcon,
  TrashIcon,
} from "@primer/octicons-react";
import {
  ActionList,
  ActionMenu,
  Button,
  FormControl,
  Heading,
  Label,
  TextInput,
  useConfirm,
} from "@primer/react";
import { useState } from "react";
import { useI18n } from "../i18n";
import { del, patch } from "../api";
import { navigate } from "../router";
import { useApi } from "../useApi";
import { DuplicatePrompt } from "./DuplicatePrompt";
import { EditPrompt } from "./EditPrompt";
import { History } from "./History";

/**
 * `/{handle}/{project}/{prompt}` (mockup: prompt): the body with variables filled in as you
 * type, the Variables panel and Copy. Rendering is the shared core function, so the copy is
 * exactly what the preview shows.
 */
export function PromptPage({
  handle,
  project,
  detail,
  onChanged,
}: {
  handle: string;
  project: string;
  detail: PromptDetail;
  /** Reload the prompt after a save, restore or delete of a version. */
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [values, setValues] = useState<Record<string, string>>({});
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [mode, setMode] = useState<"view" | "edit" | "history" | "duplicate">("view");
  const api = `/api/projects/${handle}/${project}`;
  const itemPath = [...detail.folder, detail.slug].join("/");
  const apiVersions = `${api}/versions/${itemPath}`;
  // Folder list for "Move", loaded once per prompt page.
  const [folders] = useApi<{ folders: { path: string[]; name: string }[] }>(`${api}/folders`);

  async function moveTo(to: string[]) {
    await patch(`${api}/path/${itemPath}`, { to });
    navigate(["", handle, project, ...to, detail.slug].join("/"));
  }

  async function remove() {
    const ok = await confirm({
      title: t("prompt.delete"),
      content: t("prompt.confirmDelete", { name: detail.title }),
      confirmButtonContent: t("item.delete"),
      cancelButtonContent: t("item.cancel"),
      confirmButtonType: "danger",
    });
    if (!ok) return;
    await del(`${api}/path/${itemPath}`);
    navigate(["", handle, project, ...detail.folder].join("/"));
  }

  const { title, version } = detail;
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
      <div className="ph-toolbar">
        <Heading as="h1" className="ph-h3 ph-title ph-grow">
          {title}
        </Heading>
        <Button
          size="small"
          leadingVisual={PencilIcon}
          aria-pressed={mode === "edit"}
          onClick={() => {
            setMode(mode === "edit" ? "view" : "edit");
          }}
        >
          {t("prompt.edit")}
        </Button>
        <Button
          size="small"
          leadingVisual={HistoryIcon}
          aria-pressed={mode === "history"}
          count={detail.versionCount}
          onClick={() => {
            setMode(mode === "history" ? "view" : "history");
          }}
        >
          {t("prompt.history")}
        </Button>
        <Button
          size="small"
          leadingVisual={DuplicateIcon}
          aria-pressed={mode === "duplicate"}
          onClick={() => {
            setMode(mode === "duplicate" ? "view" : "duplicate");
          }}
        >
          {t("prompt.duplicate")}
        </Button>
        <ActionMenu>
          <ActionMenu.Button size="small" leadingVisual={FileDirectoryIcon}>
            {t("prompt.move")}
          </ActionMenu.Button>
          <ActionMenu.Overlay>
            <ActionList selectionVariant="single">
              {[
                { path: [] as string[], name: t("prompt.root") },
                ...(folders.state === "ok" ? folders.data.folders : []),
              ].map((f) => (
                <ActionList.Item
                  key={f.path.join("/")}
                  selected={f.path.join("/") === detail.folder.join("/")}
                  onSelect={() => void moveTo(f.path)}
                >
                  {f.path.length === 0 ? f.name : `${f.path.join("/")}/`}
                </ActionList.Item>
              ))}
            </ActionList>
          </ActionMenu.Overlay>
        </ActionMenu>
        <Button
          size="small"
          variant="danger"
          leadingVisual={TrashIcon}
          onClick={() => void remove()}
        >
          {t("item.delete")}
        </Button>
      </div>
      {mode === "edit" && (
        <EditPrompt
          detail={detail}
          apiItem={`${api}/path/${itemPath}`}
          apiVersions={apiVersions}
          onSaved={() => {
            setMode("view");
            onChanged();
          }}
          onCancel={() => {
            setMode("view");
          }}
        />
      )}
      {mode === "duplicate" && (
        <DuplicatePrompt
          detail={detail}
          apiCopy={`${api}/copy/${itemPath}`}
          urlPrefix={[window.location.host, handle, project, ...detail.folder].join("/")}
          onCreated={(slug) => {
            navigate(["", handle, project, ...detail.folder, slug].join("/"));
          }}
          onCancel={() => {
            setMode("view");
          }}
        />
      )}
      {mode === "history" && <History apiVersions={apiVersions} onChanged={onChanged} />}
      {mode === "view" && (
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
      )}
    </div>
  );
}
