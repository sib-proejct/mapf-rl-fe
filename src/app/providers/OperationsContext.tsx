import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import type { AuthoritativeSnapshot } from "../../domain/snapshot/types.ts";
import type { Robot } from "../../domain/robot/types.ts";
import type { Order } from "../../domain/order/types.ts";
import type { MapNode, MapTopology } from "../../domain/map/types.ts";
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
  advanceStressMotion,
  resetRobotMotionCache,
} from "../../contracts/fixtures/stressFleet.ts";
import { MEGA_WAREHOUSE_MAP_FIXTURE } from "../../contracts/fixtures/largeWarehouseMap.ts";

export type FixtureMode =
  | "current"
  | "stale"
  | "partial"
  | "disconnected"
  | "error";

export type FleetScale = 3 | 100;

export interface OperationsContextType {
  snapshot: AuthoritativeSnapshot | null;
  loading: boolean;
  error: NormalizedProblem | null;
  useFixture: boolean;
  setUseFixture: (use: boolean) => void;
  fixtureMode: FixtureMode;
  setFixtureMode: (mode: FixtureMode) => void;
  fleetScale: FleetScale;
  setFleetScale: (scale: FleetScale) => void;
  isSimulatingMotion: boolean;
  setIsSimulatingMotion: (simulating: boolean) => void;
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
  refreshSnapshot: () => Promise<void>;
  lastFetchedAt: Date | null;
}

const OperationsContext = createContext<OperationsContextType | undefined>(
  undefined,
);

export const OperationsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [snapshot, setSnapshot] = useState<AuthoritativeSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<NormalizedProblem | null>(null);
  const [useFixture, setUseFixture] = useState<boolean>(true);
  const [fixtureMode, setFixtureMode] = useState<FixtureMode>("current");
  const [fleetScale, setFleetScale] = useState<FleetScale>(3);
  const [isSimulatingMotion, setIsSimulatingMotion] = useState<boolean>(false);
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(
    "robot-01",
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  const tickCounterRef = useRef<number>(0);

  const loadFixture = useCallback((mode: FixtureMode, scale: FleetScale) => {
    setLoading(true);
    setError(null);
    resetRobotMotionCache();

    try {
      if (mode === "error") {
        const prob = normalizeProblem(CANONICAL_PROBLEM_FIXTURE);
        setError(prob);
        setSnapshot(null);
      } else if (mode === "stale") {
        const adapted = adaptOperationsSnapshot(
          CANONICAL_STALE_SNAPSHOT_FIXTURE,
        );
        setSnapshot(adapted);
      } else if (mode === "partial") {
        const adapted = adaptOperationsSnapshot(
          CANONICAL_PARTIAL_SNAPSHOT_FIXTURE,
        );
        setSnapshot(adapted);
      } else if (mode === "disconnected") {
        const adapted = adaptOperationsSnapshot(
          CANONICAL_DISCONNECTED_SNAPSHOT_FIXTURE,
        );
        setSnapshot(adapted);
      } else {
        if (scale > 3) {
          const stressSnapshot = generateStressSnapshot(
            scale,
            MEGA_WAREHOUSE_MAP_FIXTURE,
          );
          setSnapshot(stressSnapshot);
          setSelectedRobotId((prev) =>
            prev && prev.startsWith("robot-") ? prev : "robot-001",
          );
        } else {
          const baseAdapted = adaptOperationsSnapshot(
            CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
          );
          setSnapshot(baseAdapted);
          setSelectedRobotId((prev) =>
            prev && prev.startsWith("robot-") && !prev.startsWith("robot-00")
              ? prev
              : "robot-01",
          );
        }
      }
      setLastFetchedAt(new Date());
    } catch (err: unknown) {
      setError(normalizeProblem(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLiveSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rawPayload = await defaultApiClient.fetchOperationsSnapshot();
      const adapted = adaptOperationsSnapshot(rawPayload);
      setSnapshot(adapted);
      setLastFetchedAt(new Date());
    } catch (err: unknown) {
      setSnapshot(null);
      if (err instanceof ProblemError) {
        setError(err.problem);
      } else {
        setError(normalizeProblem(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSnapshot = useCallback(async () => {
    if (useFixture) {
      loadFixture(fixtureMode, fleetScale);
    } else {
      await loadLiveSnapshot();
    }
  }, [useFixture, fixtureMode, fleetScale, loadFixture, loadLiveSnapshot]);

  useEffect(() => {
    if (useFixture) {
      loadFixture(fixtureMode, fleetScale);
    } else {
      loadLiveSnapshot();
    }
  }, [useFixture, fixtureMode, fleetScale, loadFixture, loadLiveSnapshot]);

  // Derive topology graph from map
  const topology = useMemo(() => {
    if (!snapshot?.map) return null;
    return deriveMapTopology(snapshot.map);
  }, [snapshot?.map]);

  // Live motion animation tick for stress testing
  useEffect(() => {
    if (!isSimulatingMotion || !snapshot) return;

    const interval = setInterval(() => {
      tickCounterRef.current += 1;
      setSnapshot((prev) => {
        if (!prev) return prev;
        return advanceStressMotion(prev, tickCounterRef.current, topology);
      });
    }, 50); // 20 updates/sec

    return () => clearInterval(interval);
  }, [isSimulatingMotion, snapshot !== null, topology]);

  // Derive selected entity objects
  const selectedRobot =
    snapshot?.robots.find((r) => r.id === selectedRobotId) || null;
  const selectedOrder =
    snapshot?.orders.find((o) => o.id === selectedOrderId) || null;
  const selectedNode =
    selectedNodeId !== null && topology?.nodeMap
      ? topology.nodeMap.get(selectedNodeId) || null
      : null;

  return (
    <OperationsContext.Provider
      value={{
        snapshot,
        loading,
        error,
        useFixture,
        setUseFixture,
        fixtureMode,
        setFixtureMode,
        fleetScale,
        setFleetScale,
        isSimulatingMotion,
        setIsSimulatingMotion,
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
        refreshSnapshot,
        lastFetchedAt,
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
