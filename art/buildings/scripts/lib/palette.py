# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The flat colours of the buildings, picked from the era concept sheets (assets/concept/era*_*.jpg).

Every material is a Principled BSDF with only a base colour, named pb_<colour>, so the glTF export carries the colour
and the game can map it to its own materials (glass to glass, window_lit to the night windows). Change a colour here
and rebuild to change it on every building. Era files may only use names from this table.
"""

import bpy

COLORS = {
    # wood
    'teak': '#8B4E2B', 'teak_dark': '#5E321C', 'teak_light': '#B07345', 'plank': '#9A5A33', 'plank_grey': '#8A7A68',
    'bamboo': '#C9A55E', 'bamboo_dark': '#9C7B3E', 'timber': '#C08A55',
    # roofs
    'thatch': '#D9B064', 'thatch_dark': '#A67C3E', 'thatch_light': '#E8C77E',
    'clay_tile': '#C1593A', 'clay_tile_dark': '#8E3B28', 'clay_tile_light': '#D9784F',
    'cement_tile': '#8E8A84', 'zinc': '#A9AEB2', 'zinc_dark': '#7D8388', 'rust': '#9C5A3A',
    'roof_green': '#4F7A62', 'roof_blue': '#4F6E96',
    # walls
    'plaster': '#EFE3C8', 'plaster_white': '#F3EEE2', 'plaster_peach': '#E9C9A6', 'plaster_mint': '#BFD8C2',
    'plaster_sky': '#BCD2E2', 'plaster_yellow': '#EBD58E', 'plaster_pink': '#E6B8B0',
    'concrete': '#B9B4AC', 'concrete_dark': '#8C8780', 'concrete_light': '#D6D1C8',
    'brick': '#B5573B', 'brick_dark': '#8A3F2B', 'stone': '#A39A8C',
    # openings
    'glass': '#8FB8C9', 'glass_dark': '#4F6E80', 'glass_green': '#86B9A8', 'window_dark': '#3A3330',
    'window_lit': '#FFD98A', 'shutter_green': '#5F7D5B', 'shutter_blue': '#5A7398', 'roller': '#A3A7AB',
    'door_red': '#9E3B30',
    # metal and services
    'steel': '#C9CDD2', 'metal': '#9EA4AB', 'iron': '#3C3C40', 'paint_red': '#B8453A', 'paint_blue': '#3D5D9A',
    'paint_green': '#4F8A5A', 'paint_yellow': '#E0B03C', 'paint_orange': '#E07B2A', 'paint_white': '#F6F4EE',
    'solar': '#2F3E66', 'solar_frame': '#C9CDD2', 'tank_blue': '#3E6FA8', 'stainless': '#D7DADD',
    'cable': '#2A2A2E',
    # cloth and signs
    'awning_red': '#C8463A', 'awning_white': '#F2E9D8', 'awning_blue': '#4A78B0', 'awning_green': '#5C9A5A',
    'awning_yellow': '#E8B63E', 'canvas': '#E6DAC0', 'sign_cream': '#F4ECD8', 'sign_red': '#C0453A',
    'sign_blue': '#3F69A8', 'sign_green': '#3F8A5A', 'sign_text': '#3A2E28', 'flag_red': '#C0392B',
    'flag_white': '#F6F4EE', 'flag_blue': '#2C3E8C',
    # ground
    'grass': '#7DAA45', 'grass_dark': '#5E8A35', 'dirt': '#C8915A', 'dirt_dark': '#A87442', 'laterite': '#B8693E',
    'paving': '#C9BFAE', 'paving_dark': '#A99E8C', 'asphalt': '#55555A', 'gravel': '#A8A196', 'water': '#7FB0B8',
    'mud_field': '#8C9A4A', 'rice_young': '#8CCB4A', 'sand': '#E3CC93', 'stone_pale': '#D8D2C4',
    # plants
    'leaf': '#5F9A3A', 'leaf_dark': '#3F7A30', 'leaf_light': '#8CC24E', 'leaf_yellow': '#B8C24A',
    'trunk': '#7A5A3A', 'palm_trunk': '#8A6A48', 'flower_red': '#D8463A', 'flower_pink': '#E58FB0',
    'flower_yellow': '#F0C840', 'banana_fruit': '#9CBF3A',
    # pots, jars, things
    'clay_pot': '#B8653A', 'jar': '#8E4A2E', 'jar_glaze': '#5E3A2A', 'straw': '#D9B477', 'rope': '#B08A5A',
    'gold': '#D6A93A', 'spirit_red': '#A8383A', 'cream': '#F1E8D2', 'white': '#F6F4EE', 'black': '#26262A',
    'grey': '#8E8E92', 'buffalo': '#4A4A50', 'smoke': '#E4E0DA', 'lamp': '#FFD45A', 'red_light': '#D63A2A',
    'robot_white': '#EDEAE2', 'screen': '#2E3A48', 'screen_lit': '#7FD8E8', 'hay': '#D9C26A',
    'durian': '#A7A83A', 'rambutan': '#D2402E', 'lotus': '#E79AB4', 'orchid': '#B57BC8', 'latex': '#F2EEDC',
    'umbrella_red': '#C8463A', 'umbrella_blue': '#4A6FB0', 'umbrella_yellow': '#E8B63E', 'silk': '#6A5AA8',
    'fretwork': '#E9D9B8',
    # temples (buildings/temples.py, lib/temple_parts.py): glazed roof tiles, gold leaf, whitewash, lacquer, murals
    'temple_orange': '#E2782E', 'temple_orange_dark': '#B65A22', 'temple_green': '#3E8A58', 'temple_blue': '#3D5F9C',
    'temple_red_roof': '#8C3426', 'temple_brown': '#4E2A20', 'temple_brown_light': '#6E3C2A', 'shingle': '#9C7B57',
    'shingle_dark': '#76593D', 'gold_leaf': '#E8B83E', 'gold_dark': '#B78A2A', 'whitewash': '#F8F5EC',
    'whitewash_shade': '#E6E0D2', 'lacquer_red': '#A2302A', 'lacquer_black': '#2B2326', 'sema_stone': '#BDB5A4',
    'mural_ochre': '#D69A3C', 'mural_blue': '#4A70A2', 'mural_green': '#5F8B55', 'mural_red': '#B4473A',
    'granite': '#BAB6AF', 'granite_dark': '#8F8B85', 'sandstone': '#C8A57A', 'bell_bronze': '#7A5A2E',
}

OUTLINE = 'pb_outline'
OUTLINE_THICKNESS = 0.035
# Lit at night in the game, glowing in the previews.
EMISSIVE = {'lamp': 2.0, 'red_light': 2.0, 'window_lit': 0.6, 'screen_lit': 1.2}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(name):
    h = COLORS[name].lstrip('#')
    return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))


def material(name):
    """The pb_<name> material, made once per file."""
    if name not in COLORS:
        raise KeyError('No colour %r in palette.COLORS' % name)
    full = 'pb_' + name
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
    if name in EMISSIVE:
        bsdf.inputs['Emission Color'].default_value = color
        bsdf.inputs['Emission Strength'].default_value = EMISSIVE[name]
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
