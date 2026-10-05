import React, { useState, useEffect } from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import {
  ShieldAlert,
  AlertTriangle,
  WifiOff,
  Info,
  CheckCircle2,
  X,
  Search,
  Filter,
  Bot,
  Box,
  RotateCcw,
  Check,
  Zap,
  Trash2,
} from "lucide-react";
import {
  formatStateAge,
  formatSimulationTime,
  formatUtcIso,
} from "../../utils/time/time.ts";
import type {
  Incident,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
} from "../../domain/incident/types.ts";

export const STORAGE_KEY_CLEARED_INCIDENTS = "mapf_cleared_incident_ids";

export interface IncidentCenterProps {
  embedded?: boolean;
}

export const IncidentCenter: React.FC<IncidentCenterProps> = ({
  embedded = false,
}) => {
  const { t } = useAppConfig();
  const {
    snapshot,
    isIncidentCenterOpen,
    setIsIncidentCenterOpen,
    selectedIncidentId,
    setSelectedIncidentId,
    setSelectedRobotId,
    setActionDialogTarget,
    acknowledgeIncident,
    resolveIncident,
    transportMode,
  } = useOperations();

  const [filterStatus, setFilterStatus] = useState<string>("ACTIVE");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
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

  const allIncidents = snapshot?.incidents || [];
  const visibleIncidents = allIncidents.filter(
    (inc) => !clearedIncidentIds.has(inc.id),
  );

  // Clearable incidents: all visible incidents
  const clearableIncidents = visibleIncidents;

  // Filtered incidents
  const filtered = visibleIncidents.filter((inc) => {
    const matchesStatus = filterStatus === "ALL" || inc.status === filterStatus;
    const matchesCategory =
      filterCategory === "ALL" ||
      inc.category.toLowerCase() === filterCategory.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      inc.reasonCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inc.relatedEntity?.id &&
        inc.relatedEntity.id.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const activeCount = visibleIncidents.filter(
    (i) => i.status === "ACTIVE",
  ).length;

  const handleClearHistory = () => {
    if (window.confirm(t("incidentClearHistoryConfirm"))) {
      const next = new Set(clearedIncidentIds);
      clearableIncidents.forEach((i) => next.add(i.id));
      setClearedIncidentIds(next);
      try {
        localStorage.setItem(
          STORAGE_KEY_CLEARED_INCIDENTS,
          JSON.stringify(Array.from(next)),
        );
        window.dispatchEvent(new Event("mapf_cleared_incidents"));
      } catch {
        // Ignore storage errors
      }
    }
  };

  const getSeverityBadge = (severity: IncidentSeverity) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-[#FF3B30]/15 text-[#D70015] dark:text-[#FF453A] border-[#FF3B30]/30";
      case "WARNING":
        return "bg-[#FF9500]/15 text-[#C93400] dark:text-[#FF9F0A] border-[#FF9500]/30";
      case "INFO":
      default:
        return "bg-[#0071E3]/15 text-[#0071E3] dark:text-[#2997FF] border-[#0071E3]/30";
    }
  };

  const getCategoryIcon = (category: IncidentCategory) => {
    switch (category) {
      case "safety":
        return (
          <ShieldAlert className="w-4 h-4 text-[#D70015] dark:text-[#FF453A]" />
        );
      case "deadlock":
      case "collision_risk":
        return (
          <AlertTriangle className="w-4 h-4 text-[#C93400] dark:text-[#FF9F0A]" />
        );
      case "connectivity":
        return (
          <WifiOff className="w-4 h-4 text-[#D70015] dark:text-[#FF453A]" />
        );
      case "fault":
        return <Zap className="w-4 h-4 text-[#FF9500]" />;
      default:
        return <Info className="w-4 h-4 text-[#0071E3]" />;
    }
  };

  const renderContent = () => (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Info Banner */}
      <div className="p-3.5 rounded-2xl bg-[#0071E3]/5 dark:bg-[#2997FF]/10 border border-[#0071E3]/15 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF] shrink-0 mt-0.5" />
        <div className="text-[11px] text-[#86868B] leading-relaxed">
          <strong className="text-[#1D1D1F] dark:text-[#F5F5F7] block">
            {t("incidentPersistentNotice")}
          </strong>
          All safety stops, collision risks, and faults remain actionable and
          recorded until resolved.
        </div>
      </div>

      {/* Filter Tabs & Search & Actions */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="grid grid-cols-4 bg-[#F2F4F6] dark:bg-[#252528] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] text-xs gap-1 flex-1">
            {[
              { val: "ALL", label: t("incidentFilterAll") },
              {
                val: "ACTIVE",
                label: `${t("incidentFilterActive")} (${activeCount})`,
              },
              { val: "ACKNOWLEDGED", label: t("incidentFilterAcked") },
              { val: "RESOLVED", label: t("incidentFilterResolved") },
            ].map((tab) => (
              <button
                key={`tab-${tab.val}`}
                onClick={() => setFilterStatus(tab.val)}
                className={`py-1.5 px-2 rounded-xl text-center font-semibold transition-all truncate text-[11px] cursor-pointer ${
                  filterStatus === tab.val
                    ? "bg-white dark:bg-[#1C1C1E] text-[#191F28] dark:text-[#F5F5F7] font-bold shadow-xs"
                    : "text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {clearableIncidents.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="px-2.5 py-1.5 rounded-xl text-gray-500 hover:text-[#C93400] hover:bg-[#C93400]/10 text-[11px] font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer shrink-0 border border-black/[0.04] dark:border-white/[0.06]"
              title={t("incidentClearHistory")}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t("incidentClearHistory")}</span>
            </button>
          )}
        </div>

        {/* Category Pills & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] flex-1">
            {[
              { key: "ALL", label: "All Types" },
              { key: "safety", label: t("incidentCategorySafety") },
              { key: "deadlock", label: t("incidentCategoryDeadlock") },
              { key: "collision_risk", label: t("incidentCategoryCollision") },
              { key: "fault", label: t("incidentCategoryFault") },
              { key: "connectivity", label: t("incidentCategoryConn") },
            ].map((cat) => (
              <button
                key={`cat-${cat.key}`}
                onClick={() => setFilterCategory(cat.key)}
                className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filterCategory === cat.key
                    ? "bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] border-transparent"
                    : "bg-white dark:bg-[#1C1C1E] text-[#86868B] border-black/[0.05] dark:border-white/[0.07] hover:border-black/20"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[160px] sm:w-48 shrink-0">
            <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search incidents..."
              className="w-full pl-8 pr-2.5 py-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-[11px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#86868B] focus:outline-none focus:ring-1 focus:ring-[#0071E3]"
            />
          </div>
        </div>
      </div>

      {/* Incidents List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[300px]">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#86868B] space-y-1">
            <CheckCircle2 className="w-6 h-6 mx-auto text-[#34C759] opacity-60 mb-2" />
            <p className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t("incidentNoActive")}
            </p>
            <p className="text-[11px]">
              No incidents match the active filters.
            </p>
          </div>
        ) : (
          filtered.map((inc) => {
            const isSelected = selectedIncidentId === inc.id;

            return (
              <div
                key={`inc-${inc.id}`}
                onClick={() => setSelectedIncidentId(inc.id)}
                className={`p-4 rounded-2xl border transition-all space-y-3 cursor-pointer ${
                  isSelected
                    ? "bg-[#0071E3]/[0.06] dark:bg-[#2997FF]/10 border-[#0071E3]/50 ring-1 ring-[#0071E3]/20 shadow-xs"
                    : "bg-white dark:bg-[#1C1C1E] border-black/[0.05] dark:border-white/[0.07] hover:border-black/15"
                }`}
              >
                {/* Top Row: Category + Severity + Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(inc.category)}
                    <span className="font-mono text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {inc.reasonCode}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${getSeverityBadge(
                        inc.severity,
                      )}`}
                    >
                      {inc.severity}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        inc.status === "ACTIVE"
                          ? "bg-[#FF3B30]/10 text-[#D70015] dark:text-[#FF453A] border-[#FF3B30]/20"
                          : inc.status === "ACKNOWLEDGED"
                            ? "bg-[#FF9500]/10 text-[#C93400] dark:text-[#FF9F0A] border-[#FF9500]/20"
                            : "bg-[#34C759]/10 text-[#248A3D] dark:text-[#30D158] border-[#34C759]/20"
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-[#1D1D1F] dark:text-[#F5F5F7] leading-relaxed">
                  {inc.description}
                </p>

                {/* Metadata Row */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-[#86868B] pt-2 border-t border-black/[0.03] dark:border-white/[0.05]">
                  <div>
                    <span>Simulation: </span>
                    <span className="text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold">
                      {formatSimulationTime(inc.simulationTimeMs)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span>Age: </span>
                    <span className="text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold">
                      {formatStateAge(inc.occurredAtUtc)}
                    </span>
                  </div>
                </div>

                {/* Related Entity Link & Actions */}
                <div className="flex items-center justify-between pt-1">
                  {inc.relatedEntity ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (inc.relatedEntity?.type === "ROBOT") {
                          setSelectedRobotId(inc.relatedEntity.id);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-[#0071E3] dark:text-[#2997FF] hover:underline"
                    >
                      <Bot className="w-3 h-3" />
                      <span>{inc.relatedEntity.id}</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {inc.status === "ACTIVE" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          acknowledgeIncident({
                            incidentId: inc.id,
                            action: "ACKNOWLEDGE",
                          });
                        }}
                        className="px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/10 text-[#1D1D1F] dark:text-[#F5F5F7] text-[10px] font-semibold hover:bg-black/10 transition-colors cursor-pointer"
                      >
                        {t("incidentActionAck")}
                      </button>
                    )}

                    {inc.status !== "RESOLVED" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          resolveIncident({
                            incidentId: inc.id,
                            action: "RESOLVE",
                          });
                        }}
                        className="px-2.5 py-1 rounded-xl bg-[#34C759]/15 text-[#248A3D] dark:text-[#30D158] border border-[#34C759]/30 text-[10px] font-semibold hover:bg-[#34C759]/25 transition-colors cursor-pointer"
                      >
                        {t("incidentActionResolve")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (embedded) {
    return renderContent();
  }

  if (!isIncidentCenterOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 dark:bg-black/70 backdrop-blur-md animate-fade-in"
    >
      <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] shadow-2xl rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between shrink-0 bg-[#FBFBFD] dark:bg-[#19191B]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D70015]/10 dark:bg-[#FF453A]/15 flex items-center justify-center text-[#D70015] dark:text-[#FF453A]">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
                {t("incidentCenterTitle")}
              </h2>
              <p className="text-[11px] text-[#86868B]">
                {activeCount} active incident{activeCount !== 1 ? "s" : ""}{" "}
                require operator supervision
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsIncidentCenterOpen(false)}
            className="p-1.5 rounded-full text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">{renderContent()}</div>
      </div>
    </div>
  );
};
