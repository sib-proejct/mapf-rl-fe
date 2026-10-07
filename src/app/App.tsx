import { MotionProfilesPage } from "../pages/MotionProfilesPage.tsx";
import React, { useEffect, useState } from "react";
import {
  ThemeLanguageProvider,
  useAppConfig,
} from "./providers/ThemeLanguageContext.tsx";
import { LiveMapControl } from "./providers/LiveMapControl.tsx";
import { OperationsProvider } from "./providers/OperationsContext.tsx";
import { TopNavBar } from "../components/common/TopNavBar.tsx";
import { pageFromPath, pagePaths } from "./navigation.ts";
import { OperationsPage } from "../pages/OperationsPage.tsx";
import {
  OrdersPage,
  ScenariosPage,
  PoliciesPage,
  EventsPage,
} from "../pages/SecondaryPages.tsx";

const AppContent: React.FC = () => {
  const { t } = useAppConfig();
  const [currentTab, setCurrentTab] = useState(() =>
    pageFromPath(window.location.pathname),
  );

  useEffect(() => {
    const onPopState = () => {
      setCurrentTab(pageFromPath(window.location.pathname));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return (
    <div className="min-h-screen bg-[#FBFBFD] dark:bg-black text-[#1D1D1F] dark:text-[#F5F5F7] flex flex-col font-sans selection:bg-[#0071E3]/15 selection:text-[#0071E3] transition-colors duration-300">
      {/* 1. Frosted Glass Top Navigation Bar */}
      <TopNavBar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (window.location.pathname !== pagePaths[tab]) {
            window.history.pushState(
              null,
              "",
              pagePaths[tab] + window.location.search,
            );
          }
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      {/* 2. Main Body Content */}
      <main className="flex-1 w-full pb-16">
        {currentTab === "operations" && <OperationsPage />}
        {currentTab === "orders" && <OrdersPage />}
        {currentTab === "scenarios" && <ScenariosPage />}
        {currentTab === "policies" && <PoliciesPage />}
        {currentTab === "events" && <EventsPage />}
        {currentTab === "motion" && <MotionProfilesPage />}
      </main>

      {/* 3. Apple Minimalist Footer */}
      <footer className="border-t border-black/[0.04] dark:border-white/[0.08] bg-[#FBFBFD] dark:bg-black py-8 px-4 sm:px-6 lg:px-8 xl:px-10 text-xs text-[#86868B] font-sans transition-colors duration-300">
        <div className="max-w-[1920px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left: Copyright */}
          <div className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t("footerCopyright")}
          </div>

          {/* Right: Technical Metadata & Status */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-[#86868B]">
            <span>Phase 2 — Realtime Reconciliation Operator Client</span>
            <span className="hidden sm:inline text-[#D2D2D7] dark:text-[#3A3A3C]">
              |
            </span>
            <span className="font-mono text-[11px]">
              Cartesian (+X East, +Y North, CCW Yaw)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeLanguageProvider>
      <LiveMapControl>
        <OperationsProvider>
          <AppContent />
        </OperationsProvider>
      </LiveMapControl>
    </ThemeLanguageProvider>
  );
};

export default App;
