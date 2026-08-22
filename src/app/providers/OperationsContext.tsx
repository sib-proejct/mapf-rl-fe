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
import type { MapNode, MapTopology } from "../../domain/map/types.ts";
import type {
  ConnectionState,
  StreamTransportMode,
  ReconciliationDiagnostics,
  StreamEnvelope,
} from "../../domain/event/types.ts";
import { deriveMapTopology } from "../../utils/map/topology.ts";
import {
  NormalizedProblem,
  normalizeProblem,
} from "../../contracts/adapters/problem.ts";
import { adaptOperationsSnapshot } from "../../contracts/adapters/snapshotAdapter.ts";
import { defaultApiClient, ProblemError } from "../../services/api/client.ts";
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

export type FixtureMode =
  | "current"
  | "stale"
  | "partial"
  | "disconnected"
  | "error";

export type FleetScale = 3 | 100;

export interface OperationsContextType {
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
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  // Fleet settings
  const [fleetScale, setFleetScale] = useState<FleetScale>(3);
  const [isSimulatingMotion, setIsSimulatingMotion] = useState<boolean>(true);

  // Transports & simulation modes
  const [transportMode, setTransportModeState] =
    useState<StreamTransportMode>("FIXTURE_STREAM");
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
          if (fleetScale > 3) {
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

      // Atomically replace snapshot in state and replay buffered events
      const buffered = boundedBufferRef.current.getEventsAfter(
        snapshotData.cursor.eventSequence,
      );
      boundedBufferRef.current.trimBefore(snapshotData.cursor.eventSequence);

      dispatch({
        type: "SNAPSHOT_REPLACED",
        snapshot: snapshotData,
        bufferedEvents: buffered,
      });

      setLastFetchedAt(new Date());
    } catch (err: unknown) {
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
  }, [transportMode, handleInboundEvent]);

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
        setLastFetchedAt(new Date());
      },
      onError: (err) => {
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

  // Set transport mode wrapper
  const setTransportMode = useCallback((mode: StreamTransportMode) => {
    setTransportModeState(mode);
    dispatch({ type: "TRANSPORT_MODE_CHANGED", transportMode: mode });
  }, []);

  const setMockScenario = useCallback((scen: MockScenario) => {
    setMockScenarioState(scen);
    mockEngineRef.current.setScenario(scen);
  }, []);

  const setFixtureMode = useCallback((mode: FixtureMode) => {
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

  // Entity selections
  const selectedRobot =
    reconState.snapshot?.robots.find((r) => r.id === selectedRobotId) || null;
  const selectedOrder =
    reconState.snapshot?.orders.find((o) => o.id === selectedOrderId) || null;
  const selectedNode =
    selectedNodeId !== null && topology?.nodeMap
      ? topology.nodeMap.get(selectedNodeId) || null
      : null;

  return (
    <OperationsContext.Provider
      value={{
        snapshot: reconState.snapshot,
        loading,
        error,
        lastFetchedAt,
        refreshSnapshot,
        selectedRobotId,
        setSelectedRobotId,
        selectedRobot,
        selectedOrderId,
        setSelectedOrderId,
        selectedOrder,
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
