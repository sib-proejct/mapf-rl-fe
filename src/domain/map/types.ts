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
  cells: number[]; // 0 = traversable, 1 = blocked
}

export interface MapIdentity {
  mapId: string;
  revision: number;
  contentDigestSha256: string;
}
