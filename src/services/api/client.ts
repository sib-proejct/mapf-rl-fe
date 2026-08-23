import { normalizeProblem } from "../../contracts/adapters/problem.ts";
import type { NormalizedProblem } from "../../contracts/adapters/problem.ts";
import type {
  CreateOrderRequest,
  CancelOrderRequest,
  ReassignOrderRequest,
  InstantActionRequest,
  IncidentActionRequest,
  MutationOutcome,
} from "../../domain/mutation/types.ts";

export class ProblemError extends Error {
  readonly problem: NormalizedProblem;

  constructor(problem: NormalizedProblem) {
    super(
      problem.detail ||
        problem.title ||
        `Problem ${problem.code} (${problem.status})`,
    );
    this.name = "ProblemError";
    this.problem = problem;
  }
}

export interface FetchSnapshotOptions {
  signal?: AbortSignal;
  correlationId?: string;
}

export interface MutationRequestOptions {
  requestId: string;
  signal?: AbortSignal;
  correlationId?: string;
  timeoutMs?: number;
}

type CsrfTokenProvider = () => string | null;

function browserCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="mapf-csrf-token"]',
  );
  if (meta?.content) return meta.content;
  const cookie = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("mapf_csrf="));
  return cookie ? decodeURIComponent(cookie.slice("mapf_csrf=".length)) : null;
}

/**
 * Versioned REST API client for MAPF-RL Core /api/v1.
 * Uses same-origin BFF and HttpOnly session cookies.
 * All mutations carry an immutable client-generated UUIDv4 requestId.
 */
export class CoreApiClient {
  private readonly baseUrl: string;
  private readonly csrfTokenProvider: CsrfTokenProvider;

  constructor(
    baseUrl: string = "",
    csrfTokenProvider: CsrfTokenProvider = browserCsrfToken,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.csrfTokenProvider = csrfTokenProvider;
  }

  /**
   * Fetches the authoritative operator snapshot from /api/v1/operations/snapshot.
   */
  async fetchOperationsSnapshot(
    options: FetchSnapshotOptions = {},
  ): Promise<unknown> {
    const url = `${this.baseUrl}/api/v1/operations/snapshot`;
    const headers: Record<string, string> = {
      Accept: "application/json, application/problem+json",
    };

    if (options.correlationId) {
      headers["X-Correlation-Id"] = options.correlationId;
    }

    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
        credentials: "same-origin",
        signal: options.signal,
      });

      if (response.ok) {
        return await response.json();
      }

      let errorPayload: unknown;
      try {
        errorPayload = await response.json();
      } catch {
        errorPayload = await response.text();
      }

      const problem = normalizeProblem(errorPayload, response.status);
      throw new ProblemError(problem);
    } catch (err: unknown) {
      if (err instanceof ProblemError) {
        throw err;
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        throw err;
      }
      const problem = normalizeProblem(err, 503);
      throw new ProblemError(problem);
    }
  }

  /**
   * Submits a new dispatch order intent with UUIDv4 requestId.
   */
  async createOrder(
    payload: Omit<CreateOrderRequest, "requestId">,
    options: MutationRequestOptions,
  ): Promise<MutationOutcome> {
    return this.postMutation(
      `${this.baseUrl}/api/v1/orders`,
      { ...payload, requestId: options.requestId } satisfies CreateOrderRequest,
      options,
    );
  }

  /**
   * Requests cancellation of an existing order.
   */
  async cancelOrder(
    payload: CancelOrderRequest,
    options: MutationRequestOptions,
  ): Promise<MutationOutcome> {
    return this.unsupportedMutation("CANCEL_ORDER", options.requestId);
  }

  /**
   * Reassigns robot / goal targets on an active order.
   */
  async reassignOrder(
    payload: ReassignOrderRequest,
    options: MutationRequestOptions,
  ): Promise<MutationOutcome> {
    return this.unsupportedMutation("REASSIGN_ORDER", options.requestId);
  }

  /**
   * Emits an instant action to a robot (PAUSE, RESUME, ESTOP, CLEAR_ESTOP).
   */
  async sendInstantAction(
    payload: InstantActionRequest,
    options: MutationRequestOptions,
  ): Promise<MutationOutcome> {
    return this.unsupportedMutation("INSTANT_ACTION", options.requestId);
  }

  /**
   * Acknowledges an active operational incident.
   */
  async acknowledgeIncident(
    payload: IncidentActionRequest,
    options: MutationRequestOptions,
  ): Promise<MutationOutcome> {
    return this.unsupportedMutation("ACKNOWLEDGE_INCIDENT", options.requestId);
  }

  /**
   * Marks an incident as resolved.
   */
  async resolveIncident(
    payload: IncidentActionRequest,
    options: MutationRequestOptions,
  ): Promise<MutationOutcome> {
    return this.unsupportedMutation("RESOLVE_INCIDENT", options.requestId);
  }

  private async unsupportedMutation(
    operation: string,
    requestId: string,
  ): Promise<never> {
    throw new ProblemError(
      normalizeProblem({
        type: "urn:mapf-rl:problem:mutation-not-supported",
        title: "Mutation is not available",
        status: 501,
        code: "MUTATION_NOT_SUPPORTED",
        requestId,
        retryable: false,
        detail: `${operation} is disabled until Core exposes its authoritative endpoint.`,
      }),
    );
  }

  private async postMutation(
    url: string,
    body: unknown,
    options: MutationRequestOptions,
  ): Promise<MutationOutcome> {
    const csrfToken = this.csrfTokenProvider();
    if (!csrfToken) {
      throw new ProblemError(
        normalizeProblem({
          type: "urn:mapf-rl:problem:csrf-token-unavailable",
          title: "CSRF token is unavailable",
          status: 403,
          code: "CSRF_TOKEN_UNAVAILABLE",
          requestId: options.requestId,
          retryable: false,
        }),
      );
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, application/problem+json",
      "X-CSRF-Token": csrfToken,
    };

    if (options.correlationId) {
      headers["X-Correlation-Id"] = options.correlationId;
    }

    const controller = new AbortController();
    let timeoutId: any = null;

    if (options.timeoutMs && options.timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        controller.abort();
      }, options.timeoutMs);
    }

    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return {
          status: "ACCEPTED",
          entityId: data.orderId || data.robotId || data.id,
          entityVersion: data.entityVersion,
          orderUpdateId: data.orderUpdateId,
          data,
        };
      }

      let errorPayload: unknown;
      try {
        errorPayload = await response.json();
      } catch {
        errorPayload = await response.text();
      }

      const problem = normalizeProblem(errorPayload, response.status);
      problem.requestId = options.requestId;
      throw new ProblemError(problem);
    } catch (err: unknown) {
      if (timeoutId) clearTimeout(timeoutId);

      if (err instanceof ProblemError) {
        throw err;
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        const timeoutProblem = normalizeProblem(
          {
            type: "urn:mapf-rl:problem:mutation-timeout",
            title: "Mutation Timeout / Outcome Uncertain",
            status: 504,
            code: "MUTATION_TIMEOUT_UNCERTAIN",
            requestId: options.requestId,
            retryable: true,
            detail: `Mutation request timed out after ${options.timeoutMs || 5000}ms. Outcome is uncertain.`,
          },
          504,
        );
        throw new ProblemError(timeoutProblem);
      }
      const problem = normalizeProblem(err, 503);
      problem.requestId = options.requestId;
      throw new ProblemError(problem);
    }
  }
}

export const defaultApiClient = new CoreApiClient(
  import.meta.env?.VITE_MAPF_CORE_BASE_URL || "",
);
