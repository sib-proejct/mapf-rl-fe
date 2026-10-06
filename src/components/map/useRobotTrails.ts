import { useEffect, useRef } from "react";
import type { Robot } from "../../domain/robot/types.ts";
import type { Order } from "../../domain/order/types.ts";
import { updateRobotTrails, type RobotTrail } from "./robotTrails.ts";

// Observed positions belong to one active order, not to a planned route.
export function useRobotTrails(
  robots: Robot[],
  orders: Order[],
  mapId?: string,
  mapRevision?: number,
) {
  const trails = useRef(new Map<string, RobotTrail>());
  useEffect(() => {
    trails.current.clear();
  }, [mapId, mapRevision]);
  useEffect(() => {
    updateRobotTrails(trails.current, robots, orders, mapId, mapRevision);
  }, [robots, orders, mapId, mapRevision]);
  return trails;
}
