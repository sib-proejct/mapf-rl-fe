import {
  NormalizedProblem,
  normalizeProblem,
} from "../../contracts/adapters/problem.ts";

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

/**
 * Versioned REST API client for MAPF-RL Core /api/v1.
 * Uses same-origin BFF and HttpOnly session cookies.
 */
export class CoreApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
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

      // Handle RFC 9457 Problem or HTTP error response
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
}

export const defaultApiClient = new CoreApiClient(
  import.meta.env.VITE_MAPF_CORE_BASE_URL || "",
);
