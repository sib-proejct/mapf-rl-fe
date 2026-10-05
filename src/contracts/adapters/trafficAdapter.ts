import type { TrafficWait } from "../provisioning.generated.ts";

export function adaptTrafficWait(value: unknown): TrafficWait | undefined {
  if (!value || typeof value !== "object") return undefined;
  const wait = value as Record<string, unknown>;
  if (
    wait.contractVersion !== "1.0.0" ||
    wait.reason !== "PASSAGE_RIGHT_UNAVAILABLE" ||
    !Array.isArray(wait.blockingRobotIds) ||
    !wait.blockingRobotIds.every(
      (id) => typeof id === "string" && id.length > 0,
    )
  ) {
    return undefined;
  }
  return {
    contractVersion: "1.0.0",
    reason: "PASSAGE_RIGHT_UNAVAILABLE",
    blockingRobotIds: [...new Set(wait.blockingRobotIds)],
  };
}
