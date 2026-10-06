# Mortagotchi: animazioni uniche, specifica di design

Data: 2026-10-06
Stato: **implementata** in `index.html` (branch `master`)
Si appoggia a: `2026-10-05-tamagotchi-design.md`

## Obiettivo

Dare alla creatura animazioni proprie quando la curi, quando nasce e quando cambia
umore. Oggi durante una cura la creatura continua a respirare e accanto compare
un'icona ferma, e la nuova creatura compare di colpo. Le animazioni devono restare
in pixel art sullo schermo LCD 48×32, capirsi senza leggere e mantenere l'humour
nero del gioco.

Successo: ogni momento elencato sotto ha la sua animazione riconoscibile, il ritmo
del gioco non cambia (le cure bloccano i tasti sempre per 1 s) e le animazioni non
si accavallano in modo confuso.

## Registro delle decisioni

| # | Domanda | Decisione |
|---|---------|-----------|
| 1 | Quali momenti | Le cure mangia, gioca e lava, la nascita dall'uovo, i tre cambi d'umore |
| 2 | Durata delle cure | 1 s come oggi, con i tasti bloccati per lo stesso tempo |
| 3 | Mangia | "Al volo": il cibo cade in bocca, mastica, saltello |
| 4 | Gioca | "Calcio": rincorsa, calcio, la palla vola via, esulta |
| 5 | Lava | "Doccia": gocce dall'alto, poi scintille |
| 6 | Nascita | "Dalla tomba": la lapide sprofonda e dal terreno spunta l'uovo, che si schiude (1,5 s) |
| 7 | Diventa triste | "Lacrima" |
| 8 | Torna felice | "Cuoricino" |
| 9 | Diventa agonizzante | "Pensiero fisso": fumetto con il teschio |
| 10 | Struttura | Un'unica animazione in corso, con priorità e una reazione in coda |
| 11 | Quando reagire | Solo ai cambi d'umore avvenuti giocando, non al caricamento né alla sincronizzazione tra schede |
| 12 | Sonno | **Escluso**: avrà un rework a parte (dura di più, l'energia risale in base al tempo). Fino ad allora Zzz resta com'è oggi |

Le bozze animate da cui sono state scelte le versioni sono in
`2026-10-06-animazioni-bozze/` (`cure.html`, `nascita.html`, `umore.html`) e sono il
riferimento per sprite e tempi. Sono frammenti del visual companion: si aprono anche
direttamente nel browser, ma senza lo stile della cornice.

## Le animazioni

Coordinate in pixel logici. La creatura sta in (16, 8) ed è grande 16×16. Alla fine
di ogni animazione torna la faccia del suo umore, che respira come oggi.

| Nome | Tipo | Durata | Sequenza |
|------|------|--------|----------|
| `mangia` | cura | 1000 ms | 0–450: occhi in alto e bocca aperta, un cibo piccolo 4×4 cade da y −4 fino alla bocca (x 22). 450–850: mastica con gli occhi a ^ ^, alternando ogni 100 ms bocca chiusa (corpo un pixel più in basso) e bocca a "o". 850–1000: occhi a ^ ^ e sorriso, due pixel più in alto |
| `gioca` | cura | 1000 ms | Creatura in x 14 fino a 250 ms (rincorsa), in x 17 fino a 500 (calcio), poi in x 16. La palla parte da (32, 15) e da 300 ms vola ad arco verso destra (+20 in x, 14 di altezza) per 500 ms, uscendo dallo schermo. 800–1000: occhi a ^ ^, saltello di 3 pixel fino a 900 ms |
| `lava` | cura | 1000 ms | 0–750: occhi chiusi e sorriso, gocce di 1×2 pixel che cadono in sette colonne (sulla testa fino a y 7, ai lati fino a y 22). 750–1000: faccia felice e due scintille che lampeggiano in (34, 6) e (11, 10) |
| `riposa` | cura | 1000 ms | Come oggi: faccia dell'umore che respira e icona Zzz ferma in (34, 12) |
| `nascita` | nascita | 1500 ms | Linea del terreno tratteggiata sotto la creatura (riga 24) per tutta la durata. 0–350: la lapide sprofonda, si disegna solo sopra la riga 23. 350–600: l'uovo 12×13 spunta dal terreno fino a (18, 10). Poi, a velocità ×1,3: dondola (±1 pixel ogni 90 ms), si crepa (zigzag sulle righe 6–7), le due metà del guscio volano via in diagonale con tre scintille, la creatura esce con gli occhi a ^ ^ e fa un saltello |
| `lacrima` | reazione | 1000 ms | Faccia triste senza lacrima, un pixel più in basso. Una goccia parte sotto l'occhio sinistro (x 19, y 17), scende di un pixel ogni 110 ms e si allunga a due pixel quando lascia la guancia, fino a uscire dallo schermo |
| `cuoricino` | reazione | 1000 ms | Occhi a ^ ^ e sorriso. Un cuore 5×5 sale da y 8 a y −1 ondeggiando di un pixel ogni 200 ms e lampeggia negli ultimi 400 ms |
| `teschio` | reazione | 1000 ms | Faccia agonizzante. Da 100 ms un puntino di pensiero, da 200 ms un secondo puntino, da 300 ms il fumetto 13×10 in (34, 0) con dentro il teschio 7×6 |
| `sparo` | sparo | 2200 ms | Invariato: l'attuale `drawShot` |

## Regole di sovrapposizione

Priorità: `sparo` 4, `nascita` 3, cura 2, reazione 1.

- Un'animazione nuova parte subito se la sua priorità è **uguale o maggiore** di
  quella in corso, e la sostituisce.
- Se la priorità è minore: una reazione va **in coda** (c'è un solo posto, vince
  la più recente). Gli altri tipi vengono ignorati, ma in pratica non succede,
  perché i tasti sono bloccati o nascosti.
- Lo sparo svuota anche la coda.
- Quando l'animazione in corso finisce, parte quella in coda, se c'è.

Esempi:
- La creatura è triste e le dai da mangiare finché torna felice: vedi `mangia` e
  subito dopo `cuoricino`.
- Durante `gioca` la fame scende sotto 50: `lacrima` parte quando il calcio finisce.
- Spari durante una cura o una reazione: lo sparo parte subito.

Tasti:
- Durante una cura i tasti delle cure restano bloccati per 1 s (`busyUntil`, come oggi).
- Durante la `nascita` sono nascosti i tasti delle cure, la Magnum e l'uovo.
  La difficoltà resta modificabile.
- L'uovo resta nascosto anche durante lo `sparo`, come oggi.
- Quando un'animazione finisce si chiama `render()`.

## Quando parte una reazione

L'interfaccia tiene `shownMood`, l'umore mostrato.

- Dopo ogni `tick` e ogni cura, se la creatura è viva e
  `reactionFor(shownMood, mood(state))` restituisce una reazione, la fa partire e
  aggiorna `shownMood`.
- Al caricamento della pagina, alla nascita e quando un'altra scheda sincronizza lo
  stato, `shownMood` viene aggiornato **senza** reazione.
- Una scheda rimasta in background mostra al ritorno una sola reazione, quella
  dell'ultimo cambio.
- Se un'altra scheda uccide la creatura, questa scheda annulla l'animazione in
  corso e la coda e mostra la lapide, senza sequenza di sparo, come oggi.

## Architettura

Tutto resta in `index.html`, nei tre script di oggi.

### Logica: `<script id="logic">`

| Nome | Comportamento |
|------|---------------|
| `REACTION` | `{ triste: "lacrima", felice: "cuoricino", agonizzante: "teschio" }` |
| `reactionFor(prima, dopo)` | `null` se `prima === dopo`, altrimenti `REACTION[dopo]` |

### Sprite e disegno: `<script id="sprites">`

- **Nuovi sprite**: occhi in alto, chiusi, a ^ ^ e strizzati; bocca aperta, chiusa,
  a "o" e corrugata; cibo piccolo, cuore, teschio, fumetto, uovo grande, uovo
  crepato con le due metà, scintilla. Le facce si compongono con `overlay` sul
  corpo, come le facce di oggi.
- **`drawSprite(ctx, sprite, x, y, maxY)`**: il parametro facoltativo `maxY` non
  disegna le righe sotto quella quota, e serve per sprofondare e spuntare dal
  terreno.
- **`ANIMATIONS`**: un oggetto `nome → { kind, ms, draw(ctx, t, umore) }`. `draw`
  disegna tutta la scena all'istante `t` (in ms dall'inizio, anche un po' negativo).
  `umore` serve solo a `riposa`. Lo sparo usa `drawShot`.
- **`ANIM_PRIORITY`**: `{ sparo: 4, nascita: 3, cura: 2, reazione: 1 }`.
- **`startAnim(player, name, now)`**: funzione pura. `player` è
  `{ anim: { name, start } | null, queued: name | null }`; restituisce il nuovo
  `player` applicando le regole di sovrapposizione. Un'animazione già finita conta
  come assente.
- **`advanceAnim(player, now)`**: funzione pura. Se l'animazione in corso è finita,
  fa partire quella in coda (con `start = now`) oppure azzera `anim`.
- **`drawScene(ctx, now)`**: chiama `advanceAnim`, poi `render()` se l'animazione è
  appena finita. Se c'è un'animazione la disegna, altrimenti disegna la lapide da
  morta o la faccia dell'umore che respira.

### Interfaccia: `<script id="ui">`

- `player` sostituisce `currentAction` e `shotStart`. Il `setTimeout` della cura
  non serve più.
- Il clic su una cura chiama `act`, poi `startAnim` con la cura, poi controlla la
  reazione.
- `onShoot` chiama `startAnim(player, "sparo", now)`.
- Il clic sull'uovo chiama `newPet`, poi `startAnim(player, "nascita", now)` e
  aggiorna `shownMood`.
- `render()` nasconde cure e Magnum durante la `nascita`, e l'uovo durante `sparo`
  e `nascita`.
- Nel `setInterval` del tick, dopo `tick` si controlla la reazione.
- Nell'evento `storage`: se la creatura è morta, `player` torna vuoto; in ogni caso
  `shownMood` si aggiorna senza reazione.

## Test

In `test.js`, senza DOM, come i test di oggi:

- **`reactionFor`**:
  - umore uguale, nessuna reazione;
  - felice→triste, lacrima;
  - triste→felice, cuoricino;
  - triste→agonizzante, teschio.
- **`ANIMATIONS`**:
  - ci sono `mangia`, `gioca`, `lava`, `riposa`, `nascita`, `lacrima`, `cuoricino`,
    `teschio` e `sparo`, con le durate e i tipi della tabella;
  - ogni `draw` gira con un contesto finto per t = −16, 0, metà durata e
    durata − 1.
- **`startAnim` e `advanceAnim`**:
  - lo sparo interrompe tutto e svuota la coda;
  - la cura interrompe una reazione;
  - una reazione va in coda dietro una cura o una nascita, e vince la più recente;
  - una reazione sostituisce un'altra reazione;
  - un'animazione finita conta come assente;
  - alla fine parte la coda, altrimenti `anim` diventa `null`.
- **Nuovi sprite**: righe tutte della stessa lunghezza, solo "#" e ".", nei limiti
  dello schermo.
- I test di oggi restano, compreso quello di `drawShot`.

A mano in Chrome:
- ogni animazione;
- cura seguita da reazione;
- sparo durante una cura;
- nascita con i tasti nascosti;
- seconda scheda che sincronizza e che uccide la creatura.

## Fuori dal campo

- Il rework del sonno, con la sua animazione (si partirà dalla bozza "Luci spente").
- I suoni.
- Le animazioni per il cambio di difficoltà.
- Le varianti casuali della stessa animazione.
