import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptStationState,
  adaptArrivalAction,
} from "../src/contracts/adapters/stationAdapter.ts";
import { adaptRasterMap } from "../src/contracts/adapters/mapAdapter.ts";
import { deriveMapTopology } from "../src/utils/map/topology.ts";
import { CANONICAL_MAP_FIXTURE } from "../src/contracts/fixtures/canonical.ts";

test("station state preserves load, charge and completion identity", () => {
  const state = {
    loaded: true,
    batteryPercent: 85,
    phase: "COMPLETED",
    elapsedMs: 2000,
    action: "PICK",
    orderId: "order-1",
  };
  assert.deepEqual(adaptStationState(state), state);
  assert.equal(adaptStationState(undefined), undefined);
  assert.throws(() => adaptStationState({ ...state, batteryPercent: NaN }));
  assert.throws(() => adaptStationState({ ...state, batteryPercent: 101 }));
  assert.throws(() => adaptStationState({ ...state, action: "TELEPORT" }));
  assert.throws(() => adaptStationState({ ...state, orderId: undefined }));
  assert.throws(() => adaptArrivalAction("PICK_AND_PLACE"));
});

test("Core catalog overrides coordinate-based station guesses", () => {
  const map = adaptRasterMap({
    ...CANONICAL_MAP_FIXTURE,
    stationCatalog: [
      { column: 5, row: 5, type: "charger", name: "Core charger" },
    ],
    stationCatalogDigestSha256: "a".repeat(64),
  });
  const topology = deriveMapTopology(map);
  assert.equal(topology.nodeMap.get(5 * 32 + 5).type, "charger");
  assert.equal(topology.nodeMap.get(3).type, "waypoint");
  assert.throws(() =>
    adaptRasterMap({
      ...map,
      stationCatalog: [{ column: 32, row: 0, type: "pick", name: "Outside" }],
    }),
  );
});
