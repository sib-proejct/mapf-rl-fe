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
import {
  Bot,
  AlertTriangle,
  Wifi,
  WifiOff,
  Grid,
  Network,
  Table,
  Search,
  Zap,
  ShieldAlert,
  PauseCircle,
  Inbox,
  Package,
  Boxes,
  MapPin,
  ArrowRight,
  ArrowLeftRight,
} from "lucide-react";

export interface AccessibleMapListProps {
  viewMode?: "canvas" | "graph" | "accessible";
  onToggleViewMode?: (mode: "canvas" | "graph" | "accessible") => void;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
}

export type TableTab = "robots" | "nodes" | "edges";

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
    selectedNodeId,
    setSelectedNodeId,
    topology,
  } = useOperations();

  const [activeTab, setActiveTab] = useState<TableTab>("robots");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>("ALL");

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

  // Filtered Robots
  const filteredRobots = useMemo(() => {
    if (!searchQuery.trim()) return robots;
    const q = searchQuery.toLowerCase().trim();
    return robots.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.operationalState.toLowerCase().includes(q) ||
        r.connectivity.toLowerCase().includes(q) ||
        r.safety.toLowerCase().includes(q),
    );
  }, [robots, searchQuery]);

  // Filtered Nodes
  const filteredNodes = useMemo(() => {
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

    return list;
  }, [topology, nodeTypeFilter, searchQuery]);

  // Filtered Edges
  const filteredEdges = useMemo(() => {
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

    return list;
  }, [topology, searchQuery]);

  return (
    <section
      aria-labelledby="a11y-table-heading"
      className="apple-card h-full min-h-[400px] overflow-hidden flex flex-col transition-colors duration-300 select-none"
    >
      {/* 1. Top Glassmorphic Controls Toolbar */}
      <div className="shrink-0 p-3 sm:px-4 sm:py-2.5 flex flex-wrap items-center justify-between gap-2.5 border-b border-black/[0.05] dark:border-white/[0.06] bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-md z-10">
        {/* Left: Viewport Info & Mode Switcher */}
        <div className="flex items-center gap-2.5 text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex-wrap">
          {headerLeft}
          {headerLeft && (
            <div className="h-4 w-[1px] bg-black/10 dark:bg-white/15 hidden sm:block" />
          )}

          {/* Mode Switcher */}
          {onToggleViewMode && (
            <div className="inline-flex bg-[#F2F4F6] dark:bg-[#252528] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] items-center gap-0.5 text-xs">
              <button
                onClick={() => onToggleViewMode("canvas")}
                className={`px-3 py-1 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "canvas"
                    ? "bg-white dark:bg-[#1C1C1E] text-[#0071E3] dark:text-[#2997FF] font-bold shadow-xs"
                    : "text-[#8B95A1] dark:text-[#86868B] hover:text-[#191F28] dark:hover:text-[#F5F5F7]"
                }`}
                title={t("mapCanvasView")}
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">2D Canvas (Fast)</span>
              </button>

              <button
                onClick={() => onToggleViewMode("graph")}
                className={`px-3 py-1 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "graph"
                    ? "bg-white dark:bg-[#1C1C1E] text-[#0071E3] dark:text-[#2997FF] font-bold shadow-xs"
                    : "text-[#8B95A1] dark:text-[#86868B] hover:text-[#191F28] dark:hover:text-[#F5F5F7]"
                }`}
                title={t("mapGraphView")}
              >
                <Network className="w-3.5 h-3.5 text-[#34C759] dark:text-[#30D158]" />
                <span className="hidden sm:inline">Graph Topology</span>
              </button>

              <button
                onClick={() => onToggleViewMode("accessible")}
                className={`px-3 py-1 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "accessible"
                    ? "bg-white dark:bg-[#1C1C1E] text-[#0071E3] dark:text-[#2997FF] font-bold shadow-xs"
                    : "text-[#8B95A1] dark:text-[#86868B] hover:text-[#191F28] dark:hover:text-[#F5F5F7]"
                }`}
                title={t("mapAccessibleView")}
              >
                <Table className="w-3.5 h-3.5 text-[#FF9F0A]" />
                <span className="hidden sm:inline">Table View</span>
              </button>
            </div>
          )}

          <span className="text-[#D2D2D7] dark:text-[#3A3A3C] hidden lg:inline">
            |
          </span>
          <span className="font-mono text-[11px] text-[#86868B] tabular-nums hidden lg:inline">
            {widthCells}×{heightCells} cells ({formatDistanceMeters(resolution)}
            /cell) · {blockedCount} Blocked · {traversableCount} Open
          </span>
        </div>

        {/* Right: Tab Navigation Switcher & Header Right */}
        <div className="flex flex-wrap items-center gap-2">
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
              <Network className="w-3.5 h-3.5" />
              <span>
                {t("a11yTabEdges")} ({topology?.edges.length || 0})
              </span>
            </button>
          </div>

          {headerRight && (
            <>
              <div className="h-4 w-[1px] bg-black/10 dark:bg-white/15 mx-1" />
              {headerRight}
            </>
          )}
        </div>
      </div>

      {/* 2. Interactive Search & Category Filter Subheader */}
      <div className="px-4 py-2 bg-[#FBFBFD] dark:bg-[#161618] border-b border-black/[0.04] dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("a11ySearchPlaceholder")}
            className="w-full pl-8 pr-3 py-1 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-black/[0.06] dark:border-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#86868B] focus:outline-none focus:ring-1 focus:ring-[#0071E3]"
          />
        </div>

        {/* Filter Pills for Nodes tab */}
        {activeTab === "nodes" && (
          <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
            {[
              { id: "ALL", label: t("a11yFilterAll") },
              { id: "workstation", label: "Pick WS" },
              { id: "chute", label: "Place Chute" },
              { id: "rack", label: t("a11yFilterRacks") },
              { id: "charger", label: t("a11yFilterChargers") },
              { id: "buffer", label: t("a11yFilterBuffers") },
              { id: "pillar", label: t("a11yFilterPillars") },
              { id: "waypoint", label: "Waypoints" },
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
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColRobotId")}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColPose")}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColCell")}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColState")}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColConnectivity")}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColSafety")}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColOrder")}
                </th>
                <th scope="col" className="py-2.5 px-3 text-right">
                  {t("a11yColAction")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
              {filteredRobots.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-[#86868B] font-medium"
                  >
                    {t("robotNoRobots")}
                  </td>
                </tr>
              ) : (
                filteredRobots.map((robot) => {
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
                                : robot.operationalState === "HELD"
                                  ? "bg-[#FF9500] dark:bg-[#FF9F0A]"
                                  : "bg-[#86868B]"
                            }`}
                          />
                          <span
                            className={`font-semibold ${
                              isExecuting
                                ? "text-[#34C759] dark:text-[#30D158]"
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
                          {!isDisconnected ? (
                            <Wifi className="w-3.5 h-3.5 text-[#34C759] dark:text-[#30D158]" />
                          ) : (
                            <WifiOff className="w-3.5 h-3.5 text-[#FF3B30] dark:text-[#FF453A]" />
                          )}
                          <span
                            className={`font-semibold ${
                              isDisconnected
                                ? "text-[#FF3B30] dark:text-[#FF453A]"
                                : "text-[#86868B]"
                            }`}
                          >
                            {robot.connectivity}
                          </span>
                        </div>
                      </td>

                      {/* Safety */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          {robot.safety !== "NORMAL" &&
                          robot.safety !== "WAIT" ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-[#FF9500] dark:text-[#FF9F0A]" />
                          ) : null}
                          <span
                            className={`font-semibold ${
                              robot.safety !== "NORMAL"
                                ? "text-[#FF9500] dark:text-[#FF9F0A]"
                                : "text-[#86868B]"
                            }`}
                          >
                            {robot.safety}
                          </span>
                        </div>
                      </td>

                      {/* Order & Goal */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#86868B] whitespace-nowrap">
                        {assignedOrder ? (
                          <span className="text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold">
                            {assignedOrder.id}{" "}
                            {goal
                              ? `→ (${goal.goalColumn}, ${goal.goalRow})`
                              : ""}
                          </span>
                        ) : (
                          <span className="text-[#86868B] font-normal">-</span>
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
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColNodeId")}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColNodeType")}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColNodeName")}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColCell")}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColPose")}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColConnectedEdges")}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColNodeStatus")}
                </th>
                <th scope="col" className="py-2.5 px-3 text-right">
                  {t("a11yColAction")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
              {filteredNodes.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-[#86868B] font-medium"
                  >
                    No matching warehouse nodes found.
                  </td>
                </tr>
              ) : (
                filteredNodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
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
                            setSelectedNodeId(node.id);
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#0071E3] dark:bg-[#2997FF] text-white shadow-xs"
                              : "bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#0071E3] dark:hover:text-white text-[#1D1D1F] dark:text-[#F5F5F7]"
                          }`}
                        >
                          {isSelected ? "Inspecting" : "Inspect"}
                        </button>
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
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColEdgeId")}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColFromNode")}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColDirection")}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColToNode")}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {t("a11yColEdgeType")}
                </th>
                <th scope="col" className="py-2.5 px-3 text-right">
                  {t("a11yColWeight")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
              {filteredEdges.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-[#86868B] font-medium"
                  >
                    No matching topology edges found.
                  </td>
                </tr>
              ) : (
                filteredEdges.map((edge) => (
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
              ? `${filteredRobots.length} robots listed`
              : activeTab === "nodes"
                ? `${filteredNodes.length} nodes listed (${rackNodes.length} Racks, ${stationNodes.length} Stations)`
                : `${filteredEdges.length} edges listed`}
          </span>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-[#86868B]">
          Cartesian Right-Handed (+X East, +Y North · 1.0m Grid)
        </span>
      </div>
    </section>
  );
};
