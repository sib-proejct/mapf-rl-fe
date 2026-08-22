import React, { useState, useMemo, memo } from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import {
  Bot,
  Search,
  Wifi,
  WifiOff,
  Box,
  Compass,
  MapPin,
  X,
  Zap,
  Battery,
  ShieldAlert,
  Clock,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  ArrowUpRight,
  Sparkles,
  Inbox,
  Package,
  Boxes,
  PauseCircle,
  Activity,
  AlertTriangle,
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
import type { Robot } from "../../domain/robot/types.ts";

export interface RobotListProps {
  embedded?: boolean;
}

interface InlineRobotInspectorProps {
  robot: Robot;
  onClose: () => void;
}

const InlineRobotInspector: React.FC<InlineRobotInspectorProps> = ({
  robot,
  onClose,
}) => {
  const { t } = useAppConfig();
  const { snapshot } = useOperations();
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [copiedDigest, setCopiedDigest] = useState<boolean>(false);

  const map = snapshot?.map;
  const resolution = map?.resolutionMeters || 0.5;
  const origin = map?.origin || { xMeters: 0, yMeters: 0 };
  const widthCells = map?.widthCells || 0;

  const cell = worldToCell(
    { x: robot.pose.xMeters, y: robot.pose.yMeters },
    resolution,
    origin,
  );
  const nodeId = cellToNodeId(cell, widthCells);

  const assignedOrder = snapshot?.orders.find(
    (o) => o.id === robot.currentOrderId,
  );
  const goalAssignment = assignedOrder?.assignments.find(
    (a) => a.robotId === robot.id,
  );

  const handleCopyId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copyToClipboard(robot.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1800);
  };

  const handleCopyDigest = async (e: React.MouseEvent, digest: string) => {
    e.stopPropagation();
    await copyToClipboard(digest);
    setCopiedDigest(true);
    setTimeout(() => setCopiedDigest(false), 1800);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2.5 animate-fade-in text-left text-xs"
    >
      {/* 1. Real-time Telemetry Bento */}
      <div className="grid grid-cols-2 gap-2">
        {/* Battery */}
        <div className="bg-[#F5F5F7] dark:bg-[#252528] p-2.5 rounded-xl border border-black/[0.02] dark:border-white/[0.03]">
          <div className="flex items-center justify-between text-[10px] text-[#86868B] mb-1">
            <span className="flex items-center gap-1 font-medium">
              <Battery className="w-3 h-3 text-[#34C759] dark:text-[#30D158]" />
              Battery
            </span>
            <span className="font-mono font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {robot.batteryPercent ?? 100}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                (robot.batteryPercent ?? 100) > 30
                  ? "bg-[#34C759] dark:bg-[#30D158]"
                  : (robot.batteryPercent ?? 100) > 15
                    ? "bg-[#FF9500] dark:bg-[#FF9F0A]"
                    : "bg-[#FF3B30] dark:bg-[#FF453A]"
              }`}
              style={{ width: `${robot.batteryPercent ?? 100}%` }}
            />
          </div>
        </div>

        {/* Grid Node */}
        <div className="bg-[#F5F5F7] dark:bg-[#252528] p-2.5 rounded-xl border border-black/[0.02] dark:border-white/[0.03]">
          <span className="text-[10px] text-[#86868B] block mb-0.5 font-medium">
            Grid Node
          </span>
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-[#0071E3] dark:text-[#2997FF] font-bold">
              Node #{nodeId}
            </span>
            <span className="text-[#86868B] text-[10px]">
              ({cell.column}, {cell.row})
            </span>
          </div>
        </div>
      </div>

      {/* 2. Active Controller & AI Policy */}
      <div className="bg-[#F5F5F7] dark:bg-[#252528] p-2.5 rounded-xl border border-black/[0.02] dark:border-white/[0.03] space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#86868B] font-medium flex items-center gap-1">
            <Cpu className="w-3 h-3 text-[#AF52DE] dark:text-[#BF5AF2]" />
            Active Controller
          </span>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
              robot.activeController?.mode === "POLICY"
                ? "bg-[#AF52DE]/15 text-[#8944AB] dark:text-[#BF5AF2] border border-[#AF52DE]/25"
                : "bg-[#0071E3]/15 text-[#0071E3] dark:text-[#2997FF] border border-[#0071E3]/25"
            }`}
          >
            {robot.activeController?.mode || "BASELINE"}
          </span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10.5px]">
          <span className="text-[#1D1D1F] dark:text-[#F5F5F7] truncate max-w-[130px]">
            {robot.activeController?.identity || "cardinal-baseline/1.0"}
          </span>
          {robot.activeController?.contentDigestSha256 && (
            <button
              onClick={(e) =>
                handleCopyDigest(
                  e,
                  robot.activeController!.contentDigestSha256!,
                )
              }
              className="text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] flex items-center gap-1 text-[10px] cursor-pointer"
              title="Copy SHA-256 Digest"
            >
              {copiedDigest ? (
                <Check className="w-3 h-3 text-[#34C759]" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>
                {formatShortId(robot.activeController.contentDigestSha256)}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Assigned Order Target & Goal */}
      {assignedOrder ? (
        <div className="bg-[#F5F5F7] dark:bg-[#252528] p-2.5 rounded-xl border border-black/[0.02] dark:border-white/[0.03] space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[#86868B] font-medium flex items-center gap-1">
              <Box className="w-3 h-3 text-[#0071E3] dark:text-[#2997FF]" />
              Order: {assignedOrder.id}
            </span>
            <span className="font-bold text-[#34C759] dark:text-[#30D158]">
              {assignedOrder.state}
            </span>
          </div>
          {goalAssignment && (
            <div className="flex items-center justify-between text-[10.5px] font-mono">
              <span className="text-[#86868B]">Goal Target:</span>
              <span className="text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold">
                Col {goalAssignment.goalColumn}, Row {goalAssignment.goalRow}
              </span>
            </div>
          )}
        </div>
      ) : null}

      {/* 4. Controls & Collapse */}
      <div className="pt-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] text-[#86868B] font-mono">
          <span>Epoch {robot.sessionEpoch ?? 1}</span>
          <span>•</span>
          <span>v{robot.stateVersion ?? 1}</span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="py-1 px-3 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[#1D1D1F] dark:text-[#F5F5F7] font-medium text-[10.5px] transition-all cursor-pointer"
        >
          Collapse
        </button>
      </div>
    </div>
  );
};

interface RobotCardProps {
  robot: Robot;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onCloseInspector: () => void;
}

const RobotCard = memo<RobotCardProps>(
  ({ robot, isSelected, onSelect, onCloseInspector }) => {
    const getStatusBadge = (r: Robot) => {
      if (r.connectivity === "DISCONNECTED") {
        return {
          label: "Offline",
          dot: "bg-[#FF3B30] dark:bg-[#FF453A]",
          text: "text-[#D70015] dark:text-[#FF453A]",
          bg: "bg-[#FF3B30]/10 dark:bg-[#FF453A]/15 border-[#FF3B30]/20",
        };
      }
      if (r.safety !== "NORMAL" && r.safety !== "WAIT") {
        return {
          label: "Safety Alert",
          dot: "bg-[#FF9500] dark:bg-[#FF9F0A] animate-pulse",
          text: "text-[#C93400] dark:text-[#FF9F0A]",
          bg: "bg-[#FF9500]/10 dark:bg-[#FF9F0A]/15 border-[#FF9500]/20",
        };
      }
      if (r.operationalState === "EXECUTING") {
        return {
          label: "Executing",
          dot: "bg-[#34C759] dark:bg-[#30D158]",
          text: "text-[#248A3D] dark:text-[#30D158]",
          bg: "bg-[#34C759]/10 dark:bg-[#30D158]/15 border-[#34C759]/20",
        };
      }
      if (r.operationalState === "CHARGING") {
        return {
          label: "Charging",
          dot: "bg-[#FF9F0A] dark:bg-[#FFD60A] animate-pulse",
          text: "text-[#B25000] dark:text-[#FFD60A]",
          bg: "bg-[#FF9F0A]/10 dark:bg-[#FFD60A]/15 border-[#FF9F0A]/20",
        };
      }
      return {
        label: "Idle",
        dot: "bg-[#86868B]",
        text: "text-[#6E6E73] dark:text-[#86868B]",
        bg: "bg-black/5 dark:bg-white/10 border-transparent",
      };
    };

    const badge = getStatusBadge(robot);

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(isSelected ? "" : robot.id)}
        className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer outline-none ${
          isSelected
            ? "bg-[#0071E3]/[0.05] dark:bg-[#2997FF]/10 border-[#0071E3]/50 dark:border-[#2997FF]/60 shadow-xs ring-1 ring-[#0071E3]/20"
            : "bg-white dark:bg-[#1C1C1E] hover:bg-[#F5F5F7]/80 dark:hover:bg-[#252528]/80 border-black/[0.05] dark:border-white/[0.07] hover:border-black/15 dark:hover:border-white/20"
        }`}
      >
        {/* Card Header Row: ID, Badges & Chevron */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                isSelected
                  ? "bg-[#0071E3] text-white"
                  : "bg-black/5 dark:bg-white/10 text-[#1D1D1F] dark:text-[#F5F5F7]"
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
            </div>
            <span className="font-mono text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
              {robot.id}
            </span>
            {robot.connectivity === "DISCONNECTED" && (
              <WifiOff className="w-3 h-3 text-[#FF3B30] dark:text-[#FF453A]" />
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${badge.bg} ${badge.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
              <span>{badge.label}</span>
            </div>
            <div className="text-[#86868B] pl-0.5">
              {isSelected ? (
                <ChevronUp className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </div>
        </div>

        {/* Card Middle Row: Coordinates & Heading (when collapsed) */}
        {!isSelected && (
          <div className="grid grid-cols-2 gap-1.5 mt-2 text-[10.5px]">
            <div className="bg-[#F5F5F7] dark:bg-[#252528] px-2 py-1 rounded-xl flex items-center gap-1.5 border border-black/[0.02] dark:border-white/[0.03]">
              <MapPin className="w-3 h-3 text-[#0071E3] dark:text-[#2997FF] shrink-0" />
              <span className="font-mono text-[10px] text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold truncate">
                {formatCoordinates(robot.pose.xMeters, robot.pose.yMeters)}
              </span>
            </div>

            <div className="bg-[#F5F5F7] dark:bg-[#252528] px-2 py-1 rounded-xl flex items-center gap-1.5 border border-black/[0.02] dark:border-white/[0.03]">
              <Compass className="w-3 h-3 text-[#86868B] shrink-0" />
              <span className="font-mono text-[10px] text-[#86868B] truncate">
                {yawToDegrees(robot.pose.yawRadians)}°
              </span>
            </div>
          </div>
        )}

        {/* Card Bottom Row: Assigned Order info (when collapsed) */}
        {!isSelected && (
          <div className="flex items-center justify-between text-[10px] text-[#86868B] pt-1.5 mt-1.5 border-t border-black/[0.03] dark:border-white/[0.05]">
            {robot.currentOrderId ? (
              <span className="text-[#0071E3] dark:text-[#2997FF] font-mono font-semibold truncate">
                Order: {robot.currentOrderId}
              </span>
            ) : (
              <span className="text-[#86868B]">No active order</span>
            )}
            <span className="font-mono tabular-nums">
              {formatStateAge(robot.occurredAtUtc)}
            </span>
          </div>
        )}

        {/* Accordion Expanded Inline Inspector */}
        {isSelected && (
          <InlineRobotInspector robot={robot} onClose={onCloseInspector} />
        )}
      </div>
    );
  },
);

RobotCard.displayName = "RobotCard";

export const RobotList: React.FC<RobotListProps> = ({ embedded = false }) => {
  const { t } = useAppConfig();
  const {
    snapshot,
    selectedRobotId,
    setSelectedRobotId,
    selectedNode,
    setSelectedNodeId,
  } = useOperations();

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterState, setFilterState] = useState<string>("ALL");

  const robots = useMemo(() => snapshot?.robots || [], [snapshot?.robots]);

  const filteredRobots = useMemo(() => {
    return robots.filter((r) => {
      const matchesSearch =
        searchQuery === "" ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.currentOrderId &&
          r.currentOrderId.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesFilter =
        filterState === "ALL" ||
        (filterState === "EXECUTING" && r.operationalState === "EXECUTING") ||
        (filterState === "IDLE" &&
          (r.operationalState === "IDLE" ||
            r.operationalState === "CHARGING")) ||
        (filterState === "DISCONNECTED" && r.connectivity === "DISCONNECTED");

      return matchesSearch && matchesFilter;
    });
  }, [robots, searchQuery, filterState]);

  const nodeUiMeta = selectedNode ? getNodeTypeUiMeta(selectedNode.type) : null;

  return (
    <div
      className={
        embedded
          ? "flex flex-col h-full overflow-hidden"
          : "apple-card p-3 sm:p-4 flex flex-col h-[580px] sm:h-[640px] lg:h-[680px] xl:h-[720px] transition-colors duration-300"
      }
    >
      {/* Selected Map Node Inspector Alert Banner (if operator clicked a map node) */}
      {selectedNode && nodeUiMeta && (
        <div className="mb-3 p-3 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] shadow-sm space-y-2 animate-fade-in shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center ${nodeUiMeta.badgeBg}`}
              >
                {selectedNode.type === "rack" && (
                  <Boxes className="w-4 h-4 text-indigo-500" />
                )}
                {selectedNode.type === "workstation" && (
                  <Package className="w-4 h-4 text-cyan-500" />
                )}
                {selectedNode.type === "chute" && (
                  <Inbox className="w-4 h-4 text-emerald-500" />
                )}
                {selectedNode.type === "charger" && (
                  <Zap className="w-4 h-4 text-amber-500" />
                )}
                {selectedNode.type === "buffer" && (
                  <PauseCircle className="w-4 h-4 text-purple-500" />
                )}
                {selectedNode.type === "pillar" && (
                  <ShieldAlert className="w-4 h-4 text-zinc-500" />
                )}
                {selectedNode.type === "waypoint" && (
                  <MapPin className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {selectedNode.name}
                </h4>
                <span className="text-[10px] text-[#86868B]">
                  {selectedNode.zone} · Node #{selectedNode.id}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedNodeId(null)}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
              title="Close node inspector"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono">
            <div className="bg-[#F5F5F7] dark:bg-[#252528] px-2 py-1 rounded-xl">
              <span className="text-[#86868B] text-[9.5px] block font-sans">
                Type
              </span>
              <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {nodeUiMeta.labelKo}
              </span>
            </div>
            <div className="bg-[#F5F5F7] dark:bg-[#252528] px-2 py-1 rounded-xl">
              <span className="text-[#86868B] text-[9.5px] block font-sans">
                Cell
              </span>
              <span className="font-bold text-[#0071E3] dark:text-[#2997FF]">
                ({selectedNode.column}, {selectedNode.row})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Search Input with Apple Pill Design */}
      <div className="relative mb-2.5 shrink-0">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("robotListSearch")}
          className="w-full bg-[#F5F5F7] dark:bg-[#252528] border border-black/[0.06] dark:border-white/[0.08] rounded-full pl-9 pr-8 py-1.5 text-xs text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3] dark:focus:border-[#2997FF] transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] rounded-full cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Filter Tabs Ribbon */}
      <div className="flex items-center gap-1 mb-2.5 bg-[#F2F4F6] dark:bg-[#252528] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] text-[10.5px] overflow-x-auto no-scrollbar shrink-0">
        {["ALL", "EXECUTING", "IDLE", "DISCONNECTED"].map((filter) => {
          const isActive = filterState === filter;
          return (
            <button
              key={`filter-${filter}`}
              onClick={() => setFilterState(filter)}
              className={`px-2.5 py-1 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-white dark:bg-[#1C1C1E] text-[#191F28] dark:text-[#F5F5F7] font-bold shadow-xs"
                  : "text-[#8B95A1] dark:text-[#86868B] hover:text-[#191F28] dark:hover:text-[#F5F5F7]"
              }`}
            >
              {filter === "ALL" ? t("robotListFilterAll") : filter}
            </button>
          );
        })}
      </div>

      {/* Scrollable Robot Cards Container with Accordion Expand */}
      <div
        role="listbox"
        aria-label="Fleet robots list"
        className="flex-1 overflow-y-auto space-y-2.5 pr-1 relative"
      >
        {filteredRobots.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#86868B] font-medium">
            {t("robotNoRobots")}
          </div>
        ) : (
          filteredRobots.map((robot) => {
            const isSelected = robot.id === selectedRobotId;
            return (
              <RobotCard
                key={`robot-card-${robot.id}`}
                robot={robot}
                isSelected={isSelected}
                onSelect={(id) => setSelectedRobotId(id || null)}
                onCloseInspector={() => setSelectedRobotId(null)}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
