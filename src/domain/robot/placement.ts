import type { RasterMap, MapNode } from "../map/types.ts";
import type { Robot } from "./types.ts";

export function placementCandidates(
  map: RasterMap,
  nodes: readonly MapNode[],
  robots: readonly Robot[],
): MapNode[] {
  const occupied = new Set(
    robots.map(
      ({ pose }) =>
        `${Math.floor((pose.xMeters - map.origin.xMeters) / map.resolutionMeters)},${Math.floor((pose.yMeters - map.origin.yMeters) / map.resolutionMeters)}`,
    ),
  );
  return nodes
    .filter(
      (node) =>
        node.isTraversable &&
        map.cells[node.row * map.widthCells + node.column] === 0 &&
        !occupied.has(`${node.column},${node.row}`),
    )
    .sort((a, b) => a.row - b.row || a.column - b.column);
}

export function generateRobotPlacement(
  count: number,
  candidates: readonly MapNode[],
): number[] {
  if (!Number.isInteger(count) || count < 1 || count > 100)
    throw new Error("COUNT");
  if (candidates.length < count) throw new Error("CAPACITY");
  return candidates.slice(0, count).map((node) => node.id);
}
