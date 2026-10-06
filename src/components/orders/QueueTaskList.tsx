import React, { useRef, useState } from "react";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { queueWaves } from "../../contracts/adapters/queueAdapter.ts";

export interface QueueTaskListProps {
  filter?: "active" | "history" | "all";
}

export const QueueTaskList: React.FC<QueueTaskListProps> = ({
  filter: externalFilter,
}) => {
  const {
    snapshot,
    cancelQueueTask,
    retryMutation,
    pendingMutations,
    setSelectedOrderId,
    refreshSnapshot,
  } = useOperations();
  const { language } = useAppConfig();
  const ko = language === "ko";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [clearProgress, setClearProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [internalFilter, setInternalFilter] = useState<
    "active" | "history" | "all"
  >("active");
  const filter = externalFilter ?? internalFilter;
  const uncertain =
    pendingMutations.find(
      (mutation) =>
        mutation.operation === "CANCEL_QUEUE_TASK" &&
        mutation.state === "uncertain",
    )?.targetEntityId ?? null;
  const busy = useRef(false);
  const tasks = snapshot?.queueTasks ?? [];
  const recentTasks = [...tasks].sort((a, b) => b.sequence - a.sequence);
  const activeTasks = recentTasks.filter(
    (task) => !["Completed", "Cancelled"].includes(task.state),
  );
  const historyTasks = recentTasks.filter((task) =>
    ["Completed", "Cancelled"].includes(task.state),
  );
  const visibleTasks =
    filter === "active"
      ? activeTasks
      : filter === "history"
        ? historyTasks
        : recentTasks;
  const visibleWaveIds = new Set(visibleTasks.map((task) => task.waveId));
  const waves = queueWaves(recentTasks).filter((wave) =>
    visibleWaveIds.has(wave.waveId),
  );
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
  const clearActiveTasks = async () => {
    if (busy.current || activeTasks.length === 0) return;
    const confirmMessage = ko
      ? `진행 중/대기 중인 ${activeTasks.length}개의 작업을 모두 취소(Clear)하시겠습니까?\n실행 중인 로봇은 안전하게 정지됩니다.`
      : `Cancel (Clear) all ${activeTasks.length} active/queued tasks?\nRunning robots will safely stop.`;
    if (!window.confirm(confirmMessage)) return;

    busy.current = true;
    setIsClearing(true);
    setError(null);

    const targets = [...activeTasks];
    const total = targets.length;
    let completedCount = 0;
    setClearProgress({ current: 0, total });

    const batchSize = 10;
    try {
      for (let i = 0; i < targets.length; i += batchSize) {
        const batch = targets.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map((task) => cancelQueueTask(task.taskId)),
        );
        completedCount = Math.min(total, i + batchSize);
        setClearProgress({ current: completedCount, total });
      }
      await refreshSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      busy.current = false;
      setIsClearing(false);
      setClearProgress(null);
    }
  };
  const reasonText = (reason: string) => {
    const labels: Record<string, [string, string]> = {
      BUFFER_UNAVAILABLE: [
        "빈 복귀 버퍼 대기",
        "Waiting for a free return buffer",
      ],
      BUFFER_NOT_CONFIGURED: [
        "지도에 복귀 버퍼 미설정",
        "Return buffers are not configured",
      ],
      BUFFER_RESERVED: [
        "버퍼 예약 또는 작업장 이탈 대기",
        "Waiting for berth or station clearance",
      ],
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
      aria-label={ko ? "대기 큐" : "Queue tasks"}
      className="space-y-2 text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-gray-700 dark:text-gray-200">
          {ko ? "대기 큐" : "Queue Tasks"} ({activeTasks.length})
        </h4>
        <div className="flex items-center gap-2">
          {activeTasks.length > 0 && (
            <button
              type="button"
              disabled={isClearing || pending !== null}
              onClick={clearActiveTasks}
              className="px-2 py-0.5 rounded-lg text-xs text-[#C93400] hover:bg-[#C93400]/10 border border-[#C93400]/20 font-medium disabled:opacity-40 transition-colors"
            >
              {isClearing
                ? clearProgress
                  ? `${ko ? "취소 중…" : "Clearing…"} (${clearProgress.current}/${clearProgress.total})`
                  : ko
                    ? "취소 중…"
                    : "Clearing…"
                : ko
                  ? `전체 취소 (Clear ${activeTasks.length})`
                  : `Clear All (${activeTasks.length})`}
            </button>
          )}
          <span className="text-gray-400 text-[11px]">
            {ko ? "최근 등록순" : "Newest first"}
          </span>
        </div>
      </div>
      {!externalFilter && (
        <div
          role="group"
          aria-label={ko ? "작업 표시" : "Task filter"}
          className="inline-flex p-1 bg-black/5 dark:bg-white/5 rounded-xl gap-1"
        >
          {(
            [
              ["active", ko ? "진행 중" : "Active", activeTasks.length],
              ["history", ko ? "완료·취소" : "History", historyTasks.length],
              ["all", ko ? "전체" : "All", tasks.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setInternalFilter(value)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                filter === value
                  ? "bg-white dark:bg-[#2C2C2E] shadow-sm text-black dark:text-white"
                  : "text-gray-500 hover:text-black dark:hover:text-white"
              }`}
            >
              {label}{" "}
              <span className="opacity-70 font-mono text-[11px]">{count}</span>
            </button>
          ))}
        </div>
      )}
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
      {waves.length > 0 && (
        <details className="rounded-xl border border-black/10 dark:border-white/10 p-2">
          <summary className="cursor-pointer text-gray-500">
            {ko ? "웨이브 요약" : "Wave summaries"} ({waves.length})
          </summary>
          <div className="space-y-1 pt-2">
            {waves.map((wave) => (
              <p key={wave.waveId} className="rounded-xl bg-[#0071E3]/10 p-2">
                {ko ? "웨이브" : "Wave"} {wave.waveId.slice(0, 8)} ·{" "}
                {ko ? "완료" : "Completed"} {wave.counts.Completed}/
                {wave.taskIds.length} · {ko ? "취소" : "Cancelled"}{" "}
                {wave.counts.Cancelled} · {ko ? "보류" : "Held"}{" "}
                {wave.counts.Held}
              </p>
            ))}
          </div>
        </details>
      )}
      {error && (
        <p role="alert" className="text-[#C93400]">
          {error}
        </p>
      )}
      {visibleTasks.length === 0 && (
        <p className="p-2 text-gray-500">
          {filter === "active"
            ? ko
              ? "진행 중인 작업이 없습니다."
              : "No active tasks."
            : ko
              ? "표시할 작업이 없습니다."
              : "No tasks to show."}
        </p>
      )}
      {visibleTasks.map((task) => {
        const stateColorMap: Record<string, string> = {
          Queued:
            "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          Running:
            "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          Held: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
          Cancelling:
            "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
          Completed:
            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          Cancelled: "bg-gray-500/10 text-gray-500 border-gray-500/20",
        };
        const stateColor =
          stateColorMap[task.state] ??
          "bg-gray-500/10 text-gray-500 border-gray-500/20";
        return (
          <details
            key={task.taskId}
            className="rounded-xl border border-black/10 dark:border-white/10 p-2.5 bg-white dark:bg-[#1C1C1E] transition-all"
          >
            <summary className="cursor-pointer list-none flex items-center justify-between gap-2 select-none">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-gray-400 font-semibold text-[11px]">
                  #{task.sequence}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${stateColor}`}
                >
                  {ko
                    ? ({
                        Queued: "대기",
                        Running: "실행 중",
                        Held: "보류",
                        Cancelling: "취소 중",
                        Completed: "완료",
                        Cancelled: "취소",
                      }[task.state] ?? task.state)
                    : task.state}
                </span>
                <span className="truncate font-medium text-gray-700 dark:text-gray-300">
                  {task.robotId ??
                    task.requestedRobotId ??
                    (ko ? "자동 배정" : "Auto")}
                </span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 font-mono text-gray-600 dark:text-gray-400 shrink-0">
                {task.steps[task.stage]?.arrivalAction ??
                  (ko ? "이동" : "MOVE")}
              </span>
            </summary>
            <div className="space-y-2 pt-2.5 mt-2 border-t border-black/5 dark:border-white/5 text-xs">
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-mono text-[11px]">
                {task.steps
                  .map(
                    (step) =>
                      `${step.arrivalAction ?? "MOVE"} (${step.goalColumn}, ${step.goalRow})`,
                  )
                  .join(" → ")}
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>
                  {ko ? "단계" : "Stage"} {task.stage + 1}/{task.steps.length}
                </span>
                <span className="font-mono">{task.taskId.slice(0, 8)}</span>
              </div>
              {task.reason && (
                <p
                  role="status"
                  className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[11px]"
                >
                  {task.reason === "CARGO_RECOVERY_REQUIRED"
                    ? ko
                      ? "화물이 남아 있습니다. 다시 취소하면 정지 확인 후 작업이 취소 이력으로 이동합니다. 화물은 유지되며 PLACE 작업으로 처리할 수 있습니다."
                      : "Cargo remains. Cancel again to move this task to history once stopped. Cargo is retained and can be handled with a PLACE task."
                    : reasonText(task.reason)}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {task.orderIds.map((orderId, index) => (
                  <button
                    key={orderId}
                    type="button"
                    onClick={() => setSelectedOrderId(orderId)}
                    className="px-2 py-1 rounded-lg bg-[#0071E3]/10 hover:bg-[#0071E3]/20 text-[#0071E3] text-xs font-medium transition-colors"
                  >
                    {ko ? "실행 오더" : "Execution"} {index + 1}
                  </button>
                ))}
                {(!["Completed", "Cancelled", "Cancelling"].includes(
                  task.state,
                ) ||
                  uncertain === task.taskId) && (
                  <button
                    type="button"
                    disabled={
                      pending !== null ||
                      (uncertain !== null && uncertain !== task.taskId)
                    }
                    onClick={() => cancel(task.taskId)}
                    className="ml-auto px-2 py-1 rounded-lg text-[#C93400] hover:bg-[#C93400]/10 text-xs font-medium disabled:opacity-40 transition-colors"
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
            </div>
          </details>
        );
      })}
    </section>
  );
};
