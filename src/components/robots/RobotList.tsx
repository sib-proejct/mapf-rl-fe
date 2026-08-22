import React, { useState, useRef, useEffect } from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import { Bot, Search, Wifi, WifiOff, Battery, Zap } from "lucide-react";
import { formatCoordinates } from "../../utils/coordinates/coordinates.ts";
import { formatStateAge } from "../../utils/time/time.ts";

export const RobotList: React.FC = () => {
  const { t } = useAppConfig();
  const { snapshot, selectedRobotId, setSelectedRobotId } = useOperations();

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterState, setFilterState] = useState<string>("ALL");

  const listRef = useRef<HTMLDivElement>(null);

  const robots = snapshot?.robots || [];

  const filteredRobots = robots.filter((r) => {
    const matchesSearch =
      searchQuery === "" ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.currentOrderId &&
        r.currentOrderId.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFilter =
      filterState === "ALL" ||
      (filterState === "EXECUTING" && r.operationalState === "EXECUTING") ||
      (filterState === "IDLE" && r.operationalState === "IDLE") ||
      (filterState === "DISCONNECTED" && r.connectivity === "DISCONNECTED");

    return matchesSearch && matchesFilter;
  });

  // Keyboard navigation support: Arrow Up/Down to navigate robots, Enter to select
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (filteredRobots.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = (index + 1) % filteredRobots.length;
      setSelectedRobotId(filteredRobots[nextIndex].id);
      focusItem(nextIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex =
        (index - 1 + filteredRobots.length) % filteredRobots.length;
      setSelectedRobotId(filteredRobots[prevIndex].id);
      focusItem(prevIndex);
    }
  };

  const focusItem = (index: number) => {
    const item = listRef.current?.querySelectorAll('[role="option"]')[
      index
    ] as HTMLElement;
    if (item) item.focus();
  };

  return (
    <div className="apple-card p-4 flex flex-col h-[520px] sm:h-[600px]">
      {/* Header & Title */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-apple-blue" />
          <h3 className="text-sm font-bold text-apple-text-primary">
            {t("robotListTitle")}
          </h3>
          <span className="text-xs font-mono font-bold bg-black/5 dark:bg-white/10 text-apple-text-secondary px-1.5 py-0.5 rounded-full">
            {filteredRobots.length}
          </span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-apple-text-tertiary" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("robotListSearch")}
          className="w-full bg-apple-surface-subtle border border-apple-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-apple-text-primary placeholder:text-apple-text-tertiary focus:outline-none focus:ring-1 focus:ring-apple-blue transition-all"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-3 text-[11px]">
        {["ALL", "EXECUTING", "IDLE", "DISCONNECTED"].map((filter) => (
          <button
            key={`filter-${filter}`}
            onClick={() => setFilterState(filter)}
            className={`px-2 py-0.5 rounded-full font-medium transition-all ${
              filterState === filter
                ? "bg-apple-blue text-white shadow-xs"
                : "text-apple-text-secondary hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            {filter === "ALL" ? t("robotListFilterAll") : filter}
          </button>
        ))}
      </div>

      {/* Robot Items List with Keyboard Navigation */}
      <div
        ref={listRef}
        role="listbox"
        aria-label="Robots list"
        className="flex-1 overflow-y-auto space-y-1.5 pr-1 focus:outline-none"
      >
        {filteredRobots.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-xs text-apple-text-tertiary text-center">
            {t("robotNoRobots")}
          </div>
        ) : (
          filteredRobots.map((robot, idx) => {
            const isSelected = robot.id === selectedRobotId;
            const isDisconnected = robot.connectivity === "DISCONNECTED";
            const isExecuting = robot.operationalState === "EXECUTING";

            return (
              <div
                key={`robot-item-${robot.id}`}
                role="option"
                tabIndex={0}
                aria-selected={isSelected}
                onClick={() => setSelectedRobotId(robot.id)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-xs select-none focus:outline-none focus:ring-1 focus:ring-apple-blue ${
                  isSelected
                    ? "bg-apple-blue/10 border-apple-blue shadow-xs font-semibold"
                    : "bg-apple-surface hover:bg-black/[0.02] dark:hover:bg-white/[0.04] border-apple-border"
                }`}
              >
                {/* Robot Info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isDisconnected
                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                        : isExecuting
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-apple-blue/15 text-apple-blue"
                    }`}
                  >
                    <Bot className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-apple-text-primary truncate">
                        {robot.id}
                      </span>
                      {robot.currentOrderId && (
                        <span className="text-[10px] font-mono text-apple-text-secondary bg-black/5 dark:bg-white/10 px-1 rounded">
                          {robot.currentOrderId}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-apple-text-secondary tabular-nums truncate">
                      {formatCoordinates(
                        robot.pose.xMeters,
                        robot.pose.yMeters,
                      )}
                    </div>
                  </div>
                </div>

                {/* State Tag & Connectivity */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isExecuting
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : isDisconnected
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                          : "bg-black/5 dark:bg-white/10 text-apple-text-secondary"
                    }`}
                  >
                    {robot.operationalState}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-apple-text-tertiary">
                    {isDisconnected ? (
                      <WifiOff className="w-2.5 h-2.5 text-rose-500" />
                    ) : (
                      <Wifi className="w-2.5 h-2.5 text-emerald-500" />
                    )}
                    <span>{formatStateAge(robot.occurredAtUtc)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Keyboard hint footer */}
      <div className="mt-2 pt-2 border-t border-apple-divider text-[10px] text-apple-text-tertiary text-center">
        {t("robotKeyboardHint")}
      </div>
    </div>
  );
};
