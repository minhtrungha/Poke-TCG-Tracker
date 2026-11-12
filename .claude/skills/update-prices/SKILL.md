---
name: update-prices
description: Refresh market prices in data/prices.json for the collection and wishlist. Use when the user says "update prices", "refresh prices", or asks how much the collection is worth now.
---

# update-prices

Refresh market prices for the collection.

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

Prefer this over manual lookups: it prices all 147 cards in one pass and cannot
mix up two printings of the same number. Report what it prints - the total, and
any card it could not match.

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
     *not* the lowest listing.
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
   - "Push to deploy to update the site."

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
