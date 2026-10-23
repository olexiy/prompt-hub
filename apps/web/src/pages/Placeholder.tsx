import type { Route } from "@prompt-hub/core";
import { Heading, Text } from "@primer/react";
import { useI18n } from "../i18n";
import { RouterLink } from "../router";

/** User, project and folder/prompt pages until their features land (#25 and later). */
export function Placeholder({ route }: { route: Route }) {
  const { t } = useI18n();
  let body = "";
  if (route.name === "user") body = t("placeholder.user", { handle: route.handle });
  if (route.name === "project") {
    body = t("placeholder.project", { handle: route.handle, project: route.project });
  }
  if (route.name === "item") body = t("placeholder.prompt");
  return (
    <div className="ph-blank">
      <Heading as="h1" className="ph-h2">
        {t("placeholder.title")}
      </Heading>
      <Text as="p" className="ph-muted">
        {body}
      </Text>
    </div>
  );
}

export function NotFound() {
  const { t } = useI18n();
  return (
    <div className="ph-blank">
      <Heading as="h1" className="ph-h2">
        {t("notFound.title")}
      </Heading>
      <Text as="p" className="ph-muted">
        {t("notFound.body", { path: window.location.pathname })}
      </Text>
      <RouterLink href="/">{t("notFound.home")}</RouterLink>
    </div>
  );
}
