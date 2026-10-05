import assert from "node:assert/strict";
import test from "node:test";
import {
  createCanvasScheduler,
  resizeCanvas,
} from "../src/utils/performance/canvasScheduler.ts";
function harness() {
  let now = 0,
    id = 0,
    draw = () => {};
  const frames = new Map(),
    timers = new Map(),
    draws = [];
  const scheduler = createCanvasScheduler(
    () => {
      draws.push(now);
      draw();
    },
    {
      now: () => now,
      requestFrame: (cb) => {
        frames.set(++id, cb);
        return id;
      },
      cancelFrame: (id) => frames.delete(id),
      setTimer: (cb, delay) => {
        timers.set(++id, { cb, at: now + delay });
        return id;
      },
      clearTimer: (id) => timers.delete(id),
    },
  );
  return {
    scheduler,
    frames,
    timers,
    draws,
    setDraw: (cb) => {
      draw = cb;
    },
    tick(time) {
      now = time;
      for (const [id, timer] of [...timers])
        if (timer.at <= now) {
          timers.delete(id);
          timer.cb();
        }
      for (const [id, cb] of [...frames]) {
        frames.delete(id);
        cb();
      }
    },
  };
}
test("requests coalesce, use latest state, and leave no idle work", () => {
  const h = harness();
  let value = 1,
    rendered;
  h.setDraw(() => {
    rendered = value;
  });
  h.scheduler.request();
  value = 2;
  h.scheduler.request();
  assert.equal(h.frames.size, 1);
  h.tick(0);
  assert.equal(rendered, 2);
  h.tick(1000);
  assert.deepEqual(h.draws, [0]);
  assert.equal(h.frames.size + h.timers.size, 0);
});
test("continuous updates never draw faster than 30 FPS", () => {
  const h = harness();
  for (let time = 0; time <= 1000; time++) {
    h.scheduler.request();
    h.tick(time);
  }
  for (let i = 1; i < h.draws.length; i++)
    assert.ok(h.draws[i] - h.draws[i - 1] >= 1000 / 30);
  assert.ok(h.draws.length <= 31);
});
test("hidden canvases cancel work and resume with one current draw", () => {
  const h = harness();
  h.scheduler.request();
  h.scheduler.setVisible(false);
  assert.equal(h.frames.size + h.timers.size, 0);
  h.scheduler.request();
  h.tick(1000);
  assert.equal(h.draws.length, 0);
  h.scheduler.setVisible(true);
  h.tick(1000);
  assert.deepEqual(h.draws, [1000]);
  assert.equal(h.frames.size + h.timers.size, 0);
});
test("dispose cancels both frame and throttle timer", () => {
  for (const pendingTimer of [false, true]) {
    const h = harness();
    h.scheduler.request();
    if (pendingTimer) {
      h.tick(0);
      h.scheduler.request();
    }
    h.scheduler.dispose();
    h.scheduler.request();
    assert.equal(h.frames.size + h.timers.size, 0);
    h.tick(1000);
    assert.equal(h.draws.length, pendingTimer ? 1 : 0);
  }
});
test("fractional sizes resize once, preserve DPR, and skip zero dimensions", () => {
  let writes = 0,
    width = 0,
    height = 0;
  const canvas = {
    get width() {
      return width;
    },
    set width(v) {
      writes++;
      width = v;
    },
    get height() {
      return height;
    },
    set height(v) {
      writes++;
      height = v;
    },
  };
  assert.equal(resizeCanvas(canvas, 100.25, 50.25, 2), true);
  assert.equal(width, 201);
  assert.equal(height, 101);
  resizeCanvas(canvas, 100.25, 50.25, 2);
  assert.equal(writes, 2);
  resizeCanvas(canvas, 100.25, 50.25, 1);
  assert.equal(width, 100);
  assert.equal(height, 50);
  resizeCanvas(canvas, 200, 80, 1);
  assert.equal(width, 200);
  assert.equal(height, 80);
  const before = writes;
  assert.equal(resizeCanvas(canvas, 0, 80, 2), false);
  assert.equal(resizeCanvas(canvas, 200, 0, 2), false);
  assert.equal(writes, before);
});
