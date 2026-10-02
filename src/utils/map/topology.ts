import type {
  RasterMap,
  MapNode,
  MapNodeType,
  MapEdge,
  MapTopology,
} from "../../domain/map/types.ts";
import { cellToWorld, cellToNodeId } from "../coordinates/coordinates.ts";
import {
  isMegaPillarCell,
  isMegaRackCell,
  MEGA_RACK_COLS,
  MEGA_BAY_NAMES,
} from "../../contracts/fixtures/largeWarehouseMap.ts";

/**
 * Helper to check if a cell is a designated structural pillar.
 */
export function isPillarCell(
  col: number,
  row: number,
  widthCells = 32,
): boolean {
  if (widthCells >= 64) {
    return isMegaPillarCell(col, row);
  }
  return (col === 7 || col === 19) && (row === 4 || row === 11 || row === 15);
}

/**
 * Helper to determine if a cell is a physical Storage Rack Pod.
 */
export function isRackCell(
  col: number,
  row: number,
  widthCells: number,
  heightCells: number,
): { isRack: boolean; bayCode: string; rackNumber: number } {
  if (widthCells >= 64) {
    return isMegaRackCell(col, row);
  }

  // If overridden by pillar, not a rack
  if (isPillarCell(col, row, widthCells)) {
    return { isRack: false, bayCode: "", rackNumber: 0 };
  }

  if (row < 4 || row > heightCells - 5 || row === 9 || row === 10) {
    return { isRack: false, bayCode: "", rackNumber: 0 };
  }

  const is32ColLayout = widthCells >= 24;
  let isRack = false;
  let bayCode = "";
  let colOffset = 0;

  if (is32ColLayout) {
    if (col === 2 || col === 3) {
      isRack = true;
      bayCode = "A";
      colOffset = col === 3 ? 1 : 0;
    } else if (col === 7 || col === 8) {
      isRack = true;
      bayCode = "B";
      colOffset = col === 8 ? 1 : 0;
    } else if (col === 11 || col === 12) {
      isRack = true;
      bayCode = "C";
      colOffset = col === 12 ? 1 : 0;
    } else if (col === 15 || col === 16) {
      isRack = true;
      bayCode = "D";
      colOffset = col === 16 ? 1 : 0;
    } else if (col === 19 || col === 20) {
      isRack = true;
      bayCode = "E";
      colOffset = col === 20 ? 1 : 0;
    } else if (col === 23 || col === 24) {
      isRack = true;
      bayCode = "F";
      colOffset = col === 24 ? 1 : 0;
    }
  } else {
    if (col === 2 || col === 3) {
      isRack = true;
      bayCode = "A";
      colOffset = col % 2 === 1 ? 1 : 0;
    } else if (col === 6 || col === 7) {
      isRack = true;
      bayCode = "B";
      colOffset = col % 2 === 1 ? 1 : 0;
    } else if (col === 10 || col === 11) {
      isRack = true;
      bayCode = "C";
      colOffset = col % 2 === 1 ? 1 : 0;
    }
  }

  if (!isRack) {
    return { isRack: false, bayCode: "", rackNumber: 0 };
  }

  const isNorthBlock = row > 10;
  const rowOffset = isNorthBlock ? row - 10 : row - 3;
  const rackNumber = (rowOffset - 1) * 2 + colOffset + (isNorthBlock ? 11 : 1);

  return { isRack: true, bayCode, rackNumber };
}

/**
 * Helper to determine if a traversable cell is directly facing a Storage Rack (Pick Node).
 */
export function isPickCell(
  col: number,
  row: number,
  widthCells: number,
  heightCells: number,
): { isPick: boolean; facingBay: string; rackTag: string } {
  if (widthCells >= 64) {
    const inSouthBlock1 = row >= 4 && row <= 11;
    const inSouthBlock2 = row >= 14 && row <= 19;
    const inNorthBlock1 = row >= 22 && row <= 27;
    const inNorthBlock2 = row >= 30 && row <= 35;

    if (!inSouthBlock1 && !inSouthBlock2 && !inNorthBlock1 && !inNorthBlock2) {
      return { isPick: false, facingBay: "", rackTag: "" };
    }

    // Check if col is adjacent to a rack column
    let targetRackCol = -1;
    if (MEGA_RACK_COLS.includes(col + 1)) {
      // Robot on west aisle facing east rack
      targetRackCol = col + 1;
    } else if (MEGA_RACK_COLS.includes(col - 1)) {
      // Robot on east aisle facing west rack
      targetRackCol = col - 1;
    }

    if (targetRackCol < 0) {
      return { isPick: false, facingBay: "", rackTag: "" };
    }

    const rackInfo = isMegaRackCell(targetRackCol, row);
    if (!rackInfo.isRack) {
      return { isPick: false, facingBay: "", rackTag: "" };
    }

    const rackTag = `${rackInfo.bayCode}-${String(rackInfo.rackNumber).padStart(2, "0")}`;
    return { isPick: true, facingBay: rackInfo.bayCode, rackTag };
  }

  if (row < 4 || row > heightCells - 5 || row === 9 || row === 10) {
    return { isPick: false, facingBay: "", rackTag: "" };
  }

  const is32ColLayout = widthCells >= 24;
  let facingBay = "";
  let targetRackCol = -1;

  if (is32ColLayout) {
    if (col === 1) {
      facingBay = "A";
      targetRackCol = 2;
    } else if (col === 4) {
      facingBay = "A";
      targetRackCol = 3;
    } else if (col === 6) {
      facingBay = "B";
      targetRackCol = 7;
    } else if (col === 9) {
      facingBay = "B";
      targetRackCol = 8;
    } else if (col === 10) {
      facingBay = "C";
      targetRackCol = 11;
    } else if (col === 13) {
      facingBay = "C";
      targetRackCol = 12;
    } else if (col === 14) {
      facingBay = "D";
      targetRackCol = 15;
    } else if (col === 17) {
      facingBay = "D";
      targetRackCol = 16;
    } else if (col === 18) {
      facingBay = "E";
      targetRackCol = 19;
    } else if (col === 21) {
      facingBay = "E";
      targetRackCol = 20;
    } else if (col === 22) {
      facingBay = "F";
      targetRackCol = 23;
    } else if (col === 25) {
      facingBay = "F";
      targetRackCol = 24;
    }
  } else {
    if (col === 1) {
      facingBay = "A";
      targetRackCol = 2;
    } else if (col === 4) {
      facingBay = "A";
      targetRackCol = 3;
    } else if (col === 5) {
      facingBay = "B";
      targetRackCol = 6;
    } else if (col === 8) {
      facingBay = "B";
      targetRackCol = 7;
    } else if (col === 9) {
      facingBay = "C";
      targetRackCol = 10;
    } else if (col === 12) {
      facingBay = "C";
      targetRackCol = 11;
    }
  }

  if (!facingBay || targetRackCol < 0) {
    return { isPick: false, facingBay: "", rackTag: "" };
  }

  const rackInfo = isRackCell(targetRackCol, row, widthCells, heightCells);
  if (!rackInfo.isRack) {
    return { isPick: false, facingBay: "", rackTag: "" };
  }

  const rackTag = `${facingBay}-${String(rackInfo.rackNumber).padStart(2, "0")}`;
  return { isPick: true, facingBay, rackTag };
}

/**
 * Determines the specialized functional node type for a cell in the fulfillment center layout.
 */
export function classifyNodeType(
  col: number,
  row: number,
  isBlocked: boolean,
  widthCells: number,
  heightCells: number,
): {
  type: MapNodeType;
  name: string;
  zone: string;
  isTraversableOverride?: boolean;
} {
  const isMegaLayout = widthCells >= 64;

  // 1. Structural pillars
  if (isPillarCell(col, row, widthCells)) {
    const pillarName = isMegaLayout
      ? `Pillar-C${col}R${row}`
      : col === 7
        ? row === 15
          ? "B-19"
          : row === 11
            ? "B-11"
            : "B-01"
        : row === 15
          ? "E-19"
          : row === 11
            ? "E-11"
            : "E-01";
    return {
      type: "pillar",
      name: `Pillar ${pillarName} (${col}, ${row})`,
      zone: "Structure",
      isTraversableOverride: false,
    };
  }

  // 2. Storage racks (treated as blocked pod obstacles)
  const rackInfo = isRackCell(col, row, widthCells, heightCells);
  if (rackInfo.isRack) {
    const blockName = isMegaLayout
      ? row > 20
        ? "North Zone"
        : "South Zone"
      : row > 10
        ? "North Block"
        : "South Block";
    const rackTag = `${rackInfo.bayCode}-${String(rackInfo.rackNumber).padStart(2, "0")}`;
    return {
      type: "rack",
      name: `Rack ${rackTag} (Pod)`,
      zone: `Rack Bay ${rackInfo.bayCode} (${blockName})`,
      isTraversableOverride: false,
    };
  }

  if (isBlocked) {
    return {
      type: "pillar",
      name: `Pillar (${col}, ${row})`,
      zone: "Structure",
      isTraversableOverride: false,
    };
  }

  // Workstations & Chutes column distribution
  const stationCols = isMegaLayout
    ? [3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 55, 59]
    : widthCells >= 24
      ? [3, 8, 13, 18, 23, 28]
      : [1, 5, 9, 13];
  const chuteCols = stationCols;

  // 1. Place Stations: Bottom row designated stations
  if (row === 0 && stationCols.includes(col)) {
    const wsIdx = stationCols.indexOf(col) + 1;
    return {
      type: "place",
      name: `Place WS-${String(wsIdx).padStart(2, "0")} (Place Station)`,
      zone: "Place Zone",
    };
  }

  // 2. Chutes: Top row designated stations
  if (row === heightCells - 1 && chuteCols.includes(col)) {
    const chuteIdx = chuteCols.indexOf(col) + 1;
    return {
      type: "place",
      name: `Place Chute-${String(chuteIdx).padStart(2, "0")} (Place Station)`,
      zone: "Sortation Place Zone",
    };
  }

  // 3. Chargers (Automated Docking Bays)
  if (isMegaLayout) {
    const isWestCharger =
      col === 0 && [6, 8, 10, 16, 18, 24, 26, 32, 34].includes(row);
    const isEastCharger =
      col === widthCells - 1 &&
      [6, 8, 10, 16, 18, 24, 26, 32, 34].includes(row);

    if (isWestCharger || isEastCharger) {
      const wall = isWestCharger ? "West" : "East";
      const chgIdx =
        (isWestCharger ? 0 : 9) +
        [6, 8, 10, 16, 18, 24, 26, 32, 34].indexOf(row) +
        1;
      return {
        type: "charger",
        name: `Charger-${String(chgIdx).padStart(2, "0")}`,
        zone: `Charging Bay (${wall})`,
      };
    }
  } else {
    const isEastCharger =
      col === widthCells - 1 &&
      (heightCells >= 16
        ? [4, 6, 8, 12, 14, 16].includes(row)
        : [3, 5, 7].includes(row));

    if (isEastCharger) {
      const rowsList = heightCells >= 16 ? [4, 6, 8, 12, 14, 16] : [3, 5, 7];
      const chgIdx = rowsList.indexOf(row) + 1;
      return {
        type: "charger",
        name: `Charger-0${chgIdx}`,
        zone: "Charging Bay (East)",
      };
    }
  }

  // 4. Buffers (Inflow Queues & Staging Area)
  if (row === 1 && stationCols.includes(col)) {
    const wsIdx = stationCols.indexOf(col) + 1;
    return {
      type: "buffer",
      name: `Buffer-${String(wsIdx).padStart(2, "0")} (Place WS In-Buffer)`,
      zone: "Place Buffer Zone",
    };
  }

  if (row === heightCells - 2 && chuteCols.includes(col)) {
    const chuteIdx = chuteCols.indexOf(col) + 1;
    const bufNum = isMegaLayout ? chuteIdx + 15 : chuteIdx + 6;
    return {
      type: "buffer",
      name: `Buffer-${String(bufNum).padStart(2, "0")} (Place Chute In-Buffer)`,
      zone: "Chute Buffer Zone",
    };
  }

  // 5. Pick Nodes (Aisle cells directly in front of Storage Racks)
  const pickInfo = isPickCell(col, row, widthCells, heightCells);
  if (pickInfo.isPick) {
    return {
      type: "pick",
      name: `Pick (${pickInfo.rackTag})`,
      zone: `Aisle Pick Point (Bay ${pickInfo.facingBay})`,
    };
  }

  // 6. Central Crossways & Express Highways
  if (isMegaLayout) {
    if (row === 12 || row === 13) {
      return {
        type: "waypoint",
        name: `Node #${cellToNodeId({ column: col, row }, widthCells)}`,
        zone: "South Arterial Crossway",
      };
    }
    if (row === 20 || row === 21) {
      return {
        type: "waypoint",
        name: `Node #${cellToNodeId({ column: col, row }, widthCells)}`,
        zone: "Central Arterial Crossway",
      };
    }
    if (row === 28 || row === 29) {
      return {
        type: "waypoint",
        name: `Node #${cellToNodeId({ column: col, row }, widthCells)}`,
        zone: "North Arterial Crossway",
      };
    }
    if (row === 2 || row === 3) {
      return {
        type: "waypoint",
        name: `Node #${cellToNodeId({ column: col, row }, widthCells)}`,
        zone: "Outbound Express Highway",
      };
    }
    if (row === 36 || row === 37) {
      return {
        type: "waypoint",
        name: `Node #${cellToNodeId({ column: col, row }, widthCells)}`,
        zone: "Inbound Express Highway",
      };
    }
  } else {
    if (row === 9 || row === 10) {
      return {
        type: "waypoint",
        name: `Node #${cellToNodeId({ column: col, row }, widthCells)}`,
        zone: "Central Crossway",
      };
    }
    if (row === 2) {
      return {
        type: "waypoint",
        name: `Node #${cellToNodeId({ column: col, row }, widthCells)}`,
        zone: "Outbound Express Highway",
      };
    }
    if (row === heightCells - 3) {
      return {
        type: "waypoint",
        name: `Node #${cellToNodeId({ column: col, row }, widthCells)}`,
        zone: "Inbound Express Highway",
      };
    }
  }

  // Standard traversable waypoint
  return {
    type: "waypoint",
    name: `Node #${cellToNodeId({ column: col, row }, widthCells)}`,
    zone: "Storage Aisle",
  };
}

/**
 * Derives comprehensive topological graph (nodes + directed/bidirectional edges) from a RasterMap.
 */
export function deriveMapTopology(map: RasterMap): MapTopology {
  const { widthCells, heightCells, resolutionMeters, origin, cells } = map;
  const isMegaLayout = widthCells >= 64;
  const nodes: MapNode[] = [];
  const nodeMap = new Map<number, MapNode>();
  const edges: MapEdge[] = [];
  const edgeMap = new Map<string, MapEdge>();
  const nodeOutgoingEdges = new Map<number, MapEdge[]>();
  const nodeIncomingEdges = new Map<number, MapEdge[]>();

  // 1. Build Nodes
  for (let row = 0; row < heightCells; row++) {
    for (let col = 0; col < widthCells; col++) {
      const id = cellToNodeId({ column: col, row }, widthCells);
      const isRawBlocked = cells[id] === 1;
      const worldCenter = cellToWorld(
        { column: col, row },
        resolutionMeters,
        origin,
      );
      const station = map.stationCatalog?.find(
        (station) => station.column === col && station.row === row,
      );
      const inferred = classifyNodeType(
        col,
        row,
        isRawBlocked,
        widthCells,
        heightCells,
      );

      const { type, name, zone, isTraversableOverride } =
        map.stationCatalog !== undefined
          ? {
              ...inferred,
              type:
                station?.type ??
                (["pick", "place", "charger"].includes(inferred.type)
                  ? ("waypoint" as const)
                  : inferred.type),
              name:
                station?.name ??
                (["pick", "place", "charger"].includes(inferred.type)
                  ? `Node #${id}`
                  : inferred.name),
              isTraversableOverride: !isRawBlocked,
            }
          : inferred;
      const isTraversable =
        isTraversableOverride !== undefined
          ? isTraversableOverride
          : !isRawBlocked;

      const node: MapNode = {
        id,
        column: col,
        row,
        xMeters: worldCenter.x,
        yMeters: worldCenter.y,
        type,
        name,
        isTraversable,
        zone,
      };

      nodes.push(node);
      nodeMap.set(id, node);
      nodeOutgoingEdges.set(id, []);
      nodeIncomingEdges.set(id, []);
    }
  }

  // Helper to add an edge
  const addEdge = (
    fromNode: MapNode,
    toNode: MapNode,
    direction: "bidirectional" | "forward" | "backward",
    type: "corridor" | "aisle" | "station_feeder" | "transfer",
  ) => {
    if (!fromNode.isTraversable || !toNode.isTraversable) return;

    const edgeId = `edge-${fromNode.id}->${toNode.id}`;
    if (edgeMap.has(edgeId)) return;

    const edge: MapEdge = {
      id: edgeId,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      fromColumn: fromNode.column,
      fromRow: fromNode.row,
      toColumn: toNode.column,
      toRow: toNode.row,
      direction,
      type,
      weightMeters: resolutionMeters,
    };

    edges.push(edge);
    edgeMap.set(edgeId, edge);

    nodeOutgoingEdges.get(fromNode.id)?.push(edge);
    nodeIncomingEdges.get(toNode.id)?.push(edge);

    if (direction === "bidirectional") {
      const reverseEdgeId = `edge-${toNode.id}->${fromNode.id}`;
      if (!edgeMap.has(reverseEdgeId)) {
        const reverseEdge: MapEdge = {
          id: reverseEdgeId,
          fromNodeId: toNode.id,
          toNodeId: fromNode.id,
          fromColumn: toNode.column,
          fromRow: toNode.row,
          toColumn: fromNode.column,
          toRow: fromNode.row,
          direction: "bidirectional",
          type,
          weightMeters: resolutionMeters,
        };
        edges.push(reverseEdge);
        edgeMap.set(reverseEdgeId, reverseEdge);
        nodeOutgoingEdges.get(toNode.id)?.push(reverseEdge);
        nodeIncomingEdges.get(fromNode.id)?.push(reverseEdge);
      }
    }
  };

  // 2. Build Edges connecting adjacent traversable nodes
  for (let row = 0; row < heightCells; row++) {
    for (let col = 0; col < widthCells; col++) {
      const currId = cellToNodeId({ column: col, row }, widthCells);
      const currNode = nodeMap.get(currId);
      if (!currNode || !currNode.isTraversable) continue;

      // Check East neighbor (col + 1, row)
      if (col + 1 < widthCells) {
        const eastId = cellToNodeId({ column: col + 1, row }, widthCells);
        const eastNode = nodeMap.get(eastId);
        if (eastNode && eastNode.isTraversable) {
          if (currNode.type === "charger" || eastNode.type === "charger") {
            // Charger docking feeder with adjacent aisle
            addEdge(currNode, eastNode, "bidirectional", "station_feeder");
          } else if (row === 0) {
            // Place Station Outflow & Inflow: straight-line Eastbound feeder
            addEdge(currNode, eastNode, "forward", "station_feeder");
          } else if (row === heightCells - 1) {
            // Top Place Station / Chute straight-line Westbound feeder
            addEdge(eastNode, currNode, "forward", "station_feeder");
          } else {
            const isEastbound = isMegaLayout
              ? row >= 1 && row <= 3
              : row === 1 || row === 2;
            const isWestbound = isMegaLayout
              ? row >= heightCells - 4 && row <= heightCells - 2
              : row === heightCells - 2 || row === heightCells - 3;
            const isCentralCrossway = isMegaLayout
              ? [12, 13, 20, 21, 28, 29].includes(row)
              : row === 9 || row === 10;

            if (isEastbound) {
              addEdge(currNode, eastNode, "forward", "corridor");
            } else if (isWestbound) {
              addEdge(eastNode, currNode, "forward", "corridor");
            } else if (isCentralCrossway) {
              addEdge(currNode, eastNode, "bidirectional", "corridor");
            } else {
              // Storage aisles cross connection
              addEdge(currNode, eastNode, "bidirectional", "aisle");
            }
          }
        }
      }

      // Check North neighbor (col, row + 1)
      if (row + 1 < heightCells) {
        const northId = cellToNodeId({ column: col, row: row + 1 }, widthCells);
        const northNode = nodeMap.get(northId);
        if (northNode && northNode.isTraversable) {
          if (currNode.type === "charger" || northNode.type === "charger") {
            // Dedicated charger bays do not connect vertically
          } else if (row === 0) {
            // Connection between row 0 (Place station / ramp) and row 1 (Buffer / ramp)
            if (currNode.type === "place") {
              addEdge(northNode, currNode, "bidirectional", "station_feeder");
            } else {
              addEdge(currNode, northNode, "forward", "station_feeder");
            }
          } else if (row === 1) {
            addEdge(currNode, northNode, "bidirectional", "station_feeder");
          } else if (row === heightCells - 2) {
            if (northNode.type === "place") {
              addEdge(currNode, northNode, "bidirectional", "station_feeder");
            } else {
              addEdge(northNode, currNode, "forward", "station_feeder");
            }
          } else if (row === heightCells - 3) {
            addEdge(currNode, northNode, "bidirectional", "station_feeder");
          } else if (isMegaLayout ? [12, 20, 28].includes(row) : row === 9) {
            // Arterial Crossway 2-lane switching
            addEdge(currNode, northNode, "bidirectional", "corridor");
          } else {
            // Directional Aisles: even columns flow North, odd columns flow South
            const isNorthbound = col % 2 === 0;
            if (isNorthbound) {
              addEdge(currNode, northNode, "forward", "aisle");
            } else {
              addEdge(northNode, currNode, "forward", "aisle");
            }
          }
        }
      }
    }
  }

  return {
    mapId: map.mapId,
    nodes,
    nodeMap,
    edges,
    edgeMap,
    nodeOutgoingEdges,
    nodeIncomingEdges,
  };
}

/**
 * Visual styling and localization metadata for specialized node types.
 */
export function getNodeTypeUiMeta(type: MapNodeType) {
  switch (type) {
    case "pick":
      return {
        labelKo: "피킹 지점 (Pick)",
        labelEn: "Pick Point",
        strokeColor: "#F59E0B", // Amber / Gold
        fillColor: "rgba(245, 158, 11, 0.15)",
        glowColor: "rgba(245, 158, 11, 0.4)",
        badgeBg: "bg-amber-500/10 dark:bg-amber-500/20",
        badgeText: "text-amber-600 dark:text-amber-400",
        badgeBorder: "border-amber-500/30",
      };
    case "place":
    case "workstation":
      return {
        labelKo: "플레이스 스테이션",
        labelEn: "Place Station",
        strokeColor: "#06B6D4", // Cyan
        fillColor: "rgba(6, 182, 212, 0.15)",
        glowColor: "rgba(6, 182, 212, 0.4)",
        badgeBg: "bg-cyan-500/10 dark:bg-cyan-500/20",
        badgeText: "text-cyan-600 dark:text-cyan-400",
        badgeBorder: "border-cyan-500/30",
      };
    case "chute":
      return {
        labelKo: "분류 플레이스 슈트",
        labelEn: "Place Chute",
        strokeColor: "#10B981", // Emerald
        fillColor: "rgba(16, 185, 129, 0.15)",
        glowColor: "rgba(16, 185, 129, 0.4)",
        badgeBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
        badgeText: "text-emerald-600 dark:text-emerald-400",
        badgeBorder: "border-emerald-500/30",
      };
    case "rack":
      return {
        labelKo: "보관 랙 (기둥 구조물)",
        labelEn: "Storage Rack (Pod Structure)",
        strokeColor: "#6366F1", // Indigo
        fillColor: "rgba(99, 102, 241, 0.22)",
        glowColor: "rgba(99, 102, 241, 0.35)",
        badgeBg: "bg-indigo-500/10 dark:bg-indigo-500/20",
        badgeText: "text-indigo-600 dark:text-indigo-400",
        badgeBorder: "border-indigo-500/30",
      };
    case "charger":
      return {
        labelKo: "충전소",
        labelEn: "Charging Bay",
        strokeColor: "#EAB308", // Yellow
        fillColor: "rgba(234, 179, 8, 0.15)",
        glowColor: "rgba(234, 179, 8, 0.4)",
        badgeBg: "bg-yellow-500/10 dark:bg-yellow-500/20",
        badgeText: "text-yellow-600 dark:text-yellow-400",
        badgeBorder: "border-yellow-500/30",
      };
    case "buffer":
      return {
        labelKo: "대기 버퍼",
        labelEn: "Buffer Queue",
        strokeColor: "#8B5CF6", // Purple
        fillColor: "rgba(139, 92, 246, 0.12)",
        glowColor: "rgba(139, 92, 246, 0.35)",
        badgeBg: "bg-purple-500/10 dark:bg-purple-500/20",
        badgeText: "text-purple-600 dark:text-purple-400",
        badgeBorder: "border-purple-500/30",
      };
    case "pillar":
      return {
        labelKo: "구조 기둥",
        labelEn: "Pillar",
        strokeColor: "#64748B", // Slate
        fillColor: "rgba(100, 116, 139, 0.25)",
        glowColor: "rgba(100, 116, 139, 0.3)",
        badgeBg: "bg-slate-500/10 dark:bg-slate-500/20",
        badgeText: "text-slate-600 dark:text-slate-400",
        badgeBorder: "border-slate-500/30",
      };
    case "waypoint":
    default:
      return {
        labelKo: "주행 통로",
        labelEn: "Transit Waypoint",
        strokeColor: "#0071E3", // Apple Blue
        fillColor: "rgba(0, 113, 227, 0.1)",
        glowColor: "rgba(0, 113, 227, 0.3)",
        badgeBg: "bg-blue-500/10 dark:bg-blue-500/20",
        badgeText: "text-[#0071E3] dark:text-[#2997FF]",
        badgeBorder: "border-blue-500/30",
      };
  }
}
