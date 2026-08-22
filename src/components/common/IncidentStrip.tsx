import React from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import {
  ShieldAlert,
  AlertTriangle,
  WifiOff,
  CheckCircle2,
  Info,
} from "lucide-react";
import { formatStateAge } from "../../utils/time/time.ts";

export const IncidentStrip: React.FC = () => {
  const { t } = useAppConfig();
  const { snapshot } = useOperations();

  const robots = snapshot?.robots || [];
  const safetyRobots = robots.filter(
    (r) => r.safety !== "NORMAL" && r.safety !== "WAIT",
  );
  const disconnectedRobots = robots.filter(
    (r) => r.connectivity === "DISCONNECTED",
  );
  const freshness = snapshot?.freshness || "DISCONNECTED";
  const isStale = freshness === "STALE";
  const isPartial = freshness === "PARTIAL";

  const hasIncidents =
    safetyRobots.length > 0 ||
    disconnectedRobots.length > 0 ||
    isStale ||
    isPartial;

  if (!hasIncidents) {
    return (
      <div
        role="status"
        className="w-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 rounded-2xl px-4 py-2 flex items-center justify-between gap-3 text-emerald-800 dark:text-emerald-300 text-xs"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-medium">{t("incidentAllClear")}</span>
        </div>
        <span className="text-[11px] opacity-80 tabular-nums">
          {robots.length} robots active
        </span>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="w-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-amber-900 dark:text-amber-200 text-xs"
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Safety Alert */}
        {safetyRobots.length > 0 && (
          <div className="flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400 bg-rose-500/15 px-2.5 py-1 rounded-lg">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              {t("incidentSafetyActive")}:{" "}
              {safetyRobots.map((r) => r.id).join(", ")} (
              {safetyRobots.map((r) => r.safety).join(", ")})
            </span>
          </div>
        )}

        {/* Disconnected Alert */}
        {disconnectedRobots.length > 0 && (
          <div className="flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-300 bg-rose-500/10 px-2.5 py-1 rounded-lg">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              {disconnectedRobots.length} {t("incidentDisconnectedAlert")} (
              {disconnectedRobots.map((r) => r.id).join(", ")})
            </span>
          </div>
        )}

        {/* Stale Alert */}
        {isStale && (
          <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-lg">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {t("incidentStaleWarning")}{" "}
              {snapshot?.snapshotAt
                ? `(age: ${formatStateAge(snapshot.snapshotAt)})`
                : ""}
            </span>
          </div>
        )}

        {/* Partial Alert */}
        {isPartial && (
          <div className="flex items-center gap-1.5 font-medium text-sky-700 dark:text-sky-300 bg-sky-500/15 px-2.5 py-1 rounded-lg">
            <Info className="w-4 h-4 shrink-0" />
            <span>{t("incidentPartialWarning")}</span>
          </div>
        )}
      </div>

      <div className="text-[11px] opacity-75 sm:text-right shrink-0">
        Status: <span className="font-semibold uppercase">{freshness}</span>
      </div>
    </div>
  );
};
