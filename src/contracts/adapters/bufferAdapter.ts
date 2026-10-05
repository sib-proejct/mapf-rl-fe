import type { BufferCatalog, BufferState } from "../buffer.generated.ts";

const labels: Record<BufferState["phase"], string> = {
  NONE: "",
  RESERVED: "복귀 버퍼 예약",
  EXIT_PENDING: "하역 완료 · 이탈 대기",
  MOVING: "작업장 이탈 중",
  WAITING: "버퍼 대기",
  HELD: "작업장 이탈 보류",
};

export function bufferLabel(state?: BufferState): string {
  if (!state) return "";
  const phase =
    state.phase === "MOVING"
      ? {
          BUFFER: "버퍼 이동",
          NEXT: "다음 작업으로 이동",
          CHARGE: "충전소로 이동",
        }[state.movementKind ?? "NEXT"]
      : labels[state.phase];
  const reason = state.reason ? ` · ${bufferReasonLabel(state.reason)}` : "";
  return `${phase}${reason}`;
}

export function bufferReasonLabel(reason: string): string {
  return (
    (
      {
        BUFFER_UNAVAILABLE: "빈 버퍼 대기",
        BUFFER_NOT_CONFIGURED: "지도에 버퍼 미설정",
        BUFFER_RESERVED: "버퍼 예약 또는 작업장 이탈 대기",
        BUFFER_MOVE_FAILED: "버퍼 이동 실패 · 복구 필요",
        NEXT_EXECUTION_FAILED: "다음 작업 실패 · 버퍼 이동 대기",
        NEXT_EXECUTION_STOP_REQUIRED: "다음 작업 실패 · 안전 정지 확인 대기",
      } as Record<string, string>
    )[reason] ?? reason
  );
}

function object(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Invalid buffer payload");
  return raw as Record<string, unknown>;
}

function cell(raw: unknown) {
  const value = object(raw);
  if (
    !Number.isSafeInteger(value.column) ||
    Number(value.column) < 0 ||
    !Number.isSafeInteger(value.row) ||
    Number(value.row) < 0 ||
    typeof value.name !== "string" ||
    !value.name
  )
    throw new Error("Invalid buffer cell");
  return {
    column: Number(value.column),
    row: Number(value.row),
    name: value.name,
  };
}

export function adaptBufferCatalog(raw: unknown): BufferCatalog {
  const value = object(raw);
  if (
    value.contractVersion !== "1.0.0" ||
    typeof value.mapId !== "string" ||
    !Number.isSafeInteger(value.mapRevision) ||
    Number(value.mapRevision) < 0 ||
    !Array.isArray(value.buffers)
  )
    throw new Error("Invalid buffer catalog");
  const buffers = value.buffers.map(cell);
  if (
    new Set(buffers.map((b) => `${b.column}:${b.row}`)).size !== buffers.length
  )
    throw new Error("Duplicate buffer cells");
  return {
    contractVersion: "1.0.0",
    mapId: value.mapId,
    mapRevision: Number(value.mapRevision),
    buffers,
  };
}

export function adaptBufferState(raw: unknown): BufferState {
  const value = object(raw);
  if (
    value.contractVersion !== "1.0.0" ||
    typeof value.robotId !== "string" ||
    !value.robotId ||
    !Number.isSafeInteger(value.entityVersion) ||
    Number(value.entityVersion) < 0 ||
    typeof value.phase !== "string" ||
    !Object.hasOwn(labels, value.phase) ||
    typeof value.stationClear !== "boolean" ||
    typeof value.bufferOccupied !== "boolean" ||
    ![null, "BUFFER", "NEXT", "CHARGE"].includes(
      value.movementKind as string | null,
    )
  )
    throw new Error("Invalid buffer state");
  for (const field of ["mapId", "placeOrderId", "orderId", "reason"])
    if (value[field] !== null && typeof value[field] !== "string")
      throw new Error("Invalid buffer identity");
  if (
    value.mapRevision !== null &&
    (!Number.isSafeInteger(value.mapRevision) || Number(value.mapRevision) < 0)
  )
    throw new Error("Invalid buffer map revision");
  return {
    contractVersion: "1.0.0",
    robotId: value.robotId,
    entityVersion: Number(value.entityVersion),
    phase: value.phase as BufferState["phase"],
    buffer: value.buffer === null ? null : cell(value.buffer),
    mapId: value.mapId as string | null,
    mapRevision: value.mapRevision as number | null,
    placeOrderId: value.placeOrderId as string | null,
    orderId: value.orderId as string | null,
    stationClear: value.stationClear,
    reason: value.reason as string | null,
    movementKind: value.movementKind as BufferState["movementKind"],
    bufferOccupied: value.bufferOccupied,
  };
}
