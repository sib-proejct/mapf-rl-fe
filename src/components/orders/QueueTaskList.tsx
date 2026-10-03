import React, { useRef, useState } from "react";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { queueWaves } from "../../contracts/adapters/queueAdapter.ts";

export const QueueTaskList: React.FC = () => {
  const {
    snapshot,
    cancelQueueTask,
    retryMutation,
    pendingMutations,
    setSelectedOrderId,
  } = useOperations();
  const { language } = useAppConfig();
  const ko = language === "ko";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const uncertain =
    pendingMutations.find(
      (mutation) =>
        mutation.operation === "CANCEL_QUEUE_TASK" &&
        mutation.state === "uncertain",
    )?.targetEntityId ?? null;
  const busy = useRef(false);
  const tasks = snapshot?.queueTasks ?? [];
  const uncertainCreations = pendingMutations.filter(
    (mutation) =>
      mutation.operation === "CREATE_ORDER" && mutation.state === "uncertain",
  );
  if (!tasks.length && !uncertainCreations.length) return null;
  const retryCreation = async (requestId: string) => {
    if (busy.current) return;
    busy.current = true;
    setPending(requestId);
    setError(null);
    try {
      const result = await retryMutation(requestId);
      if (result.state !== "confirmed")
        setError(
          result.error?.detail ??
            (ko ? "등록 결과를 확인하세요." : "Check submission outcome."),
        );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  const reasonText = (reason: string) => {
    const labels: Record<string, [string, string]> = {
      LOW_BATTERY: ["충전 후 실행 대기", "Waiting for charging"],
      BATTERY_DEPLETED: [
        "배터리 고갈: 운영자 복구 필요",
        "Battery depleted: operator recovery required",
      ],
      ACTIVE_ORDER_CONFLICT: [
        "현재 오더 완료 대기",
        "Waiting for active order",
      ],
      QUEUE_PREDECESSOR_PENDING: [
        "앞선 지정 작업 완료 대기",
        "Waiting for preceding task",
      ],
      QUEUE_ROBOT_RESERVED: [
        "운반·복구 작업 완료 대기",
        "Waiting for transport or recovery",
      ],
      NO_ASSIGNABLE_ROBOT: ["가용 로봇 대기", "Waiting for an eligible robot"],
      ROBOT_STATE_STALE: [
        "최신 로봇 상태 대기",
        "Waiting for fresh robot state",
      ],
      ROBOT_STATE_UNAVAILABLE: [
        "로봇 연결·상태 대기",
        "Waiting for robot connection/state",
      ],
      ROBOT_NOT_IDLE: [
        "로봇 유휴·안전 상태 대기",
        "Waiting for a safe idle robot",
      ],
      CHARGER_BUSY: ["충전소 가용성 대기", "Waiting for a charger"],
      ROBOT_ALREADY_LOADED: [
        "화물 하역 후 실행 대기",
        "Waiting for cargo unloading",
      ],
      ROBOT_EMPTY: ["적재 상태 확인 대기", "Waiting for loaded state"],
      WAITING_FOR_PLACE_STATE: [
        "적재 완료 상태 확인 후 하역 실행",
        "Waiting for pickup state before placing",
      ],
      CARGO_RECOVERED: ["화물 복구 확인 완료", "Cargo recovery confirmed"],
      OPERATOR_CANCELLED: ["운영자가 취소함", "Cancelled by operator"],
      EXECUTION_HELD: [
        "실행이 보류됨: 실행 오더 확인 필요",
        "Execution held: inspect the execution order",
      ],
      EXECUTION_CANCELLED: ["실행 오더가 취소됨", "Execution order cancelled"],
      EXECUTION_REJECTED: ["실행 오더가 거절됨", "Execution order rejected"],
      STATION_ACTION_UNSUPPORTED: [
        "로봇이 station 작업을 지원하지 않음",
        "Robot does not support station actions",
      ],
      ROBOT_REMOVING: [
        "로봇 제거 중: 작업 취소 필요",
        "Robot being removed: cancel the task",
      ],
    };
    return (
      labels[reason]?.[ko ? 0 : 1] ??
      (ko
        ? "실행 보류: 실행 오더와 로봇 상태를 확인하세요."
        : "Execution held: inspect the order and robot state.")
    );
  };
  const cancel = async (taskId: string) => {
    if (busy.current) return;
    if (
      uncertain !== taskId &&
      !window.confirm(
        ko
          ? "대기 작업을 취소할까요? 실행 중이면 안전 정지 후 취소됩니다."
          : "Cancel this task? Active work stops safely first.",
      )
    )
      return;
    busy.current = true;
    setPending(taskId);
    setError(null);
    try {
      const result = await cancelQueueTask(taskId);
      if (result.state === "rejected" || result.state === "uncertain")
        setError(
          result.error?.detail ??
            (ko ? "취소 결과를 확인하세요." : "Check cancellation outcome."),
        );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  return (
    <section
      aria-label={ko ? "오더 큐" : "Order queue"}
      className="space-y-2 text-xs"
    >
      <h4 className="font-bold">
        {ko ? "오더 큐" : "Order queue"} (
        {
          tasks.filter((t) => !["Completed", "Cancelled"].includes(t.state))
            .length
        }
        )
      </h4>
      {uncertainCreations.map((mutation) => (
        <div
          key={mutation.requestId}
          role="alert"
          className="rounded-xl p-2 border border-[#C93400]/30"
        >
          <p>
            {ko
              ? "등록 응답이 불확실합니다. 같은 요청으로 결과를 확인하세요."
              : "Submission outcome uncertain. Retry the original request."}
          </p>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => retryCreation(mutation.requestId)}
          >
            {ko ? "같은 ID로 등록 재시도" : "Retry submission with same ID"}
          </button>
        </div>
      ))}
      {queueWaves(tasks).map((wave) => (
        <p key={wave.waveId} className="rounded-xl bg-[#0071E3]/10 p-2">
          {ko ? "웨이브" : "Wave"} {wave.waveId.slice(0, 8)} ·{" "}
          {ko ? "완료" : "Completed"} {wave.counts.Completed}/
          {wave.taskIds.length} · {ko ? "취소" : "Cancelled"}{" "}
          {wave.counts.Cancelled} · {ko ? "보류" : "Held"} {wave.counts.Held}
        </p>
      ))}
      {error && (
        <p role="alert" className="text-[#C93400]">
          {error}
        </p>
      )}
      {tasks.map((task) => (
        <details
          key={task.taskId}
          className="rounded-xl border border-black/10 dark:border-white/10 p-2"
        >
          <summary className="cursor-pointer">
            #{task.sequence} · {task.state} ·{" "}
            {task.robotId ?? task.requestedRobotId ?? (ko ? "자동" : "Auto")} ·{" "}
            {task.steps[task.stage]?.arrivalAction ?? (ko ? "이동" : "Move")}
          </summary>
          <div className="space-y-2 pt-2">
            <p>
              {task.steps
                .map(
                  (step) =>
                    `${step.arrivalAction ?? "MOVE"} (${step.goalColumn}, ${step.goalRow})`,
                )
                .join(" → ")}
            </p>
            <p>
              {ko ? "단계" : "Stage"} {task.stage + 1}/{task.steps.length} ·{" "}
              {task.taskId.slice(0, 8)}
            </p>
            {task.reason && (
              <p role="status">
                {task.reason === "CARGO_RECOVERY_REQUIRED"
                  ? ko
                    ? "화물이 남아 있습니다. 이 로봇을 지정한 PLACE 작업으로 복구하세요."
                    : "Cargo remains. Queue a PLACE task for this robot to recover."
                  : reasonText(task.reason)}
              </p>
            )}
            {task.orderIds.map((orderId, index) => (
              <button
                key={orderId}
                type="button"
                onClick={() => setSelectedOrderId(orderId)}
                className="mr-2 text-[#0071E3]"
              >
                {ko ? "실행 오더" : "Execution"} {index + 1}
              </button>
            ))}
            {(!["Completed", "Cancelled", "Cancelling"].includes(task.state) ||
              uncertain === task.taskId) && (
              <button
                type="button"
                disabled={
                  pending !== null ||
                  (uncertain !== null && uncertain !== task.taskId)
                }
                onClick={() => cancel(task.taskId)}
                className="text-[#C93400] disabled:opacity-50"
              >
                {uncertain === task.taskId
                  ? ko
                    ? "같은 ID로 취소 재시도"
                    : "Retry cancellation"
                  : ko
                    ? "작업 취소"
                    : "Cancel task"}
              </button>
            )}
          </div>
        </details>
      ))}
    </section>
  );
};
