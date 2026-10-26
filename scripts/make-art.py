#!/usr/bin/env python3
"""
Draws the eight prints used by the demo gallery (docs/art/*.webp).
Everything is generated here, so the repo ships no third-party images.

    python scripts/make-art.py      (needs Pillow and numpy)
"""
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "art")
os.makedirs(OUT, exist_ok=True)
W, H, S = 1000, 1250, 2  # final size and supersampling factor


def canvas(bg):
    img = Image.new("RGB", (W * S, H * S), bg)
    return img, ImageDraw.Draw(img)


def grain(img, amount=7, seed=0):
    arr = np.asarray(img).astype(np.int16)
    rng = np.random.default_rng(seed)
    arr = arr + rng.normal(0, amount, arr.shape[:2])[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def finish(img, name, seed):
    img = img.resize((W, H), Image.LANCZOS)
    img = grain(img, 6, seed)
    img.save(os.path.join(OUT, name + ".webp"), quality=86, method=6)
    print("wrote", name)


def low_tide():
    img, d = canvas("#e9dcc4")
    cols = ["#1d3a4a", "#2c5d6f", "#4f8a92", "#9cc3bd", "#e9dcc4", "#d8c19c", "#c49a6c"]
    for i in range(22):
        y0 = 260 + i * 46
        pts = [(x, y0 * S + math.sin(x / (140 * S) + i * .55) * 26 * S + math.sin(x / (53 * S) + i) * 7 * S) for x in range(0, W * S + 10, 10)]
        d.polygon(pts + [(W * S, H * S), (0, H * S)], fill=cols[i % len(cols)])
    d.ellipse((620 * S, 120 * S, 820 * S, 320 * S), fill="#f3b05a")
    finish(img, "low-tide", 1)


def orchard():
    img, d = canvas("#1f3b2c")
    rng = random.Random(4)
    pal = ["#c8452d", "#e98a3b", "#f2c14e", "#9fbf5a", "#5d8f4a"]
    step = 125
    for gy in range(10):
        for gx in range(8):
            cx = 62 + gx * step + rng.uniform(-8, 8)
            cy = 70 + gy * step + rng.uniform(-8, 8)
            r = rng.uniform(34, 52)
            c = pal[(gx * 3 + gy * 5 + rng.randint(0, 2)) % len(pal)]
            d.ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), fill=c)
            d.line(((cx) * S, (cy - r) * S, (cx + 10) * S, (cy - r - 18) * S), fill="#132519", width=5 * S)
    finish(img, "orchard", 2)


def signal():
    img, d = canvas("#f2ece0")
    cx, cy = 0, H
    cols = ["#141310", "#e8582d", "#f2ece0"]
    r = 1500
    i = 0
    while r > 40:
        d.ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), fill=cols[i % 3])
        r -= 46 + (i % 3) * 18
        i += 1
    d.ellipse((720 * S, 140 * S, 860 * S, 280 * S), fill="#141310")
    finish(img, "signal", 3)


def kiln():
    img, d = canvas("#efe2cf")
    pal = ["#b4532a", "#d9773c", "#8c3a1e", "#e7a65c", "#5a2a19"]
    y = 120
    rng = random.Random(9)
    while y < H - 120:
        h = rng.randint(70, 150)
        x0 = rng.randint(90, 220)
        x1 = W - rng.randint(90, 220)
        d.rounded_rectangle((x0 * S, y * S, x1 * S, (y + h) * S), radius=min(h // 2, 70) * S, fill=pal[rng.randint(0, 4)])
        y += h + 22
    finish(img, "kiln", 4)


def monsoon():
    img = Image.new("RGB", (W * S, H * S))
    arr = np.zeros((H * S, W * S, 3), np.float32)
    t = np.linspace(0, 1, H * S)[:, None, None]
    top, bot = np.array([62, 78, 92]), np.array([176, 190, 196])
    arr[:] = top * (1 - t) + bot * t
    img = Image.fromarray(arr.astype(np.uint8))
    d = ImageDraw.Draw(img)
    rng = random.Random(5)
    for _ in range(900):
        x = rng.uniform(-300, W) * S
        y = rng.uniform(-200, H) * S
        l = rng.uniform(40, 160) * S
        c = rng.choice(["#dfe7ea", "#9fb3bc", "#ffffff"])
        d.line((x, y, x + l * .35, y + l), fill=c, width=int(rng.uniform(1, 3) * S))
    d.rectangle((0, 1060 * S, W * S, H * S), fill="#2e3a40")
    for i in range(14):
        x = 40 + i * 70
        d.rectangle((x * S, (1000 - (i % 4) * 40) * S, (x + 50) * S, 1060 * S), fill="#26323a")
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    finish(img, "monsoon", 6)


def paper_sun():
    img, d = canvas("#f4ead6")
    d.ellipse((150 * S, 260 * S, 850 * S, 960 * S), fill="#e2492f")
    # halftone shadow on the lower right
    for gy in range(0, H, 22):
        for gx in range(0, W, 22):
            dx, dy = gx - 600, gy - 760
            dist = math.hypot(dx, dy)
            if dist < 420:
                r = (1 - dist / 420) * 9
                d.ellipse(((gx - r) * S, (gy - r) * S, (gx + r) * S, (gy + r) * S), fill="#1c1a16")
    d.rectangle((0, 1080 * S, W * S, H * S), fill="#1c1a16")
    finish(img, "paper-sun", 7)


def night_ferry():
    img, d = canvas("#0d1630")
    arr = np.asarray(img).astype(np.float32)
    t = np.linspace(0, 1, H * S)[:, None, None]
    arr = np.array([13, 22, 48]) * (1 - t) + np.array([38, 46, 86]) * t
    arr = np.broadcast_to(arr, (H * S, W * S, 3))
    img = Image.fromarray(np.ascontiguousarray(arr).astype(np.uint8))
    d = ImageDraw.Draw(img)
    rng = random.Random(8)
    for _ in range(160):
        x, y = rng.uniform(0, W) * S, rng.uniform(0, 600) * S
        r = rng.uniform(0.6, 2.2) * S
        d.ellipse((x - r, y - r, x + r, y + r), fill="#e9ecff")
    d.ellipse((640 * S, 170 * S, 780 * S, 310 * S), fill="#f6e7b8")
    d.rectangle((0, 760 * S, W * S, H * S), fill="#0a1124")
    for i in range(40):
        y = (790 + i * 11) * S
        w = (60 - i) * 2.2 * S
        d.rectangle((710 * S - w / 2, y, 710 * S + w / 2, y + 3 * S), fill="#f6e7b8")
    # the ferry
    d.polygon([(180 * S, 740 * S), (520 * S, 740 * S), (480 * S, 790 * S), (220 * S, 790 * S)], fill="#05080f")
    d.rectangle((260 * S, 690 * S, 430 * S, 742 * S), fill="#05080f")
    for i in range(6):
        d.rectangle(((276 + i * 26) * S, 704 * S, (290 + i * 26) * S, 716 * S), fill="#ffcf6b")
    img = img.filter(ImageFilter.GaussianBlur(0.5))
    finish(img, "night-ferry", 9)


def dune():
    img, d = canvas("#f3d9a8")
    cols = ["#f0c987", "#e4ad62", "#cf8b45", "#b4692f", "#8e4b22", "#5e2f18"]
    for i, c in enumerate(cols):
        base = 380 + i * 150
        pts = [(x, (base + 70 * math.sin(x / (260 * S) + i * 1.3) + 35 * math.sin(x / (97 * S) + i)) * S) for x in range(0, W * S + 10, 10)]
        d.polygon(pts + [(W * S, H * S), (0, H * S)], fill=c)
    d.ellipse((140 * S, 120 * S, 300 * S, 280 * S), fill="#fff3d6")
    finish(img, "dune-04", 10)


if __name__ == "__main__":
    for fn in (low_tide, orchard, signal, kiln, monsoon, paper_sun, night_ferry, dune):
        fn()
