# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Export the people for the game (IMPORT.md): a lighter glb of every character and the clips.

    blender -b --factory-startup --python-exit-code 1 -P art/people/scripts/export_game.py

Writes assets/models/people/<sheet>/<id>.glb (no outline, meshes decimated to about half), clips.glb (copied from
art/people/glb) and index.json, the list the game reads (src/render3d/city/people3d.ts). Characters that sit or are
only a machine are listed with walker: false.
"""

import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PEOPLE = os.path.dirname(HERE)
GAME = os.path.dirname(os.path.dirname(PEOPLE))
OUT = os.path.join(GAME, 'assets', 'models', 'people')
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from characters import SHEETS  # noqa: E402

RATIO = 0.5
# The parts the game moves; anything else under the root (boats, carts, robots) stays out of the game file.
PARTS = {'body', 'head', 'arm_R', 'forearm_R', 'arm_L', 'forearm_L', 'leg_R', 'shin_R', 'leg_L', 'shin_L'}


def keep(obj, root):
    """True for the character's own parts and what they hold or wear."""
    while obj is not None and obj is not root:
        if obj.name.split('.')[0] in PARTS:
            return True
        obj = obj.parent
    return False


def export(spec):
    blend = os.path.join(PEOPLE, 'blend', spec['sheet'], spec['id'] + '.blend')
    bpy.ops.wm.open_mainfile(filepath=blend)
    root = bpy.data.objects[spec['id']]
    objs = [root] + [o for o in root.children_recursive if keep(o, root)]
    tris = 0
    for obj in objs:
        if obj.type != 'MESH':
            continue
        for mod in list(obj.modifiers):
            if mod.name == 'Outline':
                obj.modifiers.remove(mod)
        if len(obj.data.polygons) > 40:
            dec = obj.modifiers.new('Decimate', 'DECIMATE')
            dec.ratio = RATIO
            dec.use_collapse_triangulate = True
        # Drop the outline material slot so the glb carries only colours.
        while len(obj.data.materials) and obj.data.materials[-1] and obj.data.materials[-1].name == 'pc_outline':
            obj.data.materials.pop()
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    for obj in objs:
        if obj.type == 'MESH':
            ev = obj.evaluated_get(deps)
            tris += sum(len(p.vertices) - 2 for p in ev.data.polygons)
    for obj in bpy.context.view_layer.objects:
        obj.select_set(obj in objs)
    path = os.path.join(OUT, spec['sheet'], spec['id'] + '.glb')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_extras=True, export_animations=False)
    return tris


def main():
    entries = []
    for sheet, specs in SHEETS.items():
        for spec in specs:
            pose = spec.get('pose', {})
            sits = 'root_z' in spec or any(k.startswith('leg') and v.get('pitch', 0) > 60 for k, v in pose.items())
            walker = not spec.get('only_props') and not sits
            tris = export(spec) if walker else 0
            entries.append({'id': spec['id'], 'sheet': sheet, 'kind': spec.get('kind', 'man'), 'th': spec.get('th', ''),
                            'swingArms': bool(spec.get('swing_arms', True)), 'walker': walker,
                            'file': '%s/%s.glb' % (sheet, spec['id']) if walker else None, 'triangles': tris})
            print('GAME    %-26s %5d triangles%s' % (spec['id'], tris, '' if walker else '  (not a walker)'))
    shutil.copyfile(os.path.join(PEOPLE, 'glb', 'clips.glb'), os.path.join(OUT, 'clips.glb'))
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump({'note': 'Made by art/people/scripts/export_game.py; do not edit by hand.', 'clips': 'clips.glb',
                   'people': entries}, f, ensure_ascii=False, indent=1)


main()
