# Tamagotchi con Magnum — Specifica di design

Data: 2026-10-05
Stato: approvata in chat, in attesa di revisione scritta

## Obiettivo

Una piccolissima app web che simula un Tamagotchi in pixel art. Il giocatore può
nutrire, far giocare, far riposare e lavare la creatura, ma il gioco è costruito
per finire **sempre** con la soppressione della creatura con una .44 Magnum: le cure
possono solo ritardare la fine, mai evitarla.

Tono: humour nero in stile cartoon, niente di realistico.

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
| 13 | Durate | Facile 60 min, Normale 12 min, Difficile 5 min |
| 14 | Faccia durante lo sparo | Quando la Magnum entra in scena la creatura ha una faccia **terrorizzata** (che trema) |

## Regole del gioco

### Statistiche

Quattro statistiche, valori da 0 a 100, tutte a 100 alla nascita:

| Statistica | Chiave | Azione | Effetto |
|------------|--------|--------|---------|
| 🍖 Fame (barra piena = sazio) | `fame` | Mangia | +30 |
| 🎾 Felicità | `felicita` | Gioca | +30 |
| 💤 Energia | `energia` | Riposa | +30 |
| 🧼 Pulizia | `pulizia` | Lava | +30 |

Un'azione non può mai portare una statistica sopra il **tetto** attuale. Durante
l'animazione di un'azione (~1 secondo) tutti i pulsanti delle azioni sono bloccati.

### Tetto (vecchiaia)

- Un unico valore `cap`, parte da 100 e **scende sempre**.
- Ogni statistica è sempre ≤ `cap` (se la supera viene riportata al tetto).
- Quando `cap` scende sotto 30, tutte le statistiche sono sotto 30 e quindi la
  Magnum diventa obbligatoria. La fine è garantita.

### Calo nel tempo

Il tempo scorre solo mentre la pagina è aperta. Detta `L` la vita massima della
difficoltà attuale (in secondi), per ogni secondo trascorso:

- ogni statistica cala di `100 / L` (da 100 a 0 in `L` secondi), minimo 0;
- il tetto cala di `70 / L` (da 100 a 30 in `L` secondi), minimo 0.

| Difficoltà | `L` |
|------------|-----|
| Facile | 3600 s (60 min) |
| Normale | 720 s (12 min) |
| Difficile | 300 s (5 min) |

Cambiare difficoltà durante la partita cambia solo la velocità da quel momento in
poi; statistiche e tetto restano dove sono.

Il tempo trascorso si misura con i timestamp reali tra un tick e l'altro, così una
scheda in background (con timer rallentati dal browser) non altera la velocità. Per
evitare salti enormi (es. computer in sospensione), un singolo tick conta al massimo
60 secondi.

### Magnum

- Il pulsante Magnum è **sempre** attivo finché la creatura è viva.
- **Condizione obbligatoria**: tutte e quattro le statistiche < 30. In questo stato:
  - i pulsanti Mangia/Gioca/Riposa/Lava sono disattivati;
  - compare l'avviso "Non c'è più niente da fare…";
  - il pulsante Magnum lampeggia.
- La condizione è irreversibile: le azioni sono bloccate e statistiche e tetto
  continuano solo a scendere.

### Umore (aspetto della creatura)

| Umore | Condizione |
|-------|------------|
| Felice | tutte le statistiche ≥ 50 |
| Triste | almeno una statistica < 50 (e non in condizione obbligatoria) |
| Agonizzante | condizione obbligatoria attiva |

### Morte e nuova creatura

- Sparare segna subito la creatura come morta (e lo stato viene salvato); la
  sequenza animata è solo grafica.
- Da morta: sullo schermo c'è la lapide, i pulsanti delle azioni e la Magnum
  spariscono, compare il pulsante "Nuova creatura".
- La nuova creatura nasce con la difficoltà selezionata in quel momento.

## Schermata

```
┌─────────────────────────────────┐
│  Difficoltà: [Facile|Normale|Difficile]
│                                 │
│   ┌───────────────────────┐     │
│   │  schermo LCD verdino  │     │
│   │     (creatura         │     │
│   │      in pixel art)    │     │
│   └───────────────────────┘     │
│                                 │
│  🍖 Fame      [██████░░|░░]     │  ← "|" = tetto
│  🎾 Felicità  [████░░░░|░░]     │
│  💤 Energia   [███████░|░░]     │
│  🧼 Pulizia   [█████░░░|░░]     │
│                                 │
│ [Mangia][Gioca][Riposa][Lava]   │
│          [ 🔫 MAGNUM ]          │
└─────────────────────────────────┘
```

- **Selettore difficoltà**: in alto, sempre visibile, tre pulsanti a scelta singola.
- **Schermo LCD**: `<canvas>` con sfondo verde-grigio e pixel scuri, sprite 16×16
  ingranditi.
- **Barre**: una per statistica, con una tacca che mostra il tetto attuale.
- **Avviso** di Magnum obbligatoria sopra i pulsanti.

### Sprite e animazioni

- **Creatura**: 3 umori (felice, triste, agonizzante) × 2 frame alternati ogni 0,5 s.
- **Azioni** (~1 s): oggetto accanto alla creatura — cibo, palla, "Zzz", bolle.
- **Sparo**:
  1. la Magnum in pixel art entra da destra (~1 s) e la creatura passa alla faccia **terrorizzata** (occhi sbarrati, bocca aperta, 2 frame alternati velocemente per farla tremare);
  2. scritta "BANG!" con lampo dello schermo;
  3. la creatura diventa una lapide.
- **Lapide**: sprite statico.

## Architettura

Un solo file `index.html`, si apre con doppio clic, nessuna dipendenza. Tre parti:

### 1. Logica — `<script id="logic">`

Funzioni pure, nessun accesso al DOM. Ogni funzione restituisce un nuovo stato.

```
state = {
  stats: { fame, felicita, energia, pulizia },  // 0..100
  cap,                                          // 0..100
  difficulty,                                   // "facile" | "normale" | "difficile"
  alive                                         // boolean
}
```

| Funzione | Comportamento |
|----------|---------------|
| `newPet(difficulty)` | statistiche e tetto a 100, viva |
| `tick(state, seconds)` | cala statistiche e tetto, riporta le statistiche sotto il tetto; nessun effetto se morta |
| `act(state, action)` | +30 alla statistica dell'azione, fino al tetto; restituisce lo stato invariato se morta o in condizione obbligatoria |
| `isForced(state)` | vero se tutte le statistiche < 30 |
| `mood(state)` | `"felice"` / `"triste"` / `"agonizzante"` |
| `shoot(state)` | `alive = false` |
| `setDifficulty(state, d)` | cambia la difficoltà |

### 2. Sprite e disegno

- Sprite come array di stringhe (un carattere per pixel, `.` = vuoto).
- `drawSprite(ctx, sprite, x, y)` disegna una griglia sul canvas.
- Ciclo di animazione con `requestAnimationFrame`; lo stato dell'animazione (frame,
  azione in corso, sequenza di sparo) vive solo nell'interfaccia, non nello stato
  salvato.

### 3. Interfaccia e salvataggio

- Timer ogni secondo: `tick` → aggiorna barre, pulsanti, avviso → salva.
- Pulsanti: chiamano `act`, `shoot`, `setDifficulty`, `newPet`, poi aggiornano e salvano.
- Salvataggio in `localStorage` (chiave `tamagotchi-save`), lettura e scrittura in
  `try/catch`. Salvataggio assente, illeggibile o non valido → nuova creatura a
  difficoltà Normale. Se il salvataggio non funziona (es. navigazione privata) il
  gioco funziona comunque, solo senza memoria.

**Flusso**: timer o click → funzione pura → nuovo stato → render + salvataggio.

## Test

`test.js`, eseguito con `node test.js` (Node 24, nessuna dipendenza): legge
`index.html`, estrae il contenuto di `<script id="logic">` e ne verifica le regole:

- il tetto scende sempre a ogni `tick` finché è sopra 0;
- nessuna statistica supera mai il tetto, né dopo `tick` né dopo `act`;
- `act` aggiunge +30 senza superare il tetto;
- `isForced` è vero solo quando tutte le statistiche sono < 30;
- in condizione obbligatoria e da morta `act` non cambia lo stato;
- per ogni difficoltà, anche curando la creatura nel modo migliore possibile
  (azione su ogni statistica a ogni secondo), la condizione obbligatoria arriva
  entro `L + 1` secondi;
- `mood` restituisce l'umore corretto ai confini (50 e 30);
- `setDifficulty` cambia la velocità di calo dei tick successivi.

La grafica si verifica a occhio aprendo `index.html` nel browser.

## Fuori dal campo

Audio, morte per incuria, statistiche con velocità diverse, riepilogo della vita,
più creature, versione mobile dedicata.
