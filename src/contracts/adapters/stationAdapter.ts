import {
  STATION_ACTIONS,
  STATION_PHASES,
  type StationPhase,
  type StationAction,
} from "../generated.ts";
export interface StationState {
  loaded: boolean;
  batteryPercent: number;
  phase: StationPhase;
  elapsedMs: number;
  action?: StationAction;
  orderId?: string;
}
export function adaptArrivalAction(raw: unknown): StationAction | undefined {
  if (raw === undefined) return undefined;
  if (!STATION_ACTIONS.includes(raw as StationAction))
    throw new Error("Invalid station action");
  return raw as StationAction;
}
export function adaptStationState(raw: unknown): StationState | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object") throw new Error("Invalid station state");
  const value = raw as Record<string, unknown>;
  if (
    typeof value.loaded !== "boolean" ||
    typeof value.batteryPercent !== "number" ||
    !Number.isFinite(value.batteryPercent) ||
    value.batteryPercent < 0 ||
    value.batteryPercent > 100 ||
    !STATION_PHASES.includes(value.phase as StationPhase) ||
    typeof value.elapsedMs !== "number" ||
    !Number.isSafeInteger(value.elapsedMs) ||
    Number(value.elapsedMs) < 0
  )
    throw new Error("Invalid station state fields");
  const action = adaptArrivalAction(value.action);
  if (
    (action !== undefined) !==
      (typeof value.orderId === "string" && value.orderId.length > 0) ||
    (value.phase !== "IDLE" && !action)
  )
    throw new Error("Invalid station action identity");
  return {
    loaded: value.loaded,
    batteryPercent: value.batteryPercent,
    phase: value.phase as StationState["phase"],
    elapsedMs: Number(value.elapsedMs),
    action,
    orderId: value.orderId as string | undefined,
  };
}
