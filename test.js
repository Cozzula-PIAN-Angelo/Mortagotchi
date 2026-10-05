const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

function loadLogic() {
  const code = html.match(/<script id="logic">([\s\S]*?)<\/script>/)[1];
  return vm.runInContext(
    code + "\n;({LIFESPAN, STAT_KEYS, MAX_TICK_SECONDS, newPet, tick, setDifficulty, ACTION_STAT, ACTION_BOOST, FORCED_THRESHOLD, isForced, act, mood, shoot, SAVE_KEY, serialize, parseSave})",
    vm.createContext({})
  );
}

const { LIFESPAN, STAT_KEYS, newPet, tick, setDifficulty, ACTION_STAT, isForced, act, mood, shoot, SAVE_KEY, serialize, parseSave } = loadLogic();
const plain = (x) => JSON.parse(JSON.stringify(x));
const withStats = (p, obj) => ({ ...p, stats: { ...p.stats, ...obj } });

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

test("act: +30 fino al tetto", () => {
  const p = withStats({ ...newPet("normale"), cap: 80 }, { fame: 40 });
  assert.equal(act(p, "mangia").stats.fame, 70);
  assert.equal(act(act(p, "mangia"), "mangia").stats.fame, 80);
});

test("act: sul tetto non lo supera", () => {
  const p = { ...newPet("normale"), cap: 50, stats: { fame: 50, felicita: 50, energia: 50, pulizia: 50 } };
  assert.equal(act(p, "gioca").stats.felicita, 50);
});

test("act: ogni azione tocca solo la sua statistica", () => {
  const base = { ...newPet("normale"), stats: { fame: 40, felicita: 40, energia: 40, pulizia: 40 } };
  for (const [a, k] of Object.entries(ACTION_STAT)) {
    const r = act(base, a);
    for (const s of STAT_KEYS) assert.equal(r.stats[s], s === k ? 70 : 40, a + s);
  }
});

test("isForced: solo se tutte < 30", () => {
  const p = newPet("normale");
  assert.equal(isForced(withStats(p, { fame: 29, felicita: 29, energia: 29, pulizia: 29 })), true);
  assert.equal(isForced(withStats(p, { fame: 29, felicita: 29, energia: 29, pulizia: 30 })), false);
});

test("act: nessun effetto se obbligatoria o morta", () => {
  const forced = withStats(newPet("normale"), { fame: 10, felicita: 10, energia: 10, pulizia: 10 });
  assert.deepEqual(act(forced, "mangia"), forced);
  const dead = shoot(withStats(newPet("normale"), { fame: 10 }));
  assert.deepEqual(act(dead, "mangia"), dead);
});

test("mood: confini 50 e 30", () => {
  const p = newPet("normale");
  assert.equal(mood(withStats(p, { fame: 50, felicita: 50, energia: 50, pulizia: 50 })), "felice");
  assert.equal(mood(withStats(p, { fame: 49.9 })), "triste");
  assert.equal(mood(withStats(p, { fame: 30, felicita: 10, energia: 10, pulizia: 10 })), "triste");
  assert.equal(mood(withStats(p, { fame: 29, felicita: 10, energia: 10, pulizia: 10 })), "agonizzante");
});

test("shoot: morta, il resto invariato; doppio sparo innocuo", () => {
  const p = newPet("normale");
  const d = shoot(p);
  assert.equal(d.alive, false);
  assert.equal(p.alive, true);
  assert.deepEqual(shoot(d), d);
});

test("fine inevitabile: con cure perfette ogni secondo, obbligatoria entro L+1 s", () => {
  for (const d of ["facile", "normale", "difficile"]) {
    let p = newPet(d), t = 0;
    while (!isForced(p)) {
      for (const a of Object.keys(ACTION_STAT)) p = act(p, a);
      p = tick(p, 1);
      t++;
      assert.ok(t <= LIFESPAN[d] + 1, d + " ancora viva a " + t);
    }
  }
});

test("parseSave: andata e ritorno", () => {
  const p = shoot(tick(newPet("facile"), 45));
  assert.deepEqual(plain(parseSave(serialize(p))), plain(p));
  assert.equal(SAVE_KEY, "tamagotchi-save");
});

test("parseSave: input non validi → nuova creatura normale", () => {
  const fresh = plain(newPet("normale"));
  const bad = [null, "", "{rotto", "42", "null", "[]",
    JSON.stringify({ stats: { fame: 50 }, cap: 50, difficulty: "normale", alive: true }),
    JSON.stringify({ ...newPet("normale"), cap: 150 }),
    JSON.stringify({ ...newPet("normale"), difficulty: "impossibile" }),
    JSON.stringify({ ...newPet("normale"), alive: "si" }),
    JSON.stringify({ ...newPet("normale"), stats: { fame: "x", felicita: 1, energia: 1, pulizia: 1 } })];
  for (const t of bad) assert.deepEqual(plain(parseSave(t)), fresh, String(t));
});

test("parseSave: statistica sopra il tetto viene riportata al tetto", () => {
  const t = JSON.stringify({ ...newPet("normale"), cap: 40 });
  assert.equal(parseSave(t).stats.fame, 40);
});

test("parseSave: campi extra ignorati", () => {
  const t = JSON.stringify({ ...newPet("facile"), extra: 1 });
  assert.deepEqual(Object.keys(parseSave(t)).sort(), ["alive", "cap", "difficulty", "stats"]);
});
