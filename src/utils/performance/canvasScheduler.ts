export interface FrameClock {
  now(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(id: number): void;
  setTimer(callback: () => void, delay: number): number;
  clearTimer(id: number): void;
}

// One pending draw, with no polling when the canvas is unchanged.
export function createCanvasScheduler(draw: () => void, clock: FrameClock) {
  let frame: number | null = null;
  let timer: number | null = null;
  let lastDraw = -Infinity;
  let dirty = false;
  let visible = true;
  let disposed = false;
  const cancel = () => {
    if (frame !== null) clock.cancelFrame(frame);
    if (timer !== null) clock.clearTimer(timer);
    frame = timer = null;
  };
  const schedule = () => {
    if (disposed || !visible || !dirty || frame !== null || timer !== null)
      return;
    const delay = lastDraw + 1000 / 30 - clock.now();
    if (delay > 0) {
      timer = clock.setTimer(() => {
        timer = null;
        schedule();
      }, delay);
      return;
    }
    frame = clock.requestFrame(() => {
      frame = null;
      dirty = false;
      lastDraw = clock.now();
      draw();
      schedule();
    });
  };
  return {
    request() {
      dirty = true;
      schedule();
    },
    setVisible(value: boolean) {
      visible = value;
      if (!visible) cancel();
      else {
        dirty = true;
        schedule();
      }
    },
    dispose() {
      disposed = true;
      cancel();
    },
  };
}

export function resizeCanvas(
  canvas: Pick<HTMLCanvasElement, "width" | "height">,
  width: number,
  height: number,
  dpr: number,
) {
  if (width <= 0 || height <= 0) return false;
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  return true;
}
