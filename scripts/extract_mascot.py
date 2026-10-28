"""Cut the 10 mascot poses out of the official sheet without altering the artwork.

Only the white studio background is removed (rembg, isnet-general-use model), then each
cut-out is trimmed and upscaled 2x with Lanczos for the 1080x1920 frame.

    pip install "rembg[cpu]" pillow
    python scripts/extract_mascot.py path/to/mascot-sheet.png
"""
import os
import sys

from PIL import Image, ImageFilter
from rembg import new_session, remove

# Cell boxes (x0, y0, x1, y1) measured from the grid lines of the 1698x926 sheet.
CELLS = {
    "menu-bell": (0, 0, 412, 462),
    "thumbs-up": (415, 0, 694, 462),
    "bench-menu": (698, 0, 1041, 462),
    "bench-sit": (1045, 0, 1349, 462),
    "closeup-smile": (1353, 0, 1698, 462),
    "plates-cloche": (0, 465, 392, 926),
    "juggling": (396, 465, 695, 926),
    "phone": (698, 465, 1042, 926),
    "thinking": (1045, 465, 1350, 926),
    "closeup-bell": (1353, 465, 1698, 926),
}

sheet = Image.open(sys.argv[1]).convert("RGB")
out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "mascot")
os.makedirs(out_dir, exist_ok=True)
session = new_session("isnet-general-use")
for name, (x0, y0, x1, y1) in CELLS.items():
    cell = sheet.crop((x0 + 2, y0 + 2, x1 - 2, y1 - 2))
    cut = remove(cell, session=session, post_process_mask=True)
    cut = cut.crop(cut.getbbox())
    big = cut.resize((cut.width * 2, cut.height * 2), Image.LANCZOS)
    rgb = big.convert("RGB").filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    rgb.putalpha(big.getchannel("A"))
    rgb.save(os.path.join(out_dir, f"{name}.png"), optimize=True)
    print(name, rgb.size)
