# Animazioni uniche: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dare a Mortagotchi animazioni proprie per le cure mangia, gioca e lava, per la nascita dall'uovo e per i tre cambi d'umore, gestite da un'unica animazione in corso con priorità.

**Architecture:** La logica guadagna `reactionFor`. Lo script degli sprite guadagna il registro `ANIMATIONS`, le priorità e due funzioni pure (`startAnim`, `advanceAnim`) che decidono quale animazione è in corso. L'interfaccia sostituisce `currentAction` e `shotStart` con un unico `player` e fa partire le reazioni confrontando l'umore con `shownMood`.

**Tech Stack:** HTML/CSS/JS vanilla in un unico `index.html` con `<canvas>`. I test usano Node 24 (`node:test`, `node:assert/strict`, `node:vm`), senza dipendenze.

**Spec:** `docs/superpowers/specs/2026-10-06-animazioni-design.md`. Le bozze animate di riferimento sono in `docs/superpowers/specs/2026-10-06-animazioni-bozze/` (`cure.html`, `nascita.html`, `umore.html`).

## Global Constraints

- Un solo file di gioco, `index.html`, senza risorse esterne. Test con `node test.js`, senza dipendenze.
- Schermo logico 48×32 (`PX = 6`), colori `LCD_BG` / `LCD_INK`, creatura 16×16 in (16, 8).
- Durate: cure 1000 ms (`ACTION_MS` invariato), `nascita` 1500 ms, reazioni 1000 ms, `sparo` 2200 ms (`SHOT_END_MS`).
- Priorità: `sparo` 4, `nascita` 3, `cura` 2, `reazione` 1.
- Reazioni: diventa `triste` → `lacrima`, torna `felice` → `cuoricino`, diventa `agonizzante` → `teschio`.
- Il sonno è escluso: `riposa` resta com'è oggi, cioè faccia dell'umore che respira più l'icona `zzz` ferma in (34, 12).
- Sprite come array di stringhe di "#" e ".". Commenti e nomi in italiano, nello stile del file.
- Ogni `draw` deve funzionare anche con `t` leggermente negativo, perché il frame può iniziare poco prima del clic.
- I valori delle animazioni (sprite, coordinate, tempi) si portano dalle bozze scelte. Le bozze disegnano lo sfondo da sole con `clear(ctx)`: nel gioco lo fa già `drawScene`, quindi quella chiamata va tolta. Il loro `draw(ctx, s, x, y)` diventa `drawSprite(ctx, s, x, y)`.

## Review Focus

1. **Creatura uccisa in un'altra scheda durante una cura o una reazione.** Questa scheda deve mostrare subito la lapide, senza finire l'animazione e senza reazioni in coda. *(verifica a mano nel Task 3)*
2. **Pagina aperta con una creatura salvata già triste o agonizzante, oppure stato arrivato da un'altra scheda.** Non deve partire nessuna reazione. *(verifica a mano nel Task 3)*
3. **Ritorno dopo molto tempo in background.** Al massimo una reazione, nessuna animazione vecchia ripresa a metà. *(test "un'animazione finita conta come assente" nel Task 2)*
4. **Tasti delle cure dopo la fine di una cura.** Devono tornare attivi senza aspettare il tick successivo. *(verifica a mano nel Task 3)*
5. **Doppio clic sull'uovo, o clic durante la nascita.** Una sola nascita, e Magnum e cure non sono cliccabili per 1,5 s. *(verifica a mano nel Task 5)*

---

### Task 1: `reactionFor` nella logica

**Files:**
- Modify: `index.html` (`<script id="logic">`, subito dopo `mood`)
- Test: `test.js`

**Interfaces:**
- Produces: `REACTION = { triste: "lacrima", felice: "cuoricino", agonizzante: "teschio" }`, `reactionFor(prima: string, dopo: string): string | null`

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi `REACTION, reactionFor` alla lista di `loadLogic()` (riga 12) e alla destrutturazione (riga 17), poi:

```js
test("reactionFor: una reazione per ogni cambio d'umore, nessuna se resta uguale", () => {
  for (const m of ["felice", "triste", "agonizzante"]) assert.equal(reactionFor(m, m), null, m);
  assert.equal(reactionFor("felice", "triste"), "lacrima");
  assert.equal(reactionFor("triste", "felice"), "cuoricino");
  assert.equal(reactionFor("triste", "agonizzante"), "teschio");
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `node test.js`
Expected: FAIL, `REACTION is not defined`

- [ ] **Step 3: Implementa `REACTION` e `reactionFor(prima, dopo)`**

Restituisce `null` se `prima === dopo`, altrimenti `REACTION[dopo]`.

- [ ] **Step 4: Verifica che passi**

Run: `node test.js`
Expected: tutti i test passano

- [ ] **Step 5: Commit**

```bash
git add index.html test.js
git commit -m "Aggiunge reactionFor: quale reazione per ogni cambio d'umore"
```

---

### Task 2: registro delle animazioni, priorità e reazioni

**Files:**
- Modify: `index.html` (`<script id="sprites">`, sprite nuovi in `SPRITES`, il resto tra `drawShot` e `drawScene`)
- Test: `test.js`

**Interfaces:**
- Consumes: `drawSprite`, `drawShot`, `SHOT_END_MS`, `ACTION_SPRITE`, `SPRITES`
- Produces:
  - `ANIMATIONS: { [nome]: { kind: "sparo" | "nascita" | "cura" | "reazione", ms: number, draw(ctx, t, umore) } }`. Dopo questo task contiene `sparo`, `mangia`, `gioca`, `lava`, `riposa`, `lacrima`, `cuoricino`, `teschio`.
  - `ANIM_PRIORITY = { sparo: 4, nascita: 3, cura: 2, reazione: 1 }`
  - `startAnim(player, name, now) -> player` e `advanceAnim(player, now) -> player`, dove `player` è `{ anim: { name, start } | null, queued: string | null }`.
  - Gli sprite nuovi `SPRITES.afflitta` (triste senza lacrima, 16×16), `SPRITES.gioia` (occhi a ^ ^ e sorriso, 16×16), `SPRITES.cuore` (5×5), `SPRITES.teschio` (7×6) e `SPRITES.fumetto` (13×10).

- [ ] **Step 1: Scrivi i test che falliscono**

```js
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
```

`plain` serve perché gli oggetti creati nel contesto `vm` hanno un altro prototipo e `deepEqual` stretto li rifiuterebbe.

- [ ] **Step 2: Verifica che falliscano**

Run: `node test.js`
Expected: i nuovi test falliscono, `ANIMATIONS is not defined`

- [ ] **Step 3: Aggiungi gli sprite delle reazioni a `SPRITES`**

Componi `afflitta` e `gioia` con `overlay(BODY, …)`. Prendi le parti da `umore.html`: per `afflitta` `EYES` e `FROWN`, per `gioia` `EYES_HAPPY` e `SMILE`. Copia `cuore`, `teschio` e `fumetto` da `HEART`, `SKULL` e `BUBBLE` della stessa bozza. Se le facce di oggi (`felice`, `triste`) hanno parti uguali, estraile in costanti condivise.

- [ ] **Step 4: Implementa `ANIMATIONS` e `ANIM_PRIORITY`**

- `sparo`: `{ kind: "sparo", ms: SHOT_END_MS, draw: (ctx, t) => drawShot(ctx, t) }`.
- `mangia`, `gioca`, `lava`, `riposa`: per ora sono tutte come oggi. Disegnano `SPRITES[umore][Math.floor(Math.max(0, t) / 500) % 2]` in (16, 8) e `SPRITES[ACTION_SPRITE[nome]]` in (34, 12). Il `Math.max` evita l'indice −1 con `t` negativo. `mangia`, `gioca` e `lava` vengono sostituite nel Task 4.
- `lacrima`, `cuoricino`, `teschio`: porta `tristeA`, `feliceB` e `agoniaB` da `umore.html`, cioè solo la funzione della reazione. Il teschio usa `SPRITES.agonizzante[0]`.

- [ ] **Step 5: Implementa `startAnim(player, name, now)` e `advanceAnim(player, now)`**

```js
// L'animazione in corso, oppure null se non c'è o è già finita.
const running = (p, now) => (p.anim && now - p.anim.start < ANIMATIONS[p.anim.name].ms ? p.anim : null);

function startAnim(player, name, now) {
  const cur = running(player, now);
  const kind = ANIMATIONS[name].kind;
  if (cur && ANIM_PRIORITY[kind] < ANIM_PRIORITY[ANIMATIONS[cur.name].kind]) {
    return { anim: cur, queued: kind === "reazione" ? name : player.queued };
  }
  return { anim: { name, start: now }, queued: kind === "sparo" || kind === "reazione" ? null : player.queued };
}
```

`advanceAnim` restituisce lo **stesso** `player` se non c'è un'animazione o se è ancora in corso. Altrimenti restituisce `{ anim: { name: queued, start: now }, queued: null }` se c'è una coda, oppure `{ anim: null, queued: null }`.

- [ ] **Step 6: Verifica che passino**

Run: `node test.js`
Expected: tutti i test passano. Il gioco non usa ancora niente di nuovo.

- [ ] **Step 7: Commit**

```bash
git add index.html test.js
git commit -m "Registro delle animazioni, priorità e reazioni all'umore"
```

---

### Task 3: l'interfaccia usa `player` e fa partire le reazioni

**Files:**
- Modify: `index.html` (`drawScene` nello script `sprites`; script `ui`)

**Interfaces:**
- Consumes: `startAnim`, `advanceAnim`, `ANIMATIONS` (Task 2), `reactionFor` (Task 1), `mood`
- Produces: le variabili `player` e `shownMood` nello script `ui`, lette da `drawScene`

Questo task tocca solo DOM e timer, quindi non ha test automatici nuovi. Si verifica con la suite, che resta verde, e a mano in Chrome.

- [ ] **Step 1: Sostituisci `currentAction` e `shotStart` con `player`**

- In `ui`: `let player = { anim: null, queued: null };` e `let shownMood = mood(state);`. Via `currentAction`, `shotStart` e il `setTimeout` della cura.
- `function checkMood(now)`: se la creatura è viva, calcola `reactionFor(shownMood, mood(state))`, aggiorna `shownMood` e, se la reazione c'è, fa `player = startAnim(player, reazione, now)`.
- Clic su una cura: `const t0 = performance.now()`, poi `state = act(...)`, `player = startAnim(player, azione, t0)`, `busyUntil = t0 + ACTION_MS`, `checkMood(t0)`, `render()`, `save()`. Usa lo stesso `t0` in tutti i punti, così i tasti tornano attivi proprio quando la cura finisce.
- `onShoot`: esce se `!state.alive`, altrimenti `state = shoot(state)`, `save()`, `player = startAnim(player, "sparo", performance.now())` e `render()`.
- `setInterval` del tick: dopo `tick`, `checkMood(performance.now())`.
- Evento `storage`: dopo `parseSave`, `shownMood = mood(state)`. Se la creatura è morta, `player = { anim: null, queued: null }`.
- `render()`: `el.reborn.hidden = state.alive || (player.anim !== null && player.anim.name === "sparo")`.

- [ ] **Step 2: Riscrivi `drawScene(ctx, now)`**

Dopo `clearLcd`:
1. `const next = advanceAnim(player, now)`. Se `next !== player`, assegna `player = next` e chiama `render()`.
2. Se c'è `player.anim`, chiama `ANIMATIONS[player.anim.name].draw(ctx, now - player.anim.start, mood(state))` ed esci.
3. Altrimenti disegna la lapide se la creatura è morta, o la faccia dell'umore che respira, come oggi.

Aggiorna il commento sopra `drawScene`: ora legge `state` e `player`.

- [ ] **Step 3: Verifica che la suite passi**

Run: `node test.js`
Expected: tutti i test passano

- [ ] **Step 4: Verifica a mano in Chrome**

Apri `index.html` su Difficile e controlla:
- Le cure si vedono come oggi e i tasti tornano attivi appena finisce la cura (Review Focus 4).
- Aspettando senza curarla, a una statistica sotto 50 parte la lacrima. Curandola finché torna felice, parte il cuoricino **dopo** l'animazione della cura.
- A tutte sotto 30 parte il teschio e la Magnum lampeggia.
- Uno sparo durante una cura parte subito, poi compaiono lapide e uovo.
- Ricaricando la pagina con la creatura triste, non parte nessuna reazione (Review Focus 2).
- Con due schede aperte, sparare in una mentre l'altra mostra una cura o una reazione: la seconda mostra subito la lapide, senza reazioni (Review Focus 1).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Un'unica animazione in corso con priorità e reazioni ai cambi d'umore"
```

---

### Task 4: animazioni di mangia, gioca e lava

**Files:**
- Modify: `index.html` (`<script id="sprites">`)
- Test: `test.js`

**Interfaces:**
- Consumes: `ANIMATIONS`, `SPRITES.gioia`, `SPRITES.felice`, `SPRITES.palla` (Task 2 e già esistenti)
- Produces: `SPRITES.ciboPiccolo` (4×4), `SPRITES.scintilla` (3×3), facce 16×16 `SPRITES.affamata` (occhi in alto e bocca aperta), `SPRITES.bocconeChiuso` (occhi a ^ ^ e bocca chiusa), `SPRITES.bocconeO` (occhi a ^ ^ e bocca a "o"), `SPRITES.doccia` (occhi chiusi e sorriso). Il Task 5 usa `scintilla`.

- [ ] **Step 1: Scrivi i test che falliscono**

```js
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
```

- [ ] **Step 2: Verifica che falliscano**

Run: `node test.js`
Expected: "cure animate" fallisce su `mangia`, perché le cure di oggi tra 100 e 400 ms disegnano lo stesso frame. "sprite: cure" fallisce perché gli sprite non esistono. "riposa" passa già.

- [ ] **Step 3: Aggiungi gli sprite**

Prendili da `cure.html`: `ciboPiccolo` da `MINI_CIBO`, `scintilla` da `SPARK`, le facce da `EYES_UP`, `OPEN`, `EYES_HAPPY`, `CHEW`, `SMALL_O`, `EYES_CLOSED` e `SMILE`.

- [ ] **Step 4: Sostituisci `draw` di `mangia`, `gioca` e `lava`**

Porta `mangiaB`, `giocaB` e `lavaB` da `cure.html`, con gli stessi tempi e le stesse coordinate. Il parametro `umore` non serve.

- [ ] **Step 5: Verifica che passino**

Run: `node test.js`
Expected: tutti i test passano

- [ ] **Step 6: Verifica a mano in Chrome**

Le tre cure corrispondono alle bozze scelte (*Al volo*, *Calcio*, *Doccia*). Zzz è come prima.

- [ ] **Step 7: Commit**

```bash
git add index.html test.js
git commit -m "Animazioni di mangia (al volo), gioca (calcio) e lava (doccia)"
```

---

### Task 5: nascita dalla tomba

**Files:**
- Modify: `index.html` (`drawSprite`, `SPRITES` e `ANIMATIONS` nello script `sprites`; clic sull'uovo e `render()` nello script `ui`)
- Test: `test.js`

**Interfaces:**
- Consumes: `startAnim`, `player`, `shownMood` (Task 2 e 3), `SPRITES.scintilla`, `SPRITES.gioia`, `SPRITES.lapide`
- Produces: `drawSprite(ctx, sprite, x, y, maxY = Infinity)`, `SPRITES.uovoGrande` (12×13), `SPRITES.uovoCrepato` (12×13; righe 0–6 metà alta, righe 7–12 metà bassa), `ANIMATIONS.nascita`

- [ ] **Step 1: Scrivi i test che falliscono**

```js
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
```

- [ ] **Step 2: Verifica che falliscano**

Run: `node test.js`
Expected: i tre test nuovi falliscono (`calls.length` vale 3, `A.nascita` è undefined, gli sprite mancano)

- [ ] **Step 3: Implementa `maxY`, gli sprite e `ANIMATIONS.nascita`**

- `drawSprite` disegna la riga `r` solo se `y + r <= maxY`.
- Gli sprite vengono da `nascita.html`: `uovoGrande` da `UOVO`, `uovoCrepato` da `CREPA`.
- `nascita` porta `ANIMS.tomba` e `hatch` senza l'opzione `hat`, con `EGG_X = 18`, `EGG_Y = 10` e `GROUND = 23`. La linea del terreno tratteggiata va sulla riga 24, dalla colonna 12 alla 35, saltando le colonne multiple di 3.

- [ ] **Step 4: Collega l'uovo e nascondi i tasti**

- Clic sull'uovo: `state = newPet(...)`, `shownMood = mood(state)`, `player = startAnim(player, "nascita", performance.now())`, `render()`, `save()`.
- `render()`: con `const hatching = player.anim !== null && player.anim.name === "nascita"`, imposta `el.actions.hidden = !state.alive || hatching` e `el.magnum.hidden = !state.alive || hatching`.

- [ ] **Step 5: Verifica che passino**

Run: `node test.js`
Expected: tutti i test passano

- [ ] **Step 6: Verifica a mano in Chrome**

- Sparare, poi premere l'uovo: la lapide sprofonda, l'uovo spunta e si schiude.
- Per 1,5 s cure e Magnum non ci sono, poi ricompaiono.
- Un doppio clic veloce sull'uovo dà una sola nascita (Review Focus 5).
- La difficoltà si può cambiare durante la nascita.

- [ ] **Step 7: Commit**

```bash
git add index.html test.js
git commit -m "Nascita dalla tomba: la lapide sprofonda e spunta l'uovo"
```

---

### Task 6: verifica finale e documentazione

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-06-animazioni-design.md`, `docs/superpowers/specs/2026-10-05-tamagotchi-design.md`

- [ ] **Step 1: Giro completo in Chrome**

Gioca una partita intera su Difficile: le tre cure animate, Zzz invariato, le tre reazioni, lo sparo e la nascita. Ripeti i controlli dei Review Focus 1, 2 e 5.

- [ ] **Step 2: Aggiorna la documentazione**

- README, sezione "Come si gioca": aggiungi la riga "Ogni cura, la nascita e i cambi d'umore hanno la loro animazione."
- Specifica delle animazioni: `Stato: **implementata** in index.html (branch master)`.
- Specifica principale: aggiorna il numero dei test nella sezione "Test" con il conteggio di `node test.js`, e aggiungi un rimando alla specifica delle animazioni nella sezione "Sprite e animazioni".

- [ ] **Step 3: Verifica**

Run: `node test.js`
Expected: tutti i test passano, con lo stesso numero scritto nella specifica principale

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/
git commit -m "Documenta le animazioni uniche"
```
