import type { BatteryPolicy } from "../contracts/battery.generated.ts";
import type { Robot } from "../domain/robot/types.ts";
import type { Order } from "../domain/order/types.ts";

export function isLowBattery(robot: Robot, policy?: BatteryPolicy): boolean {
  const percent = robot.stationState?.batteryPercent ?? robot.batteryPercent;
  return (
    policy !== undefined &&
    percent !== undefined &&
    percent <= policy.lowBatteryPercent
  );
}

export function batteryLabel(
  robot: Robot,
  orders: Order[],
  policy?: BatteryPolicy,
  language = "ko",
): string | undefined {
  const percent = robot.stationState?.batteryPercent ?? robot.batteryPercent;
  const labels =
    language === "ko"
      ? {
          depleted: "배터리 고갈",
          charging: "충전 중",
          moving: "충전소 이동",
          waiting: "충전 대기",
          low: "배터리 부족 · 작업 후 충전",
        }
      : {
          depleted: "Battery depleted",
          charging: "Charging",
          moving: "Going to charger",
          waiting: "Waiting for charger",
          low: "Low battery · charge after task",
        };
  if (policy && percent !== undefined && percent <= policy.depletedPercent)
    return labels.depleted;
  if (robot.operationalState === "CHARGING") return labels.charging;
  const charge = orders.some(
    (order) =>
      !["Completed", "Cancelled", "Rejected"].includes(order.state) &&
      order.assignments.some(
        (assignment) =>
          assignment.robotId === robot.id &&
          assignment.arrivalAction === "CHARGE",
      ),
  );
  if (charge) return labels.moving;
  if (isLowBattery(robot, policy))
    return robot.operationalState === "IDLE" ? labels.waiting : labels.low;
  return undefined;
}

export function adaptBatteryPolicy(raw: unknown): BatteryPolicy | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object") throw new Error("Invalid battery policy");
  const policy = raw as Record<string, unknown>;
  if (
    !["1.0.0", "1.1.0"].includes(String(policy.version)) ||
    typeof policy.lowBatteryPercent !== "number" ||
    !Number.isFinite(policy.lowBatteryPercent) ||
    policy.lowBatteryPercent < 0 ||
    policy.lowBatteryPercent > 100 ||
    policy.depletedPercent !== 0 ||
    policy.chargeTargetPercent !== (policy.version === "1.0.0" ? 100 : 80)
  ) {
    throw new Error("Invalid battery policy");
  }
  return policy as unknown as BatteryPolicy;
}
