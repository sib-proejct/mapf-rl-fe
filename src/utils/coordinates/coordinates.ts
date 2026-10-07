/**
 * Pure coordinate transformation utilities for MAPF-RL.
 *
 * Wire specification (Cartesian right-handed):
 * - +x: East (Right)
 * - +y: North (Up in world)
 * - Yaw: Radians counter-clockwise from positive x-axis
 * - Grid: column (+x), row (+y)
 * - Cell center: (column + 0.5, row + 0.5) * resolutionMeters + origin
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Origin2D {
  xMeters: number;
  yMeters: number;
}

export interface GridCell {
  column: number;
  row: number;
}

export interface MapDimensions {
  widthCells: number;
  heightCells: number;
  resolutionMeters: number;
  origin: Origin2D;
}

/**
 * Calculates world coordinates (meters) from grid cell (column, row).
 * Returns the exact center point of the specified cell.
 */
export function cellToWorld(
  cell: GridCell,
  resolutionMeters: number,
  origin: Origin2D,
): Point2D {
  if (resolutionMeters <= 0) {
    throw new Error("resolutionMeters must be positive and non-zero");
  }
  return {
    x: (cell.column + 0.5) * resolutionMeters + origin.xMeters,
    y: (cell.row + 0.5) * resolutionMeters + origin.yMeters,
  };
}

/**
 * Calculates grid cell (column, row) from world coordinates (meters).
 */
export function worldToCell(
  point: Point2D,
  resolutionMeters: number,
  origin: Origin2D,
): GridCell {
  if (resolutionMeters <= 0) {
    throw new Error("resolutionMeters must be positive and non-zero");
  }
  return {
    column: Math.floor((point.x - origin.xMeters) / resolutionMeters),
    row: Math.floor((point.y - origin.yMeters) / resolutionMeters),
  };
}

/**
 * Converts world coordinates (meters) to screen canvas pixels with y-inversion.
 */
export function worldToScreen(
  point: Point2D,
  mapDim: MapDimensions,
  canvasWidth: number,
  canvasHeight: number,
): Point2D {
  const worldWidth = mapDim.widthCells * mapDim.resolutionMeters;
  const worldHeight = mapDim.heightCells * mapDim.resolutionMeters;

  if (worldWidth <= 0 || worldHeight <= 0) {
    return { x: 0, y: 0 };
  }

  const normalizedX = (point.x - mapDim.origin.xMeters) / worldWidth;
  const normalizedY = (point.y - mapDim.origin.yMeters) / worldHeight;

  return {
    x: normalizedX * canvasWidth,
    y: (1 - normalizedY) * canvasHeight, // y-axis inversion for screen
  };
}

/**
 * Converts screen canvas pixels back to world coordinates (meters) with y-inversion.
 */
export function screenToWorld(
  screenPoint: Point2D,
  mapDim: MapDimensions,
  canvasWidth: number,
  canvasHeight: number,
): Point2D {
  const worldWidth = mapDim.widthCells * mapDim.resolutionMeters;
  const worldHeight = mapDim.heightCells * mapDim.resolutionMeters;

  if (canvasWidth <= 0 || canvasHeight <= 0) {
    return { x: mapDim.origin.xMeters, y: mapDim.origin.yMeters };
  }

  const normalizedX = screenPoint.x / canvasWidth;
  const normalizedY = 1 - screenPoint.y / canvasHeight;

  return {
    x: normalizedX * worldWidth + mapDim.origin.xMeters,
    y: normalizedY * worldHeight + mapDim.origin.yMeters,
  };
}

/**
 * Converts world counter-clockwise radians to degrees (0 to 360).
 */
export function yawToDegrees(yawRadians: number): number {
  let deg = (yawRadians * 180) / Math.PI;
  deg = deg % 360;
  if (deg < 0) deg += 360;
  return deg;
}

/**
 * Converts degrees to world counter-clockwise radians.
 */
export function degreesToYaw(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Converts world counter-clockwise yaw (radians) to screen SVG rotation degrees.
 * Screen rotation is clockwise from +x (East).
 */
export function yawToScreenRotationDegrees(yawRadians: number): number {
  return -((yawRadians * 180) / Math.PI);
}

/**
 * Formats world coordinates as a human-readable string.
 */
export function formatCoordinates(xMeters: number, yMeters: number): string {
  return `(${xMeters.toFixed(2)}m, ${yMeters.toFixed(2)}m)`;
}

/**
 * Calculates linear node ID from grid cell coordinates and map width.
 */
export function cellToNodeId(cell: GridCell, widthCells: number): number {
  if (widthCells <= 0) {
    throw new Error("widthCells must be positive and non-zero");
  }
  return cell.row * widthCells + cell.column;
}

/**
 * Calculates grid cell coordinates from a linear node ID and map width.
 */
export function nodeIdToCell(nodeId: number, widthCells: number): GridCell {
  if (widthCells <= 0) {
    throw new Error("widthCells must be positive and non-zero");
  }
  return {
    column: nodeId % widthCells,
    row: Math.floor(nodeId / widthCells),
  };
}

/**
 * Formats node information as a human-readable string.
 */
export function formatNodeId(nodeId: number, cell?: GridCell): string {
  if (cell) {
    return `Node ${nodeId} (${cell.column}, ${cell.row})`;
  }
  return `Node ${nodeId}`;
}

/** Finds the closest grid node within the screen-space hit radius. */
export function findNearestScreenNode<T extends GridCell>(
  nodes: readonly T[],
  point: Point2D,
  widthCells: number,
  heightCells: number,
  canvasWidth: number,
  canvasHeight: number,
  hitRadius: number,
): T | null {
  const cellWidth = canvasWidth / widthCells;
  const cellHeight = canvasHeight / heightCells;
  let nearest: T | null = null;
  let nearestDistance = hitRadius;
  for (const node of nodes) {
    const x = (node.column + 0.5) * cellWidth;
    const y = (heightCells - node.row - 0.5) * cellHeight;
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < nearestDistance) {
      nearest = node;
      nearestDistance = distance;
    }
  }
  return nearest;
}
