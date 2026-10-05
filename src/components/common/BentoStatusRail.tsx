import React, { useState, useRef, useEffect, useMemo } from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import {
  useOperations,
  type FleetScale,
} from "../../app/providers/OperationsContext.tsx";
import {
  Bot,
  Play,
  Pause,
  WifiOff,
  Clock,
  Zap,
  Gauge,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Bell,
  CheckCircle2,
  X,
  Trash2,
} from "lucide-react";
import {
  formatLocaleTime,
  formatUtcIso,
  formatStateAge,
} from "../../utils/time/time.ts";

import { STORAGE_KEY_CLEARED_INCIDENTS } from "../incidents/IncidentCenter.tsx";

export const BentoStatusRail: React.FC = () => {
  const { t, language } = useAppConfig();
  const {
    snapshot,
    fleetScale,
    setFleetScale,
    isSimulatingMotion,
    setIsSimulatingMotion,
    diagnostics,
    transportMode,
    connectionState,
    setIsIncidentCenterOpen,
    setSelectedIncidentId,
  } = useOperations();

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

  const [showAlarmPopup, setShowAlarmPopup] = useState<boolean>(false);
  const alarmMenuRef = useRef<HTMLDivElement>(null);

  // Close alarm popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        alarmMenuRef.current &&
        !alarmMenuRef.current.contains(e.target as Node)
      ) {
        setShowAlarmPopup(false);
      }
    };
    if (showAlarmPopup) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAlarmPopup]);

  const robots = useMemo(() => snapshot?.robots || [], [snapshot?.robots]);

  const { totalFleet, executingCount, heldOrIdleCount, disconnectedCount } =
    useMemo(() => {
      let executing = 0;
      let heldOrIdle = 0;
      let disconnected = 0;

      for (let i = 0; i < robots.length; i++) {
        const r = robots[i];
        if (r.connectivity === "DISCONNECTED") {
          disconnected++;
        }
        if (r.operationalState === "EXECUTING") {
          executing++;
        } else if (
          r.operationalState === "IDLE" ||
          r.operationalState === "HELD" ||
          r.operationalState === "CHARGING"
        ) {
          heldOrIdle++;
        }
      }

      return {
        totalFleet: robots.length,
        executingCount: executing,
        heldOrIdleCount: heldOrIdle,
        disconnectedCount: disconnected,
      };
    }, [robots]);

  const freshness = snapshot?.freshness || "DISCONNECTED";
  const snapshotAt = snapshot?.snapshotAt;
  const eventSequence = snapshot?.cursor?.eventSequence ?? 0;

  const safetyRobots = useMemo(
    () => robots.filter((r) => r.safety !== "NORMAL" && r.safety !== "WAIT"),
    [robots],
  );
  const disconnectedRobots = useMemo(
    () => robots.filter((r) => r.connectivity === "DISCONNECTED"),
    [robots],
  );

  const activeIncidents = (snapshot?.incidents || []).filter(
    (incident) =>
      incident.status === "ACTIVE" && !clearedIncidentIds.has(incident.id),
  );
  const isReconciling =
    freshness === "RECONCILING" || connectionState === "Reconciling";
  const isStale = freshness === "STALE";
  const isPartial = freshness === "PARTIAL";
  const hasGap = diagnostics.gapCount > 0 && diagnostics.lastDecision === "GAP";
  const hasConflict =
    diagnostics.conflictCount > 0 && diagnostics.lastDecision === "CONFLICT";

  const totalAlarmCount =
    activeIncidents.length +
    (isReconciling ? 1 : 0) +
    safetyRobots.length +
    disconnectedRobots.length +
    (isStale ? 1 : 0) +
    (hasGap ? 1 : 0) +
    (hasConflict ? 1 : 0) +
    (isPartial ? 1 : 0);

  const hasSafetyAlert =
    activeIncidents.length > 0 ||
    safetyRobots.length > 0 ||
    hasConflict ||
    hasGap;
  const hasWarningAlert =
    disconnectedRobots.length > 0 || isStale || isPartial || isReconciling;

  const efficiencyPct =
    totalFleet > 0 ? Math.round((executingCount / totalFleet) * 100) : 0;
  const connectivityPct =
    totalFleet > 0
      ? Math.round(((totalFleet - disconnectedCount) / totalFleet) * 100)
      : 100;

  const scaleOptions: FleetScale[] = [4, 100];

  return (
    <div className="space-y-2.5 relative z-30">
      {/* Fleet Stress Test & Stream Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white/80 dark:bg-[#1C1C1E]/80 border border-black/[0.05] dark:border-white/[0.08] backdrop-blur-md text-xs relative z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#0071E3]/10 dark:bg-[#2997FF]/15 flex items-center justify-center text-[#0071E3] dark:text-[#2997FF]">
              <Gauge className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Fleet Scale Simulator
            </span>
          </div>

          {/* Realtime Stream Diagnostics Pills */}
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-[#86868B]">
            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5">
              Dup:{" "}
              <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">
                {diagnostics.duplicateCount}
              </strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5">
              Stale:{" "}
              <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">
                {diagnostics.staleCount}
              </strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5">
              Gaps:{" "}
              <strong
                className={
                  diagnostics.gapCount > 0
                    ? "text-[#FF3B30] dark:text-[#FF453A]"
                    : "text-[#1D1D1F] dark:text-[#F5F5F7]"
                }
              >
                {diagnostics.gapCount}
              </strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5">
              Coalesced:{" "}
              <strong className="text-[#0071E3] dark:text-[#2997FF]">
                {diagnostics.coalescedCount}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Incident / Alarm Popover Button (Left of 4 Standard) */}
          <div className="relative z-40" ref={alarmMenuRef}>
            <button
              aria-expanded={showAlarmPopup}
              aria-controls="operations-alarm-panel"
              onClick={() => setShowAlarmPopup((v) => !v)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                hasSafetyAlert
                  ? "bg-[#FF3B30]/15 text-[#FF3B30] dark:bg-[#FF453A]/20 dark:text-[#FF453A] border border-[#FF3B30]/35 font-bold shadow-xs animate-pulse"
                  : hasWarningAlert
                    ? "bg-[#FF9500]/15 text-[#FF9500] dark:bg-[#FF9F0A]/20 dark:text-[#FF9F0A] border border-[#FF9500]/35 font-bold shadow-xs"
                    : "bg-[#F2F4F6] dark:bg-[#252528] hover:bg-black/10 dark:hover:bg-white/10 text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] border border-black/[0.04] dark:border-white/[0.06]"
              }`}
              title={
                totalAlarmCount > 0
                  ? language === "ko"
                    ? `활성 알람 ${totalAlarmCount}건 (클릭하여 상세 보기)`
                    : `${totalAlarmCount} Active Alarms (Click to view)`
                  : language === "ko"
                    ? "시스템 정상 (클릭하여 상태 확인)"
                    : "Nominal (Click to view)"
              }
            >
              {hasSafetyAlert ? (
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              ) : hasWarningAlert ? (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Bell className="w-3.5 h-3.5 shrink-0 text-[#34C759]" />
              )}
              <span className="font-bold">
                {totalAlarmCount > 0
                  ? language === "ko"
                    ? `알람 (${totalAlarmCount})`
                    : `Alarm (${totalAlarmCount})`
                  : language === "ko"
                    ? "알람 (0)"
                    : "Alarm (0)"}
              </span>
            </button>

            {/* Alarm Popover Panel (Wider towards the left) */}
            {showAlarmPopup && (
              <div
                id="operations-alarm-panel"
                className="absolute right-0 top-full mt-2 w-96 sm:w-[480px] md:w-[560px] max-w-[calc(100vw-2rem)] apple-card p-3.5 sm:p-4 shadow-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl z-50 space-y-3 animate-fade-in ring-1 ring-black/10 dark:ring-white/15"
              >
                {/* Popover Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    {hasSafetyAlert ? (
                      <ShieldAlert className="w-4 h-4 text-[#FF3B30] dark:text-[#FF453A]" />
                    ) : hasWarningAlert ? (
                      <AlertTriangle className="w-4 h-4 text-[#FF9500] dark:text-[#FF9F0A]" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-[#34C759]" />
                    )}
                    <span className="text-xs sm:text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {language === "ko"
                        ? "활성 알람 및 인시던트 현황"
                        : "Active Alarms & Incidents"}
                    </span>
                    {totalAlarmCount > 0 && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#FF3B30]/15 dark:bg-[#FF453A]/20 text-[#FF3B30] dark:text-[#FF453A] font-bold">
                        {totalAlarmCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 uppercase font-bold text-[#86868B]">
                      {freshness}
                    </span>
                    <button
                      onClick={() => setShowAlarmPopup(false)}
                      className="p-1 sm:p-1.5 rounded-lg text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      aria-label="Close popup"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAlarmPopup(false);
                      setIsIncidentCenterOpen(true);
                    }}
                    className="text-xs font-semibold text-[#0071E3] dark:text-[#2997FF] hover:underline cursor-pointer"
                  >
                    {t("incidentCenterTitle")} →
                  </button>

                  {activeIncidents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(t("incidentClearHistoryConfirm"))) {
                          const next = new Set(clearedIncidentIds);
                          (snapshot?.incidents || []).forEach((i) =>
                            next.add(i.id),
                          );
                          setClearedIncidentIds(next);
                          try {
                            localStorage.setItem(
                              STORAGE_KEY_CLEARED_INCIDENTS,
                              JSON.stringify(Array.from(next)),
                            );
                            window.dispatchEvent(
                              new Event("mapf_cleared_incidents"),
                            );
                          } catch {
                            // Ignore storage errors
                          }
                        }
                      }}
                      className="px-2 py-1 rounded-lg text-gray-500 hover:text-[#C93400] hover:bg-[#C93400]/10 text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                      title={t("incidentClearHistory")}
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{t("incidentClearHistory")}</span>
                    </button>
                  )}
                </div>

                {/* Popover List */}
                <div className="space-y-2.5 max-h-80 overflow-y-auto no-scrollbar text-xs">
                  {totalAlarmCount === 0 ? (
                    <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-[#34C759]/10 dark:bg-[#30D158]/15 text-[#248A3D] dark:text-[#30D158]">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-medium">
                        {language === "ko"
                          ? "모든 시스템 정상 — 활성 안전 정지 또는 통신 장애가 없습니다."
                          : "All systems nominal. No safety incidents or disconnections."}
                      </span>
                    </div>
                  ) : (
                    <>
                      {activeIncidents.map((incident) => (
                        <button
                          key={incident.id}
                          type="button"
                          onClick={() => {
                            setSelectedIncidentId(incident.id);
                            setShowAlarmPopup(false);
                            setIsIncidentCenterOpen(true);
                          }}
                          className="w-full text-left p-2.5 rounded-xl border border-[#FF9500]/20 bg-[#FF9500]/10 space-y-1"
                        >
                          <span className="block font-bold">
                            {incident.severity} · {incident.reasonCode}
                          </span>
                          <span className="block text-[#86868B]">
                            {incident.description}
                          </span>
                        </button>
                      ))}
                      {(isPartial || isReconciling) && (
                        <div className="p-2.5 rounded-xl bg-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF]">
                          {isReconciling
                            ? t("connReconciling")
                            : t("incidentPartialWarning")}
                        </div>
                      )}

                      {/* Safety Alerts (Grid on wider screens) */}
                      {safetyRobots.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block">
                            {language === "ko"
                              ? "안전 정지 경보"
                              : "Safety Stops"}{" "}
                            ({safetyRobots.length})
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {safetyRobots.map((r) => (
                              <div
                                key={`safety-${r.id}`}
                                className="flex items-start gap-2 p-2.5 rounded-xl bg-[#FF3B30]/10 dark:bg-[#FF453A]/15 border border-[#FF3B30]/20 text-[#D70015] dark:text-[#FF453A]"
                              >
                                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold">{r.id}</span>
                                    <span className="text-[10px] font-mono opacity-85 px-1.5 py-0.2 rounded bg-[#FF3B30]/20">
                                      {r.safety}
                                    </span>
                                  </div>
                                  <p className="text-[10px] opacity-80 mt-0.5 truncate">
                                    {r.operationalState} · 배터리{" "}
                                    {r.batteryPercent?.toFixed(1) ?? "—"}%
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Disconnected Robots (Grid on wider screens) */}
                      {disconnectedRobots.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block">
                            {language === "ko"
                              ? "통신 끊김 경보"
                              : "Disconnected Robots"}{" "}
                            ({disconnectedRobots.length})
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {disconnectedRobots.map((r) => (
                              <div
                                key={`disc-${r.id}`}
                                className="flex items-start gap-2 p-2.5 rounded-xl bg-[#FF9500]/10 dark:bg-[#FF9F0A]/15 border border-[#FF9500]/20 text-[#C93400] dark:text-[#FF9F0A]"
                              >
                                <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold">{r.id}</span>
                                    <span className="text-[10px] font-mono opacity-85 px-1.5 py-0.2 rounded bg-[#FF9500]/20">
                                      OFFLINE
                                    </span>
                                  </div>
                                  <p className="text-[10px] opacity-80 mt-0.5 truncate">
                                    {r.operationalState} ·{" "}
                                    {language === "ko"
                                      ? "연결 끊김"
                                      : "Disconnected"}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Gap Alert */}
                      {hasGap && (
                        <div className="p-2.5 rounded-xl bg-[#FF3B30]/10 dark:bg-[#FF453A]/15 border border-[#FF3B30]/20 text-[#D70015] dark:text-[#FF453A] flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">
                              {t("incidentGapWarning")}
                            </span>
                            <p className="text-[10px] opacity-80">
                              Expected: #{diagnostics.lastGapDetails?.expected},
                              Received: #{diagnostics.lastGapDetails?.received}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Conflict Alert */}
                      {hasConflict && (
                        <div className="p-2.5 rounded-xl bg-[#FF3B30]/10 dark:bg-[#FF453A]/15 border border-[#FF3B30]/20 text-[#D70015] dark:text-[#FF453A] flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">
                              {t("incidentConflictWarning")}
                            </span>
                            <p className="text-[10px] opacity-80">
                              {diagnostics.lastConflictReason}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Stale Warning */}
                      {isStale && (
                        <div className="p-2.5 rounded-xl bg-[#FF9500]/10 dark:bg-[#FF9F0A]/15 border border-[#FF9500]/20 text-[#C93400] dark:text-[#FF9F0A] flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">
                              {t("incidentStaleWarning")}
                            </span>
                            {snapshotAt && (
                              <p className="text-[10px] opacity-80">
                                Age: {formatStateAge(snapshotAt)}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Scale Selector Pills */}
          <div className="flex items-center gap-1 bg-[#F2F4F6] dark:bg-[#252528] p-0.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
            {scaleOptions.map((s) => (
              <button
                key={`scale-${s}`}
                onClick={() => setFleetScale(s)}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  fleetScale === s
                    ? "bg-[#0071E3] text-white shadow-xs"
                    : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
                }`}
              >
                {s === 4 ? "4 (Standard)" : `${s} Units`}
              </button>
            ))}
          </div>

          {/* Stream Rate & Motion Toggle */}
          <button
            onClick={() => setIsSimulatingMotion(!isSimulatingMotion)}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              isSimulatingMotion
                ? "bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/30 font-bold animate-pulse"
                : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[#1D1D1F] dark:text-[#F5F5F7]"
            }`}
          >
            {isSimulatingMotion ? (
              <>
                <Pause className="w-3 h-3 fill-current" />
                <span>
                  {transportMode === "LIVE_WEBSOCKET"
                    ? "Streaming (5Hz)"
                    : "Streaming (10Hz)"}
                </span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Resume Stream</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 5-Card Bento Status Overview */}
      <section
        aria-label="Fleet and System Status Overview"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-3.5"
      >
        {/* Card 1: Total Fleet */}
        <div className="apple-card px-4 py-3 sm:px-4.5 sm:py-3.5 flex flex-col justify-between group select-none relative hover:border-black/10 dark:hover:border-white/15 transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#0071E3]/10 dark:bg-[#2997FF]/15 flex items-center justify-center text-[#0071E3] dark:text-[#2997FF] shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-[#86868B] dark:text-[#86868B] truncate tracking-tight">
                {t("bentoFleetTotal")}
              </span>
            </div>
            <span className="text-[10px] sm:text-[11px] font-mono font-medium text-[#86868B] dark:text-[#A1A1A6] shrink-0">
              Active Fleet
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2 mt-2">
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-xl sm:text-2xl font-bold font-mono text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight tabular-nums">
                {totalFleet}
              </span>
              <span className="text-xs font-medium text-[#86868B] dark:text-[#A1A1A6]">
                units
              </span>
            </div>
            <span className="text-[11px] font-mono font-semibold text-[#0071E3] dark:text-[#2997FF]">
              {fleetScale > 4 ? "High-Scale" : "100% Online"}
            </span>
          </div>
        </div>

        {/* Card 2: Executing */}
        <div className="apple-card px-4 py-3 sm:px-4.5 sm:py-3.5 flex flex-col justify-between group select-none relative hover:border-black/10 dark:hover:border-white/15 transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#34C759]/10 dark:bg-[#30D158]/15 flex items-center justify-center text-[#34C759] dark:text-[#30D158] shrink-0">
                <Play className="w-3 h-3 fill-current" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-[#86868B] dark:text-[#86868B] truncate tracking-tight">
                {t("bentoExecuting")}
              </span>
            </div>
            <span className="text-[11px] font-mono font-semibold text-[#34C759] dark:text-[#30D158] shrink-0">
              {efficiencyPct}%
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2 mt-2">
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-xl sm:text-2xl font-bold font-mono text-[#34C759] dark:text-[#30D158] tracking-tight tabular-nums">
                {executingCount}
              </span>
              <span className="text-xs font-medium text-[#86868B] dark:text-[#A1A1A6]">
                in transit
              </span>
            </div>
            <span className="text-[11px] font-medium text-[#86868B] dark:text-[#A1A1A6]">
              active
            </span>
          </div>
        </div>

        {/* Card 3: Held / Idle */}
        <div className="apple-card px-4 py-3 sm:px-4.5 sm:py-3.5 flex flex-col justify-between group select-none relative hover:border-black/10 dark:hover:border-white/15 transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#FF9500]/10 dark:bg-[#FF9F0A]/15 flex items-center justify-center text-[#FF9500] dark:text-[#FF9F0A] shrink-0">
                <Pause className="w-3 h-3 fill-current" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-[#86868B] dark:text-[#86868B] truncate tracking-tight">
                {t("bentoHeldOrIdle")}
              </span>
            </div>
            <span className="text-[11px] font-mono font-semibold text-[#FF9500] dark:text-[#FF9F0A] shrink-0">
              {totalFleet > 0
                ? `${Math.round((heldOrIdleCount / totalFleet) * 100)}%`
                : "0%"}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2 mt-2">
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-xl sm:text-2xl font-bold font-mono text-[#FF9500] dark:text-[#FF9F0A] tracking-tight tabular-nums">
                {heldOrIdleCount}
              </span>
              <span className="text-xs font-medium text-[#86868B] dark:text-[#A1A1A6]">
                standby
              </span>
            </div>
            <span className="text-[11px] font-medium text-[#86868B] dark:text-[#A1A1A6]">
              buffer
            </span>
          </div>
        </div>

        {/* Card 4: Disconnected */}
        <div className="apple-card px-4 py-3 sm:px-4.5 sm:py-3.5 flex flex-col justify-between group select-none relative hover:border-black/10 dark:hover:border-white/15 transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  disconnectedCount > 0
                    ? "bg-[#FF3B30]/10 dark:bg-[#FF453A]/20 text-[#FF3B30] dark:text-[#FF453A]"
                    : "bg-black/5 dark:bg-white/10 text-[#86868B]"
                }`}
              >
                <WifiOff className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-[#86868B] dark:text-[#86868B] truncate tracking-tight">
                {t("bentoDisconnected")}
              </span>
            </div>
            <span
              className={`text-[11px] font-mono font-semibold shrink-0 ${
                disconnectedCount > 0
                  ? "text-[#FF3B30] dark:text-[#FF453A]"
                  : "text-[#34C759] dark:text-[#30D158]"
              }`}
            >
              {connectivityPct}% Link
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2 mt-2">
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span
                className={`text-xl sm:text-2xl font-bold font-mono tracking-tight tabular-nums ${
                  disconnectedCount > 0
                    ? "text-[#FF3B30] dark:text-[#FF453A]"
                    : "text-[#1D1D1F] dark:text-[#F5F5F7]"
                }`}
              >
                {disconnectedCount}
              </span>
              <span className="text-xs font-medium text-[#86868B] dark:text-[#A1A1A6]">
                offline
              </span>
            </div>
            <span className="text-[11px] font-medium text-[#86868B] dark:text-[#A1A1A6]">
              {disconnectedCount > 0 ? "attention" : "nominal"}
            </span>
          </div>
        </div>

        {/* Card 5: Snapshot Freshness & Seq */}
        <div className="apple-card px-4 py-3 sm:px-4.5 sm:py-3.5 flex flex-col justify-between col-span-2 sm:col-span-1 group select-none relative hover:border-black/10 dark:hover:border-white/15 transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#0071E3]/10 dark:bg-[#2997FF]/15 flex items-center justify-center text-[#0071E3] dark:text-[#2997FF] shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-[#86868B] dark:text-[#86868B] truncate tracking-tight">
                {t("bentoFreshness")}
              </span>
            </div>
            <span className="text-[11px] font-mono font-semibold text-[#0071E3] dark:text-[#2997FF] shrink-0">
              #{eventSequence}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 mt-2">
            <span
              className="text-xs sm:text-sm font-bold font-mono text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight tabular-nums truncate"
              title={`UTC: ${snapshotAt ? formatUtcIso(snapshotAt) : "-"}`}
            >
              {snapshotAt
                ? formatLocaleTime(
                    snapshotAt,
                    language === "ko" ? "ko-KR" : "en-US",
                  )
                : "-"}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <span
                className={`w-2 h-2 rounded-full ${
                  freshness === "CURRENT"
                    ? "bg-[#34C759] dark:bg-[#30D158] animate-pulse"
                    : freshness === "STALE"
                      ? "bg-[#FF9500] dark:bg-[#FF9F0A]"
                      : freshness === "RECONCILING"
                        ? "bg-[#0071E3] dark:bg-[#2997FF] animate-pulse"
                        : "bg-[#FF3B30] dark:bg-[#FF453A]"
                }`}
              />
              <span className="text-[10px] font-medium text-[#86868B] dark:text-[#A1A1A6]">
                {freshness.toLowerCase()}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
