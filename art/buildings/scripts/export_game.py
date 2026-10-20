# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Export the era buildings for the game (IMPORT.md): a light glb of every building and the index the game reads.

    blender -b --factory-startup --python-exit-code 1 -P art/buildings/scripts/export_game.py -- [era1 ...] [--region R]

Reads the sets' .blend files (blend/era<n>/era<n>_<region>.blend, made by build.py) and writes
assets/models/buildings/era<n>/<region>/<kind>.glb and assets/models/buildings/index.json. Each building becomes two
meshes with its palette colours baked into vertex colours and no materials of its own: `body` (everything) and
`windows` (window glass, lamps and lit screens, which the game lights at night). The ink outline is dropped and loose
parts are merged. Units stay metres; the game scales a 16 m tile to its 10 units.
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
GAME = os.path.dirname(os.path.dirname(ART))
OUT = os.path.join(GAME, 'assets', 'models', 'buildings')
sys.path.insert(0, HERE)

import bmesh  # noqa: E402
import bpy  # noqa: E402

from lib import palette  # noqa: E402
from lib.builder import KINDS, TILES  # noqa: E402
from lib.regions import REGIONS  # noqa: E402

ERAS = ('era1', 'era2', 'era3', 'era4', 'era5')
# Colours that glow at night in the game: windows, lamps, lit screens and signs (palette.EMISSIVE and its kin).
# Draco (three.js DRACOLoader, decoder in assets/draco/): about a tenth of the plain size. No normals: the game draws
# these flat shaded, as the concept's flat colours are, so faces share their corners and the files shrink again.
COMPRESSION = {'export_draco_mesh_compression_enable': True, 'export_draco_mesh_compression_level': 10,
               'export_draco_position_quantization': 13, 'export_draco_color_quantization': 8}
# Triangles a building may have in the game, by its tiles: the city repeats a plot's building many times, so the
# props are thinned first (down to a fifth), then the building itself (down to about a third).
GAME_BUDGET = {1: 4500, 2: 11000, 3: 16000}
WINDOW_COLOURS = {'window_dark', 'window_lit', 'lamp', 'screen_lit', 'glass_dark'}


def is_window(name):
    base = name[3:] if name.startswith('pb_') else name
    base = base.split('.')[0]
    return base in WINDOW_COLOURS or base in palette.EMISSIVE or base.endswith('_glow') or base.endswith('_lit')


def material_colour(mat):
    if mat is None:
        return (0.8, 0.8, 0.8, 1.0)
    if mat.use_nodes:
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        if bsdf:
            c = bsdf.inputs['Base Color'].default_value
            return (c[0], c[1], c[2], 1.0)
    c = mat.diffuse_color
    return (c[0], c[1], c[2], 1.0)


def tris_of(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def thinning(root, meshes):
    """Decimate ratios per object so the building fits GAME_BUDGET: props first, then the building; the yard never."""
    budget = GAME_BUDGET[int(root.get('phaicity_tiles', 1))]
    count = {o.name: tris_of(o) for o in meshes}
    total = sum(count.values())
    if total <= budget:
        return {}
    props = [o for o in meshes if o.name.startswith('props')]
    body = [o for o in meshes if o.name.startswith('building')]
    p_tris = sum(count[o.name] for o in props)
    b_tris = sum(count[o.name] for o in body)
    fixed = total - p_tris - b_tris
    ratios = {}
    p_ratio = 1.0
    if p_tris:
        p_ratio = max(0.2, min(1.0, (budget - fixed - b_tris) / p_tris))
        for o in props:
            ratios[o.name] = p_ratio
    left = budget - fixed - p_tris * p_ratio
    if b_tris and left < b_tris:
        b_ratio = max(0.35, left / b_tris)
        for o in body:
            ratios[o.name] = b_ratio
    return ratios


def baked(root):
    """One new mesh object per kind of part (body, windows) for the building under root, in the root's space, with
    the palette colours in a vertex colour attribute."""
    groups = {'body': bmesh.new(), 'windows': bmesh.new()}
    layers = {k: bm.loops.layers.float_color.new('Col') for k, bm in groups.items()}
    inv = root.matrix_world.inverted()
    meshes = [o for o in root.children_recursive if o.type == 'MESH' and o.data.polygons]
    ratios = thinning(root, meshes)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in meshes:
        for mod in list(obj.modifiers):
            obj.modifiers.remove(mod)
        ratio = ratios.get(obj.name, 1.0)
        if ratio < 0.999:
            dec = obj.modifiers.new('Thin', 'DECIMATE')
            dec.ratio = ratio
            dec.use_collapse_triangulate = True
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated = obj.evaluated_get(depsgraph)
        me = evaluated.to_mesh()
        mats = [m for m in obj.data.materials]
        src = bmesh.new()
        src.from_mesh(me)
        evaluated.to_mesh_clear()
        src.transform(inv @ obj.matrix_world)
        for face in src.faces:
            mat = mats[face.material_index] if face.material_index < len(mats) else None
            if mat is not None and mat.name == palette.OUTLINE:
                continue
            group = 'windows' if mat is not None and is_window(mat.name) else 'body'
            bm = groups[group]
            col = material_colour(mat)
            verts = [bm.verts.new(v.co) for v in face.verts]
            try:
                nf = bm.faces.new(verts)
            except ValueError:
                continue
            for loop in nf.loops:
                loop[layers[group]] = col
        src.free()
    out = []
    for name, bm in groups.items():
        if not bm.faces:
            bm.free()
            continue
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        attr = me.color_attributes.get('Col')
        if attr is not None:
            me.color_attributes.active_color = attr
        obj = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(obj)
        out.append(obj)
    return out


def export_set(era, region, index):
    path = os.path.join(ART, 'blend', era, '%s_%s.blend' % (era, region))
    if not os.path.exists(path):
        print('MISSING %s' % path)
        return
    bpy.ops.wm.open_mainfile(filepath=path)
    for kind in KINDS:
        bid = '%s_%s_%s' % (era, region, kind)
        root = bpy.data.objects.get(bid)
        if root is None:
            print('MISSING %s' % bid)
            continue
        objs = baked(root)
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        dest = os.path.join(OUT, era, region, kind + '.glb')
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=dest, export_format='GLB', use_selection=True, export_apply=False,
                                  export_yup=True, export_materials='NONE', export_vertex_color='ACTIVE',
                                  export_normals=False, export_texcoords=False, export_extras=False,
                                  export_animations=False, **COMPRESSION)
        tris = sum(len(o.data.polygons) for o in objs)
        height = max((v.co.z for o in objs for v in o.data.vertices), default=0.0)
        index.setdefault(era, {}).setdefault(region, {})[kind] = {'height': round(height, 2), 'triangles': tris}
        for o in objs:
            bpy.data.objects.remove(o)
        print('EXPORT  %-34s %6d triangles %8d bytes' % (bid, tris, os.path.getsize(dest)))


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    eras = [a for a in args if a in ERAS] or list(ERAS)
    regions = list(REGIONS)
    if '--region' in args:
        regions = [args[args.index('--region') + 1]]
    index_path = os.path.join(OUT, 'index.json')
    index = {}
    if os.path.exists(index_path):
        with open(index_path, encoding='utf-8') as f:
            index = json.load(f).get('buildings', {})
    for era in eras:
        for region in regions:
            export_set(era, region, index)
    os.makedirs(OUT, exist_ok=True)
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump({'version': 1, 'tileMetres': 16, 'kinds': {k: {'tiles': TILES[k]} for k in KINDS},
                   'buildings': index}, f, ensure_ascii=False, indent=1, sort_keys=True)
    print('Saved: %s' % index_path)


main()
