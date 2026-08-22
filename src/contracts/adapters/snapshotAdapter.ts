import type {
  AuthoritativeSnapshot,
  SnapshotFreshness,
} from "../../domain/snapshot/types.ts";
import type {
  Robot,
  RobotOperationalState,
  ConnectivityState,
  FreshnessState,
  SafetyState,
} from "../../domain/robot/types.ts";
import type { Order, OrderLifecycleState } from "../../domain/order/types.ts";
import type { RasterMap } from "../../domain/map/types.ts";
import { adaptRasterMap } from "./mapAdapter.ts";

export const DEFAULT_CANONICAL_MAP: RasterMap = {
  contractVersion: "1.0.0",
  mapId: "00000000-0000-4000-8000-000000000001",
  revision: 0,
  contentDigestSha256:
    "1111111111111111111111111111111111111111111111111111111111111111",
  coordinateFrame: {
    name: "map",
    handedness: "RIGHT_HANDED",
    xAxis: "EAST",
    yAxis: "NORTH",
    zAxis: "UP",
    yaw: "COUNTERCLOCKWISE_FROM_POSITIVE_X_RADIANS",
  },
  origin: { xMeters: 0.0, yMeters: 0.0 },
  resolutionMeters: 0.5,
  widthCells: 16,
  heightCells: 12,
  cells: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0,
    1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0,
    0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1,
    1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
};

/**
 * Adapts raw OperationsSnapshot JSON (or fixture) into typed AuthoritativeSnapshot domain model.
 */
export function adaptOperationsSnapshot(
  raw: unknown,
  fallbackMap: RasterMap = DEFAULT_CANONICAL_MAP,
): AuthoritativeSnapshot {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid snapshot payload: expected non-null object");
  }

  const obj = raw as Record<string, unknown>;

  if (obj.contractVersion !== "1.0.0") {
    throw new Error(
      `Incompatible contractVersion: expected "1.0.0", got "${obj.contractVersion}"`,
    );
  }

  const snapshotAt =
    typeof obj.snapshotAt === "string"
      ? obj.snapshotAt
      : new Date().toISOString();

  const cursor =
    (obj.cursor as { streamId?: unknown; eventSequence?: unknown }) || {};
  const streamId =
    typeof cursor.streamId === "string" ? cursor.streamId : "operations";
  const eventSequence =
    typeof cursor.eventSequence === "number" && cursor.eventSequence >= 0
      ? cursor.eventSequence
      : 0;

  const freshnessRaw = String(obj.freshness || "CURRENT").toUpperCase();
  const validFreshness: SnapshotFreshness[] = [
    "CURRENT",
    "STALE",
    "PARTIAL",
    "DISCONNECTED",
    "RECONCILING",
  ];
  const freshness: SnapshotFreshness = validFreshness.includes(
    freshnessRaw as SnapshotFreshness,
  )
    ? (freshnessRaw as SnapshotFreshness)
    : "CURRENT";

  let currentMap = fallbackMap;
  const robots: Robot[] = [];
  const orders: Order[] = [];

  const entities = Array.isArray(obj.entities) ? obj.entities : [];

  for (const entity of entities) {
    if (!entity || typeof entity !== "object") continue;
    const { entityType, entityId, entityVersion, data } = entity;
    const payload = (data && typeof data === "object" ? data : {}) as Record<
      string,
      unknown
    >;

    if (entityType === "MAP") {
      try {
        currentMap = adaptRasterMap(payload);
      } catch (err) {
        console.warn("Failed to parse map entity in snapshot:", err);
      }
    } else if (entityType === "ROBOT") {
      const poseRaw =
        (payload.pose as {
          xMeters?: unknown;
          yMeters?: unknown;
          yawRadians?: unknown;
        }) || {};
      const pose = {
        xMeters: typeof poseRaw.xMeters === "number" ? poseRaw.xMeters : 0,
        yMeters: typeof poseRaw.yMeters === "number" ? poseRaw.yMeters : 0,
        yawRadians:
          typeof poseRaw.yawRadians === "number" ? poseRaw.yawRadians : 0,
      };

      const operationalState: RobotOperationalState = (
        ["IDLE", "EXECUTING", "HELD", "STOPPED"].includes(
          String(payload.operationalState || payload.state).toUpperCase(),
        )
          ? String(payload.operationalState || payload.state).toUpperCase()
          : "IDLE"
      ) as RobotOperationalState;

      const connectivity: ConnectivityState = (
        ["CONNECTED", "DEGRADED", "DISCONNECTED"].includes(
          String(payload.connectivity).toUpperCase(),
        )
          ? String(payload.connectivity).toUpperCase()
          : "CONNECTED"
      ) as ConnectivityState;

      const robotFreshness: FreshnessState = (
        ["CURRENT", "STALE", "PARTIAL", "UNKNOWN"].includes(
          String(payload.freshness).toUpperCase(),
        )
          ? String(payload.freshness).toUpperCase()
          : (freshness as unknown as FreshnessState)
      ) as FreshnessState;

      const safety: SafetyState = (
        [
          "NORMAL",
          "WAIT",
          "CONTROLLED_STOP",
          "EMERGENCY_STOP",
          "REJECT",
          "FAULT",
        ].includes(String(payload.safety).toUpperCase())
          ? String(payload.safety).toUpperCase()
          : "NORMAL"
      ) as SafetyState;

      const controllerRaw =
        (payload.activeController as {
          mode?: unknown;
          identity?: unknown;
          contentDigestSha256?: unknown;
        }) || {};
      const activeController = {
        mode:
          typeof controllerRaw.mode === "string"
            ? controllerRaw.mode
            : "BASELINE",
        identity:
          typeof controllerRaw.identity === "string"
            ? controllerRaw.identity
            : "cardinal-baseline/1.0.0",
        contentDigestSha256:
          typeof controllerRaw.contentDigestSha256 === "string"
            ? controllerRaw.contentDigestSha256
            : undefined,
      };

      robots.push({
        id: String(entityId || `robot-${robots.length + 1}`),
        stateVersion:
          typeof entityVersion === "number"
            ? entityVersion
            : (payload.stateVersion as number) || 0,
        simulationTimeMs:
          typeof payload.simulationTimeMs === "number"
            ? payload.simulationTimeMs
            : 0,
        occurredAtUtc:
          typeof payload.occurredAt === "string"
            ? payload.occurredAt
            : snapshotAt,
        pose,
        operationalState,
        connectivity,
        freshness: robotFreshness,
        safety,
        activeController,
        currentOrderId:
          typeof payload.orderId === "string" ? payload.orderId : undefined,
        orderUpdateId:
          typeof payload.orderUpdateId === "number"
            ? payload.orderUpdateId
            : undefined,
        sessionEpoch:
          typeof payload.sessionEpoch === "number" ? payload.sessionEpoch : 1,
        simulatorId:
          typeof payload.simulatorId === "string"
            ? payload.simulatorId
            : undefined,
        batteryPercent:
          typeof payload.batteryPercent === "number"
            ? payload.batteryPercent
            : 100,
      });
    } else if (entityType === "ORDER") {
      const state: OrderLifecycleState = (
        [
          "Submitted",
          "Planning",
          "Dispatchable",
          "Dispatched",
          "Applied",
          "Executing",
          "Replanning",
          "Held",
          "Cancelling",
          "Completed",
          "Cancelled",
          "Rejected",
        ].includes(String(payload.state))
          ? String(payload.state)
          : "Submitted"
      ) as OrderLifecycleState;

      const assignmentsRaw = Array.isArray(payload.assignments)
        ? payload.assignments
        : [];
      const assignments = assignmentsRaw.map((a: any) => ({
        robotId: String(a.robotId || ""),
        goalColumn: Number(a.goalColumn) || 0,
        goalRow: Number(a.goalRow) || 0,
      }));

      orders.push({
        id: String(entityId || `order-${orders.length + 1}`),
        orderUpdateId:
          typeof payload.orderUpdateId === "number"
            ? payload.orderUpdateId
            : typeof entityVersion === "number"
              ? entityVersion
              : 0,
        planRevisionId:
          typeof payload.planRevisionId === "string"
            ? payload.planRevisionId
            : undefined,
        state,
        assignments,
        mapId: typeof payload.mapId === "string" ? payload.mapId : undefined,
        mapRevision:
          typeof payload.mapRevision === "number"
            ? payload.mapRevision
            : undefined,
        submittedAtUtc:
          typeof payload.submittedAt === "string"
            ? payload.submittedAt
            : snapshotAt,
        updatedAtUtc:
          typeof payload.updatedAt === "string"
            ? payload.updatedAt
            : snapshotAt,
      });
    }
  }

  return {
    contractVersion: "1.0.0",
    snapshotAt,
    cursor: {
      streamId,
      eventSequence,
    },
    freshness,
    map: currentMap,
    robots,
    orders,
  };
}
