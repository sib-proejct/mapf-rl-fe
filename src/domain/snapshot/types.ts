import { RasterMap } from "../map/types.ts";
import { Robot } from "../robot/types.ts";
import { Order } from "../order/types.ts";
import { Incident } from "../incident/types.ts";

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

export interface EntityVersion {
  version: number;
  contentDigestSha256: string;
}

export interface AuthoritativeSnapshot {
  contractVersion: "1.0.0";
  snapshotAt: string;
  cursor: StreamCursor;
  freshness: SnapshotFreshness;
  entityVersions: Record<string, EntityVersion>;
  map: RasterMap;
  robots: Robot[];
  orders: Order[];
  incidents: Incident[];
  batteryPolicy?: import("../../contracts/battery.generated.ts").BatteryPolicy;
}
