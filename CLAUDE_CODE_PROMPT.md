# Pokémon Collection Site — Claude Code Project Brief

## What you're building

A multi-page static site for a personal Pokémon card collection. Four pages, all living in one repo. No backend — data lives in JSON/JS files that the owner updates manually or via a small build script. Cards have photos in a local `/images` folder. Prices are updated infrequently (manual push), so "last updated" timestamps matter.

---

## Tech stack

- **Framework:** Vanilla HTML/CSS/JS (no framework) OR Next.js with static export — your call, but keep it simple. The owner is non-technical; the build should be `npm run build` and the output goes in `/dist`.
- **Data layer:** All card data, set data, prices, and wishlist in `/data/*.json`. Easy to edit by hand or regenerate from a Python script (the owner already has one).
- **Images:** Card images live in `/images/cards/`. Naming convention: `c001.jpg`, `c002.jpg` etc. (already cropped and cleaned). The owner has ~150 card images plus a wishlist of ~50 cards they want.
- **Hosting target:** Vercel or GitHub Pages — static only.

---

## Pages

### 1. Portfolio (`/`) — "What my collection is worth"

Highest-value cards listed in descending price order. This is the showpiece page.

- Each card: image, name, number, set, language badge (EN / JP), current market price in USD, and a "last checked" date.
- A total estimated collection value at the top.
- A prominent **"Prices last updated: [date]"** banner — the date comes from `/data/prices.json` and is set by the owner when they manually update prices. Make it visually obvious so the owner remembers to update it.
- Filter/sort: by price (default), by set, by language. No search needed.
- Only show cards that have a price in the data. Cards without prices are silently omitted.
- **Do not** auto-fetch prices; this is a manual push site.

### 2. Card Database (`/cards`) — "Every card I own"

A filterable gallery/table of all owned cards.

- Each card entry: card image (or a placeholder if no image), name, number, set, rarity, printing (Holofoil / Reverse / etc.), language, condition, binder page reference, estimated price (if available), **PriceCharting link**, **TCGplayer listing link**.
- Toggle between grid view (images front and center) and table/list view (all fields visible, sortable columns).
- Filters: by set, by language (EN / JP), by tag (eevee, pika, starter, ralts, mega, etc.), by has-price / no-price.
- Each card's TCGplayer link is a search URL: `https://www.tcgplayer.com/search/pokemon/product?q=<search string>` where the search string comes from the card data.
- Each card's PriceCharting link: `https://www.pricecharting.com/search-products?type=pokemon&q=<name+number>`.

### 3. Sets (`/sets`) — "What I have vs. what I need"

A set-completion tracker. This is the most complex page; a working version already exists as an artifact — replicate that logic.

**Sets to track (with the cards the owner currently owns marked):**

The existing `/data/sets.json` and `/data/cards.json` define this. Import them exactly. The page should:

- Show each set as a binder-pocket grid (3-across for a 9-pocket page layout).
- Filled pockets = owned card (card image, name, number).
- Empty pockets = missing card (card name, number, estimated price in light grey if available).
- A set header with: set name, language badge, completion count (e.g. "7 / 9"), and a progress bar.
- Clicking an empty pocket opens the TCGplayer search for that card in a new tab.
- Clicking an owned pocket opens the PriceCharting page for that card.

### 4. Wishlist (`/wishlist`) — "Cards I want"

Two sources feed this list:
1. **Missing from sets** — any card in `/data/sets.json` with no owned card ID.
2. **Standalone wants** — a separate `/data/wishlist.json` the owner maintains manually (cards they want that aren't part of a tracked set).

Display:
- Sortable by: Set (default), Price (cheapest first), Price (most expensive first).
- Each row: card image (placeholder if none), name, number, set, language, estimated price, TCGplayer link, PriceCharting link.
- A **"Got it"** button per card — clicking marks it as owned in `localStorage` so it greys out / disappears across tabs. (This is a convenience; real data updates still happen in the JSON files.)
- Total estimated cost of the wishlist at the top.
- Filter: show only cards under $X (slider or input).

---

## Data files the owner will provide

The owner is migrating from a Python build system. The new repo expects these JSON files in `/data/`:

| File | Contents |
|---|---|
| `cards.json` | Array of owned cards. Fields: `id`, `name`, `number`, `set`, `rarity`, `printing`, `lang`, `condition`, `binder_page`, `image` (filename in `/images/cards/`), `tags` (array), `search_string`, `warn` |
| `sets.json` | Array of tracked sets. Fields: `key`, `name`, `lang`, `note`, `slots` (array of `{number, name, card_id or null}`) |
| `prices.json` | Object keyed by `set_key` → `{number: price_usd}`, plus a top-level `checked_date` string and `sources` object |
| `wishlist.json` | Array of wanted cards not tied to a set. Same fields as a card entry but with `owned: false` and no `image` or `binder_page`. |

**Include a `/scripts/convert.py`** that reads the existing Python data files (`cards_data.py`, `sets_data.py`, `prices.py`, `wish_data.py`) and outputs the four JSON files above. The Python data files use a known structure (see below) — write the converter to match it exactly.

---

## Existing Python data structure (for the converter)

```python
# cards_data.py — C is a list of dicts with keys:
# page, box, name, num, set, rarity, printing, lang, checked, warn, search, tags (space-separated string)

# sets_data.py — SETS is a list of dicts with keys:
# key, name, lang, note, tcg, slots (list of (number, name, card_id_or_None) tuples)

# prices.py — P is a dict of {set_key: {number: price_usd}}
# SRC is a dict of {set_key: source_string}
# CHECKED is a date string like "Nov 11, 2026"

# wish_data.py — wishlist of wanted cards not in sets
```

---

## Image handling

- Card images: `/images/cards/c001.jpg` through `/images/cards/c150.jpg` (approx). The filename is stored in `cards.json` as the `image` field.
- Thumbnail vs. full: generate 200px-wide thumbnails at build time (via a sharp/imagemin step or just serve the originals — owner's call, but note the originals are ~800px wide already-cropped JPEGs).
- Placeholder: a simple grey card-back SVG inline in the HTML for cards without images.
- **No Pokémon official artwork** — card images are the owner's own photos of their cards.

---

## Design direction

- Dark-mode first, light-mode toggle.
- Clean, collector-focused aesthetic — think binder/showcase, not marketplace. Subtle card-back texture or gradient as the site background is fine.
- Card grid uses a consistent pocket size; images fill the pocket with `object-fit: cover`.
- Typography: a single sans-serif family (Inter or similar). Prices in a monospaced face so they column-align.
- EN / JP language badges: small coloured chips (blue = EN, red = JP).
- Mobile-responsive — the owner checks this on their phone.
- No animations except a subtle hover lift on cards.

---

## "Last updated" UX requirement

Prices are updated infrequently (every few weeks). The site must make this clear:

- Portfolio page header: `"Prices last updated [date] · Values are estimates only"` — large enough to see at a glance.
- If `checked_date` in `prices.json` is more than 30 days ago, show a yellow warning banner: `"⚠ Prices may be out of date"`.

---

## Repo structure to scaffold

```
/
├── data/
│   ├── cards.json
│   ├── sets.json
│   ├── prices.json
│   └── wishlist.json
├── images/
│   └── cards/          ← owner drops card photos here
├── scripts/
│   └── convert.py      ← converts the old Python files to JSON
├── src/
│   ├── index.html      ← Portfolio
│   ├── cards.html      ← Database
│   ├── sets.html       ← Set tracker
│   ├── wishlist.html   ← Wishlist
│   ├── css/
│   │   └── main.css
│   └── js/
│       ├── data.js     ← loads the JSON files
│       ├── portfolio.js
│       ├── cards.js
│       ├── sets.js
│       └── wishlist.js
├── dist/               ← build output (gitignored)
└── package.json        ← just a build/copy step, no framework needed
```

---

## Owned card data (pre-seeded `data/cards.json`)

The owner already has 147 cards documented. Use this exact data to pre-populate `data/cards.json` — do not ask the owner to re-enter it. Card images are in `/images/cards/` using the `c###.jpg` naming below.

```json
[
  {"id": 1, "name": "Umbreon ex", "number": "060/131", "set": "Prismatic Evolutions (Surprise Box stamp)", "rarity": "Double Rare", "printing": "Holofoil · Prismatic Evolutions stamp", "lang": "EN", "condition": "Near Mint", "binder_page": "p01", "image": "c001.jpg", "tags": ["eevee"], "search_string": "Umbreon ex 060 stamp"},
  {"id": 2, "name": "Eevee ex", "number": "075/131", "set": "Prismatic Evolutions (Surprise Box stamp)", "rarity": "Double Rare", "printing": "Holofoil · Prismatic Evolutions stamp", "lang": "EN", "condition": "Near Mint", "binder_page": "p01", "image": "c002.jpg", "tags": ["eevee"], "search_string": "Eevee ex 075 stamp"},
  {"id": 6, "name": "Sylveon ex", "number": "212/187", "set": "Terastal Festival ex (sv8a)", "rarity": "SAR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p01", "image": "c006.jpg", "tags": ["eevee", "art", "jp"], "search_string": "Sylveon ex 212/187 sv8a"},
  {"id": 7, "name": "Espeon ex", "number": "211/187", "set": "Terastal Festival ex (sv8a)", "rarity": "SAR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p01", "image": "c007.jpg", "tags": ["eevee", "art", "jp"], "search_string": "Espeon ex 211/187 sv8a"},
  {"id": 8, "name": "Flareon ex", "number": "202/187", "set": "Terastal Festival ex (sv8a)", "rarity": "SAR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p01", "image": "c008.jpg", "tags": ["eevee", "art", "jp"], "search_string": "Flareon ex 202/187 sv8a"},
  {"id": 9, "name": "Jolteon ex", "number": "052/187", "set": "Terastal Festival ex (sv8a)", "rarity": "Double Rare (RR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p02", "image": "c009.jpg", "tags": ["eevee", "jp"], "search_string": "Jolteon ex 052/187 sv8a"},
  {"id": 10, "name": "Flareon ex", "number": "022/187", "set": "Terastal Festival ex (sv8a)", "rarity": "Double Rare (RR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p02", "image": "c010.jpg", "tags": ["eevee", "jp"], "search_string": "Flareon ex 022/187 sv8a"},
  {"id": 11, "name": "Vaporeon ex", "number": "031/187", "set": "Terastal Festival ex (sv8a)", "rarity": "Double Rare (RR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p02", "image": "c011.jpg", "tags": ["eevee", "jp"], "search_string": "Vaporeon ex 031/187 sv8a"},
  {"id": 12, "name": "Umbreon ex", "number": "093/187", "set": "Terastal Festival ex (sv8a)", "rarity": "Double Rare (RR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p02", "image": "c012.jpg", "tags": ["eevee", "jp"], "search_string": "Umbreon ex 093/187 sv8a"},
  {"id": 13, "name": "Eevee ex", "number": "126/187", "set": "Terastal Festival ex (sv8a)", "rarity": "Double Rare (RR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p02", "image": "c013.jpg", "tags": ["eevee", "jp"], "search_string": "Eevee ex 126/187 sv8a"},
  {"id": 14, "name": "Espeon ex", "number": "063/187", "set": "Terastal Festival ex (sv8a)", "rarity": "Double Rare (RR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p02", "image": "c014.jpg", "tags": ["eevee", "jp"], "search_string": "Espeon ex 063/187 sv8a"},
  {"id": 15, "name": "Glaceon ex", "number": "041/187", "set": "Terastal Festival ex (sv8a)", "rarity": "Double Rare (RR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p02", "image": "c015.jpg", "tags": ["eevee", "jp"], "search_string": "Glaceon ex 041/187 sv8a"},
  {"id": 16, "name": "Sylveon ex", "number": "069/187", "set": "Terastal Festival ex (sv8a)", "rarity": "Double Rare (RR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p02", "image": "c016.jpg", "tags": ["eevee", "jp"], "search_string": "Sylveon ex 069/187 sv8a"},
  {"id": 17, "name": "Leafeon ex", "number": "003/187", "set": "Terastal Festival ex (sv8a)", "rarity": "Double Rare (RR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p02", "image": "c017.jpg", "tags": ["eevee", "jp"], "search_string": "Leafeon ex 003/187 sv8a"},
  {"id": 18, "name": "Flareon ex", "number": "014/131", "set": "Prismatic Evolutions", "rarity": "Double Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p03", "image": "c018.jpg", "tags": ["eevee"], "search_string": "Flareon ex 014"},
  {"id": 19, "name": "Jolteon ex", "number": "030/131", "set": "Prismatic Evolutions", "rarity": "Double Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p03", "image": "c019.jpg", "tags": ["eevee"], "search_string": "Jolteon ex 030"},
  {"id": 20, "name": "Umbreon ex", "number": "060/131", "set": "Prismatic Evolutions", "rarity": "Double Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p03", "image": "c020.jpg", "tags": ["eevee"], "search_string": "Umbreon ex 060"},
  {"id": 21, "name": "Eevee", "number": "SVP 173", "set": "SV Black Star Promos", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p03", "image": "c021.jpg", "tags": ["eevee"], "search_string": "Eevee SVP 173"},
  {"id": 22, "name": "Sylveon ex", "number": "086/191", "set": "Surging Sparks", "rarity": "Double Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p03", "image": "c022.jpg", "tags": ["eevee"], "search_string": "Sylveon ex 086"},
  {"id": 23, "name": "Leafeon ex", "number": "006/131", "set": "Prismatic Evolutions", "rarity": "Double Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p03", "image": "c023.jpg", "tags": ["eevee"], "search_string": "Leafeon ex 006"},
  {"id": 24, "name": "Jolteon", "number": "193/184", "set": "VMAX Climax (s8b)", "rarity": "Character Rare (CHR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p04", "image": "c024.jpg", "tags": ["eevee", "art", "jp"], "search_string": "Jolteon 193/184 s8b"},
  {"id": 25, "name": "Vaporeon", "number": "189/184", "set": "VMAX Climax (s8b)", "rarity": "Character Rare (CHR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p04", "image": "c025.jpg", "tags": ["eevee", "art", "jp"], "search_string": "Vaporeon 189/184 s8b"},
  {"id": 26, "name": "Flareon", "number": "188/184", "set": "VMAX Climax (s8b)", "rarity": "Character Rare (CHR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p04", "image": "c026.jpg", "tags": ["eevee", "art", "jp"], "search_string": "Flareon 188/184 s8b"},
  {"id": 27, "name": "Eevee", "number": "210/184", "set": "VMAX Climax (s8b)", "rarity": "Character Rare (CHR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p04", "image": "c027.jpg", "tags": ["eevee", "art", "jp"], "search_string": "Eevee 210/184 s8b"},
  {"id": 28, "name": "Umbreon ex", "number": "092/128", "set": "30th Celebration", "rarity": "Double Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p04", "image": "c028.jpg", "tags": ["eevee"], "search_string": "Umbreon ex 092 30th Celebration"},
  {"id": 29, "name": "Espeon ex", "number": "070/128", "set": "30th Celebration", "rarity": "Double Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p04", "image": "c029.jpg", "tags": ["eevee"], "search_string": "Espeon ex 070 30th Celebration"},
  {"id": 30, "name": "Sylveon ex", "number": "071/128", "set": "30th Celebration", "rarity": "Double Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p04", "image": "c030.jpg", "tags": ["eevee"], "search_string": "Sylveon ex 071 30th Celebration"},
  {"id": 31, "name": "Umbreon", "number": "091/128", "set": "30th Celebration", "rarity": "Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p04", "image": "c031.jpg", "tags": ["eevee"], "search_string": "Umbreon 091 30th Celebration"},
  {"id": 32, "name": "Espeon", "number": "069/128", "set": "30th Celebration", "rarity": "Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p04", "image": "c032.jpg", "tags": ["eevee"], "search_string": "Espeon 069 30th Celebration"},
  {"id": 33, "name": "Pikachu", "number": "036/128", "set": "30th Celebration", "rarity": "Pikachu Rare (14/30)", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p05", "image": "c033.jpg", "tags": ["pika"], "search_string": "Pikachu 036 30th Celebration"},
  {"id": 34, "name": "Pikachu", "number": "028/128", "set": "30th Celebration", "rarity": "Pikachu Rare (06/30)", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p05", "image": "c034.jpg", "tags": ["pika"], "search_string": "Pikachu 028 30th Celebration"},
  {"id": 35, "name": "Eevee", "number": "116/128", "set": "30th Celebration", "rarity": "Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p05", "image": "c035.jpg", "tags": ["eevee"], "search_string": "Eevee 116 30th Celebration"},
  {"id": 36, "name": "Umbreon VMAX", "number": "101/184", "set": "VMAX Climax (s8b)", "rarity": "RRR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p05", "image": "c036.jpg", "tags": ["eevee", "jp"], "search_string": "Umbreon VMAX 101/184 s8b"},
  {"id": 37, "name": "Espeon VMAX", "number": "004/004", "set": "VMAX Special Set Eevee Heroes (SP4)", "rarity": "Promo/Special Set", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p05", "image": "c037.jpg", "tags": ["eevee", "jp"], "search_string": "Espeon VMAX 004/004 SP4"},
  {"id": 38, "name": "Leafeon VSTAR", "number": "012/172", "set": "VSTAR Universe (s12a)", "rarity": "RRR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p05", "image": "c038.jpg", "tags": ["eevee", "jp"], "search_string": "Leafeon VSTAR 012/172 s12a"},
  {"id": 39, "name": "Espeon V", "number": "SWSH201", "set": "SWSH Black Star Promos", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p05", "image": "c039.jpg", "tags": ["eevee"], "search_string": "Espeon V SWSH201"},
  {"id": 40, "name": "Espeon VMAX", "number": "065/203", "set": "Evolving Skies", "rarity": "Ultra Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p05", "image": "c040.jpg", "tags": ["eevee"], "search_string": "Espeon VMAX 065"},
  {"id": 41, "name": "Squirtle", "number": "170/165", "set": "Pokémon Card 151 (sv2a)", "rarity": "AR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p06", "image": "c041.jpg", "tags": ["starter", "art", "jp"], "search_string": "Squirtle 170/165 sv2a"},
  {"id": 42, "name": "Wartortle", "number": "171/165", "set": "Pokémon Card 151 (sv2a)", "rarity": "AR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p06", "image": "c042.jpg", "tags": ["starter", "art", "jp"], "search_string": "Wartortle 171/165 sv2a"},
  {"id": 43, "name": "Bulbasaur", "number": "166/165", "set": "Pokémon Card 151 (sv2a)", "rarity": "AR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p06", "image": "c043.jpg", "tags": ["starter", "art", "jp"], "search_string": "Bulbasaur 166/165 sv2a"},
  {"id": 44, "name": "Ivysaur", "number": "167/165", "set": "Pokémon Card 151 (sv2a)", "rarity": "AR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p06", "image": "c044.jpg", "tags": ["starter", "art", "jp"], "search_string": "Ivysaur 167/165 sv2a"},
  {"id": 45, "name": "Fuecoco ex", "number": "147/128", "set": "30th Celebration", "rarity": "Special Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p06", "image": "c045.jpg", "tags": ["starter", "art"], "search_string": "Fuecoco ex 147 30th Celebration"},
  {"id": 46, "name": "Froakie", "number": "088/086", "set": "Chaos Rising", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p07", "image": "c046.jpg", "tags": ["starter", "art"], "search_string": "Froakie 088 Chaos Rising"},
  {"id": 47, "name": "Frogadier", "number": "089/086", "set": "Chaos Rising", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p07", "image": "c047.jpg", "tags": ["starter", "art"], "search_string": "Frogadier 089 Chaos Rising"},
  {"id": 48, "name": "Ralts", "number": "211/198", "set": "Scarlet & Violet", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p07", "image": "c048.jpg", "tags": ["ralts", "art"], "search_string": "Ralts 211"},
  {"id": 49, "name": "Kirlia", "number": "212/198", "set": "Scarlet & Violet", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p07", "image": "c049.jpg", "tags": ["ralts", "art"], "search_string": "Kirlia 212"},
  {"id": 50, "name": "Bulbasaur", "number": "MEP 037", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p08", "image": "c050.jpg", "tags": ["starter"], "search_string": "Bulbasaur MEP 037"},
  {"id": 51, "name": "Charmander", "number": "MEP 038", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p08", "image": "c051.jpg", "tags": ["starter"], "search_string": "Charmander MEP 038"},
  {"id": 52, "name": "Squirtle", "number": "MEP 039", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p08", "image": "c052.jpg", "tags": ["starter"], "search_string": "Squirtle MEP 039"},
  {"id": 53, "name": "Mudkip", "number": "MEP 057", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p08", "image": "c053.jpg", "tags": ["starter"], "search_string": "Mudkip MEP 057"},
  {"id": 54, "name": "Sprigatito", "number": "MEP 061", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p08", "image": "c054.jpg", "tags": ["starter"], "search_string": "Sprigatito MEP 061"},
  {"id": 55, "name": "Froakie", "number": "MEP 060", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p08", "image": "c055.jpg", "tags": ["starter"], "search_string": "Froakie MEP 060"},
  {"id": 56, "name": "Totodile", "number": "MEP 048", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p08", "image": "c056.jpg", "tags": ["starter"], "search_string": "Totodile MEP 048"},
  {"id": 57, "name": "Quaxly", "number": "MEP 063", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p08", "image": "c057.jpg", "tags": ["starter"], "search_string": "Quaxly MEP 063"},
  {"id": 58, "name": "Chespin", "number": "MEP 058", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p08", "image": "c058.jpg", "tags": ["starter"], "search_string": "Chespin MEP 058"},
  {"id": 59, "name": "Chimchar", "number": "MEP 041", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p09", "image": "c059.jpg", "tags": ["starter"], "search_string": "Chimchar MEP 041"},
  {"id": 60, "name": "Turtwig", "number": "MEP 040", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p09", "image": "c060.jpg", "tags": ["starter"], "search_string": "Turtwig MEP 040"},
  {"id": 61, "name": "Piplup", "number": "MEP 042", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p09", "image": "c061.jpg", "tags": ["starter"], "search_string": "Piplup MEP 042"},
  {"id": 62, "name": "Tepig", "number": "MEP 050", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p09", "image": "c062.jpg", "tags": ["starter"], "search_string": "Tepig MEP 050"},
  {"id": 63, "name": "Snivy", "number": "MEP 049", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p09", "image": "c063.jpg", "tags": ["starter"], "search_string": "Snivy MEP 049"},
  {"id": 64, "name": "Oshawott", "number": "MEP 051", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p09", "image": "c064.jpg", "tags": ["starter"], "search_string": "Oshawott MEP 051"},
  {"id": 65, "name": "Litten", "number": "MEP 044", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p09", "image": "c065.jpg", "tags": ["starter"], "search_string": "Litten MEP 044"},
  {"id": 66, "name": "Rowlet", "number": "MEP 043", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p09", "image": "c066.jpg", "tags": ["starter"], "search_string": "Rowlet MEP 043"},
  {"id": 67, "name": "Popplio", "number": "MEP 045", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p09", "image": "c067.jpg", "tags": ["starter"], "search_string": "Popplio MEP 045"},
  {"id": 68, "name": "Scorbunny", "number": "MEP 053", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p10", "image": "c068.jpg", "tags": ["starter"], "search_string": "Scorbunny MEP 053"},
  {"id": 69, "name": "Grookey", "number": "MEP 052", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p10", "image": "c069.jpg", "tags": ["starter"], "search_string": "Grookey MEP 052"},
  {"id": 70, "name": "Sobble", "number": "MEP 054", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p10", "image": "c070.jpg", "tags": ["starter"], "search_string": "Sobble MEP 054"},
  {"id": 71, "name": "Fuecoco", "number": "MEP 062", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p10", "image": "c071.jpg", "tags": ["starter"], "search_string": "Fuecoco MEP 062"},
  {"id": 72, "name": "Cyndaquil", "number": "MEP 047", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p10", "image": "c072.jpg", "tags": ["starter"], "search_string": "Cyndaquil MEP 047"},
  {"id": 73, "name": "Treecko", "number": "MEP 055", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p10", "image": "c073.jpg", "tags": ["starter"], "search_string": "Treecko MEP 055"},
  {"id": 74, "name": "Chikorita", "number": "MEP 046", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p10", "image": "c074.jpg", "tags": ["starter"], "search_string": "Chikorita MEP 046"},
  {"id": 75, "name": "Fennekin", "number": "MEP 059", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p10", "image": "c075.jpg", "tags": ["starter"], "search_string": "Fennekin MEP 059"},
  {"id": 76, "name": "Torchic", "number": "MEP 056", "set": "Mega Evolution Black Star Promos (First Partner Illustration Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p10", "image": "c076.jpg", "tags": ["starter"], "search_string": "Torchic MEP 056"},
  {"id": 77, "name": "Wally", "number": "RC27/RC32", "set": "Generations (Radiant Collection)", "rarity": "Radiant Collection", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p11", "image": "c077.jpg", "tags": ["ralts"], "search_string": "Wally RC27"},
  {"id": 78, "name": "Gallade", "number": "81/113", "set": "Legendary Treasures", "rarity": "Rare", "printing": "Holo or Reverse — check", "lang": "EN", "condition": "Near Mint", "binder_page": "p11", "image": "c078.jpg", "tags": ["ralts"], "search_string": "Gallade 81/113"},
  {"id": 79, "name": "Gallade", "number": "244/236", "set": "Cosmic Eclipse", "rarity": "Full Art (with Wally)", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p11", "image": "c079.jpg", "tags": ["ralts", "art"], "search_string": "Gallade 244/236"},
  {"id": 80, "name": "M Gallade-EX", "number": "35/108", "set": "Roaring Skies", "rarity": "Ultra Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p11", "image": "c080.jpg", "tags": ["ralts", "mega"], "search_string": "M Gallade EX 35/108"},
  {"id": 81, "name": "M Gallade-EX", "number": "100/108", "set": "Roaring Skies", "rarity": "Full Art", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p11", "image": "c081.jpg", "tags": ["ralts", "mega"], "search_string": "M Gallade EX 100/108"},
  {"id": 82, "name": "Mega Gallade ex", "number": "048/086", "set": "Chaos Rising", "rarity": "Double Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p11", "image": "c082.jpg", "tags": ["ralts", "mega"], "search_string": "Mega Gallade ex 048"},
  {"id": 83, "name": "Gallade V", "number": "TG19/TG30", "set": "Lost Origin Trainer Gallery", "rarity": "Trainer Gallery", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p11", "image": "c083.jpg", "tags": ["ralts", "art"], "search_string": "Gallade V TG19"},
  {"id": 84, "name": "Gallade V", "number": "089/071", "set": "Dark Phantasma (s10a)", "rarity": "CSR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p11", "image": "c084.jpg", "tags": ["ralts", "art", "jp"], "search_string": "Gallade V 089/071 s10a"},
  {"id": 85, "name": "Gallade V", "number": "181/196", "set": "Lost Origin", "rarity": "Full Art", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p11", "image": "c085.jpg", "tags": ["ralts"], "search_string": "Gallade V 181/196"},
  {"id": 86, "name": "Gardevoir", "number": "196/184", "set": "VMAX Climax (s8b)", "rarity": "Character Rare (CHR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p12", "image": "c086.jpg", "tags": ["ralts", "art", "jp"], "search_string": "Gardevoir 196/184 s8b"},
  {"id": 87, "name": "Gardevoir", "number": "072/068", "set": "Incandescent Arcana (s11a)", "rarity": "Character Rare (CHR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p12", "image": "c087.jpg", "tags": ["ralts", "art", "jp"], "search_string": "Gardevoir 072/068 s11a"},
  {"id": 88, "name": "Mega Gardevoir ex", "number": "MEP 032", "set": "Mega Evolution Black Star Promos (Ascended Heroes Poster Collection)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p12", "image": "c088.jpg", "tags": ["ralts", "mega"], "search_string": "Mega Gardevoir ex MEP 032"},
  {"id": 89, "name": "Mega Gardevoir ex", "number": "060/132", "set": "Mega Evolution", "rarity": "Double Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p12", "image": "c089.jpg", "tags": ["ralts", "mega"], "search_string": "Mega Gardevoir ex 060"},
  {"id": 90, "name": "Charcadet", "number": "MEP 022", "set": "Mega Evolution Black Star Promos (Phantasmal Flames ETB)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p12", "image": "c090.jpg", "tags": [], "search_string": "Charcadet MEP 022"},
  {"id": 91, "name": "Gastly", "number": "177/162", "set": "Temporal Forces", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p13", "image": "c091.jpg", "tags": ["art"], "search_string": "Gastly 177"},
  {"id": 92, "name": "Gengar", "number": "TG06/TG30", "set": "Lost Origin Trainer Gallery", "rarity": "Trainer Gallery", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p13", "image": "c092.jpg", "tags": ["art"], "search_string": "Gengar TG06"},
  {"id": 93, "name": "Lucario VSTAR", "number": "SWSH291", "set": "SWSH Black Star Promos", "rarity": "Promo (full art)", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p13", "image": "c093.jpg", "tags": [], "search_string": "Lucario VSTAR SWSH291"},
  {"id": 94, "name": "Ceruledge ex", "number": "036/191", "set": "Surging Sparks", "rarity": "Double Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p13", "image": "c094.jpg", "tags": [], "search_string": "Ceruledge ex 036"},
  {"id": 95, "name": "Ceruledge", "number": "109/106", "set": "Super Electric Breaker (sv8)", "rarity": "AR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p13", "image": "c095.jpg", "tags": ["art", "jp"], "search_string": "Ceruledge 109/106 sv8"},
  {"id": 96, "name": "Ceruledge ex", "number": "203/187", "set": "Terastal Festival ex (sv8a)", "rarity": "SAR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p13", "image": "c096.jpg", "tags": ["art", "jp"], "search_string": "Ceruledge ex 203/187 sv8a"},
  {"id": 97, "name": "Lapras ex", "number": "SVP 164", "set": "SV Black Star Promos", "rarity": "Promo (gold)", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p13", "image": "c097.jpg", "tags": [], "search_string": "Lapras ex SVP 164"},
  {"id": 98, "name": "Alcremie VMAX", "number": "073/072", "set": "Shining Fates", "rarity": "Secret Rare (rainbow)", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p13", "image": "c098.jpg", "tags": ["art"], "search_string": "Alcremie VMAX 073/072"},
  {"id": 99, "name": "Terapagos ex", "number": "226/187", "set": "Terastal Festival ex (sv8a)", "rarity": "SAR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p13", "image": "c099.jpg", "tags": ["art", "jp", "legend"], "search_string": "Terapagos ex 226/187 sv8a"},
  {"id": 100, "name": "N's Reshiram", "number": "167/159", "set": "Journey Together", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p14", "image": "c100.jpg", "tags": ["art", "legend"], "search_string": "N's Reshiram 167"},
  {"id": 101, "name": "Zekrom", "number": "TG05/TG30", "set": "Brilliant Stars Trainer Gallery", "rarity": "Trainer Gallery", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p14", "image": "c101.jpg", "tags": ["art", "legend"], "search_string": "Zekrom TG05"},
  {"id": 102, "name": "Milotic", "number": "070/068", "set": "Incandescent Arcana (s11a)", "rarity": "Character Rare (CHR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p14", "image": "c102.jpg", "tags": ["art", "jp"], "search_string": "Milotic 070/068 s11a"},
  {"id": 103, "name": "Mega Darkrai ex", "number": "099/081", "set": "Abyss Eye (M5)", "rarity": "SR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p14", "image": "c103.jpg", "tags": ["mega", "jp", "legend"], "search_string": "Mega Darkrai ex 099/081"},
  {"id": 104, "name": "Rayquaza VMAX", "number": "111/203", "set": "Evolving Skies", "rarity": "Ultra Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p14", "image": "c104.jpg", "tags": ["legend"], "search_string": "Rayquaza VMAX 111"},
  {"id": 105, "name": "Zeraora V", "number": "224/184", "set": "VMAX Climax (s8b)", "rarity": "CSR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p14", "image": "c105.jpg", "tags": ["art", "jp"], "search_string": "Zeraora V 224/184 s8b"},
  {"id": 106, "name": "Noibat", "number": "169/159", "set": "Journey Together", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p14", "image": "c106.jpg", "tags": ["art"], "search_string": "Noibat 169"},
  {"id": 107, "name": "Nidoking", "number": "174/165", "set": "Pokémon Card 151 (sv2a)", "rarity": "AR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p14", "image": "c107.jpg", "tags": ["art", "jp"], "search_string": "Nidoking 174/165 sv2a"},
  {"id": 108, "name": "Mewtwo", "number": "183/165", "set": "Pokémon Card 151 (sv2a)", "rarity": "AR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p14", "image": "c108.jpg", "tags": ["art", "jp", "legend"], "search_string": "Mewtwo 183/165 sv2a"},
  {"id": 109, "name": "Tatsugiri", "number": "186/167", "set": "Twilight Masquerade", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p15", "image": "c109.jpg", "tags": ["art"], "search_string": "Tatsugiri 186"},
  {"id": 110, "name": "Spheal", "number": "199/191", "set": "Surging Sparks", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p15", "image": "c110.jpg", "tags": ["art"], "search_string": "Spheal 199"},
  {"id": 111, "name": "Sunflora", "number": "169/167", "set": "Twilight Masquerade", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p15", "image": "c111.jpg", "tags": ["art"], "search_string": "Sunflora 169"},
  {"id": 112, "name": "Tangela", "number": "178/165", "set": "Scarlet & Violet—151", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p15", "image": "c112.jpg", "tags": ["art"], "search_string": "Tangela 178"},
  {"id": 113, "name": "Fidough", "number": "213/198", "set": "Scarlet & Violet", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p15", "image": "c113.jpg", "tags": ["art"], "search_string": "Fidough 213"},
  {"id": 114, "name": "Milcery", "number": "152/142", "set": "Stellar Crown", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p15", "image": "c114.jpg", "tags": ["art"], "search_string": "Milcery 152"},
  {"id": 115, "name": "Cleffa", "number": "202/197", "set": "Obsidian Flames", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p15", "image": "c115.jpg", "tags": ["art"], "search_string": "Cleffa 202"},
  {"id": 116, "name": "Swablu", "number": "213/182", "set": "Paradox Rift", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p15", "image": "c116.jpg", "tags": ["art"], "search_string": "Swablu 213"},
  {"id": 117, "name": "Altaria ex", "number": "253/182", "set": "Paradox Rift", "rarity": "Special Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p15", "image": "c117.jpg", "tags": ["art"], "search_string": "Altaria ex 253"},
  {"id": 118, "name": "Litten", "number": "075/071", "set": "Cyber Judge (sv5M)", "rarity": "AR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p16", "image": "c118.jpg", "tags": ["starter", "art", "jp"], "search_string": "Litten 075/071 sv5M"},
  {"id": 119, "name": "Pawmi", "number": "226/091", "set": "Paldean Fates", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p16", "image": "c119.jpg", "tags": ["art"], "search_string": "Pawmi 226"},
  {"id": 120, "name": "Pawmot", "number": "209/198", "set": "Scarlet & Violet", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p16", "image": "c120.jpg", "tags": ["art"], "search_string": "Pawmot 209"},
  {"id": 121, "name": "Pikachu", "number": "SVP 027", "set": "SV Black Star Promos", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p16", "image": "c121.jpg", "tags": ["pika"], "search_string": "Pikachu SVP 027"},
  {"id": 122, "name": "Pikachu", "number": "173/165", "set": "Pokémon Card 151 (sv2a)", "rarity": "AR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p16", "image": "c122.jpg", "tags": ["pika", "art", "jp"], "search_string": "Pikachu 173/165 sv2a"},
  {"id": 123, "name": "Snorlax", "number": "181/165", "set": "Pokémon Card 151 (sv2a)", "rarity": "AR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p16", "image": "c123.jpg", "tags": ["art", "jp"], "search_string": "Snorlax 181/165 sv2a"},
  {"id": 124, "name": "Beartic", "number": "110/086", "set": "Black Bolt", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p16", "image": "c124.jpg", "tags": ["art"], "search_string": "Beartic 110 Black Bolt"},
  {"id": 125, "name": "Horsea", "number": "067/064", "set": "Shrouded Fable", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p16", "image": "c125.jpg", "tags": ["art"], "search_string": "Horsea 067"},
  {"id": 126, "name": "Lapras", "number": "GG05/GG70", "set": "Crown Zenith Galarian Gallery", "rarity": "Galarian Gallery", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p16", "image": "c126.jpg", "tags": ["art"], "search_string": "Lapras GG05"},
  {"id": 127, "name": "Psyduck", "number": "175/165", "set": "Pokémon Card 151 (sv2a)", "rarity": "AR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p17", "image": "c127.jpg", "tags": ["art", "jp"], "search_string": "Psyduck 175/165 sv2a"},
  {"id": 128, "name": "Phanpy", "number": "115/106", "set": "Super Electric Breaker (sv8)", "rarity": "AR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p17", "image": "c128.jpg", "tags": ["art", "jp"], "search_string": "Phanpy 115/106 sv8"},
  {"id": 129, "name": "Pidove", "number": "148/086", "set": "Black Bolt", "rarity": "Illustration Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p17", "image": "c129.jpg", "tags": ["art"], "search_string": "Pidove 148 Black Bolt"},
  {"id": 130, "name": "Ditto", "number": "GG22/GG70", "set": "Crown Zenith Galarian Gallery", "rarity": "Galarian Gallery", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p17", "image": "c130.jpg", "tags": ["art"], "search_string": "Ditto GG22"},
  {"id": 131, "name": "Dedenne", "number": "200/184", "set": "VMAX Climax (s8b)", "rarity": "Character Rare (CHR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p17", "image": "c131.jpg", "tags": ["art", "jp"], "search_string": "Dedenne 200/184 s8b"},
  {"id": 132, "name": "Mega Scrafty ex", "number": "270/217", "set": "Ascended Heroes", "rarity": "Mega Attack Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p18", "image": "c132.jpg", "tags": ["mega", "art"], "search_string": "Mega Scrafty ex 270"},
  {"id": 133, "name": "Mega Scrafty ex", "number": "231/193", "set": "MEGA Dream ex (m2a)", "rarity": "MA", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p18", "image": "c133.jpg", "tags": ["mega", "art", "jp"], "search_string": "Mega Scrafty ex 231/193 m2a"},
  {"id": 134, "name": "Mega Hawlucha ex", "number": "268/217", "set": "Ascended Heroes", "rarity": "Mega Attack Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p18", "image": "c134.jpg", "tags": ["mega", "art"], "search_string": "Mega Hawlucha ex 268"},
  {"id": 135, "name": "M Slowbro-EX", "number": "27/108", "set": "Evolutions", "rarity": "Ultra Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p18", "image": "c135.jpg", "tags": ["mega"], "search_string": "M Slowbro EX 27/108"},
  {"id": 136, "name": "M Venusaur-EX", "number": "2/108", "set": "Evolutions", "rarity": "Ultra Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p18", "image": "c136.jpg", "tags": ["mega", "starter"], "search_string": "M Venusaur EX 2/108 Evolutions"},
  {"id": 137, "name": "Kangaskhan ex", "number": "115/165", "set": "Pokémon Card 151 (sv2a)", "rarity": "Double Rare (RR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p19", "image": "c137.jpg", "tags": ["jp"], "search_string": "Kangaskhan ex 115/165 sv2a"},
  {"id": 138, "name": "Zapdos ex", "number": "145/165", "set": "Pokémon Card 151 (sv2a)", "rarity": "Double Rare (RR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p19", "image": "c138.jpg", "tags": ["jp", "legend"], "search_string": "Zapdos ex 145/165 sv2a"},
  {"id": 139, "name": "Ninetales ex", "number": "038/165", "set": "Pokémon Card 151 (sv2a)", "rarity": "Double Rare (RR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p19", "image": "c139.jpg", "tags": ["jp"], "search_string": "Ninetales ex 038/165 sv2a"},
  {"id": 140, "name": "Yveltal-EX", "number": "XY08", "set": "XY Black Star Promos", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p19", "image": "c140.jpg", "tags": ["legend"], "search_string": "Yveltal EX XY08"},
  {"id": 141, "name": "Mew ex", "number": "076/190", "set": "Shiny Treasure ex (sv4a)", "rarity": "Double Rare (RR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p19", "image": "c141.jpg", "tags": ["jp", "legend"], "search_string": "Mew ex 076/190 sv4a"},
  {"id": 142, "name": "Shaymin VSTAR", "number": "014/172", "set": "Brilliant Stars", "rarity": "Ultra Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p19", "image": "c142.jpg", "tags": ["legend"], "search_string": "Shaymin VSTAR 014"},
  {"id": 143, "name": "Blastoise ex", "number": "009/165", "set": "Pokémon Card 151 (sv2a)", "rarity": "Double Rare (RR)", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p19", "image": "c143.jpg", "tags": ["starter", "jp"], "search_string": "Blastoise ex 009/165 sv2a"},
  {"id": 144, "name": "Greninja ex", "number": "041/142", "set": "Stellar Crown", "rarity": "Double Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p19", "image": "c144.jpg", "tags": ["starter"], "search_string": "Greninja ex 041"},
  {"id": 145, "name": "Dragapult ex", "number": "073/131", "set": "Prismatic Evolutions", "rarity": "Double Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p19", "image": "c145.jpg", "tags": [], "search_string": "Dragapult ex 073"},
  {"id": 146, "name": "Mew V", "number": "113/264", "set": "Fusion Strike", "rarity": "Ultra Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p20", "image": "c146.jpg", "tags": ["legend"], "search_string": "Mew V 113"},
  {"id": 147, "name": "Tatsugiri ex", "number": "125/106", "set": "Super Electric Breaker (sv8)", "rarity": "SR", "printing": "Holofoil", "lang": "JP", "condition": "Near Mint", "binder_page": "p20", "image": "c147.jpg", "tags": ["art", "jp"], "search_string": "Tatsugiri ex 125/106 sv8"},
  {"id": 148, "name": "Mew VMAX", "number": "114/264", "set": "Fusion Strike", "rarity": "Ultra Rare", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p20", "image": "c148.jpg", "tags": ["legend"], "search_string": "Mew VMAX 114"},
  {"id": 149, "name": "Tyrunt", "number": "MEP 070", "set": "Mega Evolution Black Star Promos (Perfect Order ETB)", "rarity": "Promo", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p20", "image": "c149.jpg", "tags": [], "search_string": "Tyrunt MEP 070"},
  {"id": 150, "name": "Toxtricity", "number": "GG09/GG70", "set": "Crown Zenith Galarian Gallery", "rarity": "Galarian Gallery", "printing": "Holofoil", "lang": "EN", "condition": "Near Mint", "binder_page": "p20", "image": "c150.jpg", "tags": ["art"], "search_string": "Toxtricity GG09"}
]
```

> **Note to Claude Code:** IDs 3–5 are custom photo cards (not official cards, no product image to fetch — skip them). All 147 real cards are included above across binder pages p01–p20. New cards the owner adds via the `add-cards` skill will start at id 148.

---

## Tracked sets data (pre-seeded `data/sets.json`)

```json
[
  {
    "key": "mep",
    "name": "First Partner Illustration Collection",
    "lang": "EN",
    "note": "Mega Evolution promos, all 27 starters, English",
    "slots": [
      {"number":"MEP 037","name":"Bulbasaur","card_id":50},{"number":"MEP 038","name":"Charmander","card_id":51},{"number":"MEP 039","name":"Squirtle","card_id":52},
      {"number":"MEP 040","name":"Turtwig","card_id":60},{"number":"MEP 041","name":"Chimchar","card_id":59},{"number":"MEP 042","name":"Piplup","card_id":61},
      {"number":"MEP 043","name":"Rowlet","card_id":66},{"number":"MEP 044","name":"Litten","card_id":65},{"number":"MEP 045","name":"Popplio","card_id":67},
      {"number":"MEP 046","name":"Chikorita","card_id":74},{"number":"MEP 047","name":"Cyndaquil","card_id":72},{"number":"MEP 048","name":"Totodile","card_id":56},
      {"number":"MEP 049","name":"Snivy","card_id":63},{"number":"MEP 050","name":"Tepig","card_id":62},{"number":"MEP 051","name":"Oshawott","card_id":64},
      {"number":"MEP 052","name":"Grookey","card_id":69},{"number":"MEP 053","name":"Scorbunny","card_id":68},{"number":"MEP 054","name":"Sobble","card_id":70},
      {"number":"MEP 055","name":"Treecko","card_id":73},{"number":"MEP 056","name":"Torchic","card_id":76},{"number":"MEP 057","name":"Mudkip","card_id":53},
      {"number":"MEP 058","name":"Chespin","card_id":58},{"number":"MEP 059","name":"Fennekin","card_id":75},{"number":"MEP 060","name":"Froakie","card_id":55},
      {"number":"MEP 061","name":"Sprigatito","card_id":54},{"number":"MEP 062","name":"Fuecoco","card_id":71},{"number":"MEP 063","name":"Quaxly","card_id":57}
    ]
  },
  {
    "key": "sv8a-rr",
    "name": "Terastal Festival ex: Eeveelution RR",
    "lang": "JP",
    "note": "Japanese sv8a double rares",
    "slots": [
      {"number":"003/187","name":"Leafeon ex","card_id":17},{"number":"022/187","name":"Flareon ex","card_id":10},
      {"number":"031/187","name":"Vaporeon ex","card_id":11},{"number":"041/187","name":"Glaceon ex","card_id":15},
      {"number":"052/187","name":"Jolteon ex","card_id":9},{"number":"063/187","name":"Espeon ex","card_id":14},
      {"number":"069/187","name":"Sylveon ex","card_id":16},{"number":"093/187","name":"Umbreon ex","card_id":12},
      {"number":"126/187","name":"Eevee ex","card_id":13}
    ]
  },
  {
    "key": "sv2a-starters",
    "name": "Pokémon Card 151: Starter lines",
    "lang": "JP",
    "note": "Japanese sv2a — six starter ARs and three starter ex SARs",
    "slots": [
      {"number":"166/165","name":"Bulbasaur","card_id":43},{"number":"167/165","name":"Ivysaur","card_id":44},{"number":"168/165","name":"Charmander","card_id":null},
      {"number":"169/165","name":"Charmeleon","card_id":null},{"number":"170/165","name":"Squirtle","card_id":41},{"number":"171/165","name":"Wartortle","card_id":42},
      {"number":"200/165","name":"Venusaur ex","card_id":null},{"number":"201/165","name":"Charizard ex","card_id":null},{"number":"202/165","name":"Blastoise ex","card_id":null}
    ]
  },
  {
    "key": "pre-dr",
    "name": "Prismatic Evolutions: Eeveelution ex",
    "lang": "EN",
    "note": "The nine double rares, without stamps",
    "slots": [
      {"number":"006/131","name":"Leafeon ex","card_id":23},{"number":"014/131","name":"Flareon ex","card_id":18},{"number":"023/131","name":"Vaporeon ex","card_id":null},
      {"number":"026/131","name":"Glaceon ex","card_id":null},{"number":"030/131","name":"Jolteon ex","card_id":19},{"number":"034/131","name":"Espeon ex","card_id":null},
      {"number":"041/131","name":"Sylveon ex","card_id":null},{"number":"060/131","name":"Umbreon ex","card_id":20},{"number":"075/131","name":"Eevee ex","card_id":null}
    ]
  },
  {
    "key": "sv8a-sar",
    "name": "Terastal Festival ex: Eeveelution SAR",
    "lang": "JP",
    "note": "Japanese sv8a special art rares",
    "slots": [
      {"number":"200/187","name":"Leafeon ex","card_id":null},{"number":"202/187","name":"Flareon ex","card_id":8},{"number":"205/187","name":"Vaporeon ex","card_id":null},
      {"number":"206/187","name":"Glaceon ex","card_id":null},{"number":"209/187","name":"Jolteon ex","card_id":null},{"number":"211/187","name":"Espeon ex","card_id":7},
      {"number":"212/187","name":"Sylveon ex","card_id":6},{"number":"217/187","name":"Umbreon ex","card_id":null},{"number":"223/187","name":"Eevee ex","card_id":null},
      {"number":"224/187","name":"Eevee ex (alt)","card_id":null}
    ]
  },
  {
    "key": "svi-gardevoir",
    "name": "Scarlet & Violet: Gardevoir ex line",
    "lang": "EN",
    "note": "Ralts and Kirlia IRs and the Gardevoir ex SIR",
    "slots": [
      {"number":"211/198","name":"Ralts","card_id":48},{"number":"212/198","name":"Kirlia","card_id":49},{"number":"245/198","name":"Gardevoir ex","card_id":null}
    ]
  },
  {
    "key": "cri-froakie",
    "name": "Chaos Rising: Froakie line",
    "lang": "EN",
    "note": "Froakie and Frogadier IRs and the Mega Greninja ex SIR",
    "slots": [
      {"number":"088/086","name":"Froakie","card_id":46},{"number":"089/086","name":"Frogadier","card_id":47},{"number":"116/086","name":"Mega Greninja ex","card_id":null}
    ]
  },
  {
    "key": "c30-pika",
    "name": "30th Celebration: Pikachu Rares",
    "lang": "EN",
    "note": "One in every pack, numbered 01/30 to 30/30",
    "slots": [
      {"number":"023/128","name":"Pikachu 01/30","card_id":86},{"number":"024/128","name":"Pikachu 02/30","card_id":87},{"number":"025/128","name":"Pikachu 03/30","card_id":88},
      {"number":"026/128","name":"Pikachu 04/30","card_id":89},{"number":"027/128","name":"Pikachu 05/30","card_id":90},{"number":"028/128","name":"Pikachu 06/30","card_id":34},
      {"number":"029/128","name":"Pikachu 07/30","card_id":78},{"number":"030/128","name":"Pikachu 08/30","card_id":79},{"number":"031/128","name":"Pikachu 09/30","card_id":80},
      {"number":"032/128","name":"Pikachu 10/30","card_id":81},{"number":"033/128","name":"Pikachu 11/30","card_id":82},{"number":"034/128","name":"Pikachu 12/30","card_id":83},
      {"number":"035/128","name":"Pikachu 13/30","card_id":84},{"number":"036/128","name":"Pikachu 14/30","card_id":33},{"number":"037/128","name":"Pikachu 15/30","card_id":91},
      {"number":"038/128","name":"Pikachu 16/30","card_id":92},{"number":"039/128","name":"Pikachu 17/30","card_id":93},{"number":"040/128","name":"Pikachu 18/30","card_id":94},
      {"number":"041/128","name":"Pikachu 19/30","card_id":95},{"number":"042/128","name":"Pikachu 20/30","card_id":96},{"number":"043/128","name":"Pikachu 21/30","card_id":97},
      {"number":"044/128","name":"Pikachu 22/30","card_id":98},{"number":"045/128","name":"Pikachu 23/30","card_id":99},{"number":"046/128","name":"Pikachu 24/30","card_id":100},
      {"number":"047/128","name":"Pikachu 25/30","card_id":101},{"number":"048/128","name":"Pikachu 26/30","card_id":102},{"number":"049/128","name":"Pikachu 27/30","card_id":103},
      {"number":"050/128","name":"Pikachu 28/30","card_id":104},{"number":"051/128","name":"Pikachu 29/30","card_id":105},{"number":"052/128","name":"Pikachu 30/30","card_id":null}
    ]
  },
  {
    "key": "jp-vmax",
    "name": "Japanese Eeveelution VMAX",
    "lang": "JP",
    "note": "Regular-art Japanese versions. Umbreon is the VMAX Climax print, Espeon is the VMAX Special Set print",
    "slots": [
      {"number":"003/069","name":"Leafeon VMAX","card_id":null},{"number":"025/069","name":"Glaceon VMAX","card_id":null},
      {"number":"004/004","name":"Espeon VMAX","card_id":37},{"number":"041/069","name":"Sylveon VMAX","card_id":null},
      {"number":"101/184","name":"Umbreon VMAX","card_id":36}
    ]
  },
  {
    "key": "pre-sir",
    "name": "Prismatic Evolutions: Eeveelution SIRs",
    "lang": "EN",
    "note": "The nine special illustration rares",
    "slots": [
      {"number":"144/131","name":"Leafeon ex","card_id":null},{"number":"146/131","name":"Flareon ex","card_id":null},{"number":"149/131","name":"Vaporeon ex","card_id":null},
      {"number":"150/131","name":"Glaceon ex","card_id":null},{"number":"153/131","name":"Jolteon ex","card_id":null},{"number":"155/131","name":"Espeon ex","card_id":null},
      {"number":"156/131","name":"Sylveon ex","card_id":null},{"number":"161/131","name":"Umbreon ex","card_id":null},{"number":"167/131","name":"Eevee ex","card_id":null}
    ]
  }
]
```

---

## Standalone wishlist (pre-seeded `data/wishlist.json`)

Cards the owner wants that are **not** part of a tracked set above. All are Eeveelution-related.

```json
[
  {"name":"Sylveon ex","number":"153/131","set":"Prismatic Evolutions","rarity":"Special Illustration Rare","lang":"EN","illustrator":"You Iribi","owned":false,"tags":["eevee"],"search_string":"Sylveon ex 153"},
  {"name":"Umbreon ex","number":"SVP 110","set":"SV Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"REND","owned":false,"tags":["eevee"],"search_string":"Umbreon ex SVP 110"},
  {"name":"Espeon ex","number":"SVP 108","set":"SV Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"REND","owned":false,"tags":["eevee"],"search_string":"Espeon ex SVP 108"},
  {"name":"Leafeon-GX","number":"SM146","set":"SM Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"5ban Graphics","owned":false,"tags":["eevee"],"search_string":"Leafeon GX SM146"},
  {"name":"Glaceon-GX","number":"SM147","set":"SM Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"5ban Graphics","owned":false,"tags":["eevee"],"search_string":"Glaceon GX SM147"},
  {"name":"Flareon-GX","number":"SM171","set":"SM Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"PLANETA Otani","owned":false,"tags":["eevee"],"search_string":"Flareon GX SM171"},
  {"name":"Vaporeon-GX","number":"SM172","set":"SM Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"PLANETA Otani","owned":false,"tags":["eevee"],"search_string":"Vaporeon GX SM172"},
  {"name":"Jolteon-GX","number":"SM173","set":"SM Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"PLANETA Otani","owned":false,"tags":["eevee"],"search_string":"Jolteon GX SM173"},
  {"name":"Eevee-GX","number":"SM174","set":"SM Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"PLANETA Otani","owned":false,"tags":["eevee"],"search_string":"Eevee GX SM174"},
  {"name":"Espeon-GX","number":"SM35","set":"SM Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"5ban Graphics","owned":false,"tags":["eevee"],"search_string":"Espeon GX SM35"},
  {"name":"Umbreon-GX","number":"SM36","set":"SM Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"5ban Graphics","owned":false,"tags":["eevee"],"search_string":"Umbreon GX SM36"},
  {"name":"Leafeon","number":"1","set":"McDonald's Collection 2021","rarity":"Promo","lang":"EN","illustrator":"Ryo Ueda","owned":false,"tags":["eevee"],"search_string":"Leafeon 1 McDonalds 2021"},
  {"name":"Flareon","number":"2","set":"McDonald's Collection 2021","rarity":"Promo","lang":"EN","illustrator":"Suwama Chiaki","owned":false,"tags":["eevee"],"search_string":"Flareon 2 McDonalds 2021"},
  {"name":"Vaporeon","number":"3","set":"McDonald's Collection 2021","rarity":"Promo","lang":"EN","illustrator":"Akira Komayama","owned":false,"tags":["eevee"],"search_string":"Vaporeon 3 McDonalds 2021"},
  {"name":"Glaceon","number":"4","set":"McDonald's Collection 2021","rarity":"Promo","lang":"EN","illustrator":"Ryo Ueda","owned":false,"tags":["eevee"],"search_string":"Glaceon 4 McDonalds 2021"},
  {"name":"Jolteon","number":"6","set":"McDonald's Collection 2021","rarity":"Promo","lang":"EN","illustrator":"Sumiyoshi Kizuki","owned":false,"tags":["eevee"],"search_string":"Jolteon 6 McDonalds 2021"},
  {"name":"Espeon","number":"7","set":"McDonald's Collection 2021","rarity":"Promo","lang":"EN","illustrator":"Mizue","owned":false,"tags":["eevee"],"search_string":"Espeon 7 McDonalds 2021"},
  {"name":"Umbreon","number":"9","set":"McDonald's Collection 2021","rarity":"Promo","lang":"EN","illustrator":"Kouki Saitou","owned":false,"tags":["eevee"],"search_string":"Umbreon 9 McDonalds 2021"},
  {"name":"Eevee","number":"12","set":"McDonald's Collection 2021","rarity":"Promo","lang":"EN","illustrator":"Mahou","owned":false,"tags":["eevee"],"search_string":"Eevee 12 McDonalds 2021"},
  {"name":"Leafeon","number":"11","set":"Plasma Freeze","rarity":"Rare","lang":"EN","illustrator":"5ban Graphics","owned":false,"tags":["eevee"],"search_string":"Leafeon 11 Plasma Freeze"},
  {"name":"Flareon","number":"12","set":"Plasma Freeze","rarity":"Uncommon","lang":"EN","illustrator":"5ban Graphics","owned":false,"tags":["eevee"],"search_string":"Flareon 12 Plasma Freeze"},
  {"name":"Vaporeon","number":"20","set":"Plasma Freeze","rarity":"Uncommon","lang":"EN","illustrator":"5ban Graphics","owned":false,"tags":["eevee"],"search_string":"Vaporeon 20 Plasma Freeze"},
  {"name":"Glaceon","number":"23","set":"Plasma Freeze","rarity":"Rare","lang":"EN","illustrator":"5ban Graphics","owned":false,"tags":["eevee"],"search_string":"Glaceon 23 Plasma Freeze"},
  {"name":"Jolteon","number":"34","set":"Plasma Freeze","rarity":"Uncommon","lang":"EN","illustrator":"5ban Graphics","owned":false,"tags":["eevee"],"search_string":"Jolteon 34 Plasma Freeze"},
  {"name":"Espeon","number":"48","set":"Plasma Freeze","rarity":"Uncommon","lang":"EN","illustrator":"5ban Graphics","owned":false,"tags":["eevee"],"search_string":"Espeon 48 Plasma Freeze"},
  {"name":"Umbreon","number":"64","set":"Plasma Freeze","rarity":"Rare","lang":"EN","illustrator":"5ban Graphics","owned":false,"tags":["eevee"],"search_string":"Umbreon 64 Plasma Freeze"},
  {"name":"Eevee","number":"89","set":"Plasma Freeze","rarity":"Common","lang":"EN","illustrator":"Naoki Saito","owned":false,"tags":["eevee"],"search_string":"Eevee 89 Plasma Freeze"},
  {"name":"Leafeon","number":"6","set":"Dark Explorers","rarity":"Rare","lang":"EN","illustrator":"Ryo Ueda","owned":false,"tags":["eevee"],"search_string":"Leafeon 6 Dark Explorers"},
  {"name":"Flareon","number":"12","set":"Dark Explorers","rarity":"Uncommon","lang":"EN","illustrator":"Suwama Chiaki","owned":false,"tags":["eevee"],"search_string":"Flareon 12 Dark Explorers"},
  {"name":"Vaporeon","number":"25","set":"Dark Explorers","rarity":"Uncommon","lang":"EN","illustrator":"Akira Komayama","owned":false,"tags":["eevee"],"search_string":"Vaporeon 25 Dark Explorers"},
  {"name":"Glaceon","number":"30","set":"Dark Explorers","rarity":"Rare","lang":"EN","illustrator":"Ryo Ueda","owned":false,"tags":["eevee"],"search_string":"Glaceon 30 Dark Explorers"},
  {"name":"Jolteon","number":"37","set":"Dark Explorers","rarity":"Uncommon","lang":"EN","illustrator":"Sumiyoshi Kizuki","owned":false,"tags":["eevee"],"search_string":"Jolteon 37 Dark Explorers"},
  {"name":"Espeon","number":"48","set":"Dark Explorers","rarity":"Rare","lang":"EN","illustrator":"Mizue","owned":false,"tags":["eevee"],"search_string":"Espeon 48 Dark Explorers"},
  {"name":"Umbreon","number":"60","set":"Dark Explorers","rarity":"Uncommon","lang":"EN","illustrator":"TOKIYA","owned":false,"tags":["eevee"],"search_string":"Umbreon 60 Dark Explorers"},
  {"name":"Umbreon","number":"61","set":"Dark Explorers","rarity":"Uncommon","lang":"EN","illustrator":"Kouki Saitou","owned":false,"tags":["eevee"],"search_string":"Umbreon 61 Dark Explorers"},
  {"name":"Eevee","number":"83","set":"Dark Explorers","rarity":"Common","lang":"EN","illustrator":"MAHOU","owned":false,"tags":["eevee"],"search_string":"Eevee 83 Dark Explorers"},
  {"name":"Leafeon","number":"BW87","set":"BW Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"The Pokémon Company Art Team","owned":false,"tags":["eevee"],"search_string":"Leafeon BW87"},
  {"name":"Flareon","number":"BW88","set":"BW Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"The Pokémon Company Art Team","owned":false,"tags":["eevee"],"search_string":"Flareon BW88"},
  {"name":"Vaporeon","number":"BW89","set":"BW Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"The Pokémon Company Art Team","owned":false,"tags":["eevee"],"search_string":"Vaporeon BW89"},
  {"name":"Glaceon","number":"BW90","set":"BW Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"The Pokémon Company Art Team","owned":false,"tags":["eevee"],"search_string":"Glaceon BW90"},
  {"name":"Jolteon","number":"BW91","set":"BW Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"The Pokémon Company Art Team","owned":false,"tags":["eevee"],"search_string":"Jolteon BW91"},
  {"name":"Espeon","number":"BW92","set":"BW Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"The Pokémon Company Art Team","owned":false,"tags":["eevee"],"search_string":"Espeon BW92"},
  {"name":"Umbreon","number":"BW93","set":"BW Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"The Pokémon Company Art Team","owned":false,"tags":["eevee"],"search_string":"Umbreon BW93"},
  {"name":"Eevee","number":"BW94","set":"BW Black Star Promos","rarity":"Promo","lang":"EN","illustrator":"The Pokémon Company Art Team","owned":false,"tags":["eevee"],"search_string":"Eevee BW94"},
  {"name":"Espeon δ","number":"4","set":"Delta Species","rarity":"Rare","lang":"EN","illustrator":"Ryo Ueda","owned":false,"tags":["eevee"],"search_string":"Espeon delta species 4"},
  {"name":"Flareon δ","number":"5","set":"Delta Species","rarity":"Rare","lang":"EN","illustrator":"Kouki Saitou","owned":false,"tags":["eevee"],"search_string":"Flareon delta species 5"},
  {"name":"Jolteon δ","number":"7","set":"Delta Species","rarity":"Rare","lang":"EN","illustrator":"Kouki Saitou","owned":false,"tags":["eevee"],"search_string":"Jolteon delta species 7"},
  {"name":"Umbreon δ","number":"17","set":"Delta Species","rarity":"Rare","lang":"EN","illustrator":"Ryo Ueda","owned":false,"tags":["eevee"],"search_string":"Umbreon delta species 17"},
  {"name":"Vaporeon δ","number":"18","set":"Delta Species","rarity":"Rare","lang":"EN","illustrator":"Kouki Saitou","owned":false,"tags":["eevee"],"search_string":"Vaporeon delta species 18"},
  {"name":"Eevee","number":"69","set":"Delta Species","rarity":"Common","lang":"EN","illustrator":"Atsuko Nishida","owned":false,"tags":["eevee"],"search_string":"Eevee 69 Delta Species"},
  {"name":"Flareon ex","number":"108","set":"Delta Species","rarity":"Rare","lang":"EN","illustrator":"Ryo Ueda","owned":false,"tags":["eevee"],"search_string":"Flareon ex 108 Delta Species"},
  {"name":"Jolteon ex","number":"109","set":"Delta Species","rarity":"Rare","lang":"EN","illustrator":"Mitsuhiro Arita","owned":false,"tags":["eevee"],"search_string":"Jolteon ex 109 Delta Species"},
  {"name":"Vaporeon ex","number":"110","set":"Delta Species","rarity":"Rare","lang":"EN","illustrator":"Hikaru Koike","owned":false,"tags":["eevee"],"search_string":"Vaporeon ex 110 Delta Species"}
]
```

> **Wishlist groupings for display:** The wishlist page should offer a "group by set" view that clusters these naturally — the GX promos, the McDonald's 2021 set, the Plasma Freeze set, the Dark Explorers set, the BW promos, and the Delta Species cards each form a visual group. Within each group, show Eeveelutions in a consistent order: Leafeon, Flareon, Vaporeon, Glaceon, Jolteon, Espeon, Umbreon, Eevee (then Sylveon last where applicable).

---

## Starter task for Claude Code

1. Scaffold the repo structure above with the pre-seeded JSON data already in place.
2. Write `scripts/convert.py` so the owner can regenerate the JSON from the Python source files if they edit those directly.
3. Build the Sets page first — the pocket grid, owned vs. missing state, and prices. It's the most proven logic.
4. Then Portfolio, Database, Wishlist.
5. Wire up the shared nav.
6. Wire up the shared nav.
7. Write a `README.md` with the workflows below.

---

## Ongoing workflows (Claude Code skills)

The site ships with three Claude Code skills in the `/skills/` folder. Install them so the owner can invoke them from the Claude Code chat panel:

### `/skills/add-cards.md` — Adding new cards you just got

**How to use:** Drop one or more photos of your new cards into the Claude Code chat and say "add cards" (or just drop the photos — Claude Code will recognize what you want).

**What happens:**
1. Claude reads the card details from your photos.
2. Fetches the official product image from TCGplayer or PriceCharting for each card.
3. Saves the image to `/images/cards/c###.jpg`.
4. Appends the card to `data/cards.json`.
5. Checks if the card fills a slot in `data/sets.json` and updates it.
6. Checks if the card was on your wishlist and marks it owned.
7. Tells you what was added, skipped (duplicates), and checked off the wishlist.

After it's done: `npm run build` to preview, then push to deploy.

### `/skills/add-to-wishlist.md` — Adding cards you want

**How to use:** Drop a photo of a card you saw at a shop/friend's place, paste a card name, or paste a TCGplayer/PriceCharting URL and say "add to wishlist".

**What happens:**
1. Claude identifies the card and confirms it on TCGplayer.
2. Checks you don't already own it or already have it on the list.
3. Looks up the current market price.
4. Appends it to `data/wishlist.json`.

### `/skills/update-prices.md` — Refreshing prices

**How to use:** Say "update prices" in the Claude Code chat.

**What happens:**
1. Claude fetches current TCGplayer/PriceCharting market prices for every card in `data/prices.json`.
2. Flags any cards that jumped or dropped more than 20%.
3. Updates `data/prices.json` with new prices and today's date.
4. Reports your new total collection value and wishlist cost.

After it's done: push to deploy. The "Prices last updated" banner on the site will reflect the new date automatically.

---

## README content to generate

The `README.md` should cover:
- **Adding new cards:** Use the `add-cards` skill (drop photos, say "add cards").
- **Adding to wishlist:** Use the `add-to-wishlist` skill (photo, name, or URL).
- **Updating prices:** Use the `update-prices` skill (say "update prices").
- **Manual data edits:** `data/cards.json` schema, `data/sets.json` schema, image naming.
- **Deploying:** `npm run build` then push; Vercel auto-deploys on push.
- **Regenerating JSON from Python files:** `python scripts/convert.py` (if the owner edits the old Python data files directly).
