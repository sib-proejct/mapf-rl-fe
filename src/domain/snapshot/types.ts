import { RasterMap } from "../map/types";
import { Robot } from "../robot/types";
import { Order } from "../order/types";

export type SnapshotFreshness =
  | "CURRENT"
  | "STALE"
  | "PARTIAL"
  | "DISCONNECTED"
  | "RECONCILING";

export interface StreamCursor {
  streamId: string;
  eventSequence: number;
}

export interface AuthoritativeSnapshot {
  contractVersion: "1.0.0";
  snapshotAt: string;
  cursor: StreamCursor;
  freshness: SnapshotFreshness;
  map: RasterMap;
  robots: Robot[];
  orders: Order[];
}
