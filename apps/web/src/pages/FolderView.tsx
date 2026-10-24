import type { FolderListing } from "@prompt-hub/core";
import { FileDirectoryFillIcon, FileIcon, GearIcon, PlusIcon } from "@primer/octicons-react";
import { Banner, Button, Heading, Label, TextInput, useConfirm } from "@primer/react";
import { useState } from "react";
import { ApiError, del, patch } from "../api";
import { useI18n } from "../i18n";
import { navigate, RouterLink } from "../router";
import { CreateForm } from "./CreateForm";
import { ProjectSettings } from "./ProjectSettings";

/**
 * A project root (`path: []`, mockup: project) or a folder: subfolders, prompts, "New folder",
 * "New prompt"; a folder can be renamed or deleted. The About box and the project Settings
 * (#51) show on the root only.
 */
export function FolderView({
  listing,
  onChanged,
}: {
  listing: FolderListing;
  onChanged: () => void;
}) {
  const { t, locale } = useI18n();
  const confirm = useConfirm();
  const [creating, setCreating] = useState<"folder" | "prompt" | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [settings, setSettings] = useState(false);
  const [newName, setNewName] = useState(listing.name);
  const [error, setError] = useState<string | null>(null);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const { owner, project, path } = listing;
  const projectUrl = `/${owner}/${project.slug}`;
  const here = [projectUrl, ...path].join("/");
  const api = `/api/projects/${owner}/${project.slug}`;
  const isRoot = path.length === 0;

  async function rename() {
    try {
      await patch(`${api}/path/${path.join("/")}`, { name: newName });
      setRenaming(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.generic"));
    }
  }

  async function remove() {
    const ok = await confirm({
      title: t("folder.delete"),
      content: t("folder.confirmDelete", { name: listing.name }),
      confirmButtonContent: t("item.delete"),
      cancelButtonContent: t("item.cancel"),
      confirmButtonType: "danger",
    });
    if (!ok) return;
    await del(`${api}/path/${path.join("/")}`);
    navigate([projectUrl, ...path.slice(0, -1)].join("/"));
  }

  return (
    <div className={isRoot ? "ph-proj" : "ph-stack"}>
      <div className="ph-main-col ph-stack">
        {isRoot && project.archived && (
          <Banner
            variant="info"
            title={t("project.archived")}
            hideTitle
            description={t("project.archivedNote")}
            layout="compact"
          />
        )}
        {settings ? (
          <ProjectSettings
            owner={owner}
            project={project}
            onChanged={onChanged}
            onClose={() => {
              setSettings(false);
            }}
          />
        ) : (
          <>
            <div className="ph-toolbar">
              {renaming ? (
                <form
                  className="ph-row ph-grow"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void rename();
                  }}
                >
                  <TextInput
                    className="ph-grow"
                    aria-label={t("form.name")}
                    value={newName}
                    maxLength={100}
                    onChange={(e) => {
                      setNewName(e.target.value);
                    }}
                  />
                  <Button type="submit" variant="primary">
                    {t("folder.save")}
                  </Button>
                  <Button
                    onClick={() => {
                      setRenaming(false);
                    }}
                  >
                    {t("item.cancel")}
                  </Button>
                </form>
              ) : (
                <Heading as="h1" className="ph-h2 ph-grow">
                  {isRoot ? t("project.prompts") : listing.name}
                </Heading>
              )}
              {isRoot && (
                <Button
                  size="small"
                  leadingVisual={GearIcon}
                  onClick={() => {
                    setSettings(true);
                  }}
                >
                  {t("project.settings")}
                </Button>
              )}
              {!isRoot && !renaming && (
                <>
                  <Button
                    size="small"
                    onClick={() => {
                      setRenaming(true);
                    }}
                  >
                    {t("folder.rename")}
                  </Button>
                  <Button size="small" variant="danger" onClick={() => void remove()}>
                    {t("folder.delete")}
                  </Button>
                </>
              )}
            </div>
            {error && <p className="ph-warn">{error}</p>}
            <div className="ph-toolbar">
              <span className="ph-grow" />
              <Button
                leadingVisual={FileDirectoryFillIcon}
                onClick={() => {
                  setCreating("folder");
                }}
              >
                {t("folder.new")}
              </Button>
              <Button
                variant="primary"
                leadingVisual={PlusIcon}
                onClick={() => {
                  setCreating("prompt");
                }}
              >
                {t("project.newPrompt")}
              </Button>
            </div>
            {creating && (
              <CreateForm
                key={creating}
                kind={creating}
                action={`${api}/${creating === "folder" ? "folders" : "prompts"}`}
                extra={creating === "folder" ? { parent: path } : { folder: path }}
                urlPrefix={`${window.location.host}${here}`}
                onCreated={(slug) => {
                  navigate(`${here}/${slug}`);
                }}
                onCancel={() => {
                  setCreating(null);
                }}
              />
            )}
            <div className="ph-box">
              {listing.folders.length === 0 && listing.prompts.length === 0 && (
                <p className="ph-muted ph-pad">{isRoot ? t("project.empty") : t("folder.empty")}</p>
              )}
              {listing.folders.map((f) => (
                <div className="ph-box-row" key={`f-${f.slug}`}>
                  <span className="ph-file ph-folder-icon">
                    <FileDirectoryFillIcon />
                    <RouterLink href={`${here}/${f.slug}`}>{f.name}</RouterLink>
                  </span>
                  <span className="ph-muted ph-mono ph-hide-sm">{f.slug}/</span>
                  <span />
                </div>
              ))}
              {listing.prompts.map((q) => (
                <div className="ph-box-row" key={`p-${q.slug}`}>
                  <span className="ph-file">
                    <FileIcon />
                    <RouterLink href={`${here}/${q.slug}`}>{q.title}</RouterLink>
                  </span>
                  <span className="ph-muted ph-mono ph-hide-sm">{q.slug}</span>
                  <span className="ph-muted">{date.format(new Date(q.updatedAt))}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {isRoot && (
        <aside className="ph-about">
          <Heading as="h2" className="ph-h2">
            {t("project.about")}
          </Heading>
          <p className="ph-muted">
            <b>{project.name}</b>
            <br />
            {project.description || t("project.noDescription")}
          </p>
          <dl>
            <dt>{t("project.visibility")}</dt>
            <dd>
              <Label>
                {project.visibility === "PUBLIC" ? t("dashboard.public") : t("dashboard.private")}
              </Label>{" "}
              {project.archived && <Label variant="attention">{t("project.archived")}</Label>}
            </dd>
            <dt>{t("project.prompts")}</dt>
            <dd>{project.promptCount}</dd>
            <dt>{t("project.owner")}</dt>
            <dd>{owner}</dd>
          </dl>
        </aside>
      )}
    </div>
  );
}
