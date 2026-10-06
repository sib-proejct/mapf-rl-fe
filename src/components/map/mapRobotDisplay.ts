import type { Order } from "../../domain/order/types.ts";
import type { Robot } from "../../domain/robot/types.ts";

export const selectionColor = (isDark: boolean) =>
  isDark ? "#A5B4FC" : "#172554";
export const selectionFill = (isDark: boolean) =>
  isDark ? "rgba(165, 180, 252, 0.25)" : "rgba(23, 37, 84, 0.2)";

export function isTerminalOrder(order: Order) {
  return ["Completed", "Cancelled", "Rejected"].includes(order.state);
}

export function findRobotOrder(
  robot: Robot,
  orders: Order[],
  mapId?: string,
  mapRevision?: number,
) {
  const onMap = (order: Order) =>
    (order.mapId === undefined || order.mapId === mapId) &&
    (order.mapRevision === undefined || order.mapRevision === mapRevision);
  const current = orders.find(
    (order) => order.id === robot.currentOrderId && onMap(order),
  );
  if (current) return isTerminalOrder(current) ? undefined : current;
  return orders.find(
    (order) =>
      onMap(order) &&
      !isTerminalOrder(order) &&
      order.assignments.some((assignment) => assignment.robotId === robot.id),
  );
}
