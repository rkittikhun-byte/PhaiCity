# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Build PhaiCity's era buildings in Blender, one set per era and region (PLAN.md).

    blender -b --factory-startup --python-exit-code 1 -P scripts/build.py -- <era> [<region>] [options]

<era> is era1 ... era5 or all; <region> one of north, northeast, central, east, west, south (all six when left out).
A set era<n>_<region> becomes:

    blend/era<n>/era<n>_<region>.blend           every building of the set as an asset, laid out in rows
    glb/era<n>/<region>/era<n>_<region>_<kind>.glb   one per building, at the origin
    previews/era<n>_<region>_sheet.png           homes, shops and factories; _services.png the services

Options: --only home_1,shop_2 builds just those kinds into previews/era<n>/<region>/ (no .blend, no sheet) for
quick checks; --closeups also renders each building alone into previews/era<n>/<region>/<id>.png; --force rebuilds
a set whose .blend exists. A set listed in LOCKED.txt was edited by hand in Blender: it is never rebuilt (its glbs
are exported again from its .blend).
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from lib import scene  # noqa: E402
from lib.builder import Build, TILE_M  # noqa: E402
from lib.mesh import triangles  # noqa: E402
from lib.regions import REGIONS  # noqa: E402
from buildings import ERAS  # noqa: E402

# Triangles in the Blender source by footprint (PLAN.md "Detail level").
BUDGET = {1: 12000, 2: 30000, 3: 45000}
ROW_OF = {'home': 0, 'shop': 1, 'factory': 2}
ROW_GAP = 60.0


def locked():
    path = os.path.join(ROOT, 'LOCKED.txt')
    if not os.path.exists(path):
        return set()
    with open(path, encoding='utf-8') as f:
        return {line.split('#')[0].strip() for line in f if line.split('#')[0].strip()}


def set_name(era, region):
    return '%s_%s' % (era, region)


def building_id(spec, region):
    return 'era%d_%s_%s' % (spec['era'], region, spec['kind'])


def objects_of(root):
    return [root] + list(root.children_recursive)


def make_building(spec, region, parent_coll):
    """Build one building into its own collection under parent_coll; returns its root empty."""
    bid = building_id(spec, region)
    coll = scene.collection(bid, parent_coll)
    root = bpy.data.objects.new(bid, None)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = 2.0
    coll.objects.link(root)
    b = Build(spec, region)
    spec['build'](b)
    parts = []
    for part in (b.yard, b.main, b.props):
        if part.empty:
            continue
        obj = part.make(coll, parent=root)
        obj.name = '%s.%s' % (part.name, bid)
        if part is b.yard:
            # The ground cover has no ink outline.
            for mod in list(obj.modifiers):
                obj.modifiers.remove(mod)
            if obj.data.materials and obj.data.materials[-1].name == 'pb_outline':
                obj.data.materials.pop()
        parts.append(obj)
    bpy.context.view_layer.update()
    tris = sum(triangles(o) for o in parts)
    height = max((o.matrix_world @ v.co).z for o in parts for v in o.data.vertices) if parts else 0.0
    root['phaicity_era'] = spec['era']
    root['phaicity_region'] = region
    root['phaicity_kind'] = spec['kind']
    root['phaicity_level'] = spec['level'] or 0
    root['phaicity_tiles'] = spec['tiles']
    root['phaicity_label_th'] = spec['th']
    root['phaicity_label_en'] = spec['en']
    root['phaicity_triangles'] = tris
    root['phaicity_height'] = round(height, 2)
    coll.asset_mark()
    coll.asset_data.description = spec['th'] + ' / ' + spec['en']
    for tag in ('era%d' % spec['era'], region, spec['kind']):
        coll.asset_data.tags.new(tag)
    over = '  OVER BUDGET %d' % BUDGET[spec['tiles']] if tris > BUDGET[spec['tiles']] else ''
    print('BUILT   %-34s %6d triangles  %5.1f m high%s' % (bid, tris, height, over))
    return root


def lay_out(roots_specs):
    """Two blocks, each a sheet of its own: homes, shops and factories in three rows; the services in two rows of
    five beside them (far enough apart that each sheet frames only its block)."""
    cursor = {}
    svc = 0
    for root, spec in roots_specs:
        row = ROW_OF.get(spec['kind'].split('_')[0])
        size = spec['tiles'] * TILE_M
        if row is None:
            col, line = svc % 5, svc // 5
            root.location = (400.0 + col * 54.0, -line * 54.0, 0)
            svc += 1
            continue
        x = cursor.get(row, 0.0)
        root.location = (x + size / 2, -row * 40.0, 0)
        cursor[row] = x + size + 5.0


def is_service(spec):
    return spec['kind'].split('_')[0] not in ROW_OF


def render_sheet(cam, roots_specs, path, which):
    objs = [o for r, s in roots_specs for o in objects_of(r)]
    mine = [o for r, s in roots_specs if is_service(s) == which for o in objects_of(r)]
    if not mine:
        return
    keep = set(mine)
    for o in objs:
        o.hide_render = o not in keep
    scene.frame(cam, mine, margin=1.04)
    scene.render(path)
    for o in objs:
        o.hide_render = False


def export_each(roots_specs, era, region):
    for root, spec in roots_specs:
        loc = root.location.copy()
        root.location = (0, 0, 0)
        bpy.context.view_layer.update()
        path = os.path.join(ROOT, 'glb', era, region, root.name + '.glb')
        scene.export_glb(path, objects_of(root))
        root.location = loc
    bpy.context.view_layer.update()


def closeups(cam, roots_specs, era, region):
    sc = bpy.context.scene
    res = sc.render.resolution_x, sc.render.resolution_y
    sc.render.resolution_x, sc.render.resolution_y = 1200, 800
    all_objs = [o for r, _ in roots_specs for o in objects_of(r)]
    for root, spec in roots_specs:
        mine = set(objects_of(root))
        for o in all_objs:
            o.hide_render = o not in mine
        scene.frame(cam, objects_of(root))
        scene.render(os.path.join(ROOT, 'previews', era, region, root.name + '.png'))
    for o in all_objs:
        o.hide_render = False
    sc.render.resolution_x, sc.render.resolution_y = res


def build_set(era, region, force=False, only=None, close=False):
    name = set_name(era, region)
    blend = os.path.join(ROOT, 'blend', era, name + '.blend')
    specs = ERAS[era]
    if only:
        specs = [s for s in specs if s['kind'] in only]
    if name in locked() and not only:
        if not os.path.exists(blend):
            raise SystemExit('%s is in LOCKED.txt but %s is missing' % (name, blend))
        bpy.ops.wm.open_mainfile(filepath=blend)
        roots = [(bpy.data.objects[building_id(s, region)], s) for s in specs
                 if building_id(s, region) in bpy.data.objects]
        export_each(roots, era, region)
        print('LOCKED  %s re-exported %d buildings' % (name, len(roots)))
        return
    if os.path.exists(blend) and not force and not only:
        print('SKIP    %s (exists; --force to rebuild)' % name)
        return
    scene.reset()
    cam = scene.studio(res=(2400, 1600))
    set_coll = scene.collection(name)
    roots = [(make_building(s, region, set_coll), s) for s in specs]
    lay_out(roots)
    bpy.context.view_layer.update()
    if only:
        closeups(cam, roots, era, region)
        return
    export_each(roots, era, region)
    scene.frame(cam, [o for r, _ in roots for o in objects_of(r)], margin=1.04)
    scene.save(blend)
    render_sheet(cam, roots, os.path.join(ROOT, 'previews', name + '_sheet.png'), False)
    render_sheet(cam, roots, os.path.join(ROOT, 'previews', name + '_services.png'), True)
    print('Saved: %s_sheet.png' % name)
    if close:
        closeups(cam, roots, era, region)


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    words = [a for a in args if not a.startswith('--')]
    if not words:
        raise SystemExit(__doc__)
    force = '--force' in args
    close = '--closeups' in args
    only = None
    if '--only' in args:
        only = set(args[args.index('--only') + 1].split(','))
        words = [w for w in words if w != args[args.index('--only') + 1]]
    eras = list(ERAS) if words[0] == 'all' else [words[0]]
    regions = [words[1]] if len(words) > 1 else list(REGIONS)
    for era in eras:
        if era not in ERAS:
            raise SystemExit('No buildings for %s yet' % era)
        for region in regions:
            if region not in REGIONS:
                raise SystemExit('Unknown region %s (%s)' % (region, ', '.join(REGIONS)))
            build_set(era, region, force, only, close)


main()
