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
} from "lucide-react";
import {
  worldToCell,
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

export const RobotInspector: React.FC = () => {
  const { t } = useAppConfig();
  const { snapshot, selectedRobot, setSelectedRobotId } = useOperations();

  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [copiedDigest, setCopiedDigest] = useState<boolean>(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedRobotId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedRobotId]);

  if (!selectedRobot) {
    return (
      <div className="apple-card p-6 h-full flex flex-col items-center justify-center text-center text-apple-text-tertiary">
        <Bot className="w-8 h-8 opacity-40 mb-2" />
        <p className="text-xs max-w-xs">{t("inspectorNoSelection")}</p>
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
      className="apple-card p-5 h-full flex flex-col justify-between overflow-y-auto space-y-4 shadow-apple-drawer dark:shadow-apple-drawer-dark border border-apple-border"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-apple-divider pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-apple-blue/15 text-apple-blue flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold font-mono text-apple-text-primary">
                {selectedRobot.id}
              </h3>
              <button
                onClick={handleCopyId}
                className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors text-apple-text-secondary"
                title={t("inspectorCopyId")}
              >
                {copiedId ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
            <div className="text-[10px] text-apple-text-tertiary font-mono">
              v{selectedRobot.stateVersion} • epoch #
              {selectedRobot.sessionEpoch}
            </div>
          </div>
        </div>

        <button
          onClick={() => setSelectedRobotId(null)}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-apple-text-secondary transition-colors"
          title={t("inspectorClose")}
          aria-label={t("inspectorClose")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Telemetry Specs */}
      <div className="space-y-3.5 text-xs">
        {/* 1. Operational & Connectivity State */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-apple-surface-subtle p-2.5 rounded-xl border border-apple-border">
            <span className="text-[10px] font-medium text-apple-text-secondary block">
              Operational State
            </span>
            <span
              className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                isExecuting
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : selectedRobot.operationalState === "HELD"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-black/5 dark:bg-white/10 text-apple-text-primary"
              }`}
            >
              {selectedRobot.operationalState}
            </span>
          </div>

          <div className="bg-apple-surface-subtle p-2.5 rounded-xl border border-apple-border">
            <span className="text-[10px] font-medium text-apple-text-secondary block">
              Connectivity
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              {isDisconnected ? (
                <WifiOff className="w-3.5 h-3.5 text-rose-500" />
              ) : (
                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              )}
              <span
                className={`text-[11px] font-bold uppercase ${
                  isDisconnected
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-apple-text-primary"
                }`}
              >
                {selectedRobot.connectivity}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Position & Heading */}
        <div className="bg-apple-surface-subtle p-3 rounded-xl border border-apple-border space-y-2">
          <div className="flex items-center gap-1.5 text-apple-text-secondary text-[11px] font-semibold">
            <Compass className="w-3.5 h-3.5 text-apple-blue" />
            <span>{t("inspectorPose")}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
            <div>
              <span className="text-[10px] text-apple-text-tertiary block">
                World (X, Y)
              </span>
              <span className="text-xs font-bold text-apple-text-primary">
                {formatCoordinates(
                  selectedRobot.pose.xMeters,
                  selectedRobot.pose.yMeters,
                )}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-apple-text-tertiary block">
                Grid Cell (Col, Row)
              </span>
              <span className="text-xs font-bold text-apple-text-primary">
                ({cell.column}, {cell.row})
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-[10px] text-apple-text-tertiary block">
                Yaw (Counter-Clockwise)
              </span>
              <span className="text-xs font-bold text-apple-text-primary">
                {formatAngleRadians(selectedRobot.pose.yawRadians)}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Controller & Policy Identity */}
        <div className="bg-apple-surface-subtle p-3 rounded-xl border border-apple-border space-y-2">
          <div className="flex items-center gap-1.5 text-apple-text-secondary text-[11px] font-semibold">
            <Cpu className="w-3.5 h-3.5 text-purple-500" />
            <span>{t("inspectorActiveController")}</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-apple-text-primary">
                {selectedRobot.activeController?.identity ||
                  "cardinal-baseline/1.0.0"}
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400">
                {selectedRobot.activeController?.mode || "BASELINE"}
              </span>
            </div>

            {selectedRobot.activeController?.contentDigestSha256 && (
              <div className="flex items-center justify-between font-mono text-[10px] text-apple-text-tertiary">
                <span>Digest:</span>
                <div className="flex items-center gap-1">
                  <span>
                    {formatShortId(
                      selectedRobot.activeController.contentDigestSha256,
                      8,
                      4,
                    )}
                  </span>
                  <button
                    onClick={handleCopyDigest}
                    className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded"
                    title="Copy Controller Digest"
                  >
                    {copiedDigest ? (
                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-2.5 h-2.5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Active Order */}
        <div className="bg-apple-surface-subtle p-3 rounded-xl border border-apple-border space-y-1.5">
          <div className="flex items-center gap-1.5 text-apple-text-secondary text-[11px] font-semibold">
            <Box className="w-3.5 h-3.5 text-amber-500" />
            <span>{t("inspectorActiveOrder")}</span>
          </div>

          {selectedRobot.currentOrderId ? (
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-apple-text-primary text-xs">
                {selectedRobot.currentOrderId}
              </span>
              <span className="font-mono text-[10px] text-apple-text-secondary bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
                update #{selectedRobot.orderUpdateId ?? 0}
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-apple-text-tertiary">
              No order currently assigned
            </div>
          )}
        </div>

        {/* 5. Safety Status */}
        <div className="bg-apple-surface-subtle p-3 rounded-xl border border-apple-border flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-apple-text-secondary text-[11px] font-semibold">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>{t("inspectorSafetyStatus")}</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              selectedRobot.safety === "NORMAL" ||
              selectedRobot.safety === "WAIT"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
            }`}
          >
            {selectedRobot.safety}
          </span>
        </div>

        {/* 6. Time & Freshness Metadata */}
        <div className="bg-apple-surface-subtle p-3 rounded-xl border border-apple-border space-y-1 text-[11px] font-mono text-apple-text-secondary tabular-nums">
          <div className="flex items-center justify-between">
            <span className="text-apple-text-tertiary">Simulation Time:</span>
            <span className="font-bold text-apple-text-primary">
              {formatSimulationTime(selectedRobot.simulationTimeMs)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-apple-text-tertiary">State Age:</span>
            <span>{formatStateAge(selectedRobot.occurredAtUtc)}</span>
          </div>
          <div className="flex items-center justify-between truncate text-[10px]">
            <span className="text-apple-text-tertiary">UTC:</span>
            <span className="truncate">
              {formatUtcIso(selectedRobot.occurredAtUtc)}
            </span>
          </div>
        </div>
      </div>

      {/* Inspector Footer */}
      <div className="pt-2 text-center text-[10px] text-apple-text-tertiary border-t border-apple-divider">
        Press{" "}
        <kbd className="px-1 py-0.5 bg-black/5 dark:bg-white/10 rounded font-mono">
          Esc
        </kbd>{" "}
        to close inspector
      </div>
    </aside>
  );
};
