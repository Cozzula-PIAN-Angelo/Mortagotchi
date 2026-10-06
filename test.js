const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

function loadLogic() {
  const code = html.match(/<script id="logic">([\s\S]*?)<\/script>/)[1];
  return vm.runInContext(
    code + "\n;({LIFESPAN, DECAY_RATE, STAT_KEYS, MAX_TICK_SECONDS, newPet, tick, setDifficulty, ACTION_STAT, ACTION_BOOST, FORCED_THRESHOLD, isForced, act, mood, shoot, SAVE_KEY, serialize, parseSave, REACTION, reactionFor})",
    vm.createContext({})
  );
}

const { LIFESPAN, DECAY_RATE, STAT_KEYS, newPet, tick, setDifficulty, ACTION_STAT, isForced, act, mood, shoot, SAVE_KEY, serialize, parseSave, reactionFor } = loadLogic();
const plain = (x) => JSON.parse(JSON.stringify(x));
const withStats = (p, obj) => ({ ...p, stats: { ...p.stats, ...obj } });

test("newPet: tutto a 100, viva, difficoltà data", () => {
  const p = newPet("difficile");
  assert.deepEqual({ ...p.stats }, { fame: 100, felicita: 100, energia: 100, pulizia: 100 });
  assert.equal(p.cap, 100);
  assert.equal(p.alive, true);
  assert.equal(p.difficulty, "difficile");
});

test("tick: a normale, 72 s tolgono 30/15/12.5/10 alle statistiche e 3,5 al tetto", () => {
  const p = tick(newPet("normale"), 60);
  const q = tick(p, 12);
  const atteso = { fame: 70, felicita: 85, pulizia: 87.5, energia: 90 };
  for (const k of STAT_KEYS) assert.ok(Math.abs(q.stats[k] - atteso[k]) < 1e-9, k);
  assert.ok(Math.abs(q.cap - 96.5) < 1e-9);
});

test("tick: velocità diverse, fame > felicità > pulizia > energia", () => {
  const { fame, felicita, pulizia, energia } = tick(newPet("normale"), 30).stats;
  assert.ok(fame < felicita && felicita < pulizia && pulizia < energia);
});

test("vita massima: 120 min, 24 min, 4 min", () => {
  assert.deepEqual(plain(LIFESPAN), { facile: 7200, normale: 1440, difficile: 240 });
});

test("tick: senza cure la Magnum diventa obbligatoria dopo 42 min, 8 min 24 s, 1 min 24 s", () => {
  const atteso = { facile: 2520, normale: 504, difficile: 84 };
  for (const d of ["facile", "normale", "difficile"]) {
    let p = newPet(d);
    let s = 0;
    while (!isForced(p)) { p = tick(p, 1); s++; }
    assert.ok(Math.abs(s - atteso[d]) <= 1, d + " " + s);
  }
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
  assert.ok(Math.abs((p.stats.energia - tick(q, 3).stats.energia) - 2.5) < 1e-9); // 3 s * 2 * 100/240
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

test("reactionFor: una reazione per ogni cambio d'umore, nessuna se resta uguale", () => {
  for (const m of ["felice", "triste", "agonizzante"]) assert.equal(reactionFor(m, m), null, m);
  assert.equal(reactionFor("felice", "triste"), "lacrima");
  assert.equal(reactionFor("triste", "felice"), "cuoricino");
  assert.equal(reactionFor("triste", "agonizzante"), "teschio");
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

test("pixelText: MORTAGOTCHI ha tutti i glifi", () => {
  const { pixelText } = loadScript("sprites", ["pixelText"]);
  const t = pixelText("MORTAGOTCHI");
  assertSprite("MORTAGOTCHI", t, 11 * 3 + 10, 6);
});

test("pixelText: M normale 3×5", () => {
  const { pixelText } = loadScript("sprites", ["pixelText"]);
  assert.deepEqual([...pixelText("M")], ["...", "#.#", "###", "###", "#.#", "#.#"]);
});

test("iconSvg: colore di riempimento esplicito", () => {
  const { iconSvg } = loadScript("sprites", ["iconSvg"]);
  assert.match(iconSvg(["#"], "#123456"), /fill="#123456"/);
  assert.match(iconSvg(["#"]), /fill="currentColor"/);
});

test("tileSprite: piastrella a mattoni con la seconda riga sfalsata e avvolta", () => {
  const { tileSprite } = loadScript("sprites", ["tileSprite"]);
  const t = tileSprite(["##", "##"], 2, 1); // W = 4, H = 2 * (2 + 1) = 6
  assert.deepEqual([...t], ["##..", "##..", "....", "..##", "..##", "...."]);
  const w = tileSprite(["###"], 0, 0); // W = 3, seconda copia a x = 1, avvolta
  assert.deepEqual([...w], ["###", "###"]);
  const odd = tileSprite(["#.."], 2, 0); // W = 5, seconda copia a x = 2
  assert.deepEqual([...odd], ["#....", "..#.."]);
});

test("sprite: lapidina con croce accanto al marchio", () => {
  const { SPRITES } = loadScript("sprites", ["SPRITES"]);
  assertSprite("lapidina", SPRITES.lapidina, 7, 8);
});

test("besideSprite: affianca due sprite allineati in basso", () => {
  const { besideSprite } = loadScript("sprites", ["besideSprite"]);
  assert.deepEqual([...besideSprite(["##"], ["#", "#"], 1)], ["...#", "##.#"]);
  assert.deepEqual([...besideSprite(["#", "#"], ["##"], 2)], ["#...", "#..##"].map((r) => r.padEnd(5, ".")));
});

const animScript = () => loadScript("sprites", ["ANIMATIONS", "ANIM_PRIORITY", "startAnim", "advanceAnim", "SPRITES", "drawSprite"]);
function fakeCtx() {
  const calls = [];
  return { calls, fillStyle: "", fillRect: (...a) => calls.push(a), canvas: { width: 288, height: 192 } };
}
function assertDraws(A, name) {
  for (const t of [-16, 0, A[name].ms / 2, A[name].ms - 1]) {
    const ctx = fakeCtx();
    A[name].draw(ctx, t, "felice");
    assert.ok(ctx.calls.length > 0, name + " non disegna nulla a t=" + t);
  }
}
const E = { anim: null, queued: null };

test("ANIMATIONS: cure, reazioni e sparo con tipo e durata", () => {
  const { ANIMATIONS: A } = animScript();
  const attese = {
    sparo: ["sparo", 2200], mangia: ["cura", 1000], gioca: ["cura", 1000], lava: ["cura", 1000], riposa: ["cura", 1000],
    lacrima: ["reazione", 1000], cuoricino: ["reazione", 1000], teschio: ["reazione", 1000],
  };
  for (const [n, [kind, ms]] of Object.entries(attese)) {
    assert.equal(A[n].kind, kind, n);
    assert.equal(A[n].ms, ms, n);
  }
});

test("ANIMATIONS: ogni animazione disegna qualcosa per tutta la durata", () => {
  const { ANIMATIONS: A } = animScript();
  for (const n of Object.keys(A)) assertDraws(A, n);
});

test("sprite: reazioni", () => {
  const { SPRITES } = animScript();
  assertSprite("afflitta", SPRITES.afflitta, 16, 16);
  assertSprite("gioia", SPRITES.gioia, 16, 16);
  assertSprite("cuore", SPRITES.cuore, 5, 5);
  assertSprite("teschio", SPRITES.teschio, 7, 6);
  assertSprite("fumetto", SPRITES.fumetto, 13, 10);
});

test("ANIM_PRIORITY: sparo > nascita > cura > reazione", () => {
  assert.deepEqual(plain(animScript().ANIM_PRIORITY), { sparo: 4, nascita: 3, cura: 2, reazione: 1 });
});

test("startAnim: da vuoto parte subito", () => {
  assert.deepEqual(plain(animScript().startAnim(E, "mangia", 100)), { anim: { name: "mangia", start: 100 }, queued: null });
});

test("startAnim: lo sparo interrompe tutto e svuota la coda", () => {
  const p = { anim: { name: "mangia", start: 0 }, queued: "lacrima" };
  assert.deepEqual(plain(animScript().startAnim(p, "sparo", 500)), { anim: { name: "sparo", start: 500 }, queued: null });
});

test("startAnim: la cura interrompe una reazione", () => {
  const p = { anim: { name: "lacrima", start: 0 }, queued: null };
  assert.deepEqual(plain(animScript().startAnim(p, "gioca", 300)), { anim: { name: "gioca", start: 300 }, queued: null });
});

test("startAnim: la reazione va in coda dietro una cura, vince la più recente", () => {
  const { startAnim } = animScript();
  let p = startAnim(E, "mangia", 0);
  p = startAnim(p, "lacrima", 100);
  p = startAnim(p, "cuoricino", 200);
  assert.deepEqual(plain(p), { anim: { name: "mangia", start: 0 }, queued: "cuoricino" });
});

test("startAnim: una reazione sostituisce un'altra reazione", () => {
  const p = { anim: { name: "lacrima", start: 0 }, queued: null };
  assert.deepEqual(plain(animScript().startAnim(p, "cuoricino", 300)), { anim: { name: "cuoricino", start: 300 }, queued: null });
});

test("startAnim: un'animazione finita conta come assente", () => {
  const p = { anim: { name: "mangia", start: 0 }, queued: null };
  assert.deepEqual(plain(animScript().startAnim(p, "lacrima", 1000)), { anim: { name: "lacrima", start: 1000 }, queued: null });
});

test("advanceAnim: in corso resta lo stesso oggetto, alla fine parte la coda o si svuota", () => {
  const { advanceAnim } = animScript();
  const p = { anim: { name: "mangia", start: 0 }, queued: "lacrima" };
  assert.equal(advanceAnim(p, 999), p);
  assert.equal(advanceAnim(E, 5), E);
  assert.deepEqual(plain(advanceAnim(p, 1000)), { anim: { name: "lacrima", start: 1000 }, queued: null });
  assert.deepEqual(plain(advanceAnim({ anim: { name: "mangia", start: 0 }, queued: null }, 1000)), E);
});

test("cure animate: a 100 e a 400 ms la scena cambia (mangia, gioca, lava)", () => {
  const { ANIMATIONS: A } = animScript();
  for (const n of ["mangia", "gioca", "lava"]) {
    const a = fakeCtx(), b = fakeCtx();
    A[n].draw(a, 100, "felice");
    A[n].draw(b, 400, "felice");
    assert.notDeepEqual(a.calls, b.calls, n);
  }
});

test("riposa resta come oggi: a 100 e a 400 ms la scena è uguale", () => {
  const { ANIMATIONS: A } = animScript();
  const a = fakeCtx(), b = fakeCtx();
  A.riposa.draw(a, 100, "felice");
  A.riposa.draw(b, 400, "felice");
  assert.deepEqual(a.calls, b.calls);
});

test("sprite: cure", () => {
  const { SPRITES } = animScript();
  assertSprite("ciboPiccolo", SPRITES.ciboPiccolo, 4, 4);
  assertSprite("scintilla", SPRITES.scintilla, 3, 3);
  for (const n of ["affamata", "bocconeChiuso", "bocconeO", "doccia"]) assertSprite(n, SPRITES[n], 16, 16);
});

test("drawSprite: maxY non disegna le righe sotto quella quota", () => {
  const { drawSprite } = animScript();
  const ctx = fakeCtx();
  drawSprite(ctx, ["#", "#", "#"], 0, 0, 1);
  assert.equal(ctx.calls.length, 2);
});

test("ANIMATIONS: nascita dura 1,5 s e disegna per tutta la durata", () => {
  const { ANIMATIONS: A } = animScript();
  assert.equal(A.nascita.kind, "nascita");
  assert.equal(A.nascita.ms, 1500);
  assertDraws(A, "nascita");
});

test("sprite: uovo grande e crepato", () => {
  const { SPRITES } = animScript();
  assertSprite("uovoGrande", SPRITES.uovoGrande, 12, 13);
  assertSprite("uovoCrepato", SPRITES.uovoCrepato, 12, 13);
});
