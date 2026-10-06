import assert from "node:assert/strict";
import test from "node:test";
import { adaptPlannedRoute } from "../src/contracts/adapters/plannedRouteAdapter.ts";
import { remainingRobotRoute } from "../src/components/map/plannedRobotRoute.ts";
import { adaptOperationsSnapshot } from "../src/contracts/adapters/snapshotAdapter.ts";
import { applySingleEvent } from "../src/state/reconciliation/reducer.ts";
import { CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE } from "../src/contracts/fixtures/canonical.ts";

const id = "10000000-0000-4000-8000-000000000005";
const revision = "10000000-0000-4000-8000-000000000004";
const waypoint = (column, row, t = 0) => ({
  column,
  row,
  startSimulationTimeMs: t,
  endSimulationTimeMs: t + 100,
});
const route = {
  robotId: "robot-01",
  orderId: id,
  orderUpdateId: 1,
  waypoints: [waypoint(0, 0), waypoint(1, 0, 100), waypoint(2, 0, 200)],
};
const projection = {
  contractVersion: "1.0.0",
  planRevisionId: revision,
  routes: [route],
};
const map = {
  widthCells: 10,
  heightCells: 10,
  resolutionMeters: 1,
  origin: { xMeters: 0, yMeters: 0 },
};

test("optional projection validates identity, version, coordinates and timing", () => {
  assert.deepEqual(adaptPlannedRoute(projection, id, 1), projection);
  for (const value of [
    undefined,
    {},
    { ...projection, contractVersion: "2.0.0" },
    { ...projection, routes: [route, route] },
    { ...projection, routes: [{ ...route, orderUpdateId: 0 }] },
    { ...projection, routes: [{ ...route, waypoints: [waypoint(NaN, 0)] }] },
    {
      ...projection,
      routes: [
        { ...route, waypoints: [waypoint(0, 0, 200), waypoint(1, 0, 0)] },
      ],
    },
  ]) {
    assert.equal(adaptPlannedRoute(value, id, 1), undefined);
  }
  assert.equal(adaptPlannedRoute(projection, "different-order", 1), undefined);
});

test("remaining path uses actual position, including waits beyond estimated times", () => {
  const result = remainingRobotRoute(route, { x: 1.5, y: 0.5 }, map);
  assert.deepEqual(result.points, [
    { x: 1.5, y: 0.5 },
    { x: 2.5, y: 0.5 },
  ]);
  assert.deepEqual(
    remainingRobotRoute(route, { x: 1.5, y: 0.5 }, map, result.progress),
    result,
  );
  assert.deepEqual(
    remainingRobotRoute(route, { x: 2.5, y: 0.5 }, map, result.progress).points,
    [{ x: 2.5, y: 0.5 }],
  );
});

test("duplicate wait cells and loops keep spatial progression monotonic", () => {
  const loop = {
    ...route,
    waypoints: [
      waypoint(0, 0),
      waypoint(0, 0),
      waypoint(1, 0),
      waypoint(1, 1),
      waypoint(0, 1),
      waypoint(0, 0),
    ],
  };
  const start = remainingRobotRoute(loop, { x: 0.5, y: 0.5 }, map);
  assert.equal(start.progress.segment, 0);
  assert.equal(start.points.length, 5);
  const later = remainingRobotRoute(loop, { x: 0.5, y: 1.5 }, map, {
    segment: 2,
    fraction: 0,
  });
  assert.deepEqual(later.points, [
    { x: 0.5, y: 1.5 },
    { x: 0.5, y: 0.5 },
  ]);
  const finish = remainingRobotRoute(
    loop,
    { x: 0.5, y: 0.5 },
    map,
    later.progress,
  );
  assert.deepEqual(finish.points, [{ x: 0.5, y: 0.5 }]);
});

test("map origin, resolution and unavailable geometry are handled", () => {
  const shifted = {
    ...map,
    resolutionMeters: 0.5,
    origin: { xMeters: 10, yMeters: -5 },
  };
  assert.deepEqual(
    remainingRobotRoute(route, { x: 10.25, y: -4.75 }, shifted).points.at(-1),
    { x: 11.25, y: -4.75 },
  );
  assert.equal(remainingRobotRoute(route, { x: 7, y: 7 }, map), undefined);
  assert.equal(
    remainingRobotRoute(
      { ...route, waypoints: [waypoint(100, 0)] },
      { x: 0.5, y: 0.5 },
      map,
    ),
    undefined,
  );
});

test("snapshot, replay, stale events, replan replacement and clearing", () => {
  const raw = structuredClone(CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE);
  const entity = raw.entities.find((e) => e.entityType === "ORDER");
  const planned = {
    ...projection,
    routes: [
      {
        ...route,
        orderId: entity.entityId,
        orderUpdateId: entity.data.orderUpdateId,
      },
    ],
  };
  entity.data.plannedRoute = planned;
  let snapshot = adaptOperationsSnapshot(raw);
  assert.deepEqual(snapshot.orders[0].plannedRoute, planned);
  const sequence = snapshot.cursor.eventSequence;
  const event = {
    contractVersion: "1.0.0",
    messageId: "m",
    messageType: "operations.event",
    producer: { kind: "CORE", id: "core-planner" },
    occurredAt: raw.snapshotAt,
    correlationId: "c",
    eventSequence: sequence + 1,
    payload: {
      entityType: "ORDER",
      entityId: entity.entityId,
      entityVersion: entity.entityVersion + 1,
      contentDigestSha256: "a".repeat(64),
      data: {
        ...entity.data,
        orderUpdateId: 1,
        plannedRoute: {
          ...projection,
          routes: [{ ...route, orderId: entity.entityId }],
        },
      },
    },
  };
  const updated = applySingleEvent(snapshot, event, sequence);
  assert.equal(updated.decision, "APPLIED");
  assert.equal(
    updated.nextSnapshot.orders[0].plannedRoute.routes[0].orderUpdateId,
    1,
  );
  const stale = applySingleEvent(
    updated.nextSnapshot,
    {
      ...event,
      eventSequence: sequence + 2,
      payload: {
        ...event.payload,
        entityVersion: entity.entityVersion,
        data: entity.data,
      },
    },
    sequence + 1,
  );
  assert.equal(stale.decision, "STALE");
  assert.deepEqual(
    stale.nextSnapshot.orders[0].plannedRoute,
    updated.nextSnapshot.orders[0].plannedRoute,
  );
  const staleUpdate = applySingleEvent(
    updated.nextSnapshot,
    {
      ...event,
      eventSequence: sequence + 2,
      payload: {
        ...event.payload,
        entityVersion: entity.entityVersion + 2,
        data: entity.data,
      },
    },
    sequence + 1,
  );
  assert.equal(staleUpdate.decision, "STALE");
  assert.deepEqual(
    staleUpdate.nextSnapshot.orders[0].plannedRoute,
    updated.nextSnapshot.orders[0].plannedRoute,
  );
  const completed = applySingleEvent(
    updated.nextSnapshot,
    {
      ...event,
      eventSequence: sequence + 2,
      payload: {
        ...event.payload,
        entityVersion: entity.entityVersion + 2,
        data: { state: "Completed", orderUpdateId: 1 },
      },
    },
    sequence + 1,
  );
  assert.equal(completed.nextSnapshot.orders[0].plannedRoute, undefined);
  const legacy = adaptOperationsSnapshot(CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE);
  assert.equal(legacy.orders[0].plannedRoute, undefined);
});
