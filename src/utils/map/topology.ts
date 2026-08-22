import type {
  RasterMap,
  MapNode,
  MapNodeType,
  MapEdge,
  MapTopology,
} from "../../domain/map/types.ts";
import { cellToWorld, cellToNodeId } from "../coordinates/coordinates.ts";

/**
 * Determines the specialized functional node type for a cell in the fulfillment center layout.
 */
export function classifyNodeType(
  col: number,
  row: number,
  isBlocked: boolean,
  widthCells: number,
  heightCells: number,
): { type: MapNodeType; name: string; zone: string } {
  if (isBlocked) {
    return {
      type: "pillar",
      name: `Pillar (${col}, ${row})`,
      zone: "Structure",
    };
  }

  // Workstations & Chutes column distribution
  const is32ColLayout = widthCells >= 24;
  const stationCols = is32ColLayout ? [3, 8, 13, 18, 23, 28] : [1, 5, 9, 13];

  const chuteCols = is32ColLayout ? [3, 8, 13, 18, 23, 28] : [2, 6, 10, 14];

  // 1. Workstations (WS - Pick): Bottom row designated stations (G2P Picking)
  if (row === 0 && stationCols.includes(col)) {
    const wsIdx = stationCols.indexOf(col) + 1;
    return {
      type: "workstation",
      name: `WS-0${wsIdx} (Pick Station)`,
      zone: "Picking Zone",
    };
  }

  // 2. Chutes (Place / Drop-off): Top row designated stations (Sortation / Inbound)
  if (row === heightCells - 1 && chuteCols.includes(col)) {
    const chuteIdx = chuteCols.indexOf(col) + 1;
    return {
      type: "chute",
      name: `Chute-0${chuteIdx} (Place Station)`,
      zone: "Sortation Zone",
    };
  }

  // 3. Chargers (Automated Docking Bays)
  // West Wall (col 0) & East Wall (col widthCells - 1)
  const isWestCharger =
    col === 0 &&
    (heightCells >= 16
      ? row === 6 || row === 9 || row === 13
      : row === 4 || row === 7);

  const isEastCharger =
    is32ColLayout &&
    col === widthCells - 1 &&
    (row === 6 || row === 9 || row === 13);

  if (isWestCharger) {
    const chgIdx =
      row === 6 ? 1 : row === 9 ? 2 : row === 13 ? 3 : row === 4 ? 1 : 2;
    return {
      type: "charger",
      name: `Charger-0${chgIdx}`,
      zone: "Charging Bay",
    };
  }

  if (isEastCharger) {
    const chgIdx = row === 6 ? 4 : row === 9 ? 5 : 6;
    return {
      type: "charger",
      name: `Charger-0${chgIdx}`,
      zone: "Charging Bay",
    };
  }

  // 4. Buffers (Inflow Queues & Staging Area)
  // WS Inflow Buffers on Row 1
  if (row === 1 && stationCols.includes(col)) {
    const wsIdx = stationCols.indexOf(col) + 1;
    return {
      type: "buffer",
      name: `Buffer-0${wsIdx} (WS-0${wsIdx} In-Buffer)`,
      zone: "WS Buffer Zone",
    };
  }

  // Chute Inflow Buffers on Row heightCells - 2
  if (row === heightCells - 2 && chuteCols.includes(col)) {
    const chuteIdx = chuteCols.indexOf(col) + 1;
    const bufNum = is32ColLayout ? chuteIdx + 6 : chuteIdx + 4;
    return {
      type: "buffer",
      name: `Buffer-${String(bufNum).padStart(2, "0")} (Chute-0${chuteIdx} In-Buffer)`,
      zone: "Chute Buffer Zone",
    };
  }

  // 5. Rack Storage Bays & Functional Warehouse Zones
  if (row >= 4 && row <= heightCells - 5) {
    if (row === 10) {
      return {
        type: "waypoint",
        name: `Node #${cellToNodeId({ column: col, row }, widthCells)}`,
        zone: "Central Crossway",
      };
    }

    // Determine dual-bay Rack columns
    let isRack = false;
    let bayCode = "";

    if (is32ColLayout) {
      if (col === 2 || col === 3) {
        isRack = true;
        bayCode = "A";
      } else if (col === 7 || col === 8) {
        isRack = true;
        bayCode = "B";
      } else if (col === 11 || col === 12) {
        isRack = true;
        bayCode = "C";
      } else if (col === 15 || col === 16) {
        isRack = true;
        bayCode = "D";
      } else if (col === 19 || col === 20) {
        isRack = true;
        bayCode = "E";
      } else if (col === 23 || col === 24) {
        isRack = true;
        bayCode = "F";
      } else if (col === 26 || col === 27) {
        isRack = true;
        bayCode = "G";
      }
    } else {
      if (col === 2 || col === 3) {
        isRack = true;
        bayCode = "A";
      } else if (col === 6 || col === 7) {
        isRack = true;
        bayCode = "B";
      } else if (col === 10 || col === 11) {
        isRack = true;
        bayCode = "C";
      }
    }

    if (isRack) {
      const isNorthBlock = row > 10;
      const blockName = isNorthBlock ? "North Block" : "South Block";
      // Calculate local rack index per bay (1 to 10)
      const rowOffset = isNorthBlock ? row - 10 : row - 3;
      const colOffset = is32ColLayout
        ? col === 3 ||
          col === 8 ||
          col === 12 ||
          col === 16 ||
          col === 20 ||
          col === 24 ||
          col === 27
          ? 1
          : 0
        : col % 2 === 1
          ? 1
          : 0;
      const rackNumber =
        (rowOffset - 1) * 2 + colOffset + (isNorthBlock ? 11 : 1);
      const rackTag = `${bayCode}-${String(rackNumber).padStart(2, "0")}`;

      return {
        type: "rack",
        name: `Rack ${rackTag} (Pod)`,
        zone: `Rack Bay ${bayCode} (${blockName})`,
      };
    }

    return {
      type: "waypoint",
      name: `Node #${cellToNodeId({ column: col, row }, widthCells)}`,
      zone: "Storage Aisle",
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

  // Standard traversable waypoint
  return {
    type: "waypoint",
    name: `Node #${cellToNodeId({ column: col, row }, widthCells)}`,
    zone: "Transit Lane",
  };
}

/**
 * Derives comprehensive topological graph (nodes + directed/bidirectional edges) from a RasterMap.
 */
export function deriveMapTopology(map: RasterMap): MapTopology {
  const { widthCells, heightCells, resolutionMeters, origin, cells } = map;
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
      const isBlocked = cells[id] === 1;
      const worldCenter = cellToWorld(
        { column: col, row },
        resolutionMeters,
        origin,
      );
      const { type, name, zone } = classifyNodeType(
        col,
        row,
        isBlocked,
        widthCells,
        heightCells,
      );

      const node: MapNode = {
        id,
        column: col,
        row,
        xMeters: worldCenter.x,
        yMeters: worldCenter.y,
        type,
        name,
        isTraversable: !isBlocked,
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
          if (currNode.type === "workstation") {
            // WS Outflow: exit to the East (col + 1, 0)
            addEdge(currNode, eastNode, "forward", "station_feeder");
          } else if (eastNode.type === "workstation") {
            // Cannot enter WS from the side (must enter from North buffer)
          } else if (currNode.type === "chute") {
            // Chute Outflow: exit to the East (col + 1, heightCells - 1)
            addEdge(currNode, eastNode, "forward", "station_feeder");
          } else if (eastNode.type === "chute") {
            // Cannot enter Chute from the side (must enter from South buffer)
          } else if (
            currNode.type === "charger" ||
            eastNode.type === "charger"
          ) {
            // Charger docking feeder with adjacent aisle
            addEdge(currNode, eastNode, "bidirectional", "station_feeder");
          } else {
            const isEastbound = row === 1 || row === 2;
            const isWestbound =
              row === heightCells - 2 || row === heightCells - 3;
            const isCentralCrossway = row === 10;

            if (isEastbound) {
              addEdge(currNode, eastNode, "forward", "corridor");
            } else if (isWestbound) {
              addEdge(eastNode, currNode, "forward", "corridor");
            } else if (isCentralCrossway) {
              addEdge(currNode, eastNode, "bidirectional", "corridor");
            } else {
              // Default bidirectional corridor connection in storage aisles
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
          } else if (currNode.type === "workstation") {
            // WS Inflow comes from North (Buffer at row 1 -> WS at row 0)
            addEdge(northNode, currNode, "forward", "station_feeder");
          } else if (northNode.type === "workstation") {
            // Handled above
          } else if (northNode.type === "chute") {
            // Chute Inflow comes from South (Buffer at height-2 -> Chute at top)
            addEdge(currNode, northNode, "forward", "station_feeder");
          } else if (currNode.type === "chute") {
            // Handled above
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
    case "rack":
      return {
        labelKo: "보관 랙 (Pod)",
        labelEn: "Storage Rack (Pod)",
        strokeColor: "#6366F1", // Indigo
        fillColor: "rgba(99, 102, 241, 0.15)",
        glowColor: "rgba(99, 102, 241, 0.4)",
        badgeBg: "bg-indigo-500/10 dark:bg-indigo-500/20",
        badgeText: "text-indigo-600 dark:text-indigo-400",
        badgeBorder: "border-indigo-500/30",
      };
    case "workstation":
      return {
        labelKo: "피킹 스테이션",
        labelEn: "Pick Station",
        strokeColor: "#06B6D4", // Cyan
        fillColor: "rgba(6, 182, 212, 0.15)",
        glowColor: "rgba(6, 182, 212, 0.4)",
        badgeBg: "bg-cyan-500/10 dark:bg-cyan-500/20",
        badgeText: "text-cyan-600 dark:text-cyan-400",
        badgeBorder: "border-cyan-500/30",
      };
    case "chute":
      return {
        labelKo: "분류 슈트",
        labelEn: "Place Chute",
        strokeColor: "#10B981", // Emerald
        fillColor: "rgba(16, 185, 129, 0.15)",
        glowColor: "rgba(16, 185, 129, 0.4)",
        badgeBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
        badgeText: "text-emerald-600 dark:text-emerald-400",
        badgeBorder: "border-emerald-500/30",
      };
    case "charger":
      return {
        labelKo: "충전소",
        labelEn: "Charging Bay",
        strokeColor: "#F59E0B", // Amber
        fillColor: "rgba(245, 158, 11, 0.15)",
        glowColor: "rgba(245, 158, 11, 0.4)",
        badgeBg: "bg-amber-500/10 dark:bg-amber-500/20",
        badgeText: "text-amber-600 dark:text-amber-400",
        badgeBorder: "border-amber-500/30",
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
