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
  MapPin,
  Bot,
  Zap,
  ShieldAlert,
  PauseCircle,
  Inbox,
  Package,
  X,
  Copy,
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
import { MapCanvasHeader } from "./MapCanvasHeader.tsx";

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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 2D Canvas standard dimensions
  const widthCells = map?.widthCells || 32;
  const heightCells = map?.heightCells || 20;
  const resolution = map?.resolutionMeters || 1.0;
  const origin = map?.origin || { xMeters: 0, yMeters: 0 };

  const baseWidth = 960;
  const baseHeight = (heightCells / widthCells) * baseWidth;
  const cellW = baseWidth / widthCells;
  const cellH = baseHeight / heightCells;
  const cellMin = Math.min(cellW, cellH);

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

  // Connected edges for active node (hovered or selected)
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

  // Offscreen canvas for static background & baseline graph edges
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pre-render static blueprint, nodes, and base graph edges to offscreen canvas
  useEffect(() => {
    if (!map) return;

    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = baseWidth * 2; // 2x for Retina crispness
    bgCanvas.height = baseHeight * 2;
    const bgCtx = bgCanvas.getContext("2d");
    if (!bgCtx) return;

    bgCtx.scale(2, 2);

    // 1. Clear background surface
    bgCtx.fillStyle = isDark ? "#161618" : "#FBFBFD";
    bgCtx.beginPath();
    bgCtx.roundRect(0, 0, baseWidth, baseHeight, 16);
    bgCtx.fill();

    // 2. Grid & Pillars & Pod Storage
    for (let r = 0; r < heightCells; r++) {
      for (let c = 0; c < widthCells; c++) {
        const idx = r * widthCells + c;
        const isBlocked = map.cells[idx] === 1;
        const x = c * cellW;
        const y = (heightCells - 1 - r) * cellH;

        if (isBlocked) {
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
          const isPodStorage =
            r >= 4 &&
            r <= heightCells - 5 &&
            r !== 10 &&
            c > 0 &&
            c < widthCells - 1;

          if (isPodStorage) {
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
            bgCtx.strokeStyle = isDark
              ? "rgba(255, 255, 255, 0.04)"
              : "rgba(0, 0, 0, 0.045)";
            bgCtx.lineWidth = 0.75;
            bgCtx.strokeRect(x, y, cellW, cellH);
          }
        }
      }
    }

    // 3. Highways
    // Eastbound Outbound (Row 2)
    bgCtx.fillStyle = isDark
      ? "rgba(0, 113, 227, 0.12)"
      : "rgba(0, 113, 227, 0.08)";
    const hwy2Y = (heightCells - 1 - 2) * cellH;
    bgCtx.fillRect(cellW, hwy2Y + 1, (widthCells - 2) * cellW, cellH - 2);

    // Westbound Inbound (Row height - 3)
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

    // 4. Base Graph Edges & Arrows (Static Layer)
    if (topology) {
      bgCtx.save();
      for (const edge of topology.edges) {
        const fromX = (edge.fromColumn + 0.5) * cellW;
        const fromY = (heightCells - 1 - edge.fromRow + 0.5) * cellH;
        const toX = (edge.toColumn + 0.5) * cellW;
        const toY = (heightCells - 1 - edge.toRow + 0.5) * cellH;

        let strokeColor = isDark ? "#52525B" : "#94A3B8";
        let strokeWidth = 1.2;
        let strokeOpacity = isDark ? 0.4 : 0.35;

        if (edge.type === "station_feeder") {
          strokeColor = isDark ? "#FBBF24" : "#F59E0B";
          strokeOpacity = 0.75;
          strokeWidth = 1.6;
        } else if (edge.type === "corridor") {
          strokeColor = isDark ? "#60A5FA" : "#0071E3";
          strokeOpacity = 0.6;
          strokeWidth = 1.5;
        }

        bgCtx.save();
        bgCtx.strokeStyle = strokeColor;
        bgCtx.globalAlpha = strokeOpacity;
        bgCtx.lineWidth = strokeWidth;
        bgCtx.lineCap = "round";

        bgCtx.beginPath();
        bgCtx.moveTo(fromX, fromY);
        bgCtx.lineTo(toX, toY);
        bgCtx.stroke();

        // Direction Arrow
        if (showEdgeArrows && edge.direction === "forward") {
          const midX = (fromX + toX) / 2;
          const midY = (fromY + toY) / 2;
          const dx = toX - fromX;
          const dy = toY - fromY;
          const angle = Math.atan2(dy, dx);

          bgCtx.save();
          bgCtx.translate(midX, midY);
          bgCtx.rotate(angle);
          bgCtx.fillStyle = strokeColor;
          bgCtx.globalAlpha = Math.min(0.9, strokeOpacity + 0.3);

          bgCtx.beginPath();
          bgCtx.moveTo(3, 0);
          bgCtx.lineTo(-2.6, -2);
          bgCtx.lineTo(-1.2, 0);
          bgCtx.lineTo(-2.6, 2);
          bgCtx.closePath();
          bgCtx.fill();
          bgCtx.restore();
        }

        bgCtx.restore();
      }
      bgCtx.restore();
    }

    // 5. Specialized Station & Waypoint Nodes
    if (topology) {
      const isCompact = cellMin < 22;
      const pad = Math.max(1, cellMin * 0.08);

      for (const node of topology.nodes) {
        const x = node.column * cellW;
        const y = (heightCells - 1 - node.row) * cellH;
        const cx = x + cellW / 2;
        const cy = y + cellH / 2;

        if (node.type === "waypoint") {
          if (!showWaypoints) continue;
          bgCtx.save();
          bgCtx.fillStyle = isDark ? "#71717A" : "#94A3B8";
          bgCtx.beginPath();
          bgCtx.arc(cx, cy, Math.max(2, cellMin * 0.14), 0, Math.PI * 2);
          bgCtx.fill();
          bgCtx.restore();
          continue;
        }

        if (node.type === "pillar") continue;

        bgCtx.save();

        if (node.type === "pick") {
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
          const rw = cellW - pad * 2;
          const rh = cellH - pad * 2;
          const rx = x + pad;
          const ry = y + pad;

          bgCtx.fillStyle = isDark
            ? "rgba(99, 102, 241, 0.18)"
            : "rgba(99, 102, 241, 0.10)";
          bgCtx.beginPath();
          bgCtx.roundRect(rx, ry, rw, rh, Math.min(4, cellMin * 0.2));
          bgCtx.fill();

          bgCtx.lineWidth = isCompact ? 0.9 : 1.2;
          bgCtx.strokeStyle = isDark ? "#818CF8" : "#6366F1";
          bgCtx.stroke();

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
  }, [
    map,
    topology,
    baseWidth,
    baseHeight,
    widthCells,
    heightCells,
    cellW,
    cellH,
    cellMin,
    isDark,
    showEdgeArrows,
    showWaypoints,
  ]);

  // Selected robot trajectory
  const selectedRobot = useMemo(
    () => robots.find((r) => r.id === selectedRobotId) || null,
    [robots, selectedRobotId],
  );

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

  // Main 60 FPS HTML5 Canvas Render Loop
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Apply Pan and Zoom
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // 1. Draw Cached Background & Static Edges Layer
    if (bgCanvasRef.current) {
      ctx.drawImage(bgCanvasRef.current, 0, 0, baseWidth, baseHeight);
    }

    // Viewport Frustum Culling bounds
    const viewLeft = -pan.x / zoom;
    const viewTop = -pan.y / zoom;
    const viewRight = (rect.width - pan.x) / zoom;
    const viewBottom = (rect.height - pan.y) / zoom;

    // 2. Active Outgoing / Incoming Edges Highlight
    if (
      topology &&
      (activeOutgoingEdges.length > 0 || activeIncomingEdges.length > 0)
    ) {
      ctx.save();

      // Draw Outgoing Edges (Blue Highlight)
      for (const edge of activeOutgoingEdges) {
        const fromX = (edge.fromColumn + 0.5) * cellW;
        const fromY = (heightCells - 1 - edge.fromRow + 0.5) * cellH;
        const toX = (edge.toColumn + 0.5) * cellW;
        const toY = (heightCells - 1 - edge.toRow + 0.5) * cellH;

        ctx.save();
        ctx.strokeStyle = isDark ? "#2997FF" : "#0071E3";
        ctx.lineWidth = 2.6;
        ctx.lineCap = "round";
        ctx.shadowColor = isDark ? "#2997FF" : "#0071E3";
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        // Highlight Arrow
        if (showEdgeArrows && edge.direction === "forward") {
          const midX = (fromX + toX) / 2;
          const midY = (fromY + toY) / 2;
          const dx = toX - fromX;
          const dy = toY - fromY;
          const angle = Math.atan2(dy, dx);

          ctx.translate(midX, midY);
          ctx.rotate(angle);
          ctx.fillStyle = isDark ? "#2997FF" : "#0071E3";
          ctx.beginPath();
          ctx.moveTo(4, 0);
          ctx.lineTo(-3, -2.5);
          ctx.lineTo(-1.5, 0);
          ctx.lineTo(-3, 2.5);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Draw Incoming Edges (Green Highlight)
      for (const edge of activeIncomingEdges) {
        const fromX = (edge.fromColumn + 0.5) * cellW;
        const fromY = (heightCells - 1 - edge.fromRow + 0.5) * cellH;
        const toX = (edge.toColumn + 0.5) * cellW;
        const toY = (heightCells - 1 - edge.toRow + 0.5) * cellH;

        ctx.save();
        ctx.strokeStyle = isDark ? "#30D158" : "#34C759";
        ctx.lineWidth = 2.6;
        ctx.lineCap = "round";
        ctx.shadowColor = isDark ? "#30D158" : "#34C759";
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        // Highlight Arrow
        if (showEdgeArrows && edge.direction === "forward") {
          const midX = (fromX + toX) / 2;
          const midY = (fromY + toY) / 2;
          const dx = toX - fromX;
          const dy = toY - fromY;
          const angle = Math.atan2(dy, dx);

          ctx.translate(midX, midY);
          ctx.rotate(angle);
          ctx.fillStyle = isDark ? "#30D158" : "#34C759";
          ctx.beginPath();
          ctx.moveTo(4, 0);
          ctx.lineTo(-3, -2.5);
          ctx.lineTo(-1.5, 0);
          ctx.lineTo(-3, 2.5);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.restore();
    }

    // 3. Hovered Cell / Node Indicator
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

    // 4. Selected Node Glow Halo
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
        ctx.shadowColor = ui.strokeColor;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Selected Robot Trajectory Path
    if (showTrails && selectedRobot && selectedGoalAssignment) {
      const startPos = worldToScreen(
        { x: selectedRobot.pose.xMeters, y: selectedRobot.pose.yMeters },
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
      const goalPos = worldToScreen(goalPoint, mapDim, baseWidth, baseHeight);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(goalPos.x, goalPos.y);
      ctx.strokeStyle = isDark ? "#2997FF" : "#0071E3";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    }

    // 6. Active Order Goals (Target Reticle)
    if (showGoals && orders.length > 0) {
      ctx.save();
      for (const order of orders) {
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

    // 7. Robots (with LOD & Frustum Culling)
    const isCompactFleet = cellMin < 22;
    const robotRadius = cellMin * 0.38;
    const haloRadius = robotRadius * 1.6;
    const arrowTip = robotRadius * 0.72;
    const arrowBase = robotRadius * 0.36;
    const isLODCompact = zoom < 0.6;

    for (let i = 0; i < robots.length; i++) {
      const robot = robots[i];
      const screenPos = worldToScreen(
        { x: robot.pose.xMeters, y: robot.pose.yMeters },
        mapDim,
        baseWidth,
        baseHeight,
      );

      // Frustum Culling
      if (
        screenPos.x < viewLeft - 40 ||
        screenPos.x > viewRight + 40 ||
        screenPos.y < viewTop - 40 ||
        screenPos.y > viewBottom + 40
      ) {
        continue;
      }

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
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(3, robotRadius * 0.7), 0, Math.PI * 2);
        ctx.fillStyle = robotColor;
        ctx.fill();
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = isDark ? "#1C1C1E" : "#FFFFFF";
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, robotRadius, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "#1C1C1E" : "#FFFFFF";
        ctx.fill();
        ctx.lineWidth = isSelected
          ? Math.max(2.0, robotRadius * 0.25)
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

        // Center Pivot
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1.2, robotRadius * 0.25), 0, Math.PI * 2);
        ctx.fillStyle = robotColor;
        ctx.fill();

        // Monospace ID Badge
        const shouldShowLabel =
          isSelected || (showNodeLabels && (!isCompactFleet || zoom >= 1.2));

        if (shouldShowLabel) {
          const fontSize = isCompactFleet ? 7 : 8.5;
          ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const displayId =
            isCompactFleet && !isSelected
              ? robot.id.replace("robot-", "")
              : robot.id;
          const textMetrics = ctx.measureText(displayId);
          const badgeW = textMetrics.width + (isCompactFleet ? 8 : 12);
          const badgeH = isCompactFleet ? 10 : 13;
          const badgeY = robotRadius + (isCompactFleet ? 3 : 5);

          ctx.fillStyle = isDark
            ? "rgba(28, 28, 30, 0.95)"
            : "rgba(255, 255, 255, 0.95)";
          ctx.beginPath();
          ctx.roundRect(
            -badgeW / 2,
            badgeY - badgeH / 2,
            badgeW,
            badgeH,
            isCompactFleet ? 2.5 : 3.5,
          );
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
          ctx.fillText(displayId, 0, badgeY);
        }
      }

      ctx.restore();
    }

    ctx.restore();
  }, [
    pan,
    zoom,
    baseWidth,
    baseHeight,
    cellW,
    cellH,
    cellMin,
    heightCells,
    widthCells,
    isDark,
    mapDim,
    topology,
    activeOutgoingEdges,
    activeIncomingEdges,
    selectedNodeId,
    hoverCoord,
    showTrails,
    selectedRobot,
    selectedGoalAssignment,
    resolution,
    origin,
    showGoals,
    orders,
    selectedRobotId,
    robots,
    showNodeLabels,
    showEdgeArrows,
  ]);

  // RequestAnimationFrame 60 FPS Loop
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    let active = true;
    const loop = () => {
      if (!active) return;
      renderFrame();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      active = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [renderFrame]);

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

    // Hover Coordinate Tracker
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

        // Track hovered node if any
        if (topology) {
          const matchedNode = topology.nodes.find(
            (n) => n.column === clampedCol && n.row === clampedRow,
          );
          setHoveredNode(matchedNode || null);
        }
      } else {
        setHoverCoord(null);
        setHoveredNode(null);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
    const dist = Math.hypot(
      e.clientX - mouseDownPosRef.current.x,
      e.clientY - mouseDownPosRef.current.y,
    );

    // If mouse moved less than 5px, handle node / robot selection
    if (dist < 5 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = (e.clientX - rect.left - pan.x) / zoom;
      const clickY = (e.clientY - rect.top - pan.y) / zoom;

      // 1. Check if clicked near a robot
      let clickedRobot = false;
      const hitRadius = Math.max(16, cellMin * 0.5);
      for (const robot of robots) {
        const pos = worldToScreen(
          { x: robot.pose.xMeters, y: robot.pose.yMeters },
          mapDim,
          baseWidth,
          baseHeight,
        );
        if (Math.hypot(pos.x - clickX, pos.y - clickY) <= hitRadius) {
          setSelectedRobotId(robot.id);
          clickedRobot = true;
          break;
        }
      }

      // 2. Check if clicked near a topology node
      if (!clickedRobot && topology) {
        let clickedNode = false;
        for (const node of topology.nodes) {
          const nx = (node.column + 0.5) * cellW;
          const ny = (heightCells - 1 - node.row + 0.5) * cellH;
          if (Math.hypot(nx - clickX, ny - clickY) <= cellMin * 0.5) {
            setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
            clickedNode = true;
            break;
          }
        }
        if (!clickedNode) {
          setSelectedNodeId(null);
        }
      }
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
  }, [selectedNodeDetails, zoom, pan, cellW, cellH, heightCells]);

  return (
    <div className="apple-card relative w-full h-full min-h-[400px] overflow-hidden flex flex-col select-none transition-colors duration-300">
      {/* 1. Top Glassmorphic Controls Toolbar */}
      <MapCanvasHeader
        viewMode={viewMode}
        onToggleViewMode={onToggleViewMode}
        headerLeft={headerLeft}
        headerRight={headerRight}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        layers={[
          {
            id: "labels",
            label: t("mapLayerLabels"),
            active: showNodeLabels,
            onToggle: () => setShowNodeLabels((p) => !p),
          },
          {
            id: "arrows",
            label: t("mapLayerArrows"),
            active: showEdgeArrows,
            onToggle: () => setShowEdgeArrows((p) => !p),
          },
          {
            id: "waypoints",
            label: t("mapLayerWaypoints"),
            active: showWaypoints,
            onToggle: () => setShowWaypoints((p) => !p),
          },
        ]}
      />

      {/* 2. Interactive High-Performance HTML5 Canvas Viewport */}
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
        <canvas
          ref={canvasRef}
          className="w-full h-full block absolute inset-0 touch-none"
        />

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
                    Focus
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
