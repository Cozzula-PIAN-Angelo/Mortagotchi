# Mortagotchi

Un piccolo Tamagotchi in pixel art con un finale già scritto: puoi nutrire, far
giocare, far riposare e lavare la tua creatura, ma prima o poi dovrai sopprimerla
con una .44 Magnum. Le cure possono solo ritardare la fine, mai evitarla.

Humour nero in stile cartoon. Tutta l'interfaccia è in pixel art e si capisce anche
senza saper leggere.

**▶ Gioca:** https://cozzula-pian-angelo.github.io/Mortagotchi/

## Come si gioca

| Tasto | Cosa fa |
|-------|---------|
| Cibo | Mangia: +30 alla fame |
| Palla | Gioca: +30 alla felicità |
| Zzz | Riposa: +30 all'energia |
| Bolle | Lava: +30 alla pulizia |
| Pistola | Magnum: sempre disponibile |
| Uovo | Nuova creatura (dopo la morte) |

- Le quattro statistiche calano col tempo.
- C'è anche un **tetto**, la vecchiaia: è la zona tratteggiata nelle barre. Scende
  sempre, e le cure non possono superarlo.
- Quando **tutte** le statistiche scendono sotto il 30%, gli altri tasti si
  bloccano e resta solo la Magnum.
- Il gioco si salva da solo nel browser. A pagina chiusa il tempo si ferma.

### Difficoltà

Si sceglie con i tasti in alto (1, 2 o 3 tacche) e si può cambiare in qualsiasi
momento.

| Difficoltà | Vita massima | Senza cure |
|------------|--------------|------------|
| Facile | 60 min | 42 min |
| Normale | 12 min | 8 min 24 s |
| Difficile | 2 min | 1 min 24 s |

## Giocare in locale

Scarica `index.html` e aprilo con un doppio clic. È un unico file, senza
dipendenze e senza bisogno di internet.

## Test

Servono [Node.js](https://nodejs.org/) 24 o superiore, senza dipendenze da
installare:

```
node test.js
```

## Struttura

| File | Contenuto |
|------|-----------|
| `index.html` | Il gioco: logica, pixel art e interfaccia, in un unico file |
| `test.js` | I test della logica e degli sprite |
| `docs/superpowers/specs/` | La specifica completa, con tutte le decisioni di design |
| `docs/superpowers/plans/` | Il piano di sviluppo originale |
