import React, { useState } from "react";
import { useOperations } from "../app/providers/OperationsContext.tsx";
import { IncidentStrip } from "../components/common/IncidentStrip.tsx";
import { BentoStatusRail } from "../components/common/BentoStatusRail.tsx";
import { MapCanvas } from "../components/map/MapCanvas.tsx";
import { AccessibleMapList } from "../components/map/AccessibleMapList.tsx";
import { RobotList } from "../components/robots/RobotList.tsx";
import { RobotInspector } from "../components/robots/RobotInspector.tsx";
import { OrderList } from "../components/orders/OrderList.tsx";
import {
  LoadingSkeleton,
  EmptyStateView,
  ErrorStateView,
} from "../components/common/StateViews.tsx";
import { Table, Eye, Layers } from "lucide-react";
import { useAppConfig } from "../app/providers/ThemeLanguageContext.tsx";

export const OperationsPage: React.FC = () => {
  const { t } = useAppConfig();
  const { snapshot, loading, error, refreshSnapshot, selectedRobotId } =
    useOperations();

  const [viewMode, setViewMode] = useState<"canvas" | "accessible">("canvas");

  if (loading && !snapshot) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <ErrorStateView problem={error} onRetry={refreshSnapshot} />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <EmptyStateView />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* 1. Persistent Incident & Status Alert Strip */}
      <IncidentStrip />

      {/* 2. Bento Status Rail */}
      <BentoStatusRail />

      {/* 3. Main Dashboard Layout: Map Canvas + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left / Center (8 cols on large screens): Map or Accessible Table View */}
        <div className="lg:col-span-8 space-y-4">
          {/* View Mode Toggle Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 p-1 rounded-full border border-apple-border text-xs">
              <button
                onClick={() => setViewMode("canvas")}
                className={`px-3 py-1 rounded-full font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === "canvas"
                    ? "bg-white dark:bg-[#1C1C1E] text-apple-text-primary shadow-xs font-semibold"
                    : "text-apple-text-secondary hover:text-apple-text-primary"
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-apple-blue" />
                <span>{t("mapCanvasView")}</span>
              </button>

              <button
                onClick={() => setViewMode("accessible")}
                className={`px-3 py-1 rounded-full font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === "accessible"
                    ? "bg-white dark:bg-[#1C1C1E] text-apple-text-primary shadow-xs font-semibold"
                    : "text-apple-text-secondary hover:text-apple-text-primary"
                }`}
              >
                <Table className="w-3.5 h-3.5 text-emerald-500" />
                <span>{t("mapAccessibleView")}</span>
              </button>
            </div>
          </div>

          {/* Render Active View */}
          {viewMode === "canvas" ? (
            <div className="space-y-4">
              <MapCanvas />
              {/* Also include Accessible Table below canvas for seamless keyboard/screen-reader navigation */}
              <AccessibleMapList />
            </div>
          ) : (
            <AccessibleMapList />
          )}
        </div>

        {/* Right Pane (4 cols on large screens): Robot List, Inspector Drawer, Order List */}
        <div className="lg:col-span-4 space-y-5">
          {/* Selected Robot Inspector Drawer (shows when a robot is selected) */}
          {selectedRobotId && (
            <div className="min-h-[380px]">
              <RobotInspector />
            </div>
          )}

          {/* Robot List */}
          <RobotList />

          {/* Active Orders List */}
          <OrderList />
        </div>
      </div>
    </div>
  );
};
