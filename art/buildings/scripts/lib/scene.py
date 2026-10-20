# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The studio round a building (camera, warm sun, lavender shadows, sand ground as in the concept sheets),
saving, glTF export and preview renders."""

import math
import os

import bpy
from mathutils import Vector

from . import palette

STUDIO = 'studio'
SAND = (0.62, 0.44, 0.2)
# Looking from the front-left and from above, as on the concept sheets.
VIEW = Vector((-0.62, -0.78, 0.62)).normalized()
RIGHT = Vector((1.0, 0.0, 0.0))
TOWARD = Vector((0.0, -1.0, 0.0))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def collection(name, parent=None):
    coll = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(coll)
    return coll


def studio(width=16.0, height=16.0, centre=(0.0, 0.0, 4.0), res=(900, 900)):
    """Camera, light and ground in a 'studio' collection (never exported)."""
    scene = bpy.context.scene
    coll = collection(STUDIO)
    # Orthographic camera from the front-right and above, like the concept sheets.
    cam_data = bpy.data.cameras.new('camera')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = max(width, height * res[0] / res[1]) * 1.0
    cam = bpy.data.objects.new('camera', cam_data)
    coll.objects.link(cam)
    direction = VIEW.normalized()
    c = Vector(centre)
    cam.location = c + direction * 400
    cam.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    cam_data.clip_end = 2000
    # Warm sun from the front-left of the picture... shadows fall back and to the left as in the sheets.
    sun_data = bpy.data.lights.new('sun', 'SUN')
    sun_data.energy = 3.2
    sun_data.color = (1.0, 0.93, 0.82)
    sun_data.angle = math.radians(1.5)
    sun = bpy.data.objects.new('sun', sun_data)
    coll.objects.link(sun)
    light_dir = Vector((0.55, -0.75, 1.25)).normalized()
    sun.rotation_euler = (-light_dir).to_track_quat('-Z', 'Y').to_euler()
    # Lavender sky light fills the shadows.
    world = bpy.data.worlds.new('world')
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (0.40, 0.36, 0.66, 1)
    bg.inputs['Strength'].default_value = 0.9
    scene.world = world
    # Sand ground.
    mesh = bpy.data.meshes.new('ground')
    s = 3000
    mesh.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
    ground = bpy.data.objects.new('ground', mesh)
    mat = bpy.data.materials.new('studio_sand')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = SAND + (1,)
    bsdf.inputs['Roughness'].default_value = 1.0
    mesh.materials.append(mat)
    coll.objects.link(ground)
    # Render settings.
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    try:
        scene.eevee.use_shadows = True
        scene.eevee.taa_render_samples = 32
    except AttributeError:
        pass
    scene.unit_settings.system = 'METRIC'
    return cam


def frame(cam, objects, margin=1.12, res=None):
    """Fit the orthographic camera to the objects' bounds."""
    pts = []
    for obj in objects:
        if obj.type != 'MESH':
            continue
        for corner in obj.bound_box:
            pts.append(obj.matrix_world @ Vector(corner))
    if not pts:
        return
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre = (lo + hi) / 2
    direction = (cam.location - Vector((0, 0, 0)))
    direction = VIEW.normalized()
    cam.location = centre + direction * 400
    cam.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    # Project the bounds onto the camera plane.
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    xs, ys = [], []
    for p in pts:
        q = inv @ p
        xs.append(q.x)
        ys.append(q.y)
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    scene = bpy.context.scene
    aspect = scene.render.resolution_x / scene.render.resolution_y
    cam.data.ortho_scale = max(w, h * aspect) * margin
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    cam.location = cam.matrix_world @ Vector((cx, cy, 0))


def render(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.context.scene.render.filepath = path
    bpy.context.scene.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)


def save(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)


def export_glb(path, objects):
    """The building alone, without the studio and without the preview outline (modifiers are not applied)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for obj in bpy.context.view_layer.objects:
        obj.select_set(False)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=False,
                              export_yup=True, export_extras=True, export_animations=True,
                              export_materials='EXPORT')
