import { NodeMoveConfirmation } from "./NodeMoveConfirmation.tsx";
import React, { useState, useMemo } from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import {
  worldToCell,
  cellToNodeId,
  formatCoordinates,
} from "../../utils/coordinates/coordinates.ts";
import {
  formatAngleRadians,
  formatDistanceMeters,
} from "../../utils/units/units.ts";
import { getNodeTypeUiMeta } from "../../utils/map/topology.ts";
import { MapCanvasHeader } from "./MapCanvasHeader.tsx";
import {
  Bot,
  AlertTriangle,
  Wifi,
  WifiOff,
  Search,
  Boxes,
  ArrowRight,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";

export interface AccessibleMapListProps {
  viewMode?: "canvas" | "graph" | "accessible";
  onToggleViewMode?: (mode: "canvas" | "graph" | "accessible") => void;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
}

export type TableTab = "robots" | "nodes" | "edges";
export type SortDirection = "asc" | "desc";

export type RobotSortKey =
  | "id"
  | "pose"
  | "cell"
  | "state"
  | "connectivity"
  | "safety"
  | "order";

export type NodeSortKey =
  | "id"
  | "type"
  | "name"
  | "cell"
  | "pose"
  | "edges"
  | "status";

export type EdgeSortKey =
  | "id"
  | "from"
  | "direction"
  | "to"
  | "type"
  | "weight";

interface SortableHeaderProps<T extends string> {
  sortKey: T;
  currentSortKey: T;
  sortDirection: SortDirection;
  onSort: (key: T) => void;
  className?: string;
  align?: "left" | "right" | "center";
  children: React.ReactNode;
}

function SortableHeader<T extends string>({
  sortKey,
  currentSortKey,
  sortDirection,
  onSort,
  className = "",
  align = "left",
  children,
}: SortableHeaderProps<T>) {
  const isActive = currentSortKey === sortKey;
  const ariaSort = isActive
    ? sortDirection === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      onClick={() => onSort(sortKey)}
      className={`py-2.5 px-3 select-none cursor-pointer transition-colors group/th hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] ${
        isActive
          ? "text-[#0071E3] dark:text-[#2997FF] font-semibold"
          : "text-[#86868B]"
      } ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}
    >
      <div
        className={`inline-flex items-center gap-1 ${
          align === "right" ? "justify-end flex-row-reverse" : "justify-start"
        }`}
      >
        <span>{children}</span>
        <span className="shrink-0 transition-opacity">
          {isActive ? (
            sortDirection === "asc" ? (
              <ArrowUp className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#2997FF]" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#2997FF]" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-black/20 dark:text-white/20 opacity-0 group-hover/th:opacity-100" />
          )}
        </span>
      </div>
    </th>
  );
}

export const AccessibleMapList: React.FC<AccessibleMapListProps> = ({
  viewMode = "accessible",
  onToggleViewMode,
  headerLeft,
  headerRight,
}) => {
  const { t, language } = useAppConfig();
  const {
    snapshot,
    selectedRobotId,
    setSelectedRobotId,
    robotPlacementActive,
    robotPlacementNodeIds,
    selectedNodeId,
    setSelectedNodeId,
    clickNode,
    topology,
  } = useOperations();

  const [activeTab, setActiveTab] = useState<TableTab>("robots");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>("ALL");

  // Sorting state for each tab
  const [robotSortKey, setRobotSortKey] = useState<RobotSortKey>("id");
  const [robotSortDir, setRobotSortDir] = useState<SortDirection>("asc");

  const [nodeSortKey, setNodeSortKey] = useState<NodeSortKey>("id");
  const [nodeSortDir, setNodeSortDir] = useState<SortDirection>("asc");

  const [edgeSortKey, setEdgeSortKey] = useState<EdgeSortKey>("id");
  const [edgeSortDir, setEdgeSortDir] = useState<SortDirection>("asc");

  const handleRobotSort = (key: RobotSortKey) => {
    if (robotSortKey === key) {
      setRobotSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setRobotSortKey(key);
      setRobotSortDir("asc");
    }
  };

  const handleNodeSort = (key: NodeSortKey) => {
    if (nodeSortKey === key) {
      setNodeSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setNodeSortKey(key);
      setNodeSortDir("asc");
    }
  };

  const handleEdgeSort = (key: EdgeSortKey) => {
    if (edgeSortKey === key) {
      setEdgeSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setEdgeSortKey(key);
      setEdgeSortDir("asc");
    }
  };

  const map = snapshot?.map;
  const robots = useMemo(() => snapshot?.robots || [], [snapshot?.robots]);
  const orders = useMemo(() => snapshot?.orders || [], [snapshot?.orders]);

  // 2D Canvas standard dimension standards
  const resolution = map?.resolutionMeters || 1.0;
  const origin = map?.origin || { xMeters: 0, yMeters: 0 };
  const widthCells = map?.widthCells || 32;
  const heightCells = map?.heightCells || 20;

  const blockedCount = useMemo(
    () => map?.cells?.filter((c) => c === 1).length || 0,
    [map?.cells],
  );
  const traversableCount = useMemo(
    () => map?.cells?.filter((c) => c === 0).length || 0,
    [map?.cells],
  );

  const stationNodes = useMemo(() => {
    if (!topology) return [];
    return topology.nodes.filter(
      (n) => n.type !== "waypoint" && n.type !== "pillar" && n.type !== "rack",
    );
  }, [topology]);

  const rackNodes = useMemo(() => {
    if (!topology) return [];
    return topology.nodes.filter((n) => n.type === "rack");
  }, [topology]);

  // Filtered and Sorted Robots
  const filteredAndSortedRobots = useMemo(() => {
    let list = robots;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.operationalState.toLowerCase().includes(q) ||
          r.connectivity.toLowerCase().includes(q) ||
          r.safety.toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) => {
      let comparison = 0;
      switch (robotSortKey) {
        case "id":
          comparison = a.id.localeCompare(b.id, undefined, {
            numeric: true,
            sensitivity: "base",
          });
          break;
        case "pose":
          comparison =
            a.pose.xMeters === b.pose.xMeters
              ? a.pose.yMeters - b.pose.yMeters
              : a.pose.xMeters - b.pose.xMeters;
          break;
        case "cell": {
          const cellA = worldToCell(
            { x: a.pose.xMeters, y: a.pose.yMeters },
            resolution,
            origin,
          );
          const cellB = worldToCell(
            { x: b.pose.xMeters, y: b.pose.yMeters },
            resolution,
            origin,
          );
          const nodeA = cellToNodeId(cellA, widthCells);
          const nodeB = cellToNodeId(cellB, widthCells);
          comparison = nodeA - nodeB;
          break;
        }
        case "state":
          comparison = a.operationalState.localeCompare(b.operationalState);
          break;
        case "connectivity":
          comparison = a.connectivity.localeCompare(b.connectivity);
          break;
        case "safety":
          comparison = a.safety.localeCompare(b.safety);
          break;
        case "order": {
          const orderA = a.currentOrderId || "";
          const orderB = b.currentOrderId || "";
          comparison = orderA.localeCompare(orderB, undefined, {
            numeric: true,
          });
          break;
        }
        default:
          comparison = 0;
      }
      return robotSortDir === "asc" ? comparison : -comparison;
    });
  }, [
    robots,
    searchQuery,
    robotSortKey,
    robotSortDir,
    resolution,
    origin,
    widthCells,
  ]);

  // Filtered and Sorted Nodes
  const filteredAndSortedNodes = useMemo(() => {
    if (!topology) return [];
    let list = topology.nodes;

    if (nodeTypeFilter !== "ALL") {
      list = list.filter((n) => n.type === nodeTypeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (n) =>
          String(n.id).includes(q) ||
          n.name.toLowerCase().includes(q) ||
          (n.zone || "").toLowerCase().includes(q) ||
          n.type.toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) => {
      let comparison = 0;
      switch (nodeSortKey) {
        case "id":
          comparison = a.id - b.id;
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "name":
          comparison = a.name.localeCompare(b.name, undefined, {
            numeric: true,
          });
          break;
        case "cell":
          comparison =
            a.column === b.column ? a.row - b.row : a.column - b.column;
          break;
        case "pose":
          comparison =
            a.xMeters === b.xMeters
              ? a.yMeters - b.yMeters
              : a.xMeters - b.xMeters;
          break;
        case "edges": {
          const outgoingA = topology.nodeOutgoingEdges.get(a.id)?.length || 0;
          const incomingA = topology.nodeIncomingEdges.get(a.id)?.length || 0;
          const outgoingB = topology.nodeOutgoingEdges.get(b.id)?.length || 0;
          const incomingB = topology.nodeIncomingEdges.get(b.id)?.length || 0;
          comparison = outgoingA + incomingA - (outgoingB + incomingB);
          break;
        }
        case "status": {
          const isOccupiedA = robots.some((r) => {
            const rc = worldToCell(
              { x: r.pose.xMeters, y: r.pose.yMeters },
              resolution,
              origin,
            );
            return rc.column === a.column && rc.row === a.row;
          });
          const isOccupiedB = robots.some((r) => {
            const rc = worldToCell(
              { x: r.pose.xMeters, y: r.pose.yMeters },
              resolution,
              origin,
            );
            return rc.column === b.column && rc.row === b.row;
          });
          const valA = isOccupiedA ? 2 : !a.isTraversable ? 1 : 0;
          const valB = isOccupiedB ? 2 : !b.isTraversable ? 1 : 0;
          comparison = valA - valB;
          break;
        }
        default:
          comparison = 0;
      }
      return nodeSortDir === "asc" ? comparison : -comparison;
    });
  }, [
    topology,
    nodeTypeFilter,
    searchQuery,
    nodeSortKey,
    nodeSortDir,
    robots,
    resolution,
    origin,
  ]);

  // Filtered and Sorted Edges
  const filteredAndSortedEdges = useMemo(() => {
    if (!topology) return [];
    let list = topology.edges;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.id.toLowerCase().includes(q) ||
          String(e.fromNodeId).includes(q) ||
          String(e.toNodeId).includes(q) ||
          e.type.toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) => {
      let comparison = 0;
      switch (edgeSortKey) {
        case "id":
          comparison = a.id.localeCompare(b.id, undefined, { numeric: true });
          break;
        case "from":
          comparison = a.fromNodeId - b.fromNodeId;
          break;
        case "direction":
          comparison = a.direction.localeCompare(b.direction);
          break;
        case "to":
          comparison = a.toNodeId - b.toNodeId;
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "weight":
          comparison = a.weightMeters - b.weightMeters;
          break;
        default:
          comparison = 0;
      }
      return edgeSortDir === "asc" ? comparison : -comparison;
    });
  }, [topology, searchQuery, edgeSortKey, edgeSortDir]);

  return (
    <section
      aria-labelledby="a11y-table-heading"
      className="apple-card h-full min-h-[400px] overflow-hidden flex flex-col transition-colors duration-300 select-none"
    >
      {/* 1. Top Glassmorphic Controls Toolbar */}
      <MapCanvasHeader
        viewMode={viewMode}
        onToggleViewMode={onToggleViewMode}
        headerLeft={headerLeft}
        headerRight={headerRight}
      >
        {/* Table Entity Tabs */}
        <div className="inline-flex bg-[#F2F4F6] dark:bg-[#252528] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] items-center gap-0.5 text-xs">
          <button
            onClick={() => setActiveTab("robots")}
            className={`px-3 py-1 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "robots"
                ? "bg-white dark:bg-[#1C1C1E] text-[#0071E3] dark:text-[#2997FF] font-bold shadow-xs"
                : "text-[#8B95A1] dark:text-[#86868B] hover:text-[#191F28] dark:hover:text-[#F5F5F7]"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>
              {t("a11yTabRobots")} ({robots.length})
            </span>
          </button>

          <button
            onClick={() => setActiveTab("nodes")}
            className={`px-3 py-1 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "nodes"
                ? "bg-white dark:bg-[#1C1C1E] text-[#0071E3] dark:text-[#2997FF] font-bold shadow-xs"
                : "text-[#8B95A1] dark:text-[#86868B] hover:text-[#191F28] dark:hover:text-[#F5F5F7]"
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>
              {t("a11yTabNodes")} ({topology?.nodes.length || 0})
            </span>
          </button>

          <button
            onClick={() => setActiveTab("edges")}
            className={`px-3 py-1 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "edges"
                ? "bg-white dark:bg-[#1C1C1E] text-[#0071E3] dark:text-[#2997FF] font-bold shadow-xs"
                : "text-[#8B95A1] dark:text-[#86868B] hover:text-[#191F28] dark:hover:text-[#F5F5F7]"
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>
              {t("a11yTabEdges")} ({topology?.edges.length || 0})
            </span>
          </button>
        </div>
      </MapCanvasHeader>

      {/* 2. Secondary Filter & Search Bar */}
      <div className="shrink-0 px-3 sm:px-4 py-2 border-b border-black/[0.05] dark:border-white/[0.06] bg-[#FBFBFD] dark:bg-[#161618] flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Search Filter Input */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === "robots"
                ? t("a11ySearchRobotsPlaceholder")
                : activeTab === "nodes"
                  ? t("a11ySearchNodesPlaceholder")
                  : t("a11ySearchEdgesPlaceholder")
            }
            className="w-full pl-8 pr-3 py-1 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#86868B] focus:outline-hidden focus:border-[#0071E3] dark:focus:border-[#2997FF] text-xs transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
            >
              ✕
            </button>
          )}
        </div>

        {/* Node Sub-Type Filter Tags (Only for Nodes tab) */}
        {activeTab === "nodes" && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {[
              { id: "ALL", label: t("a11yFilterAllNodes") },
              { id: "pick", label: t("a11yFilterPick") },
              { id: "drop", label: t("a11yFilterDrop") },
              { id: "rack", label: t("a11yFilterRacks") },
              { id: "charger", label: t("a11yFilterChargers") },
              { id: "buffer", label: t("a11yFilterBuffers") },
              { id: "pillar", label: t("a11yFilterPillars") },
              { id: "waypoint", label: t("a11yFilterWaypoints") },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setNodeTypeFilter(filter.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
                  nodeTypeFilter === filter.id
                    ? "bg-[#0071E3] text-white font-bold shadow-xs"
                    : "bg-black/5 dark:bg-white/5 text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Table Container */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto bg-white dark:bg-[#1C1C1E]">
        {activeTab === "robots" && (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-black/[0.05] dark:border-white/[0.06] font-medium text-[#86868B] bg-[#FBFBFD] dark:bg-[#161618] sticky top-0 z-10 whitespace-nowrap">
                <SortableHeader
                  sortKey="id"
                  currentSortKey={robotSortKey}
                  sortDirection={robotSortDir}
                  onSort={handleRobotSort}
                >
                  {t("a11yColRobotId")}
                </SortableHeader>
                <SortableHeader
                  sortKey="pose"
                  currentSortKey={robotSortKey}
                  sortDirection={robotSortDir}
                  onSort={handleRobotSort}
                >
                  {t("a11yColPose")}
                </SortableHeader>
                <SortableHeader
                  sortKey="cell"
                  currentSortKey={robotSortKey}
                  sortDirection={robotSortDir}
                  onSort={handleRobotSort}
                >
                  {t("a11yColCell")}
                </SortableHeader>
                <SortableHeader
                  sortKey="state"
                  currentSortKey={robotSortKey}
                  sortDirection={robotSortDir}
                  onSort={handleRobotSort}
                >
                  {t("a11yColState")}
                </SortableHeader>
                <SortableHeader
                  sortKey="connectivity"
                  currentSortKey={robotSortKey}
                  sortDirection={robotSortDir}
                  onSort={handleRobotSort}
                >
                  {t("a11yColConnectivity")}
                </SortableHeader>
                <SortableHeader
                  sortKey="safety"
                  currentSortKey={robotSortKey}
                  sortDirection={robotSortDir}
                  onSort={handleRobotSort}
                >
                  {t("a11yColSafety")}
                </SortableHeader>
                <SortableHeader
                  sortKey="order"
                  currentSortKey={robotSortKey}
                  sortDirection={robotSortDir}
                  onSort={handleRobotSort}
                >
                  {t("a11yColOrder")}
                </SortableHeader>
                <th scope="col" className="py-2.5 px-3 text-right">
                  {t("a11yColAction")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
              {filteredAndSortedRobots.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-[#86868B] font-medium"
                  >
                    {t("robotNoRobots")}
                  </td>
                </tr>
              ) : (
                filteredAndSortedRobots.map((robot) => {
                  const isSelected = robot.id === selectedRobotId;
                  const cell = worldToCell(
                    { x: robot.pose.xMeters, y: robot.pose.yMeters },
                    resolution,
                    origin,
                  );

                  const assignedOrder = orders.find(
                    (o) =>
                      o.id === robot.currentOrderId ||
                      o.assignments.some((a) => a.robotId === robot.id),
                  );

                  const goal = assignedOrder?.assignments.find(
                    (a) => a.robotId === robot.id,
                  );

                  const isExecuting = robot.operationalState === "EXECUTING";
                  const isDisconnected = robot.connectivity === "DISCONNECTED";

                  return (
                    <tr
                      key={`a11y-robot-${robot.id}`}
                      onClick={() => setSelectedRobotId(robot.id)}
                      className={`transition-colors cursor-pointer group ${
                        isSelected
                          ? "bg-[#0071E3]/10 dark:bg-[#2997FF]/15 font-medium"
                          : "hover:bg-[#F5F5F7]/80 dark:hover:bg-[#2C2C2E]/60"
                      }`}
                    >
                      {/* Robot ID */}
                      <td className="py-2.5 px-3 font-mono font-bold text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:text-[#0071E3] dark:group-hover:text-[#2997FF] whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Bot className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#2997FF]" />
                          <span>{robot.id}</span>
                        </div>
                      </td>

                      {/* Pose */}
                      <td className="py-2.5 px-3 font-mono tabular-nums text-[#86868B] whitespace-nowrap">
                        {formatCoordinates(
                          robot.pose.xMeters,
                          robot.pose.yMeters,
                        )}{" "}
                        • {formatAngleRadians(robot.pose.yawRadians)}
                      </td>

                      {/* Cell & Node */}
                      <td className="py-2.5 px-3 font-mono tabular-nums text-[#86868B] whitespace-nowrap">
                        <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          Node {cellToNodeId(cell, widthCells)}
                        </span>{" "}
                        <span className="text-[11px]">
                          ({cell.column}, {cell.row})
                        </span>
                      </td>

                      {/* State */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isExecuting
                                ? "bg-[#34C759]"
                                : robot.operationalState === "CHARGING"
                                  ? "bg-[#FF9F0A] dark:bg-[#FFD60A]"
                                  : robot.operationalState === "HELD"
                                    ? "bg-[#FF9500] dark:bg-[#FF9F0A]"
                                    : "bg-[#86868B]"
                            }`}
                          />
                          <span
                            className={`font-semibold ${
                              isExecuting
                                ? "text-[#34C759] dark:text-[#30D158]"
                                : robot.operationalState === "CHARGING"
                                  ? "text-[#B25000] dark:text-[#FFD60A]"
                                  : robot.operationalState === "HELD"
                                    ? "text-[#FF9500] dark:text-[#FF9F0A]"
                                    : "text-[#86868B]"
                            }`}
                          >
                            {robot.operationalState}
                          </span>
                        </div>
                      </td>

                      {/* Connectivity */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          {isDisconnected ? (
                            <>
                              <WifiOff className="w-3.5 h-3.5 text-[#FF3B30] dark:text-[#FF453A]" />
                              <span className="font-medium text-[#FF3B30] dark:text-[#FF453A]">
                                Disconnected
                              </span>
                            </>
                          ) : (
                            <>
                              <Wifi className="w-3.5 h-3.5 text-[#34C759] dark:text-[#30D158]" />
                              <span className="text-[#86868B]">Connected</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Safety */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {robot.safety === "NORMAL" ? (
                          <span className="text-[11px] font-semibold text-[#34C759] dark:text-[#30D158] bg-[#34C759]/10 px-2 py-0.5 rounded-full">
                            Normal
                          </span>
                        ) : robot.safety === "WAIT" ? (
                          <span className="text-[11px] font-bold text-[#FF9500] dark:text-[#FF9F0A] bg-[#FF9500]/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Wait
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-[#FF3B30] dark:text-[#FF453A] bg-[#FF3B30]/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {robot.safety}
                          </span>
                        )}
                      </td>

                      {/* Goal / Order */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {assignedOrder ? (
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="font-semibold text-[#0071E3] dark:text-[#2997FF]">
                              Order #{assignedOrder.id.slice(0, 8)}
                            </span>
                            {goal !== undefined && (
                              <span className="text-[#86868B]">
                                → Node{" "}
                                {cellToNodeId(
                                  {
                                    column: goal.goalColumn,
                                    row: goal.goalRow,
                                  },
                                  widthCells,
                                )}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#86868B] italic text-[11px]">
                            None
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRobotId(robot.id);
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#0071E3] dark:bg-[#2997FF] text-white shadow-xs"
                              : "bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#0071E3] dark:hover:bg-[#2997FF] hover:text-white text-[#1D1D1F] dark:text-[#F5F5F7]"
                          }`}
                        >
                          {isSelected ? "Selected" : "Select"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {activeTab === "nodes" && (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-black/[0.05] dark:border-white/[0.06] font-medium text-[#86868B] bg-[#FBFBFD] dark:bg-[#161618] sticky top-0 z-10 whitespace-nowrap">
                <SortableHeader
                  sortKey="id"
                  currentSortKey={nodeSortKey}
                  sortDirection={nodeSortDir}
                  onSort={handleNodeSort}
                >
                  {t("a11yColNodeId")}
                </SortableHeader>
                <SortableHeader
                  sortKey="type"
                  currentSortKey={nodeSortKey}
                  sortDirection={nodeSortDir}
                  onSort={handleNodeSort}
                >
                  {t("a11yColNodeType")}
                </SortableHeader>
                <SortableHeader
                  sortKey="name"
                  currentSortKey={nodeSortKey}
                  sortDirection={nodeSortDir}
                  onSort={handleNodeSort}
                >
                  {t("a11yColNodeName")}
                </SortableHeader>
                <SortableHeader
                  sortKey="cell"
                  currentSortKey={nodeSortKey}
                  sortDirection={nodeSortDir}
                  onSort={handleNodeSort}
                >
                  {t("a11yColCell")}
                </SortableHeader>
                <SortableHeader
                  sortKey="pose"
                  currentSortKey={nodeSortKey}
                  sortDirection={nodeSortDir}
                  onSort={handleNodeSort}
                >
                  {t("a11yColPose")}
                </SortableHeader>
                <SortableHeader
                  sortKey="edges"
                  currentSortKey={nodeSortKey}
                  sortDirection={nodeSortDir}
                  onSort={handleNodeSort}
                >
                  {t("a11yColConnectedEdges")}
                </SortableHeader>
                <SortableHeader
                  sortKey="status"
                  currentSortKey={nodeSortKey}
                  sortDirection={nodeSortDir}
                  onSort={handleNodeSort}
                >
                  {t("a11yColNodeStatus")}
                </SortableHeader>
                <th scope="col" className="py-2.5 px-3 text-right">
                  {t("a11yColAction")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
              {filteredAndSortedNodes.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-[#86868B] font-medium"
                  >
                    No matching warehouse nodes found.
                  </td>
                </tr>
              ) : (
                filteredAndSortedNodes.map((node) => {
                  const isSelected =
                    selectedNodeId === node.id ||
                    robotPlacementNodeIds.includes(node.id);
                  const uiMeta = getNodeTypeUiMeta(node.type);
                  const outgoing =
                    topology?.nodeOutgoingEdges.get(node.id) || [];
                  const incoming =
                    topology?.nodeIncomingEdges.get(node.id) || [];

                  const occupyingRobot = robots.find((r) => {
                    const robotCell = worldToCell(
                      { x: r.pose.xMeters, y: r.pose.yMeters },
                      resolution,
                      origin,
                    );
                    return (
                      robotCell.column === node.column &&
                      robotCell.row === node.row
                    );
                  });

                  const bufferOwner = robots.find(
                    (r) =>
                      r.bufferState?.mapId === map?.mapId &&
                      r.bufferState?.mapRevision === map?.revision &&
                      r.bufferState?.buffer?.column === node.column &&
                      r.bufferState?.buffer?.row === node.row,
                  );

                  return (
                    <tr
                      key={`a11y-node-${node.id}`}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`transition-colors cursor-pointer group ${
                        isSelected
                          ? "bg-[#0071E3]/10 dark:bg-[#2997FF]/15 font-medium"
                          : "hover:bg-[#F5F5F7]/80 dark:hover:bg-[#2C2C2E]/60"
                      }`}
                    >
                      {/* Node ID */}
                      <td className="py-2.5 px-3 font-mono font-bold text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:text-[#0071E3] dark:group-hover:text-[#2997FF] whitespace-nowrap">
                        #{node.id}
                      </td>

                      {/* Type Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${uiMeta.badgeBg} ${uiMeta.badgeText} ${uiMeta.badgeBorder}`}
                        >
                          {language === "ko" ? uiMeta.labelKo : uiMeta.labelEn}
                        </span>
                      </td>

                      {/* Name & Zone */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {node.name}
                        </span>{" "}
                        {bufferOwner && (
                          <span className="text-xs text-violet-600 dark:text-violet-400">
                            {bufferOwner.bufferState?.bufferOccupied
                              ? "버퍼 점유"
                              : "버퍼 예약"}
                            : {bufferOwner.id}
                          </span>
                        )}
                        <span className="text-[11px] text-[#86868B]">
                          ({node.zone})
                        </span>
                      </td>

                      {/* Grid Cell */}
                      <td className="py-2.5 px-3 font-mono text-[#86868B] tabular-nums whitespace-nowrap">
                        Col {node.column}, Row {node.row}
                      </td>

                      {/* World Coordinates */}
                      <td className="py-2.5 px-3 font-mono text-[#86868B] tabular-nums whitespace-nowrap">
                        {formatCoordinates(node.xMeters, node.yMeters)}
                      </td>

                      {/* Edges */}
                      <td className="py-2.5 px-3 font-mono text-[11px] tabular-nums whitespace-nowrap">
                        <span className="text-[#0071E3] dark:text-[#2997FF] font-bold">
                          ↑{outgoing.length}
                        </span>{" "}
                        /{" "}
                        <span className="text-[#34C759] dark:text-[#30D158] font-bold">
                          ↓{incoming.length}
                        </span>
                      </td>

                      {/* Occupancy */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {occupyingRobot ? (
                          <div className="inline-flex items-center gap-1 text-[#34C759] dark:text-[#30D158] font-bold">
                            <Bot className="w-3.5 h-3.5" />
                            <span>{occupyingRobot.id}</span>
                          </div>
                        ) : !node.isTraversable ? (
                          <span className="text-zinc-500 font-medium">
                            Blocked Pillar
                          </span>
                        ) : (
                          <span className="text-[#86868B] font-normal">
                            Free
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void clickNode(node.id);
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#0071E3] dark:bg-[#2997FF] text-white shadow-xs"
                              : "bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#0071E3] dark:hover:text-white text-[#1D1D1F] dark:text-[#F5F5F7]"
                          }`}
                        >
                          {robotPlacementActive
                            ? robotPlacementNodeIds.includes(node.id)
                              ? language === "ko"
                                ? "선택 해제"
                                : "Deselect"
                              : language === "ko"
                                ? "시작 위치 선택"
                                : "Select start"
                            : isSelected
                              ? "Inspecting"
                              : "Inspect"}
                        </button>
                        {isSelected && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="whitespace-normal text-left mt-2"
                          >
                            <NodeMoveConfirmation nodeId={node.id} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {activeTab === "edges" && (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-black/[0.05] dark:border-white/[0.06] font-medium text-[#86868B] bg-[#FBFBFD] dark:bg-[#161618] sticky top-0 z-10 whitespace-nowrap">
                <SortableHeader
                  sortKey="id"
                  currentSortKey={edgeSortKey}
                  sortDirection={edgeSortDir}
                  onSort={handleEdgeSort}
                >
                  {t("a11yColEdgeId")}
                </SortableHeader>
                <SortableHeader
                  sortKey="from"
                  currentSortKey={edgeSortKey}
                  sortDirection={edgeSortDir}
                  onSort={handleEdgeSort}
                >
                  {t("a11yColFromNode")}
                </SortableHeader>
                <SortableHeader
                  sortKey="direction"
                  currentSortKey={edgeSortKey}
                  sortDirection={edgeSortDir}
                  onSort={handleEdgeSort}
                >
                  {t("a11yColDirection")}
                </SortableHeader>
                <SortableHeader
                  sortKey="to"
                  currentSortKey={edgeSortKey}
                  sortDirection={edgeSortDir}
                  onSort={handleEdgeSort}
                >
                  {t("a11yColToNode")}
                </SortableHeader>
                <SortableHeader
                  sortKey="type"
                  currentSortKey={edgeSortKey}
                  sortDirection={edgeSortDir}
                  onSort={handleEdgeSort}
                >
                  {t("a11yColEdgeType")}
                </SortableHeader>
                <SortableHeader
                  sortKey="weight"
                  currentSortKey={edgeSortKey}
                  sortDirection={edgeSortDir}
                  onSort={handleEdgeSort}
                  align="right"
                >
                  {t("a11yColWeight")}
                </SortableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
              {filteredAndSortedEdges.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-[#86868B] font-medium"
                  >
                    No matching topology edges found.
                  </td>
                </tr>
              ) : (
                filteredAndSortedEdges.map((edge) => (
                  <tr
                    key={`a11y-edge-${edge.id}`}
                    className="hover:bg-[#F5F5F7]/80 dark:hover:bg-[#2C2C2E]/60 transition-colors"
                  >
                    {/* Edge ID */}
                    <td className="py-2.5 px-3 font-mono font-bold text-[#1D1D1F] dark:text-[#F5F5F7] whitespace-nowrap">
                      {edge.id}
                    </td>

                    {/* From */}
                    <td className="py-2.5 px-3 font-mono tabular-nums text-[#86868B] whitespace-nowrap">
                      <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        Node #{edge.fromNodeId}
                      </span>{" "}
                      <span>
                        ({edge.fromColumn}, {edge.fromRow})
                      </span>
                    </td>

                    {/* Direction */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {edge.direction === "bidirectional" ? (
                        <div className="inline-flex items-center gap-1 text-indigo-500 font-bold">
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                          <span>Bidirectional</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-[#0071E3] dark:text-[#2997FF] font-bold">
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>Unidirectional</span>
                        </div>
                      )}
                    </td>

                    {/* To */}
                    <td className="py-2.5 px-3 font-mono tabular-nums text-[#86868B] whitespace-nowrap">
                      <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        Node #{edge.toNodeId}
                      </span>{" "}
                      <span>
                        ({edge.toColumn}, {edge.toRow})
                      </span>
                    </td>

                    {/* Edge Type */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] capitalize">
                        {edge.type.replace("_", " ")}
                      </span>
                    </td>

                    {/* Weight */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#86868B] whitespace-nowrap">
                      {edge.weightMeters.toFixed(2)}m
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* 4. Desktop Table Footer */}
      <div className="shrink-0 p-2.5 sm:px-4 border-t border-black/[0.05] dark:border-white/[0.06] bg-[#FBFBFD] dark:bg-[#161618] flex items-center justify-between text-xs text-[#86868B]">
        <div className="flex items-center gap-3">
          <span>
            {activeTab === "robots"
              ? `${filteredAndSortedRobots.length} robots listed`
              : activeTab === "nodes"
                ? `${filteredAndSortedNodes.length} nodes listed (${rackNodes.length} Racks, ${stationNodes.length} Stations)`
                : `${filteredAndSortedEdges.length} edges listed`}
          </span>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-[#86868B]">
          Cartesian Right-Handed (+X East, +Y North · 1.0m Grid)
        </span>
      </div>
    </section>
  );
};
