import test from "node:test";
import assert from "node:assert/strict";
import { isNodeCommandTransportReady } from "../src/domain/order/nodeCommand.ts";
test("a connected current robot is not blocked by another simulator's disconnected aggregate", () => {
  assert.equal(
    isNodeCommandTransportReady("LIVE_WEBSOCKET", "Disconnected", true),
    true,
  );
  assert.equal(
    isNodeCommandTransportReady("LIVE_WEBSOCKET", "Disconnected", false),
    false,
  );
});
test("transport loss and unreconciled streams block node confirmation", () => {
  for (const state of [
    "Reconciling",
    "Stale",
    "Partial",
    "Failed",
    "LoadingSnapshot",
    "ConnectingStream",
  ]) {
    assert.equal(
      isNodeCommandTransportReady("LIVE_WEBSOCKET", state, true),
      false,
    );
  }
  assert.equal(
    isNodeCommandTransportReady("LIVE_WEBSOCKET", "Current", false),
    false,
  );
  assert.equal(
    isNodeCommandTransportReady("LIVE_WEBSOCKET", "Current", true),
    true,
  );
});
