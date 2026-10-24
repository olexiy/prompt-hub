import { routePath, type Route, type Theme } from "@prompt-hub/core";
import { DeviceDesktopIcon, MoonIcon, SearchIcon, SunIcon } from "@primer/octicons-react";
import { ActionList, ActionMenu, Button, IconButton, TextInput } from "@primer/react";
import { Fragment } from "react";
import type { Me } from "../api";
import { useI18n } from "../i18n";
import { handleLinkClick, RouterLink } from "../router";

const NEXT_THEME: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const THEME_ICON = { system: DeviceDesktopIcon, light: SunIcon, dark: MoonIcon } as const;

/** `handle / project / folder / prompt` for the current route (mockup header). */
function Breadcrumb({ route }: { route: Route }) {
  if (route.name !== "user" && route.name !== "project" && route.name !== "item") return null;
  const parts: { label: string; href: string }[] = [
    { label: route.handle, href: routePath({ name: "user", handle: route.handle }) },
  ];
  if (route.name !== "user") {
    parts.push({ label: route.project, href: routePath({ ...route, name: "project" }) });
  }
  if (route.name === "item") {
    route.path.forEach((_, i) => {
      parts.push({
        label: route.path[i] ?? "",
        href: routePath({ ...route, path: route.path.slice(0, i + 1) }),
      });
    });
  }
  return (
    <nav className="ph-crumb" aria-label="Breadcrumb">
      {parts.map((p, i) => (
        <Fragment key={p.href}>
          {i > 0 && <span className="ph-crumb-sep">/</span>}
          <RouterLink href={p.href} aria-current={i === parts.length - 1 ? "page" : undefined}>
            {i === parts.length - 1 ? <b>{p.label}</b> : p.label}
          </RouterLink>
        </Fragment>
      ))}
    </nav>
  );
}

export function Header({
  me,
  route,
  onTheme,
  onSignOut,
}: {
  me: Me;
  route: Route;
  onTheme: (theme: Theme) => void;
  onSignOut: () => void;
}) {
  const { t } = useI18n();
  const ThemeIcon = THEME_ICON[me.theme];
  return (
    <header className="ph-header">
      <div className="ph-header-inner">
        <RouterLink href="/" className="ph-logo" aria-label={t("header.home")} muted>
          <span className="ph-logo-mark" aria-hidden="true">
            {"{ }"}
          </span>
          <span className="ph-logo-text">Prompt Hub</span>
        </RouterLink>
        <Breadcrumb route={route} />
        <TextInput
          className="ph-search"
          leadingVisual={SearchIcon}
          trailingVisual={<kbd className="ph-kbd">/</kbd>}
          placeholder={t("header.search")}
          aria-label={t("header.search")}
          title={t("header.searchSoon")}
          readOnly
        />
        <IconButton
          icon={ThemeIcon}
          variant="invisible"
          aria-label={t("header.theme", { theme: t(`theme.${me.theme}`) })}
          onClick={() => {
            onTheme(NEXT_THEME[me.theme]);
          }}
        />
        <ActionMenu>
          <ActionMenu.Anchor>
            <button type="button" className="ph-avatar" aria-label={t("header.account")}>
              {me.handle.slice(0, 1).toUpperCase()}
            </button>
          </ActionMenu.Anchor>
          <ActionMenu.Overlay align="end">
            <ActionList>
              <ActionList.GroupHeading>
                {t("menu.signedInAs", { handle: me.handle })}
              </ActionList.GroupHeading>
              <ActionList.LinkItem
                href="/settings"
                onClick={(e) => {
                  handleLinkClick(e, "/settings");
                }}
              >
                {t("menu.settings")}
              </ActionList.LinkItem>
              <ActionList.Divider />
              <ActionList.Item onSelect={onSignOut}>{t("menu.signOut")}</ActionList.Item>
            </ActionList>
          </ActionMenu.Overlay>
        </ActionMenu>
      </div>
    </header>
  );
}

/**
 * Header for a signed-out visitor of a public project (#53): logo, breadcrumb and "Sign in"
 * (the sign-in page is the app root while signed out).
 */
export function VisitorHeader({ route }: { route: Route }) {
  const { t } = useI18n();
  return (
    <header className="ph-header">
      <div className="ph-header-inner">
        <RouterLink href="/" className="ph-logo" aria-label={t("header.home")} muted>
          <span className="ph-logo-mark" aria-hidden="true">
            {"{ }"}
          </span>
          <span className="ph-logo-text">Prompt Hub</span>
        </RouterLink>
        <Breadcrumb route={route} />
        <span className="ph-grow" />
        <Button
          as="a"
          href="/"
          size="small"
          onClick={(e: React.MouseEvent<HTMLElement>) => {
            handleLinkClick(e, "/");
          }}
        >
          {t("auth.signIn")}
        </Button>
      </div>
    </header>
  );
}
