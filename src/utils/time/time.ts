/**
 * Time and duration utilities for MAPF-RL.
 */

/**
 * Formats an ISO string or Date into canonical RFC 3339 UTC timestamp.
 */
export function formatUtcIso(dateInput: string | Date | number): string {
  try {
    const date =
      typeof dateInput === "object" ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return "-";
    return date.toISOString();
  } catch {
    return "-";
  }
}

/**
 * Formats a timestamp into human-readable local time with optional timezone.
 */
export function formatLocaleTime(
  dateInput: string | Date | number,
  locale: string = "ko-KR",
): string {
  try {
    const date =
      typeof dateInput === "object" ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return "-";
  }
}

/**
 * Formats simulation time in milliseconds into T+hh:mm:ss.SSS or T+ss.SSS.
 */
export function formatSimulationTime(simulationTimeMs: number): string {
  if (isNaN(simulationTimeMs) || simulationTimeMs < 0) {
    return "T+0.000s";
  }

  const totalSeconds = Math.floor(simulationTimeMs / 1000);
  const ms = simulationTimeMs % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const msPadded = String(ms).padStart(3, "0");

  if (hours > 0) {
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return `T+${hh}:${mm}:${ss}.${msPadded}`;
  }

  if (minutes > 0) {
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return `T+${mm}:${ss}.${msPadded}`;
  }

  return `T+${seconds}.${msPadded}s`;
}

/**
 * Formats the age of a state or timestamp relative to now (or reference wall clock).
 */
export function formatStateAge(
  occurredAt: string | Date | number,
  nowMs: number = Date.now(),
): string {
  try {
    const occurredTime =
      typeof occurredAt === "number"
        ? occurredAt
        : new Date(occurredAt).getTime();
    if (isNaN(occurredTime)) return "-";

    const diffMs = Math.max(0, nowMs - occurredTime);

    if (diffMs < 1000) {
      return `${diffMs}ms`;
    }
    const diffSec = (diffMs / 1000).toFixed(1);
    if (diffMs < 60000) {
      return `${diffSec}s`;
    }
    const diffMin = Math.floor(diffMs / 60000);
    return `${diffMin}m ${((diffMs % 60000) / 1000) | 0}s`;
  } catch {
    return "-";
  }
}
