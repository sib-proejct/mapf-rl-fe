import React, { useState } from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import {
  AlertTriangle,
  ShieldAlert,
  Pause,
  Play,
  RotateCcw,
  X,
  CheckCircle2,
  RefreshCw,
  Zap,
} from "lucide-react";
import type { PendingMutation } from "../../domain/mutation/types.ts";

export const OrderActionDialog: React.FC = () => {
  const { t } = useAppConfig();
  const {
    actionDialogTarget,
    setActionDialogTarget,
    cancelOrder,
    reassignOrder,
    sendInstantAction,
    acknowledgeIncident,
    resolveIncident,
    retryMutation,
  } = useOperations();

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastMutation, setLastMutation] = useState<PendingMutation | null>(
    null,
  );

  // Reassign inputs
  const [newCol, setNewCol] = useState<number>(20);
  const [newRow, setNewRow] = useState<number>(14);

  if (!actionDialogTarget) return null;

  const { operation, order, robot, incident } = actionDialogTarget;

  const handleClose = () => {
    if (isSubmitting) return;
    setActionDialogTarget(null);
    setLastMutation(null);
  };

  const handleConfirm = async () => {
    if (isSubmitting) return; // Prevent double-submit
    setIsSubmitting(true);

    try {
      let mut: PendingMutation;

      if (operation === "CANCEL_ORDER" && order) {
        mut = await cancelOrder({
          orderId: order.id,
          orderUpdateId: order.orderUpdateId,
          reason: "Operator manual cancellation from control drawer",
        });
      } else if (operation === "REASSIGN_ORDER" && order) {
        mut = await reassignOrder({
          orderId: order.id,
          orderUpdateId: order.orderUpdateId,
          assignments: [
            {
              robotId: order.assignments[0]?.robotId || "robot-01",
              goalColumn: Number(newCol),
              goalRow: Number(newRow),
            },
          ],
          reason: "Operator manual target reassignment",
        });
      } else if (operation === "INSTANT_ACTION" && robot) {
        mut = await sendInstantAction({
          robotId: robot.id,
          action: "ESTOP",
          reason: "Operator triggered Emergency Stop",
        });
      } else if (operation === "ACKNOWLEDGE_INCIDENT" && incident) {
        mut = await acknowledgeIncident({
          incidentId: incident.id,
          action: "ACKNOWLEDGE",
        });
      } else if (operation === "RESOLVE_INCIDENT" && incident) {
        mut = await resolveIncident({
          incidentId: incident.id,
          action: "RESOLVE",
        });
      } else {
        return;
      }

      setLastMutation(mut);
      if (mut.state === "confirmed") {
        setTimeout(() => {
          handleClose();
        }, 1200);
      }
    } catch (err: unknown) {
      console.error("Action failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = async () => {
    if (!lastMutation || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const retried = await retryMutation(lastMutation.requestId);
      setLastMutation(retried);
      if (retried.state === "confirmed") {
        setTimeout(() => {
          handleClose();
        }, 1200);
      }
    } catch (err: unknown) {
      console.error("Retry failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDestructive =
    operation === "CANCEL_ORDER" ||
    (operation === "INSTANT_ACTION" && robot?.safety !== "EMERGENCY_STOP");

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/75 backdrop-blur-md animate-fade-in"
    >
      <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] shadow-2xl rounded-3xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-black/[0.04] dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isDestructive
                  ? "bg-[#FF3B30]/15 dark:bg-[#FF453A]/20 text-[#D70015] dark:text-[#FF453A]"
                  : "bg-[#0071E3]/10 dark:bg-[#2997FF]/15 text-[#0071E3] dark:text-[#2997FF]"
              }`}
            >
              {isDestructive ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {operation === "CANCEL_ORDER" && t("actionCancelTitle")}
                {operation === "REASSIGN_ORDER" && t("actionReassignTitle")}
                {operation === "INSTANT_ACTION" && t("actionEstopTitle")}
                {operation === "ACKNOWLEDGE_INCIDENT" && t("incidentActionAck")}
                {operation === "RESOLVE_INCIDENT" && t("incidentActionResolve")}
              </h3>
              <p className="text-[10px] font-mono text-[#86868B]">
                Target: {order?.id || robot?.id || incident?.id}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-full text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs">
          <p className="text-[#1D1D1F] dark:text-[#F5F5F7] leading-relaxed">
            {operation === "CANCEL_ORDER" && t("actionCancelConfirm")}
            {operation === "REASSIGN_ORDER" && t("actionReassignConfirm")}
            {operation === "INSTANT_ACTION" && t("actionEstopConfirm")}
            {operation === "ACKNOWLEDGE_INCIDENT" &&
              "Acknowledge this incident and record operator verification in Core audit log?"}
            {operation === "RESOLVE_INCIDENT" &&
              "Mark this incident as resolved and clear active safety locks?"}
          </p>

          <p className="text-[11px] text-[#86868B] leading-normal">
            {operation === "CANCEL_ORDER" && t("actionCancelDesc")}
            {operation === "REASSIGN_ORDER" && t("actionReassignDesc")}
            {operation === "INSTANT_ACTION" && t("actionEstopWarning")}
          </p>

          {/* Reassign coordinates input if applicable */}
          {operation === "REASSIGN_ORDER" && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-[#F5F5F7] dark:bg-[#252528] border border-black/[0.04] dark:border-white/[0.06]">
              <div>
                <label className="block text-[10px] font-bold text-[#86868B] mb-1">
                  New Goal Column (X)
                </label>
                <input
                  type="number"
                  min={0}
                  max={31}
                  value={newCol}
                  onChange={(e) => setNewCol(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] font-mono text-xs tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7] outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#86868B] mb-1">
                  New Goal Row (Y)
                </label>
                <input
                  type="number"
                  min={0}
                  max={19}
                  value={newRow}
                  onChange={(e) => setNewRow(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] font-mono text-xs tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7] outline-none"
                />
              </div>
            </div>
          )}

          {/* Status / Outcome Banner */}
          {lastMutation && (
            <div
              className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                lastMutation.state === "confirmed"
                  ? "bg-[#34C759]/10 border-[#34C759]/30 text-[#248A3D] dark:text-[#30D158]"
                  : lastMutation.state === "uncertain"
                    ? "bg-[#FF9500]/15 border-[#FF9500]/35 text-[#C93400] dark:text-[#FF9F0A]"
                    : "bg-[#FF3B30]/15 border-[#FF3B30]/35 text-[#D70015] dark:text-[#FF453A]"
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <div className="flex items-center gap-1.5">
                  {lastMutation.state === "confirmed" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <span className="uppercase">
                    Outcome: {lastMutation.state}
                  </span>
                </div>
                <span className="font-mono text-[10px]">
                  #{lastMutation.requestId.slice(0, 8)}
                </span>
              </div>

              <p className="text-[11px] leading-relaxed opacity-90">
                {lastMutation.state === "confirmed"
                  ? "Action confirmed and applied."
                  : lastMutation.state === "uncertain"
                    ? t("actionUncertainDesc")
                    : lastMutation.error?.detail || "Action rejected."}
              </p>

              {lastMutation.state === "uncertain" && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isSubmitting}
                  className="mt-2 w-full py-2 px-3 rounded-xl bg-[#FF9500] dark:bg-[#FF9F0A] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isSubmitting ? "animate-spin" : ""}`}
                  />
                  <span>{t("actionRetrySameId")}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-end gap-2.5 bg-[#FBFBFD] dark:bg-[#19191B]">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClose}
            className="px-4 py-2 rounded-full border border-black/[0.08] dark:border-white/[0.1] text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            {t("actionDismiss")}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className={`px-5 py-2 rounded-full text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              isDestructive
                ? "bg-[#FF3B30] dark:bg-[#FF453A] hover:opacity-90"
                : "bg-[#0071E3] dark:bg-[#2997FF] hover:opacity-90"
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t("actionSubmitting")}</span>
              </>
            ) : (
              <span>{t("actionConfirm")}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
