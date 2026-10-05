import { adaptPlannedRoute } from "./plannedRouteAdapter.ts";
import { adaptQueueTask } from "./queueAdapter.ts";
import { adaptTrafficWait } from "./trafficAdapter.ts";
import { adaptBufferState } from "./bufferAdapter.ts";
import { adaptBatteryPolicy } from "../../utils/battery.ts";
import { adaptArrivalAction, adaptStationState } from "./stationAdapter.ts";
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
import type {
  Order,
  OrderLifecycleState,
  OrderTimelineEntry,
} from "../../domain/order/types.ts";
import type {
  Incident,
  IncidentSeverity,
  IncidentCategory,
  IncidentStatus,
} from "../../domain/incident/types.ts";
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
  fallbackMap?: RasterMap,
): AuthoritativeSnapshot {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid snapshot payload: expected non-null object");
  }

  const obj = raw as Record<string, unknown>;

  if (!["1.0.0", "1.1.0"].includes(String(obj.contractVersion))) {
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

  let currentMap: RasterMap | null = fallbackMap || null;
  const robots: Robot[] = [];
  const bufferStates: NonNullable<AuthoritativeSnapshot["bufferStates"]> = {};
  const orders: Order[] = [];
  const queueTasks: import("../queue.generated.ts").QueueTask[] = [];
  const incidents: Incident[] = [];
  const entityVersions: AuthoritativeSnapshot["entityVersions"] = {};
  const connectivityBySimulator = new Map<
    string,
    { state: string; sessionEpoch: number }
  >();

  const entities = Array.isArray(obj.entities) ? obj.entities : [];

  for (const entity of entities) {
    if (!entity || typeof entity !== "object") continue;
    const { entityType, entityId, entityVersion, contentDigestSha256, data } =
      entity;
    const payload = (data && typeof data === "object" ? data : {}) as Record<
      string,
      unknown
    >;
    if (
      typeof entityType !== "string" ||
      typeof entityId !== "string" ||
      typeof entityVersion !== "number" ||
      !Number.isSafeInteger(entityVersion) ||
      entityVersion < 0 ||
      typeof contentDigestSha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(contentDigestSha256)
    ) {
      throw new Error("Invalid authoritative snapshot entity envelope");
    }
    entityVersions[`${entityType}:${entityId}`] = {
      version: entityVersion,
      contentDigestSha256,
    };

    if (entityType === "BUFFER_STATE") {
      const state = adaptBufferState(payload);
      if (state.robotId !== entityId || state.entityVersion !== entityVersion)
        throw new Error("Buffer state envelope mismatch");
      bufferStates[state.robotId] = state;
    } else if (entityType === "QUEUE_TASK") {
      const task = adaptQueueTask(payload);
      if (task.taskId !== entityId || task.entityVersion !== entityVersion)
        throw new Error("Queue task envelope mismatch");
      queueTasks.push(task);
    } else if (entityType === "MAP") {
      currentMap = adaptRasterMap(payload);
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
        ["IDLE", "EXECUTING", "HELD", "STOPPED", "CHARGING"].includes(
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
        contentDigestSha256,
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
        simulatorBootId:
          typeof payload.simulatorBootId === "string"
            ? payload.simulatorBootId
            : undefined,
        simulatorId:
          typeof payload.simulatorId === "string"
            ? payload.simulatorId
            : undefined,
        stationActionsVersion:
          typeof payload.stationActionsVersion === "string"
            ? payload.stationActionsVersion
            : undefined,
        stationState: adaptStationState(payload.stationState),
        trafficWait: adaptTrafficWait(payload.trafficWait),
        batteryPercent:
          adaptStationState(payload.stationState)?.batteryPercent ??
          (typeof payload.batteryPercent === "number"
            ? payload.batteryPercent
            : 100),
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
        arrivalAction: adaptArrivalAction(a.arrivalAction),
      }));

      const orderUpdateId =
        typeof payload.orderUpdateId === "number"
          ? payload.orderUpdateId
          : typeof entityVersion === "number"
            ? entityVersion
            : 0;

      const submittedAtUtc =
        typeof payload.submittedAt === "string"
          ? payload.submittedAt
          : snapshotAt;
      const updatedAtUtc =
        typeof payload.updatedAt === "string" ? payload.updatedAt : snapshotAt;

      // Parse timeline if provided or construct initial timeline
      const timeline: OrderTimelineEntry[] = Array.isArray(payload.timeline)
        ? payload.timeline.map((t: any) => ({
            id: String(t.id || `tl-${Math.random()}`),
            state: t.state as OrderLifecycleState,
            occurredAtUtc: String(
              t.occurredAtUtc || t.occurredAt || snapshotAt,
            ),
            orderUpdateId: Number(t.orderUpdateId ?? orderUpdateId),
            planRevisionId: t.planRevisionId
              ? String(t.planRevisionId)
              : undefined,
            actor:
              t.actor ||
              (t.state === "Applied" || t.state === "Executing"
                ? "Simulator"
                : "Core MAPF"),
            detail: t.detail || undefined,
            isApplicationAck: t.isApplicationAck ?? t.state === "Applied",
            isExecutionReport: t.isExecutionReport ?? t.state === "Executing",
          }))
        : [
            {
              id: `tl-${entityId}-0`,
              state: "Submitted",
              occurredAtUtc: submittedAtUtc,
              orderUpdateId: 0,
              actor: "Operator",
              detail: "Order submitted with client requestId",
            },
            ...(state !== "Submitted"
              ? [
                  {
                    id: `tl-${entityId}-${orderUpdateId}`,
                    state,
                    occurredAtUtc: updatedAtUtc,
                    orderUpdateId,
                    actor: (state === "Applied" || state === "Executing"
                      ? "Simulator"
                      : "Core MAPF") as OrderTimelineEntry["actor"],
                    isApplicationAck: state === "Applied",
                    isExecutionReport: state === "Executing",
                    detail:
                      state === "Applied"
                        ? "Simulator acknowledged order application (Application Ack)"
                        : state === "Executing"
                          ? "Simulator runtime reported executing state"
                          : `Order state transitioned to ${state}`,
                  },
                ]
              : []),
          ];

      orders.push({
        id: String(entityId || `order-${orders.length + 1}`),
        entityVersion,
        contentDigestSha256,
        orderUpdateId,
        plannedRoute: adaptPlannedRoute(
          payload.plannedRoute,
          String(entityId),
          orderUpdateId,
        ),
        planRevisionId:
          typeof payload.planRevisionId === "string"
            ? payload.planRevisionId
            : undefined,
        state,
        requestId:
          typeof payload.requestId === "string" ? payload.requestId : undefined,
        assignments,
        mapId:
          typeof payload.mapId === "string"
            ? payload.mapId
            : typeof (payload.map as any)?.mapId === "string"
              ? (payload.map as any).mapId
              : undefined,
        mapRevision:
          typeof payload.mapRevision === "number"
            ? payload.mapRevision
            : typeof (payload.map as any)?.revision === "number"
              ? (payload.map as any).revision
              : undefined,
        submittedAtUtc:
          typeof payload.submittedAt === "string"
            ? payload.submittedAt
            : undefined,
        updatedAtUtc:
          typeof payload.updatedAt === "string" ? payload.updatedAt : undefined,
        timeline,
      });
    } else if (entityType === "INCIDENT") {
      const severity: IncidentSeverity = (
        ["INFO", "WARNING", "CRITICAL"].includes(
          String(payload.severity).toUpperCase(),
        )
          ? String(payload.severity).toUpperCase()
          : "WARNING"
      ) as IncidentSeverity;

      const category: IncidentCategory = (
        [
          "safety",
          "collision_risk",
          "deadlock",
          "fault",
          "connectivity",
          "contract",
          "auth",
          "policy",
        ].includes(String(payload.category).toLowerCase())
          ? String(payload.category).toLowerCase()
          : "safety"
      ) as IncidentCategory;

      const status: IncidentStatus = (
        ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"].includes(
          String(payload.status).toUpperCase(),
        )
          ? String(payload.status).toUpperCase()
          : "ACTIVE"
      ) as IncidentStatus;

      const allowedActions = Array.isArray(payload.allowedActions)
        ? payload.allowedActions.map(String)
        : ["ACKNOWLEDGE"];

      incidents.push({
        id: String(entityId || `incident-${incidents.length + 1}`),
        entityVersion,
        contentDigestSha256,
        severity,
        category,
        status,
        occurredAtUtc:
          typeof payload.occurredAt === "string"
            ? payload.occurredAt
            : snapshotAt,
        simulationTimeMs:
          typeof payload.simulationTimeMs === "number"
            ? payload.simulationTimeMs
            : 0,
        resolvedAtUtc:
          typeof payload.resolvedAt === "string"
            ? payload.resolvedAt
            : undefined,
        acknowledgedAtUtc:
          typeof payload.acknowledgedAt === "string"
            ? payload.acknowledgedAt
            : undefined,
        acknowledgedBy:
          typeof payload.acknowledgedBy === "string"
            ? payload.acknowledgedBy
            : undefined,
        reasonCode: String(payload.reasonCode || payload.code || "INCIDENT"),
        description: String(
          payload.description ||
            payload.message ||
            "Operational incident recorded",
        ),
        relatedEntity:
          payload.relatedEntity && typeof payload.relatedEntity === "object"
            ? {
                type: (payload.relatedEntity as any).type || "ROBOT",
                id: String((payload.relatedEntity as any).id || ""),
                version: (payload.relatedEntity as any).version,
              }
            : payload.robotId
              ? {
                  type: "ROBOT",
                  id: String(payload.robotId),
                }
              : payload.orderId
                ? {
                    type: "ORDER",
                    id: String(payload.orderId),
                  }
                : undefined,
        allowedActions,
      });
    } else if (entityType === "CONNECTIVITY") {
      connectivityBySimulator.set(entityId, {
        state: String(payload.state || "NotReady"),
        sessionEpoch:
          typeof payload.sessionEpoch === "number" ? payload.sessionEpoch : 0,
      });
    }
  }

  if (!currentMap) {
    throw new Error("Authoritative snapshot is missing a MAP entity");
  }

  for (const robot of robots) {
    robot.bufferState = bufferStates[robot.id];
    if (!robot.simulatorId) continue;
    const connectivity = connectivityBySimulator.get(robot.simulatorId);
    if (!connectivity) continue;
    robot.sessionEpoch = connectivity.sessionEpoch;
    robot.connectivity =
      connectivity.state === "Synchronized"
        ? "CONNECTED"
        : connectivity.state === "Degraded"
          ? "DISCONNECTED"
          : "DEGRADED";
    if (robot.connectivity !== "CONNECTED") {
      robot.freshness = "STALE";
    }
  }

  return {
    contractVersion: "1.0.0",
    snapshotAt,
    batteryPolicy: adaptBatteryPolicy(obj.batteryPolicy),
    cursor: {
      streamId,
      eventSequence,
    },
    freshness,
    entityVersions,
    map: currentMap,
    robots,
    orders,
    queueTasks,
    bufferStates,
    incidents,
  };
}
