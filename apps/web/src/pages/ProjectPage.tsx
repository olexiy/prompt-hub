import type { ProjectDetail } from "@prompt-hub/core";
import { FileIcon, PlusIcon } from "@primer/octicons-react";
import { Button, Heading, Label, Spinner } from "@primer/react";
import { useState } from "react";
import { useI18n } from "../i18n";
import { navigate, RouterLink } from "../router";
import { useApi } from "../useApi";
import { CreateForm } from "./CreateForm";
import { NotFound } from "./Placeholder";

/** `/{handle}/{project}` (mockup: project): the prompt list, "New prompt" and About. */
export function ProjectPage({ handle, project }: { handle: string; project: string }) {
  const { t, locale } = useI18n();
  const base = `/api/projects/${handle}/${project}`;
  const loaded = useApi<ProjectDetail>(base);
  const [creating, setCreating] = useState(false);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  if (loaded.state === "loading") {
    return (
      <div className="ph-center">
        <Spinner />
      </div>
    );
  }
  if (loaded.state === "notFound") return <NotFound />;
  if (loaded.state === "error") return <p className="ph-muted">{t("error.load")}</p>;
  const p = loaded.data;

  return (
    <div className="ph-proj">
      <div className="ph-main-col ph-stack">
        <div className="ph-toolbar">
          <Heading as="h1" className="ph-h2 ph-grow">
            {t("project.prompts")}
          </Heading>
          <Button
            variant="primary"
            leadingVisual={PlusIcon}
            onClick={() => {
              setCreating(true);
            }}
          >
            {t("project.newPrompt")}
          </Button>
        </div>
        {creating && (
          <CreateForm
            kind="prompt"
            action={`${base}/prompts`}
            urlPrefix={`${window.location.host}/${handle}/${project}`}
            onCreated={(slug) => {
              navigate(`/${handle}/${project}/${slug}`);
            }}
            onCancel={() => {
              setCreating(false);
            }}
          />
        )}
        <div className="ph-box">
          {p.prompts.length === 0 && <p className="ph-muted ph-pad">{t("project.empty")}</p>}
          {p.prompts.map((q) => (
            <div className="ph-box-row" key={q.slug}>
              <span className="ph-file">
                <FileIcon />
                <RouterLink href={`/${handle}/${project}/${q.slug}`}>{q.title}</RouterLink>
              </span>
              <span className="ph-muted ph-mono ph-hide-sm">{q.slug}</span>
              <span className="ph-muted">{date.format(new Date(q.updatedAt))}</span>
            </div>
          ))}
        </div>
      </div>
      <aside className="ph-about">
        <Heading as="h2" className="ph-h2">
          {t("project.about")}
        </Heading>
        <p className="ph-muted">
          <b>{p.name}</b>
          <br />
          {p.description || t("project.noDescription")}
        </p>
        <dl>
          <dt>{t("project.visibility")}</dt>
          <dd>
            <Label>
              {p.visibility === "PUBLIC" ? t("dashboard.public") : t("dashboard.private")}
            </Label>
          </dd>
          <dt>{t("project.prompts")}</dt>
          <dd>{p.promptCount}</dd>
          <dt>{t("project.owner")}</dt>
          <dd>{p.owner}</dd>
        </dl>
      </aside>
    </div>
  );
}
