// Generated from Core buffer.schema.json. Do not edit.
export interface BufferNode {
  column: number;
  row: number;
  name: string;
}
export interface BufferCatalog {
  contractVersion: "1.0.0";
  mapId: string;
  mapRevision: number;
  buffers: (BufferNode)[];
}
export interface BufferState {
  contractVersion: "1.0.0";
  robotId: string;
  entityVersion: number;
  phase: "NONE" | "RESERVED" | "EXIT_PENDING" | "MOVING" | "WAITING" | "HELD";
  buffer: BufferNode | null;
  mapId: string | null;
  mapRevision: number | null;
  placeOrderId: string | null;
  orderId: string | null;
  stationClear: boolean;
  reason: string | null;
  movementKind: "BUFFER" | "NEXT" | "CHARGE" | null;
  bufferOccupied: boolean;
}
