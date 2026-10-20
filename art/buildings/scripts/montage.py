# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Put close-up previews side by side to check them (plain Python with Pillow, not Blender).

    python scripts/montage.py OUT.png [--cols 3] [--width 2400] IMAGE...

Each image gets its file name written under it.
"""

import sys

from PIL import Image, ImageDraw


def main():
    args = sys.argv[1:]
    out = args.pop(0)
    cols, width = 3, 2400
    if '--cols' in args:
        i = args.index('--cols')
        cols = int(args[i + 1])
        del args[i:i + 2]
    if '--width' in args:
        i = args.index('--width')
        width = int(args[i + 1])
        del args[i:i + 2]
    images = [Image.open(a).convert('RGB') for a in args]
    cell_w = width // cols
    cell_h = int(cell_w * images[0].height / images[0].width)
    rows = (len(images) + cols - 1) // cols
    sheet = Image.new('RGB', (cell_w * cols, (cell_h + 24) * rows), (40, 36, 34))
    draw = ImageDraw.Draw(sheet)
    for k, (img, name) in enumerate(zip(images, args)):
        r, c = divmod(k, cols)
        sheet.paste(img.resize((cell_w, cell_h)), (c * cell_w, r * (cell_h + 24)))
        draw.text((c * cell_w + 6, r * (cell_h + 24) + cell_h + 4), name.replace('\\', '/').split('/')[-1],
                  fill=(240, 230, 210))
    sheet.save(out)


main()
