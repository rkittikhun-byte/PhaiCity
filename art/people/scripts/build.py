# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Build PhaiCity people in Blender (README.md).

    blender -b --factory-startup --python-exit-code 1 -P scripts/build.py -- <what> [--force] [--no-sheet]

<what> is a character id, a sheet name (shared, era1 ... era5, north, isan, central, east, west, south), or all.
Each character becomes blend/<sheet>/<id>.blend, glb/<sheet>/<id>.glb and previews/<sheet>/<id>.png; a sheet also
gets previews/<sheet>_sheet.png, its line-up as in the concept art. A character listed in LOCKED.txt was edited by
hand in Blender: it is never rebuilt (its glb is exported again from its .blend), even with --force.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from lib import body, scene  # noqa: E402
from lib.mesh import triangles  # noqa: E402
from characters import SHEETS, LINEUPS, find  # noqa: E402


def locked():
    path = os.path.join(ROOT, 'LOCKED.txt')
    if not os.path.exists(path):
        return set()
    with open(path, encoding='utf-8') as f:
        return {line.split('#')[0].strip() for line in f if line.split('#')[0].strip()}


def paths(spec):
    sheet = spec['sheet']
    return (os.path.join(ROOT, 'blend', sheet, spec['id'] + '.blend'),
            os.path.join(ROOT, 'glb', sheet, spec['id'] + '.glb'),
            os.path.join(ROOT, 'previews', sheet, spec['id'] + '.png'))


def character_objects(root):
    return [root] + list(root.children_recursive)


def build_character(spec, force):
    blend, glb, png = paths(spec)
    if spec['id'] in locked():
        if not os.path.exists(blend):
            raise SystemExit('%s is in LOCKED.txt but %s is missing' % (spec['id'], blend))
        bpy.ops.wm.open_mainfile(filepath=blend)
        root = bpy.data.objects[spec['id']]
        scene.export_glb(glb, character_objects(root))
        print('LOCKED  %-24s re-exported %s' % (spec['id'], glb))
        return
    if os.path.exists(blend) and not force:
        print('SKIP    %-24s (exists; --force to rebuild)' % spec['id'])
        return
    scene.reset()
    cam = scene.studio()
    coll = scene.collection(spec['id'])
    root = body.build(spec, coll)
    coll.asset_mark()
    coll.asset_data.description = spec.get('th', '') + ' / ' + spec.get('en', '')
    for tag in (spec['sheet'], spec.get('kind', 'man')):
        coll.asset_data.tags.new(tag)
    bpy.context.view_layer.update()
    objs = character_objects(root)
    tris = sum(triangles(o) for o in objs if o.type == 'MESH')
    root['phaicity_triangles'] = tris
    scene.frame(cam, objs)
    scene.save(blend)
    scene.export_glb(glb, objs)
    scene.render(png)
    scene.save(blend)
    print('BUILT   %-24s %5d triangles  %s' % (spec['id'], tris, blend))


def build_sheet(sheet):
    """The sheet's line-up: every character appended from its .blend, in rows like the concept sheet."""
    ids = LINEUPS[sheet]
    scene.reset()
    cam = scene.studio(res=(1800, 1200))
    per_row = (len(ids) + 1) // 2
    placed = []
    for i, cid in enumerate(ids):
        spec = find(cid)
        blend = paths(spec)[0]
        if not os.path.exists(blend):
            print('MISSING %s for the %s sheet' % (cid, sheet))
            continue
        with bpy.data.libraries.load(blend, link=False) as (src, dst):
            dst.collections = [cid]
        coll = dst.collections[0]
        bpy.context.scene.collection.children.link(coll)
        root = bpy.data.objects[cid]
        row, col = divmod(i, per_row)
        z = root.location.z
        root.location = scene.RIGHT * (col * 1.3) + scene.TOWARD * (row * 4.2)
        root.location.z = z
        placed += character_objects(root)
    bpy.context.view_layer.update()
    scene.frame(cam, placed, margin=1.06)
    scene.render(os.path.join(ROOT, 'previews', sheet + '_sheet.png'))


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if not args:
        raise SystemExit(__doc__)
    what = args[0]
    force = '--force' in args
    sheet_too = '--no-sheet' not in args
    if what == 'all':
        sheets = list(SHEETS)
    elif what in SHEETS:
        sheets = [what]
    else:
        build_character(find(what), True)
        return
    for sheet in sheets:
        for spec in SHEETS[sheet]:
            build_character(spec, force)
        if sheet_too and sheet in LINEUPS:
            build_sheet(sheet)


main()
