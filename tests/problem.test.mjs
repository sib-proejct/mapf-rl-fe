import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeProblem,
  categorizeProblem,
} from "../src/contracts/adapters/problem.ts";

test("normalizeProblem normalizes valid RFC 9457 problem payload", () => {
  const raw = {
    type: "urn:mapf-rl:problem:idempotency-conflict",
    title: "The requestId was reused with different content",
    status: 409,
    code: "IDEMPOTENCY_CONFLICT",
    traceId: "0123456789abcdef0123456789abcdef",
    requestId: "60000000-0000-4000-8000-000000000001",
    retryable: false,
    detail: "Different payload hash detected",
  };

  const normalized = normalizeProblem(raw);
  assert.equal(normalized.status, 409);
  assert.equal(normalized.code, "IDEMPOTENCY_CONFLICT");
  assert.equal(normalized.traceId, "0123456789abcdef0123456789abcdef");
  assert.equal(normalized.category, "idempotency");
  assert.equal(normalized.retryable, false);
  assert.equal(normalized.detail, "Different payload hash detected");
});

test("categorizeProblem maps status codes and codes correctly", () => {
  assert.equal(categorizeProblem(401, "UNAUTHORIZED"), "authentication");
  assert.equal(categorizeProblem(403, "FORBIDDEN"), "authorization");
  assert.equal(categorizeProblem(404, "NOT_FOUND"), "not_found");
  assert.equal(categorizeProblem(409, "CONFLICT"), "idempotency");
  assert.equal(categorizeProblem(400, "VALIDATION_ERROR"), "validation");
  assert.equal(
    categorizeProblem(503, "DURABLE_STORAGE_UNAVAILABLE"),
    "dependency_unavailable",
  );
  assert.equal(categorizeProblem(400, "STALE_SNAPSHOT"), "stale_gap");
  assert.equal(
    categorizeProblem(400, "INCOMPATIBLE_CONTRACT"),
    "incompatible_contract",
  );
});

test("normalizeProblem handles fallback errors gracefully", () => {
  const normalized = normalizeProblem(
    new Error("Network connection failed"),
    503,
  );
  assert.equal(normalized.status, 503);
  assert.equal(normalized.code, "CLIENT_ERROR");
  assert.equal(normalized.detail, "Network connection failed");
  assert.equal(normalized.category, "dependency_unavailable");
});
