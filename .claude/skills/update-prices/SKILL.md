---
name: update-prices
description: Refresh market prices in data/prices.json for the collection and wishlist. Use when the user says "update prices", "refresh prices", or asks how much the collection is worth now.
---

# update-prices

Fetch current market prices for the cards in this collection and write them to `data/prices.json`.

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

**Five of those need their own buckets, not an existing one.** They are variants
whose number collides with a tracked slot held by a *different* card:

| id | card | why it collides |
|---|---|---|
| 1 | Umbreon ex 060/131 (Surprise Box stamp) | `pre-dr` slot holds the plain id 20 |
| 2 | Eevee ex 075/131 (stamp) | stamped print of a `pre-dr` number |
| 77 | Pikachu 028/128 | second copy; slot holds id 34 |
| 85 | Pikachu 036/128 | second copy; slot holds id 33 |
| 106 | Pikachu 040/128 (18/30, rarer) | second copy; slot holds id 94 |

Give these a separate bucket (e.g. `"pre-stamp": {"060/131": ...}`) and set each
card's `set_key` to it. **Do not point them at `pre-dr` or `c30-pika`** — that
makes two different cards resolve to one price, which is the bug that previously
inflated the portfolio total. A stamped print and a plain print are different
market items; price them separately.

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

4. **Verify:** run `npm run build`. It fails on malformed JSON and warns about
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
- Keep `data/prices.json` the single source of truth. `price_usd` in
  `wishlist.json` is a convenience copy; if you update one, update the other.
