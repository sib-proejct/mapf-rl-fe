/**
 * Client-side Mutation State Manager with UUIDv4 requestId tracking,
 * double-click locking, uncertain timeout handling, same-requestId retries,
 * and post-reconnection reconciliation.
 */

import type {
  PendingMutation,
  MutationOperation,
  MutationOutcome,
  CreateOrderRequest,
  CancelOrderRequest,
  ReassignOrderRequest,
  InstantActionRequest,
  IncidentActionRequest,
} from "../../domain/mutation/types.ts";
import type { AuthoritativeSnapshot } from "../../domain/snapshot/types.ts";
import { generateUuidV4, computePayloadDigest } from "../../utils/ids/ids.ts";
import {
  normalizeProblem,
  type NormalizedProblem,
} from "../../contracts/adapters/problem.ts";

export type MutationListener = (mutations: PendingMutation[]) => void;

export class MutationManager {
  private mutations: Map<string, PendingMutation> = new Map();
  private inFlightDigests: Set<string> = new Set();
  private listeners: Set<MutationListener> = new Set();

  /**
   * Subscribes a listener to pending mutation state updates.
   */
  subscribe(listener: MutationListener): () => void {
    this.listeners.add(listener);
    listener(this.getAll());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const list = this.getAll();
    for (const listener of this.listeners) {
      listener(list);
    }
  }

  getAll(): PendingMutation[] {
    return Array.from(this.mutations.values());
  }

  get(requestId: string): PendingMutation | undefined {
    return this.mutations.get(requestId);
  }

  /**
   * Prepares and locks a new mutation with a client-generated UUIDv4 requestId.
   * Throws an error if an identical mutation is already in-flight (double-click prevention).
   */
  startMutation<TPayload extends Record<string, unknown>>(
    operation: MutationOperation,
    payload: TPayload,
    targetEntityId?: string,
    targetEntityVersion?: number,
    forcedRequestId?: string,
  ): PendingMutation<TPayload> {
    const payloadDigest = computePayloadDigest({
      operation,
      payload,
      targetEntityId,
    });

    // Double-click check: if same operation & payload is currently SUBMITTING, block it
    if (!forcedRequestId && this.inFlightDigests.has(payloadDigest)) {
      throw new Error(
        `Duplicate mutation in-flight: ${operation} is already submitting. Please wait.`,
      );
    }

    const requestId = forcedRequestId || generateUuidV4();
    const existing = this.mutations.get(requestId);

    const mutation: PendingMutation<TPayload> = {
      requestId,
      operation,
      state: "submitting",
      payload,
      payloadDigest,
      submittedAtUtc: new Date().toISOString(),
      attemptCount: existing ? existing.attemptCount + 1 : 1,
      targetEntityId: targetEntityId || existing?.targetEntityId,
      targetEntityVersion: targetEntityVersion ?? existing?.targetEntityVersion,
      error: undefined,
      outcome: undefined,
    };

    this.inFlightDigests.add(payloadDigest);
    this.mutations.set(requestId, mutation as PendingMutation);
    this.notify();

    return mutation;
  }

  /**
   * Resolves a mutation to CONFIRMED with server outcome.
   */
  confirmMutation(
    requestId: string,
    outcome?: MutationOutcome,
  ): PendingMutation | undefined {
    const mutation = this.mutations.get(requestId);
    if (!mutation) return undefined;

    mutation.state = "confirmed";
    mutation.outcome = outcome || { status: "CONFIRMED" };
    mutation.error = undefined;

    this.inFlightDigests.delete(mutation.payloadDigest);
    this.notify();
    return mutation;
  }

  /**
   * Marks a mutation as UNCERTAIN due to timeout or connection drop.
   * Crucially, does NOT treat this as failure. Preserves the exact same requestId for retry.
   */
  markUncertain(
    requestId: string,
    reason: string = "Request timed out or connection dropped before server confirmed outcome.",
  ): PendingMutation | undefined {
    const mutation = this.mutations.get(requestId);
    if (!mutation) return undefined;

    const problem: NormalizedProblem = {
      type: "urn:mapf-rl:problem:uncertain-mutation",
      title: "Mutation Outcome Uncertain",
      status: 504,
      code: "UNCERTAIN_MUTATION_OUTCOME",
      traceId: requestId,
      requestId,
      retryable: true,
      category: "dependency_unavailable",
      detail: reason,
    };

    mutation.state = "uncertain";
    mutation.error = problem;

    this.inFlightDigests.delete(mutation.payloadDigest);
    this.notify();
    return mutation;
  }

  /**
   * Rejects a mutation due to validation, permission, or conflict error.
   */
  rejectMutation(
    requestId: string,
    error: unknown,
  ): PendingMutation | undefined {
    const mutation = this.mutations.get(requestId);
    if (!mutation) return undefined;

    const problem = normalizeProblem(error);
    mutation.state = "rejected";
    mutation.error = problem;

    this.inFlightDigests.delete(mutation.payloadDigest);
    this.notify();
    return mutation;
  }

  /**
   * Clears or resets a confirmed/rejected mutation from the active list.
   */
  dismissMutation(requestId: string): void {
    const mutation = this.mutations.get(requestId);
    if (mutation) {
      this.inFlightDigests.delete(mutation.payloadDigest);
      this.mutations.delete(requestId);
      this.notify();
    }
  }

  /**
   * Reconciles pending/uncertain mutations against a newly loaded authoritative snapshot.
   */
  reconcileWithSnapshot(snapshot: AuthoritativeSnapshot): void {
    let changed = false;

    for (const [requestId, mut] of this.mutations.entries()) {
      if (mut.state !== "uncertain" && mut.state !== "submitting") continue;

      if (mut.operation === "CREATE_ORDER") {
        const payload = mut.payload as unknown as CreateOrderRequest;
        // Check if an order with matching assignments exists
        const matched = snapshot.orders.find((o) => {
          if (!payload.assignments?.length || !o.assignments?.length)
            return false;
          const firstAssign = payload.assignments[0];
          return o.assignments.some(
            (a) =>
              a.goalColumn === firstAssign.goalColumn &&
              a.goalRow === firstAssign.goalRow &&
              (!firstAssign.robotId || a.robotId === firstAssign.robotId),
          );
        });

        if (matched) {
          mut.state = "confirmed";
          mut.outcome = {
            status: "CONFIRMED",
            entityId: matched.id,
            entityVersion: matched.entityVersion,
            orderUpdateId: matched.orderUpdateId,
          };
          mut.error = undefined;
          this.inFlightDigests.delete(mut.payloadDigest);
          changed = true;
        }
      } else if (mut.operation === "CANCEL_ORDER") {
        const payload = mut.payload as unknown as CancelOrderRequest;
        const matched = snapshot.orders.find((o) => o.id === payload.orderId);
        if (matched && matched.state === "Cancelled") {
          mut.state = "confirmed";
          mut.outcome = {
            status: "CONFIRMED",
            entityId: matched.id,
            entityVersion: matched.entityVersion,
            orderUpdateId: matched.orderUpdateId,
          };
          mut.error = undefined;
          this.inFlightDigests.delete(mut.payloadDigest);
          changed = true;
        }
      } else if (mut.operation === "REASSIGN_ORDER") {
        const payload = mut.payload as unknown as ReassignOrderRequest;
        const matched = snapshot.orders.find((o) => o.id === payload.orderId);
        if (matched && matched.orderUpdateId > payload.orderUpdateId) {
          mut.state = "confirmed";
          mut.outcome = {
            status: "CONFIRMED",
            entityId: matched.id,
            entityVersion: matched.entityVersion,
            orderUpdateId: matched.orderUpdateId,
          };
          mut.error = undefined;
          this.inFlightDigests.delete(mut.payloadDigest);
          changed = true;
        }
      } else if (mut.operation === "INSTANT_ACTION") {
        const payload = mut.payload as unknown as InstantActionRequest;
        const matchedRobot = snapshot.robots.find(
          (r) => r.id === payload.robotId,
        );
        if (matchedRobot) {
          let confirmed = false;
          if (
            payload.action === "ESTOP" &&
            matchedRobot.safety === "EMERGENCY_STOP"
          )
            confirmed = true;
          else if (
            payload.action === "CLEAR_ESTOP" &&
            matchedRobot.safety === "NORMAL"
          )
            confirmed = true;
          else if (
            payload.action === "PAUSE" &&
            matchedRobot.operationalState === "HELD"
          )
            confirmed = true;
          else if (
            payload.action === "RESUME" &&
            matchedRobot.operationalState === "EXECUTING"
          )
            confirmed = true;

          if (confirmed) {
            mut.state = "confirmed";
            mut.outcome = {
              status: "CONFIRMED",
              entityId: matchedRobot.id,
              entityVersion: matchedRobot.stateVersion,
            };
            mut.error = undefined;
            this.inFlightDigests.delete(mut.payloadDigest);
            changed = true;
          }
        }
      } else if (
        mut.operation === "ACKNOWLEDGE_INCIDENT" ||
        mut.operation === "RESOLVE_INCIDENT"
      ) {
        const payload = mut.payload as unknown as IncidentActionRequest;
        const matchedIncident = snapshot.incidents?.find(
          (inc) => inc.id === payload.incidentId,
        );
        if (matchedIncident) {
          if (
            (payload.action === "ACKNOWLEDGE" &&
              matchedIncident.status === "ACKNOWLEDGED") ||
            (payload.action === "RESOLVE" &&
              matchedIncident.status === "RESOLVED")
          ) {
            mut.state = "confirmed";
            mut.outcome = {
              status: "CONFIRMED",
              entityId: matchedIncident.id,
              entityVersion: matchedIncident.entityVersion,
            };
            mut.error = undefined;
            this.inFlightDigests.delete(mut.payloadDigest);
            changed = true;
          }
        }
      }
    }

    if (changed) {
      this.notify();
    }
  }
}

export const globalMutationManager = new MutationManager();
