# Mortagotchi — Specifica di design

Data: 2026-10-05
Stato: **versione finale, implementata** in `index.html` (branch `master`)

## Obiettivo

Una piccolissima app web che simula un Tamagotchi in pixel art. Il giocatore può
nutrire, far giocare, far riposare e lavare la creatura, ma il gioco è costruito
per finire **sempre** con la soppressione della creatura con una .44 Magnum: le cure
possono solo ritardare la fine, mai evitarla.

Tono: humour nero in stile cartoon, niente di realistico. L'interfaccia è tutta in
pixel art e si capisce **anche senza saper leggere**.

## Come si usa

- **Giocare**: doppio clic su `index.html`. Un solo file, nessuna installazione,
  nessuna connessione a internet.
- **Test**: `node test.js` (Node 24, nessuna dipendenza).

## Registro delle decisioni

| # | Domanda | Decisione |
|---|---------|-----------|
| 1 | Piattaforma | Pagina web, un solo file HTML da aprire nel browser |
| 2 | Tempo a pagina chiusa | Stato salvato nel browser, il tempo si **ferma** a pagina chiusa |
| 3 | Morte per incuria | La creatura non muore da sola: l'unica fine è la Magnum |
| 4 | Magnum obbligatoria | Quando **tutte** le statistiche sono sotto il 30%, la Magnum diventa l'unica azione possibile |
| 5 | Disponibilità Magnum | Sempre disponibile, in qualsiasi momento |
| 6 | Velocità del tempo | Scelta del giocatore, presentata come **livello di difficoltà** |
| 7 | Quando si sceglie la difficoltà | Alla nascita **e** modificabile in qualsiasi momento |
| 8 | Grafica | Pixel art semplice stile LCD, animazioni minime |
| 9 | Scena dello sparo | La Magnum in pixel art entra nello schermo, "BANG!" con lampo, la creatura diventa una lapide |
| 10 | Audio | Nessuno |
| 11 | Approccio tecnico | Un solo file HTML, pixel art disegnata su `<canvas>` da sprite a griglia di caratteri |
| 12 | Fine inevitabile | Meccanismo "vecchiaia": un tetto massimo delle statistiche che scende sempre |
| 13 | Durate | Facile 120 min, Normale 24 min, Difficile 4 min (vecchiaia rallentata per staccarla dalle statistiche; senza cure 42 min, 8 min 24 s, 1 min 24 s) |
| 14 | Faccia durante lo sparo | Quando la Magnum entra in scena la creatura ha una faccia **terrorizzata** (che trema) |
| 15 | Nome del gioco | **Mortagotchi** (titolo della pagina, marchio sul guscio, carta da parati) |
| 16 | Schermo LCD | Ridotto al **70%** della larghezza del guscio |
| 17 | Barre delle statistiche | Stile gaming retrò: 10 segmenti, colore in base al valore, zona tratteggiata oltre il tetto, valore numerico |
| 18 | Tasti | Pulsanti fisici rotondi con **icone in pixel art** al posto del testo, comprensibili senza saper leggere |
| 19 | Etichette delle barre | Stesse icone dei tasti al posto delle scritte |
| 20 | Avviso Magnum obbligatoria | Testo mantenuto, scritto con un **alfabeto pixel art** (nessun font esterno) |
| 21 | Grandezza del device | **Sempre uguale** in ogni stato (normale, obbligatoria, sparo, morta) |
| 22 | Aspetto del device | **3D**: guscio con luce e spessore, schermo incassato, tasti bombati, ombre marcate |
| 23 | Sfondo della pagina | Prugna scuro con **carta da parati** "MORTAGOTCHI" + lapidina ripetuta |
| 24 | Marchio sul guscio | "MORTAGOTCHI" inciso in alto con una **lapidina con croce** accanto, un po' più grande della scritta |
| 25 | Più schede aperte | Lo stato si sincronizza: una creatura uccisa in una scheda non torna viva nell'altra |

## Regole del gioco

### Statistiche

Quattro statistiche, valori da 0 a 100, tutte a 100 alla nascita:

| Statistica | Chiave | Tasto (icona) | Effetto |
|------------|--------|---------------|---------|
| Fame (barra piena = sazio) | `fame` | Mangia (cibo) | +30 |
| Felicità | `felicita` | Gioca (palla) | +30 |
| Energia | `energia` | Riposa (Zzz) | +30 |
| Pulizia | `pulizia` | Lava (bolle) | +30 |

Un'azione non può mai portare una statistica sopra il **tetto** attuale. Durante
l'animazione di un'azione (~1 secondo) tutti i tasti delle azioni sono bloccati e i
clic ripetuti vengono ignorati.

### Tetto (vecchiaia)

- Un unico valore `cap`, parte da 100 e **scende sempre**.
- Ogni statistica è sempre ≤ `cap` (se la supera viene riportata al tetto).
- Quando `cap` scende sotto 30, tutte le statistiche sono sotto 30 e quindi la
  Magnum diventa obbligatoria. La fine è garantita.

### Calo nel tempo

Il tempo scorre solo mentre la pagina è aperta. Detta `L` la vita massima della
difficoltà attuale (in secondi), per ogni secondo trascorso:

- ogni statistica cala di `DECAY_RATE[k] × 100 / L`, minimo 0. Le velocità sono
  `fame` 6, `felicita` 3, `pulizia` 2,5, `energia` 2: la fame arriva a 0 in
  `L / 6` secondi, l'energia in `L / 2`;
- il tetto cala di `70 / L` (da 100 a 30 in `L` secondi), minimo 0.

| Difficoltà | Icona | `L` | Senza cure, Magnum obbligatoria dopo |
|------------|-------|-----|--------------------------------------|
| Facile | 1 tacca | 7200 s (120 min) | 42 min |
| Normale | 2 tacche | 1440 s (24 min) | 8 min 24 s |
| Difficile | 3 tacche | 240 s (4 min) | 1 min 24 s |

Con cure perfette la Magnum diventa comunque obbligatoria dopo `L` secondi.

Cambiare difficoltà durante la partita cambia solo la velocità da quel momento in
poi; statistiche e tetto restano dove sono. Funziona anche da morta: la nuova
creatura nasce con la difficoltà selezionata.

Il tempo trascorso si misura con i timestamp reali tra un tick e l'altro, così una
scheda in background (con timer rallentati dal browser) non altera la velocità. Per
evitare salti enormi (es. computer in sospensione), un singolo tick conta al massimo
60 secondi; secondi negativi (orologio spostato indietro) non fanno nulla.

### Magnum

- Il tasto Magnum è **sempre** attivo finché la creatura è viva.
- **Condizione obbligatoria**: tutte e quattro le statistiche < 30. In questo stato:
  - i tasti delle azioni sono disattivati (grigi);
  - compare l'avviso "NON C'È PIÙ NIENTE DA FARE..." in pixel art;
  - il tasto Magnum lampeggia in rosso.
- La condizione è irreversibile: le azioni sono bloccate e statistiche e tetto
  continuano solo a scendere.

### Umore (aspetto della creatura)

| Umore | Condizione |
|-------|------------|
| Felice | tutte le statistiche ≥ 50 |
| Triste | almeno una statistica < 50 (e non in condizione obbligatoria) |
| Agonizzante | condizione obbligatoria attiva |
| Terrorizzata | solo durante la sequenza dello sparo |

### Morte e nuova creatura

- Sparare segna subito la creatura come morta (e lo stato viene salvato); la
  sequenza animata è solo grafica. Ricaricare a metà sequenza mostra la lapide.
- Clic ripetuti sulla Magnum avviano una sola sequenza.
- Da morta: sullo schermo c'è la lapide, i tasti delle azioni e la Magnum
  spariscono, compare il tasto "Nuova creatura" (uovo). Durante la sequenza dello
  sparo il tasto uovo resta nascosto.
- La nuova creatura nasce con la difficoltà selezionata in quel momento.

## Schermata

```
          ┌────────────────────────────┐
         ╱      MORTAGOTCHI ⌂✝          ╲     ← marchio inciso + lapidina
        │      (▂) (▂▄) (▂▄█)            │    ← difficoltà: 1/2/3 tacche
        │      ┌──────────────┐          │
        │      │  LCD verdino │          │    ← schermo al 70%, incassato
        │      │  (creatura)  │          │
        │      └──────────────┘          │
        │  🍎 [■■■■■■■□|▨▨] 78           │    ← icona, barra, tetto, valore
        │  ⚽ [■■■■□□□□|▨▨] 42           │
        │  Zz [■■□□□□□□|▨▨] 22           │
        │  ○○ [■■■■■■□□|▨▨] 64           │
        │  NON C'È PIÙ NIENTE DA FARE... │    ← spazio sempre riservato
        │     (🍎)  (⚽)  (Zz)  (○○)       │    ← tasti rotondi
         ╲          ( 🔫 )               ╱     ← Magnum (o uovo da morta)
          └────────────────────────────┘
   sfondo: carta da parati MORTAGOTCHI ⌂✝ ripetuta, sfalsata
```

### Device

- **Guscio**: rosa a forma di uovo, larghezza massima 360 px (si restringe sui
  telefoni stretti). Luce dall'alto a sinistra con riflesso lucido, plastica più
  scura sui bordi, spessore visibile sotto e ombra proiettata sullo sfondo.
- **Grandezza costante**: l'avviso occupa sempre il suo spazio (solo invisibile
  quando non serve) e i tasti stanno in una zona ad altezza fissa (96 px), dove da
  morta compare l'uovo.
- **Marchio**: "MORTAGOTCHI" in alfabeto pixel, rosa scuro con riflesso chiaro
  sotto (effetto inciso), alto 12 px; accanto una lapidina con croce alta 16 px,
  allineata in basso.

### Schermo LCD

- `<canvas>` 288×192 (schermo logico 48×32 pixel, un pixel = 6 px), sfondo
  `#9bbc0f`, pixel `#0f380f`, scalato con `image-rendering: pixelated`.
- Cornice grigia incassata con ombre interne; riflesso diagonale da vetro sopra.

### Barre delle statistiche

- Icona dello stesso tasto a sinistra, valore numerico arrotondato a destra.
- 10 segmenti, bordo spesso con ombra netta, riflesso chiaro sul riempimento.
- Colore: **verde** ≥ 50, **giallo** 30–50, **rosso** < 30 (lampeggia).
- Zona **tratteggiata** dal tetto a 100 (irraggiungibile) e tacca verticale sul tetto.

### Tasti

- Pulsanti fisici: bordo scuro, gradiente bombato, ombra sotto che si riduce alla
  pressione (il tasto scende).
- **Difficoltà**: tre tasti piccoli a pillola con 1, 2, 3 tacche (come il segnale
  del telefono); quello attivo resta premuto e scuro.
- **Azioni**: quattro tasti rotondi 44 px con le icone cibo, palla, Zzz, bolle.
- **Magnum**: pillola scura con la pistola in pixel art; lampeggia rossa quando è
  obbligatoria.
- **Nuova creatura**: tasto rotondo con un uovo.
- I nomi restano in `aria-label` e `title` (tooltip e lettori di schermo).

### Sprite e animazioni

Tutti gli sprite sono griglie di caratteri (`#` acceso, `.` spento).

| Sprite | Dimensione | Uso |
|--------|------------|-----|
| `felice`, `triste`, `agonizzante` | 16×16, 2 frame | creatura; il frame B è spostato in giù di 1 pixel ("respira" ogni 0,5 s) |
| `terrorizzata` | 16×16, 2 frame | durante lo sparo; alterna ogni 80 ms e si sposta di 1 pixel (trema) |
| `lapide` | 16×16 | creatura morta |
| `cibo`, `palla`, `zzz`, `bolle` | 8×8 | icone di tasti e barre; `zzz` compare anche accanto alla creatura durante Riposa (~1 s) |
| `magnum` | 16×10 | sequenza dello sparo, icona del tasto |
| `bang` | 18×5 | scritta "BANG!" |
| `uovo` | 8×8 | icona "Nuova creatura" |
| `liv1`, `liv2`, `liv3` | 8×7 | icone della difficoltà |
| `lapidina` | 7×8 | accanto al marchio e nella carta da parati |

**Sequenza dello sparo** (tempi dall'inizio):

| Tempo | Scena |
|-------|-------|
| 0–1000 ms | faccia terrorizzata che trema + Magnum che entra da destra |
| 1000–1200 ms | lampo (schermo pieno) |
| 1200–2200 ms | lapide + "BANG!" in alto |
| ≥ 2200 ms | lapide, compare il tasto uovo |

Le animazioni delle cure, della nascita e delle reazioni ai cambi d'umore, con le
regole di sovrapposizione, sono descritte in `2026-10-06-animazioni-design.md`.

### Alfabeto pixel

Lettere 3×5 più una riga in cima per gli accenti, una colonna di spazio tra le
lettere. Glifi disponibili: `A C D E È F G H I M N O P R T U Ù ' .` e spazio. Un
carattere senza glifo genera un errore (così una scritta nuova non sparisce in
silenzio).

### Sfondo

Prugna scuro `#2f2738` con una carta da parati generata dal codice: "MORTAGOTCHI" +
lapidina, in `#3b3247`, a file sfalsate come mattoni (un pixel = 4 px).

## Architettura

Un solo file `index.html`, nessuna risorsa esterna (niente CDN, font, immagini,
audio). Tre blocchi di script, nell'ordine:

### 1. Logica — `<script id="logic">`

Funzioni pure, nessun accesso al DOM. Ogni funzione restituisce un nuovo stato
senza modificare quello ricevuto.

```
state = {
  stats: { fame, felicita, energia, pulizia },  // 0..100
  cap,                                          // 0..100
  difficulty,                                   // "facile" | "normale" | "difficile"
  alive                                         // boolean
}
```

| Nome | Comportamento |
|------|---------------|
| `LIFESPAN` | `{ facile: 7200, normale: 1440, difficile: 240 }` |
| `DECAY_RATE` | `{ fame: 6, felicita: 3, pulizia: 2.5, energia: 2 }`, svuotamenti per vita massima |
| `STAT_KEYS`, `ACTION_STAT` | chiavi delle statistiche e azione → statistica |
| `ACTION_BOOST`, `FORCED_THRESHOLD`, `MAX_TICK_SECONDS` | 30, 30, 60 |
| `newPet(difficulty)` | statistiche e tetto a 100, viva |
| `tick(state, seconds)` | cala statistiche e tetto, riporta le statistiche sotto il tetto; nessun effetto se morta o con secondi ≤ 0; massimo 60 s |
| `act(state, action)` | +30 alla statistica dell'azione, fino al tetto; stato invariato se morta o in condizione obbligatoria |
| `isForced(state)` | vero se tutte le statistiche < 30 |
| `mood(state)` | `"felice"` / `"triste"` / `"agonizzante"` |
| `shoot(state)` | `alive = false`; stato invariato se già morta |
| `setDifficulty(state, d)` | cambia la difficoltà |
| `SAVE_KEY`, `serialize(state)` | `"tamagotchi-save"`, JSON |
| `parseSave(text)` | stato salvato se valido, altrimenti `newPet("normale")`; mai eccezioni |

`parseSave` accetta solo: tutte e 4 le statistiche e il tetto come numeri finiti in
0..100, una difficoltà esistente, `alive` booleano. Ignora i campi in più e riporta
le statistiche sotto il tetto.

### 2. Sprite e disegno — `<script id="sprites">`

Non tocca il DOM al caricamento.

| Nome | Comportamento |
|------|---------------|
| `SPRITES` | tutti gli sprite (vedi tabella sopra) |
| `overlay`, `shiftDown`, `breathing` | compongono le facce sul corpo `BODY` e creano il secondo frame |
| `drawSprite(ctx, sprite, x, y)` | disegna uno sprite sul canvas in pixel logici |
| `clearLcd(ctx)` | riempie lo schermo col colore di sfondo |
| `drawShot(ctx, t)` | disegna la sequenza dello sparo al tempo `t` (ms); `false` quando è finita; `t` negativo trattato come 0 |
| `drawScene(ctx, now)` | disegna l'animazione in corso, altrimenti la lapide o la creatura che respira |
| `PIXEL_FONT`, `pixelText(text)` | alfabeto pixel; testo → sprite |
| `besideSprite(a, b, gap)` | affianca due sprite allineati in basso |
| `tileSprite(sprite, gapX, gapY)` | piastrella a mattoni (seconda riga sfalsata di mezza piastrella) |
| `iconSvg(sprite, fill)` | sprite → SVG con un rettangolo per pixel (`fill` predefinito `currentColor`) |

### 3. Interfaccia e salvataggio — `<script id="ui">`

- All'avvio: inserisce le icone SVG nei tasti (`data-icon`), l'avviso in pixel art,
  il marchio e la carta da parati; legge il salvataggio.
- Variabili: `state`, `busyUntil` (blocco di 1 s dopo un'azione), `player`
  (animazione in corso e reazione in coda), `shownMood` (umore già mostrato).
- `render()` aggiorna difficoltà attiva, barre, avviso, tasti; `save()` scrive in
  `localStorage` dentro `try/catch`.
- Timer ogni secondo: `tick` → `render` → `save`.
- Evento `storage`: se un'altra scheda salva, adotta il suo stato e azzera il
  riferimento del tempo (così il tempo non viene contato due volte).
- Ciclo `requestAnimationFrame` che chiama `drawScene`.
- Se `localStorage` non funziona (es. navigazione privata) il gioco funziona
  comunque, solo senza memoria.

**Flusso**: timer o clic → funzione pura → nuovo stato → render + salvataggio.

## Test

`test.js`, eseguito con `node test.js`: legge `index.html`, estrae i blocchi
`logic` e `sprites` e li esegue in un contesto `node:vm` con `node:test`.
54 test:

- **Tempo**: calo esatto per ogni statistica, ordine delle velocità, vita
  massima, Magnum obbligatoria senza cure dopo 42 min, 8 min 24 s e 1 min 24 s, tetto a 30 e
  statistiche a 0 dopo `L` secondi per ogni difficoltà, mai sotto 0, statistiche riportate sotto il tetto, secondi negativi e
  oltre 60, input non modificato, nessun effetto da morta.
- **Difficoltà**: cambia solo la velocità successiva, funziona anche da morta.
- **Animazioni**: `reactionFor`, tipi e durate del registro, ogni animazione
  disegna per tutta la durata, priorità e coda di `startAnim`/`advanceAnim`,
  `drawSprite` con `maxY`, sprite nuovi.
- **Azioni**: +30 fino al tetto, mai oltre, ognuna sulla sua statistica, nessun
  effetto se obbligatoria o morta.
- **Regole**: confini di `isForced` (30) e `mood` (50 e 30), sparo e doppio sparo,
  **fine inevitabile** con cure perfette ogni secondo per ogni difficoltà.
- **Salvataggio**: andata e ritorno, 11 salvataggi non validi, statistica sopra il
  tetto, campi in più.
- **Grafica**: dimensioni e caratteri di tutti gli sprite, sequenza dello sparo con
  tempo negativo, `iconSvg`, `pixelText` (accenti, MORTAGOTCHI, glifo mancante),
  `tileSprite`, `besideSprite`.

Aspetto e interazione (layout, animazioni, tasti, grandezza costante,
sincronizzazione tra schede) sono stati verificati a mano nel browser.

## Fuori dal campo

Audio, morte per incuria, riepilogo della vita,
più creature, versione mobile dedicata, conferma prima dello sparo.

Miglioramenti noti rimandati: accessibilità avanzata (barre con
`role="progressbar"`, testo alternativo per lo schermo, focus dopo la Magnum),
ridisegno del canvas solo quando cambia qualcosa, `tick` che rifiuta `NaN`.
