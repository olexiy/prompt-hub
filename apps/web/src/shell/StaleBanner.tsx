import { Banner, Button } from "@primer/react";
import { useEffect } from "react";
import { useStale, watchFocus } from "../build";
import { useI18n } from "../i18n";

/** Reload prompt for a tab that is older than the deployed app (#73); nothing while current. */
export function StaleBanner() {
  const { t } = useI18n();
  const stale = useStale();
  useEffect(watchFocus, []);
  if (!stale) return null;
  return (
    <div className="ph-stale">
      <Banner
        variant="warning"
        title={t("stale.title")}
        description={t("stale.body")}
        layout="compact"
        primaryAction={
          <Button
            onClick={() => {
              window.location.reload();
            }}
          >
            {t("stale.reload")}
          </Button>
        }
      />
    </div>
  );
}
