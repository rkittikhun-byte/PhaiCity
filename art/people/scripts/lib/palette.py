# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The flat colours of the people, picked from the concept sheets (assets/concept/people_*.jpg).

Every material is a Principled BSDF with only a base colour, named pc_<colour>, so the glTF export carries the colour
and the game can map it to its own toon material. Change a colour here and rebuild to change it on every character.
"""

import bpy

COLORS = {
    # skin and hair
    'skin': '#E8B07C', 'skin_dark': '#C98955', 'hair': '#2A2320', 'hair_grey': '#A9A6A2', 'hair_brown': '#6B4A2F',
    'eye': '#1E1916', 'mouth': '#8A4A3A', 'blush': '#E88A6E', 'beard': '#4A3F38',
    # cloth
    'indigo': '#2E3F7F', 'navy': '#27324F', 'blue': '#3D5D9A', 'sky': '#8DAEDB', 'denim': '#7A9AC9',
    'teal': '#3F8A86', 'green': '#5E7F3E', 'olive': '#6E7445', 'red': '#A9443A', 'brick': '#C65A3D',
    'maroon': '#7E2F38', 'pink': '#D9877E', 'rose': '#E8A8A8', 'yellow': '#E0B03C', 'mustard': '#C9A23E',
    'orange': '#E07B2A', 'saffron': '#D9862A', 'purple': '#6B5A8E', 'cream': '#F1E8D2', 'white': '#F6F4EE',
    'khaki': '#C4AA7C', 'tan': '#B48A5E', 'brown': '#6E4A32', 'dark_brown': '#4A3226', 'charcoal': '#3A3A3E',
    'black': '#26262A', 'grey': '#8E8E92', 'light_grey': '#C9C9CB', 'silver': '#C8CCD2', 'gold': '#D6A93A',
    'sash': '#F0E6CC', 'stripe_pink': '#D98A8A', 'stripe_gold': '#D9B25E', 'plaid_red': '#B84A40',
    # materials of things
    'straw': '#D9B477', 'straw_dark': '#9C7444', 'wood': '#8A5A35', 'wood_dark': '#5E3B22', 'wood_light': '#B98A5A',
    'bamboo': '#C9A55E', 'leather': '#6B4129', 'rope': '#B08A5A', 'metal': '#9EA4AB', 'steel': '#C9CDD2',
    'iron': '#3C3C40', 'rubber': '#2B2B2E', 'bowl': '#2C2A2A', 'clay': '#B8653A', 'clay_dark': '#7B4A2E',
    'leaf': '#5F9A3A', 'leaf_dark': '#3F7A30', 'rice': '#D9C26A', 'banana': '#F0CF45', 'lime': '#9CCB4A',
    'net': '#CFC3A2', 'paper': '#F3EBDC', 'glass': '#7FA7B8', 'screen': '#2E3A48', 'lamp': '#FFD45A',
    'red_light': '#D63A2A', 'orange_vest': '#F08A2C', 'reflect': '#F2E7C8', 'hardhat': '#F2C230',
    'robot_white': '#EDEAE2', 'robot_orange': '#E39A2C', 'durian': '#A7A83A', 'rambutan': '#D2402E',
    'fish': '#AFC0CC', 'coconut': '#6FA048', 'coconut_in': '#F4F0E2', 'flower': '#FFFFFF', 'flower_red': '#D8463A',
    'jar': '#7B7442', 'sausage': '#8E3F2A', 'sticky_rice': '#F4F0E4', 'cloth_red': '#A8383A',
}

OUTLINE = 'pc_outline'
OUTLINE_THICKNESS = 0.012


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(name):
    h = COLORS[name].lstrip('#')
    return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))


def material(name):
    """The pc_<name> material, made once per file."""
    full = 'pc_' + name
    mat = bpy.data.materials.get(full)
    if mat:
        return mat
    mat = bpy.data.materials.new(full)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    color = rgb(name) + (1.0,)
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = 1.0
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.0
    mat.diffuse_color = color
    if name in ('lamp', 'red_light'):
        bsdf.inputs['Emission Color'].default_value = color
        bsdf.inputs['Emission Strength'].default_value = 2.0
    return mat


def outline_material():
    mat = bpy.data.materials.get(OUTLINE)
    if mat:
        return mat
    mat = bpy.data.materials.new(OUTLINE)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    emit = nodes.new('ShaderNodeEmission')
    emit.inputs['Color'].default_value = (0.045, 0.03, 0.025, 1)
    mat.node_tree.links.new(emit.outputs['Emission'], out.inputs['Surface'])
    mat.use_backface_culling = True
    mat.diffuse_color = (0.045, 0.03, 0.025, 1)
    return mat


def add_outline(obj, thickness=OUTLINE_THICKNESS):
    """Ink outline as in the concept art: an inverted hull (Solidify, flipped normals). Preview only: the glTF
    export leaves modifiers off, so the game gets the plain mesh."""
    if obj.type != 'MESH' or not obj.data.polygons:
        return
    obj.data.materials.append(outline_material())
    mod = obj.modifiers.new('Outline', 'SOLIDIFY')
    mod.thickness = thickness
    mod.offset = 1.0
    mod.use_flip_normals = True
    mod.use_rim = False
    mod.material_offset = len(obj.data.materials) - 1
