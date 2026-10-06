import { useEffect, useMemo, useRef } from "react";
import type { Robot } from "../../domain/robot/types.ts";
import type { Order } from "../../domain/order/types.ts";
import type { RasterMap } from "../../domain/map/types.ts";
import { findRobotOrder } from "./mapRobotDisplay.ts";
import {
  remainingRobotRoute,
  type RouteProgress,
} from "./plannedRobotRoute.ts";

export function usePlannedRobotRoute(
  robots: Robot[],
  orders: Order[],
  map?: RasterMap,
  selectedRobotId?: string | null,
) {
  const progress = useRef(
    new Map<string, { key: string; value: RouteProgress }>(),
  );
  const result = useMemo(() => {
    const next = new Map<string, { key: string; value: RouteProgress }>();
    const routes = new Map<string, ReturnType<typeof remainingRobotRoute>>();
    if (map)
      for (const robot of robots.filter(
        (robot) => robot.id === selectedRobotId,
      )) {
        const order = findRobotOrder(robot, orders, map.mapId, map.revision);
        const planned = order?.plannedRoute;
        const route = planned?.routes.find(
          (r) =>
            r.robotId === robot.id &&
            r.orderId === order?.id &&
            r.orderUpdateId === order?.orderUpdateId,
        );
        if (
          !route ||
          !planned ||
          !order ||
          ["Planning", "Replanning", "Cancelling"].includes(order.state)
        )
          continue;
        const key = [
          map.mapId,
          map.revision,
          order.id,
          order.orderUpdateId,
          planned.planRevisionId,
          robot.sessionEpoch,
          robot.simulatorBootId,
        ].join(":");
        const old = progress.current.get(robot.id);
        const previous = old?.key === key ? old.value : undefined;
        const remaining = remainingRobotRoute(
          route,
          { x: robot.pose.xMeters, y: robot.pose.yMeters },
          map,
          previous,
        );
        routes.set(robot.id, remaining);
        if (remaining)
          next.set(robot.id, {
            key,
            value:
              robot.freshness === "CURRENT"
                ? remaining.progress
                : (previous ?? { segment: 0, fraction: 0 }),
          });
      }
    return { routes, next };
  }, [robots, orders, map, selectedRobotId]);
  useEffect(() => {
    progress.current = result.next;
  }, [result]);
  return result.routes;
}
