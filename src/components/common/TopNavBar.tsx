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

  const getFreshnessBadge = () => {
    switch (freshness) {
      case "CURRENT":
        return {
          label: t("freshnessCurrent"),
          bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          dot: "bg-emerald-500",
        };
      case "STALE":
        return {
          label: t("freshnessStale"),
          bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          dot: "bg-amber-500",
        };
      case "PARTIAL":
        return {
          label: t("freshnessPartial"),
          bg: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
          dot: "bg-sky-500",
        };
      case "DISCONNECTED":
      default:
        return {
          label: t("freshnessDisconnected"),
          bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
          dot: "bg-rose-500",
        };
    }
  };

  const badge = getFreshnessBadge();

  return (
    <header className="sticky top-0 z-40 w-full h-[52px] apple-glass transition-colors duration-200">
      <div className="max-w-[1600px] h-full mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
        {/* Left: Brand & Primary Navigation */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-apple-blue flex items-center justify-center text-white shadow-sm font-semibold text-xs tracking-wider">
              M
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-sm tracking-tight text-apple-text-primary">
                MAPF-RL
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-apple-text-secondary">
                {env}
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => onSelectTab("operations")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                currentTab === "operations"
                  ? "bg-black/5 dark:bg-white/10 text-apple-text-primary shadow-xs font-semibold"
                  : "text-apple-text-secondary hover:text-apple-text-primary hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-apple-blue" />
                <span>{t("navOperations")}</span>
              </div>
            </button>

            <button
              onClick={() => onSelectTab("orders")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                currentTab === "orders"
                  ? "bg-black/5 dark:bg-white/10 text-apple-text-primary font-semibold"
                  : "text-apple-text-secondary hover:text-apple-text-primary hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5" />
                <span>{t("navOrders")}</span>
              </div>
            </button>

            <button
              onClick={() => onSelectTab("scenarios")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                currentTab === "scenarios"
                  ? "bg-black/5 dark:bg-white/10 text-apple-text-primary font-semibold"
                  : "text-apple-text-secondary hover:text-apple-text-primary hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>{t("navScenarios")}</span>
              </div>
            </button>

            <button
              onClick={() => onSelectTab("policies")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                currentTab === "policies"
                  ? "bg-black/5 dark:bg-white/10 text-apple-text-primary font-semibold"
                  : "text-apple-text-secondary hover:text-apple-text-primary hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" />
                <span>{t("navPolicies")}</span>
              </div>
            </button>

            <button
              onClick={() => onSelectTab("events")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                currentTab === "events"
                  ? "bg-black/5 dark:bg-white/10 text-apple-text-primary font-semibold"
                  : "text-apple-text-secondary hover:text-apple-text-primary hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>{t("navEvents")}</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Right: Data Source Mode, Freshness Indicator, Language, Theme */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Canonical Fixture Mode Selector for Phase 1 testing */}
          <div className="flex items-center gap-1.5 bg-black/[0.04] dark:bg-white/[0.06] p-0.5 rounded-full border border-apple-border text-[11px]">
            <button
              onClick={() => setUseFixture(true)}
              className={`px-2 py-1 rounded-full transition-all flex items-center gap-1 ${
                useFixture
                  ? "bg-white dark:bg-[#2C2C2E] text-apple-text-primary shadow-xs font-medium"
                  : "text-apple-text-secondary hover:text-apple-text-primary"
              }`}
              title={t("sourceToggleHint")}
            >
              <Database className="w-3 h-3 text-apple-blue" />
              <span>Fixture</span>
            </button>

            {useFixture && (
              <select
                value={fixtureMode}
                onChange={(e) => setFixtureMode(e.target.value as FixtureMode)}
                className="bg-transparent text-apple-text-primary font-medium text-[11px] outline-none pr-1 cursor-pointer"
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
              className={`px-2 py-1 rounded-full transition-all flex items-center gap-1 ${
                !useFixture
                  ? "bg-white dark:bg-[#2C2C2E] text-apple-text-primary shadow-xs font-medium"
                  : "text-apple-text-secondary hover:text-apple-text-primary"
              }`}
              title="Connect to live Core REST API"
            >
              <Radio className="w-3 h-3 text-emerald-500" />
              <span>Live REST</span>
            </button>
          </div>

          {/* Freshness Status Pill */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${badge.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
            <span className="tracking-tight">{badge.label}</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refreshSnapshot()}
            disabled={loading}
            className="w-7 h-7 rounded-full flex items-center justify-center text-apple-text-secondary hover:text-apple-text-primary bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] border border-apple-border transition-all focus:outline-none"
            title="Refresh snapshot data"
            aria-label="Refresh snapshot"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>

          <span className="hidden sm:inline text-apple-divider">|</span>

          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            className="h-7 px-2.5 rounded-full flex items-center gap-1 text-[11px] font-bold bg-black/[0.03] dark:bg-white/[0.06] text-apple-text-primary hover:bg-black/[0.06] dark:hover:bg-white/[0.1] border border-apple-border transition-all focus:outline-none cursor-pointer"
            title={language === "ko" ? "Switch to English" : "한국어로 전환"}
            aria-label="Toggle language"
          >
            <Globe className="w-3 h-3 text-apple-blue" />
            <span>{language === "ko" ? "EN" : "KO"}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-7 h-7 rounded-full flex items-center justify-center text-apple-text-primary bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] border border-apple-border transition-all focus:outline-none cursor-pointer"
            title={
              theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"
            }
            aria-label="Toggle theme"
          >
            {theme === "light" ? (
              <Moon className="w-3.5 h-3.5" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
