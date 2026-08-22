/**
 * WebSocket client for Core /ws/v1 with automatic jittered reconnection and lifecycle management.
 */

import type {
  StreamEnvelope,
  ConnectionState,
} from "../../domain/event/types.ts";
import { adaptStreamEnvelope } from "../../contracts/adapters/eventAdapter.ts";
import { ExponentialBackoff } from "./backoff.ts";

export interface CoreWsClientOptions {
  url?: string;
  subprotocol?: string;
  heartbeatTimeoutMs?: number;
  onMessage?: (event: StreamEnvelope) => void;
  onStateChange?: (state: ConnectionState) => void;
  onError?: (err: Error) => void;
  onReplayNeeded?: (cursorSequence: number) => void;
}

export class CoreWsClient {
  private readonly url: string;
  private readonly subprotocol: string;
  private readonly heartbeatTimeoutMs: number;
  private readonly backoff: ExponentialBackoff;

  private socket: WebSocket | null = null;
  private connectionState: ConnectionState = "Disconnected";
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private isManuallyClosed: boolean = false;

  private readonly onMessageCallback?: (event: StreamEnvelope) => void;
  private readonly onStateChangeCallback?: (state: ConnectionState) => void;
  private readonly onErrorCallback?: (err: Error) => void;
  private readonly onReplayNeededCallback?: (cursorSequence: number) => void;

  constructor(options: CoreWsClientOptions = {}) {
    const defaultWsUrl =
      typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/v1`
        : "ws://localhost:8000/ws/v1";

    this.url = options.url || defaultWsUrl;
    this.subprotocol = options.subprotocol || "mapf.v1";
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 15000;
    this.backoff = new ExponentialBackoff({
      baseDelayMs: 250,
      maxDelayMs: 30000,
    });

    this.onMessageCallback = options.onMessage;
    this.onStateChangeCallback = options.onStateChange;
    this.onErrorCallback = options.onError;
    this.onReplayNeededCallback = options.onReplayNeeded;
  }

  private setState(newState: ConnectionState): void {
    if (this.connectionState !== newState) {
      this.connectionState = newState;
      this.onStateChangeCallback?.(newState);
    }
  }

  /**
   * Initiates the WebSocket connection.
   */
  connect(): void {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.isManuallyClosed = false;
    this.clearTimers();
    this.setState("ConnectingStream");

    try {
      this.socket = new WebSocket(this.url, this.subprotocol);

      this.socket.onopen = () => {
        this.backoff.reset();
        this.resetHeartbeat();
        this.setState("Reconciling");
      };

      this.socket.onmessage = (event: MessageEvent) => {
        this.resetHeartbeat();
        try {
          const envelope = adaptStreamEnvelope(event.data);
          this.onMessageCallback?.(envelope);
        } catch (err: unknown) {
          const error = err instanceof Error ? err : new Error(String(err));
          this.onErrorCallback?.(error);
        }
      };

      this.socket.onerror = (event: Event) => {
        const error = new Error("WebSocket transport error");
        this.onErrorCallback?.(error);
      };

      this.socket.onclose = (event: CloseEvent) => {
        this.socket = null;
        this.clearTimers();

        if (!this.isManuallyClosed) {
          this.setState("Disconnected");
          this.scheduleReconnect();
        } else {
          this.setState("Disconnected");
        }
      };
    } catch (err: unknown) {
      this.setState("Failed");
      const error = err instanceof Error ? err : new Error(String(err));
      this.onErrorCallback?.(error);
      this.scheduleReconnect();
    }
  }

  /**
   * Schedules a reconnection attempt using jittered exponential backoff.
   */
  private scheduleReconnect(): void {
    if (this.isManuallyClosed || this.reconnectTimer) {
      return;
    }

    const delay = this.backoff.nextDelay();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * Resets the heartbeat watchdog timer.
   */
  private resetHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }

    this.heartbeatTimer = setTimeout(() => {
      // Heartbeat timeout - connection might be half-open / stale
      this.setState("Stale");
      if (this.socket) {
        try {
          this.socket.close(4000, "Heartbeat timeout");
        } catch {
          // Ignore close error
        }
      }
    }, this.heartbeatTimeoutMs);
  }

  /**
   * Clears active timers.
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Gracefully disconnects the WebSocket.
   */
  disconnect(): void {
    this.isManuallyClosed = true;
    this.clearTimers();
    if (this.socket) {
      try {
        this.socket.close(1000, "Operator disconnected");
      } catch {
        // Ignore
      }
      this.socket = null;
    }
    this.setState("Disconnected");
  }

  get state(): ConnectionState {
    return this.connectionState;
  }

  get isConnected(): boolean {
    return (
      this.socket !== null &&
      this.socket.readyState === WebSocket.OPEN &&
      (this.connectionState === "Current" ||
        this.connectionState === "Reconciling")
    );
  }
}
