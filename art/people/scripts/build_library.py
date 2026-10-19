# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""people-library.blend: every character in one file, a row per sheet, each a collection marked as an asset
(Blender's Asset Browser shows them with their Thai names; drag one into any scene).

    blender -b --factory-startup --python-exit-code 1 -P scripts/build_library.py

The characters are copied from blend/<sheet>/<id>.blend, so hand edits there show up here after a rebuild.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from lib import scene  # noqa: E402
from characters import SHEETS  # noqa: E402

scene.reset()
cam = scene.studio(res=(2400, 1600))
count = 0
for row, (sheet, specs) in enumerate(SHEETS.items()):
    sheet_coll = scene.collection(sheet)
    for col, spec in enumerate(specs):
        blend = os.path.join(ROOT, 'blend', sheet, spec['id'] + '.blend')
        if not os.path.exists(blend):
            print('MISSING', blend)
            continue
        with bpy.data.libraries.load(blend, link=False) as (src, dst):
            dst.collections = [spec['id']]
        coll = dst.collections[0]
        sheet_coll.children.link(coll)
        root = bpy.data.objects[spec['id']]
        z = root.location.z
        root.location = (col * 1.6, row * 2.2, z)
        count += 1
bpy.context.scene.camera = None
for obj in list(bpy.data.collections[scene.STUDIO].objects):
    if obj.type in ('CAMERA', 'MESH'):
        bpy.data.objects.remove(obj)
scene.save(os.path.join(ROOT, 'people-library.blend'))
print('LIBRARY %d characters' % count)
