import type { ProjectItem } from "@prompt-hub/core";
import { Spinner } from "@primer/react";
import { useI18n } from "../i18n";
import { useApi } from "../useApi";
import { FolderView } from "./FolderView";
import { NotFound } from "./Placeholder";
import { PromptPage } from "./PromptPage";

/**
 * Everything under `/{handle}/{project}`: the API resolves the path to the project root, a folder
 * or a prompt, and this page shows the matching view.
 */
export function ItemPage({
  handle,
  project,
  path,
}: {
  handle: string;
  project: string;
  path: string[];
}) {
  const { t } = useI18n();
  const base = `/api/projects/${handle}/${project}`;
  const [loaded, reload] = useApi<ProjectItem>(
    path.length === 0 ? base : `${base}/path/${path.join("/")}`,
  );

  if (loaded.state === "loading") {
    return (
      <div className="ph-center">
        <Spinner />
      </div>
    );
  }
  if (loaded.state === "notFound") return <NotFound />;
  if (loaded.state === "error") return <p className="ph-muted">{t("error.load")}</p>;
  return loaded.data.kind === "folder" ? (
    <FolderView listing={loaded.data} onChanged={reload} />
  ) : (
    <PromptPage handle={handle} project={project} detail={loaded.data} onChanged={reload} />
  );
}
