"""Builds the app icons from the logo artwork (assets/logo-source.webp, owner-provided, transparent).

Writes build/icon.png (512), build/icon.ico (16–256) and src/ui/assets/logo.png (128, top-bar mark).

Run: python3 tools/make_icon.py  (needs Pillow)
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets' / 'logo-source.webp'


def main() -> None:
    src = Image.open(SOURCE).convert('RGBA')
    orb = src.crop(src.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox())
    w, h = orb.size
    side = round(max(w, h) * 1.04)  # small margin so the orb does not touch the icon edge
    icon = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    icon.paste(orb, ((side - w) // 2, (side - h) // 2), orb)

    (ROOT / 'build').mkdir(exist_ok=True)
    icon.resize((512, 512), Image.LANCZOS).save(ROOT / 'build' / 'icon.png')
    icon.save(ROOT / 'build' / 'icon.ico', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)])
    icon.resize((128, 128), Image.LANCZOS).save(ROOT / 'src' / 'ui' / 'assets' / 'logo.png')


if __name__ == '__main__':
    main()
