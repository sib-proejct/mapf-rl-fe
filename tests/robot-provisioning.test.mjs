import assert from "node:assert/strict";
import test from "node:test";
import { CoreApiClient, ProblemError } from "../src/services/api/client.ts";
import {
  adaptProvisioningOutcome,
  adaptRobotRemovalOutcome,
} from "../src/contracts/adapters/provisioning.ts";

const command = {
  contractVersion: "1.0.0",
  requestId: "60000000-0000-4000-8000-000000000001",
  map: {
    mapId: "00000000-0000-4000-8000-000000000001",
    revision: 1,
    contentDigestSha256: "a".repeat(64),
  },
  start: { column: 4, row: 6 },
};

test("robot removal replays the same request and waits for confirmed completion", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    if (requests.length === 1) throw new TypeError("network interrupted");
    return Response.json({
      contractVersion: "1.0.0",
      robotId: "r-001",
      state: init.method === "POST" ? "PENDING" : "REMOVED",
    });
  };
  const client = new CoreApiClient("", () => "csrf");
  const request = { contractVersion: "1.0.0", requestId: command.requestId };
  await assert.rejects(client.removeRobot("r-001", request), ProblemError);
  assert.equal((await client.removeRobot("r-001", request)).state, "PENDING");
  assert.equal(requests[0].init.body, requests[1].init.body);
  assert.equal(requests[1].init.headers["X-CSRF-Token"], "csrf");
  assert.equal(requests[1].url, "/api/v1/robots/r-001/remove");
  assert.equal((await client.robotRemoval("r-001")).state, "REMOVED");
});

test("robot removal fails closed without CSRF and rejects invalid outcomes", async () => {
  await assert.rejects(
    new CoreApiClient("", () => null).removeRobot("r-001", {
      contractVersion: "1.0.0",
      requestId: command.requestId,
    }),
    (error) => error.problem.code === "CSRF_TOKEN_UNAVAILABLE",
  );
  for (const state of ["READY", "DELETED", "FAILED"]) {
    assert.throws(() =>
      adaptRobotRemovalOutcome({
        contractVersion: "1.0.0",
        robotId: "r-001",
        state,
      }),
    );
  }
});
test("robot creation replays the same request after uncertain response and sends CSRF", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    if (requests.length === 1) throw new TypeError("network interrupted");
    return Response.json(
      { contractVersion: "1.0.0", robotId: "new-robot", state: "PENDING" },
      { status: 202 },
    );
  };
  const client = new CoreApiClient("", () => "csrf");
  await assert.rejects(client.createRobot(command), ProblemError);
  const result = await client.createRobot(command);
  assert.equal(result.robotId, "new-robot");
  assert.equal(requests[0].init.body, requests[1].init.body);
  assert.equal(requests[1].init.headers["X-CSRF-Token"], "csrf");
  assert.equal(requests[1].url, "/api/v1/robots");
});
test("failed provisioning retry keeps identity and immutable retry request", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const captured = [];
  globalThis.fetch = async (url, init) => {
    captured.push({ url, init });
    return Response.json({
      contractVersion: "1.0.0",
      robotId: "same-robot",
      state: "PENDING",
    });
  };
  const client = new CoreApiClient("", () => "csrf");
  const retry = { contractVersion: "1.0.0", requestId: command.requestId };
  await client.retryRobotProvisioning("same-robot", retry);
  await client.retryRobotProvisioning("same-robot", retry);
  assert.equal(captured[0].url, "/api/v1/robots/same-robot/provisioning/retry");
  assert.equal(captured[0].init.body, captured[1].init.body);
});
test("robot addition fails closed without CSRF and validates server states", async () => {
  await assert.rejects(
    new CoreApiClient("", () => null).createRobot(command),
    (error) => error.problem.code === "CSRF_TOKEN_UNAVAILABLE",
  );
  assert.throws(() =>
    adaptProvisioningOutcome({
      contractVersion: "2.0.0",
      robotId: "r1",
      state: "READY",
    }),
  );
  assert.throws(() =>
    adaptProvisioningOutcome({
      contractVersion: "1.0.0",
      robotId: "r1",
      state: "CONNECTED",
    }),
  );
  assert.equal(
    adaptProvisioningOutcome({
      contractVersion: "1.0.0",
      robotId: "r1",
      state: "FAILED",
      failureCode: "UNSAFE_START",
    }).failureCode,
    "UNSAFE_START",
  );
});
