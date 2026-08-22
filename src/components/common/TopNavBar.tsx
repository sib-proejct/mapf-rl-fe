import React from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import {
  useOperations,
  FixtureMode,
} from "../../app/providers/OperationsContext.tsx";
import {
  Sun,
  Moon,
  Globe,
  Radio,
  RefreshCw,
  Layers,
  Database,
  Activity,
  Box,
  FileText,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";

export type NavTab =
  | "operations"
  | "orders"
  | "scenarios"
  | "policies"
  | "events";

interface TopNavBarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  currentTab,
  onSelectTab,
}) => {
  const { t, theme, toggleTheme, language, toggleLanguage } = useAppConfig();
  const {
    snapshot,
    loading,
    refreshSnapshot,
    useFixture,
    setUseFixture,
    fixtureMode,
    setFixtureMode,
  } = useOperations();

  const env = import.meta.env.VITE_MAPF_PUBLIC_ENVIRONMENT || "LOCAL";

  const freshness = snapshot?.freshness || "DISCONNECTED";
  const robots = snapshot?.robots || [];
  const safetyRobots = robots.filter(
    (r) => r.safety !== "NORMAL" && r.safety !== "WAIT",
  );
  const disconnectedRobots = robots.filter(
    (r) => r.connectivity === "DISCONNECTED",
  );

  const getSystemStatusBadge = () => {
    if (safetyRobots.length > 0) {
      return {
        label:
          language === "ko"
            ? `안전 정지 (${safetyRobots.length})`
            : `${safetyRobots.length} Safety Alert`,
        bg: "text-[#D70015] dark:text-[#FF453A]",
        dot: "bg-[#FF3B30] animate-pulse",
      };
    }
    if (disconnectedRobots.length > 0) {
      return {
        label:
          language === "ko"
            ? `오프라인 (${disconnectedRobots.length})`
            : `${disconnectedRobots.length} Offline`,
        bg: "text-[#D70015] dark:text-[#FF453A]",
        dot: "bg-[#FF3B30]",
      };
    }
    switch (freshness) {
      case "CURRENT":
        return {
          label:
            language === "ko" ? "시스템 정상 (Nominal)" : "All Systems Nominal",
          bg: "text-[#248A3D] dark:text-[#30D158]",
          dot: "bg-[#34C759]",
        };
      case "STALE":
        return {
          label: t("freshnessStale"),
          bg: "text-[#C93400] dark:text-[#FF9F0A]",
          dot: "bg-[#FF9500]",
        };
      case "PARTIAL":
        return {
          label: t("freshnessPartial"),
          bg: "text-[#0071E3] dark:text-[#2997FF]",
          dot: "bg-[#0071E3]",
        };
      case "DISCONNECTED":
      default:
        return {
          label: t("freshnessDisconnected"),
          bg: "text-[#D70015] dark:text-[#FF453A]",
          dot: "bg-[#FF3B30]",
        };
    }
  };

  const badge = getSystemStatusBadge();

  return (
    <header className="sticky top-0 z-40 w-full h-14 sm:h-16 bg-[#FBFBFD]/90 dark:bg-black/85 backdrop-blur-xl border-b border-black/[0.04] dark:border-white/[0.08] transition-colors duration-300">
      <div className="max-w-[1920px] h-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 flex items-center justify-between gap-3">
        {/* Left: Brand & Primary Navigation */}
        <div className="flex items-center gap-5 sm:gap-8">
          {/* Typographic SOGS/Apple Style Logo */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectTab("operations")}
              className="text-left group cursor-pointer focus:outline-none flex items-center gap-2"
            >
              <span className="text-base sm:text-lg font-black tracking-tight text-[#0071E3] dark:text-[#2997FF] group-hover:opacity-80 transition-opacity">
                MAPF
              </span>
              <span className="hidden md:inline text-xs sm:text-sm font-medium text-[#86868B] tracking-tight">
                RL Operator
              </span>
            </button>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[#86868B] font-semibold">
              {env}
            </span>
          </div>

          {/* Nav Links with Apple Underline Indicator */}
          <nav className="flex items-center space-x-1 sm:space-x-4 overflow-x-auto no-scrollbar py-1 min-w-0">
            {(
              [
                { id: "operations", label: t("navOperations"), icon: Activity },
                { id: "orders", label: t("navOrders"), icon: Box },
                { id: "scenarios", label: t("navScenarios"), icon: Layers },
                { id: "policies", label: t("navPolicies"), icon: Radio },
                { id: "events", label: t("navEvents"), icon: FileText },
              ] as const
            ).map((tab) => {
              const isActive = currentTab === tab.id;
              const IconComp = tab.icon;

              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={`text-xs sm:text-sm font-medium py-1 px-2 sm:px-1 shrink-0 relative transition-colors focus:outline-none whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? "text-[#0071E3] dark:text-[#2997FF] font-semibold"
                      : "text-[#6E6E73] dark:text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="absolute -bottom-1 left-1 right-1 sm:left-0 sm:right-0 h-0.5 bg-[#0071E3] dark:bg-[#2997FF] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Data Source Mode, Freshness Indicator, Language, Theme */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Canonical Fixture Mode Capsule Selector */}
          <div className="flex items-center gap-1 bg-[#F5F5F7] dark:bg-[#1C1C1E] p-0.5 rounded-full border border-black/[0.06] dark:border-white/[0.08] text-[11px]">
            <button
              onClick={() => setUseFixture(true)}
              className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1 cursor-pointer ${
                useFixture
                  ? "bg-white dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs font-semibold"
                  : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
              }`}
              title={t("sourceToggleHint")}
            >
              <Database className="w-3 h-3 text-[#0071E3] dark:text-[#2997FF]" />
              <span>Fixture</span>
            </button>

            {useFixture && (
              <select
                value={fixtureMode}
                onChange={(e) => setFixtureMode(e.target.value as FixtureMode)}
                className="bg-transparent text-[#1D1D1F] dark:text-[#F5F5F7] font-medium text-[11px] outline-none pr-1 cursor-pointer"
                title="Select Fixture State scenario"
              >
                <option value="current" className="dark:bg-[#1C1C1E]">
                  Current
                </option>
                <option value="stale" className="dark:bg-[#1C1C1E]">
                  Stale
                </option>
                <option value="partial" className="dark:bg-[#1C1C1E]">
                  Partial
                </option>
                <option value="disconnected" className="dark:bg-[#1C1C1E]">
                  Disconnected
                </option>
                <option value="error" className="dark:bg-[#1C1C1E]">
                  RFC 9457 Error
                </option>
              </select>
            )}

            <button
              onClick={() => setUseFixture(false)}
              className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1 cursor-pointer ${
                !useFixture
                  ? "bg-white dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs font-semibold"
                  : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
              }`}
              title="Connect to live Core REST API"
            >
              <Radio className="w-3 h-3 text-[#34C759]" />
              <span>Live REST</span>
            </button>
          </div>

          {/* System & Freshness Status */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-1 py-1 text-xs font-medium ${badge.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
            <span className="tracking-tight">{badge.label}</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refreshSnapshot()}
            disabled={loading}
            className="w-7.5 h-7.5 rounded-full flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] bg-[#F5F5F7] dark:bg-[#1C1C1E] hover:bg-[#EBEBED] dark:hover:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] transition-all focus:outline-none cursor-pointer"
            title="Refresh snapshot data"
            aria-label="Refresh snapshot"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>

          <span className="hidden sm:inline text-[#D2D2D7] dark:text-[#3A3A3C]">
            |
          </span>

          {/* Language Toggle Pill */}
          <button
            onClick={toggleLanguage}
            className="h-7.5 px-2.5 rounded-full flex items-center gap-1 text-[11px] font-bold bg-[#F5F5F7] dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#EBEBED] dark:hover:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] transition-all focus:outline-none select-none cursor-pointer"
            title={language === "ko" ? "Switch to English" : "한국어로 전환"}
            aria-label="Toggle language"
          >
            <Globe className="w-3 h-3 text-[#0071E3] dark:text-[#2997FF]" />
            <span>{language === "ko" ? "EN" : "KO"}</span>
          </button>

          {/* Theme Toggle Pill */}
          <button
            onClick={toggleTheme}
            className="w-7.5 h-7.5 rounded-full flex items-center justify-center text-[#1D1D1F] dark:text-[#F5F5F7] bg-[#F5F5F7] dark:bg-[#1C1C1E] hover:bg-[#EBEBED] dark:hover:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] transition-all focus:outline-none select-none cursor-pointer"
            title={
              theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"
            }
            aria-label="Toggle theme"
          >
            {theme === "light" ? (
              <Moon className="w-3.5 h-3.5 text-[#1D1D1F]" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-[#FFD60A]" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
