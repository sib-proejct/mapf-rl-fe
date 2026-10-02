/**
 * SI unit formatters for MAPF-RL telemetry and parameters.
 */

/**
 * Formats distance in meters with SI unit suffix.
 */
export function formatDistanceMeters(
  meters: number,
  decimals: number = 2,
): string {
  if (isNaN(meters) || !isFinite(meters)) return "- m";
  return `${meters.toFixed(decimals)} m`;
}

/**
 * Formats velocity in m/s with SI unit suffix.
 */
export function formatVelocityMps(mps: number, decimals: number = 2): string {
  if (isNaN(mps) || !isFinite(mps)) return "- m/s";
  return `${mps.toFixed(decimals)} m/s`;
}

/**
 * Formats angle in radians and degrees.
 */
export function formatAngleRadians(
  radians: number,
  decimals: number = 2,
): string {
  if (isNaN(radians) || !isFinite(radians)) return "- rad";
  let deg = (radians * 180) / Math.PI;
  deg = deg % 360;
  if (deg < 0) deg += 360;
  return `${radians.toFixed(decimals)} rad (${deg.toFixed(1)}°)`;
}
