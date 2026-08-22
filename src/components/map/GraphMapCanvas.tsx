import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  MapPin,
  Bot,
  Zap,
  ShieldAlert,
  PauseCircle,
  Inbox,
  Package,
  X,
  Copy,
  Check,
  Grid,
  Network,
  Table,
  Boxes,
} from "lucide-react";
import {
  worldToScreen,
  cellToWorld,
  worldToCell,
  yawToScreenRotationDegrees,
  formatCoordinates,
  type GridCell,
} from "../../utils/coordinates/coordinates.ts";
import { getNodeTypeUiMeta } from "../../utils/map/topology.ts";
import type { MapNode } from "../../domain/map/types.ts";
import { copyToClipboard } from "../../utils/ids/ids.ts";

export interface GraphMapCanvasProps {
  viewMode?: "canvas" | "graph" | "accessible";
  onToggleViewMode?: (mode: "canvas" | "graph" | "accessible") => void;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
}

export const GraphMapCanvas: React.FC<GraphMapCanvasProps> = ({
  viewMode = "graph",
  onToggleViewMode,
  headerLeft,
  headerRight,
}) => {
  const { t, language, theme } = useAppConfig();
  const isDark = theme === "dark";

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
  const robots = useMemo(() => snapshot?.robots || [], [snapshot?.robots]);
  const orders = useMemo(() => snapshot?.orders || [], [snapshot?.orders]);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // 2D Canvas standard dimension standards
  const widthCells = map?.widthCells || 32;
  const heightCells = map?.heightCells || 20;
  const resolution = map?.resolutionMeters || 1.0;
  const origin = map?.origin || { xMeters: 0, yMeters: 0 };

  const baseWidth = 960;
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

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Layer toggles
  const [showNodeLabels, setShowNodeLabels] = useState<boolean>(true);
  const [showEdgeArrows, setShowEdgeArrows] = useState<boolean>(true);
  const [showWaypoints, setShowWaypoints] = useState<boolean>(true);
  const [showGoals, setShowGoals] = useState<boolean>(true);
  const [showTrails, setShowTrails] = useState<boolean>(true);

  // Copied state
  const [copiedNodeId, setCopiedNodeId] = useState<boolean>(false);

  // Mouse hover state
  const [hoveredNode, setHoveredNode] = useState<MapNode | null>(null);
  const [hoverCoord, setHoverCoord] = useState<{
    xMeters: number;
    yMeters: number;
    cell: GridCell;
  } | null>(null);

  // Auto-fit to container viewport
  const fitViewToContainer = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const toolbarHeight = 52;
    const availWidth = rect.width - 32;
    const availHeight = rect.height - toolbarHeight - 32;
    if (availWidth <= 0 || availHeight <= 0) return;

    const scale = Math.min(availWidth / baseWidth, availHeight / baseHeight);
    const newZoom = Number(scale.toFixed(3));
    const newPanX = (rect.width - baseWidth * newZoom) / 2;
    const newPanY = (rect.height - toolbarHeight - baseHeight * newZoom) / 2;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [baseWidth, baseHeight]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fitViewToContainer();
    }, 60);

    const handleResize = () => {
      fitViewToContainer();
    };

    window.addEventListener("resize", handleResize);

    let observer: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        fitViewToContainer();
      });
      observer.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
      if (observer) observer.disconnect();
    };
  }, [fitViewToContainer]);

  // Connected edges for active node
  const activeNodeId =
    selectedNodeId !== null ? selectedNodeId : (hoveredNode?.id ?? null);

  const activeOutgoingEdges = useMemo(() => {
    if (activeNodeId === null || !topology) return [];
    return topology.nodeOutgoingEdges.get(activeNodeId) || [];
  }, [activeNodeId, topology]);

  const activeIncomingEdges = useMemo(() => {
    if (activeNodeId === null || !topology) return [];
    return topology.nodeIncomingEdges.get(activeNodeId) || [];
  }, [activeNodeId, topology]);

  // Handle Dragging vs Click
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    }

    // Hover Coordinate Tracker in SVG
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = (e.clientX - rect.left - pan.x) / zoom;
      const clickY = (e.clientY - rect.top - pan.y) / zoom;

      const normX = clickX / baseWidth;
      const normY = clickY / baseHeight;

      if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
        const col = Math.floor(normX * widthCells);
        const row = heightCells - 1 - Math.floor(normY * heightCells);
        const clampedCol = Math.max(0, Math.min(widthCells - 1, col));
        const clampedRow = Math.max(0, Math.min(heightCells - 1, row));

        const cellCenter = cellToWorld(
          { column: clampedCol, row: clampedRow },
          resolution,
          origin,
        );

        setHoverCoord({
          xMeters: cellCenter.x,
          yMeters: cellCenter.y,
          cell: { column: clampedCol, row: clampedRow },
        });
      } else {
        setHoverCoord(null);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
    const dist = Math.hypot(
      e.clientX - mouseDownPosRef.current.x,
      e.clientY - mouseDownPosRef.current.y,
    );
    if (dist < 5 && (e.target as HTMLElement).tagName === "svg") {
      setSelectedNodeId(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.3), 5.0);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setPan({
        x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
        y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
      });
    }
    setZoom(newZoom);
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.25, 5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.25, 0.3));
  const handleResetView = () => {
    fitViewToContainer();
  };

  const handleFitFleet = () => {
    if (robots.length === 0) return fitViewToContainer();
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

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPan({
        x: rect.width / 2 - screenCenter.x * zoom,
        y: rect.height / 2 - screenCenter.y * zoom,
      });
    }
  };

  const handleFocusSelected = () => {
    const selected = robots.find((r) => r.id === selectedRobotId);
    if (!selected || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const pos = worldToScreen(
      { x: selected.pose.xMeters, y: selected.pose.yMeters },
      mapDim,
      baseWidth,
      baseHeight,
    );

    const targetZoom = 2.0;
    setZoom(targetZoom);
    setPan({
      x: rect.width / 2 - pos.x * targetZoom,
      y: rect.height / 2 - pos.y * targetZoom,
    });
  };

  // Selected robot trajectory
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

  // Selected node details
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

  const handleCopyNodeId = async (id: number) => {
    await copyToClipboard(String(id));
    setCopiedNodeId(true);
    setTimeout(() => setCopiedNodeId(false), 2000);
  };

  // Screen Placement for Node Inspector Popover
  const hudPlacement = useMemo(() => {
    if (!selectedNodeDetails || !containerRef.current) return null;
    const { node } = selectedNodeDetails;
    const cellW = baseWidth / widthCells;
    const cellH = baseHeight / heightCells;
    const cx = (node.column + 0.5) * cellW;
    const cy = (heightCells - 1 - node.row + 0.5) * cellH;

    const screenX = cx * zoom + pan.x;
    const screenY = cy * zoom + pan.y;

    const contWidth = containerRef.current.clientWidth || 800;
    const contHeight = containerRef.current.clientHeight || 600;

    let left = screenX + 16;
    let top = screenY - 40;

    if (left + 320 > contWidth) left = screenX - 330;
    if (left < 16) left = 16;
    if (top + 260 > contHeight) top = contHeight - 270;
    if (top < 16) top = 16;

    return { left, top };
  }, [
    selectedNodeDetails,
    zoom,
    pan,
    baseWidth,
    baseHeight,
    widthCells,
    heightCells,
  ]);

  const cellW = baseWidth / widthCells;
  const cellH = baseHeight / heightCells;

  return (
    <div className="apple-card relative w-full h-full min-h-[400px] overflow-hidden flex flex-col select-none transition-colors duration-300">
      {/* 1. Top Glassmorphic Controls Toolbar */}
      <div className="shrink-0 p-3 sm:px-4 sm:py-2.5 flex flex-wrap items-center justify-between gap-2.5 border-b border-black/[0.05] dark:border-white/[0.06] bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-md z-10">
        {/* Left: Viewport Info, Mode Switcher & Topology Stats */}
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

          <span className="text-[#D2D2D7] dark:text-[#3A3A3C] hidden md:inline">
            |
          </span>
          <span className="font-mono text-[11px] text-[#86868B] tabular-nums hidden md:inline">
            {topology?.nodes.length || 0} Nodes · {topology?.edges.length || 0}{" "}
            Edges
          </span>
        </div>

        {/* Right: Controls, Layer Toggles & Header Right */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={handleZoomIn}
            className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-[#1D1D1F] dark:text-[#F5F5F7] transition-all cursor-pointer"
            title={t("mapZoomIn")}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-[#1D1D1F] dark:text-[#F5F5F7] transition-all cursor-pointer"
            title={t("mapZoomOut")}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetView}
            className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-[#1D1D1F] dark:text-[#F5F5F7] transition-all cursor-pointer"
            title={t("mapResetView")}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          {selectedRobotId && (
            <button
              onClick={handleFocusSelected}
              className="px-2.5 h-7 rounded-lg bg-[#0071E3]/10 dark:bg-[#2997FF]/15 text-[#0071E3] dark:text-[#2997FF] hover:bg-[#0071E3]/20 flex items-center gap-1 text-[11px] font-medium transition-all cursor-pointer"
              title="Focus Selected Robot"
            >
              <Crosshair className="w-3 h-3" />
              <span>{selectedRobotId}</span>
            </button>
          )}

          {/* Graph Layer Toggles */}
          <div className="h-4 w-[1px] bg-black/10 dark:bg-white/15 mx-1" />
          <button
            onClick={() => setShowNodeLabels((p) => !p)}
            className={`px-2 h-7 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
              showNodeLabels
                ? "bg-black/5 dark:bg-white/10 text-[#1D1D1F] dark:text-[#F5F5F7]"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
            title="Toggle node labels"
          >
            <span>Labels</span>
          </button>

          <button
            onClick={() => setShowEdgeArrows((p) => !p)}
            className={`px-2 h-7 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
              showEdgeArrows
                ? "bg-black/5 dark:bg-white/10 text-[#0071E3] dark:text-[#2997FF]"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
            title="Toggle edge arrows"
          >
            <span>Arrows</span>
          </button>

          <button
            onClick={() => setShowWaypoints((p) => !p)}
            className={`px-2 h-7 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
              showWaypoints
                ? "bg-black/5 dark:bg-white/10 text-[#0071E3] dark:text-[#2997FF]"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
            title="Toggle transit waypoints"
          >
            <span>Waypoints</span>
          </button>

          {headerRight && (
            <>
              <div className="h-4 w-[1px] bg-black/10 dark:bg-white/15 mx-1" />
              {headerRight}
            </>
          )}
        </div>
      </div>

      {/* 2. Interactive Graph SVG Canvas with 2D Layout Foundation */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onMouseLeave={() => {
          setHoverCoord(null);
          setHoveredNode(null);
        }}
        className={`flex-1 min-h-0 w-full relative flex items-center justify-center bg-[#FBFBFD] dark:bg-[#161618] overflow-hidden ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${baseWidth} ${baseHeight}`}
          className="w-full h-full max-h-full block"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.08s ease-out",
          }}
        >
          <defs>
            <filter id="graphGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. Structural Warehouse Floor Blueprint (2D Canvas Standard) */}
          <g className="warehouse-blueprint">
            {/* Background Base */}
            <rect
              x="0"
              y="0"
              width={baseWidth}
              height={baseHeight}
              fill={isDark ? "#161618" : "#FBFBFD"}
              rx="16"
            />

            {/* Warehouse Grid Cells & Structural Pillars */}
            {map &&
              Array.from({ length: heightCells }).map((_, r) =>
                Array.from({ length: widthCells }).map((__, c) => {
                  const idx = r * widthCells + c;
                  const isBlocked = map.cells[idx] === 1;
                  const x = c * cellW;
                  const y = (heightCells - 1 - r) * cellH;

                  if (isBlocked) {
                    return (
                      <g key={`cell-blk-${r}-${c}`}>
                        <rect
                          x={x + 2}
                          y={y + 2}
                          width={cellW - 4}
                          height={cellH - 4}
                          rx={5}
                          fill={isDark ? "#27272A" : "#E2E8F0"}
                          stroke={
                            isDark
                              ? "rgba(255,255,255,0.08)"
                              : "rgba(0,0,0,0.08)"
                          }
                          strokeWidth="1"
                        />
                        <circle
                          cx={x + cellW / 2}
                          cy={y + cellH / 2}
                          r={Math.min(cellW, cellH) * 0.22}
                          fill={isDark ? "#52525B" : "#94A3B8"}
                        />
                      </g>
                    );
                  }

                  const isPodStorage =
                    r >= 4 &&
                    r <= heightCells - 5 &&
                    r !== 10 &&
                    c > 0 &&
                    c < widthCells - 1;

                  if (isPodStorage) {
                    return (
                      <rect
                        key={`cell-pod-${r}-${c}`}
                        x={x + 1.5}
                        y={y + 1.5}
                        width={cellW - 3}
                        height={cellH - 3}
                        rx={3}
                        fill={
                          isDark
                            ? "rgba(99, 102, 241, 0.05)"
                            : "rgba(99, 102, 241, 0.035)"
                        }
                        stroke={
                          isDark
                            ? "rgba(99, 102, 241, 0.12)"
                            : "rgba(99, 102, 241, 0.08)"
                        }
                        strokeWidth="0.5"
                      />
                    );
                  }

                  return (
                    <rect
                      key={`cell-grid-${r}-${c}`}
                      x={x}
                      y={y}
                      width={cellW}
                      height={cellH}
                      fill="none"
                      stroke={
                        isDark
                          ? "rgba(255, 255, 255, 0.035)"
                          : "rgba(0, 0, 0, 0.04)"
                      }
                      strokeWidth="0.75"
                    />
                  );
                }),
              )}

            {/* Express Highway Highlights */}
            {/* Row 2 (Outbound Eastbound) */}
            <rect
              x={cellW}
              y={(heightCells - 1 - 2) * cellH + 1}
              width={(widthCells - 2) * cellW}
              height={cellH - 2}
              fill={
                isDark ? "rgba(0, 113, 227, 0.12)" : "rgba(0, 113, 227, 0.08)"
              }
              rx="4"
            />
            {/* Row height - 3 (Inbound Westbound) */}
            <rect
              x={cellW}
              y={(heightCells - 1 - (heightCells - 3)) * cellH + 1}
              width={(widthCells - 2) * cellW}
              height={cellH - 2}
              fill={
                isDark ? "rgba(16, 185, 129, 0.12)" : "rgba(16, 185, 129, 0.08)"
              }
              rx="4"
            />
            {/* Row 10 (Central Crossway) */}
            <rect
              x={cellW}
              y={(heightCells - 1 - 10) * cellH + 1}
              width={(widthCells - 2) * cellW}
              height={cellH - 2}
              fill={
                isDark ? "rgba(245, 158, 11, 0.08)" : "rgba(245, 158, 11, 0.05)"
              }
              rx="4"
            />
          </g>

          {/* 2. Graph Edges Layer with Directional Vectors */}
          {topology && (
            <g className="graph-edges">
              {topology.edges.map((edge) => {
                const fromX = (edge.fromColumn + 0.5) * cellW;
                const fromY = (heightCells - 1 - edge.fromRow + 0.5) * cellH;
                const toX = (edge.toColumn + 0.5) * cellW;
                const toY = (heightCells - 1 - edge.toRow + 0.5) * cellH;

                const isOutgoing = activeOutgoingEdges.some(
                  (e) => e.id === edge.id,
                );
                const isIncoming = activeIncomingEdges.some(
                  (e) => e.id === edge.id,
                );
                const isHighlighted = isOutgoing || isIncoming;

                let strokeColor = isDark ? "#52525B" : "#94A3B8";
                let strokeWidth = 1.6;
                let strokeOpacity = isDark ? 0.45 : 0.4;

                if (isOutgoing) {
                  strokeColor = isDark ? "#2997FF" : "#0071E3";
                  strokeWidth = 3.2;
                  strokeOpacity = 1.0;
                } else if (isIncoming) {
                  strokeColor = isDark ? "#30D158" : "#34C759";
                  strokeWidth = 3.2;
                  strokeOpacity = 1.0;
                } else if (edge.type === "station_feeder") {
                  strokeColor = isDark ? "#FBBF24" : "#F59E0B";
                  strokeOpacity = 0.85;
                  strokeWidth = 2.4;
                } else if (edge.type === "corridor") {
                  strokeColor = isDark ? "#60A5FA" : "#0071E3";
                  strokeOpacity = 0.65;
                  strokeWidth = 2.2;
                }

                const midX = (fromX + toX) / 2;
                const midY = (fromY + toY) / 2;
                const dx = toX - fromX;
                const dy = toY - fromY;
                const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

                return (
                  <g key={`graph-edge-${edge.id}`}>
                    <line
                      x1={fromX}
                      y1={fromY}
                      x2={toX}
                      y2={toY}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeOpacity={strokeOpacity}
                      filter={isHighlighted ? "url(#graphGlow)" : undefined}
                    />
                    {showEdgeArrows && edge.direction === "forward" && (
                      <polygon
                        points="-4,-3.5 4.5,0 -4,3.5"
                        transform={`translate(${midX}, ${midY}) rotate(${angleDeg})`}
                        fill={strokeColor}
                        opacity={
                          isHighlighted ? 1 : Math.min(1, strokeOpacity + 0.35)
                        }
                        filter={isHighlighted ? "url(#graphGlow)" : undefined}
                      />
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* 3. Trajectory Path for Selected Robot */}
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
                    stroke={isDark ? "#2997FF" : "#0071E3"}
                    strokeWidth="3.5"
                    strokeDasharray="6,4"
                    strokeLinecap="round"
                    filter="url(#graphGlow)"
                  />
                );
              })()}
            </g>
          )}

          {/* 4. Active Order Goals */}
          {showGoals && (
            <g>
              {orders.map((order) =>
                order.assignments.map((assign, aIdx) => {
                  const cx = (assign.goalColumn + 0.5) * cellW;
                  const cy = (heightCells - 1 - assign.goalRow + 0.5) * cellH;
                  const isSelectedGoal = assign.robotId === selectedRobotId;

                  return (
                    <g key={`graph-goal-${order.id}-${aIdx}`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isSelectedGoal ? 16 : 12}
                        fill={
                          isSelectedGoal
                            ? "rgba(0, 113, 227, 0.2)"
                            : "rgba(0, 113, 227, 0.08)"
                        }
                        stroke={isDark ? "#2997FF" : "#0071E3"}
                        strokeWidth={isSelectedGoal ? "2" : "1.5"}
                        strokeDasharray="4,3"
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r="3"
                        fill={isDark ? "#2997FF" : "#0071E3"}
                      />
                    </g>
                  );
                }),
              )}
            </g>
          )}

          {/* 5. Graph Vertices / Specialized Station Nodes */}
          {topology && (
            <g className="graph-nodes">
              {topology.nodes.map((node) => {
                const cx = (node.column + 0.5) * cellW;
                const cy = (heightCells - 1 - node.row + 0.5) * cellH;
                const isSelected = selectedNodeId === node.id;
                const isHovered = hoveredNode?.id === node.id;
                const ui = getNodeTypeUiMeta(node.type);

                // Waypoint filtering
                if (node.type === "waypoint" && !showWaypoints) {
                  return (
                    <circle
                      key={`gn-${node.id}`}
                      cx={cx}
                      cy={cy}
                      r="2.5"
                      fill={isDark ? "#52525B" : "#94A3B8"}
                      fillOpacity="0.4"
                    />
                  );
                }

                // Station Dimensions
                const isStation = node.type !== "waypoint";
                const isRack = node.type === "rack";
                const radius = isStation ? 13 : 8;

                return (
                  <g
                    key={`gn-${node.id}`}
                    className="cursor-pointer group select-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeId(node.id);
                    }}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    {/* Selected Node Glow Halo */}
                    {isSelected && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius + 8}
                        fill={ui.glowColor}
                        fillOpacity="0.3"
                        stroke={ui.strokeColor}
                        strokeWidth="2.5"
                        filter="url(#graphGlow)"
                      />
                    )}

                    {/* Hover Halo */}
                    {isHovered && !isSelected && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius + 5}
                        fill={
                          isDark
                            ? "rgba(41, 151, 255, 0.2)"
                            : "rgba(0, 113, 227, 0.15)"
                        }
                        stroke={isDark ? "#2997FF" : "#0071E3"}
                        strokeWidth="1.5"
                      />
                    )}

                    {/* Node Base Representation */}
                    {isRack ? (
                      <g>
                        <rect
                          x={cx - 12}
                          y={cy - 10}
                          width="24"
                          height="20"
                          rx="4"
                          fill={isDark ? "rgba(99, 102, 241, 0.25)" : "#EEF2FF"}
                          stroke={isDark ? "#818CF8" : "#6366F1"}
                          strokeWidth="1.5"
                        />
                        <text
                          x={cx}
                          y={cy + 3}
                          textAnchor="middle"
                          className="fill-indigo-600 dark:fill-indigo-300 text-[7px] font-mono font-black select-none"
                        >
                          {node.name.match(/Rack ([A-G]-\d{2})/)?.[1] || "RACK"}
                        </text>
                      </g>
                    ) : (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill={
                          node.type === "pillar"
                            ? isDark
                              ? "#3F3F46"
                              : "#64748B"
                            : isStation
                              ? ui.fillColor
                              : isDark
                                ? "#1C1C1E"
                                : "#FFFFFF"
                        }
                        stroke={ui.strokeColor}
                        strokeWidth={isStation ? "2.2" : "1.8"}
                      />
                    )}

                    {/* Node Specialized Icons */}
                    {node.type === "charger" && (
                      <path
                        d={`M ${cx + 1} ${cy - 4.5} L ${cx - 3} ${cy + 0.5} L ${cx} ${cy + 0.5} L ${cx - 1} ${cy + 4.5} L ${cx + 3} ${cy - 0.5} L ${cx} ${cy - 0.5} Z`}
                        fill={isDark ? "#FBBF24" : "#D97706"}
                      />
                    )}

                    {node.type === "workstation" && (
                      <text
                        x={cx}
                        y={cy + 2.5}
                        textAnchor="middle"
                        className="fill-cyan-600 dark:fill-cyan-300 text-[7px] font-mono font-black select-none"
                      >
                        PICK
                      </text>
                    )}

                    {node.type === "chute" && (
                      <text
                        x={cx}
                        y={cy + 2.5}
                        textAnchor="middle"
                        className="fill-emerald-600 dark:fill-emerald-300 text-[6.5px] font-mono font-black select-none"
                      >
                        PLACE
                      </text>
                    )}

                    {node.type === "buffer" && (
                      <text
                        x={cx}
                        y={cy + 3}
                        textAnchor="middle"
                        className="fill-purple-600 dark:fill-purple-300 text-[9px] font-bold select-none"
                      >
                        P
                      </text>
                    )}

                    {node.type === "pillar" && (
                      <text
                        x={cx}
                        y={cy + 3}
                        textAnchor="middle"
                        className="fill-white text-[8px] font-bold select-none"
                      >
                        ✕
                      </text>
                    )}

                    {/* Node Labels */}
                    {showNodeLabels && (
                      <text
                        x={cx}
                        y={cy + radius + 10}
                        textAnchor="middle"
                        className={`text-[8.5px] font-mono font-bold select-none ${
                          isSelected
                            ? "fill-[#0071E3] dark:fill-[#2997FF] font-black"
                            : isStation
                              ? "fill-[#1D1D1F] dark:fill-[#F5F5F7]"
                              : "fill-[#86868B]"
                        }`}
                      >
                        {isStation ? node.name.split(" ")[0] : `#${node.id}`}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* 6. Active Robots on Graph */}
          <g className="graph-robots">
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
                    : isDark
                      ? "#2997FF"
                      : "#0071E3";

              return (
                <g
                  key={`graph-robot-${robot.id}`}
                  transform={`translate(${screenPos.x}, ${screenPos.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRobotId(robot.id);
                  }}
                  className="cursor-pointer group select-none"
                >
                  {/* Selected Halo */}
                  {isSelected && (
                    <circle
                      cx="0"
                      cy="0"
                      r="19"
                      fill={
                        isDark
                          ? "rgba(41, 151, 255, 0.25)"
                          : "rgba(0, 113, 227, 0.2)"
                      }
                      stroke={isDark ? "#2997FF" : "#0071E3"}
                      strokeWidth="2"
                    />
                  )}

                  {/* Robot Chassis */}
                  <circle
                    cx="0"
                    cy="0"
                    r="11"
                    fill={isDark ? "#1C1C1E" : "#FFFFFF"}
                    stroke={robotColor}
                    strokeWidth="2.5"
                  />

                  {/* Direction Arrow */}
                  <g transform={`rotate(${rotationDeg})`}>
                    <polygon points="8,0 0,-4 2,0 0,4" fill={robotColor} />
                  </g>

                  {/* Center Pivot */}
                  <circle cx="0" cy="0" r="2.5" fill={robotColor} />

                  {/* Floating Pill Monospace ID Badge */}
                  <g transform="translate(0, 16)">
                    <rect
                      x="-22"
                      y="-6"
                      width="44"
                      height="13"
                      rx="3.5"
                      fill={
                        isDark
                          ? "rgba(28, 28, 30, 0.95)"
                          : "rgba(255, 255, 255, 0.95)"
                      }
                      stroke={
                        isDark
                          ? "rgba(255, 255, 255, 0.12)"
                          : "rgba(0, 0, 0, 0.08)"
                      }
                      strokeWidth="0.75"
                    />
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      className={`text-[8px] font-mono font-bold select-none ${
                        isSelected
                          ? isDark
                            ? "fill-[#2997FF]"
                            : "fill-[#0071E3]"
                          : isDark
                            ? "fill-[#F5F5F7]"
                            : "fill-[#1D1D1F]"
                      }`}
                    >
                      {robot.id}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* 3. Live Coordinate Tracker Overlay (Top Left) */}
        {hoverCoord && (
          <div className="absolute top-3 left-3 z-10 pointer-events-none flex items-center gap-2 bg-white/90 dark:bg-[#1C1C1E]/90 text-[#1D1D1F] dark:text-[#F5F5F7] px-3 py-1 rounded-full text-[10.5px] font-mono backdrop-blur-md shadow-sm border border-black/[0.06] dark:border-white/[0.1] animate-fade-in">
            <span className="text-[#0071E3] dark:text-[#2997FF] font-semibold">
              Col {hoverCoord.cell.column}, Row {hoverCoord.cell.row}
            </span>
            <span className="text-[#86868B]">•</span>
            <span className="text-[#86868B]">
              {formatCoordinates(hoverCoord.xMeters, hoverCoord.yMeters)}
            </span>
          </div>
        )}

        {/* 4. Floating Node Inspector Card (Anchored to node) */}
        {selectedNodeDetails && hudPlacement && (
          <div
            className="absolute z-20 w-[310px] max-w-[calc(100%-1.5rem)] apple-card p-3.5 shadow-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl animate-fade-in transition-[left,top] duration-150 ease-out pointer-events-auto"
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
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
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

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-sans text-[#86868B]">
                  Node ID
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[#0071E3] dark:text-[#2997FF] font-bold">
                    #{selectedNodeDetails.node.id}
                  </span>
                  <button
                    onClick={() =>
                      handleCopyNodeId(selectedNodeDetails.node.id)
                    }
                    className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] transition-all cursor-pointer"
                    title="Copy Node ID"
                  >
                    {copiedNodeId ? (
                      <Check className="w-3 h-3 text-[#34C759]" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              {selectedNodeDetails.occupyingRobot && (
                <div className="p-2 rounded-xl bg-[#34C759]/10 dark:bg-[#30D158]/15 border border-[#34C759]/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#34C759] dark:text-[#30D158]" />
                    <div>
                      <span className="text-[11px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] block">
                        {selectedNodeDetails.occupyingRobot.id}
                      </span>
                      <span className="text-[9px] text-[#86868B] font-sans">
                        Battery:{" "}
                        {selectedNodeDetails.occupyingRobot.batteryPercent}%
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
          </div>
        )}

        {/* 5. Bottom Status HUD Pill */}
        <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1.5 bg-white/80 dark:bg-[#1C1C1E]/80 text-[#1D1D1F] dark:text-[#F5F5F7] px-2.5 py-1 rounded-full text-[10px] font-mono backdrop-blur-md shadow-xs border border-black/[0.06] dark:border-white/[0.08] transition-all select-none">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
            <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Graph Topology
            </span>
          </div>

          <span className="text-black/15 dark:text-white/15">•</span>
          <span className="text-[#86868B] dark:text-[#A1A1A6] tabular-nums">
            {topology?.nodes.length || 0} Nodes · {topology?.edges.length || 0}{" "}
            Edges
          </span>

          <span className="text-black/15 dark:text-white/15">•</span>
          <span className="text-[#0071E3] dark:text-[#2997FF] font-medium tabular-nums">
            {robots.length} Units
          </span>

          <span className="text-black/15 dark:text-white/15">•</span>
          <span className="text-[#86868B] dark:text-[#A1A1A6] tabular-nums">
            {(zoom * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
};
