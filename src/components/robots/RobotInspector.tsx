import { batteryLabel } from "../../utils/battery.ts";
import { RobotRemoveButton } from "./RobotRemoveButton.tsx";
import React, { useState, useEffect } from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import {
  X,
  Bot,
  Copy,
  Check,
  Compass,
  Cpu,
  ShieldAlert,
  Wifi,
  WifiOff,
  Clock,
  Box,
  Layers,
  MapPin,
  Activity,
  ArrowUpRight,
  Sparkles,
  Zap,
  PauseCircle,
  Inbox,
  Package,
  Flag,
  Boxes,
} from "lucide-react";
import {
  worldToCell,
  cellToNodeId,
  formatCoordinates,
  yawToDegrees,
} from "../../utils/coordinates/coordinates.ts";
import {
  formatAngleRadians,
  formatDistanceMeters,
} from "../../utils/units/units.ts";
import {
  formatSimulationTime,
  formatUtcIso,
  formatStateAge,
} from "../../utils/time/time.ts";
import { formatShortId, copyToClipboard } from "../../utils/ids/ids.ts";
import { getNodeTypeUiMeta } from "../../utils/map/topology.ts";

export interface RobotInspectorProps {
  embedded?: boolean;
}

export const RobotInspector: React.FC<RobotInspectorProps> = ({
  embedded = false,
}) => {
  const { t } = useAppConfig();
  const {
    snapshot,
    selectedRobot,
    setSelectedRobotId,
    selectedNode,
    setSelectedNodeId,
    topology,
  } = useOperations();

  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [copiedDigest, setCopiedDigest] = useState<boolean>(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedRobotId(null);
        setSelectedNodeId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedRobotId, setSelectedNodeId]);

  const robots = snapshot?.robots || [];
  const orders = snapshot?.orders || [];

  // If no robot is selected, check if a Node is selected
  if (!selectedRobot) {
    if (selectedNode) {
      const uiMeta = getNodeTypeUiMeta(selectedNode.type);
      const outgoing = topology?.nodeOutgoingEdges.get(selectedNode.id) || [];
      const incoming = topology?.nodeIncomingEdges.get(selectedNode.id) || [];

      const map = snapshot?.map;
      const resolution = map?.resolutionMeters || 0.5;
      const origin = map?.origin || { xMeters: 0, yMeters: 0 };

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

      return (
        <aside
          aria-label={`Inspector for node ${selectedNode.id}`}
          className={
            embedded
              ? "h-full flex flex-col justify-between overflow-y-auto space-y-3.5"
              : "apple-card p-4 sm:p-5 h-[560px] sm:h-[600px] flex flex-col justify-between overflow-y-auto space-y-3.5 transition-colors duration-300"
          }
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/[0.04] dark:border-white/[0.06] pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${uiMeta.badgeBg}`}
              >
                {selectedNode.type === "rack" && (
                  <Boxes className="w-4 h-4 text-indigo-500" />
                )}
                {selectedNode.type === "charger" && (
                  <Zap className="w-4 h-4 text-amber-500" />
                )}
                {selectedNode.type === "pillar" && (
                  <ShieldAlert className="w-4 h-4 text-zinc-500" />
                )}
                {selectedNode.type === "pick" && (
                  <Package className="w-4 h-4 text-amber-500" />
                )}
                {(selectedNode.type === "place" ||
                  selectedNode.type === "workstation") && (
                  <Inbox className="w-4 h-4 text-cyan-500" />
                )}
                {selectedNode.type === "buffer" && (
                  <PauseCircle className="w-4 h-4 text-purple-500" />
                )}
                {selectedNode.type === "chute" && (
                  <Inbox className="w-4 h-4 text-emerald-500" />
                )}
                {selectedNode.type === "waypoint" && (
                  <MapPin className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
                )}
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {selectedNode.name}
                </h3>
                <span className="text-[10px] text-[#86868B]">
                  {selectedNode.zone} · Node ID #{selectedNode.id}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSelectedNodeId(null)}
                className="w-7 h-7 rounded-xl flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                title={t("inspectorClose")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Node Metrics */}
          <div className="space-y-3 flex-1 overflow-y-auto">
            {/* Type & Status Bento */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#F5F5F7] dark:bg-[#252528] p-3 rounded-2xl border border-black/[0.02] dark:border-white/[0.04]">
                <span className="text-[10px] font-medium text-[#86868B] block mb-1">
                  {t("nodeTypeLabel")}
                </span>
                <span
                  className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${uiMeta.badgeBg} ${uiMeta.badgeText} ${uiMeta.badgeBorder}`}
                >
                  {uiMeta.labelKo}
                </span>
              </div>

              <div className="bg-[#F5F5F7] dark:bg-[#252528] p-3 rounded-2xl border border-black/[0.02] dark:border-white/[0.04]">
                <span className="text-[10px] font-medium text-[#86868B] block mb-1">
                  Passability
                </span>
                <span
                  className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedNode.isTraversable
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                  }`}
                >
                  {selectedNode.isTraversable
                    ? t("mapTraversable")
                    : t("mapBlocked")}
                </span>
              </div>
            </div>

            {/* Coordinates Card */}
            <div className="bg-[#F5F5F7] dark:bg-[#252528] p-3 rounded-2xl border border-black/[0.02] dark:border-white/[0.04] space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-sans text-[#86868B]">
                  Grid Cell
                </span>
                <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Column {selectedNode.column}, Row {selectedNode.row}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-sans text-[#86868B]">
                  World Pose
                </span>
                <span className="text-[#0071E3] dark:text-[#2997FF] font-bold">
                  {formatCoordinates(
                    selectedNode.xMeters,
                    selectedNode.yMeters,
                  )}
                </span>
              </div>
            </div>

            {/* Connected Edges */}
            <div className="bg-[#F5F5F7] dark:bg-[#252528] p-3 rounded-2xl border border-black/[0.02] dark:border-white/[0.04] space-y-2">
              <span className="text-[10px] font-medium text-[#86868B] block">
                {t("nodeConnectedEdges")} ({outgoing.length + incoming.length}{" "}
                Total)
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/[0.03] dark:border-white/[0.05]">
                  <span className="text-[10px] text-[#86868B] block">
                    Outgoing (↑)
                  </span>
                  <span className="font-bold text-[#2997FF]">
                    {outgoing.length} Lanes
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/[0.03] dark:border-white/[0.05]">
                  <span className="text-[10px] text-[#86868B] block">
                    Incoming (↓)
                  </span>
                  <span className="font-bold text-[#30D158]">
                    {incoming.length} Lanes
                  </span>
                </div>
              </div>
            </div>

            {/* Occupying Robot */}
            {occupyingRobot ? (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] block">
                      Occupant: {occupyingRobot.id}
                    </span>
                    <span className="text-[10px] text-[#86868B]">
                      Battery {occupyingRobot.batteryPercent?.toFixed(1) ?? "—"}
                      % · {occupyingRobot.operationalState}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRobotId(occupyingRobot.id)}
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-[#0071E3] rounded-xl hover:bg-[#0077ED] transition-all cursor-pointer"
                >
                  Inspect
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-[#F5F5F7] dark:bg-[#252528] text-center text-xs text-[#86868B]">
                No robot currently occupying this cell
              </div>
            )}

            {/* Assigned Goal Target */}
            {assignedGoal && (
              <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-2">
                <Flag className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
                <div>
                  <span className="text-xs font-bold text-[#0071E3] dark:text-[#2997FF] block">
                    Target Goal of {assignedGoal.orderId}
                  </span>
                  <span className="text-[10px] text-[#86868B]">
                    Assigned Robot: {assignedGoal.robotId}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center gap-2 shrink-0">
            <button
              onClick={async () => {
                await copyToClipboard(String(selectedNode.id));
                setCopiedId(true);
                setTimeout(() => setCopiedId(false), 2000);
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              {copiedId ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#34C759]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#86868B]" />
                  <span>Copy Node ID</span>
                </>
              )}
            </button>
          </div>
        </aside>
      );
    }

    const executingRobots = robots.filter(
      (r) => r.operationalState === "EXECUTING",
    );

    return (
      <div
        className={
          embedded
            ? "h-full flex flex-col justify-between select-none overflow-y-auto"
            : "apple-card p-5 sm:p-6 h-[560px] sm:h-[600px] flex flex-col justify-between select-none transition-colors duration-300"
        }
      >
        <div>
          {/* Header */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-black/[0.04] dark:border-white/[0.06]">
            <div className="w-7 h-7 rounded-xl bg-[#0071E3]/10 dark:bg-[#2997FF]/15 flex items-center justify-center text-[#0071E3] dark:text-[#2997FF]">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Fleet Telemetry Overview
              </h3>
              <p className="text-[10px] text-[#86868B]">
                Select a robot or node on the map to inspect
              </p>
            </div>
          </div>

          {/* Quick Metrics Bento */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <div className="bg-[#F5F5F7] dark:bg-[#252528] p-3 rounded-2xl border border-black/[0.02] dark:border-white/[0.04]">
              <span className="text-[10px] font-medium text-[#86868B] block mb-1">
                Active Fleet
              </span>
              <div className="font-mono text-lg font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
                {robots.length} Units
              </div>
            </div>

            <div className="bg-[#F5F5F7] dark:bg-[#252528] p-3 rounded-2xl border border-black/[0.02] dark:border-white/[0.04]">
              <span className="text-[10px] font-medium text-[#86868B] block mb-1">
                Executing Orders
              </span>
              <div className="font-mono text-lg font-bold text-[#34C759] dark:text-[#30D158] tabular-nums">
                {executingRobots.length} Active
              </div>
            </div>
          </div>

          {/* Operator Instructions Card */}
          <div className="bg-[#0071E3]/[0.04] dark:bg-[#2997FF]/10 rounded-2xl p-4 border border-[#0071E3]/15 dark:border-[#2997FF]/20 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0071E3] dark:text-[#2997FF]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Operator Quick Guide</span>
            </div>
            <ul className="text-[11px] text-[#86868B] space-y-1.5 leading-relaxed">
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-[#0071E3] dark:bg-[#2997FF]" />
                Click any robot footprint on the map to zoom and inspect.
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-[#0071E3] dark:bg-[#2997FF]" />
                Click any map cell to inspect node types (충전소, 기둥, 버퍼,
                chute, ws).
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-[#0071E3] dark:bg-[#2997FF]" />
                Toggle the Edges button in the toolbar to view traffic network
                lanes.
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-[#0071E3] dark:bg-[#2997FF]" />
                Press{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[10px]">
                  Esc
                </kbd>{" "}
                to deselect and return to fleet glance.
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Tip */}
        <div className="text-[10px] text-center text-[#86868B] pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
          Real-time telemetry stream synchronized via Core API.
        </div>
      </div>
    );
  }

  const map = snapshot?.map;
  const resolution = map?.resolutionMeters || 0.5;
  const origin = map?.origin || { xMeters: 0, yMeters: 0 };

  const cell = worldToCell(
    { x: selectedRobot.pose.xMeters, y: selectedRobot.pose.yMeters },
    resolution,
    origin,
  );

  const yawDeg = yawToDegrees(selectedRobot.pose.yawRadians);

  const handleCopyId = async () => {
    await copyToClipboard(selectedRobot.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyDigest = async () => {
    if (selectedRobot.activeController?.contentDigestSha256) {
      await copyToClipboard(selectedRobot.activeController.contentDigestSha256);
      setCopiedDigest(true);
      setTimeout(() => setCopiedDigest(false), 2000);
    }
  };

  const isDisconnected = selectedRobot.connectivity === "DISCONNECTED";
  const isExecuting = selectedRobot.operationalState === "EXECUTING";

  return (
    <aside
      aria-label={`Inspector for robot ${selectedRobot.id}`}
      className={
        embedded
          ? "h-full flex flex-col justify-between overflow-y-auto space-y-3.5"
          : "apple-card p-4 sm:p-5 h-[560px] sm:h-[600px] flex flex-col justify-between overflow-y-auto space-y-3.5 transition-colors duration-300"
      }
    >
      {/* 1. Header: Robot ID & Actions */}
      <RobotRemoveButton key={selectedRobot.id} robotId={selectedRobot.id} />
      <div className="flex items-center justify-between border-b border-black/[0.04] dark:border-white/[0.06] pb-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#0071E3]/15 text-[#0071E3] dark:text-[#2997FF] flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
                {selectedRobot.id}
              </span>
              <button
                onClick={handleCopyId}
                className="p-1 rounded-full text-[#86868B] hover:text-[#0071E3] dark:hover:text-[#2997FF] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title={t("inspectorCopyId")}
                aria-label="Copy robot ID"
              >
                {copiedId ? (
                  <Check className="w-3 h-3 text-[#34C759] dark:text-[#30D158]" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-[#86868B]">Telemetry Inspector</p>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={() => setSelectedRobotId(null)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          title={t("inspectorClose")}
          aria-label="Close inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Status & Yaw Compass Interactive Bento */}
      <div className="grid grid-cols-12 gap-3 shrink-0">
        {/* Left (7 cols): Status & Connection */}
        <div className="col-span-7 space-y-2">
          {/* Operational State Pill */}
          <div className="bg-[#F5F5F7] dark:bg-[#252528] p-2.5 rounded-2xl border border-black/[0.02] dark:border-white/[0.04]">
            <span className="text-[10px] font-medium text-[#86868B] block mb-0.5">
              Operational State
            </span>
            <div className="flex items-center gap-1.5 text-xs font-bold font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  isExecuting
                    ? "bg-[#34C759] dark:bg-[#30D158]"
                    : "bg-[#86868B]"
                }`}
              />
              <span
                className={
                  isExecuting
                    ? "text-[#34C759] dark:text-[#30D158]"
                    : "text-[#1D1D1F] dark:text-[#F5F5F7]"
                }
              >
                {selectedRobot.operationalState}
              </span>
            </div>
          </div>

          {/* Connectivity Pill */}
          <div className="bg-[#F5F5F7] dark:bg-[#252528] p-2.5 rounded-2xl border border-black/[0.02] dark:border-white/[0.04]">
            <span className="text-[10px] font-medium text-[#86868B] block mb-0.5">
              Radio Link
            </span>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {isDisconnected ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-[#FF3B30] dark:text-[#FF453A]" />
                  <span className="text-[#FF3B30] dark:text-[#FF453A] font-bold">
                    Disconnected
                  </span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-[#34C759] dark:text-[#30D158]" />
                  <span className="text-[#34C759] dark:text-[#30D158]">
                    Connected (Stable)
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right (5 cols): Yaw Compass Gauge Widget */}
        <div className="col-span-5 bg-[#F5F5F7] dark:bg-[#252528] p-2.5 rounded-2xl border border-black/[0.02] dark:border-white/[0.04] flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-medium text-[#86868B] mb-1">
            Heading
          </span>
          <div className="relative w-12 h-12 rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#1C1C1E] flex items-center justify-center shadow-xs">
            <div
              className="absolute inset-0 flex items-center justify-center transition-transform duration-300"
              style={{ transform: `rotate(${yawDeg}deg)` }}
            >
              <div className="w-0.5 h-5 bg-[#0071E3] dark:bg-[#2997FF] rounded-full origin-bottom mb-2.5" />
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-[#0071E3] dark:bg-[#2997FF]" />
          </div>
          <span className="text-[10px] font-mono font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mt-1 tabular-nums">
            {Math.round(yawDeg)}° ({selectedRobot.pose.yawRadians.toFixed(2)}r)
          </span>
        </div>
      </div>

      {selectedRobot.stationState && (
        <div className="p-3 rounded-xl bg-[#F5F5F7] dark:bg-[#252528] text-xs space-y-1 text-[#1D1D1F] dark:text-[#F5F5F7]">
          <p>
            {selectedRobot.stationState.loaded ? "적재됨" : "빈 로봇"} ·{" "}
            {selectedRobot.stationState.batteryPercent.toFixed(1)}%
          </p>
          {batteryLabel(selectedRobot, orders, snapshot?.batteryPolicy) && (
            <p>
              {batteryLabel(selectedRobot, orders, snapshot?.batteryPolicy)}
            </p>
          )}
          {selectedRobot.stationState.action && (
            <p>
              {selectedRobot.stationState.action} ·{" "}
              {selectedRobot.stationState.phase}
            </p>
          )}
        </div>
      )}
      {/* 3. Pose & Coordinates Grid */}
      <div className="grid grid-cols-2 gap-2.5 text-xs">
        <div className="bg-[#F5F5F7] dark:bg-[#252528] p-3 rounded-2xl border border-black/[0.02] dark:border-white/[0.04]">
          <span className="text-[10px] text-[#86868B] block font-medium mb-0.5">
            World Pose (X, Y)
          </span>
          <span className="font-mono font-bold text-[#0071E3] dark:text-[#2997FF] tabular-nums">
            {formatCoordinates(
              selectedRobot.pose.xMeters,
              selectedRobot.pose.yMeters,
            )}
          </span>
        </div>

        <div className="bg-[#F5F5F7] dark:bg-[#252528] p-3 rounded-2xl border border-black/[0.02] dark:border-white/[0.04]">
          <span className="text-[10px] text-[#86868B] block font-medium mb-0.5">
            Node & Cell
          </span>
          <div className="flex items-center gap-1.5 font-mono tabular-nums">
            <span className="font-bold text-[#0071E3] dark:text-[#2997FF]">
              Node {cellToNodeId(cell, map?.widthCells || 16)}
            </span>
            <span className="text-[#86868B]">
              ({cell.column}, {cell.row})
            </span>
          </div>
        </div>
      </div>

      {/* 4. Active Order & Assignment */}
      <div className="bg-[#F5F5F7] dark:bg-[#252528] p-3 rounded-2xl border border-black/[0.02] dark:border-white/[0.04] space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#86868B] font-medium">
            {t("inspectorActiveOrder")}
          </span>
          {selectedRobot.currentOrderId ? (
            <span className="font-mono font-bold text-[#0071E3] dark:text-[#2997FF]">
              {selectedRobot.currentOrderId}
            </span>
          ) : (
            <span className="text-[#86868B]">None</span>
          )}
        </div>

        {selectedRobot.safety !== "NORMAL" && (
          <div className="pt-1.5 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-[11px]">
            <span className="text-[#86868B]">{t("inspectorSafetyStatus")}</span>
            <span className="font-mono font-bold text-[#FF9500] dark:text-[#FF9F0A]">
              {selectedRobot.safety}
            </span>
          </div>
        )}
      </div>

      {/* 5. Controller Digest Checksum Pill */}
      {selectedRobot.activeController && (
        <div className="bg-[#F5F5F7] dark:bg-[#252528] p-3 rounded-2xl border border-black/[0.02] dark:border-white/[0.04] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] text-[#86868B] block font-medium">
              Controller SHA256
            </span>
            <span className="font-mono text-[10px] text-[#1D1D1F] dark:text-[#F5F5F7] truncate block">
              {formatShortId(
                selectedRobot.activeController.contentDigestSha256 || "",
              )}
            </span>
          </div>
          <button
            onClick={handleCopyDigest}
            className="p-1.5 rounded-full text-[#86868B] hover:text-[#0071E3] dark:hover:text-[#2997FF] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Copy controller digest"
          >
            {copiedDigest ? (
              <Check className="w-3.5 h-3.5 text-[#34C759] dark:text-[#30D158]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}

      {/* 6. Footer Timestamps */}
      <div className="text-[10px] font-mono text-[#86868B] pt-2 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between shrink-0">
        <span>Age: {formatStateAge(selectedRobot.occurredAtUtc)}</span>
        <span>
          Sim T: {formatSimulationTime(selectedRobot.simulationTimeMs / 1000)}
        </span>
      </div>
    </aside>
  );
};
