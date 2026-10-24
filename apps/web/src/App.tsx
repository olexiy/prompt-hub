import { parseRoute, pickLocale, type Locale, type Theme } from "@prompt-hub/core";
import { BaseStyles, Spinner } from "@primer/react";
import { ThemeProvider } from "@primer/react/next";
import { useEffect, useState, type ReactNode } from "react";
import { get, patch, post, type Me } from "./api";
import { ResetCallback } from "./auth/ResetCallback";
import { SignIn } from "./auth/SignIn";
import { I18nProvider } from "./i18n";
import { Dashboard } from "./pages/Dashboard";
import { NotFound, Placeholder } from "./pages/Placeholder";
import { ItemPage } from "./pages/ItemPage";
import { SearchPage } from "./pages/SearchPage";
import { Settings } from "./pages/Settings";
import { usePathname, useQueryParam } from "./router";
import { Header, VisitorHeader } from "./shell/Header";
import { StaleBanner } from "./shell/StaleBanner";

type Session = { kind: "loading" } | { kind: "signed-out" } | { kind: "signed-in"; me: Me };

/** Current session; the API renews an expired access token from the refresh cookie itself. */
async function resolveSession(): Promise<Session> {
  try {
    const { user } = await get<{ user: Me | null }>("/api/auth/session");
    return user ? { kind: "signed-in", me: user } : { kind: "signed-out" };
  } catch {
    return { kind: "signed-out" };
  }
}

const COLOR_MODE = { system: "auto", light: "light", dark: "dark" } as const;

/** Theme and language for the whole tree: the user's choice, or the browser's before sign-in. */
function Frame({ locale, theme, children }: { locale: Locale; theme: Theme; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <ThemeProvider colorMode={COLOR_MODE[theme]}>
      {/* Theme variables live on the provider's element, so it paints the page background itself. */}
      <BaseStyles className="ph-root">
        <I18nProvider locale={locale}>
          <StaleBanner />
          {children}
        </I18nProvider>
      </BaseStyles>
    </ThemeProvider>
  );
}

/** Session gate, then the app shell: header plus the page for the current URL. */
export function App() {
  const pathname = usePathname();
  const searchQuery = useQueryParam("q");
  const route = parseRoute(pathname);
  const [session, setSession] = useState<Session>({ kind: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (route.name === "resetCallback") return;
    let current = true;
    void resolveSession().then((s) => {
      if (current) setSession(s);
    });
    return () => {
      current = false;
    };
  }, [version, route.name]);

  const browserLocale = pickLocale(navigator.languages);
  const me = session.kind === "signed-in" ? session.me : null;
  const locale = me?.locale ?? browserLocale;
  const theme = me?.theme ?? "system";

  /** Applies the change at once and saves it; rolls back if the API refuses. */
  async function savePrefs(changes: Partial<Pick<Me, "locale" | "theme">>) {
    if (!me) return;
    setSession({ kind: "signed-in", me: { ...me, ...changes } });
    try {
      setSession({ kind: "signed-in", me: await patch<Me>("/api/me", changes) });
    } catch (err) {
      setSession({ kind: "signed-in", me });
      throw err;
    }
  }

  let content: ReactNode;
  if (route.name === "resetCallback") {
    content = (
      <ResetCallback
        onDone={() => {
          window.location.assign("/");
        }}
      />
    );
  } else if (session.kind === "loading") {
    content = (
      <main className="ph-center">
        <Spinner />
      </main>
    );
  } else if (!me && (route.name === "project" || route.name === "item")) {
    // A signed-out visitor: public projects read-only (#53), anything else is "not found".
    content = (
      <>
        <VisitorHeader route={route} />
        <main className="ph-page">
          <ItemPage
            key={pathname}
            access="public"
            handle={route.handle}
            project={route.project}
            path={route.name === "item" ? route.path : []}
          />
        </main>
      </>
    );
  } else if (!me) {
    content = (
      <SignIn
        onSignedIn={() => {
          setVersion((v) => v + 1);
        }}
      />
    );
  } else {
    let page: ReactNode;
    if (route.name === "home") page = <Dashboard handle={me.handle} />;
    else if (route.name === "settings") page = <Settings me={me} onSave={savePrefs} />;
    else if (route.name === "search") page = <SearchPage handle={me.handle} query={searchQuery} />;
    else if (route.name === "notFound") page = <NotFound />;
    else if (route.name === "project" || route.name === "item") {
      // The project root, a folder or a prompt: the API resolves the path.
      page = (
        <ItemPage
          key={pathname}
          access={route.handle === me.handle ? "owner" : "public"}
          handle={route.handle}
          project={route.project}
          path={route.name === "item" ? route.path : []}
        />
      );
    } else page = <Placeholder route={route} />;
    content = (
      <>
        <Header
          me={me}
          route={route}
          onTheme={(next) => {
            void savePrefs({ theme: next }).catch(() => undefined);
          }}
          onSignOut={() => {
            void post("/api/auth/sign-out").finally(() => {
              setSession({ kind: "signed-out" });
            });
          }}
        />
        <main className="ph-page">{page}</main>
      </>
    );
  }

  return (
    <Frame locale={locale} theme={theme}>
      {content}
    </Frame>
  );
}
