import type { ProjectSummary } from "@prompt-hub/core";
import { PlusIcon, RepoIcon } from "@primer/octicons-react";
import { Button, Heading, Label, Spinner, Text, TextInput } from "@primer/react";
import { useState } from "react";
import { useI18n } from "../i18n";
import { navigate, RouterLink } from "../router";
import { useApi } from "../useApi";
import { CreateForm } from "./CreateForm";

/** Projects overview (mockup: dashboard): own projects, newest first, and "New project". */
export function Dashboard({ handle }: { handle: string }) {
  const { t, locale } = useI18n();
  const [loaded] = useApi<{ projects: ProjectSummary[] }>("/api/projects");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("");
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const projects = loaded.state === "ok" ? loaded.data.projects : [];
  const shown = projects.filter((p) =>
    `${p.slug} ${p.name} ${p.description}`.toLowerCase().includes(filter.trim().toLowerCase()),
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
          <Button variant="primary" leadingVisual={PlusIcon} onClick={newProject}>
            {t("dashboard.newProject")}
          </Button>
        </div>
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
        {loaded.state === "ok" && projects.length === 0 && !creating && (
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
          {shown.map((p) => (
            <article className="ph-proj-row" key={p.slug}>
              <h3>
                <RouterLink href={`/${handle}/${p.slug}`}>{p.name}</RouterLink>
                <Label>
                  {p.visibility === "PUBLIC" ? t("dashboard.public") : t("dashboard.private")}
                </Label>
              </h3>
              {p.description && <p className="ph-muted">{p.description}</p>}
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
