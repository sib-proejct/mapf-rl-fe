import { useState, useEffect, useRef, useCallback, useMemo } from "react";

export interface UseVirtualListOptions {
  itemCount: number;
  itemHeight: number;
  containerHeight?: number;
  overscan?: number;
}

export interface VirtualItem {
  index: number;
  offsetTop: number;
  height: number;
}

export interface UseVirtualListReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  virtualItems: VirtualItem[];
  totalHeight: number;
  startIndex: number;
  endIndex: number;
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
}

/**
 * Pure TypeScript, zero-dependency lightweight virtual scroll hook.
 * Caps the number of rendered DOM elements to only visible items + overscan buffer.
 * O(1) DOM overhead regardless of list size (e.g. 500+ items).
 */
export function useVirtualList({
  itemCount,
  itemHeight,
  containerHeight: initialContainerHeight = 500,
  overscan = 3,
}: UseVirtualListOptions): UseVirtualListReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [measuredHeight, setMeasuredHeight] = useState<number>(
    initialContainerHeight,
  );

  // ResizeObserver to track container height
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setMeasuredHeight(entry.contentRect.height);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Scroll listener on container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        if (containerRef.current) {
          setScrollTop(containerRef.current.scrollTop);
        }
        rafId = null;
      });
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  const totalHeight = itemCount * itemHeight;

  const { startIndex, endIndex, virtualItems } = useMemo(() => {
    if (itemCount === 0) {
      return { startIndex: 0, endIndex: 0, virtualItems: [] };
    }

    const calculatedStart = Math.floor(scrollTop / itemHeight);
    const calculatedVisibleCount = Math.ceil(measuredHeight / itemHeight);

    const start = Math.max(0, calculatedStart - overscan);
    const end = Math.min(
      itemCount - 1,
      calculatedStart + calculatedVisibleCount + overscan,
    );

    const items: VirtualItem[] = [];
    for (let i = start; i <= end; i++) {
      items.push({
        index: i,
        offsetTop: i * itemHeight,
        height: itemHeight,
      });
    }

    return {
      startIndex: start,
      endIndex: end,
      virtualItems: items,
    };
  }, [scrollTop, itemHeight, measuredHeight, itemCount, overscan]);

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "auto") => {
      const el = containerRef.current;
      if (!el || index < 0 || index >= itemCount) return;

      const targetTop = index * itemHeight;
      const currentTop = el.scrollTop;
      const visibleBottom = currentTop + measuredHeight;

      if (targetTop < currentTop) {
        // Target is above visible area
        el.scrollTo({ top: targetTop, behavior });
      } else if (targetTop + itemHeight > visibleBottom) {
        // Target is below visible area
        el.scrollTo({ top: targetTop + itemHeight - measuredHeight, behavior });
      }
    },
    [itemCount, itemHeight, measuredHeight],
  );

  return {
    containerRef,
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    scrollToIndex,
  };
}
