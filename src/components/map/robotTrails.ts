import type { Order } from "../../domain/order/types.ts";
import type { Robot } from "../../domain/robot/types.ts";
import { findRobotOrder } from "./mapRobotDisplay.ts";

export type RobotTrail = {
  points: { x: number; y: number }[];
  orderId: string;
  simulationTimeMs: number;
  sessionEpoch?: number;
  simulatorBootId?: string;
};

export function updateRobotTrails(
  trails: Map<string, RobotTrail>,
  robots: Robot[],
  orders: Order[],
  mapId?: string,
  mapRevision?: number,
) {
  const ids = new Set(robots.map((robot) => robot.id));
  for (const id of trails.keys()) {
    if (!ids.has(id)) trails.delete(id);
  }
  for (const robot of robots) {
    const order = findRobotOrder(robot, orders, mapId, mapRevision);
    if (!order) {
      trails.delete(robot.id);
      continue;
    }
    let trail = trails.get(robot.id);
    if (trail && trail.orderId !== order.id) {
      trails.delete(robot.id);
      trail = undefined;
    }
    if (robot.freshness !== "CURRENT") continue;
    const point = { x: robot.pose.xMeters, y: robot.pose.yMeters };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    if (
      !trail ||
      trail.sessionEpoch !== robot.sessionEpoch ||
      trail.simulatorBootId !== robot.simulatorBootId ||
      robot.simulationTimeMs < trail.simulationTimeMs
    ) {
      trail = {
        points: [],
        orderId: order.id,
        simulationTimeMs: robot.simulationTimeMs,
        sessionEpoch: robot.sessionEpoch,
        simulatorBootId: robot.simulatorBootId,
      };
      trails.set(robot.id, trail);
    }
    trail.simulationTimeMs = robot.simulationTimeMs;
    const last = trail.points.at(-1);
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= 0.05) {
      trail.points.push(point);
      if (trail.points.length > 200) trail.points.shift();
    }
  }
}
