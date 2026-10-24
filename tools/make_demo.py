#!/usr/bin/env python3
"""Генерирует демонстрационные пары (можно удалить вместе с pairs/demo-*)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import random

ROOT = Path(__file__).resolve().parent.parent
random.seed(7)

W, H = 1600, 1000


def base_scene():
    img = Image.new("RGB", (W, H), "#9ec7e8")
    d = ImageDraw.Draw(img)
    # небо
    for y in range(H):
        t = y / H
        c = (int(120 + 60 * t), int(170 + 40 * t), int(220 + 20 * t))
        d.line([(0, y), (W, y)], fill=c)
    # солнце
    d.ellipse([1260, 80, 1420, 240], fill=(255, 238, 190))
    # земля
    d.rectangle([0, 700, W, H], fill=(108, 128, 96))
    # дорога
    d.rectangle([0, 760, W, 940], fill=(74, 78, 84))
    for x in range(0, W, 120):
        d.rectangle([x, 845, x + 60, 855], fill=(220, 220, 210))
    # дома
    houses = [(60, 300, 300, 720, (166, 120, 90)),
              (330, 220, 560, 720, (138, 140, 150)),
              (600, 360, 790, 720, (120, 132, 150)),
              (830, 280, 1080, 720, (150, 126, 110)),
              (1120, 400, 1320, 720, (130, 140, 150)),
              (1360, 300, 1560, 720, (145, 120, 100))]
    for x0, y0, x1, y1, col in houses:
        d.rectangle([x0, y0, x1, y1], fill=col)
        d.rectangle([x0, y0, x1, y0 + 18], fill=(80, 60, 50))
        for wy in range(y0 + 40, y1 - 40, 70):
            for wx in range(x0 + 22, x1 - 30, 62):
                d.rectangle([wx, wy, wx + 34, wy + 40], fill=(215, 220, 210))
    # деревья
    for x in (300, 800, 1250):
        d.rectangle([x, 650, x + 12, 760], fill=(90, 65, 45))
        d.ellipse([x - 45, 590, x + 57, 690], fill=(70, 120, 70))
    return img


def add_noise(img, amp=4):
    px = img.load()
    for _ in range(W * H // 6):
        x = random.randrange(W)
        y = random.randrange(H)
        r, g, b = px[x, y]
        n = random.randint(-amp, amp)
        px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
    return img


def car(d, x, y, color):
    d.rounded_rectangle([x, y, x + 150, y + 55], radius=16, fill=color)
    d.rounded_rectangle([x + 30, y - 28, x + 120, y + 22], radius=12, fill=color)
    d.rectangle([x + 38, y - 20, x + 64, y + 12], fill=(210, 230, 240))
    d.rectangle([x + 70, y - 20, x + 112, y + 12], fill=(210, 230, 240))
    for wx in (x + 28, x + 108):
        d.ellipse([wx, y + 38, wx + 34, y + 72], fill=(30, 30, 34))
        d.ellipse([wx + 6, y + 44, wx + 28, y + 66], fill=(90, 90, 96))


def make_city():
    a = base_scene()
    d = ImageDraw.Draw(a)
    car(d, 430, 800, (190, 60, 55))
    a = add_noise(a, 3)
    a.save(ROOT / "pairs/demo-city/a.jpg", "JPEG", quality=90, optimize=True)

    b = base_scene()
    db = ImageDraw.Draw(b)
    car(db, 610, 800, (190, 60, 55))  # машина уехала
    # в одном окне включили свет
    db.rectangle([892, 320, 926, 360], fill=(255, 226, 150))
    db.rectangle([1436, 400, 1470, 440], fill=(255, 240, 190))
    b = add_noise(b, 3)
    b.save(ROOT / "pairs/demo-city/b.jpg", "JPEG", quality=90, optimize=True)


def make_grade():
    a = base_scene()
    car(ImageDraw.Draw(a), 430, 800, (190, 60, 55))
    a = add_noise(a, 3)
    a.save(ROOT / "pairs/demo-grade/a.jpg", "JPEG", quality=90, optimize=True)

    # «после»: сильнее контраст и холоднее тени
    b = a.convert("RGB")
    px = b.load()
    for y in range(H):
        for x in range(W):
            r, g, bl = px[x, y]
            r = int(min(255, max(0, (r - 128) * 1.12 + 128 - 8)))
            g = int(min(255, max(0, (g - 128) * 1.12 + 128 - 2)))
            bl = int(min(255, max(0, (bl - 128) * 1.12 + 128 + 10)))
            px[x, y] = (r, g, bl)
    b = b.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=3))
    b.save(ROOT / "pairs/demo-grade/b.jpg", "JPEG", quality=90, optimize=True)


if __name__ == "__main__":
    for d in ("demo-city", "demo-grade"):
        (ROOT / "pairs" / d).mkdir(parents=True, exist_ok=True)
    make_city()
    make_grade()
    print("демо-пары готовы: pairs/demo-city, pairs/demo-grade")
