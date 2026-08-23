import React, { useState, useMemo } from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import {
  X,
  Plus,
  Box,
  Bot,
  Flag,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { generateUuidV4 } from "../../utils/ids/ids.ts";
import type { PendingMutation } from "../../domain/mutation/types.ts";

export const OrderCreateModal: React.FC = () => {
  const { t } = useAppConfig();
  const {
    snapshot,
    isOrderModalOpen,
    setIsOrderModalOpen,
    createOrder,
    retryMutation,
  } = useOperations();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [goalColumn, setGoalColumn] = useState<number>(14);
  const [goalRow, setGoalRow] = useState<number>(8);
  const [selectedRobotId, setSelectedRobotId] = useState<string>("auto");
  const [priority, setPriority] = useState<"NORMAL" | "HIGH" | "CRITICAL">(
    "NORMAL",
  );
  const [notes, setNotes] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastMutation, setLastMutation] = useState<PendingMutation | null>(
    null,
  );

  const map = snapshot?.map;
  const width = map?.widthCells || 32;
  const height = map?.heightCells || 20;
  const robots = snapshot?.robots || [];

  // Find candidate destinations from map stations
  const presetGoals = useMemo(() => {
    return [
      { name: "Station Alpha (Pick)", col: 4, row: 8 },
      { name: "Station Beta (Place)", col: 14, row: 8 },
      { name: "Station Gamma (Pick)", col: 22, row: 8 },
      { name: "Buffer East (Place)", col: 28, row: 18 },
      { name: "Aisle Crossway A-12", col: 10, row: 14 },
    ];
  }, []);

  if (!isOrderModalOpen) return null;

  const handleClose = () => {
    if (isSubmitting) return; // Prevent closing while mutation is in-flight
    setIsOrderModalOpen(false);
    setStep(1);
    setLastMutation(null);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return; // Double-click prevention
    setIsSubmitting(true);

    try {
      const assignedRobot = selectedRobotId === "auto" ? "" : selectedRobotId;
      const mutation = await createOrder({
        mapId: map?.mapId || "00000000-0000-4000-8000-000000000001",
        mapRevision: map?.revision ?? 0,
        assignments: [
          {
            robotId: assignedRobot,
            goalColumn: Number(goalColumn),
            goalRow: Number(goalRow),
          },
        ],
        priority,
        notes,
      });

      setLastMutation(mutation);
      if (mutation.state === "confirmed") {
        setTimeout(() => {
          handleClose();
        }, 1200);
      }
    } catch (err: unknown) {
      console.error("Order creation failed:", err);
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 dark:bg-black/70 backdrop-blur-md animate-fade-in"
    >
      <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] shadow-2xl rounded-3xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between shrink-0 bg-[#FBFBFD] dark:bg-[#19191B]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 dark:bg-[#2997FF]/15 flex items-center justify-center text-[#0071E3] dark:text-[#2997FF]">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
                {t("orderCreateTitle")}
              </h2>
              <p className="text-[11px] font-mono text-[#86868B]">
                Map Revision #{map?.revision ?? 0}
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

        {/* Step Indicator */}
        <div className="px-6 pt-3 pb-2 border-b border-black/[0.03] dark:border-white/[0.05] bg-white dark:bg-[#1C1C1E]">
          <div className="grid grid-cols-4 gap-2 text-[11px] font-semibold">
            {[
              { idx: 1, label: t("orderStepGoal") },
              { idx: 2, label: t("orderStepRobot") },
              { idx: 3, label: t("orderStepConstraints") },
              { idx: 4, label: t("orderStepConfirm") },
            ].map((s) => (
              <button
                key={`step-${s.idx}`}
                onClick={() => !isSubmitting && setStep(s.idx as any)}
                className={`py-1.5 px-2 rounded-xl text-center transition-all truncate ${
                  step === s.idx
                    ? "bg-[#0071E3]/10 dark:bg-[#2997FF]/15 text-[#0071E3] dark:text-[#2997FF] font-bold border border-[#0071E3]/20"
                    : step > s.idx
                      ? "text-[#34C759] dark:text-[#30D158] font-medium"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* STEP 1: Goal Coordinates */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
                  {t("orderTargetGoal")} (0..{width - 1}, 0..{height - 1})
                </label>
                <p className="text-[11px] text-[#86868B] mb-3">
                  Select a station preset or specify explicit grid coordinates.
                </p>

                {/* Preset Goals Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  {presetGoals.map((preset, idx) => (
                    <button
                      key={`preset-${idx}`}
                      type="button"
                      onClick={() => {
                        setGoalColumn(preset.col);
                        setGoalRow(preset.row);
                      }}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                        goalColumn === preset.col && goalRow === preset.row
                          ? "bg-[#0071E3]/10 dark:bg-[#2997FF]/15 border-[#0071E3] text-[#0071E3] dark:text-[#2997FF] font-bold shadow-xs"
                          : "bg-[#F5F5F7] dark:bg-[#252528] border-black/[0.04] dark:border-white/[0.06] text-[#1D1D1F] dark:text-[#F5F5F7] hover:border-black/20"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Flag className="w-3.5 h-3.5" />
                        <span>{preset.name}</span>
                      </div>
                      <span className="font-mono text-[10px] tabular-nums opacity-80">
                        ({preset.col}, {preset.row})
                      </span>
                    </button>
                  ))}
                </div>

                {/* Explicit Coordinates Input */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-[#F5F5F7] dark:bg-[#252528] rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#86868B] mb-1">
                      {t("orderGoalColumn")} (X)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={width - 1}
                      value={goalColumn}
                      onChange={(e) =>
                        setGoalColumn(parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] font-mono text-sm tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:ring-2 focus:ring-[#0071E3]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#86868B] mb-1">
                      {t("orderGoalRow")} (Y)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={height - 1}
                      value={goalRow}
                      onChange={(e) =>
                        setGoalRow(parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] font-mono text-sm tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:ring-2 focus:ring-[#0071E3]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Robot Assignment */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
                  {t("orderSelectRobot")}
                </label>
                <p className="text-[11px] text-[#86868B] mb-3">
                  Let Core MAPF assign the optimal nearest robot or select a
                  specific fleet unit.
                </p>

                {/* Auto Assign Option */}
                <button
                  type="button"
                  onClick={() => setSelectedRobotId("auto")}
                  className={`w-full p-3.5 rounded-2xl border text-left mb-2 transition-all flex items-center justify-between ${
                    selectedRobotId === "auto"
                      ? "bg-[#0071E3]/10 dark:bg-[#2997FF]/15 border-[#0071E3] text-[#0071E3] dark:text-[#2997FF] font-bold ring-1 ring-[#0071E3]"
                      : "bg-[#F5F5F7] dark:bg-[#252528] border-black/[0.04] dark:border-white/[0.06] text-[#1D1D1F] dark:text-[#F5F5F7]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <div>
                      <div className="text-xs font-bold">
                        {t("orderAutoAssign")}
                      </div>
                      <div className="text-[10px] text-[#86868B]">
                        Optimal shortest-path makespan heuristic
                      </div>
                    </div>
                  </div>
                  <CheckCircle2
                    className={`w-4 h-4 ${
                      selectedRobotId === "auto"
                        ? "text-[#0071E3] dark:text-[#2997FF]"
                        : "text-transparent"
                    }`}
                  />
                </button>

                {/* Fleet Robots Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {robots.map((robot) => {
                    const isSelected = selectedRobotId === robot.id;
                    const isAvail =
                      robot.operationalState === "IDLE" &&
                      robot.connectivity === "CONNECTED";

                    return (
                      <button
                        key={`robot-choice-${robot.id}`}
                        type="button"
                        onClick={() => setSelectedRobotId(robot.id)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                          isSelected
                            ? "bg-[#0071E3]/10 dark:bg-[#2997FF]/15 border-[#0071E3] text-[#0071E3] dark:text-[#2997FF] font-bold shadow-xs"
                            : "bg-[#F5F5F7] dark:bg-[#252528] border-black/[0.04] dark:border-white/[0.06] text-[#1D1D1F] dark:text-[#F5F5F7] hover:border-black/20"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-mono">
                          <Bot className="w-3.5 h-3.5" />
                          <span>{robot.id}</span>
                        </div>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                            isAvail
                              ? "bg-[#34C759]/15 text-[#248A3D] dark:text-[#30D158]"
                              : "bg-[#86868B]/15 text-[#86868B]"
                          }`}
                        >
                          {robot.operationalState}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Priority & Constraints */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mb-2">
                  {t("orderPriority")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: "NORMAL", label: t("orderPriorityNormal") },
                    { val: "HIGH", label: t("orderPriorityHigh") },
                    { val: "CRITICAL", label: t("orderPriorityCritical") },
                  ].map((p) => (
                    <button
                      key={`prio-${p.val}`}
                      type="button"
                      onClick={() => setPriority(p.val as any)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        priority === p.val
                          ? "bg-[#0071E3] dark:bg-[#2997FF] text-white border-transparent shadow-xs"
                          : "bg-[#F5F5F7] dark:bg-[#252528] border-black/[0.04] dark:border-white/[0.06] text-[#1D1D1F] dark:text-[#F5F5F7]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
                  {t("orderNotes")}
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("orderNotesPlaceholder")}
                  className="w-full px-3 py-2 rounded-xl bg-[#F5F5F7] dark:bg-[#252528] border border-black/[0.06] dark:border-white/[0.08] text-xs text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:ring-2 focus:ring-[#0071E3]"
                />
              </div>
            </div>
          )}

          {/* STEP 4: Review & Confirm */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#252528] border border-black/[0.04] dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-[#86868B]">Target Coordinates</span>
                  <span className="font-mono font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
                    Column {goalColumn}, Row {goalRow}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-[#86868B]">Assigned Unit</span>
                  <span className="font-mono font-bold text-[#0071E3] dark:text-[#2997FF]">
                    {selectedRobotId === "auto"
                      ? "Core Auto Allocation"
                      : selectedRobotId}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-[#86868B]">Priority Level</span>
                  <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {priority}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#86868B]">Idempotency Protection</span>
                  <span className="font-mono text-[10px] text-[#34C759] dark:text-[#30D158] font-bold">
                    UUIDv4 requestId Active
                  </span>
                </div>
              </div>

              {/* Status Outcome Banner */}
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
                      <span className="uppercase tracking-wider">
                        Outcome: {lastMutation.state}
                      </span>
                    </div>
                    <span className="font-mono text-[10px]">
                      #{lastMutation.requestId.slice(0, 8)}
                    </span>
                  </div>

                  <p className="text-[11px] leading-relaxed opacity-90">
                    {lastMutation.state === "confirmed"
                      ? t("orderCreatedSuccess")
                      : lastMutation.state === "uncertain"
                        ? t("actionUncertainDesc")
                        : lastMutation.error?.detail ||
                          "Order submission failed"}
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

              <p className="text-[11px] text-[#86868B] text-center">
                {t("orderCreateNotice")}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between shrink-0 bg-[#FBFBFD] dark:bg-[#19191B]">
          {step > 1 ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setStep((step - 1) as any)}
              className="px-4 py-2 rounded-full border border-black/[0.08] dark:border-white/[0.1] text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-40"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((step + 1) as any)}
              className="px-5 py-2 rounded-full bg-[#0071E3] dark:bg-[#2997FF] text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="px-6 py-2 rounded-full bg-[#0071E3] dark:bg-[#2997FF] text-white text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t("orderCreating")}</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("orderCreateSubmit")}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
