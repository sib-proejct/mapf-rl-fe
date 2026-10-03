// Generated from Core order-queue.schema.json. Do not edit.
export interface QueueIntent {
  robotId?: string | null;
  steps: (QueueStep)[];
}
export interface QueueStep {
  goalColumn: number;
  goalRow: number;
  arrivalAction?: "PICK" | "PLACE" | "CHARGE" | null;
}
export interface CreateQueueTaskRequest {
  requestId: string;
  mapId: string;
  mapRevision: number;
  task: QueueIntent;
}
export interface CreateWaveRequest {
  requestId: string;
  mapId: string;
  mapRevision: number;
  tasks: (QueueIntent)[];
}
export interface CancelQueueTaskRequest {
  requestId: string;
}
export interface QueueTask {
  contractVersion: "1.0.0";
  taskId: string;
  requestId: string;
  sequence: number;
  mapId: string;
  mapRevision: number;
  waveId: string | null;
  requestedRobotId: string | null;
  robotId: string | null;
  steps: (QueueStep)[];
  stage: number;
  state: "Queued" | "Running" | "Held" | "Cancelling" | "Completed" | "Cancelled";
  reason: string | null;
  orderId: string | null;
  orderIds: (string)[];
  entityVersion: number;
  createdAt: string;
  updatedAt: string;
}
export interface WaveCounts {
  Queued: number;
  Running: number;
  Held: number;
  Cancelling: number;
  Completed: number;
  Cancelled: number;
}
export interface QueueWave {
  contractVersion: "1.0.0";
  waveId: string;
  requestId: string;
  taskIds: (string)[];
  counts: WaveCounts;
}
export interface QueueSnapshot {
  contractVersion: "1.0.0";
  tasks: (QueueTask)[];
  waves: (QueueWave)[];
}
export interface QueueTaskOutcome {
  contractVersion: "1.0.0";
  requestId: string;
  taskId: string;
  state: "Queued" | "Running" | "Held" | "Cancelling" | "Completed" | "Cancelled";
  orderId?: string | null;
}
export interface QueueWaveOutcome {
  contractVersion: "1.0.0";
  requestId: string;
  waveId: string;
  taskIds: (string)[];
  state: "Queued" | "Running" | "Held" | "Cancelling" | "Completed" | "Cancelled";
}
