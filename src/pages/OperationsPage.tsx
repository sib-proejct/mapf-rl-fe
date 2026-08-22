import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAppConfig } from "../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../app/providers/OperationsContext.tsx";
import { IncidentStrip } from "../components/common/IncidentStrip.tsx";
import { BentoStatusRail } from "../components/common/BentoStatusRail.tsx";
import { FastMapCanvas } from "../components/map/FastMapCanvas.tsx";
import { GraphMapCanvas } from "../components/map/GraphMapCanvas.tsx";
import { AccessibleMapList } from "../components/map/AccessibleMapList.tsx";
import { OperationsSidebar } from "../components/common/OperationsSidebar.tsx";
import {
  LoadingSkeleton,
  EmptyStateView,
  ErrorStateView,
} from "../components/common/StateViews.tsx";
import {
  Maximize2,
  Minimize2,
  RotateCcw,
  Sliders,
  PanelRightClose,
  PanelRightOpen,
  GripVertical,
  GripHorizontal,
  MoveDiagonal,
} from "lucide-react";

const STORAGE_KEY_HEIGHT = "mapf_map_height";
const STORAGE_KEY_WIDTH_RATIO = "mapf_map_width_ratio";

const DEFAULT_HEIGHT = 680;
const MIN_HEIGHT = 420;
const MAX_HEIGHT = 1400;

const DEFAULT_WIDTH_RATIO = 72; // 72% Map / 28% Sidebar
const MIN_WIDTH_RATIO = 40;
const MAX_WIDTH_RATIO = 88;

export const OperationsPage: React.FC = () => {
  const { t, language } = useAppConfig();
  const { snapshot, loading, error, refreshSnapshot, setUseFixture } =
    useOperations();

  const [viewMode, setViewMode] = useState<"canvas" | "graph" | "accessible">(
    "canvas",
  );

  // User-adjustable Map Card Height
  const [mapHeight, setMapHeight] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_HEIGHT);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= MIN_HEIGHT && parsed <= MAX_HEIGHT) {
        return parsed;
      }
    }
    return DEFAULT_HEIGHT;
  });

  // User-adjustable Map Card Width Ratio (in percent, e.g. 72%)
  const [mapWidthRatio, setMapWidthRatio] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_WIDTH_RATIO);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (
        !isNaN(parsed) &&
        ((parsed >= MIN_WIDTH_RATIO && parsed <= MAX_WIDTH_RATIO) ||
          parsed === 100)
      ) {
        return parsed;
      }
    }
    return DEFAULT_WIDTH_RATIO;
  });

  // Full-width map toggle (sidebar collapsed)
  const isSidebarCollapsed = mapWidthRatio === 100;
  const lastExpandedRatioRef = useRef<number>(
    mapWidthRatio !== 100 ? mapWidthRatio : DEFAULT_WIDTH_RATIO,
  );

  // Resizing state
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const [isResizingHeight, setIsResizingHeight] = useState(false);
  const [isResizingCorner, setIsResizingCorner] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);

  const sectionRef = useRef<HTMLDivElement>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);

  // Save height changes
  const updateMapHeight = useCallback((height: number) => {
    const clamped = Math.min(Math.max(height, MIN_HEIGHT), MAX_HEIGHT);
    setMapHeight(clamped);
    try {
      localStorage.setItem(STORAGE_KEY_HEIGHT, String(clamped));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save width ratio changes
  const updateMapWidthRatio = useCallback((ratio: number) => {
    const clamped =
      ratio === 100
        ? 100
        : Math.min(Math.max(ratio, MIN_WIDTH_RATIO), MAX_WIDTH_RATIO);
    setMapWidthRatio(clamped);
    if (clamped !== 100) {
      lastExpandedRatioRef.current = clamped;
    }
    try {
      localStorage.setItem(STORAGE_KEY_WIDTH_RATIO, String(clamped));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Reset dimensions to default
  const handleResetDimensions = () => {
    updateMapHeight(DEFAULT_HEIGHT);
    updateMapWidthRatio(DEFAULT_WIDTH_RATIO);
  };

  // Toggle Sidebar collapse
  const handleToggleSidebar = () => {
    if (isSidebarCollapsed) {
      updateMapWidthRatio(lastExpandedRatioRef.current || DEFAULT_WIDTH_RATIO);
    } else {
      lastExpandedRatioRef.current = mapWidthRatio;
      updateMapWidthRatio(100);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        layoutMenuRef.current &&
        !layoutMenuRef.current.contains(e.target as Node)
      ) {
        setShowLayoutMenu(false);
      }
    };
    if (showLayoutMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showLayoutMenu]);

  // Horizontal Splitter Dragging (Width Resize)
  const startWidthResize = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsResizingWidth(true);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      const onMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
        if (!sectionRef.current) return;
        const rect = sectionRef.current.getBoundingClientRect();
        const clientX =
          "touches" in moveEvent
            ? moveEvent.touches[0].clientX
            : moveEvent.clientX;
        const rawRatio = ((clientX - rect.left) / rect.width) * 100;
        updateMapWidthRatio(Math.round(rawRatio));
      };

      const onMouseUp = () => {
        setIsResizingWidth(false);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("touchmove", onMouseMove);
        window.removeEventListener("touchend", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onMouseMove);
      window.addEventListener("touchend", onMouseUp);
    },
    [updateMapWidthRatio],
  );

  // Vertical Bottom Handle Dragging (Height Resize)
  const startHeightResize = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsResizingHeight(true);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";

      const startY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const initialHeight = mapHeight;

      const onMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
        const clientY =
          "touches" in moveEvent
            ? moveEvent.touches[0].clientY
            : moveEvent.clientY;
        const deltaY = clientY - startY;
        updateMapHeight(initialHeight + deltaY);
      };

      const onMouseUp = () => {
        setIsResizingHeight(false);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("touchmove", onMouseMove);
        window.removeEventListener("touchend", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onMouseMove);
      window.addEventListener("touchend", onMouseUp);
    },
    [mapHeight, updateMapHeight],
  );

  // Corner 2D Dragging (Width + Height Simultaneous Resize)
  const startCornerResize = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsResizingCorner(true);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "nwse-resize";

      const startY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const initialHeight = mapHeight;

      const onMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
        if (!sectionRef.current) return;
        const rect = sectionRef.current.getBoundingClientRect();
        const clientX =
          "touches" in moveEvent
            ? moveEvent.touches[0].clientX
            : moveEvent.clientX;
        const clientY =
          "touches" in moveEvent
            ? moveEvent.touches[0].clientY
            : moveEvent.clientY;

        const rawRatio = ((clientX - rect.left) / rect.width) * 100;
        updateMapWidthRatio(Math.round(rawRatio));

        const deltaY = clientY - startY;
        updateMapHeight(initialHeight + deltaY);
      };

      const onMouseUp = () => {
        setIsResizingCorner(false);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("touchmove", onMouseMove);
        window.removeEventListener("touchend", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onMouseMove);
      window.addEventListener("touchend", onMouseUp);
    },
    [mapHeight, updateMapHeight, updateMapWidthRatio],
  );

  if (loading && !snapshot) {
    return (
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6 animate-fade-in">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6 animate-fade-in">
        <ErrorStateView
          problem={error}
          onRetry={refreshSnapshot}
          onUseFixture={() => setUseFixture(true)}
        />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6 animate-fade-in">
        <EmptyStateView />
      </div>
    );
  }

  const viewportHeaderLeft = (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight shrink-0">
        {language === "ko" ? "운영 관제 뷰포트" : "Operations Viewport"}
      </span>
      <span className="text-[11px] font-mono text-[#86868B] tabular-nums bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-lg border border-black/[0.04] dark:border-white/[0.06] shrink-0">
        {mapWidthRatio}% W · {mapHeight}px H
      </span>
    </div>
  );

  const viewportHeaderRight = (
    <div className="relative shrink-0" ref={layoutMenuRef}>
      <div className="flex items-center gap-1 bg-[#F2F4F6] dark:bg-[#252528] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
        {/* Toggle Fullscreen / Sidebar */}
        <button
          onClick={handleToggleSidebar}
          className={`p-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
            isSidebarCollapsed
              ? "bg-[#0071E3] text-white shadow-xs"
              : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
          }`}
          title={
            isSidebarCollapsed
              ? language === "ko"
                ? "사이드바 복원"
                : "Restore Sidebar"
              : language === "ko"
                ? "전체 맵 확대 (사이드바 접기)"
                : "Full Map View (Collapse Sidebar)"
          }
        >
          {isSidebarCollapsed ? (
            <PanelRightOpen className="w-3.5 h-3.5" />
          ) : (
            <PanelRightClose className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Sizing Presets Dropdown Toggle */}
        <button
          onClick={() => setShowLayoutMenu((v) => !v)}
          className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            showLayoutMenu
              ? "bg-white dark:bg-[#1C1C1E] text-[#0071E3] dark:text-[#2997FF] shadow-xs"
              : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
          }`}
          title={t("mapLayoutPresets")}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-semibold">
            {t("mapLayoutPresets")}
          </span>
        </button>

        {/* Reset Size Button */}
        {(mapHeight !== DEFAULT_HEIGHT ||
          mapWidthRatio !== DEFAULT_WIDTH_RATIO) && (
          <button
            onClick={handleResetDimensions}
            className="p-1.5 rounded-xl text-[#86868B] hover:text-[#0071E3] dark:hover:text-[#2997FF] hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
            title={t("mapLayoutReset")}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Sizing Presets Dropdown Panel */}
      {showLayoutMenu && (
        <div className="absolute right-0 top-full mt-2 w-72 apple-card p-3.5 shadow-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl z-50 space-y-3 animate-fade-in">
          {/* Width Presets */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider block">
              {language === "ko" ? "맵 너비 분할" : "Map Width Split"}
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                onClick={() => {
                  updateMapWidthRatio(100);
                  setShowLayoutMenu(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-left font-medium transition-all ${
                  mapWidthRatio === 100
                    ? "bg-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF] font-bold border border-[#0071E3]/20"
                    : "hover:bg-black/5 dark:hover:bg-white/5 text-[#1D1D1F] dark:text-[#F5F5F7]"
                }`}
              >
                100% {language === "ko" ? "(전체)" : "(Full)"}
              </button>
              <button
                onClick={() => {
                  updateMapWidthRatio(80);
                  setShowLayoutMenu(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-left font-medium transition-all ${
                  mapWidthRatio === 80
                    ? "bg-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF] font-bold border border-[#0071E3]/20"
                    : "hover:bg-black/5 dark:hover:bg-white/5 text-[#1D1D1F] dark:text-[#F5F5F7]"
                }`}
              >
                80% / 20%
              </button>
              <button
                onClick={() => {
                  updateMapWidthRatio(72);
                  setShowLayoutMenu(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-left font-medium transition-all ${
                  mapWidthRatio === 72
                    ? "bg-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF] font-bold border border-[#0071E3]/20"
                    : "hover:bg-black/5 dark:hover:bg-white/5 text-[#1D1D1F] dark:text-[#F5F5F7]"
                }`}
              >
                72% {language === "ko" ? "(기본)" : "(Default)"}
              </button>
              <button
                onClick={() => {
                  updateMapWidthRatio(55);
                  setShowLayoutMenu(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-left font-medium transition-all ${
                  mapWidthRatio === 55
                    ? "bg-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF] font-bold border border-[#0071E3]/20"
                    : "hover:bg-black/5 dark:hover:bg-white/5 text-[#1D1D1F] dark:text-[#F5F5F7]"
                }`}
              >
                55% / 45%
              </button>
            </div>
          </div>

          {/* Height Presets */}
          <div className="space-y-1.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
            <span className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider block">
              {language === "ko" ? "뷰포트 높이" : "Viewport Height"}
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                onClick={() => {
                  updateMapHeight(540);
                  setShowLayoutMenu(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-left font-medium transition-all ${
                  mapHeight === 540
                    ? "bg-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF] font-bold border border-[#0071E3]/20"
                    : "hover:bg-black/5 dark:hover:bg-white/5 text-[#1D1D1F] dark:text-[#F5F5F7]"
                }`}
              >
                540px {language === "ko" ? "(콤팩트)" : "(Compact)"}
              </button>
              <button
                onClick={() => {
                  updateMapHeight(680);
                  setShowLayoutMenu(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-left font-medium transition-all ${
                  mapHeight === 680
                    ? "bg-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF] font-bold border border-[#0071E3]/20"
                    : "hover:bg-black/5 dark:hover:bg-white/5 text-[#1D1D1F] dark:text-[#F5F5F7]"
                }`}
              >
                680px {language === "ko" ? "(표준)" : "(Standard)"}
              </button>
              <button
                onClick={() => {
                  updateMapHeight(840);
                  setShowLayoutMenu(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-left font-medium transition-all ${
                  mapHeight === 840
                    ? "bg-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF] font-bold border border-[#0071E3]/20"
                    : "hover:bg-black/5 dark:hover:bg-white/5 text-[#1D1D1F] dark:text-[#F5F5F7]"
                }`}
              >
                840px {language === "ko" ? "(확대)" : "(Expanded)"}
              </button>
              <button
                onClick={() => {
                  updateMapHeight(1000);
                  setShowLayoutMenu(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-left font-medium transition-all ${
                  mapHeight === 1000
                    ? "bg-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF] font-bold border border-[#0071E3]/20"
                    : "hover:bg-black/5 dark:hover:bg-white/5 text-[#1D1D1F] dark:text-[#F5F5F7]"
                }`}
              >
                1000px {language === "ko" ? "(최대)" : "(Tall)"}
              </button>
            </div>
          </div>

          {/* Reset Action */}
          <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08] flex justify-between items-center text-xs">
            <span className="text-[11px] text-[#86868B]">
              {language === "ko"
                ? "핸들 드래그로 미세 조절"
                : "Drag handles for custom size"}
            </span>
            <button
              onClick={() => {
                handleResetDimensions();
                setShowLayoutMenu(false);
              }}
              className="font-bold text-[#0071E3] dark:text-[#2997FF] hover:underline"
            >
              {t("mapLayoutReset")}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-6 space-y-4 sm:space-y-5 animate-fade-in">
      {/* 1. Incident Alert Strip */}
      <IncidentStrip />

      {/* 2. Bento Status Rail */}
      <BentoStatusRail />

      {/* 3. Side-by-Side Operations Console with Interactive Resizable Layout */}
      <div className="relative">
        <section
          ref={sectionRef}
          className="flex flex-col lg:flex-row items-stretch gap-0 relative"
          style={{ height: `${mapHeight}px` }}
        >
          {/* Left Column: Interactive Map Viewport */}
          <div
            className="flex flex-col min-w-0 transition-all duration-75 relative"
            style={{
              width: isSidebarCollapsed ? "100%" : `${mapWidthRatio}%`,
              height: "100%",
            }}
          >
            {viewMode === "canvas" ? (
              <FastMapCanvas
                viewMode={viewMode}
                onToggleViewMode={setViewMode}
                headerLeft={viewportHeaderLeft}
                headerRight={viewportHeaderRight}
              />
            ) : viewMode === "graph" ? (
              <GraphMapCanvas
                viewMode={viewMode}
                onToggleViewMode={setViewMode}
                headerLeft={viewportHeaderLeft}
                headerRight={viewportHeaderRight}
              />
            ) : (
              <AccessibleMapList
                viewMode={viewMode}
                onToggleViewMode={setViewMode}
                headerLeft={viewportHeaderLeft}
                headerRight={viewportHeaderRight}
              />
            )}

            {/* Bottom-Right 2D Corner Resize Grip on Map Card */}
            {!isSidebarCollapsed && (
              <div
                onMouseDown={startCornerResize}
                onTouchStart={startCornerResize}
                className="absolute bottom-1 right-1 w-5 h-5 z-20 cursor-nwse-resize flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity text-[#86868B] hover:text-[#0071E3] dark:hover:text-[#2997FF]"
                title={t("mapResizeDragPrompt")}
              >
                <MoveDiagonal className="w-3.5 h-3.5 transform -rotate-45" />
              </div>
            )}
          </div>

          {/* Draggable Vertical Splitter Handle (Desktop only, when sidebar is open) */}
          {!isSidebarCollapsed && (
            <div
              onMouseDown={startWidthResize}
              onTouchStart={startWidthResize}
              onDoubleClick={() => updateMapWidthRatio(DEFAULT_WIDTH_RATIO)}
              className={`hidden lg:flex w-4 -mx-2 items-center justify-center cursor-col-resize z-20 group select-none touch-none transition-colors ${
                isResizingWidth ? "bg-[#0071E3]/20" : "hover:bg-[#0071E3]/10"
              }`}
              title={t("mapResizeDragPrompt")}
            >
              <div
                className={`w-1 h-12 rounded-full transition-all duration-150 ${
                  isResizingWidth
                    ? "bg-[#0071E3] dark:bg-[#2997FF] h-16 w-1.5 shadow-sm shadow-[#0071E3]/50"
                    : "bg-black/20 dark:bg-white/20 group-hover:bg-[#0071E3] dark:group-hover:bg-[#2997FF] group-hover:h-14"
                }`}
              />
            </div>
          )}

          {/* Right Column: Slim Operations Sidebar (Collapsible) */}
          {!isSidebarCollapsed && (
            <div
              className="flex flex-col min-w-0 transition-all duration-75"
              style={{
                width: `${100 - mapWidthRatio}%`,
                height: "100%",
              }}
            >
              <OperationsSidebar />
            </div>
          )}
        </section>

        {/* Draggable Bottom Handle for Height Resizing */}
        <div
          onMouseDown={startHeightResize}
          onTouchStart={startHeightResize}
          onDoubleClick={() => updateMapHeight(DEFAULT_HEIGHT)}
          className={`h-4 -my-1 w-full flex items-center justify-center cursor-row-resize z-20 group select-none touch-none transition-colors ${
            isResizingHeight
              ? "bg-[#0071E3]/20 rounded-xl"
              : "hover:bg-[#0071E3]/10 rounded-xl"
          }`}
          title={t("mapResizeDragPrompt")}
        >
          <div
            className={`h-1 rounded-full transition-all duration-150 ${
              isResizingHeight
                ? "bg-[#0071E3] dark:bg-[#2997FF] w-24 h-1.5 shadow-sm shadow-[#0071E3]/50"
                : "bg-black/20 dark:bg-white/20 w-16 group-hover:bg-[#0071E3] dark:group-hover:bg-[#2997FF] group-hover:w-20"
            }`}
          />
        </div>
      </div>
    </div>
  );
};
