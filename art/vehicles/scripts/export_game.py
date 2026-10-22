# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Export the era vehicles for the game: a light glb of every vehicle and the index the game reads.

    blender -b --factory-startup --python-exit-code 1 -P art/vehicles/scripts/export_game.py -- [era1 ...]

Reads blend/era<n>_vehicles.blend (made by build.py) and writes assets/models/vehicles/era<n>/<kind>.glb and
assets/models/vehicles/index.json. Each vehicle becomes meshes with its palette colours baked into vertex colours:
`body` (everything that keeps its colour), `paint` (the faces in the kind's paint, white, which the game tints per car),
`lights` (headlamps, tail lights and light strips, which glow at night) and `wheel0`, `wheel1` ... (one wheel of each
set at the origin, which the game turns and places at each of its positions, listed in the index). No normals (drawn
flat shaded), Draco compressed, thinned to GAME_BUDGET. glTF is Y up with the front at +Z; units stay metres.
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
GAME = os.path.dirname(os.path.dirname(ART))
OUT = os.path.join(GAME, 'assets', 'models', 'vehicles')
sys.path.insert(0, HERE)

import bmesh  # noqa: E402
import bpy  # noqa: E402

import vlib  # noqa: E402
from lib import palette  # noqa: E402

ERAS = ('era1', 'era2', 'era3', 'era4', 'era5')
COMPRESSION = {'export_draco_mesh_compression_enable': True, 'export_draco_mesh_compression_level': 10,
               'export_draco_position_quantization': 13, 'export_draco_color_quantization': 8}
# Triangles a vehicle's body (with its rider) may have in the game, by class; its wheels apart, each light
GAME_BUDGET = {'small': 2500, 'cart': 3200, 'car': 2000, 'heavy': 2600, 'flyer': 1600}


def colour_of(mat):
    if mat is None:
        return (0.8, 0.8, 0.8, 1.0)
    bsdf = mat.node_tree.nodes.get('Principled BSDF') if mat.use_nodes else None
    c = bsdf.inputs['Base Color'].default_value if bsdf else mat.diffuse_color
    return (c[0], c[1], c[2], 1.0)


def base_name(mat):
    return mat.name[3:].split('.')[0] if mat and mat.name.startswith('pb_') else (mat.name if mat else '')


def bake(objs, root, paint, ratio=1.0, origin=False):
    """New mesh objects body / paint / lights from objs, in the root's space (or each object's own, origin=True)."""
    groups = {'body': bmesh.new(), 'paint': bmesh.new(), 'lights': bmesh.new()}
    layers = {k: bm.loops.layers.float_color.new('Col') for k, bm in groups.items()}
    inv = root.matrix_world.inverted()
    for obj in objs:
        for mod in list(obj.modifiers):
            obj.modifiers.remove(mod)
        if ratio < 0.999:
            dec = obj.modifiers.new('Thin', 'DECIMATE')
            dec.ratio = ratio
        dg = bpy.context.evaluated_depsgraph_get()
        ev = obj.evaluated_get(dg)
        me = ev.to_mesh()
        src = bmesh.new()
        src.from_mesh(me)
        ev.to_mesh_clear()
        if not origin:
            src.transform(inv @ obj.matrix_world)
        mats = list(obj.data.materials)
        for face in src.faces:
            mat = mats[face.material_index] if face.material_index < len(mats) else None
            if mat is not None and mat.name == palette.OUTLINE:
                continue
            name = base_name(mat)
            group = 'lights' if name in vlib.LIGHT_COLOURS else ('paint' if name == paint else 'body')
            col = (1.0, 1.0, 1.0, 1.0) if group == 'paint' else colour_of(mat)
            bm = groups[group]
            verts = [bm.verts.new(v.co) for v in face.verts]
            try:
                nf = bm.faces.new(verts)
            except ValueError:
                continue
            for loop in nf.loops:
                loop[layers[group]] = col
        src.free()
    out = {}
    for name, bm in groups.items():
        if not bm.faces:
            bm.free()
            continue
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        me.color_attributes.active_color = me.color_attributes.get('Col')
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        out[name] = o
    return out


def tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def gl(co):
    """Blender (x, y, z), front -Y, to glTF (x, y up, z front)."""
    return [round(co[0], 3), round(co[2], 3), round(-co[1], 3)]


def srgb_hex(name):
    return palette.COLORS[name].upper()


def export_era(era, index):
    path = os.path.join(ART, 'blend', '%s_vehicles.blend' % era)
    if not os.path.exists(path):
        print('MISSING %s' % path)
        return
    bpy.ops.wm.open_mainfile(filepath=path)
    roots = [o for o in bpy.data.objects if o.type == 'EMPTY' and 'phaicity_kind' in o]
    for root in roots:
        kind = root['phaicity_kind']
        cls = root['phaicity_class']
        paints = [p for p in root['phaicity_paints'].split(',') if p]
        paint = paints[0] if paints else None
        root.location = (0, 0, 0)
        bpy.context.view_layer.update()
        body = [o for o in root.children if o.type == 'MESH' and o.name.startswith('body.')]
        count = sum(tris(o) for o in body)
        ratio = min(1.0, max(0.4, GAME_BUDGET[cls] / count)) if count else 1.0
        made = bake(body, root, paint, ratio)
        wheels = json.loads(root['phaicity_wheels'])
        for i, w in enumerate(wheels):
            first = next(o for o in root.children if o.name.startswith('wheel%d.' % i) and o.name.endswith('.0'))
            baked = bake([first], first, None, origin=True)
            whole = list(baked.values())
            if len(whole) > 1:
                bpy.ops.object.select_all(action='DESELECT')
                for o in whole:
                    o.select_set(True)
                bpy.context.view_layer.objects.active = whole[0]
                bpy.ops.object.join()
            wheel = whole[0]
            wheel.name = wheel.data.name = 'wheel%d' % i
            made[wheel.name] = wheel
            w['triangles'] = tris(wheel)
            w['at'] = [gl(a) for a in w['at']]
        bpy.ops.object.select_all(action='DESELECT')
        for o in made.values():
            o.select_set(True)
        bpy.context.view_layer.objects.active = next(iter(made.values()))
        dest = os.path.join(OUT, era, kind + '.glb')
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=dest, export_format='GLB', use_selection=True, export_apply=False,
                                  export_yup=True, export_materials='NONE', export_vertex_color='ACTIVE',
                                  export_normals=False, export_texcoords=False, export_extras=False,
                                  export_animations=False, **COMPRESSION)
        size = json.loads(root['phaicity_size'])
        body_tris = sum(tris(o) for n, o in made.items() if not n.startswith('wheel'))
        index[era + '/' + kind] = {
            'era': int(era[3:]), 'kind': kind, 'th': root['phaicity_label_th'], 'en': root['phaicity_label_en'],
            'class': cls, 'length': size[1], 'width': size[0], 'height': size[2], 'triangles': body_tris,
            'paints': [srgb_hex(p) for p in paints], 'slow': root['phaicity_slow'], 'fly': root['phaicity_fly'],
            'wheels': wheels,
        }
        for o in made.values():
            bpy.data.objects.remove(o)
        print('EXPORT  %-28s %5d triangles + wheels %s  %7d bytes' % (
            era + '/' + kind, body_tris, [w['triangles'] for w in wheels], os.path.getsize(dest)))


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    eras = [a for a in args if a in ERAS] or list(ERAS)
    index_path = os.path.join(OUT, 'index.json')
    index = {}
    if os.path.exists(index_path):
        with open(index_path, encoding='utf-8') as f:
            index = json.load(f).get('vehicles', {})
    for era in eras:
        export_era(era, index)
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump({'version': 1, 'vehicles': index}, f, ensure_ascii=False, indent=1, sort_keys=True)
    print('Saved: %s' % index_path)


main()
