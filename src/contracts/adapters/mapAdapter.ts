import type { RasterMap } from "../../domain/map/types.ts";
import { adaptBufferCatalog } from "./bufferAdapter.ts";

/**
 * Validates and adapts raw Map contract JSON into typed RasterMap domain model.
 */
export function adaptRasterMap(raw: unknown): RasterMap {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid map payload: expected non-null object");
  }

  const obj = raw as Record<string, unknown>;

  if (obj.contractVersion !== "1.0.0") {
    throw new Error(
      `Incompatible map contract version: expected "1.0.0", got "${obj.contractVersion}"`,
    );
  }

  if (typeof obj.mapId !== "string" || !obj.mapId) {
    throw new Error("Invalid mapId: expected non-empty string");
  }

  if (typeof obj.revision !== "number" || obj.revision < 0) {
    throw new Error("Invalid map revision: expected non-negative integer");
  }

  if (
    typeof obj.contentDigestSha256 !== "string" ||
    !/^[0-9a-f]{64}$/i.test(obj.contentDigestSha256)
  ) {
    throw new Error(
      "Invalid contentDigestSha256: expected 64-character hex string",
    );
  }

  const origin = obj.origin as { xMeters?: unknown; yMeters?: unknown };
  if (
    !origin ||
    typeof origin.xMeters !== "number" ||
    typeof origin.yMeters !== "number" ||
    !isFinite(origin.xMeters) ||
    !isFinite(origin.yMeters)
  ) {
    throw new Error(
      "Invalid map origin: expected finite numbers xMeters and yMeters",
    );
  }

  const resolutionMeters = obj.resolutionMeters;
  if (
    typeof resolutionMeters !== "number" ||
    resolutionMeters <= 0 ||
    !isFinite(resolutionMeters)
  ) {
    throw new Error(
      "Invalid resolutionMeters: expected positive finite number",
    );
  }

  const widthCells = obj.widthCells;
  const heightCells = obj.heightCells;
  if (
    typeof widthCells !== "number" ||
    typeof heightCells !== "number" ||
    widthCells < 1 ||
    heightCells < 1 ||
    !Number.isInteger(widthCells) ||
    !Number.isInteger(heightCells)
  ) {
    throw new Error(
      "Invalid map dimensions: widthCells and heightCells must be positive integers",
    );
  }

  const cells = obj.cells;
  if (!Array.isArray(cells) || cells.length !== widthCells * heightCells) {
    throw new Error(
      `Invalid map cells: array length (${Array.isArray(cells) ? cells.length : 0}) does not match width * height (${widthCells * heightCells})`,
    );
  }

  // Verify all cells are 0 or 1
  for (let i = 0; i < cells.length; i++) {
    const val = cells[i];
    if (val !== 0 && val !== 1) {
      throw new Error(
        `Invalid cell value at index ${i}: expected 0 or 1, got ${val}`,
      );
    }
  }

  let stationCatalog: RasterMap["stationCatalog"];
  if (obj.stationCatalog !== undefined) {
    if (
      !Array.isArray(obj.stationCatalog) ||
      typeof obj.stationCatalogDigestSha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(obj.stationCatalogDigestSha256)
    )
      throw new Error("Invalid station catalog");
    const ids = new Set<number>();
    stationCatalog = obj.stationCatalog.map((raw) => {
      if (!raw || typeof raw !== "object") throw new Error("Invalid station");
      const station = raw as Record<string, unknown>;
      const column = Number(station.column),
        row = Number(station.row);
      const id = row * widthCells + column;
      if (
        !Number.isInteger(column) ||
        !Number.isInteger(row) ||
        column < 0 ||
        row < 0 ||
        column >= widthCells ||
        row >= heightCells ||
        cells[id] !== 0 ||
        ids.has(id) ||
        !["pick", "place", "charger"].includes(String(station.type)) ||
        typeof station.name !== "string"
      )
        throw new Error("Invalid station fields");
      ids.add(id);
      return {
        column,
        row,
        type: station.type as "pick" | "place" | "charger",
        name: station.name,
      };
    });
  }
  const bufferCatalog =
    obj.bufferCatalog === undefined
      ? undefined
      : adaptBufferCatalog(obj.bufferCatalog);
  if (
    bufferCatalog &&
    (bufferCatalog.mapId !== obj.mapId ||
      bufferCatalog.mapRevision !== obj.revision ||
      typeof obj.bufferCatalogDigestSha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(obj.bufferCatalogDigestSha256) ||
      bufferCatalog.buffers.some(
        (b) =>
          b.column >= widthCells ||
          b.row >= heightCells ||
          cells[b.row * widthCells + b.column] !== 0 ||
          stationCatalog?.some((s) => s.column === b.column && s.row === b.row),
      ))
  )
    throw new Error("Invalid buffer catalog map binding");
  return {
    bufferCatalog,
    bufferCatalogDigestSha256: obj.bufferCatalogDigestSha256 as
      | string
      | undefined,
    stationCatalog,
    stationCatalogDigestSha256: obj.stationCatalogDigestSha256 as
      | string
      | undefined,
    contractVersion: "1.0.0",
    mapId: obj.mapId,
    revision: obj.revision,
    contentDigestSha256: obj.contentDigestSha256.toLowerCase(),
    coordinateFrame: {
      name: "map",
      handedness: "RIGHT_HANDED",
      xAxis: "EAST",
      yAxis: "NORTH",
      zAxis: "UP",
      yaw: "COUNTERCLOCKWISE_FROM_POSITIVE_X_RADIANS",
    },
    origin: {
      xMeters: origin.xMeters,
      yMeters: origin.yMeters,
    },
    resolutionMeters,
    widthCells,
    heightCells,
    cells: cells as number[],
  };
}
