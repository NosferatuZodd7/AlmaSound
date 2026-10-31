"""Generates build/icon.ico and build/icon.png: a glass orb in the five voice colours.

Run: python3 tools/make_icon.py  (needs Pillow)
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
VOICES = [(88, 86, 214), (10, 155, 189), (175, 82, 222), (255, 45, 85), (255, 149, 0)]
OUT = Path(__file__).resolve().parent.parent / 'build'


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def conic(size):
    """Conic gradient through the voice colours, starting at 200 degrees like the in-app mark."""
    img = Image.new('RGB', (size, size))
    px = img.load()
    c = size / 2
    stops = VOICES + [VOICES[0]]
    for y in range(size):
        for x in range(size):
            a = (math.degrees(math.atan2(x - c, c - y)) - 200) % 360 / 360
            i = min(int(a * (len(stops) - 1)), len(stops) - 2)
            px[x, y] = lerp(stops[i], stops[i + 1], a * (len(stops) - 1) - i)
    return img


def main():
    OUT.mkdir(exist_ok=True)
    margin = SIZE * 0.08
    box = (margin, margin, SIZE - margin, SIZE - margin)

    mask = Image.new('L', (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).ellipse(box, fill=255)

    icon = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    # Soft drop shadow
    shadow = Image.new('L', (SIZE, SIZE), 0)
    ImageDraw.Draw(shadow).ellipse((box[0], box[1] + SIZE * 0.03, box[2], box[3] + SIZE * 0.03), fill=90)
    icon.paste((20, 24, 60, 255), (0, 0), shadow.filter(ImageFilter.GaussianBlur(SIZE * 0.03)))
    icon.paste(conic(SIZE), (0, 0), mask)

    # Specular highlight (top-left) and a bright rim
    hl = Image.new('L', (SIZE, SIZE), 0)
    r = SIZE * 0.2
    cx, cy = SIZE * 0.36, SIZE * 0.32
    ImageDraw.Draw(hl).ellipse((cx - r, cy - r * 0.8, cx + r, cy + r * 0.8), fill=210)
    hl = hl.filter(ImageFilter.GaussianBlur(SIZE * 0.06))
    hl = Image.composite(hl, Image.new('L', (SIZE, SIZE), 0), mask)
    icon.paste((255, 255, 255, 255), (0, 0), hl)
    rim = Image.new('L', (SIZE, SIZE), 0)
    ImageDraw.Draw(rim).ellipse(box, outline=150, width=round(SIZE * 0.012))
    icon.paste((255, 255, 255, 255), (0, 0), rim.filter(ImageFilter.GaussianBlur(2)))

    icon.resize((512, 512), Image.LANCZOS).save(OUT / 'icon.png')
    icon.save(OUT / 'icon.ico', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)])


if __name__ == '__main__':
    main()
