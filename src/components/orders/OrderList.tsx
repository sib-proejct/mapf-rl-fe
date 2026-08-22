import React from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import { Box, Flag, Bot, Clock } from "lucide-react";
import { formatStateAge } from "../../utils/time/time.ts";

export const OrderList: React.FC = () => {
  const { t } = useAppConfig();
  const { snapshot, selectedOrderId, setSelectedOrderId, setSelectedRobotId } =
    useOperations();

  const orders = snapshot?.orders || [];

  const getLifecycleBadge = (state: string) => {
    switch (state) {
      case "Executing":
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "Applied":
        return "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/20";
      case "Dispatched":
      case "Dispatchable":
        return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "Planning":
      case "Submitted":
        return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20";
      case "Held":
      case "Replanning":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "Completed":
        return "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20";
      case "Cancelled":
      case "Rejected":
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20";
      default:
        return "bg-black/5 dark:bg-white/10 text-apple-text-secondary";
    }
  };

  return (
    <div className="apple-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-apple-divider pb-2.5">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-apple-blue" />
          <h3 className="text-sm font-bold text-apple-text-primary">
            {t("orderListTitle")}
          </h3>
          <span className="text-xs font-mono font-bold bg-black/5 dark:bg-white/10 text-apple-text-secondary px-1.5 py-0.5 rounded-full">
            {orders.length}
          </span>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-2">
        {orders.length === 0 ? (
          <div className="py-8 text-center text-xs text-apple-text-tertiary">
            {t("orderNoOrders")}
          </div>
        ) : (
          orders.map((order) => {
            const isSelected = order.id === selectedOrderId;

            return (
              <div
                key={`order-card-${order.id}`}
                onClick={() => setSelectedOrderId(order.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                  isSelected
                    ? "bg-apple-blue/10 border-apple-blue shadow-xs font-semibold"
                    : "bg-apple-surface hover:bg-black/[0.02] dark:hover:bg-white/[0.04] border-apple-border"
                }`}
              >
                {/* Order Top Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-apple-text-primary">
                    <span>{order.id}</span>
                    <span className="text-[10px] font-normal text-apple-text-secondary bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
                      update #{order.orderUpdateId}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getLifecycleBadge(
                      order.state,
                    )}`}
                  >
                    {order.state}
                  </span>
                </div>

                {/* Assignments List */}
                <div className="space-y-1 text-xs">
                  {order.assignments.map((assign, aIdx) => (
                    <div
                      key={`assign-${aIdx}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRobotId(assign.robotId);
                      }}
                      className="flex items-center justify-between text-[11px] bg-apple-surface-subtle px-2 py-1 rounded-lg hover:bg-apple-blue/15 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5 font-mono">
                        <Bot className="w-3 h-3 text-apple-blue" />
                        <span className="font-semibold text-apple-text-primary group-hover:text-apple-blue">
                          {assign.robotId}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 font-mono tabular-nums text-apple-text-secondary">
                        <Flag className="w-3 h-3 text-apple-blue" />
                        <span>
                          Goal ({assign.goalColumn}, {assign.goalRow})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Submitted / Updated At */}
                {order.submittedAtUtc && (
                  <div className="flex items-center gap-1 text-[10px] font-mono text-apple-text-tertiary pt-1 border-t border-apple-divider">
                    <Clock className="w-3 h-3" />
                    <span>
                      Submitted {formatStateAge(order.submittedAtUtc)}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
