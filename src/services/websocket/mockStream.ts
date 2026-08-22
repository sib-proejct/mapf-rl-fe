/**
 * Mock WebSocket Stream Generator for Phase 2 reconciliation testing and live UI simulation.
 */

import type { StreamEnvelope } from "../../domain/event/types.ts";
import type { AuthoritativeSnapshot } from "../../domain/snapshot/types.ts";
import { advanceStressMotion } from "../../contracts/fixtures/stressFleet.ts";
import type { MapTopology } from "../../domain/map/types.ts";

export type MockScenario =
  | "nominal_10hz"
  | "duplicate_injection"
  | "gap_injection"
  | "stale_injection"
  | "conflict_injection"
  | "disconnect_reconnect"
  | "slow_consumer_burst";

export interface MockStreamOptions {
  intervalMs?: number;
  onEvent?: (event: StreamEnvelope) => void;
  onBatch?: (events: StreamEnvelope[]) => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
}

export class MockStreamEngine {
  private readonly intervalMs: number;
  private timer: any = null;
  private isRunning: boolean = false;
  private scenario: MockScenario = "nominal_10hz";
  private currentSeq: number = 1420;
  private tickIndex: number = 0;
  private simTimeMs: number = 12400;
  private robotVersions: Map<string, number> = new Map();

  private readonly onEventCallback?: (event: StreamEnvelope) => void;
  private readonly onBatchCallback?: (events: StreamEnvelope[]) => void;
  private readonly onDisconnectCallback?: () => void;
  private readonly onReconnectCallback?: () => void;

  constructor(options: MockStreamOptions = {}) {
    this.intervalMs = options.intervalMs ?? 100; // 10Hz default
    this.onEventCallback = options.onEvent;
    this.onBatchCallback = options.onBatch;
    this.onDisconnectCallback = options.onDisconnect;
    this.onReconnectCallback = options.onReconnect;
  }

  start(
    initialSequence: number = 1420,
    scenario: MockScenario = "nominal_10hz",
    snapshot?: AuthoritativeSnapshot | null,
  ): void {
    this.stop();
    this.currentSeq = initialSequence;
    this.scenario = scenario;
    this.isRunning = true;
    this.tickIndex = 0;
    this.simTimeMs = snapshot?.robots[0]?.simulationTimeMs || 12400;

    this.robotVersions.clear();
    if (snapshot?.robots) {
      for (const r of snapshot.robots) {
        this.robotVersions.set(r.id, r.stateVersion);
      }
    }

    this.timer = setInterval(() => {
      this.tick();
    }, this.intervalMs);
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setScenario(scenario: MockScenario): void {
    this.scenario = scenario;
  }

  /**
   * Generates mock stream envelopes based on current scenario.
   */
  generateEvents(
    snapshot: AuthoritativeSnapshot,
    topology: MapTopology | null,
  ): StreamEnvelope[] {
    this.tickIndex++;
    this.simTimeMs += 100;
    const now = new Date().toISOString();

    // Advance robot positions using stress fleet motion
    const nextSnapshot = advanceStressMotion(
      snapshot,
      this.tickIndex,
      topology,
    );
    const events: StreamEnvelope[] = [];

    switch (this.scenario) {
      case "duplicate_injection": {
        // Generate nominal event first
        this.currentSeq++;
        const targetRobot = nextSnapshot.robots[0] || snapshot.robots[0];
        const prevVer =
          this.robotVersions.get(targetRobot.id) ?? targetRobot.stateVersion;
        const nextVer = prevVer + 1;
        this.robotVersions.set(targetRobot.id, nextVer);

        const eventId = `msg-dup-${this.currentSeq}`;

        const baseEvent: StreamEnvelope = {
          contractVersion: "1.0.0",
          messageId: eventId,
          messageType: "robot.state.report",
          producer: { kind: "SIMULATOR", id: "sim-01" },
          occurredAt: now,
          correlationId: `corr-${this.currentSeq}`,
          eventSequence: this.currentSeq,
          payload: {
            robotId: targetRobot.id,
            stateVersion: nextVer,
            simulationTimeMs: this.simTimeMs,
            pose: targetRobot.pose,
            operationalState: targetRobot.operationalState,
            connectivity: targetRobot.connectivity,
            safety: targetRobot.safety,
            activeController: targetRobot.activeController,
            batteryPercent: targetRobot.batteryPercent,
          },
        };

        // Push nominal event followed by exact duplicate event
        events.push(baseEvent);
        events.push({ ...baseEvent });
        break;
      }

      case "gap_injection": {
        // Intentionally skip 5 sequence numbers (gap!)
        this.currentSeq += 5;
        const targetRobot = nextSnapshot.robots[0] || snapshot.robots[0];
        const prevVer =
          this.robotVersions.get(targetRobot.id) ?? targetRobot.stateVersion;
        const nextVer = prevVer + 5;
        this.robotVersions.set(targetRobot.id, nextVer);

        events.push({
          contractVersion: "1.0.0",
          messageId: `msg-gap-${this.currentSeq}`,
          messageType: "robot.state.report",
          producer: { kind: "SIMULATOR", id: "sim-01" },
          occurredAt: now,
          correlationId: `corr-gap-${this.currentSeq}`,
          eventSequence: this.currentSeq,
          payload: {
            robotId: targetRobot.id,
            stateVersion: nextVer,
            simulationTimeMs: this.simTimeMs + 500,
            pose: targetRobot.pose,
            operationalState: targetRobot.operationalState,
            connectivity: targetRobot.connectivity,
            safety: targetRobot.safety,
            activeController: targetRobot.activeController,
            batteryPercent: targetRobot.batteryPercent,
          },
        });
        break;
      }

      case "stale_injection": {
        // Send event with sequence and version from the past
        const staleSeq = Math.max(1, this.currentSeq - 10);
        const targetRobot = snapshot.robots[0];
        events.push({
          contractVersion: "1.0.0",
          messageId: `msg-stale-${staleSeq}`,
          messageType: "robot.state.report",
          producer: { kind: "SIMULATOR", id: "sim-01" },
          occurredAt: "2026-08-22T04:00:00.000Z",
          correlationId: `corr-stale-${staleSeq}`,
          eventSequence: staleSeq,
          payload: {
            robotId: targetRobot ? targetRobot.id : "robot-01",
            stateVersion: 1, // Older version
            simulationTimeMs: 1000,
            pose: { xMeters: 0, yMeters: 0, yawRadians: 0 },
            operationalState: "IDLE",
            connectivity: "CONNECTED",
            safety: "NORMAL",
            activeController: {
              mode: "BASELINE",
              identity: "cardinal-baseline/1.0.0",
            },
          },
        });
        break;
      }

      case "conflict_injection": {
        // Send event with matching sequence/version but conflicting contradictory payload
        this.currentSeq++;
        const targetRobot = snapshot.robots[0];
        if (targetRobot) {
          const currentVer =
            this.robotVersions.get(targetRobot.id) ?? targetRobot.stateVersion;
          events.push({
            contractVersion: "1.0.0",
            messageId: `msg-conflict-${this.currentSeq}`,
            messageType: "robot.state.report",
            producer: { kind: "SIMULATOR", id: "sim-01" },
            occurredAt: now,
            correlationId: `corr-conflict-${this.currentSeq}`,
            eventSequence: this.currentSeq - 1, // Matching current sequence
            payload: {
              robotId: targetRobot.id,
              stateVersion: currentVer, // Matching version
              simulationTimeMs: targetRobot.simulationTimeMs,
              pose: { xMeters: 999.0, yMeters: 999.0, yawRadians: 3.14 }, // Conflicting coordinates
              operationalState: "STOPPED",
              connectivity: "DISCONNECTED",
              safety: "FAULT",
              activeController: targetRobot.activeController,
            },
          });
        }
        break;
      }

      case "slow_consumer_burst": {
        // Emit 50 events in a single tick for coalescing test
        for (let i = 0; i < 50; i++) {
          this.currentSeq++;
          const r = nextSnapshot.robots[i % nextSnapshot.robots.length];
          const prevVer = this.robotVersions.get(r.id) ?? r.stateVersion;
          const nextVer = prevVer + 1;
          this.robotVersions.set(r.id, nextVer);

          events.push({
            contractVersion: "1.0.0",
            messageId: `msg-burst-${this.currentSeq}-${i}`,
            messageType: "robot.state.report",
            producer: { kind: "SIMULATOR", id: "sim-01" },
            occurredAt: now,
            correlationId: `corr-${this.currentSeq}`,
            eventSequence: this.currentSeq,
            payload: {
              robotId: r.id,
              stateVersion: nextVer,
              simulationTimeMs: this.simTimeMs + i * 10,
              pose: r.pose,
              operationalState: r.operationalState,
              connectivity: r.connectivity,
              safety: r.safety,
              activeController: r.activeController,
              batteryPercent: r.batteryPercent,
            },
          });
        }
        break;
      }

      case "nominal_10hz":
      default: {
        // Emit updates for each active robot
        for (const robot of nextSnapshot.robots) {
          this.currentSeq++;
          const prevVer =
            this.robotVersions.get(robot.id) ?? robot.stateVersion;
          const nextVer = prevVer + 1;
          this.robotVersions.set(robot.id, nextVer);

          events.push({
            contractVersion: "1.0.0",
            messageId: `msg-${this.currentSeq}`,
            messageType: "robot.state.report",
            producer: { kind: "SIMULATOR", id: "sim-01" },
            occurredAt: now,
            correlationId: `corr-${this.currentSeq}`,
            eventSequence: this.currentSeq,
            payload: {
              robotId: robot.id,
              stateVersion: nextVer,
              simulationTimeMs: this.simTimeMs,
              pose: robot.pose,
              operationalState: robot.operationalState,
              connectivity: robot.connectivity,
              safety: robot.safety,
              activeController: robot.activeController,
              batteryPercent: robot.batteryPercent,
            },
          });
        }
        break;
      }
    }

    return events;
  }

  private tick(): void {
    // Engine tick handler managed by context caller
  }

  get running(): boolean {
    return this.isRunning;
  }

  get sequence(): number {
    return this.currentSeq;
  }
}
