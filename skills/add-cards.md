---
name: add-cards
description: Add newly acquired cards to the collection from photos. Use when the user says "add cards", "I got new cards", "update my collection", or drops photos of cards they now own.
---

# add-cards

Add cards the user just got to `data/cards.json`, wire them into the set tracker
and wishlist, and save their photos.

## Before you start

Read `data/cards.json`, `data/sets.json` and `data/wishlist.json` in full. You
need the highest existing `id` and the current contents to avoid duplicates.

## Steps

### 1. Identify every card in the photos

Use the `pokemon-cards-to-collectr` reading approach for each card:

- name, with suffix (ex, GX, V, VMAX, VSTAR…)
- card number (`199/165`, `SVP 085`, `MEP 037`)
- set (from the set code, symbol and number total)
- rarity, printing (Holofoil / Reverse Holofoil / AR / SAR / SIR…)
- language (EN or JP)

If something is unclear, search for it before guessing. Flag anything you could
not resolve rather than inventing a value — a wrong number silently produces a
wrong price later.

### 2. Save the photo

**These are the user's own photos of their own cards.** Save the photo they
supplied; do not download card art or product scans from TCGplayer,
PriceCharting or anywhere else to stand in for it. (The site's design note is
explicit: "No Pokémon official artwork — card images are the owner's own
photos.") Use the listing sites for *prices and card details*, not for images.

- Save as `images/cards/c<id>.jpg`, zero-padded to three digits (`c179.jpg`),
  using the id you assign in step 3.
- Also write a 200px-wide copy to `images/thumbs/c<id>.jpg` — the table and
  pocket views use it. Same filename.
- Aim for ~800px wide, JPEG quality ~82. Existing images average ~200KB.
- **Never overwrite an existing file.** If `c042.jpg` exists, that id is taken.
- If there is no usable photo, set `"image": null`. The site renders a grey
  card-back placeholder, which is a supported state (31 cards already use it).

A one-off convert, if you have Pillow:

```bash
python3 -I -c "
from PIL import Image; im=Image.open('IN').convert('RGB')
w,h=im.size; im.resize((800,round(h*800/w))).save('images/cards/cNNN.jpg','JPEG',quality=82,optimize=True)
im.resize((200,round(h*200/w))).save('images/thumbs/cNNN.jpg','JPEG',quality=78,optimize=True)"
```

### 3. Append to `data/cards.json`

Next id = highest existing `id` + 1. Never reuse an id, even a gap, since
`sets.json` slots and image filenames point at ids.

```json
{
  "id": 179,
  "name": "Glaceon ex",
  "number": "026/131",
  "set": "Prismatic Evolutions",
  "set_key": "pre-dr",
  "rarity": "Double Rare",
  "printing": "Holofoil",
  "lang": "EN",
  "condition": "Near Mint",
  "binder_page": "p03",
  "image": "c179.jpg",
  "tags": ["eevee"],
  "search_string": "Glaceon ex 026"
}
```

- `set_key`: the `key` of the matching set in `sets.json`, or `null` if the card
  is not part of a tracked set. **This is what prices resolve against** — get it
  right or the card will never show a price.
- `binder_page`: ask which page, or use `null`.
- `tags`: `eevee`, `pika`, `starter`, `ralts`, `mega`, `art`, `jp`.
- Duplicate (same name + number + set)? If they genuinely own two copies, add it
  with a new id — the collection already has such pairs. Otherwise skip it and
  say so.

### 4. Fill the set slot

For each added card, find a slot in `data/sets.json` whose `number` matches and
whose `card_id` is `null`, and set `card_id` to the new id. Also set the card's
`set_key` to that set's `key`.

### 5. Check the wishlist off

If the card matches an entry in `data/wishlist.json` (name + number + set), set
that entry's `"owned": true` and add `"card_id": <new id>`. Keep the entry — the
history is deliberate, and the site hides owned entries from the want list.

### 6. Verify, then report

Run `npm run build`. It validates the JSON, rejects duplicate ids, and warns
about dangling slot references and missing image files. Fix anything it reports.

Then tell the user:
- every card added, with its new id;
- anything skipped as already present;
- set slots filled and wishlist items checked off;
- anything you could not identify, or that has no photo;
- "Push to deploy when you're ready. Run `npm run build` first to preview locally."
