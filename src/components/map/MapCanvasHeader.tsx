import React from "react";
import { Grid, Network, Table, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";

export interface MapLayerOption {
  id: string;
  label: string;
  active: boolean;
  onToggle: () => void;
  title?: string;
}

export interface MapCanvasHeaderProps {
  viewMode?: "canvas" | "graph" | "accessible";
  onToggleViewMode?: (mode: "canvas" | "graph" | "accessible") => void;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;

  // Integrated Zoom & Viewport Controls
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetView?: () => void;

  // Integrated Layer Toggles
  layers?: MapLayerOption[];

  // Custom Slot (e.g. Table Tabs for AccessibleMapList)
  children?: React.ReactNode;
}

export const MapCanvasHeader: React.FC<MapCanvasHeaderProps> = ({
  viewMode = "canvas",
  onToggleViewMode,
  headerLeft,
  headerRight,
  onZoomIn,
  onZoomOut,
  onResetView,
  layers,
  children,
}) => {
  const { t } = useAppConfig();

  const hasZoomControls = onZoomIn || onZoomOut || onResetView;
  const hasLayers = layers && layers.length > 0;

  return (
    <div className="shrink-0 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 border-b border-black/[0.05] dark:border-white/[0.06] bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-md relative z-20 flex-nowrap select-none">
      {/* Left Slot: Viewport Info & Mode Switcher */}
      <div className="flex items-center gap-2 text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] shrink-0">
        {headerLeft}
        {headerLeft && onToggleViewMode && (
          <div className="h-4 w-[1px] bg-black/10 dark:bg-white/15 hidden sm:block shrink-0" />
        )}

        {/* Standardized Mode Switcher */}
        {onToggleViewMode && (
          <div className="inline-flex bg-[#F2F4F6] dark:bg-[#252528] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] items-center gap-0.5 text-xs shrink-0">
            <button
              onClick={() => onToggleViewMode("canvas")}
              className={`px-2.5 sm:px-3 py-1 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "canvas"
                  ? "bg-white dark:bg-[#1C1C1E] text-[#0071E3] dark:text-[#2997FF] font-bold shadow-xs"
                  : "text-[#8B95A1] dark:text-[#86868B] hover:text-[#191F28] dark:hover:text-[#F5F5F7]"
              }`}
              title={t("mapCanvasView")}
            >
              <Grid className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">2D Canvas (Fast)</span>
              <span className="md:hidden">2D</span>
            </button>

            <button
              onClick={() => onToggleViewMode("graph")}
              className={`px-2.5 sm:px-3 py-1 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "graph"
                  ? "bg-white dark:bg-[#1C1C1E] text-[#0071E3] dark:text-[#2997FF] font-bold shadow-xs"
                  : "text-[#8B95A1] dark:text-[#86868B] hover:text-[#191F28] dark:hover:text-[#F5F5F7]"
              }`}
              title={t("mapGraphView")}
            >
              <Network className="w-3.5 h-3.5 text-[#34C759] dark:text-[#30D158] shrink-0" />
              <span className="hidden md:inline">Graph Topology</span>
              <span className="md:hidden">Graph</span>
            </button>

            <button
              onClick={() => onToggleViewMode("accessible")}
              className={`px-2.5 sm:px-3 py-1 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "accessible"
                  ? "bg-white dark:bg-[#1C1C1E] text-[#0071E3] dark:text-[#2997FF] font-bold shadow-xs"
                  : "text-[#8B95A1] dark:text-[#86868B] hover:text-[#191F28] dark:hover:text-[#F5F5F7]"
              }`}
              title={t("mapAccessibleView")}
            >
              <Table className="w-3.5 h-3.5 text-[#FF9F0A] shrink-0" />
              <span className="hidden md:inline">Table View</span>
              <span className="md:hidden">Table</span>
            </button>
          </div>
        )}
      </div>

      {/* Right Slot: Common Zoom/Layer Controls, Custom Children + Header Right */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* 1. Standard Zoom Controls */}
        {hasZoomControls && (
          <div className="flex items-center gap-1 shrink-0">
            {onZoomIn && (
              <button
                onClick={onZoomIn}
                className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-[#1D1D1F] dark:text-[#F5F5F7] transition-all cursor-pointer"
                title={t("mapZoomIn")}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            )}
            {onZoomOut && (
              <button
                onClick={onZoomOut}
                className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-[#1D1D1F] dark:text-[#F5F5F7] transition-all cursor-pointer"
                title={t("mapZoomOut")}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
            )}
            {onResetView && (
              <button
                onClick={onResetView}
                className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-[#1D1D1F] dark:text-[#F5F5F7] transition-all cursor-pointer"
                title={t("mapResetView")}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* 2. Standard Layer Toggles */}
        {hasLayers && (
          <>
            <div className="h-4 w-[1px] bg-black/10 dark:bg-white/15 mx-0.5 shrink-0" />
            <div className="flex items-center gap-1 shrink-0">
              {layers.map((layer) => (
                <button
                  key={layer.id}
                  onClick={layer.onToggle}
                  className={`px-2 h-7 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                    layer.active
                      ? "bg-black/5 dark:bg-white/10 text-[#0071E3] dark:text-[#2997FF] font-semibold"
                      : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
                  }`}
                  title={layer.title || layer.label}
                >
                  <span>{layer.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* 3. Custom Children Slot (e.g. Accessible tabs) */}
        {children}

        {/* 4. Header Right (Sidebar toggle, layout presets, reset) */}
        {headerRight && (
          <>
            <div className="h-4 w-[1px] bg-black/10 dark:bg-white/15 mx-0.5 shrink-0" />
            {headerRight}
          </>
        )}
      </div>
    </div>
  );
};
