const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

function loadLogic() {
  const code = html.match(/<script id="logic">([\s\S]*?)<\/script>/)[1];
  return vm.runInContext(
    code + "\n;({LIFESPAN, STAT_KEYS, MAX_TICK_SECONDS, newPet, tick, setDifficulty})",
    vm.createContext({})
  );
}

const { LIFESPAN, STAT_KEYS, newPet, tick, setDifficulty } = loadLogic();

test("newPet: tutto a 100, viva, difficoltà data", () => {
  const p = newPet("difficile");
  assert.deepEqual({ ...p.stats }, { fame: 100, felicita: 100, energia: 100, pulizia: 100 });
  assert.equal(p.cap, 100);
  assert.equal(p.alive, true);
  assert.equal(p.difficulty, "difficile");
});

test("tick: a normale, 72 s tolgono 10 alle statistiche e 7 al tetto", () => {
  const p = tick(newPet("normale"), 60);
  const q = tick(p, 12);
  assert.ok(Math.abs(q.stats.fame - 90) < 1e-9);
  assert.ok(Math.abs(q.cap - 93) < 1e-9);
});

test("tick: dopo L secondi tetto a 30 e statistiche a 0 (tutte le difficoltà)", () => {
  for (const d of ["facile", "normale", "difficile"]) {
    let p = newPet(d);
    for (let s = 0; s < LIFESPAN[d]; s++) p = tick(p, 1);
    assert.ok(Math.abs(p.cap - 30) < 1e-6, d);
    for (const k of STAT_KEYS) assert.ok(p.stats[k] < 1e-6, d + k);
  }
});

test("tick: mai sotto 0", () => {
  let p = newPet("difficile");
  for (let i = 0; i < 20; i++) p = tick(p, 60);
  assert.equal(p.cap, 0);
  for (const k of STAT_KEYS) assert.equal(p.stats[k], 0);
});

test("tick: statistiche riportate sotto il tetto", () => {
  const p = tick({ ...newPet("normale"), cap: 50 }, 1); // statistiche a 100, tetto a 50
  for (const k of STAT_KEYS) assert.ok(p.stats[k] <= p.cap);
});

test("tick: secondi negativi non fanno nulla, oltre 60 conta 60", () => {
  const p = newPet("normale");
  assert.deepEqual(tick(p, -500), p);
  assert.deepEqual(tick(p, 10000), tick(p, 60));
});

test("tick: non muta l'input e non fa nulla da morta", () => {
  const p = newPet("normale");
  tick(p, 60);
  assert.equal(p.stats.fame, 100);
  const dead = { ...p, alive: false };
  assert.deepEqual(tick(dead, 60), dead);
});

test("setDifficulty: cambia solo la velocità successiva", () => {
  const p = tick(newPet("facile"), 60);
  const q = setDifficulty(p, "difficile");
  assert.deepEqual(q.stats, p.stats);
  assert.equal(q.cap, p.cap);
  assert.equal(q.difficulty, "difficile");
  assert.ok(Math.abs((p.stats.fame - tick(q, 3).stats.fame) - 1) < 1e-9); // 3 s * 100/300
});

test("setDifficulty: funziona anche da morta", () => {
  const dead = { ...newPet("facile"), alive: false };
  assert.equal(setDifficulty(dead, "difficile").difficulty, "difficile");
});
