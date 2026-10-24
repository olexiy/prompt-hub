import { isTagName, MAX_TAGS, normalizeTag } from "@prompt-hub/core";
import { PencilIcon, XIcon } from "@primer/octicons-react";
import { Banner, Button, IconButton, TextInput } from "@primer/react";
import { useState } from "react";
import { ApiError, patch } from "../api";
import { useI18n } from "../i18n";

/**
 * Topic chips (#54, mockup `.topics`). With `onSelect` each chip is a button that filters by the
 * tag; `active` marks the tag currently filtered on.
 */
export function TagChips({
  tags,
  active,
  onSelect,
}: {
  tags: readonly string[];
  active?: string | null;
  onSelect?: (tag: string) => void;
}) {
  const { t } = useI18n();
  if (tags.length === 0) return null;
  return (
    <ul className="ph-topics" aria-label={t("tags.label")}>
      {tags.map((tag) => (
        <li key={tag}>
          {onSelect ? (
            <button
              type="button"
              className="ph-topic"
              aria-pressed={tag === active}
              onClick={() => {
                onSelect(tag);
              }}
            >
              {tag}
            </button>
          ) : (
            <span className="ph-topic">{tag}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The active tag filter as a removable chip, e.g. above a filtered list. */
export function TagFilter({ tag, onClear }: { tag: string; onClear: () => void }) {
  const { t } = useI18n();
  return (
    <span className="ph-topic ph-topic-active">
      {t("tags.filtered", { tag })}
      <IconButton
        size="small"
        variant="invisible"
        icon={XIcon}
        aria-label={t("tags.clearFilter")}
        onClick={onClear}
      />
    </span>
  );
}

/** Comma-separated text → tag names; returns the first invalid entry instead when there is one. */
export function parseTags(text: string): { tags: string[] } | { invalid: string } {
  const tags: string[] = [];
  for (const part of text.split(",")) {
    const name = normalizeTag(part);
    if (!name) continue;
    if (!isTagName(name)) return { invalid: part.trim() };
    if (!tags.includes(name)) tags.push(name);
  }
  return { tags };
}

/**
 * Tags of one item, edited inline: chips plus a pencil; editing is a comma-separated input.
 * `api` is the PATCH target that accepts `{ tags }`; null shows the chips read-only.
 */
export function TagEditor({
  tags,
  api,
  onSaved,
}: {
  tags: readonly string[];
  api: string | null;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(tags.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(target: string) {
    const parsed = parseTags(text);
    if ("invalid" in parsed) {
      setError(t("tags.invalid", { tag: parsed.invalid }));
      return;
    }
    if (parsed.tags.length > MAX_TAGS) {
      setError(t("tags.tooMany", { max: String(MAX_TAGS) }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await patch(target, { tags: parsed.tags });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.generic"));
    } finally {
      setBusy(false);
    }
  }

  if (!editing || !api) {
    return (
      <div className="ph-row ph-wrap ph-tags-line">
        <TagChips tags={tags} />
        {api && (
          <Button
            size="small"
            variant="invisible"
            leadingVisual={PencilIcon}
            onClick={() => {
              setText(tags.join(", "));
              setEditing(true);
            }}
          >
            {tags.length === 0 ? t("tags.add") : t("tags.edit")}
          </Button>
        )}
      </div>
    );
  }
  return (
    <form
      className="ph-form"
      aria-label={t("tags.edit")}
      onSubmit={(e) => {
        e.preventDefault();
        void save(api);
      }}
    >
      {error && (
        <Banner variant="critical" title={error} hideTitle description={error} layout="compact" />
      )}
      <div className="ph-row ph-wrap">
        <TextInput
          className="ph-grow"
          aria-label={t("tags.input")}
          placeholder={t("tags.placeholder")}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
        <Button type="submit" variant="primary" size="small" loading={busy}>
          {t("form.save")}
        </Button>
        <Button
          size="small"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
        >
          {t("form.cancel")}
        </Button>
      </div>
    </form>
  );
}
