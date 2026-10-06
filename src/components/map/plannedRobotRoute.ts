import type { PlannedRobotRoute } from "../../contracts/planned-route.generated.ts";
import type { RasterMap } from "../../domain/map/types.ts";
import {
  cellToWorld,
  type Point2D,
} from "../../utils/coordinates/coordinates.ts";

export interface RouteProgress {
  segment: number;
  fraction: number;
}

/** Spatial progress only: planner time estimates cannot skip waiting robots. */
export function remainingRobotRoute(
  route: PlannedRobotRoute,
  pose: Point2D,
  map: RasterMap,
  previous?: RouteProgress,
) {
  if (!Number.isFinite(pose.x) || !Number.isFinite(pose.y)) return undefined;
  if (
    route.waypoints.some(
      (p) => p.column >= map.widthCells || p.row >= map.heightCells,
    )
  )
    return undefined;
  const points: Point2D[] = [];
  for (const waypoint of route.waypoints) {
    const point = cellToWorld(waypoint, map.resolutionMeters, map.origin);
    const last = points.at(-1);
    if (!last || point.x !== last.x || point.y !== last.y) points.push(point);
  }
  if (!points.length) return undefined;
  if (points.length === 1) {
    const distance = Math.hypot(pose.x - points[0].x, pose.y - points[0].y);
    if (distance > map.resolutionMeters * 0.75) return undefined;
    return {
      points: distance < 1e-6 ? [pose] : [pose, points[0]],
      progress: { segment: 0, fraction: 1 },
    };
  }
  let best: { distance: number; segment: number; fraction: number } | undefined;
  for (let i = previous?.segment ?? 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const fraction = Math.max(
      i === previous?.segment ? previous.fraction : 0,
      Math.min(
        1,
        Math.max(
          0,
          ((pose.x - a.x) * dx + (pose.y - a.y) * dy) / (dx * dx + dy * dy),
        ),
      ),
    );
    const distance = Math.hypot(
      pose.x - a.x - fraction * dx,
      pose.y - a.y - fraction * dy,
    );
    // Earliest equal-distance occurrence keeps crossings and loops from skipping ahead.
    if (!best || distance < best.distance - 1e-6)
      best = { distance, segment: i, fraction };
  }
  if (!best || best.distance > map.resolutionMeters * 0.75) return undefined;
  const progress = { segment: best.segment, fraction: best.fraction };
  const remaining = points.slice(best.segment + 1);
  if (best.fraction >= 1 - 1e-6 && best.distance < 1e-6) remaining.shift();
  return { points: [pose, ...remaining], progress };
}
