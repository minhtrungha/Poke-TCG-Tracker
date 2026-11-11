---
name: add-to-wishlist
description: Add cards the user wants to data/wishlist.json. Use when they say "add to wishlist", "I want this card", paste a card name or a TCGplayer/PriceCharting URL, or show a photo of a card they do not own.
---

# add-to-wishlist

Add a wanted card to `data/wishlist.json`.

## Steps

### 1. Identify the card

- **From a photo:** read it with the `pokemon-cards-to-collectr` approach —
  name, number, set, rarity, printing, language. The user is showing a card they
  *want* (photographed in a shop or a friend's binder), not one they own.
- **From text:** accept a loose name ("Umbreon ex SIR"), a full card string
  ("Sylveon ex 153/131 Prismatic Evolutions SIR"), or a TCGplayer/PriceCharting
  URL — fetch the page and read the details.

Confirm the exact number and set on TCGplayer or PkmnCards before writing
anything. Note the printing: an SIR, an AR and the regular print are different
cards at very different prices.

### 2. Check it is not already known

Read **both** `data/wishlist.json` and `data/cards.json` in full first.

- Already in `wishlist.json` with `"owned": false` → say it is already on the
  list, stop.
- Already in `wishlist.json` with `"owned": true`, or present in `cards.json` →
  say they already own it (give the card `id`), stop.
- Match on **name + number + set**. Beware near-duplicates: the same number in a
  different set, or a different printing, is a *different* card and may legitimately
  be added.

Also check `data/sets.json`: if the card is an unfilled slot in a tracked set, it
**already appears** on the Wishlist page automatically. Adding it to
`wishlist.json` as well would list it twice. Say so and stop, unless the user
wants it tracked separately anyway.

### 3. Fetch a price (recommended)

Look up the TCGplayer market price (or PriceCharting ungraded for Japanese
cards). Record it as `price_usd` with today's date in `price_checked`. If the
lookup fails, use `null` for both — never guess.

### 4. Append to `data/wishlist.json`

```json
{
  "name": "Sylveon ex",
  "number": "153/131",
  "set": "Prismatic Evolutions",
  "rarity": "Special Illustration Rare",
  "lang": "EN",
  "illustrator": "You Iribi",
  "owned": false,
  "tags": ["eevee"],
  "search_string": "Sylveon ex 153",
  "price_usd": 320.0,
  "price_checked": "Nov 11, 2026"
}
```

Tags: `eevee` (any Eeveelution), `pika`, `starter`, `ralts` (Ralts/Kirlia/Gardevoir/Gallade),
`mega`, `art` (special illustration / character rares), `jp` (Japanese).

### 5. Verify and report

Run `npm run build` to confirm the JSON parses. Then confirm what was added,
show the price, and note if it also appears as a missing slot on the Sets page.

## Notes

- No trainer cards, energy cards or sealed product.
- Several cards at once: process them all in one pass, then report a summary.
- Re-read `wishlist.json` immediately before writing, so a concurrent edit is not
  clobbered.
