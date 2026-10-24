import type { ProjectSummary } from "@prompt-hub/core";
import { ArchiveIcon, TrashIcon } from "@primer/octicons-react";
import { Banner, Button, FormControl, Heading, Textarea, TextInput } from "@primer/react";
import { useState } from "react";
import { ApiError, del, patch } from "../api";
import { useI18n } from "../i18n";
import { navigate } from "../router";

/**
 * Project settings (#51, mockup: project → Settings): name, URL slug and description; archive or
 * unarchive; delete for good after typing the project name. A new slug changes every URL of the
 * project, old links answer "not found".
 */
export function ProjectSettings({
  owner,
  project,
  onChanged,
  onClose,
}: {
  owner: string;
  project: ProjectSummary;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(project.name);
  const [slug, setSlug] = useState(project.slug);
  const [description, setDescription] = useState(project.description);
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = `/api/projects/${owner}/${project.slug}`;

  /** Runs one change; shows the server's message when it is refused. */
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.generic"));
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      const saved = await patch<ProjectSummary>(api, { name, slug, description });
      if (saved.slug !== project.slug) navigate(`/${owner}/${saved.slug}`);
      else onChanged();
      onClose();
    });

  const toggleArchive = () =>
    run(async () => {
      await patch(api, { archived: !project.archived });
      onChanged();
    });

  const remove = () =>
    run(async () => {
      await del(api);
      navigate("/");
    });

  return (
    <div className="ph-stack">
      {error && (
        <Banner variant="critical" title={error} hideTitle description={error} layout="compact" />
      )}
      <form
        className="ph-box ph-form ph-pad"
        aria-label={t("settings.projectTitle")}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Heading as="h2" className="ph-h2">
          {t("settings.projectTitle")}
        </Heading>
        <FormControl required>
          <FormControl.Label>{t("form.name")}</FormControl.Label>
          <TextInput
            block
            value={name}
            maxLength={100}
            onChange={(e) => {
              setName(e.target.value);
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
            {slug === project.slug
              ? t("form.slugHint", { url: `${window.location.host}/${owner}/${slug}` })
              : t("settings.slugChange", { url: `${window.location.host}/${owner}/${slug}` })}
          </FormControl.Caption>
        </FormControl>
        <FormControl>
          <FormControl.Label>{t("form.description")}</FormControl.Label>
          <Textarea
            block
            rows={3}
            value={description}
            maxLength={1000}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
          />
        </FormControl>
        <div className="ph-row">
          <Button type="submit" variant="primary" loading={busy}>
            {t("form.save")}
          </Button>
          <Button onClick={onClose}>{t("form.cancel")}</Button>
        </div>
      </form>

      <section className="ph-box ph-danger ph-form ph-pad" aria-label={t("settings.dangerZone")}>
        <Heading as="h2" className="ph-h2">
          {t("settings.dangerZone")}
        </Heading>
        <div className="ph-row ph-wrap">
          <p className="ph-grow ph-m0">
            <b>{project.archived ? t("settings.unarchive") : t("settings.archive")}</b>
            <br />
            <span className="ph-muted">
              {project.archived ? t("settings.unarchiveHint") : t("settings.archiveHint")}
            </span>
          </p>
          <Button leadingVisual={ArchiveIcon} disabled={busy} onClick={() => void toggleArchive()}>
            {project.archived ? t("settings.unarchive") : t("settings.archive")}
          </Button>
        </div>
        <form
          className="ph-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmName === project.name) void remove();
          }}
        >
          <p className="ph-m0">
            <b>{t("settings.deleteProject")}</b>
            <br />
            <span className="ph-muted">{t("settings.deleteHint")}</span>
          </p>
          <FormControl>
            <FormControl.Label>{t("settings.typeName", { name: project.name })}</FormControl.Label>
            <TextInput
              block
              autoComplete="off"
              value={confirmName}
              onChange={(e) => {
                setConfirmName(e.target.value);
              }}
            />
          </FormControl>
          <div>
            <Button
              type="submit"
              variant="danger"
              leadingVisual={TrashIcon}
              disabled={busy || confirmName !== project.name}
            >
              {t("settings.deleteProject")}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
