# Poké TCG Tracker — project brief

Start-up context for a Claude Project working on this repo. Read this first.

---

## What this is

A static site for one person's trading-card collection — Pokémon, One Piece and
Riftbound. Five pages, no backend, no framework, no runtime dependencies. All state lives in `data/*.json`; card
photos live in `images/`. It is built with `npm run build` into `dist/` and
deploys to Vercel or GitHub Pages as plain files.

The owner is the only user. They are not a web developer, so the workflows are
"say a thing in Claude Code" rather than "edit the JSON by hand" — though
hand-editing is always available and documented in `README.md`.

**Current state** (Nov 15, 2026): 149 cards (102 EN / 47 JP, all Pokémon) ·
16 tracked sets, 56 of 164 slots filled · 3 standalone wants · 9 sealed products
across three games, 24 units · holdings **$3,527.87** (cards $2,094.08 + sealed
$1,433.79). Per game: Pokémon $2,996.23 · Riftbound $475.00 · One Piece $56.64.

**Multi-game** since Nov 15, 2026. `data/games.json` is the registry (Pokémon,
One Piece, Riftbound), and every card and sealed entry may carry a `"game"`
key — **unlabelled means Pokémon**, which is what the original 149 cards are.
The new holdings are all sealed: a Riftbound T1 Worlds Champion Player Bundle,
a Riftbound Worlds Bundle 2026 and eight One Piece OP-16 booster packs.

---

## The five pages

| Page | File | Job |
|---|---|---|
| Portfolio | `src/index.html` | Headline value, value-over-time chart, cards ranked by price |
| Cards | `src/cards.html` | Every owned card; grid or sortable table, filters, search |
| Sealed | `src/sealed.html` | Unopened boxes and bundles, quantity × unit price |
| Sets | `src/sets.html` | Set completion as binder pockets, owned vs missing |
| Wishlist | `src/wishlist.html` | Missing set slots + standalone wants, list or card view |

Each page is `src/<page>.html` plus `src/js/<page>.js`, sharing `src/js/data.js`
(loading, formatting, links, nav, placeholder) and `src/css/main.css`.

---

## Data model

Seven files in `data/`. These are the source of truth; the pages only render them.

- **`games.json`** — the games tracked, each with its TCGCSV category ids. A
  card or product's `game` field points at a `key` here; no field means
  `pokemon`.

- **`cards.json`** — owned cards. `id` is permanent and referenced by set slots
  and image filenames, so **never reuse or renumber ids**.
- **`sets.json`** — tracked sets, each with `slots` of `{number, name, card_id}`.
  `card_id: null` means a gap, which feeds the Wishlist automatically.
- **`prices.json`** — `{set_key: {number: usd}}`, plus `checked_date`, `sources`
  and `history[]` (one point per sync, drives the Portfolio chart).
- **`wishlist.json`** — wanted cards *not* part of a tracked set.
- **`sealed.json`** — unopened product with `qty` and `game`.
- **`need-images.json`** — maps unowned slots to downloaded art in `images/need/`.

### The one rule that matters most

**Prices resolve through `set_key`, scoped to a bucket — never by card number
alone.** Since the tracker went multi-game this extends outwards: a record is
only ever matched inside **its own game's catalogue**, and non-Pokémon buckets
are prefixed with the game key, so two games that name a set alike cannot share
a bucket. Product names collide across games far more readily than card numbers
do — "Booster Bundle" and "Booster Pack" exist in all three — so a cross-game
name match was a real risk, not a theoretical one. Card numbers repeat across sets *and* across printings of one card.

The canonical example: `Umbreon ex 060/131` exists twice in this collection —
the plain Prismatic Evolutions print (id 20, $6.97) and the Surprise Box stamped
print (id 1, $17.12). They live in different buckets. An earlier version matched
on number alone, gave the stamped card the plain card's value, and inflated the
portfolio total.

A related bug cost more: TCGplayer lists `Pikachu - 027`, `Pikachu - 027
(Pokemon Center Exclusive)` and an unrelated `Pikachu (Baby)` all under number
27. Averaging them priced a $15.62 promo at $91.65. The matcher now prefers the
plain printing and, if a tie still spans several sets, **leaves the card
unpriced and says so** rather than guessing.

`npm run check` enforces this: every card resolves, printings of one number stay
in separate buckets, history has no duplicate dates and matches cards + sealed,
and no price is implausible. It exits non-zero, so it can gate a deploy.

---

## Commands

```bash
npm start            # build + serve at localhost:5173
npm run build        # build into dist/ (validates JSON, ids, image refs)
npm run prices       # dry-run price sync: report, write nothing
npm run prices:write # sync prices, then run the checks
npm run images:need  # download art for cards not owned
npm run check        # verify price integrity without re-fetching
```

Open the **served** URL, never the files — the pages use `fetch()` and ES
modules, which browsers block over `file://`.

---

## Where prices come from

[TCGCSV](https://tcgcsv.com) — a free daily mirror of TCGplayer's own price
feed. No API key, plain JSON, and it carries both English (category 3) and
Japanese (category 85) products, which matters because a third of the
collection is Japanese.

`scripts/fetch-prices.mjs` reads **`marketPrice`** (the median of recent sales),
never `lowPrice`. It prices owned cards, unowned wants (so the Wishlist totals a
real cost), and sealed product, then appends one point to `history[]`.

**This is the only acceptable source of prices.** Do not ask a model what a card
is worth and record the answer — that is recalled, not observed, and the
failures above show how far off a plausible-looking number can be. If TCGCSV has
no price for something, leave it `null` and report it. One product
(Paradox Fury Premium Collection) genuinely has no price row upstream.

TCGplayer's own site renders prices in JavaScript and cannot be fetched;
PriceCharting aggregators disagreed roughly 2× on a spot check. TCGCSV is the
working path.

---

## Where card data came from

The collection was exported from the owner's own `cards_data.py`. That export is
authoritative for set, number, rarity and binder page. All 147 original cards
matched a photo one-to-one with nothing left over on either side — that
correspondence is the strongest evidence the data is right, and is worth
re-checking after any bulk change.

Images: owned cards use the **owner's own photos** in `images/cards/` (plus
200px thumbnails in `images/thumbs/`), named `c<id>.jpg`. Cards *not* owned use
official product art in `images/need/`, shown desaturated behind a red **NEED**
chip so a gap never reads as a filled pocket. The owner lifted the original
"no official artwork" rule specifically for cards they do not own; **owned cards
keep their own photos.**

---

## Skills

Three skills in `.claude/skills/` (mirrored in `skills/`) drive the everyday
workflows: `add-cards` (drop photos), `add-to-wishlist` (photo, name or URL) and
`update-prices` (runs the sync script rather than doing manual lookups).

---

## Working style the owner expects

This repo was built through several rounds of the owner spot-checking output and
finding real errors. That has shaped how work should be done here:

- **Verify, don't assert.** Claims about the site were checked by driving real
  headless Chrome — 30 interaction tests and 5 mobile-overflow checks live in
  the scratchpad workflow. "It builds" is not evidence that it renders.
- **Coverage is not correctness.** An early sync matched 147/147 cards and was
  still wrong for four of them. The owner caught it. Spot-check values, don't
  just count matches.
- **Say what you could not do.** Unpriced, unmatched and ambiguous items are
  reported explicitly rather than filled with a plausible number.
- **Flag conflicts instead of silently resolving them.** When the brief and the
  real data disagreed, the right move was to surface it and ask.

A note on scope: the repo sits inside `/Users/minhha`, which is **itself a git
repo**. This project has its own repo; never run `git add` from the home
directory, or you will sweep in `.ssh/`, `.netrc` and more.

---

## Known gaps

- **Riftbound Worlds Bundle 2026 has no upstream price.** TCGCSV's Riftbound
  catalogue (category 89) lists a *Worlds Bundle 2025* but no 2026 bundle. The
  owner has confirmed (Nov 15, 2026) that it **is** the 2026 bundle, so the entry
  is correct and the gap is upstream. It carries a **hand-entered $175**
  (`"price_source": "manual"`), which is the owner's own figure rather than an
  observed market price — the second such entry, after Paradox Fury. Do not
  rename it to 2025 or value it from that product; a later sync replaces the
  manual figure once the product is listed.
- **No tracked sets or cards outside Pokémon yet.** The set tracker and wishlist
  support a `game` field but hold only Pokémon; the game filters on Cards and
  Portfolio stay hidden until a non-Pokémon card is added, and the Wishlist page
  has no game filter at all yet.

- **Chart has one data point.** It needs a second sync on a later date to draw a
  line. This is real history accumulating, not something to fabricate.
- **15 of 111 wanted cards unpriced**, and 11 missing slots have no art — the
  McDonald's 2021 and Delta Species δ cards are named differently upstream
  (`Espeon δ` vs TCGplayer's own spelling), so neither price nor image resolves.
  They fall back to the Pokéball placeholder, which is a supported state.
- **Paradox Fury Premium Collection** has no upstream price row (TCGCSV lists product
  575185 with no price). Its $82.20 is hand-entered from TCGplayer's own page and
  marked `"price_source": "manual"` in `data/sealed.json`; `fetch-prices` keeps and
  counts it, and replaces it automatically once the API has a real price.
- **`CLAUDE_CODE_PROMPT.md`** is the original brief, kept for history. Parts of
  it are stale: its pre-seeded card list was a partial reconstruction, and its
  no-official-artwork rule has been narrowed. `README.md` and this file describe
  what is actually true.
