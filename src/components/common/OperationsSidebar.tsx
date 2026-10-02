import React, { useState, useEffect, useRef } from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import { RobotList } from "../robots/RobotList.tsx";
import { RobotInspector } from "../robots/RobotInspector.tsx";
import { OrderList } from "../orders/OrderList.tsx";
import { Bot, Activity, Box } from "lucide-react";

export type SidebarTab = "fleet" | "orders";

export interface OperationsSidebarProps {
  className?: string;
}

export const OperationsSidebar: React.FC<OperationsSidebarProps> = ({
  className = "",
}) => {
  const { t } = useAppConfig();
  const {
    snapshot,
    selectedRobotId,
    selectedNodeId,
    isOrderModalOpen,
    nodeCommand,
  } = useOperations();

  const [activeTab, setActiveTab] = useState<SidebarTab>("fleet");

  const robots = snapshot?.robots || [];
  const orders = snapshot?.orders || [];

  // If robot or node is selected, ensure we are on the fleet tab where inline inspector lives
  useEffect(() => {
    if (
      !isOrderModalOpen &&
      !nodeCommand &&
      (selectedRobotId || selectedNodeId !== null)
    ) {
      setActiveTab("fleet");
    }
  }, [selectedRobotId, selectedNodeId]);

  useEffect(() => {
    if (isOrderModalOpen) setActiveTab("orders");
  }, [isOrderModalOpen]);

  useEffect(() => {
    if (nodeCommand) setActiveTab("orders");
  }, [nodeCommand]);

  return (
    <div
      className={`apple-card flex flex-col h-full min-h-[400px] p-3.5 sm:p-4 overflow-hidden transition-colors duration-300 ${className}`}
    >
      {/* 1. Apple-style Segmented Ribbon Tab Header (2 Tabs: Fleet / Orders) */}
      <div className="shrink-0 pb-3 border-b border-black/[0.04] dark:border-white/[0.06]">
        <div className="grid grid-cols-2 bg-[#F2F4F6] dark:bg-[#252528] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] text-xs gap-1">
          {/* Tab 1: Fleet Robots & Inspector */}
          <button
            disabled={isOrderModalOpen}
            onClick={() => setActiveTab("fleet")}
            className={`py-2 px-3 rounded-xl font-semibold transition-all duration-200 cursor-pointer select-none flex items-center justify-center gap-1.5 ${
              activeTab === "fleet"
                ? "bg-white dark:bg-[#1C1C1E] text-[#191F28] dark:text-[#F5F5F7] font-bold shadow-xs border border-black/[0.04] dark:border-white/[0.06]"
                : "text-[#8B95A1] dark:text-[#86868B] hover:text-[#191F28] dark:hover:text-[#F5F5F7] font-medium"
            }`}
            title={t("robotListTitle")}
          >
            <Bot
              className={`w-3.5 h-3.5 ${
                activeTab === "fleet"
                  ? "text-[#0071E3] dark:text-[#2997FF]"
                  : "text-[#8B95A1] dark:text-[#86868B]"
              }`}
            />
            <span className="truncate">{t("robotListTitle")}</span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full tabular-nums ${
                activeTab === "fleet"
                  ? "bg-[#0071E3]/10 dark:bg-[#2997FF]/15 text-[#0071E3] dark:text-[#2997FF]"
                  : "bg-black/5 dark:bg-white/5 text-[#86868B]"
              }`}
            >
              {robots.length}
            </span>
          </button>

          {/* Tab 2: Active Orders */}
          <button
            onClick={() => setActiveTab("orders")}
            className={`py-2 px-3 rounded-xl font-semibold transition-all duration-200 cursor-pointer select-none flex items-center justify-center gap-1.5 ${
              activeTab === "orders"
                ? "bg-white dark:bg-[#1C1C1E] text-[#191F28] dark:text-[#F5F5F7] font-bold shadow-xs border border-black/[0.04] dark:border-white/[0.06]"
                : "text-[#8B95A1] dark:text-[#86868B] hover:text-[#191F28] dark:hover:text-[#F5F5F7] font-medium"
            }`}
            title={t("orderListTitle")}
          >
            <Box
              className={`w-3.5 h-3.5 ${
                activeTab === "orders"
                  ? "text-[#0071E3] dark:text-[#2997FF]"
                  : "text-[#8B95A1] dark:text-[#86868B]"
              }`}
            />
            <span className="truncate">{t("orderListTitle")}</span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full tabular-nums ${
                activeTab === "orders"
                  ? "bg-[#0071E3]/10 dark:bg-[#2997FF]/15 text-[#0071E3] dark:text-[#2997FF]"
                  : "bg-black/5 dark:bg-white/5 text-[#86868B]"
              }`}
            >
              {orders.length}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Embedded Dynamic Content Panel */}
      <div className="flex-1 min-h-0 pt-3">
        {activeTab === "fleet" && <RobotList embedded />}
        {activeTab === "orders" && <OrderList embedded />}
      </div>
    </div>
  );
};
