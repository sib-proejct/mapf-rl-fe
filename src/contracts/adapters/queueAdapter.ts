import type { QueueTask, QueueWave } from "../queue.generated.ts";

const states = [
  "Queued",
  "Running",
  "Held",
  "Cancelling",
  "Completed",
  "Cancelled",
];
export function adaptQueueTask(raw: unknown): QueueTask {
  if (!raw || typeof raw !== "object") throw new Error("Invalid queue task");
  const task = raw as QueueTask;
  if (
    task.contractVersion !== "1.0.0" ||
    typeof task.taskId !== "string" ||
    typeof task.requestId !== "string" ||
    typeof task.mapId !== "string" ||
    !Number.isSafeInteger(task.sequence) ||
    task.sequence < 1 ||
    !Number.isSafeInteger(task.entityVersion) ||
    task.entityVersion < 0 ||
    !states.includes(task.state) ||
    !Array.isArray(task.steps) ||
    task.steps.length < 1 ||
    task.steps.length > 2 ||
    !Number.isInteger(task.stage) ||
    task.stage < 0 ||
    task.stage >= task.steps.length ||
    !Array.isArray(task.orderIds) ||
    task.orderIds.some((id) => typeof id !== "string") ||
    ![
      task.waveId,
      task.robotId,
      task.requestedRobotId,
      task.reason,
      task.orderId,
    ].every((value) => value === null || typeof value === "string") ||
    !Number.isInteger(task.mapRevision) ||
    task.mapRevision < 0 ||
    !Number.isFinite(Date.parse(task.createdAt)) ||
    !Number.isFinite(Date.parse(task.updatedAt)) ||
    task.steps.some(
      (step) =>
        !Number.isInteger(step.goalColumn) ||
        step.goalColumn < 0 ||
        !Number.isInteger(step.goalRow) ||
        step.goalRow < 0 ||
        (step.arrivalAction != null &&
          !["PICK", "PLACE", "CHARGE"].includes(step.arrivalAction)),
    ) ||
    (task.steps.length === 2 &&
      (task.steps[0].arrivalAction !== "PICK" ||
        task.steps[1].arrivalAction !== "PLACE"))
  ) {
    throw new Error("Invalid queue task contract");
  }
  return task;
}

export function queueWaves(tasks: QueueTask[]): QueueWave[] {
  const waves = new Map<string, QueueWave>();
  for (const task of tasks) {
    if (!task.waveId) continue;
    let wave = waves.get(task.waveId);
    if (!wave) {
      wave = {
        contractVersion: "1.0.0",
        waveId: task.waveId,
        requestId: task.requestId,
        taskIds: [],
        counts: {
          Queued: 0,
          Running: 0,
          Held: 0,
          Cancelling: 0,
          Completed: 0,
          Cancelled: 0,
        },
      };
      waves.set(task.waveId, wave);
    }
    wave.taskIds.push(task.taskId);
    wave.counts[task.state] += 1;
  }
  return [...waves.values()];
}
