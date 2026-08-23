/**
 * Mock WebSocket Stream Generator for Phase 2 & 3 reconciliation testing,
 * order lifecycle simulation, and live incident operations.
 */

import type { StreamEnvelope } from "../../domain/event/types.ts";
import type { AuthoritativeSnapshot } from "../../domain/snapshot/types.ts";
import { advanceStressMotion } from "../../contracts/fixtures/stressFleet.ts";
import type { MapTopology } from "../../domain/map/types.ts";
import type { Robot } from "../../domain/robot/types.ts";
import type { Order, OrderLifecycleState } from "../../domain/order/types.ts";
import type { Incident } from "../../domain/incident/types.ts";

export type MockScenario =
  | "nominal_10hz"
  | "duplicate_injection"
  | "gap_injection"
  | "stale_injection"
  | "conflict_injection"
  | "disconnect_reconnect"
  | "slow_consumer_burst"
  | "order_lifecycle_sim"
  | "safety_incident_sim";

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
  private orderVersions: Map<string, number> = new Map();
  private orderStates: Map<
    string,
    { state: OrderLifecycleState; step: number; updateId: number }
  > = new Map();

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
    this.orderVersions.clear();
    this.orderStates.clear();

    if (snapshot?.robots) {
      for (const r of snapshot.robots) {
        this.robotVersions.set(r.id, r.stateVersion);
      }
    }
    if (snapshot?.orders) {
      for (const o of snapshot.orders) {
        this.orderVersions.set(o.id, o.entityVersion);
        this.orderStates.set(o.id, {
          state: o.state,
          step: o.state === "Executing" ? 4 : o.state === "Applied" ? 3 : 0,
          updateId: o.orderUpdateId,
        });
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

    const emit = (
      robot: Robot,
      sequence: number,
      version: number,
      data: Record<string, unknown> = {},
      digest?: string,
    ) =>
      robotOperationsEvent(
        robot,
        sequence,
        version,
        now,
        this.simTimeMs,
        data,
        digest,
      );

    // 1. Order Lifecycle progression every 30 ticks (~3s) for newly submitted/planning orders
    if (this.tickIndex % 20 === 0 && snapshot.orders.length > 0) {
      for (const order of snapshot.orders) {
        if (
          order.state === "Completed" ||
          order.state === "Cancelled" ||
          order.state === "Rejected"
        ) {
          continue;
        }

        const stateInfo = this.orderStates.get(order.id) || {
          state: order.state,
          step: 0,
          updateId: order.orderUpdateId,
        };

        const lifecycleProgression: OrderLifecycleState[] = [
          "Submitted",
          "Planning",
          "Dispatchable",
          "Dispatched",
          "Applied", // Application Ack
          "Executing", // Execution Report
        ];

        const currentIndex = lifecycleProgression.indexOf(stateInfo.state);
        if (
          currentIndex >= 0 &&
          currentIndex < lifecycleProgression.length - 1
        ) {
          const nextState = lifecycleProgression[currentIndex + 1];
          const nextUpdateId = stateInfo.updateId + 1;
          const nextVersion =
            (this.orderVersions.get(order.id) ?? order.entityVersion) + 1;
          this.orderVersions.set(order.id, nextVersion);
          this.orderStates.set(order.id, {
            state: nextState,
            step: currentIndex + 1,
            updateId: nextUpdateId,
          });

          this.currentSeq++;
          events.push({
            contractVersion: "1.0.0",
            messageId: `order-msg-${this.currentSeq}-${order.id}`,
            messageType: "operations.event",
            producer: { kind: "CORE", id: "core-api" },
            occurredAt: now,
            correlationId: `corr-${this.currentSeq}`,
            eventSequence: this.currentSeq,
            payload: {
              entityType: "ORDER",
              entityId: order.id,
              entityVersion: nextVersion,
              contentDigestSha256: nextVersion
                .toString(16)
                .padStart(64, "0")
                .slice(-64),
              data: {
                state: nextState,
                orderUpdateId: nextUpdateId,
                planRevisionId: order.planRevisionId || "rev-01",
                assignments: order.assignments,
                mapId: order.mapId,
                mapRevision: order.mapRevision,
                reason:
                  nextState === "Applied"
                    ? "Simulator acknowledged order command (Application Ack)"
                    : nextState === "Executing"
                      ? "Simulator runtime reported executing state"
                      : `Order advanced to ${nextState}`,
                updatedAt: now,
              },
            },
          });
        }
      }
    }

    // 2. Scenario specific stream event generation
    if (this.scenario === "duplicate_injection") {
      this.currentSeq++;
      const robot = nextSnapshot.robots[0];
      const version =
        (this.robotVersions.get(robot.id) ?? robot.stateVersion) + 1;
      this.robotVersions.set(robot.id, version);
      const event = emit(robot, this.currentSeq, version);
      events.push(event, { ...event });
    } else if (this.scenario === "gap_injection") {
      this.currentSeq += 5;
      const robot = nextSnapshot.robots[0];
      const version =
        (this.robotVersions.get(robot.id) ?? robot.stateVersion) + 5;
      this.robotVersions.set(robot.id, version);
      events.push(emit(robot, this.currentSeq, version));
    } else if (this.scenario === "stale_injection") {
      const robot = snapshot.robots[0];
      events.push(
        emit(robot, Math.max(1, this.currentSeq - 10), 1, {
          simulationTimeMs: 1000,
          pose: { xMeters: 0, yMeters: 0, yawRadians: 0 },
          operationalState: "IDLE",
        }),
      );
    } else if (this.scenario === "conflict_injection") {
      const robot = snapshot.robots[0];
      const version = this.robotVersions.get(robot.id) ?? robot.stateVersion;
      events.push(
        emit(
          robot,
          this.currentSeq,
          version,
          {
            pose: { xMeters: 999, yMeters: 999, yawRadians: 3.14 },
            operationalState: "STOPPED",
            connectivity: "DISCONNECTED",
            safety: "FAULT",
          },
          "f".repeat(64),
        ),
      );
    } else if (this.scenario === "safety_incident_sim") {
      if (this.tickIndex % 40 === 1) {
        this.currentSeq++;
        const targetRobot = snapshot.robots[0];
        events.push({
          contractVersion: "1.0.0",
          messageId: `inc-msg-${this.currentSeq}`,
          messageType: "operations.event",
          producer: { kind: "CORE", id: "core-safety-supervisor" },
          occurredAt: now,
          correlationId: `corr-inc-${this.currentSeq}`,
          eventSequence: this.currentSeq,
          payload: {
            entityType: "INCIDENT",
            entityId: `inc-${this.currentSeq}`,
            entityVersion: 1,
            contentDigestSha256: "e".repeat(64),
            data: {
              severity: "CRITICAL",
              category: "safety",
              status: "ACTIVE",
              code: "EMERGENCY_STOP_ACTIVE",
              description: `Emergency Stop triggered by safety supervisor on ${targetRobot.id}`,
              robotId: targetRobot.id,
              simulationTimeMs: this.simTimeMs,
              occurredAt: now,
              allowedActions: ["ACKNOWLEDGE", "CLEAR_ESTOP"],
            },
          },
        });
      }
    } else if (this.scenario === "slow_consumer_burst") {
      for (let index = 0; index < 50; index++) {
        this.currentSeq++;
        const robot = nextSnapshot.robots[index % nextSnapshot.robots.length];
        const version =
          (this.robotVersions.get(robot.id) ?? robot.stateVersion) + 1;
        this.robotVersions.set(robot.id, version);
        events.push(
          emit(robot, this.currentSeq, version, {
            simulationTimeMs: this.simTimeMs + index * 10,
          }),
        );
      }
    } else {
      for (const robot of nextSnapshot.robots) {
        this.currentSeq++;
        const version =
          (this.robotVersions.get(robot.id) ?? robot.stateVersion) + 1;
        this.robotVersions.set(robot.id, version);
        events.push(emit(robot, this.currentSeq, version));
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

function robotOperationsEvent(
  robot: Robot,
  sequence: number,
  entityVersion: number,
  occurredAt: string,
  simulationTimeMs: number,
  overrides: Record<string, unknown>,
  digest = entityVersion.toString(16).padStart(64, "0").slice(-64),
): StreamEnvelope {
  return {
    contractVersion: "1.0.0",
    messageId: `msg-${sequence}-${robot.id}`,
    messageType: "operations.event",
    producer: { kind: "CORE", id: "core-api" },
    occurredAt,
    correlationId: `corr-${sequence}`,
    eventSequence: sequence,
    payload: {
      entityType: "ROBOT",
      entityId: robot.id,
      entityVersion,
      contentDigestSha256: digest,
      data: {
        simulationTimeMs,
        pose: robot.pose,
        operationalState: robot.operationalState,
        connectivity: robot.connectivity,
        freshness: robot.freshness,
        safety: robot.safety,
        activeController: robot.activeController,
        batteryPercent: robot.batteryPercent,
        orderId: robot.currentOrderId,
        orderUpdateId: robot.orderUpdateId,
        sessionEpoch: robot.sessionEpoch,
        simulatorId: robot.simulatorId,
        observedAt: occurredAt,
        ...overrides,
      },
    },
  };
}
