import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDistanceMeters,
  formatVelocityMps,
  formatAngleRadians,
} from "../src/utils/units/units.ts";

import {
  formatUtcIso,
  formatSimulationTime,
  formatStateAge,
} from "../src/utils/time/time.ts";

import { formatShortId } from "../src/utils/ids/ids.ts";

test("SI unit formatters output expected strings", () => {
  assert.equal(formatDistanceMeters(1.234), "1.23 m");
  assert.equal(formatVelocityMps(0.567), "0.57 m/s");
  assert.equal(formatAngleRadians(Math.PI / 2), "1.57 rad (90.0°)");
});

test("time formatters output simulation time and state age", () => {
  assert.equal(formatSimulationTime(1200), "T+1.200s");
  assert.equal(formatSimulationTime(65432), "T+01:05.432");
  assert.equal(formatSimulationTime(3665432), "T+01:01:05.432");

  const now = 1000000;
  assert.equal(formatStateAge(now - 120, now), "120ms");
  assert.equal(formatStateAge(now - 3500, now), "3.5s");
  assert.equal(formatStateAge(now - 65000, now), "1m 5s");

  assert.equal(
    formatUtcIso("2026-08-22T01:00:00.100Z"),
    "2026-08-22T01:00:00.100Z",
  );
});

test("formatShortId truncates long IDs gracefully", () => {
  assert.equal(formatShortId("robot-01"), "robot-01");
  assert.equal(
    formatShortId("00000000-0000-4000-8000-000000000001", 8, 4),
    "00000000...0001",
  );
});
