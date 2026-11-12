# Poké TCG Tracker

A static site for a personal Pokémon card collection — four pages, no framework,
no backend. All data lives in `data/*.json`; card photos live in `images/`.

```bash
npm run build     # build into dist/
npm start         # build, then serve at http://localhost:5173
```

There are no dependencies to install. Node 18+ is all you need.

> **Open the served URL, not the files.** The pages load their data with
> `fetch()` and use ES modules, which browsers block over `file://`. Use
> `npm start`.

---

## The four pages

| Page | File | What it shows |
|---|---|---|
| **Portfolio** | `src/index.html` | Cards with a price, most valuable first, plus the total. Cards with no price are omitted by design. |
| **Cards** | `src/cards.html` | Every card. Grid or sortable table, with filters for set, language, tag and has-price, plus search. |
| **Sets** | `src/sets.html` | Set completion as binder pockets. Filled = owned; dashed = missing. |
| **Sealed** | `src/sealed.html` | Unopened boxes, bundles and collections, with quantities and line values. |
| **Wishlist** | `src/wishlist.html` | Missing set slots **plus** standalone wants, in list or card view, grouped by set, with a max-price filter. |

Clicking an **owned** pocket opens PriceCharting; an **empty** pocket opens a
TCGplayer search. "Got it" on the Wishlist is a local note in your browser
(`localStorage`) — it greys the row out across tabs but does **not** change the
JSON. Update the files for real changes.

---

## Everyday workflows

Say these in the Claude Code chat panel; each one is a skill in `.claude/skills/`.

### Adding cards you just got — "add cards"

Drop photos of the new cards into the chat. Claude reads each card, saves your
photo to `images/cards/c###.jpg` (plus a thumbnail), appends it to
`data/cards.json`, fills the matching set slot and ticks it off the wishlist.

The photos saved are **your own** — the skill does not download card art.

### Adding cards you want — "add to wishlist"

Drop a photo, paste a name, or paste a TCGplayer/PriceCharting URL. Claude
confirms the card, checks you do not already own it or already list it, looks up
the price, and appends it to `data/wishlist.json`.

### Refreshing prices — "update prices"

Claude looks up current TCGplayer / PriceCharting prices, writes
`data/prices.json` with today's date, flags anything that moved more than 20%,
and reports the new collection total.

Then `npm run build` to preview, and push to deploy.

---

## Data files

### `data/cards.json` — cards you own

```json
{
  "id": 20,
  "name": "Umbreon ex",
  "number": "060/131",
  "set": "Prismatic Evolutions",
  "set_key": "pre-dr",
  "rarity": "Double Rare",
  "printing": "Holofoil",
  "lang": "EN",
  "condition": "Near Mint",
  "binder_page": "p03",
  "image": "c020.jpg",
  "tags": ["eevee"],
  "search_string": "Umbreon ex 060"
}
```

- `id` — unique and permanent. Set slots and image filenames point at it, so
  never reuse one, even a gap in the numbering.
- `set_key` — the `key` of the matching set in `sets.json`, or `null`.
  **Prices resolve through this field** (see below).
- `image` — filename inside `images/cards/`, or `null` for a grey placeholder.
- `tags` — `eevee`, `pika`, `starter`, `ralts`, `mega`, `art`, `jp`.
- `warn` — optional note; the Cards page shows a ⚠ you can hover.

### `data/sets.json` — sets you are completing

```json
{
  "key": "pre-dr",
  "name": "Prismatic Evolutions: Eeveelution ex",
  "lang": "EN",
  "note": "The nine double rares, without stamps",
  "slots": [ { "number": "060/131", "name": "Umbreon ex", "card_id": 20 } ]
}
```

`card_id` is the owned card's `id`, or `null` for a gap. Every `null` slot shows
up automatically on the Wishlist page — do not also add it to `wishlist.json`,
or it will be listed twice.

### `data/prices.json` — market values

```json
{
  "checked_date": "Nov 11, 2026",
  "sources": { "pre-dr": "TCGplayer market" },
  "pre-dr": { "060/131": 155.25 }
}
```

Keyed by **set key**, then card number. A price is only applied to a card whose
`set_key` (or set name) matches that bucket — the site will not guess a price
from a card number alone, because numbers repeat across sets and printings. The
plain and the Surprise-Box-stamped `Umbreon ex 060/131` are different cards worth
different amounts, and are priced separately.

`checked_date` drives the "Prices last updated" banner, which turns yellow after
30 days. Prices are plain numbers; `null` means "looked up, not found".

### `data/sealed.json` — unopened product

```json
{
  "id": 1,
  "name": "Mega Evolution Elite Trainer Box [Mega Lucario]",
  "set": "Mega Evolution",
  "qty": 2,
  "price_usd": 113.27,
  "price_checked": "Nov 11, 2026",
  "search_string": "Mega Evolution Elite Trainer Box Mega Lucario"
}
```

`qty` is how many you own; the Sealed page shows unit price × quantity, and the
Portfolio's "Total holdings" tile adds the sealed value to the card value. Add a
product by name and quantity, then run `npm run prices:write` to price it.

### `data/wishlist.json` — standalone wants

Cards you want that are **not** part of a tracked set. Same shape as a card, plus
`"owned": false`, `price_usd` and `price_checked`. Setting `"owned": true` keeps
the history but hides it from the want list.

---

## Images

- `images/cards/c###.jpg` — ~800px wide, quality ~82.
- `images/thumbs/c###.jpg` — 200px wide; used by the table and pocket views.

Both use the card's zero-padded `id`. Cards with no photo use `"image": null` and
render a placeholder, which is a normal state.

To add one by hand:

```bash
python3 -I -c "
from PIL import Image; im=Image.open('photo.png').convert('RGB')
w,h=im.size
im.resize((800,round(h*800/w))).save('images/cards/c179.jpg','JPEG',quality=82,optimize=True)
im.resize((200,round(h*200/w))).save('images/thumbs/c179.jpg','JPEG',quality=78,optimize=True)"
```

---

## Syncing prices and missing-card art

Two scripts pull from [TCGCSV](https://tcgcsv.com), a free daily mirror of
TCGplayer's own price feed. No API key, no scraping.

```bash
npm run prices          # dry run: report, write nothing
npm run prices:write    # update data/prices.json, then sanity-check it
npm run images:need     # download art for cards you don't own
npm run check           # sanity-check prices without re-fetching
```

`fetch-prices` reads each card's **market price** (the median of recent sales),
never the lowest listing. When one number matches several different products —
a Pokémon Center Exclusive, or a same-numbered card from an unrelated set — it
prefers the plain printing, and if that still leaves a tie across sets it
reports the card as ambiguous and leaves it **unpriced** rather than averaging
two different cards together.

`npm run check` verifies every card resolves, that printings of one number stay
in separate buckets, and that no price is implausible. It exits non-zero, so it
can gate a deploy. It writes prices bucketed by `set_key`, fills in each
card's `set_key` so lookups resolve exactly, and appends one point to
`history[]` for the Portfolio chart. Re-running on the same day replaces that
day's point rather than adding a duplicate.

`fetch-missing-images` downloads product shots for cards you do **not** own —
the empty set slots and the wishlist — into `images/need/`, and writes
`data/need-images.json` mapping each slot to its file. Owned cards always keep
your own photos; this never touches `images/cards/`.

Not every card is found: McDonald's 2021 and Delta Species δ cards are named
differently on TCGplayer, so they keep the Pokéball placeholder.

## Regenerating JSON from the old Python files

If you still edit `cards_data.py`, `sets_data.py`, `prices.py` or `wish_data.py`:

```bash
python3 scripts/convert.py --src legacy            # dry run, writes nothing
python3 scripts/convert.py --src legacy --write    # actually write data/*.json
```

It handles tuple-style slots, fills in missing ids and search strings, infers
tags, and backfills each card's `set_key` from the set slots. **It overwrites
`data/*.json`** — commit first.

---

## Deploying

`npm run build` copies `src/`, `data/` and `images/` into `dist/`, after checking
that the JSON parses, that no two cards share an id, and that every referenced
image exists. It fails on broken JSON and warns about dangling references.

Point Vercel or GitHub Pages at `dist/` with no build step beyond `npm run build`.
`dist/` is gitignored.

---

## Current state

147 cards across binder pages p01–p20 · 10 tracked sets (56 of 114 slots filled)
· 53 standalone wants. Every card has its photo; no placeholders.

Card data came from the owner's own `cards_data.py` export, so set, number,
rarity and binder page are authoritative. All 147 entries matched a photo
one-to-one with nothing left over on either side.

**The Portfolio chart** reads `history[]` in `data/prices.json` — one point per
price sync. It draws a marker for the first point and a line from the second on.

**Missing cards** show the real card art, desaturated and dimmed, with a red
NEED chip — so you can see what you're hunting while it still reads clearly as
"not owned". Cards with no product image fall back to a Pokéball placeholder.

**Prices:** all 149 cards are priced from TCGplayer market data
(`node scripts/fetch-prices.mjs --write`). Values are estimates, not an
appraisal.
