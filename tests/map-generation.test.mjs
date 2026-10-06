import assert from "node:assert/strict";
import test from "node:test";
import {
  mapGenerationHeaders,
  mapGenerationUrl,
  setMapGeneration,
} from "../src/services/maps/mapGeneration.ts";
import { globalMutationManager } from "../src/state/mutations/mutationManager.ts";

test("activation generation fences HTTP and both websocket streams", () => {
  setMapGeneration(7);
  assert.deepEqual(mapGenerationHeaders(), { "X-Map-Generation": "7" });
  assert.equal(
    mapGenerationUrl("ws://127.0.0.1:5173/ws/v1?resumeAfter=2"),
    "ws://127.0.0.1:5173/ws/v1?resumeAfter=2&mapGeneration=7",
  );
  assert.equal(
    mapGenerationUrl("ws://127.0.0.1:5173/ws/v1/telemetry"),
    "ws://127.0.0.1:5173/ws/v1/telemetry?mapGeneration=7",
  );
  setMapGeneration(8);
  assert.equal(mapGenerationHeaders()["X-Map-Generation"], "8");
  setMapGeneration(null);
  assert.deepEqual(mapGenerationHeaders(), {});
  assert.equal(
    mapGenerationUrl("ws://127.0.0.1/ws/v1"),
    "ws://127.0.0.1/ws/v1",
  );
});

test("transport generation changes expire global mutation retries", () => {
  try {
    setMapGeneration(1);
    const mutation = globalMutationManager.startMutation("CREATE_ORDER", {
      mapId: "standard",
    });
    globalMutationManager.markUncertain(mutation.requestId);
    setMapGeneration(2);
    assert.equal(globalMutationManager.get(mutation.requestId), undefined);
    assert.deepEqual(mapGenerationHeaders(), { "X-Map-Generation": "2" });
  } finally {
    setMapGeneration(null);
  }
});
