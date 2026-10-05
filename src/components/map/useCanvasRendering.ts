import { useCallback, useEffect, useRef, type RefObject } from "react";
import { createCanvasScheduler } from "../../utils/performance/canvasScheduler.ts";

export function useCanvasRendering(
  canvasRef: RefObject<HTMLCanvasElement>,
  draw: () => void,
) {
  const drawRef = useRef(draw);
  const schedulerRef = useRef<ReturnType<typeof createCanvasScheduler> | null>(
    null,
  );
  const requestDraw = useCallback(() => schedulerRef.current?.request(), []);

  useEffect(() => {
    const scheduler = createCanvasScheduler(() => drawRef.current(), {
      now: () => performance.now(),
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (id) => window.cancelAnimationFrame(id),
      setTimer: (callback, delay) => window.setTimeout(callback, delay),
      clearTimer: (id) => window.clearTimeout(id),
    });
    schedulerRef.current = scheduler;
    const visibility = () => scheduler.setVisible(!document.hidden);
    visibility();
    const observer = new ResizeObserver(requestDraw);
    if (canvasRef.current) observer.observe(canvasRef.current);
    let pixelRatioQuery: MediaQueryList;
    const pixelRatioChanged = () => {
      pixelRatioQuery?.removeEventListener("change", pixelRatioChanged);
      pixelRatioQuery = window.matchMedia(
        `(resolution: ${window.devicePixelRatio}dppx)`,
      );
      pixelRatioQuery.addEventListener("change", pixelRatioChanged);
      requestDraw();
    };
    pixelRatioChanged();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("resize", requestDraw);
    return () => {
      scheduler.dispose();
      schedulerRef.current = null;
      observer.disconnect();
      pixelRatioQuery.removeEventListener("change", pixelRatioChanged);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("resize", requestDraw);
    };
  }, [canvasRef, requestDraw]);

  useEffect(() => {
    drawRef.current = draw;
    requestDraw();
  }, [draw, requestDraw]);
  return requestDraw;
}
