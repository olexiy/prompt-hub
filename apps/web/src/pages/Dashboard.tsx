import { PlusIcon, RepoIcon } from "@primer/octicons-react";
import { Button, Heading, Text, TextInput } from "@primer/react";
import { useI18n } from "../i18n";

/**
 * Projects overview (mockup: dashboard). Projects arrive with #25, so for now the lists are
 * empty and "New" is disabled; the layout is final.
 */
export function Dashboard() {
  const { t } = useI18n();
  const soon = t("dashboard.soon");
  return (
    <div className="ph-dash">
      <aside className="ph-side">
        <div className="ph-side-head">
          <Heading as="h2" className="ph-h2">
            {t("dashboard.projects")}
          </Heading>
          <Button size="small" variant="primary" leadingVisual={PlusIcon} disabled title={soon}>
            {t("dashboard.new")}
          </Button>
        </div>
        <TextInput
          block
          placeholder={t("dashboard.findProject")}
          aria-label={t("dashboard.findProject")}
          disabled
        />
      </aside>
      <section className="ph-main-col" aria-label={t("dashboard.projects")}>
        <div className="ph-toolbar">
          <TextInput
            className="ph-grow"
            placeholder={t("dashboard.filter")}
            aria-label={t("dashboard.filter")}
            disabled
          />
          <Button variant="primary" leadingVisual={PlusIcon} disabled title={soon}>
            {t("dashboard.newProject")}
          </Button>
        </div>
        <div className="ph-blank">
          <RepoIcon size={24} />
          <Heading as="h3" className="ph-h3">
            {t("dashboard.emptyTitle")}
          </Heading>
          <Text as="p" className="ph-muted">
            {t("dashboard.emptyBody")}
          </Text>
        </div>
      </section>
    </div>
  );
}
