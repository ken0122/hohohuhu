import test from "node:test";
import assert from "node:assert/strict";
import { createGame, updateGame, speedForLevel, GAME_HUD_HEIGHT } from "../src/renderer/game-state.js";

test("only clearing the entire round increases speed, preserving current direction", () => {
  const game=createGame(1200,800);
  game.pet.x=200;game.pet.y=200;game.pet.vx=280;
  game.pellets=[{x:200,y:200,radius:5},{x:800,y:200,radius:5}];
  assert.equal(updateGame(game,0,1200,800),false);
  assert.equal(game.pet.speed,280);
  game.pet.x=800;
  assert.equal(updateGame(game,0,1200,800),true);
  assert.equal(game.level,2); assert.equal(game.pet.speed,308); assert.equal(game.pet.vx,308);
  assert.equal(game.pet.vy,0); assert.equal(game.pellets.length,24);
  assert.equal(game.score,2);
});
test("each new round is faster, stationary clears do not launch the pet, new games reset", () => {
  for (let level=1;level<100;level++) assert.ok(Math.abs(speedForLevel(level+1)/speedForLevel(level)-1.1)<1e-12);
  const game=createGame(1200,800);
  game.pellets=[{x:game.pet.x,y:game.pet.y,radius:9}];
  updateGame(game,0,1200,800);
  assert.equal(game.pet.vx,0);assert.equal(game.pet.vy,0);assert.equal(game.score,5);
  const fresh=createGame(1200,800);
  assert.equal(fresh.level,1);assert.equal(fresh.pet.speed,280);assert.equal(fresh.pet.size,64);
});
test("pet and beans stay below the hint band, even when accelerating toward it",()=>{
  const game=createGame(800,600,()=>0);
  assert.ok(game.pellets.every(p=>p.y-p.radius>GAME_HUD_HEIGHT));
  Object.assign(game.pet,{x:100,y:150,vx:0,vy:-3000});
  updateGame(game,.05,800,600);
  assert.ok(game.pet.y-game.pet.size/2>GAME_HUD_HEIGHT);
  assert.ok(game.pet.vy>0);
});
test("high-speed swept collision eats crossed beans without sweeping across a wrap", () => {
  const game=createGame(1200,800);
  Object.assign(game.pet,{x:100,y:200,vx:2000,vy:0});
  game.pellets=[{x:150,y:200,radius:5},{x:900,y:600,radius:5}];
  updateGame(game,.05,1200,800);
  assert.equal(game.score,1);
  Object.assign(game.pet,{x:-30,y:200,vx:-280});
  game.pellets=[{x:600,y:200,radius:5}];
  updateGame(game,.05,1200,800);
  assert.equal(game.pet.x,1232);assert.equal(game.pellets.length,1);
});
