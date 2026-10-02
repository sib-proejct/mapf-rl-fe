import assert from "node:assert/strict";
import test from "node:test";

import { adaptOperationsSnapshot } from "../src/contracts/adapters/snapshotAdapter.ts";
import {
  reconciliationReducer,
  INITIAL_RECONCILIATION_STATE,
} from "../src/state/reconciliation/reducer.ts";
import { CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE } from "../src/contracts/fixtures/canonical.ts";

test("Snapshot Adapter: parses incident entities and populates snapshot.incidents", () => {
  const snapshotWithIncidents = {
    ...CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
    entities: [
      ...CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE.entities,
      {
        entityType: "INCIDENT",
        entityId: "inc-deadlock-01",
        entityVersion: 1,
        contentDigestSha256:
          "9999999999999999999999999999999999999999999999999999999999999999",
        data: {
          category: "deadlock",
          severity: "CRITICAL",
          status: "ACTIVE",
          reasonCode: "DEADLOCK_HEAD_ON",
          description: "Head-on collision trajectory detected at cell (14, 8)",
          simulationTimeMs: 142000,
          occurredAtUtc: "2026-08-23T10:00:00Z",
          relatedEntity: {
            type: "ROBOT",
            id: "robot-01",
          },
        },
      },
    ],
  };

  const adapted = adaptOperationsSnapshot(snapshotWithIncidents);
  assert.ok(adapted.incidents);
  assert.equal(adapted.incidents.length, 1);
  assert.equal(adapted.incidents[0].id, "inc-deadlock-01");
  assert.equal(adapted.incidents[0].category, "deadlock");
  assert.equal(adapted.incidents[0].severity, "CRITICAL");
  assert.equal(adapted.incidents[0].status, "ACTIVE");
});

test("Incident Workflow: Acknowledging and Resolving incidents update state and safety latches", () => {
  const baseSnapshot = adaptOperationsSnapshot({
    ...CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
    entities: [
      ...CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE.entities,
      {
        entityType: "INCIDENT",
        entityId: "inc-estop-01",
        entityVersion: 1,
        contentDigestSha256:
          "8888888888888888888888888888888888888888888888888888888888888888",
        data: {
          category: "safety",
          severity: "CRITICAL",
          status: "ACTIVE",
          reasonCode: "EMERGENCY_STOP_TRIGGERED",
          description: "Manual Emergency Stop triggered for robot-01",
          simulationTimeMs: 142000,
          occurredAtUtc: "2026-08-23T10:00:00Z",
          relatedEntity: {
            type: "ROBOT",
            id: "robot-01",
          },
        },
      },
    ],
  });

  const state1 = reconciliationReducer(INITIAL_RECONCILIATION_STATE, {
    type: "SNAPSHOT_REPLACED",
    snapshot: baseSnapshot,
  });

  assert.equal(state1.snapshot?.incidents.length, 1);
  assert.equal(state1.snapshot?.incidents[0].status, "ACTIVE");

  // Step 1: Operator Acknowledges Incident
  const state2 = reconciliationReducer(state1, {
    type: "INCIDENT_ACKNOWLEDGED",
    incidentId: "inc-estop-01",
    acknowledgedBy: "Operator-01",
    occurredAtUtc: "2026-08-23T10:01:00Z",
  });

  const acked = state2.snapshot?.incidents.find((i) => i.id === "inc-estop-01");
  assert.ok(acked);
  assert.equal(acked.status, "ACKNOWLEDGED");
  assert.equal(acked.acknowledgedBy, "Operator-01");

  // Step 2: Operator Resolves Incident
  const state3 = reconciliationReducer(state2, {
    type: "INCIDENT_RESOLVED",
    incidentId: "inc-estop-01",
    occurredAtUtc: "2026-08-23T10:02:00Z",
  });

  const resolved = state3.snapshot?.incidents.find(
    (i) => i.id === "inc-estop-01",
  );
  assert.ok(resolved);
  assert.equal(resolved.status, "RESOLVED");

  // Safety latch on robot-01 restored to NORMAL
  const robot01 = state3.snapshot?.robots.find((r) => r.id === "robot-01");
  assert.ok(robot01);
  assert.equal(robot01.safety, "NORMAL");
});
