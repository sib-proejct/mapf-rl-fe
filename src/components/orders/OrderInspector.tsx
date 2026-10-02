import React, { useState } from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import {
  Box,
  Bot,
  Flag,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X,
  Copy,
  Check,
  Activity,
  Layers,
  Sparkles,
  Sliders,
  Send,
  Zap,
} from "lucide-react";
import { formatStateAge, formatUtcIso } from "../../utils/time/time.ts";
import { formatShortId, copyToClipboard } from "../../utils/ids/ids.ts";
import type { OrderLifecycleState } from "../../domain/order/types.ts";

export interface OrderInspectorProps {
  embedded?: boolean;
}

export const OrderInspector: React.FC<OrderInspectorProps> = ({
  embedded = false,
}) => {
  const { t } = useAppConfig();
  const {
    snapshot,
    selectedOrderId,
    setSelectedOrderId,
    selectedOrder,
    setSelectedRobotId,
    setActionDialogTarget,
    transportMode,
  } = useOperations();

  const [copiedId, setCopiedId] = useState<boolean>(false);

  if (!selectedOrder) {
    return (
      <div className="p-8 text-center text-xs text-[#86868B]">
        Select an order from the list to view lifecycle timeline and details.
      </div>
    );
  }

  const handleCopyId = async () => {
    const ok = await copyToClipboard(selectedOrder.id);
    if (ok) {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    }
  };

  const getTimelineBadge = (state: OrderLifecycleState) => {
    switch (state) {
      case "Executing":
        return "bg-[#34C759]/15 text-[#248A3D] dark:text-[#30D158] border-[#34C759]/30";
      case "Applied":
        return "bg-[#0071E3]/15 text-[#0071E3] dark:text-[#2997FF] border-[#0071E3]/30";
      case "Planning":
      case "Submitted":
        return "bg-[#AF52DE]/15 text-[#AF52DE] border-[#AF52DE]/30";
      case "Held":
      case "Replanning":
        return "bg-[#FF9500]/15 text-[#C93400] dark:text-[#FF9F0A] border-[#FF9500]/30";
      case "Cancelled":
      case "Rejected":
        return "bg-[#FF3B30]/15 text-[#D70015] dark:text-[#FF453A] border-[#FF3B30]/30";
      case "Completed":
      default:
        return "bg-black/5 dark:bg-white/10 text-[#6E6E73] dark:text-[#86868B] border-transparent";
    }
  };

  const timeline = selectedOrder.timeline || [
    {
      id: `tl-${selectedOrder.id}-0`,
      state: "Submitted" as OrderLifecycleState,
      occurredAtUtc: selectedOrder.submittedAtUtc || new Date().toISOString(),
      orderUpdateId: 0,
      actor: "Operator" as const,
      detail: "Order submitted with client requestId",
    },
  ];

  return (
    <div className="space-y-4 text-xs animate-fade-in">
      {/* 1. Header Card */}
      <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#252528] border border-black/[0.04] dark:border-white/[0.06] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono">
            <span className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {selectedOrder.id}
            </span>
            <button
              onClick={handleCopyId}
              className="p-1 rounded-md text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Copy Order ID"
            >
              {copiedId ? (
                <Check className="w-3.5 h-3.5 text-[#34C759]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${getTimelineBadge(
              selectedOrder.state,
            )}`}
          >
            {selectedOrder.state}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#86868B]">
          <div>
            <span>Update Sequence: </span>
            <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              #{selectedOrder.orderUpdateId}
            </span>
          </div>
          <div>
            <span>Plan Revision: </span>
            <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {selectedOrder.planRevisionId
                ? formatShortId(selectedOrder.planRevisionId, 6, 3)
                : "rev-0"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Target Goal Assignments */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.04] dark:border-white/[0.06] space-y-2">
        <h4 className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider">
          {t("orderAssignments")}
        </h4>
        <div className="space-y-1.5">
          {selectedOrder.assignments.map((assign, idx) => (
            <div
              key={`assign-row-${idx}`}
              onClick={() => setSelectedRobotId(assign.robotId)}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#252528] hover:bg-[#0071E3]/10 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2 font-mono">
                <Bot className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#2997FF]" />
                <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:text-[#0071E3]">
                  {assign.robotId}
                </span>
              </div>

              <div className="flex items-center gap-1 font-mono text-[11px] text-[#86868B]">
                <Flag className="w-3.5 h-3.5 text-[#34C759]" />
                <span>
                  Goal ({assign.goalColumn}, {assign.goalRow})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Application Ack vs Execution State Notice */}
      <div className="p-3.5 rounded-2xl bg-[#0071E3]/5 dark:bg-[#2997FF]/10 border border-[#0071E3]/20 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[#0071E3] dark:text-[#2997FF] font-bold text-[11px]">
          <Activity className="w-3.5 h-3.5" />
          <span>Application Ack vs Execution State</span>
        </div>
        <p className="text-[10px] text-[#86868B] leading-relaxed">
          <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">
            Applied:
          </strong>{" "}
          Simulator acknowledged order command.{" "}
          <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">
            Executing:
          </strong>{" "}
          Simulator runtime reported active kinematic physics traversal.
        </p>
      </div>

      {/* 4. Order Lifecycle Timeline */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.04] dark:border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
          <h4 className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider">
            {t("timelineTitle")}
          </h4>
          <span className="font-mono text-[10px] text-[#86868B]">
            {timeline.length} events
          </span>
        </div>

        <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-black/[0.06] dark:before:bg-white/[0.08]">
          {timeline.map((entry, idx) => {
            const isLast = idx === timeline.length - 1;
            const isAppAck =
              entry.isApplicationAck || entry.state === "Applied";
            const isExec =
              entry.isExecutionReport || entry.state === "Executing";

            return (
              <div key={`tl-item-${idx}`} className="relative space-y-1">
                {/* Timeline Dot */}
                <div
                  className={`absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#1C1C1E] ${
                    isLast
                      ? "bg-[#0071E3] dark:bg-[#2997FF]"
                      : isExec
                        ? "bg-[#34C759]"
                        : isAppAck
                          ? "bg-[#0071E3]"
                          : "bg-[#86868B]"
                  }`}
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {entry.state}
                    </span>
                    {isAppAck && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-[#0071E3]/15 text-[#0071E3] dark:text-[#2997FF]">
                        App Ack
                      </span>
                    )}
                    {isExec && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-[#34C759]/15 text-[#248A3D] dark:text-[#30D158]">
                        Executing
                      </span>
                    )}
                  </div>

                  <span className="font-mono text-[10px] text-[#86868B]">
                    {formatStateAge(entry.occurredAtUtc)}
                  </span>
                </div>

                <p className="text-[11px] text-[#86868B]">
                  {entry.detail || `Order state updated to ${entry.state}`}
                </p>

                <div className="flex items-center gap-2 text-[10px] font-mono text-[#86868B]">
                  <span>Actor: {entry.actor || "Core MAPF"}</span>
                  <span>•</span>
                  <span>Ver #{entry.orderUpdateId}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Operator Actions Toolbar */}
      <div className="pt-2 flex items-center gap-2">
        {selectedOrder.state !== "Cancelled" &&
          selectedOrder.state !== "Completed" && (
            <>
              <button
                type="button"
                disabled={transportMode !== "FIXTURE_STREAM"}
                title={
                  transportMode !== "FIXTURE_STREAM"
                    ? "Disabled until Core exposes an authoritative cancel endpoint"
                    : undefined
                }
                onClick={() =>
                  setActionDialogTarget({
                    operation: "CANCEL_ORDER",
                    order: selectedOrder,
                  })
                }
                className="flex-1 py-2 px-3 rounded-xl bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#D70015] dark:text-[#FF453A] font-semibold text-xs transition-colors border border-[#FF3B30]/20 cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("actionCancelTitle")}
              </button>

              <button
                type="button"
                disabled={transportMode !== "FIXTURE_STREAM"}
                title={
                  transportMode !== "FIXTURE_STREAM"
                    ? "Disabled until Core exposes an authoritative reassign endpoint"
                    : undefined
                }
                onClick={() =>
                  setActionDialogTarget({
                    operation: "REASSIGN_ORDER",
                    order: selectedOrder,
                  })
                }
                className="flex-1 py-2 px-3 rounded-xl bg-[#0071E3]/10 hover:bg-[#0071E3]/20 text-[#0071E3] dark:text-[#2997FF] font-semibold text-xs transition-colors border border-[#0071E3]/20 cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("actionReassignTitle")}
              </button>
            </>
          )}
      </div>
    </div>
  );
};
