import assert from "node:assert/strict";
import test from "node:test";

// Test coordinate functions (pure JS implementations matching the TS utilities)
import {
  cellToWorld,
  worldToCell,
  worldToScreen,
  screenToWorld,
  yawToDegrees,
  degreesToYaw,
  yawToScreenRotationDegrees,
  formatCoordinates,
} from "../src/utils/coordinates/coordinates.ts";

test("cellToWorld calculates exact cell center with origin offset", () => {
  const origin = { xMeters: 1.0, yMeters: 2.0 };
  const res = 0.5;

  const center00 = cellToWorld({ column: 0, row: 0 }, res, origin);
  assert.equal(center00.x, 1.25);
  assert.equal(center00.y, 2.25);

  const center21 = cellToWorld({ column: 2, row: 1 }, res, origin);
  assert.equal(center21.x, 2.25);
  assert.equal(center21.y, 2.75);
});

test("worldToCell converts world point to grid cell coordinates", () => {
  const origin = { xMeters: 0.0, yMeters: 0.0 };
  const res = 0.5;

  const cell = worldToCell({ x: 1.25, y: 2.5 }, res, origin);
  assert.equal(cell.column, 2);
  assert.equal(cell.row, 5);
});

test("worldToScreen and screenToWorld perform accurate roundtrip with Y-inversion", () => {
  const mapDim = {
    widthCells: 10,
    heightCells: 10,
    resolutionMeters: 1.0,
    origin: { xMeters: 0, yMeters: 0 },
  };
  const canvasWidth = 500;
  const canvasHeight = 500;

  // World (0, 0) is bottom-left -> Screen (0, 500)
  const screenBottomLeft = worldToScreen(
    { x: 0, y: 0 },
    mapDim,
    canvasWidth,
    canvasHeight,
  );
  assert.equal(screenBottomLeft.x, 0);
  assert.equal(screenBottomLeft.y, 500);

  // World (10, 10) is top-right -> Screen (500, 0)
  const screenTopRight = worldToScreen(
    { x: 10, y: 10 },
    mapDim,
    canvasWidth,
    canvasHeight,
  );
  assert.equal(screenTopRight.x, 500);
  assert.equal(screenTopRight.y, 0);

  // Roundtrip test for arbitrary point
  const worldPoint = { x: 3.5, y: 7.2 };
  const screenPoint = worldToScreen(
    worldPoint,
    mapDim,
    canvasWidth,
    canvasHeight,
  );
  const roundtripWorld = screenToWorld(
    screenPoint,
    mapDim,
    canvasWidth,
    canvasHeight,
  );

  assert.ok(Math.abs(roundtripWorld.x - worldPoint.x) < 1e-6);
  assert.ok(Math.abs(roundtripWorld.y - worldPoint.y) < 1e-6);
});

test("yaw conversions handle radians and degrees correctly", () => {
  assert.equal(yawToDegrees(0), 0);
  assert.ok(Math.abs(yawToDegrees(Math.PI / 2) - 90) < 1e-6);
  assert.ok(Math.abs(yawToDegrees(Math.PI) - 180) < 1e-6);
  assert.ok(Math.abs(yawToDegrees((3 * Math.PI) / 2) - 270) < 1e-6);

  assert.ok(Math.abs(degreesToYaw(90) - Math.PI / 2) < 1e-6);
  assert.ok(Math.abs(yawToScreenRotationDegrees(Math.PI / 2) - -90) < 1e-6);
});

test("formatCoordinates returns formatted string", () => {
  assert.equal(formatCoordinates(1.234, 5.678), "(1.23m, 5.68m)");
});
