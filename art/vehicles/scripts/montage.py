# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
"""Put some preview pictures side by side (for looking only): blender -b -P montage.py -- out.png cols a.png b.png ..."""
import sys

import bpy

args = sys.argv[sys.argv.index('--') + 1:]
out, cols, files = args[0], int(args[1]), args[2:]
imgs = [bpy.data.images.load(f) for f in files]
w, h = imgs[0].size
rows = (len(imgs) + cols - 1) // cols
canvas = bpy.data.images.new('m', w * cols, h * rows)
px = [0.86, 0.73, 0.55, 1.0] * (w * cols * h * rows)
for i, im in enumerate(imgs):
    src = list(im.pixels)
    cx, cy = i % cols, rows - 1 - i // cols
    for y in range(h):
        row = (cy * h + y) * w * cols * 4 + cx * w * 4
        px[row:row + w * 4] = src[y * w * 4:(y + 1) * w * 4]
canvas.pixels = px
canvas.filepath_raw = out
canvas.file_format = 'PNG'
canvas.save()
