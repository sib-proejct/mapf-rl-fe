import type {
  ProvisioningOutcome,
  ProvisioningCapabilities,
  RobotRemovalOutcome,
} from "../provisioning.generated.ts";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid provisioning response");
  return value as Record<string, unknown>;
}

export function adaptRobotRemovalOutcome(value: unknown): RobotRemovalOutcome {
  const data = record(value);
  if (
    data.contractVersion !== "1.0.0" ||
    typeof data.robotId !== "string" ||
    !data.robotId ||
    !["PENDING", "REMOVED"].includes(data.state as string)
  )
    throw new Error("Invalid robot removal outcome");
  return {
    contractVersion: "1.0.0",
    robotId: data.robotId,
    state: data.state as RobotRemovalOutcome["state"],
  };
}

export function adaptProvisioningOutcome(value: unknown): ProvisioningOutcome {
  const data = record(value);
  if (
    data.contractVersion !== "1.0.0" ||
    typeof data.robotId !== "string" ||
    !data.robotId ||
    !["PENDING", "STARTING", "READY", "FAILED"].includes(
      data.state as string,
    ) ||
    (data.failureCode != null && typeof data.failureCode !== "string")
  )
    throw new Error("Invalid provisioning outcome");
  return {
    contractVersion: "1.0.0",
    robotId: data.robotId,
    state: data.state as ProvisioningOutcome["state"],
    ...(typeof data.failureCode === "string"
      ? { failureCode: data.failureCode }
      : {}),
  };
}

export function adaptProvisioningCapabilities(
  value: unknown,
): ProvisioningCapabilities {
  const data = record(value);
  if (data.contractVersion !== "1.0.0" || typeof data.available !== "boolean")
    throw new Error("Invalid provisioning capabilities");
  return { contractVersion: "1.0.0", available: data.available };
}
