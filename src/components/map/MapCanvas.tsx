import React, { useState, useRef, useMemo, useEffect } from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  Eye,
  EyeOff,
  Flag,
  MapPin,
  Table,
  Bot,
  Zap,
  ShieldAlert,
  PauseCircle,
  Inbox,
  Package,
  GitBranch,
  X,
  Copy,
  Check,
  Grid,
  Network,
  Boxes,
} from "lucide-react";
import {
  worldToScreen,
  cellToWorld,
  worldToCell,
  cellToNodeId,
  yawToScreenRotationDegrees,
  formatCoordinates,
  type GridCell,
} from "../../utils/coordinates/coordinates.ts";
import { getNodeTypeUiMeta } from "../../utils/map/topology.ts";
import type { MapNode, MapEdge } from "../../domain/map/types.ts";
import { copyToClipboard } from "../../utils/ids/ids.ts";

export interface MapCanvasProps {
  viewMode?: "canvas" | "graph" | "accessible";
  onToggleViewMode?: (mode: "canvas" | "graph" | "accessible") => void;
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  viewMode = "canvas",
  onToggleViewMode,
}) => {
  const { t, language } = useAppConfig();
  const {
    snapshot,
    selectedRobotId,
    setSelectedRobotId,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    topology,
  } = useOperations();

  const map = snapshot?.map;
  const robots = snapshot?.robots || [];
  const orders = snapshot?.orders || [];

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  // Layer visibility toggles
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showGoals, setShowGoals] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showTrails, setShowTrails] = useState<boolean>(true);

  // Copied state for floating inspector
  const [copiedNodeId, setCopiedNodeId] = useState<boolean>(false);

  // Mouse coordinate tracker for world coord & node tooltip
  const [hoverCoord, setHoverCoord] = useState<{
    xMeters: number;
    yMeters: number;
    cell: GridCell;
    nodeId: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const widthCells = map?.widthCells || 16;
  const heightCells = map?.heightCells || 12;
  const resolution = map?.resolutionMeters || 0.5;
  const origin = map?.origin || { xMeters: 0, yMeters: 0 };

  const worldWidth = widthCells * resolution;
  const worldHeight = heightCells * resolution;

  // Base SVG viewBox dimension
  const baseWidth = 840;
  const baseHeight = (heightCells / widthCells) * baseWidth;

  const mapDim = useMemo(
    () => ({
      widthCells,
      heightCells,
      resolutionMeters: resolution,
      origin,
    }),
    [widthCells, heightCells, resolution, origin],
  );

  // Handle Pan Dragging vs Click Detection
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    setMouseDownPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left - pan.x;
      const clickY = e.clientY - rect.top - pan.y;

      const normX = clickX / (rect.width * zoom);
      const normY = clickY / (rect.height * zoom);

      if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
        const xMeters = origin.xMeters + normX * worldWidth;
        const yMeters = origin.yMeters + (1 - normY) * worldHeight;
        const rawCell = worldToCell(
          { x: xMeters, y: yMeters },
          resolution,
          origin,
        );
        const col = Math.max(0, Math.min(widthCells - 1, rawCell.column));
        const row = Math.max(0, Math.min(heightCells - 1, rawCell.row));
        const cell: GridCell = { column: col, row };
        const nodeId = cellToNodeId(cell, widthCells);

        setHoverCoord({
          xMeters,
          yMeters,
          cell,
          nodeId,
        });
      } else {
        setHoverCoord(null);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);

    // If mouse moved less than 6px, treat as a node click!
    const dist = Math.hypot(
      e.clientX - mouseDownPos.x,
      e.clientY - mouseDownPos.y,
    );
    if (dist < 6 && hoverCoord) {
      if (selectedNodeId === hoverCoord.nodeId) {
        setSelectedNodeId(null);
      } else {
        setSelectedNodeId(hoverCoord.nodeId);
      }
    }
  };

  // Zoom Controls
  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.25, 4));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.25, 0.5));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitFleet = () => {
    if (robots.length === 0) return handleResetView();
    const xs = robots.map((r) => r.pose.xMeters);
    const ys = robots.map((r) => r.pose.yMeters);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const screenCenter = worldToScreen(
      { x: centerX, y: centerY },
      mapDim,
      baseWidth,
      baseHeight,
    );

    setPan({
      x: baseWidth / 2 - screenCenter.x * zoom,
      y: baseHeight / 2 - screenCenter.y * zoom,
    });
  };

  // Selected robot details for trajectory visualization
  const selectedRobot = robots.find((r) => r.id === selectedRobotId);
  const selectedGoalAssignment = useMemo(() => {
    if (!selectedRobot) return null;
    for (const order of orders) {
      const match = order.assignments.find(
        (a) => a.robotId === selectedRobot.id,
      );
      if (match) return match;
    }
    return null;
  }, [selectedRobot, orders]);

  // Hovered node info
  const hoveredNodeInfo = useMemo(() => {
    if (!hoverCoord) return null;
    const { cell, nodeId, xMeters, yMeters } = hoverCoord;

    const centerMeters = cellToWorld(cell, resolution, origin);
    const isObstacle = map?.cells ? map.cells[nodeId] === 1 : false;
    const nodeObj = topology?.nodeMap?.get(nodeId);

    const occupyingRobot = robots.find((r) => {
      const robotCell = worldToCell(
        { x: r.pose.xMeters, y: r.pose.yMeters },
        resolution,
        origin,
      );
      return robotCell.column === cell.column && robotCell.row === cell.row;
    });

    let assignedGoal: { robotId: string; orderId: string } | null = null;
    for (const order of orders) {
      const match = order.assignments.find(
        (a) => a.goalColumn === cell.column && a.goalRow === cell.row,
      );
      if (match) {
        assignedGoal = { robotId: match.robotId, orderId: order.id };
        break;
      }
    }

    return {
      cell,
      nodeId,
      nodeObj,
      cursorMeters: { x: xMeters, y: yMeters },
      centerMeters,
      isObstacle,
      occupyingRobot,
      assignedGoal,
    };
  }, [hoverCoord, map, resolution, origin, robots, orders, topology]);

  // Details for currently selected node
  const selectedNodeDetails = useMemo(() => {
    if (!selectedNode) return null;
    const occupyingRobot = robots.find((r) => {
      const robotCell = worldToCell(
        { x: r.pose.xMeters, y: r.pose.yMeters },
        resolution,
        origin,
      );
      return (
        robotCell.column === selectedNode.column &&
        robotCell.row === selectedNode.row
      );
    });

    let assignedGoal: { robotId: string; orderId: string } | null = null;
    for (const order of orders) {
      const match = order.assignments.find(
        (a) =>
          a.goalColumn === selectedNode.column &&
          a.goalRow === selectedNode.row,
      );
      if (match) {
        assignedGoal = { robotId: match.robotId, orderId: order.id };
        break;
      }
    }

    const outgoing = topology?.nodeOutgoingEdges.get(selectedNode.id) || [];
    const incoming = topology?.nodeIncomingEdges.get(selectedNode.id) || [];
    const uiMeta = getNodeTypeUiMeta(selectedNode.type);

    return {
      node: selectedNode,
      occupyingRobot,
      assignedGoal,
      outgoing,
      incoming,
      uiMeta,
    };
  }, [selectedNode, robots, orders, resolution, origin, topology]);

  const handleCopyNodeId = (id: number) => {
    copyToClipboard(String(id));
    setCopiedNodeId(true);
    setTimeout(() => setCopiedNodeId(false), 2000);
  };

  // Dynamic HUD popover position anchored to clicked node
  const [hudPlacement, setHudPlacement] = useState<{
    left: number;
    top: number;
    placement: "bottom" | "top" | "left" | "right";
  } | null>(null);

  useEffect(() => {
    if (!selectedNode || !svgRef.current || !containerRef.current) {
      setHudPlacement(null);
      return;
    }

    const updatePosition = () => {
      if (!selectedNode || !svgRef.current || !containerRef.current) return;
      try {
        const svg = svgRef.current;
        const container = containerRef.current;
        const ctm = svg.getScreenCTM();
        if (!ctm) return;

        const cellW = baseWidth / widthCells;
        const cellH = baseHeight / heightCells;
        const cellTopSVG = (heightCells - 1 - selectedNode.row) * cellH;
        const cellBottomSVG = cellTopSVG + cellH;
        const cellLeftSVG = selectedNode.column * cellW;
        const cellRightSVG = cellLeftSVG + cellW;
        const cx = cellLeftSVG + cellW / 2;
        const cy = cellTopSVG + cellH / 2;

        const ptCenter = svg.createSVGPoint();
        ptCenter.x = cx;
        ptCenter.y = cy;
        const screenCenter = ptCenter.matrixTransform(ctm);

        const ptTop = svg.createSVGPoint();
        ptTop.x = cx;
        ptTop.y = cellTopSVG;
        const screenTop = ptTop.matrixTransform(ctm);

        const ptBottom = svg.createSVGPoint();
        ptBottom.x = cx;
        ptBottom.y = cellBottomSVG;
        const screenBottom = ptBottom.matrixTransform(ctm);

        const ptLeft = svg.createSVGPoint();
        ptLeft.x = cellLeftSVG;
        ptLeft.y = cy;
        const screenLeft = ptLeft.matrixTransform(ctm);

        const ptRight = svg.createSVGPoint();
        ptRight.x = cellRightSVG;
        ptRight.y = cy;
        const screenRight = ptRight.matrixTransform(ctm);

        const containerRect = container.getBoundingClientRect();

        const nodeCenterX = screenCenter.x - containerRect.left;
        const nodeCenterY = screenCenter.y - containerRect.top;
        const nodeTop = screenTop.y - containerRect.top;
        const nodeBottom = screenBottom.y - containerRect.top;
        const nodeLeft = screenLeft.x - containerRect.left;
        const nodeRight = screenRight.x - containerRect.left;

        const popoverWidth = 310;
        const popoverHeight = 240;
        const padding = 12;
        const gap = 16;

        const spaceBelow = containerRect.height - (nodeBottom + gap);
        const spaceAbove = nodeTop - gap;
        const spaceRight = containerRect.width - (nodeRight + gap);
        const spaceLeft = nodeLeft - gap;

        let left = 0;
        let top = 0;
        let placement: "bottom" | "top" | "left" | "right" = "bottom";

        if (spaceBelow >= popoverHeight + padding) {
          // 1. Preferred: Bottom (노드 셀 아래 여백)
          placement = "bottom";
          top = nodeBottom + gap;
          left = Math.max(
            padding,
            Math.min(
              containerRect.width - popoverWidth - padding,
              nodeCenterX - popoverWidth / 2,
            ),
          );
        } else if (spaceAbove >= popoverHeight + padding) {
          // 2. Top (노드 셀 위 여백)
          placement = "top";
          top = nodeTop - gap - popoverHeight;
          left = Math.max(
            padding,
            Math.min(
              containerRect.width - popoverWidth - padding,
              nodeCenterX - popoverWidth / 2,
            ),
          );
        } else if (spaceRight >= popoverWidth + padding) {
          // 3. Right (노드 셀 오른쪽 여백)
          placement = "right";
          left = nodeRight + gap;
          top = Math.max(
            padding,
            Math.min(
              containerRect.height - popoverHeight - padding,
              nodeCenterY - popoverHeight / 2,
            ),
          );
        } else if (spaceLeft >= popoverWidth + padding) {
          // 4. Left (노드 셀 왼쪽 여백)
          placement = "left";
          left = nodeLeft - gap - popoverWidth;
          top = Math.max(
            padding,
            Math.min(
              containerRect.height - popoverHeight - padding,
              nodeCenterY - popoverHeight / 2,
            ),
          );
        } else {
          // Fallback: choose side with maximum space
          if (spaceBelow >= spaceAbove) {
            placement = "bottom";
            top = Math.max(
              padding,
              Math.min(
                containerRect.height - popoverHeight - padding,
                nodeBottom + gap,
              ),
            );
            left = Math.max(
              padding,
              Math.min(
                containerRect.width - popoverWidth - padding,
                nodeCenterX - popoverWidth / 2,
              ),
            );
          } else {
            placement = "top";
            top = Math.max(
              padding,
              Math.min(
                containerRect.height - popoverHeight - padding,
                nodeTop - gap - popoverHeight,
              ),
            );
            left = Math.max(
              padding,
              Math.min(
                containerRect.width - popoverWidth - padding,
                nodeCenterX - popoverWidth / 2,
              ),
            );
          }
        }

        setHudPlacement({ left, top, placement });
      } catch {
        // Fallback gracefully
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [selectedNode, pan, zoom, baseWidth, baseHeight, widthCells, heightCells]);

  return (
    <div className="apple-card relative w-full h-[720px] sm:h-[820px] lg:h-[880px] xl:h-[960px] 2xl:h-[1040px] overflow-hidden flex flex-col select-none transition-colors duration-300">
      {/* 1. Map Header & Controls Toolbar */}
      <div className="shrink-0 p-3 sm:px-4 flex flex-wrap items-center justify-between gap-2.5 border-b border-black/[0.05] dark:border-white/[0.06] bg-[#FBFBFD]/70 dark:bg-[#1C1C1E]/70 backdrop-blur-md z-10">
        {/* Left: Map Title & Live Coordinate Pill */}
        <div className="flex items-center gap-2.5 text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0071E3] dark:bg-[#2997FF] animate-pulse" />
            <span className="tracking-tight font-bold">{t("mapTitle")}</span>
          </div>
          <span className="text-[#D2D2D7] dark:text-[#3A3A3C]">|</span>
          <span className="font-mono text-[11px] text-[#86868B] tabular-nums">
            {widthCells}×{heightCells} · {resolution}m/grid
          </span>
          {hoveredNodeInfo && (
            <>
              <span className="text-[#D2D2D7] dark:text-[#3A3A3C]">|</span>
              <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                <div className="flex items-center gap-1 text-[#0071E3] dark:text-[#2997FF] font-bold">
                  <MapPin className="w-3 h-3 text-[#0071E3] dark:text-[#2997FF]" />
                  <span>
                    {formatCoordinates(
                      hoveredNodeInfo.cursorMeters.x,
                      hoveredNodeInfo.cursorMeters.y,
                    )}
                  </span>
                </div>
                <span className="text-[#D2D2D7] dark:text-[#3A3A3C]">•</span>
                <div className="flex items-center gap-1 text-[#0071E3] dark:text-[#2997FF]">
                  <span className="font-semibold text-[10px] text-[#86868B] dark:text-[#A1A1A6]">
                    Node
                  </span>
                  <span className="font-extrabold">
                    {hoveredNodeInfo.nodeId}
                  </span>
                  <span className="text-[10px] opacity-75 font-normal">
                    ({hoveredNodeInfo.cell.column}, {hoveredNodeInfo.cell.row})
                  </span>
                </div>
                {hoveredNodeInfo.nodeObj && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      getNodeTypeUiMeta(hoveredNodeInfo.nodeObj.type).badgeBg
                    } ${
                      getNodeTypeUiMeta(hoveredNodeInfo.nodeObj.type).badgeText
                    } ${
                      getNodeTypeUiMeta(hoveredNodeInfo.nodeObj.type)
                        .badgeBorder
                    }`}
                  >
                    {language === "ko"
                      ? getNodeTypeUiMeta(hoveredNodeInfo.nodeObj.type).labelKo
                      : getNodeTypeUiMeta(hoveredNodeInfo.nodeObj.type).labelEn}
                  </span>
                )}
                {hoveredNodeInfo.occupyingRobot && (
                  <div className="hidden md:flex items-center gap-1 text-[#34C759] dark:text-[#30D158] font-bold text-[10px]">
                    <Bot className="w-3 h-3" />
                    <span>{hoveredNodeInfo.occupyingRobot.id}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: View Mode Toggle & Layer Visibility Ribbon */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          {onToggleViewMode && (
            <div className="inline-flex bg-[#F2F4F6] dark:bg-[#252528] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] items-center gap-0.5 text-xs">
              <button
                onClick={() => onToggleViewMode("canvas")}
                className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 select-none cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "canvas"
                    ? "bg-white dark:bg-[#1C1C1E] text-[#191F28] dark:text-[#F5F5F7] font-bold shadow-xs border border-black/[0.04] dark:border-white/[0.06]"
                    : "text-[#8B95A1] dark:text-[#86868B] hover:text-[#191F28] dark:hover:text-[#F5F5F7] font-medium"
                }`}
                title={t("mapCanvasView")}
              >
                <Grid className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#2997FF]" />
                <span className="hidden sm:inline">{t("mapCanvasView")}</span>
              </button>

              <button
                onClick={() => onToggleViewMode("graph")}
                className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 select-none cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "graph"
                    ? "bg-white dark:bg-[#1C1C1E] text-[#191F28] dark:text-[#F5F5F7] font-bold shadow-xs border border-black/[0.04] dark:border-white/[0.06]"
                    : "text-[#8B95A1] dark:text-[#86868B] hover:text-[#191F28] dark:hover:text-[#F5F5F7] font-medium"
                }`}
                title={t("mapGraphView")}
              >
                <Network className="w-3.5 h-3.5 text-[#34C759] dark:text-[#30D158]" />
                <span className="hidden sm:inline">{t("mapGraphView")}</span>
              </button>

              <button
                onClick={() => onToggleViewMode("accessible")}
                className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 select-none cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "accessible"
                    ? "bg-white dark:bg-[#1C1C1E] text-[#191F28] dark:text-[#F5F5F7] font-bold shadow-xs border border-black/[0.04] dark:border-white/[0.06]"
                    : "text-[#8B95A1] dark:text-[#86868B] hover:text-[#191F28] dark:hover:text-[#F5F5F7] font-medium"
                }`}
                title={t("mapAccessibleView")}
              >
                <Table className="w-3.5 h-3.5 text-[#FF9F0A]" />
                <span className="hidden sm:inline">
                  {t("mapAccessibleView")}
                </span>
              </button>
            </div>
          )}

          {/* Layer Visibility Ribbon */}
          <div className="flex items-center gap-1 bg-[#F2F4F6] dark:bg-[#252528] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] text-xs">
            <button
              onClick={() => setShowGrid((p) => !p)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                showGrid
                  ? "bg-white dark:bg-[#1C1C1E] text-[#0071E3] dark:text-[#2997FF] font-semibold shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
              }`}
              title="Toggle grid layer"
            >
              {showGrid ? (
                <Eye className="w-3 h-3 text-[#0071E3] dark:text-[#2997FF]" />
              ) : (
                <EyeOff className="w-3 h-3 text-[#86868B]" />
              )}
              <span className="hidden md:inline">{t("mapLayerGrid")}</span>
            </button>

            <button
              onClick={() => setShowGoals((p) => !p)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                showGoals
                  ? "bg-white dark:bg-[#1C1C1E] text-[#0071E3] dark:text-[#2997FF] font-semibold shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
              }`}
              title="Toggle goals layer"
            >
              <span>{t("mapLayerGoals")}</span>
            </button>

            <button
              onClick={() => setShowLabels((p) => !p)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                showLabels
                  ? "bg-white dark:bg-[#1C1C1E] text-[#0071E3] dark:text-[#2997FF] font-semibold shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
              }`}
              title="Toggle labels layer"
            >
              <span>{t("mapLayerLabels")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive Map SVG Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`flex-1 min-h-0 w-full relative flex items-center justify-center bg-black/[0.015] dark:bg-black/[0.35] overflow-hidden ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${baseWidth} ${baseHeight}`}
          className="w-full h-full max-h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
        >
          <defs>
            <filter id="appleGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Pillar Hatch Pattern */}
            <pattern
              id="pillarHatch"
              width="6"
              height="6"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                stroke="#64748B"
                strokeWidth="1.2"
                opacity="0.4"
              />
            </pattern>

            {/* Dot Grid Pattern */}
            <pattern
              id="dotGrid"
              x="0"
              y="0"
              width={baseWidth / widthCells}
              height={baseHeight / heightCells}
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx={baseWidth / widthCells / 2}
                cy={baseHeight / heightCells / 2}
                r="1"
                fill="#86868B"
                opacity="0.25"
              />
            </pattern>

            {/* Path Trajectory Gradient */}
            <linearGradient
              id="pathGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#0071E3" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#34C759" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Background Map Frame */}
          <rect
            x="0"
            y="0"
            width={baseWidth}
            height={baseHeight}
            className="fill-white dark:fill-[#1C1C1E] stroke-black/[0.06] dark:stroke-white/[0.08]"
            strokeWidth="1.5"
            rx="16"
          />

          {/* 1. Dot Grid & Grid Lines Layer */}
          {showGrid && (
            <g>
              <rect
                x="0"
                y="0"
                width={baseWidth}
                height={baseHeight}
                fill="url(#dotGrid)"
              />
              <g opacity="0.15">
                {Array.from({ length: widthCells + 1 }).map((_, i) => {
                  const x = (i / widthCells) * baseWidth;
                  return (
                    <line
                      key={`gx-${i}`}
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={baseHeight}
                      stroke="#86868B"
                      strokeWidth="0.75"
                      strokeDasharray={i % 4 === 0 ? "none" : "3,3"}
                    />
                  );
                })}
                {Array.from({ length: heightCells + 1 }).map((_, i) => {
                  const y = (i / heightCells) * baseHeight;
                  return (
                    <line
                      key={`gy-${i}`}
                      x1={0}
                      y1={y}
                      x2={baseWidth}
                      y2={y}
                      stroke="#86868B"
                      strokeWidth="0.75"
                      strokeDasharray={i % 4 === 0 ? "none" : "3,3"}
                    />
                  );
                })}
              </g>
            </g>
          )}

          {/* 2. Specialized Nodes Layer (Chargers, Pillars, Buffers, Chutes, WS) */}
          {topology && (
            <g className="nodes-layer">
              {topology.nodes.map((node) => {
                const cellW = baseWidth / widthCells;
                const cellH = baseHeight / heightCells;
                const x = node.column * cellW;
                const y = (heightCells - 1 - node.row) * cellH;
                const cx = x + cellW / 2;
                const cy = y + cellH / 2;

                // --- A. PILLARS (기둥 - 통행불가) ---
                if (node.type === "pillar") {
                  return (
                    <g
                      key={`node-${node.id}`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                      }}
                    >
                      <rect
                        x={x + 2}
                        y={y + 2}
                        width={cellW - 4}
                        height={cellH - 4}
                        rx="7"
                        fill="#475569"
                        stroke="#64748B"
                        strokeWidth="1.2"
                      />
                      <rect
                        x={x + 3}
                        y={y + 3}
                        width={cellW - 6}
                        height={cellH - 6}
                        rx="5"
                        fill="url(#pillarHatch)"
                      />
                      <rect
                        x={cx - 5}
                        y={cy - 5}
                        width="10"
                        height="10"
                        rx="3"
                        fill="#334155"
                        stroke="#94A3B8"
                        strokeWidth="0.8"
                      />
                    </g>
                  );
                }

                // --- B. CHARGERS (충전소 ⚡) ---
                if (node.type === "charger") {
                  return (
                    <g
                      key={`node-${node.id}`}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                      }}
                    >
                      <rect
                        x={x + 2}
                        y={y + 2}
                        width={cellW - 4}
                        height={cellH - 4}
                        rx="6"
                        fill="rgba(245, 158, 11, 0.12)"
                        stroke="#F59E0B"
                        strokeWidth="1.2"
                        strokeDasharray="4,2"
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r="9"
                        fill="#F59E0B"
                        fillOpacity="0.25"
                      />
                      <path
                        d={`M ${cx + 1} ${cy - 5} L ${cx - 3} ${cy + 1} L ${cx} ${cy + 1} L ${cx - 1} ${cy + 5} L ${cx + 3} ${cy - 1} L ${cx} ${cy - 1} Z`}
                        fill="#F59E0B"
                      />
                      {showLabels && (
                        <text
                          x={cx}
                          y={y + cellH - 3}
                          textAnchor="middle"
                          className="fill-amber-600 dark:fill-amber-400 text-[7.5px] font-mono font-bold select-none"
                        >
                          CHG
                        </text>
                      )}
                    </g>
                  );
                }

                // --- C. WORKSTATIONS (WS - Pick 📦) ---
                if (node.type === "workstation") {
                  return (
                    <g
                      key={`node-${node.id}`}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                      }}
                    >
                      <rect
                        x={x + 2}
                        y={y + 2}
                        width={cellW - 4}
                        height={cellH - 4}
                        rx="6"
                        fill="rgba(6, 182, 212, 0.12)"
                        stroke="#06B6D4"
                        strokeWidth="1.2"
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r="10"
                        fill="#06B6D4"
                        fillOpacity="0.2"
                      />
                      <text
                        x={cx}
                        y={cy + 2.5}
                        textAnchor="middle"
                        className="fill-cyan-600 dark:fill-cyan-400 text-[8px] font-mono font-black tracking-tight select-none"
                      >
                        PICK
                      </text>
                      {showLabels && (
                        <text
                          x={cx}
                          y={y + cellH - 3}
                          textAnchor="middle"
                          className="fill-cyan-600 dark:fill-cyan-400 text-[7.5px] font-mono font-bold select-none"
                        >
                          WS-0{Math.floor(node.column / 4) + 1}
                        </text>
                      )}
                    </g>
                  );
                }

                // --- D. CHUTES (Place 📥) ---
                if (node.type === "chute") {
                  return (
                    <g
                      key={`node-${node.id}`}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                      }}
                    >
                      <rect
                        x={x + 2}
                        y={y + 2}
                        width={cellW - 4}
                        height={cellH - 4}
                        rx="6"
                        fill="rgba(16, 185, 129, 0.12)"
                        stroke="#10B981"
                        strokeWidth="1.2"
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r="10"
                        fill="#10B981"
                        fillOpacity="0.2"
                      />
                      <text
                        x={cx}
                        y={cy + 2.5}
                        textAnchor="middle"
                        className="fill-emerald-600 dark:fill-emerald-400 text-[7px] font-mono font-black tracking-tight select-none"
                      >
                        PLACE
                      </text>
                      {showLabels && (
                        <text
                          x={cx}
                          y={y + cellH - 3}
                          textAnchor="middle"
                          className="fill-emerald-600 dark:fill-emerald-400 text-[7.5px] font-mono font-bold select-none"
                        >
                          CHUTE
                        </text>
                      )}
                    </g>
                  );
                }

                // --- E. BUFFERS (대기공간 / Staging 🅿️) ---
                if (node.type === "buffer") {
                  return (
                    <g
                      key={`node-${node.id}`}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                      }}
                    >
                      <rect
                        x={x + 2}
                        y={y + 2}
                        width={cellW - 4}
                        height={cellH - 4}
                        rx="6"
                        fill="rgba(139, 92, 246, 0.12)"
                        stroke="#8B5CF6"
                        strokeWidth="1.2"
                        strokeDasharray="3,2"
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r="8.5"
                        fill="#8B5CF6"
                        fillOpacity="0.25"
                      />
                      <text
                        x={cx}
                        y={cy + 3.5}
                        textAnchor="middle"
                        className="fill-purple-600 dark:fill-purple-400 text-[10px] font-bold select-none"
                      >
                        P
                      </text>
                    </g>
                  );
                }

                // --- F. STORAGE RACKS (보관 랙 / Storage Pod 📦) ---
                if (node.type === "rack") {
                  const rackTag =
                    node.name.match(/Rack ([A-G]-\d{2})/)?.[1] ||
                    node.name.split(" ")[0];
                  return (
                    <g
                      key={`node-${node.id}`}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                      }}
                    >
                      <rect
                        x={x + 2}
                        y={y + 2}
                        width={cellW - 4}
                        height={cellH - 4}
                        rx="4"
                        fill="rgba(99, 102, 241, 0.15)"
                        stroke="#6366F1"
                        strokeWidth="1.2"
                      />
                      <line
                        x1={x + 3}
                        y1={y + cellH * 0.35}
                        x2={x + cellW - 3}
                        y2={y + cellH * 0.35}
                        stroke="rgba(99, 102, 241, 0.35)"
                        strokeWidth="0.8"
                      />
                      <line
                        x1={x + 3}
                        y1={y + cellH * 0.65}
                        x2={x + cellW - 3}
                        y2={y + cellH * 0.65}
                        stroke="rgba(99, 102, 241, 0.35)"
                        strokeWidth="0.8"
                      />
                      <text
                        x={cx}
                        y={cy + cellH * 0.32}
                        textAnchor="middle"
                        className="fill-indigo-600 dark:fill-indigo-300 text-[6.5px] font-mono font-bold select-none"
                      >
                        {rackTag}
                      </text>
                    </g>
                  );
                }

                return null;
              })}
            </g>
          )}

          {/* 3. Hovered Cell Focus Indicator (Gentle translucent tint, NEVER black!) */}
          {hoverCoord && (
            <g className="pointer-events-none">
              <rect
                x={(hoverCoord.cell.column / widthCells) * baseWidth}
                y={
                  ((heightCells - 1 - hoverCoord.cell.row) / heightCells) *
                  baseHeight
                }
                width={baseWidth / widthCells}
                height={baseHeight / heightCells}
                fill="rgba(0, 113, 227, 0.12)"
                stroke="#0071E3"
                strokeWidth="1.5"
                rx="5"
              />
            </g>
          )}

          {/* 4. Selected Node Focus Halo (Pristine clean highlight, NO scale jump!) */}
          {selectedNode && (
            <g className="pointer-events-none">
              {(() => {
                const cellW = baseWidth / widthCells;
                const cellH = baseHeight / heightCells;
                const x = selectedNode.column * cellW;
                const y = (heightCells - 1 - selectedNode.row) * cellH;
                const ui = getNodeTypeUiMeta(selectedNode.type);

                return (
                  <rect
                    x={x + 1}
                    y={y + 1}
                    width={cellW - 2}
                    height={cellH - 2}
                    rx="6"
                    fill={ui.glowColor}
                    fillOpacity="0.2"
                    stroke={ui.strokeColor}
                    strokeWidth="2.5"
                  />
                );
              })()}
            </g>
          )}

          {/* 5. Trajectory Trail for Selected Robot */}
          {showTrails && selectedRobot && selectedGoalAssignment && (
            <g>
              {(() => {
                const startPos = worldToScreen(
                  {
                    x: selectedRobot.pose.xMeters,
                    y: selectedRobot.pose.yMeters,
                  },
                  mapDim,
                  baseWidth,
                  baseHeight,
                );
                const goalPoint = cellToWorld(
                  {
                    column: selectedGoalAssignment.goalColumn,
                    row: selectedGoalAssignment.goalRow,
                  },
                  resolution,
                  origin,
                );
                const goalPos = worldToScreen(
                  goalPoint,
                  mapDim,
                  baseWidth,
                  baseHeight,
                );

                return (
                  <line
                    x1={startPos.x}
                    y1={startPos.y}
                    x2={goalPos.x}
                    y2={goalPos.y}
                    stroke="url(#pathGradient)"
                    strokeWidth="2.5"
                    strokeDasharray="6,4"
                    strokeLinecap="round"
                    filter="url(#appleGlow)"
                  />
                );
              })()}
            </g>
          )}

          {/* 6. Goal Locations Layer */}
          {showGoals && (
            <g>
              {orders.map((order) =>
                order.assignments.map((assign, aIdx) => {
                  const goalPoint = cellToWorld(
                    { column: assign.goalColumn, row: assign.goalRow },
                    resolution,
                    origin,
                  );
                  const screenPos = worldToScreen(
                    goalPoint,
                    mapDim,
                    baseWidth,
                    baseHeight,
                  );
                  const isAssignedToSelected =
                    assign.robotId === selectedRobotId;

                  return (
                    <g
                      key={`goal-${order.id}-${aIdx}`}
                      transform={`translate(${screenPos.x}, ${screenPos.y})`}
                    >
                      <circle
                        cx="0"
                        cy="0"
                        r={isAssignedToSelected ? "18" : "14"}
                        fill={
                          isAssignedToSelected
                            ? "rgba(0, 113, 227, 0.15)"
                            : "rgba(0, 113, 227, 0.08)"
                        }
                        stroke="#0071E3"
                        strokeWidth={isAssignedToSelected ? "2" : "1.5"}
                        strokeDasharray="3,3"
                      />
                      <circle cx="0" cy="0" r="4" fill="#0071E3" />
                    </g>
                  );
                }),
              )}
            </g>
          )}

          {/* 7. Robots Layer */}
          <g>
            {robots.map((robot) => {
              const isSelected = robot.id === selectedRobotId;
              const screenPos = worldToScreen(
                { x: robot.pose.xMeters, y: robot.pose.yMeters },
                mapDim,
                baseWidth,
                baseHeight,
              );
              const rotationDeg = yawToScreenRotationDegrees(
                robot.pose.yawRadians,
              );

              const isExecuting = robot.operationalState === "EXECUTING";
              const isDisconnected = robot.connectivity === "DISCONNECTED";
              const isSafetyAlert =
                robot.safety !== "NORMAL" && robot.safety !== "WAIT";

              const robotColor = isDisconnected
                ? "#FF453A"
                : isSafetyAlert
                  ? "#FF9F0A"
                  : isExecuting
                    ? "#30D158"
                    : "#0071E3";

              return (
                <g
                  key={`robot-${robot.id}`}
                  transform={`translate(${screenPos.x}, ${screenPos.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRobotId(robot.id);
                  }}
                  className="cursor-pointer group select-none"
                >
                  {/* Selection Focus Halo */}
                  {isSelected && (
                    <circle
                      cx="0"
                      cy="0"
                      r="20"
                      fill="rgba(0, 113, 227, 0.2)"
                      stroke="#0071E3"
                      strokeWidth="2"
                    />
                  )}

                  <circle
                    cx="0"
                    cy="0"
                    r="13"
                    stroke={robotColor}
                    strokeWidth={isSelected ? "3" : "2.5"}
                    className="fill-white dark:fill-[#1C1C1E] shadow-md transition-colors duration-200"
                  />

                  <g transform={`rotate(${rotationDeg})`}>
                    <polygon
                      points="9,0 0,-4.5 2.5,0 0,4.5"
                      fill={robotColor}
                    />
                  </g>

                  <circle cx="0" cy="0" r="3.5" fill={robotColor} />

                  {showLabels && (
                    <g transform="translate(0, 22)">
                      <rect
                        x="-26"
                        y="-8"
                        width="52"
                        height="16"
                        rx="5"
                        className="fill-white/95 dark:fill-[#1C1C1E]/95 stroke-black/[0.08] dark:stroke-white/[0.12]"
                        strokeWidth="0.75"
                      />
                      <text
                        x="0"
                        y="4"
                        textAnchor="middle"
                        className={`text-[9px] font-mono font-bold select-none ${
                          isSelected
                            ? "fill-[#0071E3] dark:fill-[#2997FF] font-extrabold"
                            : "fill-[#1D1D1F] dark:fill-[#F5F5F7]"
                        }`}
                      >
                        {robot.id}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* 3. Floating Node Inspector Popover Card (Anchored to node) */}
        {selectedNodeDetails && hudPlacement && (
          <div
            className="absolute z-20 w-[310px] max-w-[calc(100%-1.5rem)] apple-card p-3.5 shadow-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl animate-fade-in transition-[left,top] duration-150 ease-out"
            style={{
              left: `${hudPlacement.left}px`,
              top: `${hudPlacement.top}px`,
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.05] dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center ${selectedNodeDetails.uiMeta.badgeBg}`}
                >
                  {selectedNodeDetails.node.type === "rack" && (
                    <Boxes className="w-4 h-4 text-indigo-500" />
                  )}
                  {selectedNodeDetails.node.type === "charger" && (
                    <Zap className="w-4 h-4 text-amber-500" />
                  )}
                  {selectedNodeDetails.node.type === "pillar" && (
                    <ShieldAlert className="w-4 h-4 text-zinc-500" />
                  )}
                  {selectedNodeDetails.node.type === "buffer" && (
                    <PauseCircle className="w-4 h-4 text-purple-500" />
                  )}
                  {selectedNodeDetails.node.type === "chute" && (
                    <Inbox className="w-4 h-4 text-emerald-500" />
                  )}
                  {selectedNodeDetails.node.type === "workstation" && (
                    <Package className="w-4 h-4 text-cyan-500" />
                  )}
                  {selectedNodeDetails.node.type === "waypoint" && (
                    <MapPin className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {selectedNodeDetails.node.name}
                  </h4>
                  <span className="text-[10px] text-[#86868B]">
                    {selectedNodeDetails.node.zone}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                title="Close inspector"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="py-3 space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-sans text-[#86868B]">
                  {t("nodeTypeLabel")}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${selectedNodeDetails.uiMeta.badgeBg} ${selectedNodeDetails.uiMeta.badgeText} ${selectedNodeDetails.uiMeta.badgeBorder}`}
                >
                  {language === "ko"
                    ? selectedNodeDetails.uiMeta.labelKo
                    : selectedNodeDetails.uiMeta.labelEn}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-sans text-[#86868B]">
                  Coordinates
                </span>
                <span className="text-[11px] text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold">
                  Col {selectedNodeDetails.node.column}, Row{" "}
                  {selectedNodeDetails.node.row} (
                  {formatCoordinates(
                    selectedNodeDetails.node.xMeters,
                    selectedNodeDetails.node.yMeters,
                  )}
                  )
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-sans text-[#86868B]">
                  {t("nodeConnectedEdges")}
                </span>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="bg-[#2997FF]/15 text-[#0071E3] dark:text-[#2997FF] px-1.5 py-0.5 rounded font-bold">
                    ↑ {selectedNodeDetails.outgoing.length} Out
                  </span>
                  <span className="bg-[#30D158]/15 text-[#248A3D] dark:text-[#30D158] px-1.5 py-0.5 rounded font-bold">
                    ↓ {selectedNodeDetails.incoming.length} In
                  </span>
                </div>
              </div>

              {selectedNodeDetails.occupyingRobot && (
                <div className="p-2.5 rounded-xl bg-[#34C759]/10 dark:bg-[#30D158]/15 border border-[#34C759]/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#34C759] dark:text-[#30D158]" />
                    <div>
                      <span className="text-[11px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] block">
                        {selectedNodeDetails.occupyingRobot.id}
                      </span>
                      <span className="text-[9px] text-[#86868B] font-sans">
                        Battery:{" "}
                        {selectedNodeDetails.occupyingRobot.batteryPercent}% ·{" "}
                        {selectedNodeDetails.occupyingRobot.operationalState}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setSelectedRobotId(selectedNodeDetails.occupyingRobot!.id)
                    }
                    className="px-2 py-1 text-[10px] font-bold text-white bg-[#0071E3] rounded-lg hover:bg-[#0077ED] transition-all cursor-pointer font-sans"
                  >
                    Inspect
                  </button>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-black/[0.05] dark:border-white/[0.08]">
              <button
                onClick={() => handleCopyNodeId(selectedNodeDetails.node.id)}
                className="w-full py-1.5 px-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[#1D1D1F] dark:text-[#F5F5F7] text-[10px] font-semibold font-sans flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedNodeId ? (
                  <>
                    <Check className="w-3 h-3 text-[#34C759]" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-[#86868B]" />
                    <span>Copy Node ID ({selectedNodeDetails.node.id})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Bottom Toolbar */}
      <div className="shrink-0 p-2.5 sm:px-4 flex items-center justify-between border-t border-black/[0.05] dark:border-white/[0.06] bg-[#FBFBFD]/70 dark:bg-[#1C1C1E]/70 backdrop-blur-md z-10">
        <div className="text-[11px] font-mono text-[#86868B] flex items-center gap-3 bg-[#F5F5F7] dark:bg-[#252528] px-3 py-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3] dark:bg-[#2997FF]" />
            <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              +X East →
            </span>
          </div>
          <span className="text-[#D2D2D7] dark:text-[#3A3A3C]">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] dark:bg-[#30D158]" />
            <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              +Y North ↑
            </span>
          </div>
        </div>

        <div className="bg-[#F2F4F6] dark:bg-[#252528] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] flex items-center gap-1">
          <button
            onClick={handleZoomIn}
            className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-white dark:hover:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] hover:shadow-xs cursor-pointer transition-all"
            title={t("mapZoomIn")}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-white dark:hover:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] hover:shadow-xs cursor-pointer transition-all"
            title={t("mapZoomOut")}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-black/[0.06] dark:bg-white/[0.1] mx-0.5" />
          <button
            onClick={handleFitFleet}
            className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-white dark:hover:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] hover:shadow-xs cursor-pointer transition-all"
            title={t("mapFitFleet")}
          >
            <Crosshair className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#2997FF]" />
          </button>
          <button
            onClick={handleResetView}
            className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-white dark:hover:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] hover:shadow-xs cursor-pointer transition-all"
            title={t("mapResetView")}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
