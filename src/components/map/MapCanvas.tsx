import React, { useState, useRef, useMemo } from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  Eye,
  EyeOff,
  Navigation,
  Flag,
} from "lucide-react";
import {
  worldToScreen,
  cellToWorld,
  yawToScreenRotationDegrees,
} from "../../utils/coordinates/coordinates.ts";
import { formatCoordinates } from "../../utils/coordinates/coordinates.ts";

export const MapCanvas: React.FC = () => {
  const { t } = useAppConfig();
  const { snapshot, selectedRobotId, setSelectedRobotId } = useOperations();

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

  // Layer visibility toggles
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showObstacles, setShowObstacles] = useState<boolean>(true);
  const [showGoals, setShowGoals] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);

  // Mouse coordinate tracker for world coord tooltip
  const [hoverCoord, setHoverCoord] = useState<{
    xMeters: number;
    yMeters: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const widthCells = map?.widthCells || 16;
  const heightCells = map?.heightCells || 12;
  const resolution = map?.resolutionMeters || 0.5;
  const origin = map?.origin || { xMeters: 0, yMeters: 0 };

  const worldWidth = widthCells * resolution;
  const worldHeight = heightCells * resolution;

  // Base SVG viewBox dimension
  const baseWidth = 800;
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

  // Pre-calculate obstacle cells
  const obstacleCells = useMemo(() => {
    if (!map || !map.cells) return [];
    const blocked: Array<{ col: number; row: number }> = [];
    for (let row = 0; row < heightCells; row++) {
      for (let col = 0; col < widthCells; col++) {
        // Grid index: row-major (row 0 is bottom in world or row 0 is top in array)
        const idx = row * widthCells + col;
        if (map.cells[idx] === 1) {
          // World row is heightCells - 1 - row if stored top-down, or standard row
          blocked.push({ col, row: heightCells - 1 - row });
        }
      }
    }
    return blocked;
  }, [map, widthCells, heightCells]);

  // Handle Pan Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
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
        setHoverCoord({
          xMeters: origin.xMeters + normX * worldWidth,
          yMeters: origin.yMeters + (1 - normY) * worldHeight,
        });
      } else {
        setHoverCoord(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
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
    // Center bounding box of robots
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

  return (
    <div className="apple-card relative w-full h-[520px] sm:h-[600px] overflow-hidden flex flex-col select-none">
      {/* Map Header Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Map title & coordinates */}
        <div className="flex items-center gap-2 pointer-events-auto bg-white/85 dark:bg-[#1C1C1E]/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-apple-border shadow-xs text-xs font-semibold text-apple-text-primary">
          <span>{t("mapTitle")}</span>
          <span className="text-apple-divider">|</span>
          <span className="font-mono text-[11px] text-apple-text-secondary tabular-nums">
            {widthCells}×{heightCells} ({resolution}m/cell)
          </span>
          {hoverCoord && (
            <>
              <span className="text-apple-divider">|</span>
              <span className="font-mono text-[11px] text-apple-blue tabular-nums">
                {formatCoordinates(hoverCoord.xMeters, hoverCoord.yMeters)}
              </span>
            </>
          )}
        </div>

        {/* Right: Layer Toggles & Zoom Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto bg-white/85 dark:bg-[#1C1C1E]/85 backdrop-blur-md p-1 rounded-full border border-apple-border shadow-xs text-xs">
          {/* Layer toggles */}
          <button
            onClick={() => setShowGrid((p) => !p)}
            className={`px-2 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
              showGrid
                ? "bg-apple-blue/15 text-apple-blue font-semibold"
                : "text-apple-text-tertiary hover:text-apple-text-primary"
            }`}
            title="Toggle grid layer"
          >
            {showGrid ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3" />
            )}
            <span>{t("mapLayerGrid")}</span>
          </button>

          <button
            onClick={() => setShowObstacles((p) => !p)}
            className={`px-2 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
              showObstacles
                ? "bg-apple-blue/15 text-apple-blue font-semibold"
                : "text-apple-text-tertiary hover:text-apple-text-primary"
            }`}
            title="Toggle obstacles layer"
          >
            <span>{t("mapLayerObstacles")}</span>
          </button>

          <button
            onClick={() => setShowGoals((p) => !p)}
            className={`px-2 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
              showGoals
                ? "bg-apple-blue/15 text-apple-blue font-semibold"
                : "text-apple-text-tertiary hover:text-apple-text-primary"
            }`}
            title="Toggle goals layer"
          >
            <span>{t("mapLayerGoals")}</span>
          </button>

          <button
            onClick={() => setShowLabels((p) => !p)}
            className={`px-2 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
              showLabels
                ? "bg-apple-blue/15 text-apple-blue font-semibold"
                : "text-apple-text-tertiary hover:text-apple-text-primary"
            }`}
            title="Toggle labels layer"
          >
            <span>{t("mapLayerLabels")}</span>
          </button>

          <span className="text-apple-divider">|</span>

          {/* Zoom controls */}
          <button
            onClick={handleZoomIn}
            className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-apple-text-primary"
            title={t("mapZoomIn")}
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-apple-text-primary"
            title={t("mapZoomOut")}
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFitFleet}
            className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-apple-text-primary"
            title={t("mapFitFleet")}
            aria-label="Fit fleet"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetView}
            className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-apple-text-primary"
            title={t("mapResetView")}
            aria-label="Reset map view"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Map SVG Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full h-full flex items-center justify-center bg-black/[0.02] dark:bg-black/[0.3] ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <svg
          viewBox={`0 0 ${baseWidth} ${baseHeight}`}
          className="w-full h-full max-h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
        >
          {/* Background Map Frame */}
          <rect
            x="0"
            y="0"
            width={baseWidth}
            height={baseHeight}
            fill="var(--apple-surface)"
            stroke="var(--apple-border)"
            strokeWidth="1.5"
            rx="8"
          />

          {/* 1. Grid Lines Layer */}
          {showGrid && (
            <g opacity="0.35">
              {Array.from({ length: widthCells + 1 }).map((_, i) => {
                const x = (i / widthCells) * baseWidth;
                return (
                  <line
                    key={`gx-${i}`}
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={baseHeight}
                    stroke="var(--apple-text-tertiary)"
                    strokeWidth="0.75"
                    strokeDasharray={i % 4 === 0 ? "none" : "2,2"}
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
                    stroke="var(--apple-text-tertiary)"
                    strokeWidth="0.75"
                    strokeDasharray={i % 4 === 0 ? "none" : "2,2"}
                  />
                );
              })}
            </g>
          )}

          {/* 2. Obstacles Layer */}
          {showObstacles && (
            <g>
              {obstacleCells.map((cell, idx) => {
                const cellW = baseWidth / widthCells;
                const cellH = baseHeight / heightCells;
                // Grid cell to screen: col is x, row is y inverted
                const x = cell.col * cellW;
                const y = (heightCells - 1 - cell.row) * cellH;

                return (
                  <rect
                    key={`obs-${idx}`}
                    x={x + 1}
                    y={y + 1}
                    width={cellW - 2}
                    height={cellH - 2}
                    rx="3"
                    className="fill-zinc-300 dark:fill-zinc-700/80 stroke-zinc-400 dark:stroke-zinc-600"
                    strokeWidth="0.5"
                  />
                );
              })}
            </g>
          )}

          {/* 3. Goal Locations Layer (from Active Orders) */}
          {showGoals && (
            <g>
              {orders.map((order) => {
                return order.assignments.map((assign, aIdx) => {
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

                  return (
                    <g key={`goal-${order.id}-${aIdx}`}>
                      {/* Destination target ring */}
                      <circle
                        cx={screenPos.x}
                        cy={screenPos.y}
                        r="14"
                        fill="rgba(0, 113, 227, 0.08)"
                        stroke="#0071E3"
                        strokeWidth="1.5"
                        strokeDasharray="3,3"
                      />
                      <circle
                        cx={screenPos.x}
                        cy={screenPos.y}
                        r="4"
                        fill="#0071E3"
                      />
                      {showLabels && (
                        <text
                          x={screenPos.x}
                          y={screenPos.y + 24}
                          textAnchor="middle"
                          className="fill-apple-text-secondary text-[9px] font-mono font-medium select-none"
                        >
                          Goal ({assign.goalColumn},{assign.goalRow})
                        </text>
                      )}
                    </g>
                  );
                });
              })}
            </g>
          )}

          {/* 4. Robots Footprint & Orientation Layer */}
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
                  onClick={() => setSelectedRobotId(robot.id)}
                  className="cursor-pointer group"
                >
                  {/* Selection Focus Ring */}
                  {isSelected && (
                    <circle
                      cx={screenPos.x}
                      cy={screenPos.y}
                      r="22"
                      fill="rgba(0, 113, 227, 0.15)"
                      stroke="#0071E3"
                      strokeWidth="2"
                    />
                  )}

                  {/* Robot Base Footprint Circle */}
                  <circle
                    cx={screenPos.x}
                    cy={screenPos.y}
                    r="12"
                    fill="var(--apple-surface)"
                    stroke={robotColor}
                    strokeWidth="2.5"
                    className="shadow-sm transition-transform duration-100 group-hover:scale-110"
                  />

                  {/* Orientation Heading Arrow */}
                  <g
                    transform={`translate(${screenPos.x}, ${screenPos.y}) rotate(${rotationDeg})`}
                  >
                    <polygon points="8,0 0,-4 2,0 0,4" fill={robotColor} />
                  </g>

                  {/* Center Dot */}
                  <circle
                    cx={screenPos.x}
                    cy={screenPos.y}
                    r="3"
                    fill={robotColor}
                  />

                  {/* Robot ID Label */}
                  {showLabels && (
                    <g
                      transform={`translate(${screenPos.x}, ${screenPos.y + 20})`}
                    >
                      <rect
                        x="-24"
                        y="-7"
                        width="48"
                        height="14"
                        rx="4"
                        fill="var(--apple-surface)"
                        stroke="var(--apple-border)"
                        strokeWidth="0.75"
                        opacity="0.9"
                      />
                      <text
                        x="0"
                        y="3"
                        textAnchor="middle"
                        className={`text-[9px] font-mono font-bold select-none ${
                          isSelected
                            ? "fill-apple-blue font-extrabold"
                            : "fill-apple-text-primary"
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
      </div>

      {/* Bottom Coordinate System Indicator */}
      <div className="absolute bottom-3 left-3 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-apple-border text-[10px] font-mono text-apple-text-secondary flex items-center gap-2">
        <span className="font-semibold text-apple-text-primary">+X East →</span>
        <span className="font-semibold text-apple-text-primary">
          +Y North ↑
        </span>
        <span className="text-apple-text-tertiary">Yaw: CCW rad</span>
      </div>
    </div>
  );
};
