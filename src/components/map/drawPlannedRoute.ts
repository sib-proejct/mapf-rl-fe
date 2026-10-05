import {
  worldToScreen,
  type MapDimensions,
  type Point2D,
} from "../../utils/coordinates/coordinates.ts";

export function drawPlannedRoute(
  ctx: CanvasRenderingContext2D,
  points: Point2D[],
  map: MapDimensions,
  width: number,
  height: number,
  zoom: number,
  isDark: boolean,
) {
  if (!points.length) return;
  const screen = points.map((p) => worldToScreen(p, map, width, height));
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = isDark ? "#C4B5FD" : "#7C3AED";
  ctx.lineWidth = 3 / zoom;
  ctx.lineJoin = ctx.lineCap = "round";
  ctx.setLineDash([]);
  ctx.beginPath();
  screen.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  // Fixed screen-size arrows, spaced to remain legible when zoomed out.
  let spacing = 0;
  for (let i = 1; i < screen.length; i++) {
    const a = screen[i - 1],
      b = screen[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    spacing += length * zoom;
    if (length < 1e-6 || spacing < 36) continue;
    spacing = 0;
    const ux = (b.x - a.x) / length,
      uy = (b.y - a.y) / length;
    const x = (a.x + b.x) / 2,
      y = (a.y + b.y) / 2,
      size = 6 / zoom;
    ctx.beginPath();
    ctx.moveTo(x + ux * size, y + uy * size);
    ctx.lineTo(
      x - ux * size - uy * size * 0.65,
      y - uy * size + ux * size * 0.65,
    );
    ctx.lineTo(
      x - ux * size + uy * size * 0.65,
      y - uy * size - ux * size * 0.65,
    );
    ctx.closePath();
    ctx.fill();
  }
  const goal = screen.at(-1)!;
  ctx.beginPath();
  ctx.arc(goal.x, goal.y, 7 / zoom, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
