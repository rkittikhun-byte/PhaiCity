# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
"""Scale a picture down (for looking only): blender -b -P shrink.py -- in.png out.png width"""
import sys

import bpy

src, out, width = sys.argv[sys.argv.index('--') + 1:][:3]
im = bpy.data.images.load(src)
w, h = im.size
im.scale(int(width), int(h * int(width) / w))
im.filepath_raw = out
im.file_format = 'PNG'
im.save()
