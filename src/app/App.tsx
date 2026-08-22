import React, { useState } from "react";
import {
  ThemeLanguageProvider,
  useAppConfig,
} from "./providers/ThemeLanguageContext.tsx";
import { OperationsProvider } from "./providers/OperationsContext.tsx";
import { TopNavBar, NavTab } from "../components/common/TopNavBar.tsx";
import { OperationsPage } from "../pages/OperationsPage.tsx";
import {
  OrdersPage,
  ScenariosPage,
  PoliciesPage,
  EventsPage,
} from "../pages/SecondaryPages.tsx";

const AppContent: React.FC = () => {
  const { t } = useAppConfig();
  const [currentTab, setCurrentTab] = useState<NavTab>("operations");

  return (
    <div className="min-h-screen bg-apple-canvas text-apple-text-primary flex flex-col font-sans selection:bg-apple-blue/15 selection:text-apple-blue transition-colors duration-200">
      {/* 1. Frosted Glass Top Navigation Bar */}
      <TopNavBar
        currentTab={currentTab}
        onSelectTab={(tab) => {
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
      </main>

      {/* 3. Apple-style Minimalist Footer */}
      <footer className="border-t border-apple-border bg-apple-surface/60 py-6 px-4 sm:px-6 text-xs text-apple-text-secondary transition-colors duration-200">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-medium text-apple-text-primary">
            {t("footerCopyright")}
          </div>
          <div className="flex items-center gap-4 text-apple-text-tertiary">
            <span>Phase 1 — Read-only Operator Client</span>
            <span>•</span>
            <span>Cartesian Right-Handed (+X East, +Y North, CCW Yaw)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeLanguageProvider>
      <OperationsProvider>
        <AppContent />
      </OperationsProvider>
    </ThemeLanguageProvider>
  );
};

export default App;
