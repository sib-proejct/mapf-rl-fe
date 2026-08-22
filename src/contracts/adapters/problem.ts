/**
 * RFC 9457 Problem Details adapter and error normalization.
 */

export type ProblemCategory =
  | "validation"
  | "authentication"
  | "authorization"
  | "idempotency"
  | "stale_gap"
  | "dependency_unavailable"
  | "not_found"
  | "incompatible_contract"
  | "generic";

export interface InvalidFieldDetail {
  path: string;
  code: string;
}

export interface NormalizedProblem {
  type: string;
  title: string;
  status: number;
  code: string;
  traceId: string;
  retryable: boolean;
  category: ProblemCategory;
  detail?: string;
  instance?: string;
  requestId?: string;
  currentVersion?: number;
  invalidFields?: InvalidFieldDetail[];
}

/**
 * Categorizes the problem according to Section 7.4 of DESIGN.md.
 */
export function categorizeProblem(
  status: number,
  code: string,
): ProblemCategory {
  if (status === 401) return "authentication";
  if (status === 403) return "authorization";
  if (status === 404) return "not_found";
  if (status === 409 || code.includes("IDEMPOTENCY")) return "idempotency";
  if (code.includes("STALE") || code.includes("GAP")) return "stale_gap";
  if (code.includes("INCOMPATIBLE")) return "incompatible_contract";
  if (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    code.includes("UNAVAILABLE")
  ) {
    return "dependency_unavailable";
  }
  if (status === 400 || code.includes("VALIDATION")) return "validation";
  return "generic";
}

/**
 * Normalizes an unknown error or raw RFC 9457 response object into a NormalizedProblem.
 */
export function normalizeProblem(
  raw: unknown,
  fallbackStatus: number = 500,
): NormalizedProblem {
  if (raw && typeof raw === "object" && !(raw instanceof Error)) {
    const obj = raw as Record<string, unknown>;

    const status =
      typeof obj.status === "number" && obj.status >= 400 && obj.status <= 599
        ? obj.status
        : fallbackStatus;

    const code =
      typeof obj.code === "string" && obj.code.length > 0
        ? obj.code
        : `HTTP_${status}`;

    const title =
      typeof obj.title === "string" && obj.title.length > 0
        ? obj.title
        : `Request failed with status ${status}`;

    const type = typeof obj.type === "string" ? obj.type : "about:blank";
    const traceId =
      typeof obj.traceId === "string"
        ? obj.traceId
        : "00000000000000000000000000000000";

    const retryable =
      typeof obj.retryable === "boolean"
        ? obj.retryable
        : status >= 500 && status !== 501;

    const detail = typeof obj.detail === "string" ? obj.detail : undefined;
    const instance =
      typeof obj.instance === "string" ? obj.instance : undefined;
    const requestId =
      typeof obj.requestId === "string" ? obj.requestId : undefined;
    const currentVersion =
      typeof obj.currentVersion === "number" ? obj.currentVersion : undefined;

    const invalidFields = Array.isArray(obj.invalidFields)
      ? (obj.invalidFields as InvalidFieldDetail[]).filter(
          (f) => typeof f.path === "string" && typeof f.code === "string",
        )
      : undefined;

    return {
      type,
      title,
      status,
      code,
      traceId,
      retryable,
      category: categorizeProblem(status, code),
      detail,
      instance,
      requestId,
      currentVersion,
      invalidFields,
    };
  }

  // Handle generic Error or string
  const message =
    raw instanceof Error
      ? raw.message
      : String(raw || "An unexpected error occurred");
  return {
    type: "about:blank",
    title: "Client Request Error",
    status: fallbackStatus,
    code: "CLIENT_ERROR",
    traceId: "00000000000000000000000000000000",
    retryable: true,
    category: categorizeProblem(fallbackStatus, "CLIENT_ERROR"),
    detail: message,
  };
}
