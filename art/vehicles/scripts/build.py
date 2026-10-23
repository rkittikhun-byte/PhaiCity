# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Build PhaiCity's era vehicles in Blender, one set per era (PLAN.md).

    blender -b --factory-startup --python-exit-code 1 -P scripts/build.py -- <era1..era5|all> [--only a,b] [--closeups]

A set era<n> becomes:

    blend/era<n>_vehicles.blend         every vehicle of the era as an asset, side by side
    previews/era<n>_vehicles.png        the line-up, to compare with assets/concept/era<n>_C_vehicles.jpg

--only builds just those kinds (no .blend); --closeups also renders each vehicle alone into previews/era<n>/<kind>.png.
scripts/export_game.py then writes the game's glbs from the .blend files.
"""

import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import bpy  # noqa: E402

import vlib  # noqa: E402  (puts art/buildings/scripts on the path, adds the vehicle colours)
from lib import scene  # noqa: E402
from lib.mesh import triangles  # noqa: E402
from vehicles import ERAS  # noqa: E402

# Triangles in the Blender source, the body with its rider (wheels apart), by class (PLAN.md "Budgets")
BUDGET = {'small': 6000, 'cart': 9000, 'car': 8000, 'heavy': 12000, 'flyer': 9000}
GAP = 1.6


def objects_of(root):
    return [root] + list(root.children_recursive)


def make_vehicle(spec, parent_coll):
    vid = 'era%d_%s' % (spec['era'], spec['kind'])
    coll = scene.collection(vid, parent_coll)
    root = bpy.data.objects.new(vid, None)
    root.empty_display_type = 'PLAIN_AXES'
    coll.objects.link(root)
    v = vlib.V(spec)
    spec['build'](v)
    body = v.body.make(coll, parent=root)
    body.name = 'body.%s' % vid
    wheels = []
    wheel_tris = 0
    for i, w in enumerate(v.wheels):
        obj = w['part'].make(coll, parent=root, outline=0.02)
        obj.name = 'wheel%d.%s.0' % (i, vid)
        objs = [obj]
        for k, at in enumerate(w['at'][1:], 1):
            copy = bpy.data.objects.new('wheel%d.%s.%d' % (i, vid, k), obj.data)
            copy.modifiers.new('Outline', 'SOLIDIFY')
            m = copy.modifiers['Outline']
            m.thickness, m.offset, m.use_flip_normals, m.use_rim = 0.02, 1.0, True, False
            m.material_offset = len(obj.data.materials) - 1
            coll.objects.link(copy)
            copy.parent = root
            objs.append(copy)
        for k, (o, at) in enumerate(zip(objs, w['at'])):
            o.location = at
            if w['motion'] == 'swing':
                # the preview shows each leg at its own point of the stride
                o.rotation_euler = (w['amplitude'] * math.sin(w['phase'][k] + 0.8), 0, 0)
        tris = triangles(obj)
        wheel_tris += tris * len(w['at'])
        entry = {'mesh': 'wheel%d' % i, 'radius': round(w['radius'], 3), 'axis': w['axis'], 'motion': w['motion'],
                 'at': [[round(c, 3) for c in a] for a in w['at']], 'triangles': tris}
        if w['motion'] == 'swing':
            entry.update(amplitude=round(w['amplitude'], 3), phase=[round(f, 3) for f in w['phase']],
                         stride=round(w['stride'], 3))
        wheels.append(entry)
    bpy.context.view_layer.update()
    parts = [o for o in objects_of(root) if o.type == 'MESH']
    xs = [(o.matrix_world @ vv.co) for o in parts for vv in o.data.vertices]
    lo = [min(p[i] for p in xs) for i in range(3)]
    hi = [max(p[i] for p in xs) for i in range(3)]
    tris = triangles(body)
    root['phaicity_era'] = spec['era']
    root['phaicity_kind'] = spec['kind']
    root['phaicity_class'] = spec['cls']
    root['phaicity_label_th'] = spec['th']
    root['phaicity_label_en'] = spec['en']
    root['phaicity_paints'] = ','.join(spec['paints'] or [])
    root['phaicity_slow'] = spec['slow']
    root['phaicity_fly'] = spec['fly']
    root['phaicity_wheels'] = json.dumps(wheels)
    root['phaicity_triangles'] = tris
    root['phaicity_size'] = json.dumps([round(hi[0] - lo[0], 2), round(hi[1] - lo[1], 2), round(hi[2], 2)])
    coll.asset_mark()
    coll.asset_data.description = spec['th'] + ' / ' + spec['en']
    for tag in ('era%d' % spec['era'], spec['kind'], 'vehicle'):
        coll.asset_data.tags.new(tag)
    over = '  OVER BUDGET %d' % BUDGET[spec['cls']] if tris > BUDGET[spec['cls']] else ''
    print('BUILT   %-26s %6d triangles + %5d wheels  %4.1f x %4.1f x %4.1f m%s' % (
        vid, tris, wheel_tris, hi[1] - lo[1], hi[0] - lo[0], hi[2], over))
    return root, (lo, hi)


def lay_out(made):
    """Two rows, the big ones behind, each vehicle facing the viewer's left as on the concept sheets."""
    rows = [[], []]
    for root, (lo, hi), spec in made:
        rows[0 if spec['cls'] in ('heavy', 'flyer') or (hi[1] - lo[1]) > 5.6 else 1].append((root, lo, hi, spec))
    y_row = 0.0
    for row in rows:
        if not row:
            continue
        x = 0.0
        depth = max(hi[1] - lo[1] for _, lo, hi, _ in row)
        for root, lo, hi, spec in row:
            w = hi[0] - lo[0]
            fly = spec['fly']
            root.location = (x + w / 2 - (lo[0] + hi[0]) / 2, y_row, 1.5 if fly else 0.0)
            x += w + GAP
        y_row -= depth + 2.5


def closeups(cam, made, era):
    sc = bpy.context.scene
    res = sc.render.resolution_x, sc.render.resolution_y
    sc.render.resolution_x, sc.render.resolution_y = 1000, 800
    every = [o for r, _, _ in made for o in objects_of(r)]
    for root, _, spec in made:
        mine = set(objects_of(root))
        for o in every:
            o.hide_render = o not in mine
        scene.frame(cam, objects_of(root), margin=1.15)
        scene.render(os.path.join(ROOT, 'previews', era, spec['kind'] + '.png'))
    for o in every:
        o.hide_render = False
    sc.render.resolution_x, sc.render.resolution_y = res


def build_era(era, only=None, close=False):
    specs = ERAS[era]
    if only:
        specs = [s for s in specs if s['kind'] in only]
    scene.reset()
    cam = scene.studio(res=(2400, 1600))
    coll = scene.collection('%s_vehicles' % era)
    made = []
    for s in specs:
        root, box = make_vehicle(s, coll)
        made.append((root, box, s))
    lay_out(made)
    bpy.context.view_layer.update()
    if only:
        closeups(cam, made, era)
        return
    scene.save(os.path.join(ROOT, 'blend', '%s_vehicles.blend' % era))
    scene.frame(cam, [o for r, _, _ in made for o in objects_of(r)], margin=1.06)
    scene.render(os.path.join(ROOT, 'previews', '%s_vehicles.png' % era))
    print('Saved: %s_vehicles.png' % era)
    if close:
        closeups(cam, made, era)


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    only = None
    if '--only' in args:
        only = set(args[args.index('--only') + 1].split(','))
        args = [a for a in args if a != args[args.index('--only') + 1]]
    words = [a for a in args if not a.startswith('--')]
    if not words:
        raise SystemExit(__doc__)
    eras = list(ERAS) if words[0] == 'all' else words
    for era in eras:
        if era not in ERAS:
            raise SystemExit('No vehicles for %s (%s)' % (era, ', '.join(ERAS)))
        build_era(era, only, '--closeups' in args)


main()
