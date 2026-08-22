import React from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import { Bot, Play, Pause, WifiOff, Clock } from "lucide-react";
import { formatLocaleTime, formatUtcIso } from "../../utils/time/time.ts";

export const BentoStatusRail: React.FC = () => {
  const { t, language } = useAppConfig();
  const { snapshot } = useOperations();

  const robots = snapshot?.robots || [];
  const totalFleet = robots.length;
  const executingCount = robots.filter(
    (r) => r.operationalState === "EXECUTING",
  ).length;
  const heldOrIdleCount = robots.filter(
    (r) => r.operationalState === "IDLE" || r.operationalState === "HELD",
  ).length;
  const disconnectedCount = robots.filter(
    (r) => r.connectivity === "DISCONNECTED",
  ).length;

  const freshness = snapshot?.freshness || "DISCONNECTED";
  const snapshotAt = snapshot?.snapshotAt;
  const eventSequence = snapshot?.cursor?.eventSequence ?? 0;

  return (
    <section
      aria-label="Fleet and System Status Overview"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
    >
      {/* 1. Total Fleet */}
      <div className="apple-card p-3.5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-apple-blue/10 dark:bg-apple-blue/20 flex items-center justify-center text-apple-blue shrink-0">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-medium text-apple-text-secondary">
            {t("bentoFleetTotal")}
          </div>
          <div className="text-xl font-bold tabular-nums text-apple-text-primary">
            {totalFleet}
          </div>
        </div>
      </div>

      {/* 2. Executing */}
      <div className="apple-card p-3.5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
          <Play className="w-5 h-5 fill-current" />
        </div>
        <div>
          <div className="text-[11px] font-medium text-apple-text-secondary">
            {t("bentoExecuting")}
          </div>
          <div className="text-xl font-bold tabular-nums text-apple-text-primary">
            {executingCount}
          </div>
        </div>
      </div>

      {/* 3. Held / Idle */}
      <div className="apple-card p-3.5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
          <Pause className="w-5 h-5 fill-current" />
        </div>
        <div>
          <div className="text-[11px] font-medium text-apple-text-secondary">
            {t("bentoHeldOrIdle")}
          </div>
          <div className="text-xl font-bold tabular-nums text-apple-text-primary">
            {heldOrIdleCount}
          </div>
        </div>
      </div>

      {/* 4. Disconnected */}
      <div className="apple-card p-3.5 flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            disconnectedCount > 0
              ? "bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400"
              : "bg-black/5 dark:bg-white/10 text-apple-text-tertiary"
          }`}
        >
          <WifiOff className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-medium text-apple-text-secondary">
            {t("bentoDisconnected")}
          </div>
          <div
            className={`text-xl font-bold tabular-nums ${
              disconnectedCount > 0
                ? "text-rose-600 dark:text-rose-400 font-extrabold"
                : "text-apple-text-primary"
            }`}
          >
            {disconnectedCount}
          </div>
        </div>
      </div>

      {/* 5. Snapshot Freshness & Seq */}
      <div className="apple-card p-3.5 flex items-center gap-3 col-span-2 sm:col-span-1">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
          <Clock className="w-5 h-5" />
        </div>
        <div className="overflow-hidden">
          <div className="text-[11px] font-medium text-apple-text-secondary flex items-center justify-between gap-1">
            <span>{t("bentoFreshness")}</span>
            <span className="font-mono text-[10px] text-apple-text-tertiary">
              Seq #{eventSequence}
            </span>
          </div>
          <div
            className="text-xs font-semibold tabular-nums text-apple-text-primary truncate"
            title={`UTC: ${snapshotAt ? formatUtcIso(snapshotAt) : "-"}`}
          >
            {snapshotAt
              ? formatLocaleTime(
                  snapshotAt,
                  language === "ko" ? "ko-KR" : "en-US",
                )
              : "-"}
          </div>
        </div>
      </div>
    </section>
  );
};
