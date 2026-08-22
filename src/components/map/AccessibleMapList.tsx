import React from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import {
  worldToCell,
  formatCoordinates,
  yawToDegrees,
} from "../../utils/coordinates/coordinates.ts";
import {
  formatAngleRadians,
  formatDistanceMeters,
} from "../../utils/units/units.ts";
import { Check, Bot, AlertTriangle, Wifi, WifiOff } from "lucide-react";

export const AccessibleMapList: React.FC = () => {
  const { t } = useAppConfig();
  const { snapshot, selectedRobotId, setSelectedRobotId } = useOperations();

  const map = snapshot?.map;
  const robots = snapshot?.robots || [];
  const orders = snapshot?.orders || [];

  const resolution = map?.resolutionMeters || 0.5;
  const origin = map?.origin || { xMeters: 0, yMeters: 0 };
  const widthCells = map?.widthCells || 0;
  const heightCells = map?.heightCells || 0;

  const blockedCount = map?.cells?.filter((c) => c === 1).length || 0;
  const traversableCount = map?.cells?.filter((c) => c === 0).length || 0;

  return (
    <section
      aria-labelledby="a11y-table-heading"
      className="apple-card p-5 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-apple-divider pb-3">
        <div>
          <h3
            id="a11y-table-heading"
            className="text-sm font-bold text-apple-text-primary"
          >
            {t("a11yTableTitle")}
          </h3>
          <p className="text-xs text-apple-text-secondary mt-0.5">
            {t("a11yTableDescription")}
          </p>
        </div>

        {/* Map Summary Pill */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-apple-text-secondary bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg">
          <span>
            {widthCells}×{heightCells} cells ({formatDistanceMeters(resolution)}
            /cell)
          </span>
          <span>•</span>
          <span className="text-apple-text-primary">
            {blockedCount} {t("mapBlocked")}, {traversableCount}{" "}
            {t("mapTraversable")}
          </span>
        </div>
      </div>

      {/* Accessible Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-apple-border text-apple-text-secondary text-[11px] font-semibold">
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
          <tbody className="divide-y divide-apple-divider">
            {robots.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-8 text-center text-apple-text-tertiary"
                >
                  {t("robotNoRobots")}
                </td>
              </tr>
            ) : (
              robots.map((robot) => {
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

                return (
                  <tr
                    key={`a11y-${robot.id}`}
                    className={`transition-colors ${
                      isSelected
                        ? "bg-apple-blue/10 font-medium"
                        : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                    }`}
                  >
                    {/* Robot ID */}
                    <td className="py-2.5 px-3 font-mono font-bold text-apple-text-primary">
                      <div className="flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-apple-blue" />
                        <span>{robot.id}</span>
                      </div>
                    </td>

                    {/* Pose (X, Y, Yaw) */}
                    <td className="py-2.5 px-3 font-mono tabular-nums text-apple-text-secondary">
                      {formatCoordinates(
                        robot.pose.xMeters,
                        robot.pose.yMeters,
                      )}{" "}
                      • {formatAngleRadians(robot.pose.yawRadians)}
                    </td>

                    {/* Cell (Col, Row) */}
                    <td className="py-2.5 px-3 font-mono tabular-nums text-apple-text-secondary">
                      ({cell.column}, {cell.row})
                    </td>

                    {/* State */}
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          robot.operationalState === "EXECUTING"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : robot.operationalState === "HELD"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-black/5 dark:bg-white/10 text-apple-text-secondary"
                        }`}
                      >
                        {robot.operationalState}
                      </span>
                    </td>

                    {/* Connectivity */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1 text-[11px]">
                        {robot.connectivity === "CONNECTED" ? (
                          <Wifi className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <WifiOff className="w-3 h-3 text-rose-500" />
                        )}
                        <span
                          className={
                            robot.connectivity === "DISCONNECTED"
                              ? "text-rose-600 dark:text-rose-400 font-semibold"
                              : "text-apple-text-secondary"
                          }
                        >
                          {robot.connectivity}
                        </span>
                      </div>
                    </td>

                    {/* Safety */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1 text-[11px]">
                        {robot.safety !== "NORMAL" &&
                        robot.safety !== "WAIT" ? (
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                        ) : null}
                        <span
                          className={
                            robot.safety !== "NORMAL"
                              ? "text-amber-600 dark:text-amber-400 font-bold"
                              : "text-apple-text-secondary"
                          }
                        >
                          {robot.safety}
                        </span>
                      </div>
                    </td>

                    {/* Order & Goal */}
                    <td className="py-2.5 px-3 font-mono text-[11px] text-apple-text-secondary">
                      {assignedOrder ? (
                        <span>
                          {assignedOrder.id}{" "}
                          {goal
                            ? `→ (${goal.goalColumn}, ${goal.goalRow})`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-apple-text-tertiary">-</span>
                      )}
                    </td>

                    {/* Action Select Button */}
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => setSelectedRobotId(robot.id)}
                        aria-label={t("a11ySelectRobot", { id: robot.id })}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                          isSelected
                            ? "bg-apple-blue text-white shadow-xs"
                            : "bg-black/5 dark:bg-white/10 hover:bg-apple-blue hover:text-white text-apple-text-primary"
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
      </div>
    </section>
  );
};
