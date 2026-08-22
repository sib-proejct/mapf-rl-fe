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
  const { snapshot, diagnostics, connectionState } = useOperations();

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
  const isReconciling =
    freshness === "RECONCILING" || connectionState === "Reconciling";
  const hasGap = diagnostics.gapCount > 0 && diagnostics.lastDecision === "GAP";
  const hasConflict =
    diagnostics.conflictCount > 0 && diagnostics.lastDecision === "CONFLICT";

  const hasIncidents =
    safetyRobots.length > 0 ||
    disconnectedRobots.length > 0 ||
    isStale ||
    isPartial ||
    isReconciling ||
    hasGap ||
    hasConflict;

  if (!hasIncidents) {
    return null;
  }

  return (
    <div
      role="alert"
      className="w-full bg-[#FF9500]/10 dark:bg-[#FF9F0A]/15 border border-[#FF9500]/25 dark:border-[#FF9F0A]/30 rounded-xl p-2.5 sm:px-3.5 sm:py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[#C93400] dark:text-[#FF9F0A] text-xs transition-all duration-200 animate-fade-in"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Safety Alert */}
        {safetyRobots.length > 0 && (
          <div className="flex items-center gap-1.5 font-bold text-[#D70015] dark:text-[#FF453A] bg-[#FF3B30]/15 dark:bg-[#FF453A]/20 px-2.5 py-1 rounded-xl">
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
          <div className="flex items-center gap-1.5 font-semibold text-[#D70015] dark:text-[#FF453A] bg-[#FF3B30]/10 dark:bg-[#FF453A]/15 px-2.5 py-1 rounded-xl">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              {disconnectedRobots.length} {t("incidentDisconnectedAlert")} (
              {disconnectedRobots.map((r) => r.id).join(", ")})
            </span>
          </div>
        )}

        {/* Stale Alert */}
        {isStale && (
          <div className="flex items-center gap-1.5 font-semibold text-[#C93400] dark:text-[#FF9F0A] bg-[#FF9500]/15 dark:bg-[#FF9F0A]/20 px-2.5 py-1 rounded-xl">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {t("incidentStaleWarning")}{" "}
              {snapshot?.snapshotAt
                ? `(age: ${formatStateAge(snapshot.snapshotAt)})`
                : ""}
            </span>
          </div>
        )}

        {/* Gap Alert */}
        {hasGap && (
          <div className="flex items-center gap-1.5 font-bold text-[#D70015] dark:text-[#FF453A] bg-[#FF3B30]/15 dark:bg-[#FF453A]/20 px-2.5 py-1 rounded-xl">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {t("incidentGapWarning")} (expected: #
              {diagnostics.lastGapDetails?.expected}, received: #
              {diagnostics.lastGapDetails?.received})
            </span>
          </div>
        )}

        {/* Conflict Alert */}
        {hasConflict && (
          <div className="flex items-center gap-1.5 font-bold text-[#D70015] dark:text-[#FF453A] bg-[#FF3B30]/15 dark:bg-[#FF453A]/20 px-2.5 py-1 rounded-xl">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {t("incidentConflictWarning")}: {diagnostics.lastConflictReason}
            </span>
          </div>
        )}

        {/* Partial Alert */}
        {isPartial && (
          <div className="flex items-center gap-1.5 font-semibold text-[#0071E3] dark:text-[#2997FF] bg-[#0071E3]/15 dark:bg-[#2997FF]/20 px-2.5 py-1 rounded-xl">
            <Info className="w-4 h-4 shrink-0" />
            <span>{t("incidentPartialWarning")}</span>
          </div>
        )}
      </div>

      <div className="text-[11px] font-mono opacity-85 sm:text-right shrink-0">
        Status: <span className="font-bold uppercase">{freshness}</span>
      </div>
    </div>
  );
};
