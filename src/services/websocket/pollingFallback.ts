/**
 * 5-second REST polling fallback manager when WebSocket streaming is unavailable.
 */

import { defaultApiClient, ProblemError } from "../api/client.ts";
import { adaptOperationsSnapshot } from "../../contracts/adapters/snapshotAdapter.ts";
import type { AuthoritativeSnapshot } from "../../domain/snapshot/types.ts";

export interface PollingFallbackOptions {
  intervalMs?: number;
  onSnapshot?: (snapshot: AuthoritativeSnapshot) => void;
  onError?: (err: Error) => void;
}

export class PollingFallbackManager {
  private readonly intervalMs: number;
  private readonly onSnapshotCallback?: (
    snapshot: AuthoritativeSnapshot,
  ) => void;
  private readonly onErrorCallback?: (err: Error) => void;

  private pollTimer: any = null;
  private isPolling: boolean = false;
  private isPollInFlight: boolean = false;
  private abortController: AbortController | null = null;

  constructor(options: PollingFallbackOptions = {}) {
    this.intervalMs = options.intervalMs ?? 5000;
    this.onSnapshotCallback = options.onSnapshot;
    this.onErrorCallback = options.onError;
  }

  /**
   * Starts the 5-second polling loop.
   */
  start(): void {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollOnce();
    this.scheduleNext();
  }

  /**
   * Stops the polling loop.
   */
  stop(): void {
    this.isPolling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private scheduleNext(): void {
    if (!this.isPolling) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);

    this.pollTimer = setTimeout(async () => {
      await this.pollOnce();
      this.scheduleNext();
    }, this.intervalMs);
  }

  /**
   * Performs a single fetch of /api/v1/operations/snapshot.
   */
  async pollOnce(): Promise<void> {
    if (this.isPollInFlight) return;
    this.isPollInFlight = true;
    this.abortController = new AbortController();

    try {
      const rawPayload = await defaultApiClient.fetchOperationsSnapshot({
        signal: this.abortController.signal,
      });
      const adapted = adaptOperationsSnapshot(rawPayload);
      this.onSnapshotCallback?.(adapted);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return; // Normal abort
      }
      const error = err instanceof Error ? err : new Error(String(err));
      this.onErrorCallback?.(error);
    } finally {
      this.isPollInFlight = false;
      this.abortController = null;
    }
  }

  get running(): boolean {
    return this.isPolling;
  }
}
