/**
 * Large-Scale 64x40 Automated Fulfillment Center Map Fixture (2,560 cells, 1.0m/cell).
 * Designed for 100+ AMR/AGV high-capacity operations and stress benchmarking.
 */
import type { RasterMap } from "../../domain/map/types.ts";

export const MEGA_WIDTH_CELLS = 64;
export const MEGA_HEIGHT_CELLS = 40;

/**
 * Structural pillars distribution for 64x40 facility.
 */
export function isMegaPillarCell(col: number, row: number): boolean {
  const pillarCols = [7, 19, 31, 43, 55];
  const pillarRows = [8, 16, 24, 32];
  return pillarCols.includes(col) && pillarRows.includes(row);
}

/**
 * Rack columns in 64-column layout (15 storage bays: Bay A ~ Bay O).
 * Each bay is 2 cells wide with 2-cell wide aisles in between.
 */
export const MEGA_RACK_COLS = [
  2, 3, 6, 7, 10, 11, 14, 15, 18, 19, 22, 23, 26, 27, 30, 31, 34, 35, 38, 39,
  42, 43, 46, 47, 50, 51, 54, 55, 58, 59,
];

export const MEGA_BAY_NAMES = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
];

export function isMegaRackCell(
  col: number,
  row: number,
): { isRack: boolean; bayCode: string; rackNumber: number } {
  if (isMegaPillarCell(col, row)) {
    return { isRack: false, bayCode: "", rackNumber: 0 };
  }

  // 4 Horizontal Block Bands:
  // South Block 1: rows 4..11
  // South Block 2: rows 14..19
  // North Block 1: rows 22..27
  // North Block 2: rows 30..35
  const inSouthBlock1 = row >= 4 && row <= 11;
  const inSouthBlock2 = row >= 14 && row <= 19;
  const inNorthBlock1 = row >= 22 && row <= 27;
  const inNorthBlock2 = row >= 30 && row <= 35;

  if (!inSouthBlock1 && !inSouthBlock2 && !inNorthBlock1 && !inNorthBlock2) {
    return { isRack: false, bayCode: "", rackNumber: 0 };
  }

  const rackColIdx = MEGA_RACK_COLS.indexOf(col);
  if (rackColIdx === -1) {
    return { isRack: false, bayCode: "", rackNumber: 0 };
  }

  const bayIdx = Math.floor(rackColIdx / 2);
  const bayCode = MEGA_BAY_NAMES[bayIdx] || "Z";
  const colOffset = rackColIdx % 2; // 0 (west side of pod) or 1 (east side)

  let blockBase = 1;
  let relativeRow = 0;
  if (inSouthBlock1) {
    blockBase = 1;
    relativeRow = row - 4;
  } else if (inSouthBlock2) {
    blockBase = 17;
    relativeRow = row - 14;
  } else if (inNorthBlock1) {
    blockBase = 29;
    relativeRow = row - 22;
  } else if (inNorthBlock2) {
    blockBase = 41;
    relativeRow = row - 30;
  }

  const rackNumber = blockBase + relativeRow * 2 + colOffset;
  return { isRack: true, bayCode, rackNumber };
}

/**
 * Generate 64x40 cell grid.
 */
export function generateMegaWarehouseCells(): number[] {
  const cells: number[] = [];
  for (let r = 0; r < MEGA_HEIGHT_CELLS; r++) {
    for (let c = 0; c < MEGA_WIDTH_CELLS; c++) {
      if (isMegaPillarCell(c, r)) {
        cells.push(1);
        continue;
      }
      const rack = isMegaRackCell(c, r);
      if (rack.isRack) {
        cells.push(1);
      } else {
        cells.push(0);
      }
    }
  }
  return cells;
}

export const MEGA_WAREHOUSE_MAP_FIXTURE: RasterMap = {
  contractVersion: "1.0.0",
  mapId: "00000000-0000-4000-8000-000000000002",
  revision: 0,
  contentDigestSha256:
    "2222222222222222222222222222222222222222222222222222222222222222",
  coordinateFrame: {
    name: "map",
    handedness: "RIGHT_HANDED",
    xAxis: "EAST",
    yAxis: "NORTH",
    zAxis: "UP",
    yaw: "COUNTERCLOCKWISE_FROM_POSITIVE_X_RADIANS",
  },
  origin: { xMeters: 0.0, yMeters: 0.0 },
  resolutionMeters: 1.0,
  widthCells: MEGA_WIDTH_CELLS,
  heightCells: MEGA_HEIGHT_CELLS,
  cells: generateMegaWarehouseCells(),
};
