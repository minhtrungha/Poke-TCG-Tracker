---
name: update-prices
description: Refresh market prices in data/prices.json for the collection and wishlist. Use when the user says "update prices", "refresh prices", or asks how much the collection is worth now.
---

# update-prices

Refresh market prices for the collection.

## First: the site already refreshes itself weekly

`.github/workflows/pages.yml` runs the sync script below every Sunday and saves
the result to the `prices-data` branch (never to `main`), then deploys. If the
owner just wants the live site current, the answer is: **Actions → Deploy to
GitHub Pages → Run workflow** (leave "Fetch fresh prices" ticked). Say so before
doing a local run.

A local run is still right for previewing, for checking what moved, or for the
manual fallback below. What you commit to `main` is merged at deploy by
`scripts/apply-price-data.mjs`: the newer `checked_date` wins and both
`history[]` logs are kept. Never commit to the `prices-data` branch by hand.

TCGCSV may be unreachable from a cloud session's network. If the script cannot
connect, tell the owner and point them to the workflow rather than guessing
prices.

## The fast path: run the sync script

```bash
node scripts/fetch-prices.mjs            # dry run - report only
node scripts/fetch-prices.mjs --write    # write data/prices.json
```

It pulls from [TCGCSV](https://tcgcsv.com), a free daily mirror of TCGplayer's
own price feed (no API key), reads each card's **market price** (the median of
recent sales, never the lowest listing), writes prices bucketed by `set_key`,
fills in each card's `set_key`, and appends one point to `history[]` for the
Portfolio chart.

Prefer this over manual lookups: it prices the whole collection in one pass and
cannot mix up two printings of the same number. Report what it prints - the
total, and any card or product it could not match.

**It is multi-game.** `data/games.json` maps each game to its TCGCSV category
ids, and a card or sealed product is only ever matched inside its own game's
catalogue - the same reasoning as pricing per set bucket rather than by number.
A record with no `game` field is Pokémon. Only the games the collection
actually holds are downloaded, so the sync does not slow down for a game in the
registry that nothing is tracked from yet.

The run prints a short game tag (`PKM`, `OP`, `RB`) against each sealed line, and
`npm run check` prints the per-game record count. An unknown `game` key is a hard
error there, not a silent skip.

Only fall back to the manual process below for a card the script misses.

## Manual lookups (fallback only)

## Before you start

Read `data/prices.json`, `data/cards.json`, `data/sets.json` and `data/wishlist.json`.

**How pricing is keyed.** `prices.json` is `{set_key: {number: price_usd}}`, where
`set_key` matches a `key` in `data/sets.json`. The site resolves a card's price by
its `set_key` field (falling back to its set *name*), and **only within that
bucket** — it will not guess a price from a card number alone.

This matters: numbers repeat across sets and printings. `Umbreon ex 060/131`
exists both as the plain Prismatic Evolutions double rare (card 20) and as the
Surprise Box stamped version (card 1), and they are worth different amounts.
Price them separately and never copy one's value to the other.

Cards whose `set_key` is `null` do not belong to a tracked set, so a price filed
under a set bucket will not reach them. Either add a bucket whose key you also
add to the card's `set_key`, or leave them unpriced.

**One of those needs its own bucket, not an existing one.** Card **id 1**,
`Umbreon ex 060/131 (Prismatic Evolutions Surprise Box stamp)`, collides with the
`pre-dr` slot for `060/131`, which holds **id 20** — the plain print, because that
set is defined as "the nine double rares, *without* stamps".

Give id 1 a separate bucket (e.g. `"pre-stamp": {"060/131": ...}`) and set its
`set_key` to that. **Do not point it at `pre-dr`** — a stamped print and a plain
print are different market items, and sharing one price double-counts the plain
card's value. That is the bug that previously inflated the portfolio total.

## Steps

1. **Decide the work list.** Refresh every number already in `prices.json`
   first, then add prices for cards that have none. Do not invent a price for a
   card you could not look up — leave it out and report it.

2. **Look each card up**, in this order:
   - **TCGplayer market price** — search
     `https://www.tcgplayer.com/search/pokemon/product?q=<search_string>`, open the
     card's listing and read the **market price** (the median of recent sales),
     *not* the lowest listing. For a game other than Pokémon, search
     `https://www.tcgplayer.com/search/all/product?q=<search_string>` and check
     the result is from the right game before reading a number off it.
   - **PriceCharting** — `https://www.pricecharting.com/search-products?type=pokemon&q=<name> <number>`
     as a fallback, and as the primary source for Japanese cards (use the
     **ungraded** price).

   Do not use eBay sold listings directly; PriceCharting already aggregates them.

   Match the exact printing: stamped vs unstamped, AR/SAR/SIR vs the regular
   print, and the right language. A near-match is a wrong price.

3. **Write `data/prices.json`:**

```json
{
  "checked_date": "Nov 11, 2026",
  "sources": { "<set_key>": "<where the numbers came from>" },
  "<set_key>": { "<number>": 12.34 }
}
```

   - `checked_date` must be **today's real date** — the site's "Prices last
     updated" banner reads it, and turns yellow past 30 days.
   - Use the number format already in `sets.json` (`"060/131"`, `"MEP 037"`).
   - Prices are plain numbers, no `$` and no quotes. Use `null` for "looked up,
     not found".

4. **Append a history point.** The Portfolio chart reads `history[]`. After
   writing the prices, append ONE entry for this run — never edit or delete past
   entries, or the chart rewrites history:

```json
"history": [
  { "date": "Nov 11, 2026", "total": 1234.56, "cards": 42 }
]
```

   `total` = the sum of every owned card that now has a price; `cards` = how many
   cards that sum covers. Use the same date string as `checked_date`. If a run
   happens on a date already present, replace that one entry rather than adding a
   duplicate.

5. **Verify:** run `npm run build`. It fails on malformed JSON and warns about
   dangling references. Then report:
   - total estimated collection value, and wishlist cost;
   - any price that moved **more than 20%** up or down, with both numbers;
   - cards where no price was found;
   - "Push to deploy to update the site." (The deploy keeps these prices
     when their `checked_date` is newer than the last weekly sync; on the same
     day as a sync, the sync's prices win.)

## Notes

- The Portfolio page shows only cards that have a price; unpriced cards are
  omitted silently by design.
- Price each **Pikachu Rare (30th Celebration)** individually — they differ a
  lot. Never average them.
- **Prismatic Evolutions SIRs** are volatile: always look them up fresh, never
  reuse a number more than a week old.
- A price you cannot verify is worse than no price: the Portfolio presents these
  as a collection valuation. If a lookup is ambiguous (aggregators disagree
  wildly, or you cannot confirm the exact printing), leave it out and say so in
  the report rather than recording a guess.
- Keep `data/prices.json` the single source of truth. `price_usd` in
  `wishlist.json` is a convenience copy; if you update one, update the other.
- A sealed entry's `price_note` may record **which** product it is (for example
  the Riftbound Player bundle rather than the Signature edition, or a loose
  booster pack rather than a sleeved one). The sync keeps such a note; it only
  clears one that came with a hand-entered `price_source: "manual"` price, which
  a real API price supersedes. Do not delete those notes by hand either.
- Sealed product that TCGCSV has no row for stays `null` and is reported. Do not
  substitute a neighbouring year's or edition's product: the Riftbound Worlds
  Bundle 2026 is unpriced for exactly this reason, and the 2025 bundle upstream
  is a different item at a different price.
