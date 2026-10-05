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

function loadScript(id, names) {
  const m = html.match(new RegExp(String.raw`<script id="${id}">([\s\S]*?)<\/script>`));
  assert.ok(m, "blocco <script id=\"" + id + "\"> assente");
  return vm.runInContext(m[1] + "\n;({" + names.join(", ") + "})", vm.createContext({}));
}

function assertSprite(name, sprite, w, h) {
  assert.ok(Array.isArray(sprite), name + " non è un array");
  assert.equal(sprite.length, h, name + " altezza");
  for (const row of sprite) {
    assert.equal(row.length, w, name + " larghezza riga '" + row + "'");
    assert.match(row, /^[#.]+$/, name + " caratteri");
  }
}

test("sprite: forme e dimensioni", () => {
  const { SPRITES } = loadScript("sprites", ["SPRITES"]);
  for (const m of ["felice", "triste", "agonizzante"]) {
    assert.equal(SPRITES[m].length, 2, m + " frame");
    SPRITES[m].forEach((f, i) => assertSprite(m + i, f, 16, 16));
  }
  assertSprite("lapide", SPRITES.lapide, 16, 16);
  for (const n of ["cibo", "palla", "zzz", "bolle"]) assertSprite(n, SPRITES[n], 8, 8);
});

test("sprite: sequenza della Magnum", () => {
  const { SPRITES } = loadScript("sprites", ["SPRITES"]);
  assert.equal(SPRITES.terrorizzata.length, 2, "terrorizzata frame");
  SPRITES.terrorizzata.forEach((f, i) => assertSprite("terrorizzata" + i, f, 16, 16));
  assert.notDeepEqual(SPRITES.terrorizzata[0], SPRITES.terrorizzata[1]);
  assertSprite("magnum", SPRITES.magnum, 16, 10);
  const bang = SPRITES.bang;
  assert.ok(bang.length <= 8 && bang[0].length <= 32, "bang troppo grande");
  assertSprite("bang", bang, bang[0].length, bang.length);
});

test("drawShot: tempo leggermente negativo (frame iniziato prima del click) non va in errore", () => {
  const { drawShot } = loadScript("sprites", ["drawShot"]);
  const ctx = { fillRect() {}, canvas: { width: 288, height: 192 } };
  for (const t of [-16, -1, 0, 500, 1100, 1500]) assert.equal(drawShot(ctx, t), true, "t=" + t);
  assert.equal(drawShot(ctx, 2200), false);
});

test("sprite: icone dei tasti", () => {
  const { SPRITES } = loadScript("sprites", ["SPRITES"]);
  assertSprite("uovo", SPRITES.uovo, 8, 8);
  for (const n of ["liv1", "liv2", "liv3"]) assertSprite(n, SPRITES[n], 8, 7);
});

test("iconSvg: un rettangolo per ogni pixel acceso, viewBox della griglia", () => {
  const { iconSvg } = loadScript("sprites", ["iconSvg"]);
  const svg = iconSvg(["#..", ".##"]);
  assert.match(svg, /^<svg [^>]*viewBox="0 0 3 2"/);
  assert.equal((svg.match(/<rect /g) || []).length, 3);
  assert.match(svg, /<rect x="1" y="1" width="1" height="1"\/>/);
  assert.match(svg, /aria-hidden="true"/);
});

test("pixelText: lettere 3×5 più riga accenti, una colonna di spazio fra le lettere", () => {
  const { pixelText } = loadScript("sprites", ["pixelText"]);
  const t = pixelText("NE");
  assertSprite("NE", t, 7, 6);
  assert.equal(t[0], ".......", "nessun accento");
  assert.equal(pixelText("È")[0].includes("#"), true, "accento su È");
  const msg = pixelText("NON C'È PIÙ NIENTE DA FARE...");
  assertSprite("avviso", msg, msg[0].length, 6);
  assert.throws(() => pixelText("Q"), /Q/);
});
