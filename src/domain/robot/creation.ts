import type {
  CreateRobotRequest,
  ProvisioningOutcome,
  RetryRobotRequest,
} from "../../contracts/provisioning.generated.ts";
import { adaptProvisioningOutcome } from "../../contracts/adapters/provisioning.ts";
import { ProblemError, type CoreApiClient } from "../../services/api/client.ts";
export interface PendingCreation {
  command: CreateRobotRequest;
  outcome?: ProvisioningOutcome;
  retry?: RetryRobotRequest;
  error?: string;
  uncertain?: boolean;
  rejected?: boolean;
}
export function decodePendingCreation(
  stored: string | null,
): PendingCreation[] | null {
  try {
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    const values: PendingCreation[] = Array.isArray(parsed) ? parsed : [parsed];
    if (!values.length || values.length > 100) return null;
    for (const value of values) {
      if (
        value.command?.contractVersion !== "1.0.0" ||
        typeof value.command.requestId !== "string" ||
        !value.command.map ||
        typeof value.command.map.mapId !== "string" ||
        !Number.isInteger(value.command.map.revision) ||
        typeof value.command.map.contentDigestSha256 !== "string" ||
        !Number.isInteger(value.command.start?.column) ||
        !Number.isInteger(value.command.start?.row)
      )
        return null;
      if (
        value.retry &&
        (value.retry.contractVersion !== "1.0.0" ||
          typeof value.retry.requestId !== "string" ||
          !value.outcome)
      )
        return null;
      if (value.outcome)
        value.outcome = adaptProvisioningOutcome(value.outcome);
    }
    if (
      new Set(values.map((value) => value.command.requestId)).size !==
      values.length
    )
      return null;
    return values;
  } catch {
    return null;
  }
}
export const waiting = (entry: PendingCreation) =>
  entry.outcome?.state === "PENDING" || entry.outcome?.state === "STARTING";
export const retryable = (entry: PendingCreation) =>
  !entry.outcome || entry.outcome.state === "FAILED";

export async function submitRobotBatch(
  entries: readonly PendingCreation[],
  client: Pick<CoreApiClient, "createRobot" | "retryRobotProvisioning">,
  update: (entry: PendingCreation) => void,
  newRequestId: () => string = () => crypto.randomUUID(),
): Promise<void> {
  for (let entry of entries) {
    if (!retryable(entry)) continue;
    if (entry.outcome?.state === "FAILED" && !entry.retry)
      entry = {
        ...entry,
        retry: { contractVersion: "1.0.0", requestId: newRequestId() },
      };
    update(entry);
    try {
      const outcome =
        entry.retry && entry.outcome
          ? await client.retryRobotProvisioning(
              entry.outcome.robotId,
              entry.retry,
            )
          : await client.createRobot(entry.command);
      update({ command: entry.command, outcome });
    } catch (err) {
      const uncertain =
        !(err instanceof ProblemError) || err.problem.status >= 500;
      update({
        ...entry,
        retry: uncertain ? entry.retry : undefined,
        uncertain,
        rejected: !uncertain,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
