import { useEffect, useRef } from "react";
import type { Robot } from "../../domain/robot/types.ts";

type TrailPoint = { x: number; y: number };
type RobotTrail = {
  points: TrailPoint[];
  simulationTimeMs: number;
  sessionEpoch?: number;
};

// Keep only recent observed positions; these are not planned routes.
export function useRobotTrails(robots: Robot[], mapKey: string) {
  const trails = useRef(new Map<string, RobotTrail>());
  useEffect(() => {
    trails.current.clear();
  }, [mapKey]);
  useEffect(() => {
    const ids = new Set(robots.map((robot) => robot.id));
    for (const id of trails.current.keys()) {
      if (!ids.has(id)) trails.current.delete(id);
    }
    for (const robot of robots) {
      if (robot.freshness !== "CURRENT") continue;
      const point = { x: robot.pose.xMeters, y: robot.pose.yMeters };
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      let trail = trails.current.get(robot.id);
      if (
        !trail ||
        trail.sessionEpoch !== robot.sessionEpoch ||
        robot.simulationTimeMs < trail.simulationTimeMs
      ) {
        trail = {
          points: [],
          simulationTimeMs: robot.simulationTimeMs,
          sessionEpoch: robot.sessionEpoch,
        };
        trails.current.set(robot.id, trail);
      }
      trail.simulationTimeMs = robot.simulationTimeMs;
      const last = trail.points.at(-1);
      if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= 0.05) {
        trail.points.push(point);
        if (trail.points.length > 200) trail.points.shift();
      }
    }
  }, [robots, mapKey]);
  return trails;
}
