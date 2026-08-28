import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  resizeGame,
  updateGame,
  speedForLevel,
  GAME_HUD_HEIGHT,
} from "../src/renderer/game-state.js";

test("only clearing the entire round increases speed, preserving current direction", () => {
  const game = createGame(1200, 800);
  game.pet.x = 200;
  game.pet.y = 200;
  game.pet.vx = 280;
  game.pellets = [
    { x: 200, y: 200, radius: 5 },
    { x: 800, y: 200, radius: 5 },
  ];
  assert.equal(updateGame(game, 0, 1200, 800), false);
  assert.equal(game.pet.speed, 280);
  game.pet.x = 800;
  assert.equal(updateGame(game, 0, 1200, 800), true);
  assert.equal(game.level, 2);
  assert.equal(game.pet.speed, 364);
  assert.equal(game.pet.vx, 364);
  assert.equal(game.pet.vy, 0);
  assert.equal(game.pellets.length, 24);
  assert.equal(game.score, 2);
});
test("each new round is faster, stationary clears do not launch the pet, new games reset", () => {
  for (let level = 1; level < 100; level++)
    assert.ok(Math.abs(speedForLevel(level + 1) / speedForLevel(level) - 1.3) < 1e-12);
  const game = createGame(1200, 800);
  game.pellets = [{ x: game.pet.x, y: game.pet.y, radius: 9 }];
  updateGame(game, 0, 1200, 800);
  assert.equal(game.pet.vx, 0);
  assert.equal(game.pet.vy, 0);
  assert.equal(game.score, 5);
  const fresh = createGame(1200, 800);
  assert.equal(fresh.level, 1);
  assert.equal(fresh.pet.speed, 280);
  assert.equal(fresh.pet.size, 64);
});
test("pet and beans stay below the hint band, even when accelerating toward it", () => {
  const game = createGame(800, 600, () => 0);
  assert.ok(game.pellets.every((p) => p.y - p.radius > GAME_HUD_HEIGHT));
  Object.assign(game.pet, { x: 100, y: 150, vx: 0, vy: -3000 });
  updateGame(game, 0.05, 800, 600);
  assert.ok(game.pet.y - game.pet.size / 2 > GAME_HUD_HEIGHT);
  assert.ok(game.pet.vy > 0);
});
test("high-speed swept collision eats crossed beans without sweeping across a wrap", () => {
  const game = createGame(1200, 800);
  Object.assign(game.pet, { x: 100, y: 200, vx: 2000, vy: 0 });
  game.pellets = [
    { x: 150, y: 200, radius: 5 },
    { x: 900, y: 600, radius: 5 },
  ];
  updateGame(game, 0.05, 1200, 800);
  assert.equal(game.score, 1);
  Object.assign(game.pet, { x: -30, y: 200, vx: -280 });
  game.pellets = [{ x: 600, y: 200, radius: 5 }];
  updateGame(game, 0.05, 1200, 800);
  assert.equal(game.pet.x, 1220);
  assert.equal(game.pellets.length, 1);
});

test("boundary movement preserves the remainder and detects beans after the boundary", () => {
  const game = createGame(800, 600);
  game.pellets = [{ x: 400, y: 300, radius: 5 }];
  Object.assign(game.pet, { x: 400, y: 550, vx: 0, vy: 280 });
  updateGame(game, 0.05, 800, 600);
  assert.equal(game.pet.y, 548);
  assert.equal(game.pet.vy, -280);
  Object.assign(game.pet, { x: 830, y: 200, vx: 280, vy: 0 });
  updateGame(game, 0.05, 800, 600);
  assert.equal(game.pet.x, -20);

  game.pellets = [
    { x: 36, y: 200, radius: 5 },
    { x: 400, y: 200, radius: 5 },
  ];
  Object.assign(game.pet, { x: 800, vx: 1000 });
  updateGame(game, 0.1, 800, 600);
  assert.deepEqual(
    game.pellets.map((p) => p.x),
    [400],
    "do not sweep through the wrap teleport",
  );
  game.pellets = [
    { x: 400, y: 470, radius: 5 },
    { x: 100, y: 200, radius: 5 },
  ];
  Object.assign(game.pet, { x: 400, y: 550, vx: 0, vy: 1000 });
  updateGame(game, 0.1, 800, 600);
  assert.deepEqual(
    game.pellets.map((p) => p.x),
    [100],
    "eat the bean on the reflected path",
  );
});

test("multiple wraps and bounces agree across frame partitions, including exact boundaries", () => {
  for (const axis of ["x", "y"]) {
    for (const velocity of [-1000000, -280, 280, 1000000]) {
      const whole = createGame(800, 600);
      Object.assign(whole.pet, {
        x: 400,
        y: 348,
        vx: axis === "x" ? velocity : 0,
        vy: axis === "y" ? velocity : 0,
      });
      whole.pellets = [{ x: 36, y: 140, radius: 5 }];
      const split = structuredClone(whole);
      updateGame(whole, 1, 800, 600);
      for (let i = 0; i < 100; i++) updateGame(split, 0.01, 800, 600);
      assert.ok(Math.abs(whole.pet[axis] - split.pet[axis]) < 1e-7);
      assert.equal(whole.pet.vx, split.pet.vx);
      assert.equal(whole.pet.vy, split.pet.vy);
    }
  }
  const game = createGame(800, 600);
  game.pellets = [{ x: 36, y: 140, radius: 5 }];
  Object.assign(game.pet, { x: 400, y: 550, vx: 0, vy: 120 });
  updateGame(game, 0.05, 800, 600);
  assert.equal(game.pet.y, 556);
  assert.equal(game.pet.vy, -120);
  updateGame(game, 0.05, 800, 600);
  assert.equal(game.pet.y, 550);
});

test("resize reflows remaining beans and pet without scoring or resetting the round", () => {
  const game = createGame(1200, 800, () => 0.95);
  game.level = 3;
  game.score = 42;
  game.pet.speed = speedForLevel(3);
  game.pet.vx = game.pet.speed;
  const before = structuredClone(game);
  resizeGame(game, 600, 400);
  assert.equal(game.pellets.length, before.pellets.length);
  assert.ok(game.pellets.every((p) => p.x >= 36 && p.x <= 564 && p.y >= 140 && p.y <= 356));
  assert.equal(game.score, 42);
  assert.equal(game.level, 3);
  assert.equal(game.pet.vx, before.pet.vx);
  assert.equal(game.pet.speed, before.pet.speed);
  assert.ok(game.pet.y >= 140 && game.pet.y <= 356);
  resizeGame(game, 1200, 800);
  assert.ok(Math.abs(game.pellets[0].x - before.pellets[0].x) < 1e-9);
  assert.ok(Math.abs(game.pellets[0].y - before.pellets[0].y) < 1e-9);
  const expanded = structuredClone(game);
  resizeGame(game, 1200, 800);
  assert.deepEqual(game, expanded, "unchanged geometry is a no-op");
});
