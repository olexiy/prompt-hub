import { highlightParts, type PromptHit, type SearchResults } from "@prompt-hub/core";
import { FileIcon, RepoIcon, SearchIcon } from "@primer/octicons-react";
import { Button, Heading, Spinner } from "@primer/react";
import { useState } from "react";
import { get } from "../api";
import { useI18n } from "../i18n";
import { RouterLink } from "../router";
import { TagChips } from "../shell/Tags";
import { useApi } from "../useApi";

/** Text with the words that start with a query word marked; React escapes everything. */
function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, i) =>
        part.match ? <mark key={i}>{part.text}</mark> : part.text,
      )}
    </>
  );
}

/**
 * `/search?q=` (#55): own projects and prompts matching every word of the query as a word
 * prefix, prompts ranked by title, topics and live text, 20 at a time.
 */
export function SearchPage({ handle, query }: { handle: string; query: string }) {
  const { t } = useI18n();
  const url = `/api/search?q=${encodeURIComponent(query)}`;
  const [loaded] = useApi<SearchResults>(query.trim() ? url : null);
  // Further pages for this query, appended below the first one.
  const [more, setMore] = useState<{ query: string; pages: SearchResults[] }>({
    query,
    pages: [],
  });
  const [busy, setBusy] = useState(false);
  const extra = more.query === query ? more.pages : [];

  if (!query.trim()) {
    return (
      <div className="ph-blank">
        <SearchIcon size={24} />
        <p className="ph-muted">{t("search.hint")}</p>
      </div>
    );
  }
  if (loaded.state === "loading") {
    return (
      <div className="ph-center">
        <Spinner />
      </div>
    );
  }
  if (loaded.state !== "ok") return <p className="ph-muted">{t("error.load")}</p>;

  const first = loaded.data;
  const pages = [first, ...extra];
  const prompts: PromptHit[] = pages.flatMap((p) => p.prompts);
  const last = pages.at(-1) ?? first;

  async function loadMore() {
    setBusy(true);
    try {
      const next = await get<SearchResults>(`${url}&page=${String(last.page + 1)}`);
      setMore({ query, pages: [...extra, next] });
    } finally {
      setBusy(false);
    }
  }

  const nothing = first.projects.length === 0 && prompts.length === 0;
  return (
    <div className="ph-stack ph-search-page">
      <Heading as="h1" className="ph-h2">
        {t("search.results", { query })}
      </Heading>
      {nothing && <p className="ph-muted">{t("search.none", { query })}</p>}
      {first.projects.length > 0 && (
        <section className="ph-box" aria-label={t("search.projects")}>
          <div className="ph-box-head">
            <b>{t("search.projects")}</b>
          </div>
          {first.projects.map((p) => (
            <div className="ph-search-hit" key={p.slug}>
              <span className="ph-file">
                <RepoIcon />
                <RouterLink href={`/${handle}/${p.slug}`}>
                  <Highlighted text={p.name} query={query} />
                </RouterLink>
              </span>
              {p.description && (
                <p className="ph-muted ph-m0">
                  <Highlighted text={p.description} query={query} />
                </p>
              )}
              <TagChips tags={p.tags} />
            </div>
          ))}
        </section>
      )}
      {prompts.length > 0 && (
        <section className="ph-box" aria-label={t("search.prompts")}>
          <div className="ph-box-head">
            <b>{t("search.prompts")}</b>
          </div>
          {prompts.map((hit) => {
            const href = ["", handle, hit.project, ...hit.folder, hit.slug].join("/");
            return (
              <div className="ph-search-hit" key={href}>
                <span className="ph-file">
                  <FileIcon />
                  <RouterLink href={href}>
                    <Highlighted text={hit.title} query={query} />
                  </RouterLink>
                </span>
                <span className="ph-muted ph-small ph-mono">
                  {[hit.project, ...hit.folder].join(" / ")}
                </span>
                {hit.snippet && (
                  <p className="ph-search-snippet ph-m0">
                    <Highlighted text={hit.snippet} query={query} />
                  </p>
                )}
                <TagChips tags={hit.tags} />
              </div>
            );
          })}
        </section>
      )}
      {last.hasMore && (
        <div>
          <Button loading={busy} onClick={() => void loadMore()}>
            {t("search.more")}
          </Button>
        </div>
      )}
    </div>
  );
}
