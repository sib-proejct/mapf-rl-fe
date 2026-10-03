import { isNodeCommandTransportReady } from "../../domain/order/nodeCommand.ts";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useReducer,
} from "react";
import type { AuthoritativeSnapshot } from "../../domain/snapshot/types.ts";
import type { Robot } from "../../domain/robot/types.ts";
import type { Order } from "../../domain/order/types.ts";
import type { Incident } from "../../domain/incident/types.ts";
import type { MapNode, MapTopology } from "../../domain/map/types.ts";
import type {
  ConnectionState,
  StreamTransportMode,
  ReconciliationDiagnostics,
  StreamEnvelope,
} from "../../domain/event/types.ts";
import type {
  PendingMutation,
  CreateOrderInput,
  CancelOrderRequest,
  ReassignOrderRequest,
  InstantActionRequest,
  IncidentActionRequest,
  MutationOperation,
} from "../../domain/mutation/types.ts";
import { deriveMapTopology } from "../../utils/map/topology.ts";
import {
  NormalizedProblem,
  normalizeProblem,
} from "../../contracts/adapters/problem.ts";
import { adaptOperationsSnapshot } from "../../contracts/adapters/snapshotAdapter.ts";
import {
  defaultApiClient,
  ProblemError,
  queueOrderInput,
} from "../../services/api/client.ts";
import {
  CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
  CANONICAL_STALE_SNAPSHOT_FIXTURE,
  CANONICAL_PARTIAL_SNAPSHOT_FIXTURE,
  CANONICAL_DISCONNECTED_SNAPSHOT_FIXTURE,
  CANONICAL_PROBLEM_FIXTURE,
} from "../../contracts/fixtures/canonical.ts";
import {
  generateStressSnapshot,
  resetRobotMotionCache,
} from "../../contracts/fixtures/stressFleet.ts";
import { MEGA_WAREHOUSE_MAP_FIXTURE } from "../../contracts/fixtures/largeWarehouseMap.ts";
import {
  reconciliationReducer,
  INITIAL_RECONCILIATION_STATE,
} from "../../state/reconciliation/reducer.ts";
import { BoundedEventBuffer } from "../../state/reconciliation/boundedBuffer.ts";
import { CoreWsClient } from "../../services/websocket/client.ts";
import { PollingFallbackManager } from "../../services/websocket/pollingFallback.ts";
import {
  MockStreamEngine,
  MockScenario,
} from "../../services/websocket/mockStream.ts";
import { globalMutationManager } from "../../state/mutations/mutationManager.ts";

export type FixtureMode =
  | "current"
  | "stale"
  | "partial"
  | "disconnected"
  | "error";

export type FleetScale = 4 | 100;

export interface ActionDialogTarget {
  operation: MutationOperation;
  order?: Order;
  robot?: Robot;
  incident?: Incident;
}

export interface NodeCommand {
  robotId: string;
  nodeId: number;
  state: "submitting" | "confirmed" | "uncertain" | "rejected";
  mutation?: PendingMutation;
  error?: string;
}
export interface OperationsContextType {
  clickNode: (nodeId: number) => Promise<void>;
  nodeConfirmation: { robotId: string; nodeId: number } | null;
  confirmNodeCommand: () => Promise<void>;
  dismissNodeConfirmation: () => void;
  nodeCommand: NodeCommand | null;
  retryNodeCommand: () => Promise<void>;

  // Snapshot and operational entity state
  snapshot: AuthoritativeSnapshot | null;
  loading: boolean;
  error: NormalizedProblem | null;
  lastFetchedAt: Date | null;
  refreshSnapshot: () => Promise<void>;

  // Selection state
  selectedRobotId: string | null;
  setSelectedRobotId: (id: string | null) => void;
  selectedRobot: Robot | null;
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;
  selectedOrder: Order | null;
  selectedIncidentId: string | null;
  setSelectedIncidentId: (id: string | null) => void;
  selectedIncident: Incident | null;
  selectedNodeId: number | null;
  setSelectedNodeId: (id: number | null) => void;
  selectedNode: MapNode | null;
  topology: MapTopology | null;

  // Fleet scale & motion
  fleetScale: FleetScale;
  setFleetScale: (scale: FleetScale) => void;
  isSimulatingMotion: boolean;
  setIsSimulatingMotion: (simulating: boolean) => void;

  // Phase 1 legacy compatibility
  useFixture: boolean;
  setUseFixture: (use: boolean) => void;
  fixtureMode: FixtureMode;
  setFixtureMode: (mode: FixtureMode) => void;

  // Phase 2 Realtime Reconciliation state
  connectionState: ConnectionState;
  transportMode: StreamTransportMode;
  setTransportMode: (mode: StreamTransportMode) => void;
  mockScenario: MockScenario;
  setMockScenario: (scenario: MockScenario) => void;
  diagnostics: ReconciliationDiagnostics;
  resetDiagnostics: () => void;

  // Phase 3 Mutation & Incident state and actions
  pendingMutations: PendingMutation[];
  createOrder: (
    req: CreateOrderInput,
    options?: { timeoutMs?: number },
  ) => Promise<PendingMutation>;
  cancelQueueTask: (taskId: string) => Promise<PendingMutation>;
  cancelOrder: (
    req: CancelOrderRequest,
    options?: { timeoutMs?: number },
  ) => Promise<PendingMutation>;
  reassignOrder: (
    req: ReassignOrderRequest,
    options?: { timeoutMs?: number },
  ) => Promise<PendingMutation>;
  sendInstantAction: (
    req: InstantActionRequest,
    options?: { timeoutMs?: number },
  ) => Promise<PendingMutation>;
  acknowledgeIncident: (
    req: IncidentActionRequest,
    options?: { timeoutMs?: number },
  ) => Promise<PendingMutation>;
  resolveIncident: (
    req: IncidentActionRequest,
    options?: { timeoutMs?: number },
  ) => Promise<PendingMutation>;
  retryMutation: (requestId: string) => Promise<PendingMutation>;
  dismissMutation: (requestId: string) => void;

  // Dialog & Modal controls
  isOrderModalOpen: boolean;
  setIsOrderModalOpen: (open: boolean) => void;
  actionDialogTarget: ActionDialogTarget | null;
  setActionDialogTarget: (target: ActionDialogTarget | null) => void;
  isIncidentCenterOpen: boolean;
  setIsIncidentCenterOpen: (open: boolean) => void;
}

const OperationsContext = createContext<OperationsContextType | undefined>(
  undefined,
);

export const OperationsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [reconState, dispatch] = useReducer(
    reconciliationReducer,
    INITIAL_RECONCILIATION_STATE,
  );

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<NormalizedProblem | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  // Selections
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(
    "robot-01",
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(
    null,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  // Modals & Drawers
  const [isOrderModalOpen, setIsOrderModalOpen] = useState<boolean>(false);
  const [actionDialogTarget, setActionDialogTarget] =
    useState<ActionDialogTarget | null>(null);
  const [isIncidentCenterOpen, setIsIncidentCenterOpen] =
    useState<boolean>(false);

  // Mutations
  const [pendingMutations, setPendingMutations] = useState<PendingMutation[]>(
    [],
  );

  // Fleet settings
  const [fleetScale, setFleetScaleState] = useState<FleetScale>(4);
  const [isSimulatingMotion, setIsSimulatingMotion] = useState<boolean>(true);

  // Transports & simulation modes
  const [transportMode, setTransportModeState] =
    useState<StreamTransportMode>("LIVE_WEBSOCKET");
  const [mockScenario, setMockScenarioState] =
    useState<MockScenario>("nominal_10hz");
  const [fixtureMode, setFixtureModeState] = useState<FixtureMode>("current");

  // Bounded buffer for incoming events while snapshot is loading
  const boundedBufferRef = useRef<BoundedEventBuffer>(
    new BoundedEventBuffer({ maxCapacity: 5000 }),
  );

  // Batch queue for 10Hz throttled rendering
  const eventBatchQueueRef = useRef<StreamEnvelope[]>([]);
  const batchTimerRef = useRef<any>(null);

  // Service singletons
  const wsClientRef = useRef<CoreWsClient | null>(null);
  const pollingManagerRef = useRef<PollingFallbackManager | null>(null);
  const mockEngineRef = useRef<MockStreamEngine>(new MockStreamEngine());

  // Subscribe to Mutation Manager
  useEffect(() => {
    return globalMutationManager.subscribe((muts) => {
      setPendingMutations(muts);
    });
  }, []);

  // Derive topology graph from map
  const topology = useMemo(() => {
    if (!reconState.snapshot?.map) return null;
    return deriveMapTopology(reconState.snapshot.map);
  }, [reconState.snapshot?.map]);

  /**
   * Dispatches queued events to the reducer at 10Hz (100ms interval).
   */
  const flushBatchQueue = useCallback(() => {
    if (eventBatchQueueRef.current.length === 0) return;
    const batch = [...eventBatchQueueRef.current];
    eventBatchQueueRef.current = [];

    dispatch({
      type: "STREAM_BATCH_RECEIVED",
      events: batch,
    });
  }, []);

  /**
   * Enqueues an inbound stream envelope for batch processing.
   */
  const handleInboundEvent = useCallback((event: StreamEnvelope) => {
    eventBatchQueueRef.current.push(event);
  }, []);

  /**
   * Loads an authoritative REST snapshot from Core or Canonical Fixture.
   */
  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let snapshotData: AuthoritativeSnapshot;

      if (transportMode === "FIXTURE_STREAM") {
        eventBatchQueueRef.current = [];
        boundedBufferRef.current.clear();
        resetRobotMotionCache();

        if (fixtureMode === "error") {
          const prob = normalizeProblem(CANONICAL_PROBLEM_FIXTURE);
          setError(prob);
          setLoading(false);
          return;
        } else if (fixtureMode === "stale") {
          snapshotData = adaptOperationsSnapshot(
            CANONICAL_STALE_SNAPSHOT_FIXTURE,
          );
        } else if (fixtureMode === "partial") {
          snapshotData = adaptOperationsSnapshot(
            CANONICAL_PARTIAL_SNAPSHOT_FIXTURE,
          );
        } else if (fixtureMode === "disconnected") {
          snapshotData = adaptOperationsSnapshot(
            CANONICAL_DISCONNECTED_SNAPSHOT_FIXTURE,
          );
        } else {
          if (fleetScale > 4) {
            snapshotData = generateStressSnapshot(
              fleetScale,
              MEGA_WAREHOUSE_MAP_FIXTURE,
            );
            setSelectedRobotId((prev) =>
              prev && prev.startsWith("robot-") ? prev : "robot-001",
            );
          } else {
            snapshotData = adaptOperationsSnapshot(
              CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
            );
            setSelectedRobotId((prev) =>
              prev && prev.startsWith("robot-") && !prev.startsWith("robot-00")
                ? prev
                : "robot-01",
            );
          }
        }
      } else {
        // Live REST fetch
        const raw = await defaultApiClient.fetchOperationsSnapshot();
        snapshotData = adaptOperationsSnapshot(raw);
      }

      eventBatchQueueRef.current = [];
      // Atomically replace snapshot in state and replay buffered events
      const buffered =
        transportMode === "FIXTURE_STREAM"
          ? []
          : boundedBufferRef.current.getEventsAfter(
              snapshotData.cursor.eventSequence,
            );
      boundedBufferRef.current.trimBefore(snapshotData.cursor.eventSequence);

      dispatch({
        type: "SNAPSHOT_REPLACED",
        snapshot: snapshotData,
        bufferedEvents: buffered,
      });

      // Reconcile any in-flight/uncertain mutations against fresh snapshot
      globalMutationManager.reconcileWithSnapshot(snapshotData);

      setLastFetchedAt(new Date());
    } catch (err: unknown) {
      dispatch({ type: "SNAPSHOT_LOAD_FAILED" });
      if (err instanceof ProblemError) {
        setError(err.problem);
      } else {
        setError(normalizeProblem(err));
      }
    } finally {
      setLoading(false);
    }
  }, [transportMode, fixtureMode, fleetScale]);

  const refreshSnapshot = useCallback(async () => {
    await loadSnapshot();
  }, [loadSnapshot]);

  // Initial Snapshot load
  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  // Setup 10Hz batch flush timer
  useEffect(() => {
    batchTimerRef.current = setInterval(() => {
      flushBatchQueue();
    }, 100); // 10Hz

    return () => {
      if (batchTimerRef.current) {
        clearInterval(batchTimerRef.current);
      }
    };
  }, [flushBatchQueue]);

  const latestSnapshotRef = useRef<AuthoritativeSnapshot | null>(null);
  latestSnapshotRef.current = reconState.snapshot;

  // Setup Mock Stream Engine for FIXTURE_STREAM mode
  useEffect(() => {
    if (
      transportMode !== "FIXTURE_STREAM" ||
      !isSimulatingMotion ||
      !reconState.snapshot
    ) {
      mockEngineRef.current.stop();
      return;
    }

    mockEngineRef.current.start(
      reconState.cursor.eventSequence,
      mockScenario,
      reconState.snapshot,
    );

    const interval = setInterval(() => {
      const snap = latestSnapshotRef.current;
      if (!snap) return;
      const events = mockEngineRef.current.generateEvents(snap, topology);
      for (const ev of events) {
        boundedBufferRef.current.push(ev);
        handleInboundEvent(ev);
      }
    }, 100); // 10Hz stream

    return () => {
      clearInterval(interval);
      mockEngineRef.current.stop();
    };
  }, [
    transportMode,
    isSimulatingMotion,
    mockScenario,
    topology,
    handleInboundEvent,
  ]);

  // Setup WebSocket Client for LIVE_WEBSOCKET mode
  useEffect(() => {
    if (transportMode !== "LIVE_WEBSOCKET") {
      if (wsClientRef.current) {
        wsClientRef.current.disconnect();
        wsClientRef.current = null;
      }
      return;
    }

    const ws = new CoreWsClient({
      onConnected: () => {
        loadSnapshot();
      },
      onMessage: (envelope) => {
        boundedBufferRef.current.push(envelope);
        handleInboundEvent(envelope);
      },
      onStateChange: (state) => {
        dispatch({ type: "CONNECTION_STATE_CHANGED", connectionState: state });
      },
      onError: (err) => {
        console.warn("WebSocket client error:", err);
      },
    });

    wsClientRef.current = ws;
    ws.connect();

    return () => {
      ws.disconnect();
      wsClientRef.current = null;
    };
  }, [transportMode, handleInboundEvent, loadSnapshot]);

  // Setup 5s Polling Fallback for POLLING_FALLBACK mode
  useEffect(() => {
    if (transportMode !== "POLLING_FALLBACK") {
      if (pollingManagerRef.current) {
        pollingManagerRef.current.stop();
        pollingManagerRef.current = null;
      }
      return;
    }

    const polling = new PollingFallbackManager({
      intervalMs: 5000,
      onSnapshot: (snap) => {
        dispatch({ type: "SNAPSHOT_REPLACED", snapshot: snap });
        globalMutationManager.reconcileWithSnapshot(snap);
        setLastFetchedAt(new Date());
      },
      onError: (err) => {
        dispatch({ type: "SNAPSHOT_LOAD_FAILED" });
        setError(normalizeProblem(err));
      },
    });

    pollingManagerRef.current = polling;
    polling.start();
    dispatch({ type: "CONNECTION_STATE_CHANGED", connectionState: "Current" });

    return () => {
      polling.stop();
      pollingManagerRef.current = null;
    };
  }, [transportMode]);

  // Auto-recovery trigger when Gap or Conflict is detected in live WS mode
  useEffect(() => {
    if (
      reconState.connectionState === "Reconciling" &&
      (reconState.diagnostics.lastDecision === "GAP" ||
        reconState.diagnostics.lastDecision === "CONFLICT")
    ) {
      if (transportMode === "LIVE_WEBSOCKET") {
        loadSnapshot();
      }
    }
  }, [
    reconState.connectionState,
    reconState.diagnostics.lastDecision,
    transportMode,
    loadSnapshot,
  ]);

  // Handle visibility change (background / slow tab return)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        flushBatchQueue();
        if (
          reconState.connectionState === "Stale" ||
          reconState.connectionState === "Disconnected"
        ) {
          loadSnapshot();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushBatchQueue, reconState.connectionState, loadSnapshot]);

  /* -------------------------------------------------------------------------- */
  /* Phase 3 Mutation Actions                                                   */
  /* -------------------------------------------------------------------------- */

  const createOrder = useCallback(
    async (
      req: CreateOrderInput,
      options?: { timeoutMs?: number; forcedRequestId?: string },
    ): Promise<PendingMutation> => {
      if (
        !options?.forcedRequestId &&
        globalMutationManager
          .getAll()
          .some(
            (mutation) =>
              mutation.operation === "CREATE_ORDER" &&
              ["submitting", "uncertain"].includes(mutation.state),
          )
      ) {
        throw new Error("기존 주문의 응답을 먼저 확인하세요.");
      }
      if (transportMode === "FIXTURE_STREAM" && !("assignments" in req)) {
        throw new Error("자동 배차는 Live에서 사용할 수 있습니다.");
      }
      const mut = globalMutationManager.startMutation(
        "CREATE_ORDER",
        (transportMode === "FIXTURE_STREAM"
          ? req
          : queueOrderInput(req)) as unknown as Record<string, unknown>,
        undefined,
        undefined,
        options?.forcedRequestId,
      );

      if (transportMode === "FIXTURE_STREAM" && "assignments" in req) {
        const orderId = `order-${Date.now().toString().slice(-4)}`;
        const nowIso = new Date().toISOString();
        const newOrder: Order = {
          id: orderId,
          requestId: mut.requestId,
          entityVersion: 1,
          orderUpdateId: 0,
          state: "Submitted",
          mapId: req.mapId,
          mapRevision: req.mapRevision,
          assignments: req.assignments.map((a) => ({
            robotId: a.robotId || "robot-01",
            goalColumn: a.goalColumn,
            goalRow: a.goalRow,
          })),
          submittedAtUtc: nowIso,
          updatedAtUtc: nowIso,
          timeline: [
            {
              id: `tl-${orderId}-0`,
              state: "Submitted",
              occurredAtUtc: nowIso,
              orderUpdateId: 0,
              actor: "Operator",
              detail: `Order submitted with client requestId ${mut.requestId.slice(0, 8)}...`,
            },
          ],
        };

        dispatch({ type: "ORDER_CREATED_OPTIMISTIC", order: newOrder });
        setSelectedOrderId(orderId);
        globalMutationManager.confirmMutation(mut.requestId, {
          status: "CONFIRMED",
          entityId: orderId,
          entityVersion: 1,
          orderUpdateId: 0,
        });
        return globalMutationManager.get(mut.requestId)!;
      }

      // Live REST execution
      try {
        const outcome = await defaultApiClient.enqueueOrder(req, {
          requestId: mut.requestId,
          timeoutMs: options?.timeoutMs || 8000,
        });
        globalMutationManager.confirmMutation(mut.requestId, outcome);
        if (outcome.entityId) {
          setSelectedOrderId(outcome.entityId);
        }
        await loadSnapshot();
      } catch (err: unknown) {
        if (
          err instanceof ProblemError &&
          err.problem.code === "MUTATION_TIMEOUT_UNCERTAIN"
        ) {
          globalMutationManager.markUncertain(
            mut.requestId,
            err.problem.detail,
          );
        } else {
          globalMutationManager.rejectMutation(mut.requestId, err);
        }
      }

      return globalMutationManager.get(mut.requestId)!;
    },
    [transportMode, loadSnapshot],
  );

  const cancelOrder = useCallback(
    async (
      req: CancelOrderRequest,
      options?: { timeoutMs?: number; forcedRequestId?: string },
    ): Promise<PendingMutation> => {
      const mut = globalMutationManager.startMutation(
        "CANCEL_ORDER",
        req as unknown as Record<string, unknown>,
        req.orderId,
        req.orderUpdateId,
        options?.forcedRequestId,
      );

      const nowIso = new Date().toISOString();

      if (transportMode === "FIXTURE_STREAM") {
        dispatch({
          type: "ORDER_CANCELLED_CONFIRMED",
          orderId: req.orderId,
          orderUpdateId: req.orderUpdateId + 1,
          occurredAtUtc: nowIso,
        });
        globalMutationManager.confirmMutation(mut.requestId, {
          status: "CONFIRMED",
          entityId: req.orderId,
          orderUpdateId: req.orderUpdateId + 1,
        });
        return globalMutationManager.get(mut.requestId)!;
      }

      try {
        const outcome = await defaultApiClient.cancelOrder(req, {
          requestId: mut.requestId,
          timeoutMs: options?.timeoutMs || 8000,
        });
        globalMutationManager.confirmMutation(mut.requestId, outcome);
        await loadSnapshot();
      } catch (err: unknown) {
        if (
          err instanceof ProblemError &&
          err.problem.code === "MUTATION_TIMEOUT_UNCERTAIN"
        ) {
          globalMutationManager.markUncertain(
            mut.requestId,
            err.problem.detail,
          );
        } else {
          globalMutationManager.rejectMutation(mut.requestId, err);
        }
      }

      return globalMutationManager.get(mut.requestId)!;
    },
    [transportMode, loadSnapshot],
  );

  const cancelQueueTask = useCallback(
    async (
      taskId: string,
      options?: { forcedRequestId?: string },
    ): Promise<PendingMutation> => {
      const existing = globalMutationManager
        .getAll()
        .find(
          (mutation) =>
            mutation.operation === "CANCEL_QUEUE_TASK" &&
            mutation.targetEntityId === taskId &&
            ["submitting", "uncertain"].includes(mutation.state),
        );
      if (existing?.state === "submitting") return existing;
      const mut = globalMutationManager.startMutation(
        "CANCEL_QUEUE_TASK",
        { taskId },
        taskId,
        undefined,
        options?.forcedRequestId ?? existing?.requestId,
      );
      try {
        const outcome = await defaultApiClient.cancelQueueTask(taskId, {
          requestId: mut.requestId,
          timeoutMs: 8000,
        });
        globalMutationManager.confirmMutation(mut.requestId, outcome);
        await loadSnapshot();
      } catch (err) {
        if (
          err instanceof ProblemError &&
          err.problem.code === "MUTATION_TIMEOUT_UNCERTAIN"
        )
          globalMutationManager.markUncertain(
            mut.requestId,
            err.problem.detail,
          );
        else globalMutationManager.rejectMutation(mut.requestId, err);
      }
      return globalMutationManager.get(mut.requestId)!;
    },
    [loadSnapshot],
  );

  const reassignOrder = useCallback(
    async (
      req: ReassignOrderRequest,
      options?: { timeoutMs?: number; forcedRequestId?: string },
    ): Promise<PendingMutation> => {
      const mut = globalMutationManager.startMutation(
        "REASSIGN_ORDER",
        req as unknown as Record<string, unknown>,
        req.orderId,
        req.orderUpdateId,
        options?.forcedRequestId,
      );

      const nowIso = new Date().toISOString();

      if (transportMode === "FIXTURE_STREAM") {
        dispatch({
          type: "ORDER_REASSIGNED_CONFIRMED",
          orderId: req.orderId,
          orderUpdateId: req.orderUpdateId + 1,
          assignments: req.assignments,
          occurredAtUtc: nowIso,
        });
        globalMutationManager.confirmMutation(mut.requestId, {
          status: "CONFIRMED",
          entityId: req.orderId,
          orderUpdateId: req.orderUpdateId + 1,
        });
        return globalMutationManager.get(mut.requestId)!;
      }

      try {
        const outcome = await defaultApiClient.reassignOrder(req, {
          requestId: mut.requestId,
          timeoutMs: options?.timeoutMs || 8000,
        });
        globalMutationManager.confirmMutation(mut.requestId, outcome);
        await loadSnapshot();
      } catch (err: unknown) {
        if (
          err instanceof ProblemError &&
          err.problem.code === "MUTATION_TIMEOUT_UNCERTAIN"
        ) {
          globalMutationManager.markUncertain(
            mut.requestId,
            err.problem.detail,
          );
        } else {
          globalMutationManager.rejectMutation(mut.requestId, err);
        }
      }

      return globalMutationManager.get(mut.requestId)!;
    },
    [transportMode, loadSnapshot],
  );

  const sendInstantAction = useCallback(
    async (
      req: InstantActionRequest,
      options?: { timeoutMs?: number; forcedRequestId?: string },
    ): Promise<PendingMutation> => {
      const mut = globalMutationManager.startMutation(
        "INSTANT_ACTION",
        req as unknown as Record<string, unknown>,
        req.robotId,
        undefined,
        options?.forcedRequestId,
      );

      const nowIso = new Date().toISOString();

      if (transportMode === "FIXTURE_STREAM") {
        dispatch({
          type: "ROBOT_INSTANT_ACTION_APPLIED",
          robotId: req.robotId,
          action: req.action,
          occurredAtUtc: nowIso,
        });
        globalMutationManager.confirmMutation(mut.requestId, {
          status: "CONFIRMED",
          entityId: req.robotId,
        });
        return globalMutationManager.get(mut.requestId)!;
      }

      try {
        const outcome = await defaultApiClient.sendInstantAction(req, {
          requestId: mut.requestId,
          timeoutMs: options?.timeoutMs || 8000,
        });
        globalMutationManager.confirmMutation(mut.requestId, outcome);
        await loadSnapshot();
      } catch (err: unknown) {
        if (
          err instanceof ProblemError &&
          err.problem.code === "MUTATION_TIMEOUT_UNCERTAIN"
        ) {
          globalMutationManager.markUncertain(
            mut.requestId,
            err.problem.detail,
          );
        } else {
          globalMutationManager.rejectMutation(mut.requestId, err);
        }
      }

      return globalMutationManager.get(mut.requestId)!;
    },
    [transportMode, loadSnapshot],
  );

  const acknowledgeIncident = useCallback(
    async (
      req: IncidentActionRequest,
      options?: { timeoutMs?: number },
    ): Promise<PendingMutation> => {
      const mut = globalMutationManager.startMutation(
        "ACKNOWLEDGE_INCIDENT",
        req as unknown as Record<string, unknown>,
        req.incidentId,
      );

      const nowIso = new Date().toISOString();

      if (transportMode === "FIXTURE_STREAM") {
        dispatch({
          type: "INCIDENT_ACKNOWLEDGED",
          incidentId: req.incidentId,
          acknowledgedBy: "Operator",
          occurredAtUtc: nowIso,
        });
        globalMutationManager.confirmMutation(mut.requestId, {
          status: "CONFIRMED",
          entityId: req.incidentId,
        });
        return globalMutationManager.get(mut.requestId)!;
      }

      try {
        const outcome = await defaultApiClient.acknowledgeIncident(req, {
          requestId: mut.requestId,
          timeoutMs: options?.timeoutMs || 8000,
        });
        globalMutationManager.confirmMutation(mut.requestId, outcome);
        await loadSnapshot();
      } catch (err: unknown) {
        if (
          err instanceof ProblemError &&
          err.problem.code === "MUTATION_TIMEOUT_UNCERTAIN"
        ) {
          globalMutationManager.markUncertain(
            mut.requestId,
            err.problem.detail,
          );
        } else {
          globalMutationManager.rejectMutation(mut.requestId, err);
        }
      }

      return globalMutationManager.get(mut.requestId)!;
    },
    [transportMode, loadSnapshot],
  );

  const resolveIncident = useCallback(
    async (
      req: IncidentActionRequest,
      options?: { timeoutMs?: number },
    ): Promise<PendingMutation> => {
      const mut = globalMutationManager.startMutation(
        "RESOLVE_INCIDENT",
        req as unknown as Record<string, unknown>,
        req.incidentId,
      );

      const nowIso = new Date().toISOString();

      if (transportMode === "FIXTURE_STREAM") {
        dispatch({
          type: "INCIDENT_RESOLVED",
          incidentId: req.incidentId,
          occurredAtUtc: nowIso,
        });
        globalMutationManager.confirmMutation(mut.requestId, {
          status: "CONFIRMED",
          entityId: req.incidentId,
        });
        return globalMutationManager.get(mut.requestId)!;
      }

      try {
        const outcome = await defaultApiClient.resolveIncident(req, {
          requestId: mut.requestId,
          timeoutMs: options?.timeoutMs || 8000,
        });
        globalMutationManager.confirmMutation(mut.requestId, outcome);
        await loadSnapshot();
      } catch (err: unknown) {
        if (
          err instanceof ProblemError &&
          err.problem.code === "MUTATION_TIMEOUT_UNCERTAIN"
        ) {
          globalMutationManager.markUncertain(
            mut.requestId,
            err.problem.detail,
          );
        } else {
          globalMutationManager.rejectMutation(mut.requestId, err);
        }
      }

      return globalMutationManager.get(mut.requestId)!;
    },
    [transportMode, loadSnapshot],
  );

  const retryMutation = useCallback(
    async (requestId: string): Promise<PendingMutation> => {
      const existing = globalMutationManager.get(requestId);
      if (!existing) {
        throw new Error(`Mutation ${requestId} not found for retry.`);
      }

      if (existing.operation === "CREATE_ORDER") {
        return createOrder(existing.payload as unknown as CreateOrderInput, {
          forcedRequestId: requestId,
        });
      } else if (existing.operation === "CANCEL_QUEUE_TASK") {
        return cancelQueueTask(String(existing.payload.taskId), {
          forcedRequestId: requestId,
        });
      } else if (existing.operation === "CANCEL_ORDER") {
        return cancelOrder(existing.payload as unknown as CancelOrderRequest, {
          forcedRequestId: requestId,
        });
      } else if (existing.operation === "REASSIGN_ORDER") {
        return reassignOrder(
          existing.payload as unknown as ReassignOrderRequest,
          {
            forcedRequestId: requestId,
          },
        );
      } else if (existing.operation === "INSTANT_ACTION") {
        return sendInstantAction(
          existing.payload as unknown as InstantActionRequest,
          {
            forcedRequestId: requestId,
          },
        );
      }
      return existing;
    },
    [
      createOrder,
      cancelOrder,
      cancelQueueTask,
      reassignOrder,
      sendInstantAction,
    ],
  );

  const dismissMutation = useCallback((requestId: string) => {
    globalMutationManager.dismissMutation(requestId);
  }, []);

  // Set transport mode wrapper
  const setTransportMode = useCallback((mode: StreamTransportMode) => {
    setTransportModeState(mode);
    dispatch({ type: "TRANSPORT_MODE_CHANGED", transportMode: mode });
  }, []);

  const setFleetScale = useCallback((scale: FleetScale) => {
    eventBatchQueueRef.current = [];
    boundedBufferRef.current.clear();
    resetRobotMotionCache();
    mockEngineRef.current.stop();
    setFleetScaleState(scale);
  }, []);

  const setMockScenario = useCallback((scen: MockScenario) => {
    eventBatchQueueRef.current = [];
    boundedBufferRef.current.clear();
    setMockScenarioState(scen);
    mockEngineRef.current.setScenario(scen);
  }, []);

  const setFixtureMode = useCallback((mode: FixtureMode) => {
    eventBatchQueueRef.current = [];
    boundedBufferRef.current.clear();
    resetRobotMotionCache();
    mockEngineRef.current.stop();
    setFixtureModeState(mode);
    if (mode === "error") {
      setError(normalizeProblem(CANONICAL_PROBLEM_FIXTURE));
    }
  }, []);

  const setUseFixture = useCallback(
    (use: boolean) => {
      if (use) {
        setTransportMode("FIXTURE_STREAM");
      } else {
        setTransportMode("LIVE_WEBSOCKET");
      }
    },
    [setTransportMode],
  );

  const resetDiagnostics = useCallback(() => {
    dispatch({ type: "RESET_DIAGNOSTICS" });
  }, []);

  // Keep the retired local demo robot out of the operator view.
  const visibleSnapshot = useMemo(() => {
    const snapshot = reconState.snapshot;
    if (!snapshot || transportMode === "FIXTURE_STREAM") return snapshot;
    return {
      ...snapshot,
      robots: snapshot.robots.filter((robot) => robot.id !== "local-robot-1"),
    };
  }, [reconState.snapshot, transportMode]);

  const [nodeCommand, setNodeCommand] = useState<NodeCommand | null>(null);
  const nodeSubmitting = useRef(false);
  useEffect(() => {
    setNodeCommand((command) => {
      const mutation = pendingMutations.find(
        (mutation) => mutation.requestId === command?.mutation?.requestId,
      );
      if (
        !command ||
        !mutation ||
        !["confirmed", "uncertain", "rejected"].includes(mutation.state) ||
        command.state === mutation.state
      )
        return command;
      return {
        ...command,
        mutation,
        state: mutation.state as NodeCommand["state"],
      };
    });
  }, [pendingMutations]);

  const [nodeConfirmation, setNodeConfirmation] = useState<{
    robotId: string;
    nodeId: number;
  } | null>(null);
  const selectRobot = useCallback((id: string | null) => {
    setNodeConfirmation(null);
    setSelectedRobotId(id);
    setSelectedNodeId(null);
    setNodeCommand((command) =>
      command?.state === "uncertain" || command?.state === "submitting"
        ? command
        : null,
    );
  }, []);
  const clickNode = async (nodeId: number) => {
    setSelectedNodeId(nodeId);
    if (!selectedRobotId) return;
    if (nodeSubmitting.current) return;
    setNodeConfirmation({ robotId: selectedRobotId, nodeId });
  };
  const confirmNodeCommand = async () => {
    if (
      !nodeConfirmation ||
      nodeConfirmation.robotId !== selectedRobotId ||
      nodeConfirmation.nodeId !== selectedNodeId
    )
      return;
    const { nodeId } = nodeConfirmation;
    if (
      nodeSubmitting.current ||
      pendingMutations.some(
        (mutation) =>
          mutation.operation === "CREATE_ORDER" &&
          ["submitting", "uncertain"].includes(mutation.state),
      )
    )
      return;
    const robot = visibleSnapshot?.robots.find(
      (robot) => robot.id === selectedRobotId,
    );
    const node = topology?.nodeMap.get(nodeId);
    const map = visibleSnapshot?.map;
    const status = { robotId: selectedRobotId, nodeId };
    const reject = (error: string) =>
      setNodeCommand({ ...status, state: "rejected", error });
    if (!robot || !node || !map) {
      reject("로봇과 맵 정보를 불러온 뒤 다시 선택하세요.");
      return;
    }
    if (
      !isNodeCommandTransportReady(
        transportMode,
        reconState.connectionState,
        wsClientRef.current?.isConnected ?? false,
      )
    ) {
      reject("Core 연결을 확인한 뒤 큐에 등록하세요.");
      return;
    }
    if (!node.isTraversable) {
      reject("장애물 노드로 이동할 수 없습니다.");
      return;
    }
    if (
      map.stationCatalog === undefined &&
      ["pick", "place", "charger"].includes(node.type)
    ) {
      reject(
        "Core의 작업 노드 정보를 확인할 수 없습니다. 맵을 새로고침하세요.",
      );
      return;
    }
    const station = map.stationCatalog?.find(
      (station) => station.column === node.column && station.row === node.row,
    );
    const arrivalAction =
      station?.type === "pick"
        ? ("PICK" as const)
        : station?.type === "place"
          ? ("PLACE" as const)
          : station?.type === "charger"
            ? ("CHARGE" as const)
            : undefined;
    nodeSubmitting.current = true;
    setNodeCommand({ ...status, state: "submitting" });
    try {
      const mutation = await createOrder({
        mapId: map.mapId,
        mapRevision: map.revision,
        assignments: [
          {
            robotId: robot.id,
            goalColumn: node.column,
            goalRow: node.row,
            ...(arrivalAction ? { arrivalAction } : {}),
          },
        ],
      });
      if (mutation.state !== "rejected") setNodeConfirmation(null);
      setNodeCommand({
        ...status,
        state:
          mutation.state === "confirmed"
            ? "confirmed"
            : mutation.state === "uncertain"
              ? "uncertain"
              : "rejected",
        mutation,
      });
    } catch (error) {
      reject(
        error instanceof Error
          ? error.message
          : "이동 명령 제출에 실패했습니다.",
      );
    } finally {
      nodeSubmitting.current = false;
    }
  };
  const retryNodeCommand = async () => {
    if (
      !nodeCommand?.mutation ||
      nodeSubmitting.current ||
      nodeCommand.state !== "uncertain"
    )
      return;
    nodeSubmitting.current = true;
    const command = nodeCommand;
    setNodeCommand({ ...command, state: "submitting" });
    try {
      const mutation = await retryMutation(command.mutation!.requestId);
      setNodeCommand({
        ...command,
        mutation,
        state:
          mutation.state === "confirmed"
            ? "confirmed"
            : mutation.state === "uncertain"
              ? "uncertain"
              : "rejected",
      });
    } catch (error) {
      setNodeCommand({
        ...command,
        state: "uncertain",
        error:
          error instanceof Error ? error.message : "재시도에 실패했습니다.",
      });
    } finally {
      nodeSubmitting.current = false;
    }
  };

  // Entity selections
  const selectedRobot =
    visibleSnapshot?.robots.find((r) => r.id === selectedRobotId) || null;
  const selectedOrder =
    reconState.snapshot?.orders.find((o) => o.id === selectedOrderId) || null;
  const selectedIncident =
    reconState.snapshot?.incidents?.find((i) => i.id === selectedIncidentId) ||
    null;
  const selectedNode =
    selectedNodeId !== null && topology?.nodeMap
      ? topology.nodeMap.get(selectedNodeId) || null
      : null;

  return (
    <OperationsContext.Provider
      value={{
        snapshot: visibleSnapshot,
        loading,
        error,
        lastFetchedAt,
        refreshSnapshot,
        selectedRobotId,
        setSelectedRobotId: selectRobot,
        clickNode,
        nodeConfirmation,
        confirmNodeCommand,
        dismissNodeConfirmation: () => setNodeConfirmation(null),
        nodeCommand,
        retryNodeCommand,
        selectedRobot,
        selectedOrderId,
        setSelectedOrderId,
        selectedOrder,
        selectedIncidentId,
        setSelectedIncidentId,
        selectedIncident,
        selectedNodeId,
        setSelectedNodeId,
        selectedNode,
        topology,
        fleetScale,
        setFleetScale,
        isSimulatingMotion,
        setIsSimulatingMotion,
        useFixture: transportMode === "FIXTURE_STREAM",
        setUseFixture,
        fixtureMode,
        setFixtureMode,
        connectionState: reconState.connectionState,
        transportMode,
        setTransportMode,
        mockScenario,
        setMockScenario,
        diagnostics: reconState.diagnostics,
        resetDiagnostics,

        // Phase 3
        pendingMutations,
        createOrder,
        cancelOrder,
        cancelQueueTask,
        reassignOrder,
        sendInstantAction,
        acknowledgeIncident,
        resolveIncident,
        retryMutation,
        dismissMutation,

        isOrderModalOpen,
        setIsOrderModalOpen,
        actionDialogTarget,
        setActionDialogTarget,
        isIncidentCenterOpen,
        setIsIncidentCenterOpen,
      }}
    >
      {children}
    </OperationsContext.Provider>
  );
};

export function useOperations(): OperationsContextType {
  const context = useContext(OperationsContext);
  if (!context) {
    throw new Error("useOperations must be used within an OperationsProvider");
  }
  return context;
}
