# Mortagotchi: il sonno, specifica di design

Data: 2026-10-06
Stato: **approvata a voce, in revisione scritta**
Si appoggia a: `2026-10-05-tamagotchi-design.md` e `2026-10-06-animazioni-design.md`

## Obiettivo

Oggi Zzz è una cura istantanea: +30 all'energia e un'icona per 1 secondo. Diventa
un sonno vero: la creatura dorme per decine di secondi o minuti, l'energia risale in
base al tempo dormito e intanto le altre statistiche continuano a scendere senza che
tu possa intervenire. Mandarla a dormire diventa una decisione con un costo, in linea
con il senso del gioco: le cure ritardano la fine, non la evitano.

Successo:
- un sonno da energia 30% su Difficile dura circa 19 s e costa circa metà della fame (−48);
- il sonno sopravvive alla chiusura della pagina;
- al risveglio si vede una sola reazione, quella del cambio d'umore avvenuto nel sonno.

## Registro delle decisioni

| # | Domanda | Decisione |
|---|---------|-----------|
| 1 | Come finisce | Dorme finché l'energia arriva al tetto, poi si sveglia da sola. Zzz non la sveglia |
| 2 | Altre cure nel sonno | Bloccate. La Magnum resta disponibile |
| 3 | Durata | Media: da 0 a pieno in L/8, cioè 30 s su Difficile, 3 min su Normale e 15 min su Facile |
| 4 | Reazioni nel sonno | Rimandate al risveglio: una sola, quella dell'umore finale |
| 5 | Animazione | "Notte stellata": si addormenta, notte con luna, stelle e Z, al risveglio sorge il sole |
| 6 | Struttura | Il sonno è uno stato della creatura nella logica (`asleep`) e viene salvato |

La bozza animata scelta è in `2026-10-06-sonno-bozze/sonno.html` (versione B).

## Regole

Detta `L` la vita massima della difficoltà attuale, in secondi.

**Addormentarsi**
- `sleep(state)` mette `asleep = true` solo se la creatura è viva, sveglia, non in
  condizione obbligatoria e con l'energia sotto il tetto. Altrimenti restituisce lo
  stato invariato.
- `act(state, "riposa")` equivale a `sleep(state)`. Il +30 di Zzz non esiste più.

**Mentre dorme**, a ogni `tick`:
- l'energia sale di `SLEEP_RATE × 100 / L` al secondo, con `SLEEP_RATE = 8`, e non
  supera il tetto. Non scende;
- fame, felicità e pulizia scendono come sempre, con `DECAY_RATE`, e anche il tetto
  scende come sempre;
- quando l'energia è uguale al tetto la creatura si sveglia (`asleep = false`), sia
  che l'energia sia salita fino al tetto, sia che il tetto sia sceso fino all'energia.

**Il resto**
- `act` con mangia, gioca o lava non ha effetto mentre dorme.
- `shoot` funziona nel sonno: la creatura muore e risulta sveglia (`asleep = false`).
- `setDifficulty` funziona nel sonno e cambia la velocità da quel momento in poi.
- `newPet` crea la creatura sveglia.
- `mood` e `isForced` restano invariati. La condizione obbligatoria nel sonno può
  verificarsi solo con il tetto sotto 30, e in quel caso l'energia lo raggiunge
  subito e la creatura si sveglia.

Esempio, Difficile (`L = 240`), 3 s di sonno: energia +10, fame −7,5,
felicità −3,75, pulizia −3,125, tetto −0,875. Da energia 0 il sonno dura circa
`100 · L / 870` secondi (27,6 s su Difficile), un po' meno di L/8 perché nel
frattempo il tetto scende.

**Salvataggio**
- Lo stato salvato guadagna il campo `asleep` (booleano).
- Un salvataggio senza `asleep` resta valido e la creatura risulta sveglia.
- Un `asleep` presente ma non booleano rende il salvataggio non valido, come oggi per
  gli altri campi sbagliati.
- Una creatura morta risulta sempre sveglia.
- A pagina chiusa il tempo si ferma: riaprendo la pagina la creatura dorme ancora.

## Animazioni

Tutte in pixel art sullo schermo 48×32, come le altre. La creatura sta in (16, 8).
"Schermo invertito" significa sfondo `LCD_INK` e pixel accesi in `LCD_BG`.

| Nome | Tipo | Durata | Sequenza |
|------|------|--------|----------|
| `riposa` (si addormenta) | cura | 1000 ms | Sostituisce l'animazione di oggi. 0–400: occhi chiusi e sbadiglio (bocca aperta alta 4 righe). 400–700: occhi chiusi e bocca piccola. 700–1000: schermo invertito con la creatura che dorme |
| `risveglio` | cura | 1000 ms | 0–150: ancora notte. Poi schermo normale con un sole 7×7 che sale da y −7 a y 2 tra 150 e 750 ms. 150–500: occhi chiusi, un pixel più in alto (si stiracchia). Da 500: faccia dell'umore attuale (`SPRITES[umore][0]`), due pixel più in alto fino a 650, poi al suo posto |
| Notte | — | finché dorme | Non è nel registro: la disegna `drawSleep(ctx, now)`. Schermo invertito, luna in (41, 2), sei stelle che si alternano ogni 400 ms tra puntino e stellina, creatura che dorme e respira ogni 700 ms, una Z che sale da (32, 11) a (36, 3) ogni 1200 ms |

## Interfaccia

- **Zzz:** il clic resta quello di oggi (`act`, `startAnim(player, "riposa", t0)`,
  blocco di 1 s). Ora `act` fa addormentare la creatura.
- **Disegno:** `drawScene` disegna, nell'ordine:
  1. l'animazione in corso, se c'è;
  2. altrimenti la lapide se è morta;
  3. altrimenti la notte se `state.asleep`;
  4. altrimenti la creatura che respira.
- **Risveglio:** l'interfaccia tiene `shownAsleep`. Dopo ogni tick, se la creatura è
  viva e `shownAsleep && !state.asleep`, fa partire `risveglio` e poi controlla
  l'umore. La reazione va in coda dietro al risveglio, perché la cura ha priorità
  sulla reazione.
- **Umore nel sonno:** mentre dorme `checkMood` non confronta l'umore, quindi
  `shownMood` resta quello di quando si è addormentata.
- **Aggiornamenti senza animazione:** al caricamento, alla sincronizzazione da
  un'altra scheda e alla nascita, `shownAsleep` si aggiorna senza animazione.
  Riaprendo la pagina mentre dorme si vede subito la notte.
- **Tasti:**
  - mentre dorme, mangia, gioca, lava e Zzz sono disabilitati e la Magnum resta
    disponibile;
  - Zzz è disabilitato anche quando l'energia è già al tetto.
- **Sonno brevissimo:** se il risveglio arriva mentre `riposa` è ancora in corso, la
  sostituisce, perché hanno la stessa priorità.

## Architettura

Tutto resta in `index.html`.

**Logica**

| Nome | Comportamento |
|------|---------------|
| `SLEEP_RATE` | `8`: quante volte l'energia si riempie nel sonno in una vita massima |
| `newPet` | aggiunge `asleep: false` |
| `sleep(state)` | vedi le regole. Restituisce un nuovo stato oppure lo stesso |
| `act(state, action)` | `"riposa"` → `sleep(state)`; le altre azioni non hanno effetto se `state.asleep` |
| `tick(state, seconds)` | nel sonno l'energia sale e si sveglia al tetto, come da regole |
| `shoot(state)` | mette anche `asleep: false` |
| `parseSave(text)` | accetta `asleep` booleano o assente (assente = `false`); restituisce sempre `asleep`, `false` se morta |

`ACTION_STAT` resta com'è (`riposa → energia`), perché lo usano le icone e le barre.

**Sprite e disegno**
- `drawSprite(ctx, sprite, x, y, maxY = Infinity, color = LCD_INK)`: il nuovo
  parametro `color` serve allo schermo invertito.
- Sprite nuovi in `SPRITES`, presi dalla bozza:
  - `sbadiglio` e `dorme` (16×16);
  - `luna` (4×6), `sole` (7×7), `zeta` (4×4).
  - La stellina riusa `scintilla`.
- `ANIMATIONS.riposa` cambia `draw` (si addormenta).
- `ANIMATIONS.risveglio` è nuova: `{ kind: "cura", ms: 1000 }`.
- `drawSleep(ctx, now)` disegna la notte.

**Interfaccia**
- `shownAsleep` affianca `shownMood`.
- `checkMood` esce subito se la creatura dorme.
- Nel tick va controllato prima il risveglio, poi l'umore.
- `render()` disabilita le cure con `forced || busy || state.asleep`, e Zzz anche
  quando `energia >= cap`.

## Test

**Logica**
- `sleep`:
  - si addormenta da sveglia con l'energia sotto il tetto;
  - non fa nulla se è morta, se dorme già, se è in condizione obbligatoria o se ha
    l'energia al tetto.
- `act("riposa")` dà lo stesso risultato di `sleep`. Mangia, gioca e lava non hanno
  effetto nel sonno.
- `tick` nel sonno: i valori dell'esempio su Difficile (3 s).
- Risveglio:
  - con l'energia che arriva al tetto: `asleep` falso, energia uguale al tetto;
  - con il tetto che scende fino all'energia.
- Da energia 0, la sveglia arriva a `100 · L / 870` s ± 1 su ogni difficoltà.
- `shoot` nel sonno: morta e sveglia. `newPet`: sveglia.
- Salvataggio:
  - andata e ritorno con `asleep: true`;
  - `asleep` assente → `false`;
  - `asleep` non booleano → salvataggio non valido;
  - morta con `asleep: true` → `false`.
- Da aggiornare:
  - i test su Zzz +30;
  - il test "campi extra ignorati", che ora include `asleep`;
  - il test "fine inevitabile con cure perfette" deve continuare a passare, perché
    il tetto scende comunque.

**Grafica**
- `riposa` e `risveglio`: tipo `cura`, 1000 ms, disegnano per tutta la durata.
- `riposa` cambia nel tempo; sostituisce il test "riposa resta come oggi".
- `drawSleep` disegna in qualunque istante e cambia tra istanti diversi.
- `drawSprite` con `color` usa quel colore.
- Sprite nuovi: dimensioni e caratteri.

**A mano in Chrome**
- Un sonno completo su Difficile, con i tasti disabilitati e la barra dell'energia che
  sale.
- Lo sparo nel sonno.
- Il ricaricamento della pagina mentre dorme.
- La lacrima al risveglio dopo un sonno in cui la fame scende sotto 50.
- Due schede aperte.

## Documentazione

- README:
  - la tabella dei tasti dice "Zzz: Dorme finché l'energia è piena";
  - una riga spiega che nel sonno le altre cure sono bloccate.
- Specifica principale: stato e regole di Zzz aggiornati, con un rimando a questa
  specifica.

## Fuori dal campo

- Svegliarla prima del tempo.
- Sogni o eventi durante il sonno.
- Suoni.
- Il bilanciamento delle altre cure.
