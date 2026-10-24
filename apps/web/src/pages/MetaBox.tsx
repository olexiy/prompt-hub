import {
  BUILT_IN_META_KEYS,
  isMetaKey,
  MAX_META_FIELDS,
  META_KEY_MAX,
  META_VALUE_MAX,
  orderMeta,
  type Meta,
  type PromptDetail,
} from "@prompt-hub/core";
import { PencilIcon, PlusIcon, XIcon } from "@primer/octicons-react";
import { Banner, Button, FormControl, IconButton, Textarea, TextInput } from "@primer/react";
import { useState } from "react";
import { ApiError, patch } from "../api";
import { useI18n, type MessageKey } from "../i18n";

const BUILT_IN_LABELS: Record<string, MessageKey> = {
  description: "meta.description",
  note: "meta.note",
};

/**
 * The prompt's Meta box (feature 27, #52, mockup: prompt → Meta): description, note and custom
 * fields as a table, edited inline. Values are shown as plain text (React escapes them).
 */
export function MetaBox({
  detail,
  apiItem,
  onSaved,
}: {
  detail: PromptDetail;
  /** `PATCH` target of the prompt; null for a read-only view (public visitors, #53). */
  apiItem: string | null;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const rows = orderMeta(detail.meta);
  const label = (key: string) => {
    const builtIn = BUILT_IN_LABELS[key];
    return builtIn ? t(builtIn) : key;
  };

  if (!apiItem && rows.length === 0) return null;
  return (
    <section className="ph-box" aria-label={t("meta.title")}>
      <div className="ph-box-head">
        <b className="ph-grow">{t("meta.title")}</b>
        {!editing && apiItem && (
          <IconButton
            size="small"
            variant="invisible"
            icon={PencilIcon}
            aria-label={t("meta.edit")}
            onClick={() => {
              setEditing(true);
            }}
          />
        )}
      </div>
      {editing && apiItem ? (
        <MetaEditor
          meta={detail.meta}
          apiItem={apiItem}
          onDone={(saved) => {
            setEditing(false);
            if (saved) onSaved();
          }}
        />
      ) : rows.length === 0 ? (
        <p className="ph-muted ph-pad ph-m0">{t("meta.empty")}</p>
      ) : (
        <dl className="ph-meta">
          {rows.map(([key, value]) => (
            <div key={key}>
              <dt>{label(key)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

interface CustomRow {
  id: number;
  key: string;
  value: string;
}

function MetaEditor({
  meta,
  apiItem,
  onDone,
}: {
  meta: Meta;
  apiItem: string;
  onDone: (saved: boolean) => void;
}) {
  const { t } = useI18n();
  const [description, setDescription] = useState(meta.description ?? "");
  const [note, setNote] = useState(meta.note ?? "");
  const [custom, setCustom] = useState<CustomRow[]>(() =>
    orderMeta(meta)
      .filter(([k]) => !(BUILT_IN_META_KEYS as readonly string[]).includes(k))
      .map(([key, value], id) => ({ id, key, value })),
  );
  const [nextId, setNextId] = useState(custom.length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (id: number, change: Partial<CustomRow>) => {
    setCustom((rows) => rows.map((r) => (r.id === id ? { ...r, ...change } : r)));
  };

  async function save() {
    // Checked here for a clear message; the API checks the same rules again.
    const map: Meta = { description, note };
    for (const r of custom) {
      const key = r.key.trim();
      if (!key) continue;
      if (!isMetaKey(key)) {
        setError(t("meta.badName", { name: key }));
        return;
      }
      if (key in map) {
        setError(t("meta.duplicate", { name: key }));
        return;
      }
      map[key] = r.value;
    }
    setBusy(true);
    setError(null);
    try {
      await patch(apiItem, { meta: map });
      onDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.generic"));
      setBusy(false);
    }
  }

  return (
    <form
      className="ph-form ph-pad"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {error && (
        <Banner variant="critical" title={error} hideTitle description={error} layout="compact" />
      )}
      <FormControl>
        <FormControl.Label>{t("meta.description")}</FormControl.Label>
        <Textarea
          block
          rows={2}
          maxLength={META_VALUE_MAX}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
          }}
        />
      </FormControl>
      <FormControl>
        <FormControl.Label>{t("meta.note")}</FormControl.Label>
        <Textarea
          block
          rows={2}
          maxLength={META_VALUE_MAX}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
          }}
        />
      </FormControl>
      {custom.map((r) => (
        <fieldset key={r.id} className="ph-meta-row">
          <legend className="ph-sr-only">{t("meta.custom")}</legend>
          <TextInput
            aria-label={t("meta.fieldName")}
            placeholder={t("meta.fieldName")}
            maxLength={META_KEY_MAX}
            value={r.key}
            onChange={(e) => {
              update(r.id, { key: e.target.value });
            }}
          />
          <TextInput
            aria-label={t("meta.fieldValue", { name: r.key || "…" })}
            placeholder={t("meta.value")}
            maxLength={META_VALUE_MAX}
            value={r.value}
            onChange={(e) => {
              update(r.id, { value: e.target.value });
            }}
          />
          <IconButton
            variant="invisible"
            icon={XIcon}
            aria-label={t("meta.remove", { name: r.key || "…" })}
            onClick={() => {
              setCustom((rows) => rows.filter((x) => x.id !== r.id));
            }}
          />
        </fieldset>
      ))}
      <div>
        <Button
          size="small"
          leadingVisual={PlusIcon}
          disabled={custom.length + BUILT_IN_META_KEYS.length >= MAX_META_FIELDS}
          onClick={() => {
            setCustom((rows) => [...rows, { id: nextId, key: "", value: "" }]);
            setNextId(nextId + 1);
          }}
        >
          {t("meta.add")}
        </Button>
      </div>
      <p className="ph-muted ph-small ph-m0">{t("meta.hint")}</p>
      <div className="ph-row">
        <Button type="submit" variant="primary" loading={busy}>
          {t("form.save")}
        </Button>
        <Button
          onClick={() => {
            onDone(false);
          }}
        >
          {t("form.cancel")}
        </Button>
      </div>
    </form>
  );
}
