import React, { useRef, useState } from "react";
import { X, Plus, RefreshCw } from "lucide-react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import type { PendingMutation } from "../../domain/mutation/types.ts";

export const OrderCreateForm: React.FC = () => {
  const { t, language } = useAppConfig();
  const {
    snapshot,
    isOrderModalOpen,
    setIsOrderModalOpen,
    createOrder,
    retryMutation,
  } = useOperations();
  const [goalColumn, setGoalColumn] = useState("14");
  const [goalRow, setGoalRow] = useState("8");
  const [robotId, setRobotId] = useState("auto");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const [lastMutation, setLastMutation] = useState<PendingMutation | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const map = snapshot?.map;
  const robots = snapshot?.robots ?? [];
  const availableRobots = robots.filter(
    (robot) =>
      robot.operationalState === "IDLE" &&
      robot.connectivity === "CONNECTED" &&
      robot.safety === "NORMAL" &&
      robot.freshness === "CURRENT" &&
      !snapshot?.orders.some(
        (order) =>
          !["Completed", "Cancelled", "Rejected"].includes(order.state) &&
          order.assignments.some(
            (assignment) => assignment.robotId === robot.id,
          ),
      ),
  );
  const assignedRobot =
    robotId === "auto"
      ? availableRobots[0]?.id
      : availableRobots.find((robot) => robot.id === robotId)?.id;
  const uncertain = lastMutation?.state === "uncertain";
  const ko = language === "ko";

  if (!isOrderModalOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      let mutation: PendingMutation;
      if (uncertain && lastMutation) {
        mutation = await retryMutation(lastMutation.requestId);
      } else {
        if (!map || !assignedRobot)
          throw new Error(
            ko
              ? "맵과 연결된 유휴 로봇이 필요합니다."
              : "A map and a connected idle robot are required.",
          );
        const column = Number(goalColumn);
        const row = Number(goalRow);
        if (
          goalColumn === "" ||
          goalRow === "" ||
          !Number.isInteger(column) ||
          !Number.isInteger(row) ||
          column < 0 ||
          row < 0 ||
          column >= map.widthCells ||
          row >= map.heightCells
        ) {
          throw new Error(
            ko
              ? "맵 범위 안의 정수 좌표를 입력하세요."
              : "Enter integer coordinates within the map.",
          );
        }
        if (map.cells[row * map.widthCells + column] !== 0) {
          throw new Error(
            ko
              ? "장애물 노드로 이동할 수 없습니다."
              : "Obstacle nodes cannot be destinations.",
          );
        }
        mutation = await createOrder({
          mapId: map.mapId,
          mapRevision: map.revision,
          assignments: [
            { robotId: assignedRobot, goalColumn: column, goalRow: row },
          ],
        });
      }
      setLastMutation(mutation);
      if (mutation.state === "confirmed") {
        setIsOrderModalOpen(false);
        setLastMutation(null);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : ko
            ? "작업 제출에 실패했습니다."
            : "Order submission failed.",
      );
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full mt-1 px-2.5 py-2 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 text-xs text-[#1D1D1F] dark:text-[#F5F5F7] focus:ring-2 focus:ring-[#0071E3] disabled:opacity-50";

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 rounded-2xl border border-[#0071E3]/20 bg-[#0071E3]/[0.04] dark:bg-[#2997FF]/10 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
          {ko ? "새 작업" : "New Order"}
        </h4>
        <button
          type="button"
          aria-label={ko ? "입력 닫기" : "Close form"}
          disabled={isSubmitting || uncertain}
          onClick={() => {
            setIsOrderModalOpen(false);
            setLastMutation(null);
            setError(null);
          }}
          className="p-1 rounded-full text-[#86868B] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <fieldset disabled={isSubmitting || uncertain} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-[#86868B]">
            {t("orderGoalColumn")} (X)
            <input
              autoFocus
              required
              type="number"
              min={0}
              max={map ? map.widthCells - 1 : undefined}
              step={1}
              value={goalColumn}
              onChange={(event) => setGoalColumn(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-[11px] text-[#86868B]">
            {t("orderGoalRow")} (Y)
            <input
              required
              type="number"
              min={0}
              max={map ? map.heightCells - 1 : undefined}
              step={1}
              value={goalRow}
              onChange={(event) => setGoalRow(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className="block text-[11px] text-[#86868B]">
          {t("orderSelectRobot")}
          <select
            value={robotId}
            onChange={(event) => setRobotId(event.target.value)}
            className={inputClass}
          >
            <option value="auto">
              {ko
                ? "자동 선택 · 연결된 유휴 로봇"
                : "Auto · connected idle robot"}
            </option>
            {robots.map((robot) => (
              <option
                key={robot.id}
                value={robot.id}
                disabled={
                  !availableRobots.some(
                    (available) => available.id === robot.id,
                  )
                }
              >
                {robot.id} · {robot.operationalState}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      {(!map || !assignedRobot) && !uncertain && (
        <p
          role="status"
          className="text-[11px] text-[#C93400] dark:text-[#FF9F0A]"
        >
          {!map
            ? ko
              ? "맵을 불러온 뒤 제출할 수 있습니다."
              : "Load the map before submitting."
            : ko
              ? "연결된 유휴 로봇이 없습니다."
              : "No connected idle robot is available."}
        </p>
      )}
      {(error || lastMutation) && (
        <p
          role="alert"
          className="text-[11px] text-[#C93400] dark:text-[#FF9F0A]"
        >
          {error ||
            (uncertain
              ? t("actionUncertainDesc")
              : lastMutation?.error?.detail ||
                (ko
                  ? "작업 제출에 실패했습니다."
                  : "Order submission failed."))}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting || (!uncertain && (!map || !assignedRobot))}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#0071E3] dark:bg-[#2997FF] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Plus className="w-3.5 h-3.5" />
        )}
        {isSubmitting
          ? t("orderCreating")
          : uncertain
            ? t("actionRetrySameId")
            : t("orderCreateSubmit")}
      </button>
    </form>
  );
};
