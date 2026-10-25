import type { VersionDetail, VersionSummary } from "@prompt-hub/core";
import { HistoryIcon } from "@primer/octicons-react";
import { Button, Label, Spinner, useConfirm } from "@primer/react";
import { useState } from "react";
import { ApiError, del, get, post } from "../api";
import { useI18n } from "../i18n";
import { useApi } from "../useApi";
import { DiffView } from "./DiffView";

/**
 * Version history of a prompt (mockup: history): newest first, the live one marked; view an old
 * version, restore it as the newest, or delete it for good.
 */
export function History({
  apiVersions,
  onChanged,
}: {
  apiVersions: string;
  onChanged: () => void;
}) {
  const { t, locale } = useI18n();
  const confirm = useConfirm();
  const [loaded, reload] = useApi<{ versions: VersionSummary[] }>(apiVersions);
  const [open, setOpen] = useState<VersionDetail | null>(null);
  const [diff, setDiff] = useState<{
    from: VersionDetail;
    to: VersionDetail;
    /** Which button opened it: the row's number and whether it compares with the live one. */
    key: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  async function act(run: () => Promise<unknown>) {
    setError(null);
    try {
      await run();
      setOpen(null);
      setDiff(null);
      reload();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.generic"));
    }
  }

  async function remove(n: number) {
    const ok = await confirm({
      title: t("history.delete"),
      content: t("history.confirmDelete", { n: String(n) }),
      confirmButtonContent: t("item.delete"),
      cancelButtonContent: t("item.cancel"),
      confirmButtonType: "danger",
    });
    if (ok) await act(() => del(`${apiVersions}?n=${String(n)}`));
  }

  /** The next older version's number, if any. */
  const older = (n: number) =>
    loaded.state === "ok" ? loaded.data.versions.find((x) => x.number < n)?.number : undefined;

  /** The live version's number. */
  const live =
    loaded.state === "ok" ? loaded.data.versions.find((x) => x.current)?.number : undefined;

  /**
   * Toggles a diff: version `n` against the one before it, or (`withLive`) against the live
   * version, so an old version can be compared with the current one (#38).
   */
  async function showDiff(n: number, withLive = false) {
    const key = `${String(n)}${withLive ? ":live" : ""}`;
    if (diff?.key === key) {
      setDiff(null);
      return;
    }
    const base = withLive ? n : older(n);
    const target = withLive ? live : n;
    if (base === undefined || target === undefined) return;
    const [from, to] = await Promise.all([
      get<VersionDetail>(`${apiVersions}?n=${String(base)}`),
      get<VersionDetail>(`${apiVersions}?n=${String(target)}`),
    ]);
    setOpen(null);
    setDiff({ from, to, key });
  }

  if (loaded.state === "loading") {
    return (
      <div className="ph-center">
        <Spinner />
      </div>
    );
  }
  if (loaded.state !== "ok") return <p className="ph-muted">{t("error.load")}</p>;

  return (
    <div className="ph-stack">
      <p className="ph-muted ph-small">
        <HistoryIcon /> {t("history.onlyYou")}
      </p>
      {error && <p className="ph-warn">{error}</p>}
      <div className="ph-box">
        {loaded.data.versions.map((v) => (
          <div className="ph-box-row ph-commit" key={v.number}>
            <div className="ph-main-col">
              <b>v{v.number}</b>
              {v.message && <> · {v.message}</>}
              <div className="ph-muted ph-small">{when.format(new Date(v.createdAt))}</div>
            </div>
            <span>{v.current && <Label variant="success">{t("prompt.live")}</Label>}</span>
            <span className="ph-row">
              {older(v.number) !== undefined && (
                <Button
                  size="small"
                  aria-label={t("diff.button", { n: String(v.number) })}
                  aria-pressed={diff?.key === String(v.number)}
                  onClick={() => void showDiff(v.number)}
                >
                  {t("diff.short")}
                </Button>
              )}
              {!v.current && (
                <Button
                  size="small"
                  aria-pressed={diff?.key === `${String(v.number)}:live`}
                  onClick={() => void showDiff(v.number, true)}
                >
                  {t("diff.withLive")}
                </Button>
              )}
              <Button
                size="small"
                aria-expanded={open?.number === v.number}
                onClick={() => {
                  setDiff(null);
                  if (open?.number === v.number) setOpen(null);
                  else
                    void get<VersionDetail>(`${apiVersions}?n=${String(v.number)}`).then(setOpen);
                }}
              >
                {open?.number === v.number ? t("history.hide") : t("history.view")}
              </Button>
              {!v.current && (
                <Button
                  size="small"
                  onClick={() => void act(() => post(apiVersions, { restore: v.number }))}
                >
                  {t("history.restore")}
                </Button>
              )}
              {loaded.data.versions.length > 1 && (
                <Button
                  size="small"
                  variant="danger"
                  aria-label={t("history.deleteN", { n: String(v.number) })}
                  onClick={() => void remove(v.number)}
                >
                  {t("item.delete")}
                </Button>
              )}
            </span>
          </div>
        ))}
      </div>
      {diff && <DiffView from={diff.from} to={diff.to} />}
      {open && (
        <div className="ph-box">
          <div className="ph-box-head">
            <b>v{open.number}</b>
            <span className="ph-muted">{open.message}</span>
          </div>
          <pre className="ph-prompt-body" data-testid="version-body">
            {open.body}
          </pre>
        </div>
      )}
    </div>
  );
}
