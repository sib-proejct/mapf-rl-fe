import assert from "node:assert/strict";
import test from "node:test";
import { CoreApiClient, ProblemError } from "../src/services/api/client.ts";

const requestId = "60000000-0000-4000-8000-000000000001";
const goal = {
  mapId: requestId,
  mapRevision: 1,
  goalColumn: 3,
  goalRow: 2,
  arrivalAction: "PICK",
};

test("automatic dispatch retries the original intent and preserves the confirmed robot", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, body: init.body });
    if (requests.length === 1) throw new DOMException("timeout", "AbortError");
    return Response.json({
      requestId,
      orderId: "order-1",
      robotId: "robot-3",
      state: "Planning",
      orderUpdateId: 0,
    });
  };
  const client = new CoreApiClient("", () => "csrf");
  await assert.rejects(
    client.createOrder(goal, { requestId }),
    (error) =>
      error instanceof ProblemError &&
      error.problem.code === "MUTATION_TIMEOUT_UNCERTAIN",
  );
  const result = await client.createOrder(goal, { requestId });
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(requests[1].url, "/api/v1/orders/auto-assign");
  assert.deepEqual(JSON.parse(requests[1].body), { ...goal, requestId });
  assert.equal(result.entityId, "order-1");
  assert.equal(result.data.robotId, "robot-3");
});

test("manual dispatch keeps the existing endpoint and automatic errors remain visible", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    return Response.json(
      {
        code: "NO_ASSIGNABLE_ROBOT",
        title: "Conflict",
        detail: "No eligible robot",
        status: 409,
      },
      { status: 409 },
    );
  };
  const client = new CoreApiClient("", () => "csrf");
  await assert.rejects(
    client.createOrder(
      {
        mapId: requestId,
        mapRevision: 1,
        assignments: [{ robotId: "r1", goalColumn: 2, goalRow: 1 }],
      },
      { requestId },
    ),
    ProblemError,
  );
  await assert.rejects(
    client.createOrder(goal, { requestId }),
    (error) => error.problem.code === "NO_ASSIGNABLE_ROBOT",
  );
  assert.deepEqual(urls, ["/api/v1/orders", "/api/v1/orders/auto-assign"]);
});
