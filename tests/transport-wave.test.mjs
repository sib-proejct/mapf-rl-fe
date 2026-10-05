import assert from "node:assert/strict";
import test from "node:test";
import { generateTransportWave } from "../src/domain/order/transportWave.ts";

test("generates exactly 100 tasks within selected candidates", () => {
  const samples = [0, 0.999, 0.999, 0];
  let index = 0;
  const tasks = generateTransportWave(
    100,
    ["p1", "p2"],
    ["d1", "d2"],
    () => samples[index++ % samples.length],
  );
  assert.equal(tasks.length, 100);
  assert.deepEqual(tasks[0], { pick: "p1", place: "d2", robot: "" });
  assert.deepEqual(tasks[1], { pick: "p2", place: "d1", robot: "" });
  assert.ok(
    tasks.every(
      (task) =>
        ["p1", "p2"].includes(task.pick) &&
        ["d1", "d2"].includes(task.place) &&
        task.robot === "",
    ),
  );
});

test("allows repeated routes and a single task", () => {
  assert.ok(
    generateTransportWave(100, ["p"], ["d"], () => 0.5).every(
      (task) => task.pick === "p" && task.place === "d",
    ),
  );
  assert.equal(generateTransportWave(1, ["p"], ["d"]).length, 1);
});

test("rejects invalid counts and empty candidates before sampling", () => {
  const random = () => {
    throw new Error("must not sample");
  };
  for (const count of [0, -1, 101, 1.5, NaN, Infinity])
    assert.throws(
      () => generateTransportWave(count, ["p"], ["d"], random),
      /integer/,
    );
  assert.throws(() => generateTransportWave(100, [], ["d"], random), /station/);
  assert.throws(() => generateTransportWave(100, ["p"], [], random), /station/);
});
