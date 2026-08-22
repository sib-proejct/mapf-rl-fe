import React, { useMemo } from "react";
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
} from "lucide-react";
import { formatLocaleTime, formatUtcIso } from "../../utils/time/time.ts";

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
  } = useOperations();

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

  const efficiencyPct =
    totalFleet > 0 ? Math.round((executingCount / totalFleet) * 100) : 0;
  const connectivityPct =
    totalFleet > 0
      ? Math.round(((totalFleet - disconnectedCount) / totalFleet) * 100)
      : 100;

  const scaleOptions: FleetScale[] = [4, 100];

  return (
    <div className="space-y-2.5">
      {/* Fleet Stress Test & Stream Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white/80 dark:bg-[#1C1C1E]/80 border border-black/[0.05] dark:border-white/[0.08] backdrop-blur-md text-xs">
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
                <span>Streaming (10Hz)</span>
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
