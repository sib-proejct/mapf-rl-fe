// Generated from Core planned-route.schema.json. Do not edit.
export interface PlannedWaypoint {
  column: number;
  row: number;
  startSimulationTimeMs: number;
  endSimulationTimeMs: number;
}
export interface PlannedRobotRoute {
  robotId: string;
  orderId: string;
  orderUpdateId: number;
  waypoints: PlannedWaypoint[];
}
export interface PlannedRoute {
  contractVersion: "1.0.0";
  planRevisionId: string;
  routes: PlannedRobotRoute[];
}
