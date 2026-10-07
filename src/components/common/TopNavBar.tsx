import React from "react";
import { pagePaths, type NavTab } from "../../app/navigation.ts";
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
  Box,
  FileText,
  HelpCircle,
  Zap,
} from "lucide-react";

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
    transportMode,
    setTransportMode,
    mockScenario,
    setMockScenario,
    connectionState,
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
    if (connectionState === "LoadingSnapshot" || (loading && !snapshot)) {
      return {
        label:
          language === "ko" ? "시스템 연결 중..." : "Connecting Systems...",
        bg: "text-[#0071E3] dark:text-[#2997FF]",
        dot: "bg-[#0071E3] animate-pulse",
      };
    }
    if (connectionState === "ConnectingStream") {
      return {
        label: t("connConnecting"),
        bg: "text-[#C93400] dark:text-[#FF9F0A]",
        dot: "bg-[#FF9500] animate-pulse",
      };
    }
    if (connectionState === "Reconciling") {
      return {
        label: t("connReconciling"),
        bg: "text-[#0071E3] dark:text-[#2997FF]",
        dot: "bg-[#0071E3] animate-spin",
      };
    }
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
    <header className="sticky top-0 z-40 w-full h-14 sm:h-16 backdrop-blur-xl bg-[#FBFBFD]/90 dark:bg-black/85 border-b border-black/[0.04] dark:border-white/[0.08] transition-colors duration-300">
      <div className="max-w-[1920px] mx-auto h-full px-4 sm:px-6 lg:px-8 xl:px-10 flex items-center justify-between gap-4">
        {/* Left: Brand Identity & Product Logo */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2.5 select-none">
            {/* Boston Dynamics Atlas Mascot App Icon */}
            <img
              src="/favicon.svg"
              alt="Boston Dynamics Atlas Mascot"
              className="w-8 h-8 rounded-xl shadow-sm select-none"
            />

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-bold text-[15px] tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  MAPF-RL
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#86868B] dark:text-[#A1A1A6]">
                  v1.0
                </span>
              </div>
              <span className="text-[10px] text-[#86868B] font-mono tracking-tight">
                Operator Client
              </span>
            </div>
          </div>

          {/* Center-Left: Global Navigation Single-Shell Tabs */}
          <nav
            aria-label="Main Navigation"
            className="hidden xl:flex items-center gap-1 whitespace-nowrap"
          >
            {[
              { id: "operations", label: t("navOperations") },
              { id: "orders", label: t("navOrders") },
              { id: "scenarios", label: t("navScenarios") },
              { id: "policies", label: t("navPolicies") },
              { id: "events", label: t("navEvents") },
              {
                id: "motion",
                label: language === "ko" ? "속도 프로파일" : "Motion profiles",
              },
            ].map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <a
                  key={`nav-tab-${tab.id}`}
                  href={pagePaths[tab.id as NavTab] + window.location.search}
                  aria-current={isActive ? "page" : undefined}
                  onClick={(event) => {
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    onSelectTab(tab.id as NavTab);
                  }}
                  className={`relative px-3.5 py-2 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "text-[#0071E3] dark:text-[#2997FF] bg-black/[0.03] dark:bg-white/[0.06]"
                      : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0.5 left-3 right-3 h-0.5 bg-[#0071E3] dark:bg-[#2997FF] rounded-full" />
                  )}
                </a>
              );
            })}
          </nav>
        </div>

        <select
          aria-label={language === "ko" ? "화면 선택" : "Select page"}
          className="xl:hidden min-w-0 bg-transparent text-xs text-[#0071E3]"
          value={currentTab}
          onChange={(event) => onSelectTab(event.target.value as NavTab)}
        >
          <option value="operations">{t("navOperations")}</option>
          <option value="orders">{t("navOrders")}</option>
          <option value="scenarios">{t("navScenarios")}</option>
          <option value="policies">{t("navPolicies")}</option>
          <option value="events">{t("navEvents")}</option>
          <option value="motion">
            {language === "ko" ? "속도 프로파일" : "Motion profiles"}
          </option>
        </select>
        {/* Right: Quick Action Controls, Transport, Env & Toggles */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Transport Mode & Scenario Selector Ribbon */}
          <div className="hidden 2xl:flex items-center gap-1 bg-[#F5F5F7] dark:bg-[#1C1C1E] p-1 rounded-full border border-black/[0.06] dark:border-white/[0.08] text-xs">
            {/* Fixture Stream */}
            <button
              onClick={() => setTransportMode("FIXTURE_STREAM")}
              className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1 cursor-pointer ${
                transportMode === "FIXTURE_STREAM"
                  ? "bg-white dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs font-semibold"
                  : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
              }`}
              title="Interactive 10Hz fixture stream simulation"
            >
              <Database className="w-3 h-3 text-[#0071E3] dark:text-[#2997FF]" />
              <span>Fixture 10Hz</span>
            </button>

            {transportMode === "FIXTURE_STREAM" && (
              <select
                value={mockScenario}
                onChange={(e) => setMockScenario(e.target.value as any)}
                className="bg-transparent text-[#1D1D1F] dark:text-[#F5F5F7] font-medium text-[11px] outline-none pr-1 cursor-pointer"
                title="Select Phase 2 Reconciliation scenario"
              >
                <option value="nominal_10hz" className="dark:bg-[#1C1C1E]">
                  10Hz Nominal
                </option>
                <option
                  value="safety_incident_sim"
                  className="dark:bg-[#1C1C1E]"
                >
                  Safety Incident Inject
                </option>
                <option
                  value="duplicate_injection"
                  className="dark:bg-[#1C1C1E]"
                >
                  Duplicate Inject
                </option>
                <option value="gap_injection" className="dark:bg-[#1C1C1E]">
                  Gap Inject
                </option>
                <option value="stale_injection" className="dark:bg-[#1C1C1E]">
                  Stale Inject
                </option>
                <option
                  value="conflict_injection"
                  className="dark:bg-[#1C1C1E]"
                >
                  Conflict Inject
                </option>
                <option
                  value="slow_consumer_burst"
                  className="dark:bg-[#1C1C1E]"
                >
                  Burst Coalesce
                </option>
              </select>
            )}

            {/* Live WebSocket */}
            <button
              onClick={() => setTransportMode("LIVE_WEBSOCKET")}
              className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1 cursor-pointer ${
                transportMode === "LIVE_WEBSOCKET"
                  ? "bg-white dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs font-semibold"
                  : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
              }`}
              title="Connect to live Core WebSocket /ws/v1"
            >
              <Radio className="w-3 h-3 text-[#34C759]" />
              <span>Live WS</span>
            </button>

            {/* 5s Polling Fallback */}
            <button
              onClick={() => setTransportMode("POLLING_FALLBACK")}
              className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1 cursor-pointer ${
                transportMode === "POLLING_FALLBACK"
                  ? "bg-white dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs font-semibold"
                  : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
              }`}
              title="Fallback 5-second REST snapshot polling"
            >
              <span>5s Poll</span>
            </button>
          </div>

          {/* System & Freshness Status */}
          <div
            className={`hidden 2xl:flex items-center gap-1.5 px-1 py-1 text-xs font-medium ${badge.bg}`}
            style={{
              width: 152,
              minWidth: 152,
              maxWidth: 152,
              flex: "0 0 152px",
            }}
            title={badge.label}
          >
            <span
              className={`w-1.5 h-1.5 shrink-0 rounded-full ${badge.dot}`}
            />
            <span className="min-w-0 flex-1 truncate tracking-tight">
              {badge.label}
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refreshSnapshot()}
            disabled={loading}
            className="w-[30px] h-[30px] shrink-0 rounded-full flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] bg-[#F5F5F7] dark:bg-[#1C1C1E] hover:bg-[#EBEBED] dark:hover:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] transition-all focus:outline-none cursor-pointer"
            title="Refresh snapshot data"
            aria-label="Refresh snapshot"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>

          <span className="hidden sm:inline-block w-1 shrink-0 text-center text-[#D2D2D7] dark:text-[#3A3A3C]">
            |
          </span>

          {/* Language Toggle Pill */}
          <button
            onClick={toggleLanguage}
            className="w-[52px] h-[30px] shrink-0 justify-center rounded-full flex items-center gap-1 text-[11px] font-bold bg-[#F5F5F7] dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#EBEBED] dark:hover:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] transition-all focus:outline-none select-none cursor-pointer"
            title={language === "ko" ? "Switch to English" : "한국어로 전환"}
            aria-label="Toggle language"
          >
            <Globe className="w-3 h-3 text-[#0071E3] dark:text-[#2997FF]" />
            <span>{language === "ko" ? "EN" : "KO"}</span>
          </button>

          {/* Theme Toggle Pill */}
          <button
            onClick={toggleTheme}
            className="w-[30px] h-[30px] shrink-0 rounded-full flex items-center justify-center text-[#1D1D1F] dark:text-[#F5F5F7] bg-[#F5F5F7] dark:bg-[#1C1C1E] hover:bg-[#EBEBED] dark:hover:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] transition-all focus:outline-none select-none cursor-pointer"
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
