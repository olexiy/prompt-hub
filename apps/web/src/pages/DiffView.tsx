import { diffHunks, type DiffLine, type VersionDetail, type WordPart } from "@prompt-hub/core";
import { DiffIcon } from "@primer/octicons-react";
import { Fragment } from "react";
import { useI18n } from "../i18n";

function Words({ parts, tag }: { parts: WordPart[] | undefined; tag: "del" | "ins" }) {
  if (!parts) return null;
  return (
    <>
      {parts.map((p, i) =>
        p.changed ? (
          tag === "del" ? (
            <del key={i}>{p.text}</del>
          ) : (
            <ins key={i}>{p.text}</ins>
          )
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}

function Line({ line }: { line: DiffLine }) {
  const sign = line.kind === "del" ? "-" : line.kind === "add" ? "+" : " ";
  return (
    <tr className={`ph-diff-${line.kind}`}>
      <td className="ph-diff-n">{line.kind === "add" ? "" : line.oldNo}</td>
      <td className="ph-diff-n">{line.kind === "del" ? "" : line.newNo}</td>
      <td className="ph-diff-text">
        <span aria-hidden="true">{sign} </span>
        {line.kind === "same" ? (
          line.text
        ) : line.words ? (
          <Words parts={line.words} tag={line.kind === "del" ? "del" : "ins"} />
        ) : (
          line.text
        )}
      </td>
    </tr>
  );
}

/** What changed from `from` to `to` (mockup: history diff): text hunks and variable changes. */
export function DiffView({ from, to }: { from: VersionDetail; to: VersionDetail }) {
  const { t } = useI18n();
  const hunks = diffHunks(from.body, to.body);
  const changed = hunks.flatMap((h) => h.lines).filter((l) => l.kind !== "same").length;
  const before = new Map(from.variables.map((v) => [v.name, v]));
  const after = new Map(to.variables.map((v) => [v.name, v]));
  const added = [...after.keys()].filter((n) => !before.has(n));
  const removed = [...before.keys()].filter((n) => !after.has(n));
  const changedDefaults = [...after.values()].filter(
    (v) => before.has(v.name) && (before.get(v.name)?.default ?? "") !== (v.default ?? ""),
  );

  return (
    <div className="ph-box" data-testid="diff">
      <div className="ph-box-head">
        <DiffIcon />
        <b>
          v{from.number} → v{to.number}
        </b>
        <span className="ph-muted">{t("diff.linesChanged", { count: String(changed) })}</span>
      </div>
      {hunks.length === 0 && <p className="ph-muted ph-pad">{t("diff.sameText")}</p>}
      {hunks.length > 0 && (
        <div className="ph-diff-scroll">
          <table className="ph-diff">
            <tbody>
              {hunks.map((h, i) => (
                <Fragment key={i}>
                  {i > 0 && (
                    <tr className="ph-diff-hunk">
                      <td colSpan={3}>…</td>
                    </tr>
                  )}
                  {h.lines.map((l, k) => (
                    <Line key={k} line={l} />
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(added.length > 0 || removed.length > 0 || changedDefaults.length > 0) && (
        <ul className="ph-diff-vars ph-small">
          {added.map((n) => (
            <li key={`a-${n}`}>{t("diff.varAdded", { name: n })}</li>
          ))}
          {removed.map((n) => (
            <li key={`r-${n}`}>{t("diff.varRemoved", { name: n })}</li>
          ))}
          {changedDefaults.map((v) => (
            <li key={`d-${v.name}`}>
              {t("diff.varDefault", {
                name: v.name,
                from: before.get(v.name)?.default ?? "—",
                to: v.default ?? "—",
              })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
