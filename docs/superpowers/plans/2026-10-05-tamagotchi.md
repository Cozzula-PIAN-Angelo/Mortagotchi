# Tamagotchi con Magnum — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un'app web in un solo file `index.html` che simula un Tamagotchi in pixel art destinato a finire sempre con la .44 Magnum.

**Architecture:** `index.html` contiene tre blocchi: logica pura in `<script id="logic">` (nessun DOM, stato immutabile), sprite + renderer canvas, interfaccia + salvataggio in `localStorage`. `test.js` estrae il blocco logic e lo esegue in un contesto `node:vm` con `node:test`.

**Tech Stack:** HTML/CSS/JS vanilla, `<canvas>`, Node 24 (`node:test`, `node:assert/strict`, `node:vm`, `node:fs`) solo per i test. Nessuna dipendenza.

**Spec:** `docs/superpowers/specs/2026-10-05-tamagotchi-design.md`

## Global Constraints

- Un solo file di gioco: `index.html`, apribile con doppio clic, nessuna risorsa esterna (niente CDN, font, immagini, audio).
- Testo dell'interfaccia in italiano.
- Statistiche: chiavi `fame`, `felicita`, `energia`, `pulizia`; valori 0..100; nascita a 100.
- Azioni: `mangia`→`fame`, `gioca`→`felicita`, `riposa`→`energia`, `lava`→`pulizia`; +30, mai oltre `cap`.
- Difficoltà: `facile` 3600 s, `normale` 720 s, `difficile` 300 s (`L`).
- Calo per secondo: statistiche `100 / L`, tetto `70 / L`, entrambi con minimo 0.
- Un singolo `tick` conta al massimo 60 secondi.
- Condizione obbligatoria: tutte le statistiche `< 30`.
- Umore: `felice` se tutte ≥ 50, `agonizzante` se condizione obbligatoria, altrimenti `triste`.
- Chiave di salvataggio: `tamagotchi-save`. Salvataggio assente/non valido → `newPet("normale")`.
- Nessun audio.
- Test: `node test.js`, zero dipendenze.

## Review Focus

1. Salvataggio corrotto, vecchio o manomesso in `localStorage` (JSON rotto, campi mancanti, valori fuori range, difficoltà sconosciuta) → nasce una nuova creatura Normale, nessun crash. *(test in Task 3)*
2. Salti di tempo (computer in sospensione, orologio spostato indietro) → `tick` con secondi negativi non fa nulla, oltre 60 conta 60. *(test in Task 1)*
3. Click ripetuti durante un'animazione, dopo la morte o durante la sequenza di sparo → ignorati, nessun doppio effetto. *(test logico in Task 2: `act`/`shoot` su creatura morta non cambiano nulla; blocco UI verificato in Task 4 e 6)*
4. Cambio difficoltà a metà partita o da morta → statistiche e tetto restano uguali, cambia solo la velocità successiva; la nuova creatura usa la difficoltà selezionata. *(test in Task 1)*
5. Valori esattamente sul confine (statistica = 30, = 50, = tetto) → 30 non è obbligatorio, 50 è felice, `act` sul tetto non lo supera. *(test in Task 2)*

---

### Task 1: Scheletro, harness di test, stato e tempo

**Files:**
- Create: `index.html`
- Create: `test.js`

**Interfaces:**
- Produces (globali in `<script id="logic">`):
  - `LIFESPAN = { facile: 3600, normale: 720, difficile: 300 }`
  - `STAT_KEYS = ["fame", "felicita", "energia", "pulizia"]`
  - `MAX_TICK_SECONDS = 60`
  - `newPet(difficulty: string) -> State` dove `State = { stats: {fame, felicita, energia, pulizia}, cap: number, difficulty: string, alive: boolean }`
  - `tick(state: State, seconds: number) -> State` (nuovo oggetto; non muta l'input)
  - `setDifficulty(state: State, difficulty: string) -> State`
- Produces (test.js): helper `loadLogic() -> object` con le funzioni/costanti del blocco logic.

- [ ] **Step 1: Crea `index.html` minimo**

`<!doctype html>`, `lang="it"`, `<meta charset="utf-8">`, viewport, `<title>Tamagotchi</title>`, e un `<script id="logic">` vuoto. Le funzioni del blocco logic sono dichiarazioni `function` / `const` a livello top, senza `export` e senza accesso a `document`/`window`.

- [ ] **Step 2: Scrivi `test.js` con l'harness e i test falliti**

`loadLogic()`: legge `index.html` con `fs.readFileSync(path.join(__dirname, "index.html"), "utf8")`, estrae il contenuto con `/<script id="logic">([\s\S]*?)<\/script>/`, lo esegue con `vm.runInContext(code + "\n;({LIFESPAN, STAT_KEYS, MAX_TICK_SECONDS, newPet, tick, setDifficulty})", vm.createContext({}))` e restituisce l'oggetto. Le task successive aggiungono nomi a questa lista.

Usa `const { test } = require("node:test")` e `const assert = require("node:assert/strict")`. Test:

```js
test("newPet: tutto a 100, viva, difficoltà data", () => {
  const p = newPet("difficile");
  assert.deepEqual({ ...p.stats }, { fame: 100, felicita: 100, energia: 100, pulizia: 100 });
  assert.equal(p.cap, 100); assert.equal(p.alive, true); assert.equal(p.difficulty, "difficile");
});
test("tick: a normale, 72 s tolgono 10 alle statistiche e 7 al tetto", () => {
  const p = tick(newPet("normale"), 60); const q = tick(p, 12);
  assert.ok(Math.abs(q.stats.fame - 90) < 1e-9); assert.ok(Math.abs(q.cap - 93) < 1e-9);
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
  let p = newPet("difficile"); for (let i = 0; i < 20; i++) p = tick(p, 60);
  assert.equal(p.cap, 0); for (const k of STAT_KEYS) assert.equal(p.stats[k], 0);
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
  const p = newPet("normale"); tick(p, 60); assert.equal(p.stats.fame, 100);
  const dead = { ...p, alive: false }; assert.deepEqual(tick(dead, 60), dead);
});
test("setDifficulty: cambia solo la velocità successiva", () => {
  const p = tick(newPet("facile"), 60); const q = setDifficulty(p, "difficile");
  assert.deepEqual(q.stats, p.stats); assert.equal(q.cap, p.cap); assert.equal(q.difficulty, "difficile");
  assert.ok(Math.abs((p.stats.fame - tick(q, 3).stats.fame) - 1) < 1e-9); // 3 s * 100/300
});
test("setDifficulty: funziona anche da morta", () => {
  const dead = { ...newPet("facile"), alive: false };
  assert.equal(setDifficulty(dead, "difficile").difficulty, "difficile");
});
```

(Destruttura le funzioni da `loadLogic()` in cima al file. Poiché `deepEqual` di `node:assert/strict` confronta i prototipi e gli oggetti arrivano da un altro contesto vm, confronta con `{ ...p.stats }` / `JSON.parse(JSON.stringify(x))` dove serve.)

- [ ] **Step 3: Verifica che falliscano**

Run: `node test.js`
Expected: FAIL (`newPet is not defined` o simile).

- [ ] **Step 4: Implementa costanti, `newPet`, `tick`, `setDifficulty` nel blocco logic**

`tick`: se `!state.alive` restituisce `state`; `s = Math.min(Math.max(seconds, 0), MAX_TICK_SECONDS)`; se `s === 0` restituisce `state`; `L = LIFESPAN[state.difficulty]`; `cap = max(0, cap - 70*s/L)`; ogni statistica `= min(cap, max(0, stat - 100*s/L))`.

- [ ] **Step 5: Verifica che passino**

Run: `node test.js`
Expected: tutti i test `ok`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add index.html test.js
git commit -m "Aggiunge stato, tempo e harness di test"
```

---

### Task 2: Azioni, condizione obbligatoria, umore, sparo

**Files:**
- Modify: `index.html` (blocco logic)
- Modify: `test.js`

**Interfaces:**
- Consumes: `newPet`, `tick`, `LIFESPAN`, `STAT_KEYS` (Task 1).
- Produces:
  - `ACTION_STAT = { mangia: "fame", gioca: "felicita", riposa: "energia", lava: "pulizia" }`
  - `ACTION_BOOST = 30`, `FORCED_THRESHOLD = 30`
  - `isForced(state) -> boolean`
  - `act(state, action: "mangia"|"gioca"|"riposa"|"lava") -> State`
  - `mood(state) -> "felice"|"triste"|"agonizzante"`
  - `shoot(state) -> State`

- [ ] **Step 1: Aggiungi i nuovi nomi alla lista di `loadLogic()` e scrivi i test**

Helper di test: `withStats(p, obj)` restituisce `{ ...p, stats: { ...p.stats, ...obj } }`.

```js
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
  const p = newPet("normale"); const d = shoot(p);
  assert.equal(d.alive, false); assert.equal(p.alive, true);
  assert.deepEqual(shoot(d), d);
});
test("fine inevitabile: con cure perfette ogni secondo, obbligatoria entro L+1 s", () => {
  for (const d of ["facile", "normale", "difficile"]) {
    let p = newPet(d), t = 0;
    while (!isForced(p)) {
      for (const a of Object.keys(ACTION_STAT)) p = act(p, a);
      p = tick(p, 1); t++;
      assert.ok(t <= LIFESPAN[d] + 1, d + " ancora viva a " + t);
    }
  }
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `node test.js`
Expected: FAIL sui nuovi test (`act is not defined`).

- [ ] **Step 3: Implementa le costanti e le quattro funzioni**

`act` restituisce `state` invariato se `!state.alive || isForced(state)`. `shoot` restituisce `state` se già morta. Tutte restituiscono nuovi oggetti.

- [ ] **Step 4: Verifica che passino**

Run: `node test.js`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add index.html test.js
git commit -m "Aggiunge azioni, magnum obbligatoria, umore e sparo"
```

---

### Task 3: Serializzazione del salvataggio

**Files:**
- Modify: `index.html` (blocco logic)
- Modify: `test.js`

**Interfaces:**
- Consumes: `newPet`, `LIFESPAN`, `STAT_KEYS`.
- Produces:
  - `SAVE_KEY = "tamagotchi-save"`
  - `serialize(state) -> string` (JSON)
  - `parseSave(text: string|null) -> State` — restituisce lo stato salvato se valido, altrimenti `newPet("normale")`. Mai eccezioni.

Valido = oggetto con `stats` contenente tutte e 4 le chiavi come numeri finiti in 0..100, `cap` numero finito in 0..100, `difficulty` chiave di `LIFESPAN`, `alive` booleano. Il risultato contiene solo questi campi (ignora quelli extra) e ogni statistica è riportata a `min(stat, cap)`.

- [ ] **Step 1: Scrivi i test**

```js
test("parseSave: andata e ritorno", () => {
  const p = shoot(tick(newPet("facile"), 45));
  assert.deepEqual(plain(parseSave(serialize(p))), plain(p));
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
```

(`plain = x => JSON.parse(JSON.stringify(x))`; aggiungi `SAVE_KEY, serialize, parseSave` alla lista di `loadLogic()`.)

- [ ] **Step 2: Verifica che falliscano**

Run: `node test.js` — Expected: FAIL (`parseSave is not defined`).

- [ ] **Step 3: Implementa `SAVE_KEY`, `serialize`, `parseSave`**

`parseSave` avvolge `JSON.parse` in `try/catch`.

- [ ] **Step 4: Verifica che passino**

Run: `node test.js` — Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add index.html test.js
git commit -m "Aggiunge salvataggio validato"
```

---

### Task 4: Interfaccia (senza grafica della creatura)

**Files:**
- Modify: `index.html` (markup, `<style>`, nuovo `<script id="ui">` dopo il blocco logic)

**Interfaces:**
- Consumes: tutto il blocco logic (Task 1–3).
- Produces (globali in `<script id="ui">`, usati da Task 5–6):
  - `let state` — stato corrente
  - `let busyUntil = 0` — `performance.now()` fino a cui i pulsanti azione sono bloccati
  - `let currentAction = null` — `"mangia"|"gioca"|"riposa"|"lava"|null`, azione in animazione
  - `render()` — aggiorna tutto il DOM da `state`
  - `save()` — `try { localStorage.setItem(SAVE_KEY, serialize(state)) } catch {}`
  - `onShoot()` — gestore del pulsante Magnum (Task 6 lo estende con la sequenza)
  - `<canvas id="lcd">` presente nel markup (Task 5 lo disegna)

Layout come da schermata della spec:

- in alto, selettore con tre pulsanti `Facile` / `Normale` / `Difficile` (quello attivo evidenziato, `aria-pressed`);
- `<canvas id="lcd" width="288" height="192">` dentro una cornice tipo Tamagotchi; sfondo LCD `#9bbc0f`-ish verde-grigio, pixel `#0f380f`-ish;
- quattro barre etichettate `🍖 Fame`, `🎾 Felicità`, `💤 Energia`, `🧼 Pulizia`: riempimento = statistica %, tacca verticale = `cap` %;
- avviso `Non c'è più niente da fare…` visibile solo se `isForced(state)` e viva;
- pulsanti `Mangia`, `Gioca`, `Riposa`, `Lava` (disattivati se `isForced`, se morta o se `performance.now() < busyUntil`);
- pulsante `🔫 MAGNUM` (visibile da viva; classe che lo fa lampeggiare via CSS `@keyframes` quando `isForced`);
- pulsante `Nuova creatura` visibile solo da morta: `state = newPet(state.difficulty)`.
- Layout centrato, utilizzabile su telefono (larghezza max ~360px, canvas scalato con `max-width: 100%` e `image-rendering: pixelated`).

Comportamento:

- Avvio: `state = parseSave(readSave())` con `readSave` che legge `localStorage` in `try/catch` (null in caso di errore).
- Timer: `setInterval` ogni 1000 ms; `elapsed = (now - last) / 1000` con `Date.now()`; `state = tick(state, elapsed)`; `render(); save()`.
- Pulsante azione: se bloccato non fa nulla; altrimenti `state = act(state, a)`, `currentAction = a`, `busyUntil = performance.now() + 1000`, `render(); save()`; dopo 1000 ms `currentAction = null; render()`.
- Selettore: `state = setDifficulty(state, d)`, `render(); save()`.
- `onShoot()` per ora: `state = shoot(state); render(); save()`.

- [ ] **Step 1: Implementa markup, stile e `<script id="ui">` come sopra**

- [ ] **Step 2: Verifica che i test logici passino ancora**

Run: `node test.js` — Expected: `# fail 0`.

- [ ] **Step 3: Verifica a mano nel browser**

Apri `index.html`. Controlla, con la difficoltà Difficile:
- le barre scendono e la tacca del tetto si sposta a sinistra;
- `Mangia` alza la barra Fame, i 4 pulsanti si bloccano per ~1 s, click ripetuti in quel secondo non fanno nulla;
- ricaricando la pagina i valori sono quelli di prima;
- in DevTools, `localStorage.setItem("tamagotchi-save", "{rotto")` e ricarica → creatura nuova a Normale, nessun errore in console;
- aspettando ~3,5 min senza cure compare l'avviso, i 4 pulsanti sono grigi, la Magnum lampeggia;
- Magnum → compare `Nuova creatura`, spariscono gli altri pulsanti; ricarica → resta morta; `Nuova creatura` → riparte a 100.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Aggiunge interfaccia, timer e salvataggio nel browser"
```

---

### Task 5: Pixel art della creatura e delle azioni

**Files:**
- Modify: `index.html` (nuovo `<script id="sprites">` tra logic e ui; aggancio nel blocco ui)

**Interfaces:**
- Consumes: `state`, `currentAction`, `mood` (Task 2/4), `<canvas id="lcd">`.
- Produces:
  - `PX = 6` (dimensione di un pixel logico; canvas logico 48×32)
  - `SPRITES` — oggetto di sprite, ognuno un array di stringhe uguali in lunghezza (`#` = pixel acceso, `.` = spento):
    - `felice: [frameA, frameB]`, `triste: [frameA, frameB]`, `agonizzante: [frameA, frameB]` — 16×16
    - `cibo`, `palla`, `zzz`, `bolle` — 8×8
    - `lapide` — 16×16 (usata in Task 6)
  - `drawSprite(ctx, sprite: string[], x: number, y: number)` — `x, y` in pixel logici
  - `clearLcd(ctx)` — riempie col colore di sfondo LCD
  - `drawScene(now: number)` — disegna la scena corrente; chiamata da un ciclo `requestAnimationFrame`

Scena: creatura centrata (x 16, y 8); frame = `Math.floor(now / 500) % 2`; se `currentAction` disegna il relativo oggetto 8×8 a destra della creatura (x 34, y 12); da morta disegna `lapide` al posto della creatura. Le tre facce devono essere distinguibili a colpo d'occhio (bocca su/giù, occhi a X o chiusi per agonizzante). Stile semplice, nessun antialiasing (`ctx.imageSmoothingEnabled = false`).

- [ ] **Step 1: Aggiungi a `test.js` un test di forma degli sprite**

Estendi l'harness con `loadScript(id)` (stessa regex con l'id parametrico). Test: per ogni sprite in `SPRITES` (appiattendo gli array di frame), tutte le righe hanno la stessa lunghezza, contengono solo `#` e `.`, e le dimensioni sono 16×16 per creature e `lapide`, 8×8 per `cibo`, `palla`, `zzz`, `bolle`. Lo script sprites non deve toccare il DOM al caricamento (le funzioni di disegno ricevono `ctx`).

- [ ] **Step 2: Verifica che fallisca**

Run: `node test.js` — Expected: FAIL (blocco `sprites` assente).

- [ ] **Step 3: Disegna gli sprite e implementa `drawSprite`, `clearLcd`, `drawScene`; avvia il ciclo `requestAnimationFrame` dal blocco ui**

- [ ] **Step 4: Verifica che i test passino**

Run: `node test.js` — Expected: `# fail 0`.

- [ ] **Step 5: Verifica a mano nel browser**

La creatura "respira" (2 frame alternati); passa da felice a triste quando una barra scende sotto il 50%; agonizzante quando compare l'avviso; ogni azione mostra il suo oggetto per ~1 s; da morta c'è la lapide.

- [ ] **Step 6: Commit**

```bash
git add index.html test.js
git commit -m "Aggiunge pixel art della creatura e delle azioni"
```

---

### Task 6: Sequenza della Magnum

**Files:**
- Modify: `index.html` (blocchi sprites e ui)
- Modify: `test.js`

**Interfaces:**
- Consumes: `SPRITES`, `drawSprite`, `drawScene`, `onShoot`, `state`, `shoot`, `save`, `render`.
- Produces:
  - `SPRITES.magnum` — 16 colonne × 10 righe, revolver a canna lunga visto di lato, canna verso sinistra
  - `SPRITES.bang` — scritta "BANG!" leggibile, al massimo 32×8
  - `let shotStart = null` — `performance.now()` dell'inizio sequenza, `null` se nessuna sequenza

Sequenza (tempi da `shotStart`):

| Tempo | Scena |
|-------|-------|
| 0–1000 ms | creatura (umore attuale) + Magnum che scorre da fuori schermo a destra fino a x 32, y 10 |
| 1000–1200 ms | schermo pieno del colore pixel (lampo) |
| 1200–2200 ms | lapide + `bang` in alto |
| ≥ 2200 ms | lapide (stato morto normale), `shotStart = null` |

`onShoot()`: se `shotStart !== null` o `!state.alive` non fa nulla; altrimenti `state = shoot(state); save(); shotStart = performance.now()`. Durante la sequenza (`shotStart !== null`) tutti i pulsanti sono nascosti o disattivati, `Nuova creatura` compreso; `render()` va richiamata a fine sequenza. Ricaricare durante la sequenza mostra direttamente la lapide (lo stato è già salvato come morto).

- [ ] **Step 1: Estendi il test di forma degli sprite**

`magnum` 16×10, `bang` larghezza ≤ 32 e altezza ≤ 8, solo `#`/`.`, righe di lunghezza uguale.

- [ ] **Step 2: Verifica che fallisca**

Run: `node test.js` — Expected: FAIL (`magnum` assente).

- [ ] **Step 3: Disegna `magnum` e `bang`, implementa la sequenza in `drawScene` e `onShoot`**

- [ ] **Step 4: Verifica che i test passino**

Run: `node test.js` — Expected: `# fail 0`.

- [ ] **Step 5: Verifica a mano nel browser**

- Magnum da creatura felice: la pistola entra, lampo, "BANG!", lapide, poi `Nuova creatura`.
- Doppio clic veloce sulla Magnum: una sola sequenza.
- Click su `Nuova creatura` durante la sequenza: impossibile.
- Ricarica a metà sequenza: lapide.
- Lasciala arrivare alla condizione obbligatoria a Difficile e spara: stessa sequenza partendo dalla faccia agonizzante.

- [ ] **Step 6: Commit**

```bash
git add index.html test.js
git commit -m "Aggiunge la sequenza della Magnum"
```
