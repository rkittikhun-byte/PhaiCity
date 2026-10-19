# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Build the activity clips (scripts/clips.py):

    blender -b --factory-startup --python-exit-code 1 -P scripts/build_clips.py

- blend/clips.blend: one demo person per clip with its prop, animated (press play in Blender), in rows.
- glb/clips.glb: one plain person carrying every clip as a glTF animation named after the clip; three.js binds
  them by node name (body, head, arm_R, forearm_R, ..., shin_L and the root), so they play on any character.
- clips.json: the same clips as numbers (Blender local Euler XYZ in degrees per part, root z in metres).
- previews/clips_sheet.png: every demo at its second key.
"""

import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from lib import body, scene  # noqa: E402
from clips import CLIPS, FPS, REST  # noqa: E402

PARTS = ['body', 'head', 'arm_R', 'forearm_R', 'arm_L', 'forearm_L', 'leg_R', 'shin_R', 'leg_L', 'shin_L']

DEMO = dict(kind='man', hair='spiky', top={'type': 'mandarin', 'color': 'indigo', 'sleeve': 'short'},
            bottom={'type': 'knee', 'color': 'brown'}, shoes='sandals', extras=[{'type': 'sash', 'side': -1}],
            th='คนสาธิตท่าทาง', en='Activity demo person', sheet='clips')


def rotations(pose):
    """Object rotations (radians, Blender local Euler XYZ) and root z for a clip pose."""
    out = {}
    for part in ('body', 'head'):
        p = pose.get(part, {})
        # Body and head point up, so a forward pitch is +X (the limbs hang down and take -X).
        out[part] = (math.radians(p.get('pitch', 0)), math.radians(p.get('roll', 0)), math.radians(p.get('turn', 0)))
    for tag, side in (('R', -1), ('L', 1)):
        arm = dict(REST['arm_' + tag])
        arm.update(pose.get('arm_' + tag, {}))
        out['arm_' + tag] = body.arm_rotation(arm, side)
        out['forearm_' + tag] = (math.radians(-arm.get('elbow', 0)), 0.0, 0.0)
        leg = pose.get('leg_' + tag, {})
        out['leg_' + tag] = (math.radians(-leg.get('pitch', 0)), 0.0, math.radians(leg.get('turn', 0)) * -side)
        out['shin_' + tag] = (math.radians(leg.get('knee', 0)), 0.0, 0.0)
    return out, pose.get('root_z', 0.0)


def parts_of(root):
    found = {o.name.split('.')[0]: o for o in root.children_recursive}
    return {name: found[name] for name in PARTS}


def animate(root, name, clip):
    """Key the clip on root and its parts, each object in its own action named '<clip>|<object>'."""
    objs = parts_of(root)
    for obj in [root] + list(objs.values()):
        obj.animation_data_create()
        obj.animation_data.action = bpy.data.actions.new('%s|%s' % (name, obj.name.split('.')[0]))
    base_z = root.location.z
    for frame, pose in clip['keys']:
        rots, z = rotations(pose)
        for part, obj in objs.items():
            obj.rotation_euler = rots[part]
            obj.keyframe_insert('rotation_euler', frame=frame)
        root.location.z = base_z + z
        root.keyframe_insert('location', index=2, frame=frame)
    return objs


def write_json():
    out = {'fps': FPS, 'parts': PARTS,
           'units': 'rotation: Blender local Euler XYZ in degrees (Z up, the character faces -Y); root_z in metres. '
                    'In three.js (Y up) use the glTF animations in glb/clips.glb, which are the same clips.',
           'clips': {}}
    for name, clip in CLIPS.items():
        keys = []
        for frame, pose in clip['keys']:
            rots, z = rotations(pose)
            keys.append({'frame': frame, 'root_z': round(z, 4),
                         'rot': {p: [round(math.degrees(a), 2) for a in rots[p]] for p in PARTS}})
        out['clips'][name] = {'th': clip['th'], 'loop': clip.get('loop', True), 'frames': clip['keys'][-1][0],
                              'arms': clip.get('arms', True), 'prop': clip.get('prop'), 'note': clip.get('note', ''),
                              'keys': keys}
    with open(os.path.join(ROOT, 'clips.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)


def demo_sheet():
    scene.reset()
    cam = scene.studio(res=(2400, 1500))
    per_row = 7
    placed = []
    for i, (name, clip) in enumerate(CLIPS.items()):
        spec = dict(DEMO, id='clip_' + name)
        if clip.get('prop'):
            spec['props'] = [dict(clip['prop'])]
        coll = scene.collection('clip_' + name)
        root = body.build(spec, coll)
        root['phaicity_clip'] = name
        row, col = divmod(i, per_row)
        root.location = scene.RIGHT * (col * 1.6) + scene.TOWARD * (row * 4.0)
        animate(root, name, clip)
        placed += [root] + list(root.children_recursive)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 0, 48
    # Show each demo at its second key for the preview.
    sc.frame_set(6)
    bpy.context.view_layer.update()
    scene.frame(cam, placed, margin=1.04)
    scene.save(os.path.join(ROOT, 'blend', 'clips.blend'))
    scene.render(os.path.join(ROOT, 'previews', 'clips_sheet.png'))


def rig_glb():
    """One plain person with every clip pushed to its own NLA track, exported with each track as an animation."""
    scene.reset()
    coll = scene.collection('clips_rig')
    root = body.build(dict(DEMO, id='clips_rig'), coll)
    objs = [root] + list(root.children_recursive)
    for name, clip in CLIPS.items():
        animate(root, name, clip)
        for obj in objs:
            ad = obj.animation_data
            if ad is None or ad.action is None:
                continue
            track = ad.nla_tracks.new()
            track.name = name
            track.strips.new(name, 0, ad.action)
            ad.action = None
    path = os.path.join(ROOT, 'glb', 'clips.glb')
    # The file holds only the rig, so no selection is needed. Every part keeps every channel in every clip, so a
    # clip never inherits the rotation another clip left behind.
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=False, export_animations=True,
                              export_animation_mode='NLA_TRACKS', export_extras=True,
                              export_optimize_animation_size=False,
                              export_optimize_animation_keep_anim_object=True)
    scene.save(os.path.join(ROOT, 'blend', 'clips_rig.blend'))


write_json()
demo_sheet()
rig_glb()
print('CLIPS   %d clips written' % len(CLIPS))
