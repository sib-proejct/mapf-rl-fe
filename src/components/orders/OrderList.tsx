import { QueueTaskList } from "./QueueTaskList.tsx";
import { TransportWaveForm } from "./TransportWaveForm.tsx";
import React, { useState } from "react";
import { OrderCreateForm } from "./OrderCreateForm.tsx";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import {
  Box,
  Flag,
  Bot,
  Clock,
  ArrowRight,
  CheckCircle2,
  Plus,
  RotateCcw,
  XCircle,
  Activity,
  Trash2,
  Layers,
} from "lucide-react";
import { formatStateAge } from "../../utils/time/time.ts";

export const STORAGE_KEY_CLEARED_ORDERS = "mapf_cleared_order_ids";

export interface OrderListProps {
  embedded?: boolean;
}

export const OrderList: React.FC<OrderListProps> = ({ embedded = false }) => {
  const { t } = useAppConfig();
  const {
    snapshot,
    nodeCommand,
    retryNodeCommand,
    selectedOrderId,
    setSelectedOrderId,
    setSelectedRobotId,
    isOrderModalOpen,
    setIsOrderModalOpen,
    setActionDialogTarget,
  } = useOperations();

  const [isWaveFormOpen, setIsWaveFormOpen] = useState(false);
  const [orderFilter, setOrderFilter] = useState<"active" | "history" | "all">(
    "active",
  );
  const [clearedOrderIds, setClearedOrderIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLEARED_ORDERS);
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch {
      // Ignore storage errors
    }
    return new Set<string>();
  });

  const allOrders = snapshot?.orders || [];
  const visibleOrdersPool = allOrders.filter(
    (order) => !clearedOrderIds.has(order.id),
  );

  const activeOrders = visibleOrdersPool.filter(
    (order) => !["Completed", "Cancelled", "Rejected"].includes(order.state),
  );
  const historyOrders = visibleOrdersPool.filter((order) =>
    ["Completed", "Cancelled", "Rejected"].includes(order.state),
  );
  const filteredOrders =
    orderFilter === "active"
      ? activeOrders
      : orderFilter === "history"
        ? historyOrders
        : visibleOrdersPool;

  const getLifecycleDot = (state: string) => {
    switch (state) {
      case "Executing":
        return "bg-[#34C759] dark:bg-[#30D158]";
      case "Applied":
        return "bg-[#0071E3] dark:bg-[#2997FF]";
      case "Dispatched":
      case "Dispatchable":
        return "bg-[#64D2FF]";
      case "Planning":
      case "Submitted":
        return "bg-[#AF52DE]";
      case "Cancelling":
      case "Held":
      case "Replanning":
        return "bg-[#FF9500] dark:bg-[#FF9F0A]";
      case "Cancelled":
      case "Rejected":
        return "bg-[#FF3B30] dark:bg-[#FF453A]";
      case "Completed":
      default:
        return "bg-[#86868B]";
    }
  };

  const getLifecycleBadge = (state: string) => {
    switch (state) {
      case "Executing":
        return "bg-[#34C759]/10 text-[#248A3D] dark:text-[#30D158] border-[#34C759]/20";
      case "Applied":
        return "bg-[#0071E3]/15 text-[#0071E3] dark:text-[#2997FF] border-[#0071E3]/30 font-bold";
      case "Dispatched":
      case "Dispatchable":
        return "bg-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF] border-[#0071E3]/20";
      case "Planning":
      case "Submitted":
        return "bg-[#AF52DE]/10 text-[#AF52DE] border-[#AF52DE]/20";
      case "Cancelling":
      case "Held":
      case "Replanning":
        return "bg-[#FF9500]/10 text-[#C93400] dark:text-[#FF9F0A] border-[#FF9500]/20";
      case "Cancelled":
      case "Rejected":
        return "bg-[#FF3B30]/10 text-[#D70015] dark:text-[#FF453A] border-[#FF3B30]/20";
      case "Completed":
      default:
        return "bg-black/5 dark:bg-white/10 text-[#6E6E73] dark:text-[#86868B] border-transparent";
    }
  };

  const getLifecycleStepIndex = (state: string) => {
    switch (state) {
      case "Submitted":
        return 0;
      case "Planning":
        return 1;
      case "Dispatchable":
      case "Dispatched":
        return 2;
      case "Applied":
        return 3;
      case "Executing":
        return 4;
      case "Completed":
        return 5;
      default:
        return 2;
    }
  };

  return (
    <div
      className={
        embedded
          ? "flex flex-col h-full overflow-hidden"
          : "apple-card p-4 sm:p-5 flex flex-col h-[560px] sm:h-[600px] transition-colors duration-300"
      }
    >
      {/* Header */}
      <div className="space-y-2.5 mb-3.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#0071E3]/10 dark:bg-[#2997FF]/15 flex items-center justify-center text-[#0071E3] dark:text-[#2997FF]">
              <Box className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
              {t("orderListTitle")}
            </h3>
            <span className="text-[11px] font-mono font-bold bg-[#F5F5F7] dark:bg-[#252528] text-[#86868B] px-2 py-0.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] tabular-nums">
              {filteredOrders.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {historyOrders.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t("orderClearHistoryConfirm"))) {
                    const next = new Set(clearedOrderIds);
                    historyOrders.forEach((o) => next.add(o.id));
                    setClearedOrderIds(next);
                    try {
                      localStorage.setItem(
                        STORAGE_KEY_CLEARED_ORDERS,
                        JSON.stringify(Array.from(next)),
                      );
                      window.dispatchEvent(new Event("mapf_cleared_orders"));
                    } catch {
                      // Ignore storage errors
                    }
                    if (orderFilter === "history") {
                      setOrderFilter("active");
                    }
                  }
                }}
                className="px-2 py-1 rounded-full text-gray-500 hover:text-[#C93400] hover:bg-[#C93400]/10 text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                title={t("orderClearHistory")}
              >
                <Trash2 className="w-3 h-3" />
                <span>{t("orderClearHistory")}</span>
              </button>
            )}
            <button
              type="button"
              disabled={isWaveFormOpen}
              onClick={() => {
                setIsWaveFormOpen(true);
                setIsOrderModalOpen(false);
              }}
              className="px-2.5 py-1 rounded-full bg-[#0071E3]/10 dark:bg-[#2997FF]/15 text-[#0071E3] dark:text-[#2997FF] hover:bg-[#0071E3]/20 dark:hover:bg-[#2997FF]/25 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer border border-[#0071E3]/20 dark:border-[#2997FF]/30 disabled:opacity-50"
              title={t("orderNewTransport")}
            >
              <Layers className="w-3 h-3" />
              <span>{t("orderNewTransport")}</span>
            </button>
            <button
              type="button"
              disabled={isOrderModalOpen}
              onClick={() => {
                setIsOrderModalOpen(true);
                setIsWaveFormOpen(false);
              }}
              className="px-2.5 py-1 rounded-full bg-[#0071E3] dark:bg-[#2997FF] text-white text-[11px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Plus className="w-3 h-3" />
              <span>New Order</span>
            </button>
          </div>
        </div>

        {/* Filter Segmented Control */}
        <div
          role="group"
          aria-label={t("orderListTitle")}
          className="inline-flex p-1 bg-black/5 dark:bg-white/5 rounded-xl gap-1 text-xs"
        >
          {(
            [
              ["active", t("orderFilterActive"), activeOrders.length],
              ["history", t("orderFilterHistory"), historyOrders.length],
              ["all", t("orderFilterAll"), visibleOrdersPool.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              aria-pressed={orderFilter === value}
              onClick={() => setOrderFilter(value)}
              className={`rounded-lg px-2.5 py-1 font-medium transition-all ${
                orderFilter === value
                  ? "bg-white dark:bg-[#2C2C2E] shadow-sm text-black dark:text-white"
                  : "text-gray-500 hover:text-black dark:hover:text-white"
              }`}
            >
              {label}{" "}
              <span className="opacity-70 font-mono text-[11px]">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {nodeCommand && (
          <div
            role={
              nodeCommand.state === "rejected" ||
              nodeCommand.state === "uncertain"
                ? "alert"
                : "status"
            }
            className="p-3 rounded-xl bg-[#0071E3]/10 text-xs text-[#1D1D1F] dark:text-[#F5F5F7] space-y-2"
          >
            <p className="font-semibold">
              {nodeCommand.robotId} → Node {nodeCommand.nodeId}
            </p>
            <p>
              {nodeCommand.state === "submitting"
                ? "명령 제출 중…"
                : nodeCommand.state === "confirmed"
                  ? "주문이 접수되었습니다."
                  : nodeCommand.error ||
                    nodeCommand.mutation?.error?.detail ||
                    "응답을 확인하지 못했습니다. 같은 요청으로 재시도하세요."}
            </p>
            {nodeCommand.state === "uncertain" && (
              <button
                type="button"
                onClick={() => void retryNodeCommand()}
                className="text-[#0071E3] dark:text-[#2997FF] underline"
              >
                {t("actionRetrySameId")}
              </button>
            )}
          </div>
        )}
        <OrderCreateForm />
        <TransportWaveForm
          open={isWaveFormOpen}
          onOpenChange={setIsWaveFormOpen}
          hideTrigger={true}
        />
        <QueueTaskList filter={orderFilter} />
        {filteredOrders.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#86868B]">
            <p className="font-medium">{t("orderNoOrders")}</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isSelected = order.id === selectedOrderId;
            const stepIdx = getLifecycleStepIndex(order.state);
            const isAppAck = order.state === "Applied";
            const isExec = order.state === "Executing";

            return (
              <div
                key={`order-card-${order.id}`}
                onClick={() => setSelectedOrderId(order.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2.5 outline-none ${
                  isSelected
                    ? "bg-[#0071E3]/[0.08] dark:bg-[#2997FF]/15 border-[#0071E3]/50 dark:border-[#2997FF]/60 shadow-xs ring-1 ring-[#0071E3]/20"
                    : "bg-white dark:bg-[#1C1C1E] hover:bg-[#F5F5F7]/80 dark:hover:bg-[#252528]/80 border-black/[0.05] dark:border-white/[0.07] hover:border-black/15 dark:hover:border-white/20"
                }`}
              >
                {/* Order Top Bar: ID & State Pill */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] min-w-0 truncate">
                    <span className="truncate">{order.id}</span>
                    <span className="text-[10px] font-normal text-[#86868B] bg-[#F5F5F7] dark:bg-[#252528] px-1.5 py-0.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] shrink-0 whitespace-nowrap">
                      #{order.orderUpdateId}
                    </span>
                  </div>

                  <div
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold shrink-0 whitespace-nowrap ${getLifecycleBadge(
                      order.state,
                    )}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${getLifecycleDot(
                        order.state,
                      )}`}
                    />
                    <span className="whitespace-nowrap">
                      {isAppAck
                        ? "Applied (Ack)"
                        : isExec
                          ? "Executing (Motion)"
                          : order.state}
                    </span>
                  </div>
                </div>

                {/* Micro 5-Step Lifecycle Progression */}
                <div className="flex items-center gap-1 py-1">
                  {[
                    { label: "Plan", idx: 1 },
                    { label: "Route", idx: 2 },
                    { label: "App Ack", idx: 3 },
                    { label: "Exec", idx: 4 },
                    { label: "Done", idx: 5 },
                  ].map((s) => {
                    const isDone = s.idx <= stepIdx;
                    return (
                      <div
                        key={`step-${s.idx}`}
                        className="flex-1 flex flex-col gap-1 min-w-0"
                      >
                        <div
                          className={`h-1 rounded-full transition-all duration-300 ${
                            isDone
                              ? "bg-[#0071E3] dark:bg-[#2997FF]"
                              : "bg-[#F5F5F7] dark:bg-[#252528]"
                          }`}
                        />
                        <span
                          className={`text-[8px] sm:text-[9px] text-center font-medium whitespace-nowrap truncate ${
                            isDone
                              ? "text-[#0071E3] dark:text-[#2997FF] font-semibold"
                              : "text-[#86868B]"
                          }`}
                        >
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Assignments List */}
                <div className="space-y-1.5 text-xs">
                  {order.assignments.map((assign, aIdx) => (
                    <div
                      key={`assign-${aIdx}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRobotId(assign.robotId);
                      }}
                      className="flex items-center justify-between gap-2 text-[11px] bg-[#F5F5F7] dark:bg-[#252528] px-2.5 py-1.5 rounded-xl hover:bg-[#0071E3]/15 transition-colors group cursor-pointer border border-black/[0.02] dark:border-white/[0.03] min-w-0"
                    >
                      <div className="flex items-center gap-1.5 font-mono min-w-0 truncate">
                        <Bot className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#2997FF] shrink-0" />
                        <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:text-[#0071E3] dark:group-hover:text-[#2997FF] truncate">
                          {assign.robotId}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 font-mono tabular-nums text-[#86868B] shrink-0 whitespace-nowrap">
                        <Flag className="w-3 h-3 text-[#0071E3] dark:text-[#2997FF] shrink-0" />
                        <span className="whitespace-nowrap">
                          {assign.arrivalAction ?? "MOVE"} ({assign.goalColumn},{" "}
                          {assign.goalRow})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {order.assignments.map((assignment) => {
                  const station = snapshot?.robots.find(
                    (robot) => robot.id === assignment.robotId,
                  )?.stationState;
                  return (
                    station?.orderId === order.id && (
                      <p
                        key={`station-${assignment.robotId}`}
                        className="text-[11px] text-[#86868B]"
                      >
                        {station.action} · {station.phase} ·{" "}
                        {station.loaded ? "적재됨" : "빈 로봇"} ·{" "}
                        {station.batteryPercent.toFixed(1)}%
                      </p>
                    )
                  );
                })}
                {/* Bottom Bar: Age & Quick Actions */}
                <div className="flex items-center justify-between text-[10px] font-mono text-[#86868B] pt-1.5 border-t border-black/[0.03] dark:border-white/[0.05]">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {order.state === "Completed" ||
                      order.state === "Cancelled" ||
                      order.state === "Rejected"
                        ? order.submittedAtUtc && order.updatedAtUtc
                          ? formatStateAge(
                              order.submittedAtUtc,
                              new Date(order.updatedAtUtc).getTime(),
                            )
                          : "—"
                        : order.submittedAtUtc
                          ? formatStateAge(order.submittedAtUtc)
                          : "—"}
                    </span>
                  </div>

                  {order.state !== "Cancelled" &&
                    order.state !== "Completed" &&
                    order.state !== "Rejected" && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={order.state === "Cancelling"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionDialogTarget({
                              operation: "CANCEL_ORDER",
                              order,
                            });
                          }}
                          className="text-[#D70015] dark:text-[#FF453A] hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {order.state === "Cancelling" ? "취소 중…" : "Cancel"}
                        </button>
                      </div>
                    )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
