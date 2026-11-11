#!/usr/bin/env python3
"""Convert the legacy Python data files into the four data/*.json files.

Reads (from --src, default ./legacy):
    cards_data.py  C      list of dicts: page, box, name, num, set, rarity,
                          printing, lang, checked, warn, search, tags (str)
    sets_data.py   SETS   list of dicts: key, name, lang, note, tcg,
                          slots (list of (number, name, card_id_or_None))
    prices.py      P      {set_key: {number: price_usd}}
                   SRC    {set_key: source_string}
                   CHECKED date string, e.g. "Nov 11, 2026"
    wish_data.py   W/WISH/WISHLIST  list of wanted cards

Writes data/cards.json, data/sets.json, data/prices.json, data/wishlist.json.

Nothing is overwritten unless --write is passed; by default this prints a
summary so you can see what *would* change.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EEVEE = {"eevee", "vaporeon", "jolteon", "flareon", "espeon",
         "umbreon", "leafeon", "glaceon", "sylveon"}
RALTS = {"ralts", "kirlia", "gardevoir", "gallade"}
STARTERS = {
    "bulbasaur", "ivysaur", "venusaur", "charmander", "charmeleon", "charizard",
    "squirtle", "wartortle", "blastoise", "chikorita", "cyndaquil", "totodile",
    "treecko", "torchic", "mudkip", "turtwig", "chimchar", "piplup", "snivy",
    "tepig", "oshawott", "chespin", "fennekin", "froakie", "frogadier",
    "greninja", "rowlet", "litten", "popplio", "grookey", "scorbunny",
    "sobble", "sprigatito", "fuecoco", "quaxly",
}


def load_module(path: Path):
    """Import a .py data file by path, without needing it on sys.path."""
    spec = importlib.util.spec_from_file_location(path.stem, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def first_attr(mod, *names):
    for n in names:
        if hasattr(mod, n):
            return getattr(mod, n)
    return None


def derive_tags(name: str, lang: str, explicit: str | None) -> list[str]:
    """Honour explicit space-separated tags; otherwise infer from the name."""
    if explicit:
        return [t for t in str(explicit).split() if t]
    low = str(name).lower()
    words = set(low.replace("-", " ").split())
    tags: list[str] = []
    if words & EEVEE:
        tags.append("eevee")
    if "pikachu" in low:
        tags.append("pika")
    if words & STARTERS:
        tags.append("starter")
    if words & RALTS:
        tags.append("ralts")
    if low.startswith("m ") or "mega" in words:
        tags.append("mega")
    if str(lang).upper() == "JP":
        tags.append("jp")
    return tags


def convert_cards(C) -> list[dict]:
    out = []
    for i, c in enumerate(C, start=1):
        g = c.get
        cid = g("id") or i
        name = g("name", "")
        lang = (g("lang") or "EN").upper()
        num = g("num") or g("number") or ""
        out.append({
            "id": int(cid),
            "name": name,
            "number": num,
            "set": g("set", ""),
            "set_key": g("set_key"),
            "rarity": g("rarity", ""),
            "printing": g("printing", ""),
            "lang": lang,
            "condition": g("condition") or "Near Mint",
            "binder_page": g("page") or g("binder_page"),
            "image": g("image") or f"c{int(cid):03d}.jpg",
            "tags": derive_tags(name, lang, g("tags")),
            "search_string": g("search") or g("search_string") or f"{name} {num}".strip(),
            **({"warn": g("warn")} if g("warn") else {}),
        })
    return out


def convert_sets(SETS) -> list[dict]:
    out = []
    for s in SETS:
        slots = []
        for slot in s.get("slots", []):
            if isinstance(slot, dict):
                slots.append({"number": slot.get("number"), "name": slot.get("name"),
                              "card_id": slot.get("card_id")})
            else:  # (number, name, card_id_or_None)
                number, nm, *rest = list(slot) + [None, None]
                slots.append({"number": number, "name": nm,
                              "card_id": rest[0] if rest else None})
        out.append({
            "key": s.get("key"),
            "name": s.get("name"),
            "lang": (s.get("lang") or "EN").upper(),
            "note": s.get("note", ""),
            **({"tcg": s["tcg"]} if s.get("tcg") else {}),
            "slots": slots,
        })
    return out


def convert_prices(P, SRC, CHECKED) -> dict:
    out: dict = {"checked_date": CHECKED, "sources": dict(SRC or {})}
    for key, bucket in (P or {}).items():
        out[key] = {str(n): v for n, v in bucket.items()}
    return out


def convert_wishlist(W) -> list[dict]:
    out = []
    for w in W or []:
        g = w.get
        name = g("name", "")
        num = g("num") or g("number") or ""
        lang = (g("lang") or "EN").upper()
        out.append({
            "name": name,
            "number": num,
            "set": g("set", ""),
            "rarity": g("rarity", ""),
            "lang": lang,
            "illustrator": g("illustrator", ""),
            "owned": bool(g("owned", False)),
            **({"card_id": g("card_id")} if g("card_id") else {}),
            "tags": derive_tags(name, lang, g("tags")),
            "search_string": g("search") or g("search_string") or f"{name} {num}".strip(),
            "price_usd": g("price_usd"),
            "price_checked": g("price_checked"),
        })
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", default=str(ROOT / "legacy"),
                    help="folder holding the legacy .py files (default: ./legacy)")
    ap.add_argument("--out", default=str(ROOT / "data"), help="output folder")
    ap.add_argument("--write", action="store_true",
                    help="actually write the JSON (otherwise it is a dry run)")
    a = ap.parse_args()

    src, out = Path(a.src), Path(a.out)
    if not src.is_dir():
        print(f"✗ no such folder: {src}\n"
              f"  Put cards_data.py, sets_data.py, prices.py and wish_data.py there,\n"
              f"  or pass --src /path/to/them.", file=sys.stderr)
        return 1

    jobs = {
        "cards.json": ("cards_data.py", lambda m: convert_cards(first_attr(m, "C", "CARDS") or [])),
        "sets.json": ("sets_data.py", lambda m: convert_sets(first_attr(m, "SETS", "S") or [])),
        "prices.json": ("prices.py", lambda m: convert_prices(
            first_attr(m, "P", "PRICES") or {}, first_attr(m, "SRC", "SOURCES") or {},
            first_attr(m, "CHECKED", "CHECKED_DATE"))),
        "wishlist.json": ("wish_data.py", lambda m: convert_wishlist(
            first_attr(m, "W", "WISH", "WISHLIST") or [])),
    }

    results, missing = {}, []
    for target, (fname, fn) in jobs.items():
        fp = src / fname
        if not fp.exists():
            missing.append(fname)
            continue
        try:
            results[target] = fn(load_module(fp))
        except Exception as e:                       # noqa: BLE001
            print(f"✗ {fname}: {type(e).__name__}: {e}", file=sys.stderr)
            return 1

    # Backfill cards' set_key from the sets' slot -> card_id linkage. The site
    # scopes price lookups by set key, because card numbers repeat across sets.
    if "cards.json" in results and "sets.json" in results:
        id2key = {sl["card_id"]: st["key"]
                  for st in results["sets.json"] for sl in st["slots"]
                  if sl.get("card_id") is not None}
        n = 0
        for c in results["cards.json"]:
            if c.get("set_key") is None and c["id"] in id2key:
                c["set_key"] = id2key[c["id"]]
                n += 1
        if n:
            print(f"  linked {n} card(s) to a set via set_key")

    if missing:
        print(f"! skipped (not found): {', '.join(missing)}")
    if not results:
        print("✗ nothing to convert.", file=sys.stderr)
        return 1

    out.mkdir(parents=True, exist_ok=True)
    for target, payload in results.items():
        n = len(payload) if isinstance(payload, list) else len(
            [k for k in payload if k not in ("checked_date", "sources")])
        if a.write:
            (out / target).write_text(
                json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            print(f"✓ wrote {out / target}  ({n} entries)")
        else:
            print(f"  would write {out / target}  ({n} entries)")

    if not a.write:
        print("\nDry run — nothing changed. Re-run with --write to apply.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
