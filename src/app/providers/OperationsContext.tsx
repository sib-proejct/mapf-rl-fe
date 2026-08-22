import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { AuthoritativeSnapshot } from "../../domain/snapshot/types.ts";
import type { Robot } from "../../domain/robot/types.ts";
import type { Order } from "../../domain/order/types.ts";
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

export type FixtureMode =
  | "current"
  | "stale"
  | "partial"
  | "disconnected"
  | "error";

export interface OperationsContextType {
  snapshot: AuthoritativeSnapshot | null;
  loading: boolean;
  error: NormalizedProblem | null;
  useFixture: boolean;
  setUseFixture: (use: boolean) => void;
  fixtureMode: FixtureMode;
  setFixtureMode: (mode: FixtureMode) => void;
  selectedRobotId: string | null;
  setSelectedRobotId: (id: string | null) => void;
  selectedRobot: Robot | null;
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;
  selectedOrder: Order | null;
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
  const [useFixture, setUseFixture] = useState<boolean>(true); // Default to fixture mode for Phase 1 read-only verification
  const [fixtureMode, setFixtureMode] = useState<FixtureMode>("current");
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(
    "robot-01",
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  const loadFixture = useCallback((mode: FixtureMode) => {
    setLoading(true);
    setError(null);

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
        const adapted = adaptOperationsSnapshot(
          CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
        );
        setSnapshot(adapted);
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
      loadFixture(fixtureMode);
    } else {
      await loadLiveSnapshot();
    }
  }, [useFixture, fixtureMode, loadFixture, loadLiveSnapshot]);

  useEffect(() => {
    if (useFixture) {
      loadFixture(fixtureMode);
    } else {
      loadLiveSnapshot();
    }
  }, [useFixture, fixtureMode, loadFixture, loadLiveSnapshot]);

  // Derive selected entity objects
  const selectedRobot =
    snapshot?.robots.find((r) => r.id === selectedRobotId) || null;
  const selectedOrder =
    snapshot?.orders.find((o) => o.id === selectedOrderId) || null;

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
        selectedRobotId,
        setSelectedRobotId,
        selectedRobot,
        selectedOrderId,
        setSelectedOrderId,
        selectedOrder,
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
