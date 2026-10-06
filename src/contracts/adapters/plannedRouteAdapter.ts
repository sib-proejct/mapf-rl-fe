import type {
  PlannedRoute,
  PlannedRobotRoute,
} from "../planned-route.generated.ts";

/** Missing/unsupported/invalid optional projections do not replace robot state. */
export function adaptPlannedRoute(
  value: unknown,
  orderId: string,
  orderUpdateId: number,
): PlannedRoute | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = value as Record<string, unknown>;
  if (
    data.contractVersion !== "1.0.0" ||
    typeof data.planRevisionId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      data.planRevisionId,
    ) ||
    !Array.isArray(data.routes) ||
    !data.routes.length
  )
    return undefined;
  const routes: PlannedRobotRoute[] = [];
  const seen = new Set<string>();
  for (const raw of data.routes) {
    if (!raw || typeof raw !== "object") return undefined;
    const route = raw as PlannedRobotRoute;
    if (
      typeof route.robotId !== "string" ||
      !route.robotId ||
      seen.has(route.robotId) ||
      route.orderId !== orderId ||
      route.orderUpdateId !== orderUpdateId ||
      !Array.isArray(route.waypoints) ||
      !route.waypoints.length
    )
      return undefined;
    let previousTime = -1;
    for (const point of route.waypoints) {
      if (
        !point ||
        ![
          point.column,
          point.row,
          point.startSimulationTimeMs,
          point.endSimulationTimeMs,
        ].every((n) => Number.isSafeInteger(n) && n >= 0) ||
        point.endSimulationTimeMs < point.startSimulationTimeMs ||
        point.startSimulationTimeMs < previousTime
      )
        return undefined;
      previousTime = point.endSimulationTimeMs;
    }
    seen.add(route.robotId);
    routes.push({
      robotId: route.robotId,
      orderId,
      orderUpdateId,
      waypoints: route.waypoints.map((point) => ({ ...point })),
    });
  }
  return {
    contractVersion: "1.0.0",
    planRevisionId: data.planRevisionId,
    routes,
  };
}
