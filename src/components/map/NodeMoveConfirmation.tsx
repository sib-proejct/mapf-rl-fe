import React, { useEffect, useRef } from "react";
import { useOperations } from "../../app/providers/OperationsContext.tsx";

export function NodeMoveConfirmation({ nodeId }: { nodeId: number }) {
  const {
    robotPlacementActive,
    nodeConfirmation,
    confirmNodeCommand,
    dismissNodeConfirmation,
    nodeCommand,
    snapshot,
    topology,
    pendingMutations,
  } = useOperations();
  const noButton = useRef<HTMLButtonElement>(null);
  const active = nodeConfirmation?.nodeId === nodeId;
  useEffect(() => {
    if (active) noButton.current?.focus();
  }, [active, nodeConfirmation?.robotId, nodeId]);
  if (robotPlacementActive || !active || !nodeConfirmation) return null;
  const busy =
    nodeCommand?.state === "submitting" ||
    pendingMutations.some(
      (m) =>
        m.operation === "CREATE_ORDER" &&
        ["submitting", "uncertain"].includes(m.state),
    );
  const node = topology?.nodeMap.get(nodeId);
  const station = snapshot?.map.stationCatalog?.find(
    (s) => s.column === node?.column && s.row === node?.row,
  );
  const action =
    station?.type === "pick"
      ? "도착 후 적재"
      : station?.type === "place"
        ? "도착 후 하역"
        : station?.type === "charger"
          ? `도착 후 ${snapshot?.batteryPolicy?.chargeTargetPercent ?? 80}% 충전`
          : "";
  const error =
    nodeCommand?.nodeId === nodeId &&
    nodeCommand.robotId === nodeConfirmation.robotId &&
    nodeCommand.state === "rejected"
      ? nodeCommand.error ||
        nodeCommand.mutation?.error?.detail ||
        "주문이 거절되었습니다."
      : null;
  return (
    <div
      className="w-[108px] shrink-0 text-[10px]"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) {
          e.stopPropagation();
          dismissNodeConfirmation();
        }
      }}
    >
      <p className="font-semibold">이동하시겠습니까?</p>
      <p className="text-[#86868B] truncate" title={nodeConfirmation.robotId}>
        {nodeConfirmation.robotId}
      </p>
      {action && <p className="text-[#86868B]">{action}</p>}
      <div className="flex gap-1 mt-1">
        <button
          disabled={busy}
          onClick={() => void confirmNodeCommand()}
          className="rounded-lg px-2 py-1 bg-[#0071E3] text-white disabled:opacity-50"
        >
          {busy ? "제출 중…" : "네"}
        </button>
        <button
          ref={noButton}
          disabled={busy}
          onClick={dismissNodeConfirmation}
          className="rounded-lg px-2 py-1 bg-black/5 dark:bg-white/10 disabled:opacity-50"
        >
          아니요
        </button>
      </div>
      {error && (
        <p role="alert" className="text-red-500 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
