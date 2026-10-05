import { NodeMoveConfirmation } from "./NodeMoveConfirmation.tsx";
import { useRobotTrails } from "./useRobotTrails.ts";
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import {
  Zap,
  ShieldAlert,
  PauseCircle,
  Inbox,
  Package,
  MapPin,
  X,
  Copy,
  Check,
  Layers,
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
import type { Robot } from "../../domain/robot/types.ts";
import { copyToClipboard } from "../../utils/ids/ids.ts";
import { formatDistanceMeters } from "../../utils/units/units.ts";
import { MapCanvasHeader } from "./MapCanvasHeader.tsx";

export interface FastMapCanvasProps {
  viewMode?: "canvas" | "graph" | "accessible";
  onToggleViewMode?: (mode: "canvas" | "graph" | "accessible") => void;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
}

export const FastMapCanvas: React.FC<FastMapCanvasProps> = ({
  viewMode = "canvas",
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
    robotPlacementNodeIds,
    selectedNodeId,
    setSelectedNodeId,
    clickNode,
    topology,
  } = useOperations();

  const map = snapshot?.map;
  const robots = useMemo(() => snapshot?.robots || [], [snapshot?.robots]);
  const robotTrails = useRobotTrails(robots, `${map?.mapId}:${map?.revision}`);
  const orders = useMemo(() => snapshot?.orders || [], [snapshot?.orders]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Layer Visibility
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showGoals, setShowGoals] = useState<boolean>(true);
  const [showTrails, setShowTrails] = useState<boolean>(true);
  const [copiedNodeId, setCopiedNodeId] = useState<boolean>(false);

  // Mouse hover tracking
  const [hoverCoord, setHoverCoord] = useState<{
    xMeters: number;
    yMeters: number;
    cell: GridCell;
  } | null>(null);

  // Performance metrics state (HUD)
  const [fps, setFps] = useState<number>(60);
  const [renderTimeMs, setRenderTimeMs] = useState<number>(0);
  const [visibleRobotCount, setVisibleRobotCount] = useState<number>(0);

  const widthCells = map?.widthCells || 32;
  const heightCells = map?.heightCells || 20;
  const resolution = map?.resolutionMeters || 1.0;
  const origin = map?.origin || { xMeters: 0, yMeters: 0 };

  const worldWidth = widthCells * resolution;
  const worldHeight = heightCells * resolution;

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

  // Selected Node Details
  const selectedNodeDetails = useMemo(() => {
    if (selectedNodeId === null || !topology) return null;
    const node = topology.nodeMap.get(selectedNodeId);
    if (!node) return null;
    const uiMeta = getNodeTypeUiMeta(node.type);
    return { node, uiMeta };
  }, [selectedNodeId, topology]);

  // Selected Node Screen Position for Popover HUD
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

  // Performance measurement refs
  const frameCountRef = useRef<number>(0);
  const accumulatedRenderTimeRef = useRef<number>(0);
  const lastFpsCalcRef = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);

  // Offscreen canvas for static background cache
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pre-render static background to offscreen canvas with full Apple Design Aesthetics
  useEffect(() => {
    if (!map) return;

    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = baseWidth * 2; // 2x for retina crispness
    bgCanvas.height = baseHeight * 2;
    const bgCtx = bgCanvas.getContext("2d");
    if (!bgCtx) return;

    bgCtx.scale(bgCanvas.width / baseWidth, bgCanvas.height / baseHeight);

    // 1. Clear background surface
    bgCtx.fillStyle = isDark ? "#161618" : "#FBFBFD";
    bgCtx.beginPath();
    bgCtx.roundRect(0, 0, baseWidth, baseHeight, 16);
    bgCtx.fill();

    const cellW = baseWidth / widthCells;
    const cellH = baseHeight / heightCells;

    // 2. Grid lines & Pod Storage Racks
    for (let r = 0; r < heightCells; r++) {
      for (let c = 0; c < widthCells; c++) {
        const idx = r * widthCells + c;
        const isBlocked = map.cells[idx] === 1;
        const x = c * cellW;
        const y = (heightCells - 1 - r) * cellH;

        if (isBlocked) {
          // Structural Pillar (Pristine 3D bevel effect)
          bgCtx.save();
          bgCtx.fillStyle = isDark ? "#27272A" : "#E2E8F0";
          bgCtx.beginPath();
          bgCtx.roundRect(x + 2, y + 2, cellW - 4, cellH - 4, 6);
          bgCtx.fill();

          bgCtx.lineWidth = 1;
          bgCtx.strokeStyle = isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(0,0,0,0.08)";
          bgCtx.stroke();

          // Pillar Center Core
          bgCtx.fillStyle = isDark ? "#52525B" : "#94A3B8";
          bgCtx.beginPath();
          bgCtx.arc(
            x + cellW / 2,
            y + cellH / 2,
            Math.min(cellW, cellH) * 0.22,
            0,
            Math.PI * 2,
          );
          bgCtx.fill();
          bgCtx.restore();
        } else {
          // Check if inside Pod Storage Rack Block (Rows 4 to 15, excluding crossway row 10 and charger walls)
          const isPodStorage =
            r >= 4 &&
            r <= heightCells - 5 &&
            r !== 10 &&
            c > 0 &&
            c < widthCells - 1;

          if (isPodStorage) {
            // Subtle Pod Rack Footprint Texture
            bgCtx.fillStyle = isDark
              ? "rgba(99, 102, 241, 0.05)"
              : "rgba(99, 102, 241, 0.035)";
            bgCtx.beginPath();
            bgCtx.roundRect(x + 1.5, y + 1.5, cellW - 3, cellH - 3, 3);
            bgCtx.fill();
            bgCtx.strokeStyle = isDark
              ? "rgba(99, 102, 241, 0.12)"
              : "rgba(99, 102, 241, 0.08)";
            bgCtx.lineWidth = 0.5;
            bgCtx.stroke();
          } else {
            // Traversable Highway / Aisle Cell
            bgCtx.strokeStyle = isDark
              ? "rgba(255, 255, 255, 0.04)"
              : "rgba(0, 0, 0, 0.045)";
            bgCtx.lineWidth = 0.75;
            bgCtx.strokeRect(x, y, cellW, cellH);
          }
        }
      }
    }

    // 3. Highway Direction Markers
    // Row 2 (Eastbound Outbound Highway)
    bgCtx.fillStyle = isDark
      ? "rgba(0, 113, 227, 0.12)"
      : "rgba(0, 113, 227, 0.08)";
    const hwy2Y = (heightCells - 1 - 2) * cellH;
    bgCtx.fillRect(cellW, hwy2Y + 1, (widthCells - 2) * cellW, cellH - 2);

    // Row height - 3 (Westbound Inbound Highway)
    bgCtx.fillStyle = isDark
      ? "rgba(16, 185, 129, 0.12)"
      : "rgba(16, 185, 129, 0.08)";
    const hwyInY = (heightCells - 1 - (heightCells - 3)) * cellH;
    bgCtx.fillRect(cellW, hwyInY + 1, (widthCells - 2) * cellW, cellH - 2);

    // Central Crossway (Row 10)
    bgCtx.fillStyle = isDark
      ? "rgba(245, 158, 11, 0.08)"
      : "rgba(245, 158, 11, 0.05)";
    const hwyCrossY = (heightCells - 1 - 10) * cellH;
    bgCtx.fillRect(cellW, hwyCrossY + 1, (widthCells - 2) * cellW, cellH - 2);

    // 4. Specialized Station Nodes (Workstations, Chutes, Chargers, Buffers)
    if (topology) {
      const cellMin = Math.min(cellW, cellH);
      const isCompact = cellMin < 22;
      const pad = Math.max(1, cellMin * 0.08);

      for (const node of topology.nodes) {
        if (node.type === "waypoint" || node.type === "pillar") continue;

        const x = node.column * cellW;
        const y = (heightCells - 1 - node.row) * cellH;
        const cx = x + cellW / 2;
        const cy = y + cellH / 2;

        bgCtx.save();

        if (node.type === "pick") {
          // Amber / Gold Pick Point directly in front of rack
          bgCtx.fillStyle = isDark
            ? "rgba(245, 158, 11, 0.16)"
            : "rgba(245, 158, 11, 0.12)";
          bgCtx.beginPath();
          bgCtx.roundRect(
            x + pad,
            y + pad,
            cellW - pad * 2,
            cellH - pad * 2,
            Math.min(6, cellMin * 0.25),
          );
          bgCtx.fill();
          bgCtx.lineWidth = isCompact ? 1.0 : 1.4;
          bgCtx.strokeStyle = isDark ? "#FBBF24" : "#F59E0B";
          bgCtx.stroke();

          bgCtx.fillStyle = isDark
            ? "rgba(245, 158, 11, 0.3)"
            : "rgba(245, 158, 11, 0.2)";
          bgCtx.beginPath();
          bgCtx.arc(cx, cy, cellMin * 0.32, 0, Math.PI * 2);
          bgCtx.fill();

          bgCtx.fillStyle = isDark ? "#FBBF24" : "#D97706";
          bgCtx.font = isCompact
            ? "900 5.5px 'JetBrains Mono', monospace"
            : "900 7px 'JetBrains Mono', monospace";
          bgCtx.textAlign = "center";
          bgCtx.textBaseline = "middle";
          bgCtx.fillText(isCompact ? "PK" : "PICK", cx, cy + 0.5);
        } else if (node.type === "place" || node.type === "workstation") {
          // Cyan Place Station (Straight Feeder)
          bgCtx.fillStyle = isDark
            ? "rgba(6, 182, 212, 0.16)"
            : "rgba(6, 182, 212, 0.12)";
          bgCtx.beginPath();
          bgCtx.roundRect(
            x + pad,
            y + pad,
            cellW - pad * 2,
            cellH - pad * 2,
            Math.min(6, cellMin * 0.25),
          );
          bgCtx.fill();
          bgCtx.lineWidth = isCompact ? 1.0 : 1.4;
          bgCtx.strokeStyle = isDark ? "#22D3EE" : "#06B6D4";
          bgCtx.stroke();

          bgCtx.fillStyle = isDark
            ? "rgba(6, 182, 212, 0.3)"
            : "rgba(6, 182, 212, 0.2)";
          bgCtx.beginPath();
          bgCtx.arc(cx, cy, cellMin * 0.32, 0, Math.PI * 2);
          bgCtx.fill();

          bgCtx.fillStyle = isDark ? "#22D3EE" : "#0891B2";
          bgCtx.font = isCompact
            ? "900 5.5px 'JetBrains Mono', monospace"
            : "900 7px 'JetBrains Mono', monospace";
          bgCtx.textAlign = "center";
          bgCtx.textBaseline = "middle";
          bgCtx.fillText(isCompact ? "PL" : "PLACE", cx, cy + 0.5);
        } else if (node.type === "chute") {
          // Emerald Chute (Place Station)
          bgCtx.fillStyle = isDark
            ? "rgba(16, 185, 129, 0.16)"
            : "rgba(16, 185, 129, 0.12)";
          bgCtx.beginPath();
          bgCtx.roundRect(
            x + pad,
            y + pad,
            cellW - pad * 2,
            cellH - pad * 2,
            Math.min(6, cellMin * 0.25),
          );
          bgCtx.fill();
          bgCtx.lineWidth = isCompact ? 1.0 : 1.4;
          bgCtx.strokeStyle = isDark ? "#34D399" : "#10B981";
          bgCtx.stroke();

          bgCtx.fillStyle = isDark
            ? "rgba(16, 185, 129, 0.3)"
            : "rgba(16, 185, 129, 0.2)";
          bgCtx.beginPath();
          bgCtx.arc(cx, cy, cellMin * 0.32, 0, Math.PI * 2);
          bgCtx.fill();

          bgCtx.fillStyle = isDark ? "#34D399" : "#059669";
          bgCtx.font = isCompact
            ? "900 5.5px 'JetBrains Mono', monospace"
            : "900 6.5px 'JetBrains Mono', monospace";
          bgCtx.textAlign = "center";
          bgCtx.textBaseline = "middle";
          bgCtx.fillText(isCompact ? "CH" : "CHUTE", cx, cy + 0.5);
        } else if (node.type === "charger") {
          // Amber Automated Charger Bay
          bgCtx.fillStyle = isDark
            ? "rgba(245, 158, 11, 0.16)"
            : "rgba(245, 158, 11, 0.12)";
          bgCtx.beginPath();
          bgCtx.roundRect(
            x + pad,
            y + pad,
            cellW - pad * 2,
            cellH - pad * 2,
            Math.min(6, cellMin * 0.25),
          );
          bgCtx.fill();
          bgCtx.lineWidth = isCompact ? 1.0 : 1.4;
          bgCtx.strokeStyle = isDark ? "#FBBF24" : "#F59E0B";
          bgCtx.stroke();

          bgCtx.fillStyle = isDark ? "#FBBF24" : "#D97706";
          bgCtx.font = isCompact
            ? "bold 7.5px system-ui, sans-serif"
            : "900 7.5px 'JetBrains Mono', monospace";
          bgCtx.textAlign = "center";
          bgCtx.textBaseline = "middle";
          bgCtx.fillText(isCompact ? "⚡" : "⚡CHG", cx, cy + 0.5);
        } else if (node.type === "buffer") {
          // Purple Buffer Staging Area
          bgCtx.fillStyle = isDark
            ? "rgba(139, 92, 246, 0.16)"
            : "rgba(139, 92, 246, 0.12)";
          bgCtx.beginPath();
          bgCtx.roundRect(
            x + pad,
            y + pad,
            cellW - pad * 2,
            cellH - pad * 2,
            Math.min(6, cellMin * 0.25),
          );
          bgCtx.fill();
          bgCtx.lineWidth = isCompact ? 0.9 : 1.2;
          bgCtx.strokeStyle = isDark ? "#A78BFA" : "#8B5CF6";
          bgCtx.setLineDash([3, 2]);
          bgCtx.stroke();
          bgCtx.setLineDash([]);

          bgCtx.fillStyle = isDark ? "#A78BFA" : "#7C3AED";
          bgCtx.font = isCompact
            ? "bold 6.5px system-ui, sans-serif"
            : "bold 9px system-ui, -apple-system, sans-serif";
          bgCtx.textAlign = "center";
          bgCtx.textBaseline = "middle";
          bgCtx.fillText("P", cx, cy + 0.5);
        } else if (node.type === "rack") {
          // Indigo 3D Tiered Storage Rack Pod
          const rw = cellW - pad * 2;
          const rh = cellH - pad * 2;
          const rx = x + pad;
          const ry = y + pad;

          // Outer Pod Enclosure Base
          bgCtx.fillStyle = isDark
            ? "rgba(99, 102, 241, 0.18)"
            : "rgba(99, 102, 241, 0.10)";
          bgCtx.beginPath();
          bgCtx.roundRect(rx, ry, rw, rh, Math.min(4, cellMin * 0.2));
          bgCtx.fill();

          // Metallic Outer Frame Outline
          bgCtx.lineWidth = isCompact ? 0.9 : 1.2;
          bgCtx.strokeStyle = isDark ? "#818CF8" : "#6366F1";
          bgCtx.stroke();

          // Tiered Shelf Dividers
          const tierH = rh / 3;
          bgCtx.strokeStyle = isDark
            ? "rgba(165, 180, 252, 0.4)"
            : "rgba(99, 102, 241, 0.35)";
          bgCtx.lineWidth = 0.8;
          bgCtx.beginPath();
          bgCtx.moveTo(rx + 2, ry + tierH);
          bgCtx.lineTo(rx + rw - 2, ry + tierH);
          bgCtx.moveTo(rx + 2, ry + tierH * 2);
          bgCtx.lineTo(rx + rw - 2, ry + tierH * 2);
          bgCtx.stroke();

          // Small Tote / Package Accents inside shelves
          bgCtx.fillStyle = isDark
            ? "rgba(99, 102, 241, 0.7)"
            : "rgba(99, 102, 241, 0.55)";
          bgCtx.fillRect(
            rx + 2,
            ry + 1.5,
            Math.max(2, rw * 0.42),
            Math.max(1, tierH - 2.5),
          );
          bgCtx.fillStyle = isDark
            ? "rgba(245, 158, 11, 0.7)"
            : "rgba(245, 158, 11, 0.55)";
          bgCtx.fillRect(
            rx + rw * 0.48,
            ry + tierH + 1.5,
            Math.max(2, rw * 0.42),
            Math.max(1, tierH - 2.5),
          );
        }

        bgCtx.restore();
      }
    }

    bgCanvasRef.current = bgCanvas;
  }, [map, topology, baseWidth, baseHeight, widthCells, heightCells, isDark]);

  // Main 60 FPS Render Loop
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const t0 = performance.now();
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    if (
      canvas.width !== rect.width * dpr ||
      canvas.height !== rect.height * dpr
    ) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }

    ctx.save();
    ctx.scale(canvas.width / rect.width, canvas.height / rect.height);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Apply Pan and Zoom
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // 1. Draw Cached Background Layer
    if (bgCanvasRef.current) {
      ctx.drawImage(bgCanvasRef.current, 0, 0, baseWidth, baseHeight);
    }

    const cellW = baseWidth / widthCells;
    const cellH = baseHeight / heightCells;

    // Calculate Viewport Frustum in Canvas coordinate space
    const viewLeft = -pan.x / zoom;
    const viewTop = -pan.y / zoom;
    const viewRight = (rect.width - pan.x) / zoom;
    const viewBottom = (rect.height - pan.y) / zoom;

    // 2. Hovered Cell Focus Indicator
    if (hoverCoord) {
      const hx = (hoverCoord.cell.column / widthCells) * baseWidth;
      const hy =
        ((heightCells - 1 - hoverCoord.cell.row) / heightCells) * baseHeight;
      ctx.save();
      ctx.fillStyle = isDark
        ? "rgba(41, 151, 255, 0.16)"
        : "rgba(0, 113, 227, 0.12)";
      ctx.beginPath();
      ctx.roundRect(hx + 1, hy + 1, cellW - 2, cellH - 2, 5);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isDark ? "#2997FF" : "#0071E3";
      ctx.stroke();
      ctx.restore();
    }

    // 3. Selected Node Focus Halo
    if (topology) {
      ctx.save();
      for (const [index, id] of robotPlacementNodeIds.entries()) {
        const node = topology.nodeMap.get(id);
        if (!node) continue;
        const nx = node.column * cellW;
        const ny = (heightCells - 1 - node.row) * cellH;
        ctx.fillStyle = "rgba(0, 113, 227, 0.3)";
        ctx.strokeStyle = "#0071E3";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(nx + 1, ny + 1, cellW - 2, cellH - 2, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#0071E3";
        ctx.font = `bold ${Math.max(8, Math.min(14, cellW * 0.4))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(index + 1), nx + cellW / 2, ny + cellH / 2);
      }
      ctx.restore();
    }
    if (selectedNodeId !== null && topology) {
      const node = topology.nodeMap.get(selectedNodeId);
      if (node) {
        const nx = node.column * cellW;
        const ny = (heightCells - 1 - node.row) * cellH;
        const ui = getNodeTypeUiMeta(node.type);

        ctx.save();
        ctx.fillStyle = ui.glowColor;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.roundRect(nx, ny, cellW, cellH, 7);
        ctx.fill();

        ctx.globalAlpha = 1.0;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = ui.strokeColor;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 4. Observed movement trail, displayed as a dashed line.
    if (showTrails) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      for (const [robotId, trail] of robotTrails.current) {
        if (trail.points.length < 2) continue;
        const selected = robotId === selectedRobotId;
        ctx.strokeStyle = isDark ? "#64D2FF" : "#0071E3";
        ctx.globalAlpha = selected ? 1 : 0.65;
        ctx.lineWidth = (selected ? 3 : 2) / zoom;
        ctx.beginPath();
        trail.points.forEach((point, index) => {
          const screen = worldToScreen(point, mapDim, baseWidth, baseHeight);
          if (index === 0) ctx.moveTo(screen.x, screen.y);
          else ctx.lineTo(screen.x, screen.y);
        });
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. Active Order Goals (Target Reticle)
    const cellMin = Math.min(cellW, cellH);
    const isCompactFleet = cellMin < 22;
    const robotRadius = cellMin * 0.38;
    const haloRadius = robotRadius * 1.6;
    const arrowTip = robotRadius * 0.72;
    const arrowBase = robotRadius * 0.36;

    if (showGoals && orders.length > 0) {
      ctx.save();
      for (const order of orders) {
        if (["Completed", "Cancelled", "Rejected"].includes(order.state))
          continue;
        for (const assign of order.assignments) {
          const gx = (assign.goalColumn + 0.5) * cellW;
          const gy = (heightCells - 1 - assign.goalRow + 0.5) * cellH;

          if (
            gx < viewLeft - 30 ||
            gx > viewRight + 30 ||
            gy < viewTop - 30 ||
            gy > viewBottom + 30
          ) {
            continue;
          }

          const isAssignedToSelected = assign.robotId === selectedRobotId;
          const goalR = isAssignedToSelected ? cellMin * 0.55 : cellMin * 0.4;

          ctx.beginPath();
          ctx.arc(gx, gy, goalR, 0, Math.PI * 2);
          ctx.fillStyle = isAssignedToSelected
            ? "rgba(0, 113, 227, 0.2)"
            : "rgba(0, 113, 227, 0.08)";
          ctx.fill();
          ctx.strokeStyle = isDark ? "#2997FF" : "#0071E3";
          ctx.lineWidth = isAssignedToSelected ? 2 : 1.2;
          ctx.setLineDash([4, 3]);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(gx, gy, Math.max(2, cellMin * 0.1), 0, Math.PI * 2);
          ctx.fillStyle = isDark ? "#2997FF" : "#0071E3";
          ctx.fill();
        }
      }
      ctx.restore();
    }

    ctx.save();
    for (const robot of robots) {
      const state = robot.bufferState;
      if (
        !state?.buffer ||
        state.mapId !== map?.mapId ||
        state.mapRevision !== map?.revision
      )
        continue;
      const bx = (state.buffer.column + 0.5) * cellW;
      const by = (heightCells - 1 - state.buffer.row + 0.5) * cellH;
      ctx.strokeStyle = state.bufferOccupied ? "#F59E0B" : "#AF52DE";
      ctx.lineWidth = 2;
      ctx.setLineDash(state.bufferOccupied ? [] : [3, 2]);
      ctx.strokeRect(
        bx - cellW * 0.42,
        by - cellH * 0.42,
        cellW * 0.84,
        cellH * 0.84,
      );
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.fillText(state.bufferOccupied ? "WAIT" : "RSV", bx, by - cellH * 0.3);
    }
    ctx.restore();

    // 6. Batch Draw Robots with LOD (Level of Detail) & Frustum Culling
    let visibleRobots = 0;
    const isLODCompact = zoom < 0.6;

    for (let i = 0; i < robots.length; i++) {
      const robot = robots[i];
      const screenPos = worldToScreen(
        { x: robot.pose.xMeters, y: robot.pose.yMeters },
        mapDim,
        baseWidth,
        baseHeight,
      );

      // Frustum Culling Check
      if (
        screenPos.x < viewLeft - 40 ||
        screenPos.x > viewRight + 40 ||
        screenPos.y < viewTop - 40 ||
        screenPos.y > viewBottom + 40
      ) {
        continue;
      }

      visibleRobots++;

      const isSelected = robot.id === selectedRobotId;
      const isExecuting = robot.operationalState === "EXECUTING";
      const isCharging = robot.operationalState === "CHARGING";
      const isDisconnected = robot.connectivity === "DISCONNECTED";
      const isSafetyAlert =
        robot.safety !== "NORMAL" && robot.safety !== "WAIT";

      const robotColor = isDisconnected
        ? "#FF453A"
        : isSafetyAlert
          ? "#FF9F0A"
          : isCharging
            ? isDark
              ? "#FFD60A"
              : "#FF9500"
            : isExecuting
              ? "#30D158"
              : isDark
                ? "#2997FF"
                : "#0071E3";

      ctx.save();
      ctx.translate(screenPos.x, screenPos.y);

      if (isSelected) {
        // Selection Focus Halo Glow
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          isLODCompact ? haloRadius * 0.8 : haloRadius,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = isDark
          ? "rgba(41, 151, 255, 0.25)"
          : "rgba(0, 113, 227, 0.2)";
        ctx.fill();
        ctx.lineWidth = Math.max(1.5, robotRadius * 0.2);
        ctx.strokeStyle = isDark ? "#2997FF" : "#0071E3";
        ctx.stroke();
      }

      if (isLODCompact) {
        // LOD Level 1: Compact Circular Dot
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(3, robotRadius * 0.7), 0, Math.PI * 2);
        ctx.fillStyle = robotColor;
        ctx.fill();
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = isDark ? "#1C1C1E" : "#FFFFFF";
        ctx.stroke();
      } else {
        // LOD Level 2: Full Detailed Robot Chassis & Direction Arrow
        ctx.beginPath();
        ctx.arc(0, 0, robotRadius, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "#1C1C1E" : "#FFFFFF";
        ctx.fill();
        ctx.lineWidth = isSelected
          ? Math.max(2, robotRadius * 0.25)
          : Math.max(1.2, robotRadius * 0.18);
        ctx.strokeStyle = robotColor;
        ctx.stroke();

        // Heading Direction Chevron
        const rotDeg = yawToScreenRotationDegrees(robot.pose.yawRadians);
        ctx.save();
        ctx.rotate((rotDeg * Math.PI) / 180);
        ctx.beginPath();
        ctx.moveTo(arrowTip, 0);
        ctx.lineTo(0, -arrowBase);
        ctx.lineTo(arrowTip * 0.25, 0);
        ctx.lineTo(0, arrowBase);
        ctx.closePath();
        ctx.fillStyle = robotColor;
        ctx.fill();
        ctx.restore();

        // Center Pivot Dot
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1.2, robotRadius * 0.25), 0, Math.PI * 2);
        ctx.fillStyle = robotColor;
        ctx.fill();

        // Floating Monospace ID Badge (Apple Pill Design)
        // In compact 100 units mode, show labels for selected robot or when zoomed in
        const shouldShowLabel =
          isSelected || (showLabels && (!isCompactFleet || zoom >= 1.2));

        if (shouldShowLabel) {
          const fontSize = isCompactFleet ? 7 : 8.5;
          ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const displayId =
            isCompactFleet && !isSelected
              ? robot.id.replace("robot-", "")
              : robot.id;
          const textWidth = ctx.measureText(displayId).width;
          const badgeW = Math.max(
            textWidth + (isCompactFleet ? 6 : 10),
            isCompactFleet ? 24 : 44,
          );
          const badgeH = isCompactFleet ? 11 : 14;
          const badgeY = robotRadius + (isCompactFleet ? 3 : 5);

          ctx.fillStyle = isDark
            ? "rgba(28, 28, 30, 0.95)"
            : "rgba(255, 255, 255, 0.95)";
          ctx.beginPath();
          ctx.roundRect(-badgeW / 2, badgeY, badgeW, badgeH, 3.5);
          ctx.fill();
          ctx.lineWidth = 0.75;
          ctx.strokeStyle = isSelected
            ? isDark
              ? "#2997FF"
              : "#0071E3"
            : isDark
              ? "rgba(255, 255, 255, 0.12)"
              : "rgba(0, 0, 0, 0.08)";
          ctx.stroke();

          ctx.fillStyle = isSelected
            ? isDark
              ? "#2997FF"
              : "#0071E3"
            : isDark
              ? "#F5F5F7"
              : "#1D1D1F";
          ctx.fillText(displayId, 0, badgeY + badgeH / 2 + 0.5);
        }
      }

      ctx.restore();
    }

    ctx.restore();

    const t1 = performance.now();
    const frameDuration = t1 - t0;
    accumulatedRenderTimeRef.current += frameDuration;
    frameCountRef.current++;

    // Calculate smoothed FPS and average render time every 600ms (eliminates React re-render thrashing & ms flicker)
    if (t1 - lastFpsCalcRef.current >= 600) {
      const elapsed = t1 - lastFpsCalcRef.current;
      const computedFps = Math.round((frameCountRef.current * 1000) / elapsed);
      const avgRenderMs = Number(
        (accumulatedRenderTimeRef.current / frameCountRef.current).toFixed(1),
      );
      setFps(computedFps);
      setRenderTimeMs(avgRenderMs);
      setVisibleRobotCount(visibleRobots);
      frameCountRef.current = 0;
      accumulatedRenderTimeRef.current = 0;
      lastFpsCalcRef.current = t1;
    }

    rafRef.current = requestAnimationFrame(renderFrame);
  }, [
    pan,
    zoom,
    robots,
    orders,
    selectedRobotId,
    robotPlacementNodeIds,
    selectedNodeId,
    robotTrails,
    hoverCoord,
    topology,
    mapDim,
    baseWidth,
    baseHeight,
    widthCells,
    heightCells,
    showLabels,
    showGoals,
    showTrails,
    isDark,
    resolution,
    origin,
  ]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [renderFrame]);

  // Spatial Hit-testing on Click / MouseMove
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const distMoved = Math.hypot(
      e.clientX - mouseDownPosRef.current.x,
      e.clientY - mouseDownPosRef.current.y,
    );
    if (distMoved > 5) return; // Ignore drag clicks

    const rect = canvas.getBoundingClientRect();
    const clickCanvasX = (e.clientX - rect.left - pan.x) / zoom;
    const clickCanvasY = (e.clientY - rect.top - pan.y) / zoom;

    // 1. Check robot hits
    let clickedRobot: Robot | null = null;
    let minDistance = 20;

    for (const robot of robots) {
      const pos = worldToScreen(
        { x: robot.pose.xMeters, y: robot.pose.yMeters },
        mapDim,
        baseWidth,
        baseHeight,
      );
      const d = Math.hypot(clickCanvasX - pos.x, clickCanvasY - pos.y);
      if (d < minDistance) {
        minDistance = d;
        clickedRobot = robot;
      }
    }

    if (clickedRobot) {
      setSelectedRobotId(clickedRobot.id);
      return;
    }

    // 2. Check station node hits
    if (topology) {
      const cellW = baseWidth / widthCells;
      const cellH = baseHeight / heightCells;
      for (const node of topology.nodes) {
        const nx = (node.column + 0.5) * cellW;
        const ny = (heightCells - 1 - node.row + 0.5) * cellH;
        if (Math.hypot(clickCanvasX - nx, clickCanvasY - ny) < 16) {
          void clickNode(node.id);
          return;
        }
      }
    }

    setSelectedNodeId(null);
  };

  // Pan and Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return;
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

    // Track hovered world coordinates
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
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

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.3), 5.0);

    const canvas = canvasRef.current;
    if (!canvas) {
      setZoom(newZoom);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setPan({
      x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
      y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
    });
    setZoom(newZoom);
  };

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

  const handleResetView = () => {
    fitViewToContainer();
  };

  const handleFocusSelected = () => {
    const selected = robots.find((r) => r.id === selectedRobotId);
    if (!selected || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
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

  const handleCopyNodeId = async (id: number) => {
    await copyToClipboard(String(id));
    setCopiedNodeId(true);
    setTimeout(() => setCopiedNodeId(false), 1800);
  };

  return (
    <div
      ref={containerRef}
      className="apple-card flex flex-col h-full min-h-[400px] relative overflow-hidden transition-colors duration-300 select-none"
    >
      {/* Top Apple Glassmorphic Toolbar */}
      <MapCanvasHeader
        viewMode={viewMode}
        onToggleViewMode={onToggleViewMode}
        headerLeft={headerLeft}
        headerRight={headerRight}
        onZoomIn={() => setZoom((z) => Math.min(z * 1.25, 5))}
        onZoomOut={() => setZoom((z) => Math.max(z * 0.8, 0.3))}
        onResetView={handleResetView}
        layers={[
          {
            id: "labels",
            label: t("mapLayerLabels"),
            active: showLabels,
            onToggle: () => setShowLabels((v) => !v),
          },
          {
            id: "goals",
            label: t("mapLayerGoals"),
            active: showGoals,
            onToggle: () => setShowGoals((v) => !v),
          },
          {
            id: "trails",
            label: t("mapLayerTrails"),
            active: showTrails,
            onToggle: () => setShowTrails((v) => !v),
          },
        ]}
      />

      {/* Main 2D Canvas Viewport */}
      <div
        className="flex-1 relative overflow-hidden bg-[#FBFBFD] dark:bg-[#161618] cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onMouseLeave={() => setHoverCoord(null)}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="w-full h-full block"
        />

        {/* Live Coordinate Tracker Badge (Top Left Overlay) */}
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

        {/* Floating Node Inspector Popover Card (Anchored to node) */}
        {selectedNodeDetails && hudPlacement && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="absolute z-20 w-[310px] max-w-[calc(100%-1.5rem)] apple-card p-3.5 shadow-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl animate-fade-in transition-[left,top] duration-150 ease-out"
            style={{
              left: `${hudPlacement.left}px`,
              top: `${hudPlacement.top}px`,
            }}
          >
            <div className="flex flex-wrap items-center gap-2 justify-between pb-3 border-b border-black/[0.05] dark:border-white/[0.08]">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div
                  className={`w-7 h-7 shrink-0 rounded-xl flex items-center justify-center ${selectedNodeDetails.uiMeta.badgeBg}`}
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
                <div className="min-w-0">
                  <h4 className="truncate text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {selectedNodeDetails.node.name}
                  </h4>
                  <span className="block truncate text-[10px] text-[#86868B]">
                    {selectedNodeDetails.node.zone}
                  </span>
                </div>
              </div>
              <NodeMoveConfirmation nodeId={selectedNodeDetails.node.id} />
              <button
                onClick={() => setSelectedNodeId(null)}
                className="w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
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
                    className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] transition-all"
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
            </div>
          </div>
        )}

        {/* Compact Real-time Performance HUD & Status Pill */}
        <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1.5 bg-white/80 dark:bg-[#1C1C1E]/80 text-[#1D1D1F] dark:text-[#F5F5F7] px-2.5 py-1 rounded-full text-[10px] font-mono backdrop-blur-md shadow-xs border border-black/[0.06] dark:border-white/[0.08] transition-all select-none">
          <div className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                fps >= 55
                  ? "bg-[#34C759]"
                  : fps >= 30
                    ? "bg-[#FF9F0A]"
                    : "bg-[#FF3B30]"
              }`}
            />
            <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
              {fps} FPS
            </span>
          </div>

          <span className="text-black/15 dark:text-white/15">•</span>
          <span className="text-[#86868B] dark:text-[#A1A1A6] tabular-nums">
            {renderTimeMs.toFixed(1)}ms
          </span>

          <span className="text-black/15 dark:text-white/15">•</span>
          <span className="text-[#0071E3] dark:text-[#2997FF] font-medium tabular-nums">
            {visibleRobotCount}/{robots.length} Units
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
