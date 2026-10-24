import type { ProjectBundle, ProjectSummary } from "@prompt-hub/core";
import { ArchiveIcon, PlusIcon, RepoIcon, UploadIcon } from "@primer/octicons-react";
import { Button, Heading, Label, Spinner, Text, TextInput } from "@primer/react";
import { useRef, useState } from "react";
import { useI18n } from "../i18n";
import { navigate, RouterLink } from "../router";
import { useApi } from "../useApi";
import { TagChips, TagFilter } from "../shell/Tags";
import { CreateForm } from "./CreateForm";
import { ImportProject, readZipFile } from "./ImportProject";

/**
 * Projects overview (mockup: dashboard): own projects, newest first, and "New project". The
 * "Archived" toggle (#51) lists the archived projects instead.
 */
export function Dashboard({ handle }: { handle: string }) {
  const { t, locale } = useI18n();
  const [archived, setArchived] = useState(false);
  const [loaded] = useApi<{ projects: ProjectSummary[] }>(
    archived ? "/api/projects?archived=1" : "/api/projects",
  );
  const [creating, setCreating] = useState(false);
  // A project archive read for import (#57), shown as a preview until confirmed.
  const [archive, setArchive] = useState<{ bundle: ProjectBundle; skipped: string[] } | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const zipPicker = useRef<HTMLInputElement>(null);

  async function importZip(file: File | undefined) {
    if (!file) return;
    const result = await readZipFile(file);
    if ("error" in result) {
      setArchive(null);
      setZipError(t(result.error, { name: file.name, detail: result.detail }));
      return;
    }
    setZipError(null);
    setCreating(false);
    setArchive(result);
  }
  const [filter, setFilter] = useState("");
  // A clicked topic chip (#54); combines with the text filter.
  const [tag, setTag] = useState<string | null>(null);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const projects = loaded.state === "ok" ? loaded.data.projects : [];
  const shown = projects.filter(
    (p) =>
      (tag === null || p.tags.includes(tag)) &&
      `${p.slug} ${p.name} ${p.description} ${p.tags.join(" ")}`
        .toLowerCase()
        .includes(filter.trim().toLowerCase()),
  );
  const newProject = () => {
    setCreating(true);
  };

  return (
    <div className="ph-dash">
      <aside className="ph-side">
        <div className="ph-side-head">
          <Heading as="h2" className="ph-h2">
            {t("dashboard.projects")}
          </Heading>
          <Button size="small" variant="primary" leadingVisual={PlusIcon} onClick={newProject}>
            {t("dashboard.new")}
          </Button>
        </div>
        <ul className="ph-side-list">
          {projects.map((p) => (
            <li key={p.slug}>
              <RouterLink href={`/${handle}/${p.slug}`}>
                {handle}/{p.slug}
              </RouterLink>
            </li>
          ))}
        </ul>
      </aside>
      <section className="ph-main-col" aria-label={t("dashboard.projects")}>
        <div className="ph-toolbar">
          <TextInput
            className="ph-grow"
            placeholder={t("dashboard.filter")}
            aria-label={t("dashboard.filter")}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
            }}
          />
          <Button
            leadingVisual={ArchiveIcon}
            aria-pressed={archived}
            onClick={() => {
              setArchived(!archived);
            }}
          >
            {t("dashboard.showArchived")}
          </Button>
          <input
            ref={zipPicker}
            type="file"
            hidden
            accept=".zip,application/zip"
            aria-label={t("zip.pick")}
            onChange={(e) => {
              void importZip(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button
            leadingVisual={UploadIcon}
            onClick={() => {
              zipPicker.current?.click();
            }}
          >
            {t("zip.import")}
          </Button>
          <Button variant="primary" leadingVisual={PlusIcon} onClick={newProject}>
            {t("dashboard.newProject")}
          </Button>
        </div>
        {zipError && <p className="ph-warn">{zipError}</p>}
        {archive && (
          <div className="ph-mt">
            <ImportProject
              bundle={archive.bundle}
              skipped={archive.skipped}
              urlPrefix={`${window.location.host}/${handle}`}
              onCreated={(slug) => {
                navigate(`/${handle}/${slug}`);
              }}
              onCancel={() => {
                setArchive(null);
              }}
            />
          </div>
        )}
        {creating && (
          <div className="ph-mt">
            <CreateForm
              kind="project"
              action="/api/projects"
              urlPrefix={`${window.location.host}/${handle}`}
              onCreated={(slug) => {
                navigate(`/${handle}/${slug}`);
              }}
              onCancel={() => {
                setCreating(false);
              }}
            />
          </div>
        )}
        {loaded.state === "loading" && (
          <div className="ph-center">
            <Spinner />
          </div>
        )}
        {loaded.state === "error" && <p className="ph-muted">{t("error.load")}</p>}
        {loaded.state === "ok" && archived && projects.length === 0 && (
          <p className="ph-muted">{t("dashboard.noArchived")}</p>
        )}
        {loaded.state === "ok" && !archived && projects.length === 0 && !creating && (
          <div className="ph-blank">
            <RepoIcon size={24} />
            <Heading as="h3" className="ph-h3">
              {t("dashboard.emptyTitle")}
            </Heading>
            <Text as="p" className="ph-muted">
              {t("dashboard.emptyBody")}
            </Text>
          </div>
        )}
        <div className="ph-mt">
          {tag && (
            <TagFilter
              tag={tag}
              onClear={() => {
                setTag(null);
              }}
            />
          )}
          {shown.map((p) => (
            <article className="ph-proj-row" key={p.slug}>
              <h3>
                <RouterLink href={`/${handle}/${p.slug}`}>{p.name}</RouterLink>
                <Label>
                  {p.visibility === "PUBLIC" ? t("dashboard.public") : t("dashboard.private")}
                </Label>
                {p.archived && <Label variant="attention">{t("project.archived")}</Label>}
              </h3>
              {p.description && <p className="ph-muted">{p.description}</p>}
              <TagChips tags={p.tags} active={tag} onSelect={setTag} />
              <div className="ph-meta-line">
                <span>{t("dashboard.promptCount", { count: String(p.promptCount) })}</span>
                <span>{t("dashboard.updated", { date: date.format(new Date(p.updatedAt)) })}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
