import { TELEMETRY_VERSION } from "../../contracts/generated.ts";
import { adaptRobotStateReport } from "../../contracts/adapters/eventAdapter.ts";

/** Volatile latest-state channel; durable stream cursor is never advanced here. */
export class TelemetryClient {
  private socket: WebSocket | null = null;
  private stopped = false;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private flush: ReturnType<typeof setInterval> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private lastFrame = Date.now();
  private pending = new Map<string, Record<string, unknown>>();
  private observed = new Map<
    string,
    { epoch: number; boot: string; sequence: number }
  >();

  constructor(
    private callbacks: {
      onState: (robotId: string, data: Record<string, unknown>) => void;
      onReady: () => void;
      onStale: () => void;
    },
  ) {}

  async start(): Promise<void> {
    try {
      const response = await fetch("/api/v1/capabilities", {
        credentials: "include",
      });
      if (response.status === 404) return;
      if (!response.ok) throw new Error("Capabilities unavailable");
      const capabilities = await response.json();
      if (capabilities.telemetry?.supported === false) return;
      if (
        capabilities.telemetry?.supported !== true ||
        capabilities.telemetry.version !== TELEMETRY_VERSION
      ) {
        throw new Error("Unsupported telemetry contract");
      }
      if (!this.stopped) this.connect();
    } catch {
      this.callbacks.onStale();
      if (!this.stopped) this.retry = setTimeout(() => void this.start(), 1000);
    }
  }

  private connect(): void {
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(
      `${scheme}://${window.location.host}/ws/v1/telemetry`,
      "mapf.telemetry.v1",
    );
    this.socket = socket;
    this.lastFrame = Date.now();
    this.flush = setInterval(() => {
      for (const [robotId, data] of this.pending)
        this.callbacks.onState(robotId, data);
      this.pending.clear();
    }, 100);
    this.watchdog = setInterval(() => {
      if (Date.now() - this.lastFrame > 3000) socket.close();
    }, 500);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.telemetryVersion !== TELEMETRY_VERSION)
          throw new Error("Telemetry version mismatch");
        this.lastFrame = Date.now();
        if (message.messageType === "telemetry.ready") {
          this.pending.clear();
          this.observed.clear();
          this.callbacks.onReady();
          return;
        }
        if (message.messageType === "telemetry.heartbeat") return;
        if (
          message.messageType !== "telemetry.state" ||
          typeof message.robotId !== "string" ||
          !Number.isSafeInteger(message.sessionEpoch) ||
          message.sessionEpoch < 1 ||
          !Number.isSafeInteger(message.telemetrySequence) ||
          message.telemetrySequence < 0 ||
          typeof message.simulatorBootId !== "string"
        )
          throw new Error("Invalid telemetry envelope");
        const prior = this.observed.get(message.robotId);
        if (
          prior &&
          (message.sessionEpoch < prior.epoch ||
            (message.sessionEpoch === prior.epoch &&
              (message.simulatorBootId !== prior.boot ||
                message.telemetrySequence <= prior.sequence)))
        )
          return;
        const data = message.payload;
        adaptRobotStateReport({ ...data, robotId: message.robotId });
        if (
          data.sessionEpoch != null &&
          data.sessionEpoch !== message.sessionEpoch
        )
          throw new Error("Epoch mismatch");
        if (
          Date.now() - Date.parse(data.observedAt) > 15000 ||
          Date.parse(data.observedAt) - Date.now() > 1000 ||
          !Number.isFinite(Date.parse(data.observedAt))
        )
          throw new Error("Stale telemetry");
        this.observed.set(message.robotId, {
          epoch: message.sessionEpoch,
          boot: message.simulatorBootId,
          sequence: message.telemetrySequence,
        });
        this.pending.set(message.robotId, {
          ...data,
          sessionEpoch: message.sessionEpoch,
        });
        if (this.pending.size > 1000)
          throw new Error("Telemetry queue overflow");
      } catch {
        socket.close();
      }
    };
    socket.onclose = () => {
      if (this.flush) clearInterval(this.flush);
      if (this.watchdog) clearInterval(this.watchdog);
      this.pending.clear();
      if (!this.stopped) {
        this.callbacks.onStale();
        this.retry = setTimeout(() => this.connect(), 1000);
      }
    };
  }

  stop(): void {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.flush) clearInterval(this.flush);
    if (this.watchdog) clearInterval(this.watchdog);
    this.socket?.close();
    this.pending.clear();
  }
}
