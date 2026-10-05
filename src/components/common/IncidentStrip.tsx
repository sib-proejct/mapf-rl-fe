import React, { useState, useEffect, useMemo } from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import {
  ShieldAlert,
  AlertTriangle,
  WifiOff,
  Info,
  X,
  ChevronRight,
} from "lucide-react";
import { formatStateAge } from "../../utils/time/time.ts";

import { STORAGE_KEY_CLEARED_INCIDENTS } from "../incidents/IncidentCenter.tsx";

export const IncidentStrip: React.FC = () => {
  const { t } = useAppConfig();
  const { snapshot, diagnostics, connectionState, setIsIncidentCenterOpen } =
    useOperations();
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [clearedIncidentIds, setClearedIncidentIds] = useState<Set<string>>(
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_CLEARED_INCIDENTS);
        if (saved) return new Set(JSON.parse(saved));
      } catch {
        // Ignore storage errors
      }
      return new Set<string>();
    },
  );

  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_CLEARED_INCIDENTS);
        setClearedIncidentIds(
          saved ? new Set(JSON.parse(saved)) : new Set<string>(),
        );
      } catch {
        // Ignore storage errors
      }
    };
    window.addEventListener("mapf_cleared_incidents", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("mapf_cleared_incidents", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const robots = snapshot?.robots || [];
  const incidents = snapshot?.incidents || [];
  const activeIncidents = incidents.filter(
    (i) => i.status === "ACTIVE" && !clearedIncidentIds.has(i.id),
  );

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
    activeIncidents.length > 0 ||
    safetyRobots.length > 0 ||
    disconnectedRobots.length > 0 ||
    isStale ||
    isPartial ||
    isReconciling ||
    hasGap ||
    hasConflict;

  // Generate a composite signature of active incident state so that new incidents un-dismiss the banner
  const incidentSignature = `${activeIncidents.length}-${safetyRobots.length}-${disconnectedRobots.length}-${freshness}-${diagnostics.gapCount}-${diagnostics.conflictCount}`;

  useEffect(() => {
    setIsDismissed(false);
  }, [incidentSignature]);

  // Helper to format concise robot ID lists (e.g. "robot-01, robot-02 (+4)")
  const formatRobotList = (list: typeof robots, maxShow: number = 2) => {
    if (list.length === 0) return "";
    if (list.length <= maxShow) {
      return list.map((r) => r.id).join(", ");
    }
    const visible = list
      .slice(0, maxShow)
      .map((r) => r.id)
      .join(", ");
    return `${visible} (+${list.length - maxShow})`;
  };

  const safetySummary = useMemo(() => {
    if (safetyRobots.length === 0) return "";
    const distinctSafeties = Array.from(
      new Set(safetyRobots.map((r) => r.safety)),
    ).join(", ");
    return `${safetyRobots.length} ${t("incidentSafetyActive")}: ${formatRobotList(safetyRobots, 2)} (${distinctSafeties})`;
  }, [safetyRobots, t]);

  const disconnectedSummary = useMemo(() => {
    if (disconnectedRobots.length === 0) return "";
    return `${disconnectedRobots.length} ${t("incidentDisconnectedAlert")} (${formatRobotList(disconnectedRobots, 2)})`;
  }, [disconnectedRobots, t]);

  if (!hasIncidents || isDismissed) {
    return null;
  }

  return (
    <div
      role="alert"
      className="relative w-full transition-all duration-300 ease-out animate-fade-in"
    >
      <div className="pointer-events-auto bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl border border-[#FF9500]/30 dark:border-[#FF9F0A]/35 shadow-2xl rounded-2xl p-2 sm:px-3.5 sm:py-2 flex items-center justify-between gap-2.5 text-[#C93400] dark:text-[#FF9F0A] text-xs ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
        {/* Left: Clickable Alert Strip that opens Incident Center */}
        <div
          onClick={() => setIsIncidentCenterOpen(true)}
          className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5 sm:gap-2 overflow-hidden cursor-pointer group"
          title="Click to open Persistent Incident Center"
        >
          {/* Active Incidents Badge */}
          {activeIncidents.length > 0 && (
            <div className="flex items-center gap-1.5 font-bold text-[#D70015] dark:text-[#FF453A] bg-[#FF3B30]/15 dark:bg-[#FF453A]/20 px-2.5 py-1 rounded-xl max-w-full truncate shrink-0">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {activeIncidents.length} Active Incident
                {activeIncidents.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Safety Alert */}
          {safetyRobots.length > 0 && (
            <div
              title={safetyRobots
                .map((r) => `${r.id} (${r.safety})`)
                .join("\n")}
              className="flex items-center gap-1.5 font-bold text-[#D70015] dark:text-[#FF453A] bg-[#FF3B30]/15 dark:bg-[#FF453A]/20 px-2.5 py-1 rounded-xl max-w-full truncate shrink-0"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span className="truncate">{safetySummary}</span>
            </div>
          )}

          {/* Disconnected Alert */}
          {disconnectedRobots.length > 0 && (
            <div
              title={disconnectedRobots.map((r) => r.id).join("\n")}
              className="flex items-center gap-1.5 font-semibold text-[#D70015] dark:text-[#FF453A] bg-[#FF3B30]/10 dark:bg-[#FF453A]/15 px-2.5 py-1 rounded-xl max-w-full truncate shrink-0"
            >
              <WifiOff className="w-4 h-4 shrink-0" />
              <span className="truncate">{disconnectedSummary}</span>
            </div>
          )}

          {/* Stale Alert */}
          {isStale && (
            <div className="flex items-center gap-1.5 font-semibold text-[#C93400] dark:text-[#FF9F0A] bg-[#FF9500]/15 dark:bg-[#FF9F0A]/20 px-2.5 py-1 rounded-xl shrink-0">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {t("incidentStaleWarning")}{" "}
                {snapshot?.snapshotAt
                  ? `(${formatStateAge(snapshot.snapshotAt)})`
                  : ""}
              </span>
            </div>
          )}

          {/* Gap Alert */}
          {hasGap && (
            <div className="flex items-center gap-1.5 font-bold text-[#D70015] dark:text-[#FF453A] bg-[#FF3B30]/15 dark:bg-[#FF453A]/20 px-2.5 py-1 rounded-xl shrink-0">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {t("incidentGapWarning")} (exp: #
                {diagnostics.lastGapDetails?.expected}, rcv: #
                {diagnostics.lastGapDetails?.received})
              </span>
            </div>
          )}

          {/* Conflict Alert */}
          {hasConflict && (
            <div
              title={diagnostics.lastConflictReason}
              className="flex items-center gap-1.5 font-bold text-[#D70015] dark:text-[#FF453A] bg-[#FF3B30]/15 dark:bg-[#FF453A]/20 px-2.5 py-1 rounded-xl max-w-xs sm:max-w-md truncate shrink-0"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {t("incidentConflictWarning")}: {diagnostics.lastConflictReason}
              </span>
            </div>
          )}

          {/* Partial Alert */}
          {isPartial && (
            <div className="flex items-center gap-1.5 font-semibold text-[#0071E3] dark:text-[#2997FF] bg-[#0071E3]/15 dark:bg-[#2997FF]/20 px-2.5 py-1 rounded-xl shrink-0">
              <Info className="w-4 h-4 shrink-0" />
              <span>{t("incidentPartialWarning")}</span>
            </div>
          )}

          <ChevronRight className="w-3.5 h-3.5 text-[#86868B] group-hover:text-[#1D1D1F] dark:group-hover:text-[#F5F5F7] transition-colors shrink-0" />
        </div>

        {/* Right: Status Pill & Dismiss Button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => setIsIncidentCenterOpen(true)}
            className="text-[11px] font-mono font-bold text-[#0071E3] dark:text-[#2997FF] hover:underline shrink-0 hidden sm:inline"
          >
            Incident Center →
          </button>

          <div className="text-[11px] font-mono opacity-90 px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/10 shrink-0">
            <span className="font-bold uppercase">{freshness}</span>
          </div>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 sm:p-1.5 rounded-lg text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Dismiss banner (Incidents remain in Incident Center)"
            aria-label="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
