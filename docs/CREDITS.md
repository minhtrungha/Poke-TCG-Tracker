# Credits and sources

## Card photographs (owned cards)

Photographs of cards in the collection are the owner's own, taken by the owner.
They live in `images/cards/` and `images/thumbs/`.

Two exceptions, flagged for review: cards **151 (Lugia V 186/195)** and
**152 (Mew V 251/264)** are owned but currently use official product images,
because no owner photo was supplied. See `docs/ux-log.md`.

## Card images for cards not owned

`images/need/` holds product images from the TCGplayer CDN, retrieved via
[TCGCSV](https://tcgcsv.com). They are shown only for cards the owner does
**not** own, desaturated behind a "NEED" chip, so the Sets and Wishlist pages
can show what is being hunted.

Pokémon card artwork is © Nintendo / Creatures Inc. / GAME FREAK Inc.
Product photography is © TCGplayer. These images are used here for
identification in a personal, non-commercial collection tracker.

## Prices

Market prices come from [TCGCSV](https://tcgcsv.com), a free daily mirror of
TCGplayer's price feed. The figure used is `marketPrice` — the median of recent
sales. Prices are estimates for personal tracking, not an appraisal.

## Pokédex name → number lookup

If sprite support is enabled, the name-to-Pokédex-number table comes from
[PokéSprite](https://github.com/msikma/pokesprite) `data/pokemon.json`, which is
MIT licensed. **Only the data file is used, not the sprite images** — see the
note below.

## Species sprites — PokéSprite (adopted)

Box sprites in `images/sprites/` come from
[PokéSprite](https://github.com/msikma/pokesprite) (`pokemon-gen8/regular`),
cropped to their content and bottom-aligned. 88 files, ~350 KB.

They are **decorative only**: every sprite carries `alt=""` and `aria-hidden="true"`,
and none replaces a card photograph or a NEED image. They appear as a species
strip in set headers, a small badge on wishlist rows, and a watermark on empty
binder pockets.

**Licence position, stated plainly.** PokéSprite's README splits the project:

> "The sprite images are © Nintendo/Creatures Inc./GAME FREAK Inc. Everything
> else, and the programming code, is governed by the MIT license."

So the MIT licence covers the code and the `data/pokemon.json` lookup table used
to map names to Pokédex numbers — **not** the sprite images. The images remain
Nintendo / Creatures / GAME FREAK copyright. The owner has accepted that for
this private, personal, non-commercial tracker, which is the same position as
the TCGplayer product images already used for cards they do not own. Nothing
here claims the terms permit the use.

### Sources evaluated and not used

| Source | Repo licence | Why not |
|---|---|---|
| [PokeAPI/sprites](https://github.com/PokeAPI/sprites) | CC0 1.0 (`NOASSERTION` on GitHub) | `LICENCE.txt` opens "All image contents within are Copyright The Pokémon Company", so CC0 is applied by parties who state they do not own the images. PokéSprite is at least explicit about the split. |
| [@pkmn/img](https://github.com/pkmn/img) | No licence metadata published | Serves Pokémon Showdown sheets with no stated terms, and the brief forbids loading them from Showdown. |

### Coverage

157 of 171 distinct card names (91.8%) map to a sprite. The 14 without one are
13 Generation 9 species (Sprigatito, Fuecoco, Quaxly, Pawmi, Pawmot, Fidough,
Charcadet, Ceruledge, Tatsugiri, Terapagos and their *ex* forms), which postdate
PokéSprite's gen8 set, plus Wally — a trainer, correctly unmapped. Those names
render with no sprite rather than a placeholder.

Re-run with `npm run sprites` (dry run) or `npm run sprites:write`.

Pokémon, Pokédex and all character names are trademarks of Nintendo,
Creatures Inc. and GAME FREAK Inc. This project is a personal,
non-commercial collection tracker and is not affiliated with or endorsed by
any of them.
