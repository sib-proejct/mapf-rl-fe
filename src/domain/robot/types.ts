/**
 * Typed domain models for Robot state and telemetry.
 */

export type RobotOperationalState =
  | "IDLE"
  | "EXECUTING"
  | "HELD"
  | "STOPPED"
  | "CHARGING"
  | "UNKNOWN";

export type ConnectivityState = "CONNECTED" | "DEGRADED" | "DISCONNECTED";

export type FreshnessState = "CURRENT" | "STALE" | "PARTIAL" | "UNKNOWN";

export type SafetyState =
  | "NORMAL"
  | "WAIT"
  | "CONTROLLED_STOP"
  | "EMERGENCY_STOP"
  | "REJECT"
  | "FAULT";

export interface RobotPose {
  xMeters: number;
  yMeters: number;
  yawRadians: number;
}

export interface ActiveController {
  mode: string;
  identity: string;
  contentDigestSha256?: string;
}

export interface Robot {
  id: string;
  stateVersion: number;
  simulationTimeMs: number;
  occurredAtUtc: string;
  pose: RobotPose;
  operationalState: RobotOperationalState;
  connectivity: ConnectivityState;
  freshness: FreshnessState;
  safety: SafetyState;
  activeController: ActiveController;
  currentOrderId?: string;
  orderUpdateId?: number;
  sessionEpoch?: number;
  simulatorId?: string;
  batteryPercent?: number;
}
