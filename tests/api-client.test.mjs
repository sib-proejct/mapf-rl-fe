import assert from "node:assert/strict";
import test from "node:test";

import { CoreApiClient, ProblemError } from "../src/services/api/client.ts";
import { setLiveMapAvailable } from "../src/services/maps/mapGeneration.ts";

const REQUEST_ID = "60000000-0000-4000-8000-000000000001";
const MAP_ID = "00000000-0000-4000-8000-000000000001";

test("map connection loss blocks writes, allows reads and explicit switch recovery", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
    setLiveMapAvailable(true);
  });
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ generation: 2, phase: "STOPPING" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const client = new CoreApiClient("https://core.example", () => "csrf-token");
  const submit = () =>
    client.enqueueOrder(
      {
        mapId: MAP_ID,
        mapRevision: 1,
        task: { robotId: "r-001", steps: [{ goalColumn: 4, goalRow: 5 }] },
      },
      { requestId: REQUEST_ID },
    );

  setLiveMapAvailable(false);
  await assert.rejects(
    submit(),
    (error) =>
      error instanceof ProblemError &&
      error.problem.code === "LOCAL_MAP_UNAVAILABLE",
  );
  assert.equal(calls.length, 0);
  await client.fetchOperationsSnapshot();
  assert.equal(calls[0].init.method, "GET");
  await client.activateLocalMap(MAP_ID, 1);
  assert.equal(calls[1].url, "https://core.example/api/v1/local-maps/activate");

  setLiveMapAvailable(true);
  await submit();
  assert.equal(calls[2].url, "https://core.example/api/v1/queue/tasks");
});

test("createOrder sends the Core body contract and CSRF token", async (t) => {
  const originalFetch = globalThis.fetch;
  let captured;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(
      JSON.stringify({
        requestId: REQUEST_ID,
        orderId: "order-01",
        state: "Planning",
        orderUpdateId: 0,
      }),
      { status: 202, headers: { "Content-Type": "application/json" } },
    );
  };

  const client = new CoreApiClient("https://core.example", () => "csrf-token");
  const outcome = await client.createOrder(
    {
      mapId: MAP_ID,
      mapRevision: 3,
      assignments: [{ robotId: "robot-01", goalColumn: 4, goalRow: 5 }],
    },
    { requestId: REQUEST_ID },
  );

  assert.equal(captured.url, "https://core.example/api/v1/orders");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers["X-CSRF-Token"], "csrf-token");
  assert.equal(captured.init.headers["X-Request-Id"], undefined);
  assert.deepEqual(JSON.parse(captured.init.body), {
    requestId: REQUEST_ID,
    mapId: MAP_ID,
    mapRevision: 3,
    assignments: [{ robotId: "robot-01", goalColumn: 4, goalRow: 5 }],
  });
  assert.equal(outcome.entityId, "order-01");
});

test("createOrder fails closed when no CSRF token is composed", async () => {
  const client = new CoreApiClient("", () => null);
  await assert.rejects(
    client.createOrder(
      {
        mapId: MAP_ID,
        mapRevision: 3,
        assignments: [{ robotId: "robot-01", goalColumn: 4, goalRow: 5 }],
      },
      { requestId: REQUEST_ID },
    ),
    (error) =>
      error instanceof ProblemError &&
      error.problem.code === "CSRF_TOKEN_UNAVAILABLE",
  );
});

test("unsupported live mutations are rejected locally without a request", async (t) => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error("unexpected request");
  };

  const client = new CoreApiClient("", () => "csrf-token");
  await assert.rejects(
    client.sendInstantAction(
      { robotId: "robot-01", action: "PAUSE" },
      { requestId: REQUEST_ID },
    ),
    (error) =>
      error instanceof ProblemError &&
      error.problem.code === "MUTATION_NOT_SUPPORTED",
  );
  assert.equal(fetchCount, 0);
});
