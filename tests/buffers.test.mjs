import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  adaptBufferCatalog,
  adaptBufferState,
  bufferLabel,
} from "../src/contracts/adapters/bufferAdapter.ts";
import { adaptRasterMap } from "../src/contracts/adapters/mapAdapter.ts";
import { adaptOperationsSnapshot } from "../src/contracts/adapters/snapshotAdapter.ts";
import { CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE } from "../src/contracts/fixtures/canonical.ts";
import {
  NOMINAL_ROBOT_EVENT_1421,
  NOMINAL_ROBOT_EVENT_1422,
} from "../src/contracts/fixtures/reconciliationFixtures.ts";
import {
  INITIAL_RECONCILIATION_STATE,
  reconciliationReducer,
} from "../src/state/reconciliation/reducer.ts";
import { deriveMapTopology } from "../src/utils/map/topology.ts";

const catalog = JSON.parse(
  readFileSync(
    new URL(
      "../src/contracts/fixtures/warehouse-buffers.json",
      import.meta.url,
    ),
  ),
);
const bufferState = {
  contractVersion: "1.0.0",
  robotId: "robot-01",
  entityVersion: 1,
  phase: "EXIT_PENDING",
  buffer: catalog.buffers[0],
  mapId: catalog.mapId,
  mapRevision: 1,
  placeOrderId: "11111111-1111-4111-8111-111111111111",
  orderId: null,
  stationClear: false,
  reason: null,
  movementKind: null,
  bufferOccupied: false,
};

function operation(data, sequence = 1421) {
  return {
    ...NOMINAL_ROBOT_EVENT_1421,
    eventSequence: sequence,
    payload: {
      entityType: "BUFFER_STATE",
      entityId: data.robotId,
      entityVersion: data.entityVersion,
      contentDigestSha256: String(data.entityVersion).repeat(64),
      data,
    },
  };
}

test("buffer contract rejects malformed cells, duplicates and unknown states", () => {
  assert.equal(adaptBufferCatalog(catalog).buffers.length, 12);
  assert.deepEqual(adaptBufferState(bufferState), bufferState);
  assert.throws(
    () =>
      adaptBufferCatalog({
        ...catalog,
        buffers: [catalog.buffers[0], catalog.buffers[0]],
      }),
    /Duplicate/,
  );
  for (const malformed of [
    { phase: "UNKNOWN" },
    { entityVersion: -1 },
    { buffer: { column: NaN, row: 3, name: "bad" } },
    { movementKind: "JUMP" },
    { bufferOccupied: "yes" },
  ])
    assert.throws(() => adaptBufferState({ ...bufferState, ...malformed }));
  assert.match(
    bufferLabel({ ...bufferState, phase: "MOVING", movementKind: "BUFFER" }),
    /버퍼 이동/,
  );
  assert.match(
    bufferLabel({
      ...bufferState,
      phase: "HELD",
      reason: "BUFFER_MOVE_FAILED",
    }),
    /복구 필요/,
  );
});

test("authoritative buffer catalog replaces inferred place-front buffers", () => {
  const raw = JSON.parse(
    readFileSync(
      new URL("../src/contracts/fixtures/warehouse-map.json", import.meta.url),
    ),
  );
  const stations = JSON.parse(
    readFileSync(
      new URL(
        "../src/contracts/fixtures/warehouse-stations.json",
        import.meta.url,
      ),
    ),
  );
  const map = adaptRasterMap({
    ...raw,
    contentDigestSha256: "a".repeat(64),
    stationCatalog: stations.stations,
    stationCatalogDigestSha256: "b".repeat(64),
    bufferCatalog: catalog,
    bufferCatalogDigestSha256: "c".repeat(64),
  });
  const topology = deriveMapTopology(map);
  const nodes = topology.nodes.filter((n) => n.type === "buffer");
  assert.equal(nodes.length, 12);
  assert.deepEqual(
    nodes.map((n) => [n.column, n.row]),
    catalog.buffers.map((n) => [n.column, n.row]),
  );
  assert.throws(
    () =>
      adaptRasterMap({
        ...raw,
        contentDigestSha256: "a".repeat(64),
        bufferCatalog: { ...catalog, mapRevision: 99 },
        bufferCatalogDigestSha256: "c".repeat(64),
      }),
    /binding/,
  );
});

test("snapshot restores independent buffer versions regardless of entity order", () => {
  const raw = structuredClone(CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE);
  raw.entities.unshift(operation(bufferState).payload);
  const snapshot = adaptOperationsSnapshot(raw);
  assert.equal(snapshot.bufferStates["robot-01"].phase, "EXIT_PENDING");
  assert.equal(
    snapshot.robots.find((r) => r.id === "robot-01").bufferState.entityVersion,
    1,
  );
});

test("buffer updates survive robot telemetry and duplicate events", () => {
  let state = reconciliationReducer(INITIAL_RECONCILIATION_STATE, {
    type: "SNAPSHOT_REPLACED",
    snapshot: adaptOperationsSnapshot(CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE),
  });
  const event = operation(bufferState);
  state = reconciliationReducer(state, {
    type: "STREAM_EVENT_RECEIVED",
    event,
  });
  assert.equal(
    state.snapshot.robots.find((r) => r.id === "robot-01").bufferState.phase,
    "EXIT_PENDING",
  );
  state = reconciliationReducer(state, {
    type: "STREAM_EVENT_RECEIVED",
    event,
  });
  assert.equal(state.diagnostics.duplicateCount, 1);
  state = reconciliationReducer(state, {
    type: "STREAM_EVENT_RECEIVED",
    event: NOMINAL_ROBOT_EVENT_1422,
  });
  assert.equal(
    state.snapshot.robots.find((r) => r.id === "robot-01").bufferState
      .entityVersion,
    1,
  );
  state = reconciliationReducer(state, {
    type: "STREAM_EVENT_RECEIVED",
    event: operation(
      {
        ...bufferState,
        entityVersion: 2,
        phase: "WAITING",
        stationClear: true,
        bufferOccupied: true,
      },
      1423,
    ),
  });
  assert.equal(
    state.snapshot.robots.find((r) => r.id === "robot-01").bufferState.phase,
    "WAITING",
  );
});
