/**
 * Canonical test fixtures for Phase 1 MAPF-RL operator frontend.
 * Conforms strictly to Core OpenAPI 3.1 & JSON Schema 2020-12 specifications.
 *
 * Scaled to a realistic 32x20 Automated Fulfillment Center layout (640 cells, 1.0m/cell).
 */

const WIDTH_CELLS = 32;
const HEIGHT_CELLS = 20;

// Generate 32x20 warehouse cells with structural pillars and storage racks (treated as pillars)
const generateWarehouseCells = (): number[] => {
  const cells: number[] = [];
  for (let r = 0; r < HEIGHT_CELLS; r++) {
    for (let c = 0; c < WIDTH_CELLS; c++) {
      // Specified 6 structural pillars: B-19(7,15), E-19(19,15), B-11(7,11), E-11(19,11), B-01(7,4), E-01(19,4)
      const isPillar =
        (c === 7 || c === 19) && (r === 4 || r === 11 || r === 15);

      // Storage Rack Pods (Bays A ~ F, excluding overwritten pillar cells & row 9-10 central crossway)
      const isRack =
        !isPillar &&
        r >= 4 &&
        r <= HEIGHT_CELLS - 5 &&
        r !== 9 &&
        r !== 10 &&
        (c === 2 ||
          c === 3 ||
          c === 7 ||
          c === 8 ||
          c === 11 ||
          c === 12 ||
          c === 15 ||
          c === 16 ||
          c === 19 ||
          c === 20 ||
          c === 23 ||
          c === 24);

      cells.push(isPillar || isRack ? 1 : 0);
    }
  }
  return cells;
};

export const CANONICAL_MAP_FIXTURE = {
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
  resolutionMeters: 1.0,
  widthCells: WIDTH_CELLS,
  heightCells: HEIGHT_CELLS,
  cells: generateWarehouseCells(),
};

export const CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE = {
  contractVersion: "1.0.0",
  snapshotAt: "2026-08-22T04:30:00.000Z",
  cursor: {
    streamId: "operations:fleet-01",
    eventSequence: 1420,
  },
  freshness: "CURRENT",
  entities: [
    {
      entityType: "MAP",
      entityId: "00000000-0000-4000-8000-000000000001",
      entityVersion: 0,
      contentDigestSha256:
        "1111111111111111111111111111111111111111111111111111111111111111",
      data: CANONICAL_MAP_FIXTURE,
    },
    {
      entityType: "ROBOT",
      entityId: "robot-01",
      entityVersion: 42,
      contentDigestSha256:
        "2222222222222222222222222222222222222222222222222222222222222222",
      data: {
        simulationTimeMs: 12400,
        occurredAt: "2026-08-22T04:29:59.950Z",
        pose: { xMeters: 4.5, yMeters: 2.5, yawRadians: 0.0 },
        operationalState: "EXECUTING",
        connectivity: "CONNECTED",
        freshness: "CURRENT",
        safety: "NORMAL",
        activeController: {
          mode: "BASELINE",
          identity: "cardinal-baseline/1.0.0",
          contentDigestSha256:
            "4444444444444444444444444444444444444444444444444444444444444444",
        },
        orderId: "order-01",
        orderUpdateId: 0,
        sessionEpoch: 4,
        simulatorId: "sim-01",
        batteryPercent: 94,
      },
    },
    {
      entityType: "ROBOT",
      entityId: "robot-02",
      entityVersion: 39,
      contentDigestSha256:
        "3333333333333333333333333333333333333333333333333333333333333333",
      data: {
        simulationTimeMs: 12400,
        occurredAt: "2026-08-22T04:29:59.900Z",
        pose: { xMeters: 14.5, yMeters: 8.5, yawRadians: 1.5707963 }, // facing North
        operationalState: "EXECUTING",
        connectivity: "CONNECTED",
        freshness: "CURRENT",
        safety: "NORMAL",
        activeController: {
          mode: "POLICY",
          identity: "rl-cardinal-ppo/0.4.2",
          contentDigestSha256:
            "5555555555555555555555555555555555555555555555555555555555555555",
        },
        orderId: "order-02",
        orderUpdateId: 0,
        sessionEpoch: 4,
        simulatorId: "sim-01",
        batteryPercent: 88,
      },
    },
    {
      entityType: "ROBOT",
      entityId: "robot-03",
      entityVersion: 15,
      contentDigestSha256:
        "6666666666666666666666666666666666666666666666666666666666666666",
      data: {
        simulationTimeMs: 12400,
        occurredAt: "2026-08-22T04:29:59.850Z",
        pose: { xMeters: 31.5, yMeters: 8.5, yawRadians: 0.0 }, // facing East (at Charger-03 on East wall)
        operationalState: "IDLE",
        connectivity: "CONNECTED",
        freshness: "CURRENT",
        safety: "NORMAL",
        activeController: {
          mode: "BASELINE",
          identity: "cardinal-baseline/1.0.0",
        },
        sessionEpoch: 4,
        simulatorId: "sim-01",
        batteryPercent: 99,
      },
    },
    {
      entityType: "ROBOT",
      entityId: "robot-04",
      entityVersion: 18,
      contentDigestSha256:
        "7777777777777777777777777777777777777777777777777777777777777777",
      data: {
        simulationTimeMs: 12400,
        occurredAt: "2026-08-22T04:29:59.800Z",
        pose: { xMeters: 31.5, yMeters: 4.5, yawRadians: 0.0 }, // facing East (at Charger-01 on East wall)
        operationalState: "CHARGING",
        connectivity: "CONNECTED",
        freshness: "CURRENT",
        safety: "NORMAL",
        activeController: {
          mode: "BASELINE",
          identity: "cardinal-baseline/1.0.0",
        },
        sessionEpoch: 4,
        simulatorId: "sim-01",
        batteryPercent: 42,
      },
    },
    {
      entityType: "ORDER",
      entityId: "order-01",
      entityVersion: 1,
      contentDigestSha256:
        "7777777777777777777777777777777777777777777777777777777777777777",
      data: {
        state: "Executing",
        orderUpdateId: 0,
        planRevisionId: "10000000-0000-4000-8000-000000000004",
        assignments: [{ robotId: "robot-01", goalColumn: 18, goalRow: 19 }],
        mapId: "00000000-0000-4000-8000-000000000001",
        mapRevision: 0,
        submittedAt: "2026-08-22T04:28:00.000Z",
        updatedAt: "2026-08-22T04:28:02.000Z",
      },
    },
    {
      entityType: "ORDER",
      entityId: "order-02",
      entityVersion: 1,
      contentDigestSha256:
        "8888888888888888888888888888888888888888888888888888888888888888",
      data: {
        state: "Executing",
        orderUpdateId: 0,
        planRevisionId: "20000000-0000-4000-8000-000000000004",
        assignments: [{ robotId: "robot-02", goalColumn: 28, goalRow: 19 }],
        mapId: "00000000-0000-4000-8000-000000000001",
        mapRevision: 0,
        submittedAt: "2026-08-22T04:28:30.000Z",
        updatedAt: "2026-08-22T04:28:31.000Z",
      },
    },
  ],
};

export const CANONICAL_STALE_SNAPSHOT_FIXTURE = {
  ...CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
  freshness: "STALE",
  snapshotAt: "2026-08-22T04:15:00.000Z",
};

export const CANONICAL_PARTIAL_SNAPSHOT_FIXTURE = {
  ...CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
  freshness: "PARTIAL",
  cursor: {
    streamId: "operations:fleet-01",
    eventSequence: 1410,
  },
};

export const CANONICAL_DISCONNECTED_SNAPSHOT_FIXTURE = {
  ...CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
  freshness: "DISCONNECTED",
  entities: [
    ...CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE.entities.map((e) => {
      if (e.entityType === "ROBOT" && e.entityId === "robot-03") {
        return {
          ...e,
          data: {
            ...e.data,
            connectivity: "DISCONNECTED",
            freshness: "STALE",
            safety: "CONTROLLED_STOP",
          },
        };
      }
      return e;
    }),
  ],
};

export const CANONICAL_PROBLEM_FIXTURE = {
  type: "urn:mapf-rl:problem:durable-storage-unavailable",
  title: "Durable storage unavailable",
  status: 503,
  code: "DURABLE_STORAGE_UNAVAILABLE",
  traceId: "0123456789abcdef0123456789abcdef",
  requestId: "60000000-0000-4000-8000-000000000001",
  retryable: true,
  detail: "Order mutations are disabled until durable storage is configured",
};
