/**
 * Typed domain model for Raster Map.
 */

export interface MapCoordinateFrame {
  name: "map";
  handedness: "RIGHT_HANDED";
  xAxis: "EAST";
  yAxis: "NORTH";
  zAxis: "UP";
  yaw: "COUNTERCLOCKWISE_FROM_POSITIVE_X_RADIANS";
}

export interface MapOrigin {
  xMeters: number;
  yMeters: number;
}

export interface RasterMap {
  contractVersion: "1.0.0";
  mapId: string;
  revision: number;
  contentDigestSha256: string;
  coordinateFrame: MapCoordinateFrame;
  origin: MapOrigin;
  resolutionMeters: number;
  widthCells: number;
  heightCells: number;
  stationCatalog?: {
    column: number;
    row: number;
    type: "pick" | "place" | "charger";
    name: string;
  }[];
  stationCatalogDigestSha256?: string;
  cells: number[]; // 0 = traversable, 1 = blocked
}

export type MapNodeType =
  | "waypoint"
  | "rack"
  | "charger"
  | "pillar"
  | "buffer"
  | "chute"
  | "workstation"
  | "pick"
  | "place";

export interface MapNode {
  id: number;
  column: number;
  row: number;
  xMeters: number;
  yMeters: number;
  type: MapNodeType;
  name: string;
  isTraversable: boolean;
  zone?: string;
}

export type EdgeDirection = "bidirectional" | "forward" | "backward";

export interface MapEdge {
  id: string;
  fromNodeId: number;
  toNodeId: number;
  fromColumn: number;
  fromRow: number;
  toColumn: number;
  toRow: number;
  direction: EdgeDirection;
  type: "corridor" | "aisle" | "station_feeder" | "transfer";
  weightMeters: number;
}

export interface MapTopology {
  mapId: string;
  nodes: MapNode[];
  edges: MapEdge[];
  nodeMap: Map<number, MapNode>;
  edgeMap: Map<string, MapEdge>;
  nodeOutgoingEdges: Map<number, MapEdge[]>;
  nodeIncomingEdges: Map<number, MapEdge[]>;
}

export interface MapIdentity {
  mapId: string;
  revision: number;
  contentDigestSha256: string;
}
