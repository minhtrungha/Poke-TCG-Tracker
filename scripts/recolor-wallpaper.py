"""Recolour a sprite wallpaper's sky gradient, leaving the sprites alone.

The wallpapers are a smooth vertical gradient with die-cut sprite stickers
(white outlines) and small sparkles on top. For each row we estimate the sky
colour as the per-channel median of that row (most of any row is sky), then
move every pixel by (new_sky - old_sky) * w, where w falls from 1 for pixels
that ARE sky to 0 for anything as far from the sky as white is. So sky becomes
the new gradient, anti-aliased sticker edges shift partially, and the sprites,
outlines and dark pixels stay exactly as they were.

usage: python3 -I scripts/recolor-wallpaper.py <in> <out.webp> <top> <mid> <bottom>
  e.g. ... src/img/bg-wide.webp src/img/bg-wide-green.webp '#d8f3dc' '#e8f6d4' '#fdf3dc'
"""
import sys
import numpy as np
from PIL import Image, ImageFilter


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def main(src, dst, top, mid, bot):
    im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    H, W, _ = im.shape
    # per-row sky estimate, smoothed vertically (the sky is a smooth gradient)
    sky = np.median(im, axis=1)                                # H x 3
    k = max(3, H // 60) | 1
    pad = np.pad(sky, ((k // 2, k // 2), (0, 0)), mode='edge')
    sky = np.stack([np.convolve(pad[:, c], np.ones(k) / k, mode='valid') for c in range(3)], 1)

    # new sky: 3-stop vertical gradient
    t = np.linspace(0, 1, H)[:, None]
    a, b, c = hexrgb(top), hexrgb(mid), hexrgb(bot)
    new = np.where(t < .5, a + (b - a) * (t / .5), b + (c - b) * ((t - .5) / .5))   # H x 3

    old = sky[:, None, :]                                      # H x 1 x 3
    dist = np.linalg.norm(im - old, axis=2)                    # H x W
    span = np.linalg.norm(255.0 - old, axis=2)                 # sky → white distance per row
    w = np.clip(1.0 - dist / np.maximum(span, 1.0), 0, 1) ** 1.5
    out = im + (new[:, None, :] - old) * w[..., None]
    out = np.clip(out, 0, 255).astype(np.uint8)
    Image.fromarray(out).save(dst, 'WEBP', quality=84, method=6)
    print(dst, W, H)


if __name__ == '__main__':
    main(*sys.argv[1:6])
