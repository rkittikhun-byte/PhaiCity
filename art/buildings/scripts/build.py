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

--frontage builds the era's frontage variants instead (era<n>_frontage.py, PLAN.md "Frontage"): the set
era<n>_<region>_frontage, its .blend beside the era's, its glbs in the same folder and one sheet,
previews/era<n>_<region>_frontage.png, with the bays laid out as terraces.

--temple builds the era's temple compounds instead (temples.py, PLAN.md "Temples"): the set era<n>_<region>_temple,
temple_1 ... temple_3 side by side on one sheet, previews/era<n>_<region>_temple.png.

--store builds the era's department store instead (stores.py, PLAN.md "Department stores", eras 2-5): the set
era<n>_<region>_store, one building, one preview, previews/era<n>_<region>_store.png.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from lib import scene  # noqa: E402
from lib.builder import BAY_M, Build, TILE_M  # noqa: E402
from lib.mesh import triangles  # noqa: E402
from lib.regions import REGIONS  # noqa: E402
from buildings import ERAS, FRONTAGE_SETS, STORE_SETS, TEMPLE_SETS  # noqa: E402

# Triangles in the Blender source by footprint (PLAN.md "Detail level").
BUDGET = {1: 12000, 2: 30000, 3: 45000}
# ... and a frontage building's by its frontage: a shophouse bay is a quarter of a tile, a 12 m house three quarters
FRONTAGE_BUDGET = {BAY_M: 3000, 12.0: 9000}
ROW_OF = {'home': 0, 'shop': 1, 'factory': 2}
ROW_GAP = 60.0


def locked():
    path = os.path.join(ROOT, 'LOCKED.txt')
    if not os.path.exists(path):
        return set()
    with open(path, encoding='utf-8') as f:
        return {line.split('#')[0].strip() for line in f if line.split('#')[0].strip()}


def set_name(era, region, frontage=False, temple=False, store=False):
    return '%s_%s%s' % (era, region, '_frontage' if frontage else ('_temple' if temple else ('_store' if store else '')))


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
    for part in (b.yard, b.main, b.props, b.signs):
        if part.empty:
            continue
        obj = part.make(coll, parent=root)
        obj.name = '%s.%s' % (part.name, bid)
        if part is b.yard or part is b.signs:
            # The ground cover and the lettering have no ink outline.
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
    if spec.get('width'):
        root['phaicity_width'] = spec['width']
        root['phaicity_depth'] = b.depth
    root['phaicity_label_th'] = spec['th']
    root['phaicity_label_en'] = spec['en']
    root['phaicity_triangles'] = tris
    root['phaicity_height'] = round(height, 2)
    coll.asset_mark()
    coll.asset_data.description = spec['th'] + ' / ' + spec['en']
    for tag in ('era%d' % spec['era'], region, spec['kind']):
        coll.asset_data.tags.new(tag)
    budget = FRONTAGE_BUDGET[spec['width']] if spec.get('width') else BUDGET[spec['tiles']]
    over = '  OVER BUDGET %d' % budget if tris > budget else ''
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


def lay_out_frontage(roots_specs):
    """The frontage set in two rows, one per height: a terrace of six bays (left, mid, mid2, mid, mid2, right) flush
    side by side, then the bay that stands alone, then the 12 m house. The terrace's second mid and mid2 are
    instances of the first (studio objects, never exported), so the sheet shows how bays join. Returns the instancers."""
    by_kind = {spec['kind']: root for root, spec in roots_specs}
    extra = []
    studio = bpy.data.collections.get(scene.STUDIO)
    for row, h in enumerate((1, 2)):
        y = -row * 24.0
        x = 0.0
        terrace = ['left', 'mid', 'mid2', 'mid', 'mid2', 'right']
        seen = set()
        for place in terrace:
            kind = 'bay%d_%s' % (h, place)
            root = by_kind.get(kind)
            if root is None:
                x += BAY_M
                continue
            centre = (x + BAY_M / 2, y, 0)
            if kind in seen:
                inst = bpy.data.objects.new('copy.%s.%d' % (kind, len(extra)), None)
                inst.instance_type = 'COLLECTION'
                inst.instance_collection = root.users_collection[0]
                inst.location = centre
                studio.objects.link(inst)
                extra.append((inst, kind))
            else:
                root.location = centre
                seen.add(kind)
            x += BAY_M
        x += 4.0
        root = by_kind.get('bay%d_one' % h)
        if root is not None:
            root.location = (x + BAY_M / 2, y, 0)
        x += BAY_M + 5.0
        root = by_kind.get('house12_%d' % h)
        if root is not None:
            root.location = (x + 6.0, y, 0)
    bpy.context.view_layer.update()
    # each instance shows its collection from the collection's own origin: the original's place
    for inst, kind in extra:
        coll = inst.instance_collection
        coll.instance_offset = by_kind[kind].location.copy()
    return [inst for inst, _ in extra]


def lay_out_temples(roots_specs):
    """The temple levels side by side, left to right, a little apart."""
    for i, (root, spec) in enumerate(roots_specs):
        root.location = (i * 54.0, 0, 0)


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


def build_set(era, region, force=False, only=None, close=False, frontage=False, temple=False, store=False):
    name = set_name(era, region, frontage, temple, store)
    blend = os.path.join(ROOT, 'blend', era, name + '.blend')
    specs = FRONTAGE_SETS[era] if frontage else (TEMPLE_SETS[era] if temple else
                                                 (STORE_SETS[era] if store else ERAS[era]))
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
    copies = lay_out_frontage(roots) if frontage else []
    if temple or store:
        lay_out_temples(roots)
    elif not frontage:
        lay_out(roots)
    bpy.context.view_layer.update()
    if only:
        for inst in copies:
            inst.hide_render = True
        closeups(cam, roots, era, region)
        return
    export_each(roots, era, region)
    if frontage or temple or store:
        scene.frame(cam, [o for r, _ in roots for o in objects_of(r)], margin=1.06)
        scene.save(blend)
        scene.render(os.path.join(ROOT, 'previews', name + '.png'))
        print('Saved: %s_sheet.png' % name)
        if close:
            for inst in copies:
                inst.hide_render = True
            closeups(cam, roots, era, region)
        return
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
    frontage = '--frontage' in args
    temple = '--temple' in args
    store = '--store' in args
    only = None
    if '--only' in args:
        only = set(args[args.index('--only') + 1].split(','))
        words = [w for w in words if w != args[args.index('--only') + 1]]
    sets = FRONTAGE_SETS if frontage else (TEMPLE_SETS if temple else (STORE_SETS if store else ERAS))
    eras = list(sets) if words[0] == 'all' else [words[0]]
    regions = [words[1]] if len(words) > 1 else list(REGIONS)
    for era in eras:
        if era not in sets:
            raise SystemExit('No %sbuildings for %s yet' % ('frontage ' if frontage else ('temple ' if temple else
                                                                                       ('store ' if store else '')),
                                                             era))
        for region in regions:
            if region not in REGIONS:
                raise SystemExit('Unknown region %s (%s)' % (region, ', '.join(REGIONS)))
            build_set(era, region, force, only, close, frontage, temple, store)


main()
