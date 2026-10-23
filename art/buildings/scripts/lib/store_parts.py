# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The parts of the department stores (buildings/stores.py, PLAN.md "Department stores"): made-up store names in
real Thai lettering (Sarabun Bold from assets/fonts, OFL, turned into flat meshes), the sign boards they sit on, and
what stands in a store's forecourt: bicycles, a samlor, motorbikes, cars and a lorry, by era.

The names are made up for the game (no brand, no logo): a store is ห้าง plus a name of its region (ไผ่ ... for the
city of bamboo), the era's word for it around that. The lettering goes into b.signs, which the export never thins and
the preview never outlines, so it stays readable; it faces one way (the side it is drawn on).
"""

import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import kit, palette
from .mesh import R, T

GAME = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
FONT = os.path.join(GAME, 'assets', 'fonts', 'Sarabun-Bold.ttf')

# The stores' own colours (prefix st_): lit sign boxes and lettering, which the game lights at night (names ending
# _lit go to the export's `windows` mesh).
for _k, _v in {
    'st_box_lit': '#FBF7EC', 'st_letter_lit': '#FFF4D8', 'st_red_lit': '#D83A2E', 'st_green_lit': '#8EE05A',
    'st_sign_dark': '#2C3138', 'st_car_red': '#B8453A', 'st_car_white': '#ECEBE6', 'st_car_blue': '#3F69A8',
    'st_car_silver': '#B9BEC4', 'st_car_yellow': '#E0B03C', 'st_tyre': '#26262A',
}.items():
    palette.COLORS.setdefault(_k, _v)
palette.EMISSIVE.setdefault('st_box_lit', 0.45)
palette.EMISSIVE.setdefault('st_letter_lit', 0.9)
palette.EMISSIVE.setdefault('st_red_lit', 0.7)
palette.EMISSIVE.setdefault('st_green_lit', 0.9)

# A made-up name for each region's store (no real shop): ไผ่ for the city of bamboo and a word of the region.
NAMES = {
    'north': 'ไผ่คำ',          # คำ: gold, in the northern speech
    'northeast': 'ไผ่ทอง',
    'central': 'ไผ่งาม',
    'east': 'ไผ่บูรพา',        # บูรพา: the east
    'west': 'ไผ่ตะวัน',
    'south': 'ไผ่สมุทร',       # สมุทร: the sea
}
CAR_COLOURS = ('st_car_white', 'st_car_red', 'st_car_silver', 'st_car_blue', 'st_car_white', 'st_car_yellow',
               'st_car_silver')
FACING = {'front': 0.0, 'right': 90.0, 'back': 180.0, 'left': -90.0}


def name(region):
    return NAMES[region]


# lettering -------------------------------------------------------------------------------------------------------------

def _font():
    font = bpy.data.fonts.get('store_sarabun')
    if font is None:
        font = bpy.data.fonts.load(FONT, check_existing=True)
        font.name = 'store_sarabun'
    return font


def _text_bm(text, res=2):
    """The text as a flat bmesh in X (reading) and Y (up), filled, at size 1."""
    cu = bpy.data.curves.new('store_text', 'FONT')
    cu.body = text
    cu.font = _font()
    cu.align_x = 'CENTER'
    cu.resolution_u = res
    cu.size = 1.0
    ob = bpy.data.objects.new('store_text', cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    bm = bmesh.new()
    bm.from_mesh(me)
    ev.to_mesh_clear()
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    return bm


def lettering(part, text, centre, side='front', height=1.0, width=None, mat='sign_text', vertical=False, res=2):
    """Thai lettering centred on `centre` (x, y, z), standing upright and facing `side` (out of a wall face that
    way): `height` is the ink's height (marks above and below included), shrunk to fit `width` if given (along the
    reading direction). vertical: turned a quarter to read downward, the letters' tops to the right (as a book's
    spine, the way tall shop signs run)."""
    bm = _text_bm(text, res)
    if not bm.verts:
        bm.free()
        return part
    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    s = height / max(h, 1e-3)
    if width and w * s > width:
        s = width / w
    m = Matrix.Scale(s, 4) @ T(-(max(xs) + min(xs)) / 2, -(max(ys) + min(ys)) / 2, 0)
    if vertical:
        m = R(0, 0, -90) @ m
    m = T(*centre) @ R(0, 0, FACING[side]) @ R(90, 0, 0) @ m
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    want = R(0, 0, FACING[side]).to_3x3() @ Vector((0, -1, 0))
    bm.normal_update()
    flip = [f for f in bm.faces if f.normal.dot(want) < 0]
    if flip:
        bmesh.ops.reverse_faces(bm, faces=flip)
    return part.merge(bm, mat)


def board(b, rect, side, u, z, w, h, lines, mat='sign_cream', frame='teak_dark', out=0.05, depth=0.12):
    """A sign board on a wall face with lines of lettering: lines is [(text, height share, colour), ...] top to
    bottom; the board and its frame go into b.signs with the lettering."""
    p = b.signs
    kit.on_face(p, rect, side, u, z - 0.08, w + 0.16, h + 0.16, depth * 0.6, frame, out=out)
    kit.on_face(p, rect, side, u, z, w, h, depth, mat, out=out)
    o, along, n = kit.face_frame(rect, side)
    total = sum(sh for _, sh, _ in lines)
    pad = h * 0.08
    zz = z + h - pad
    for text, share, colour in lines:
        lh = (h - 2 * pad) * share / total
        c = o + along * u + n * (out + depth + 0.015)
        c.z = zz - lh / 2
        lettering(p, text, c, side, lh * 0.84, w * 0.9, colour)
        zz -= lh
    return b


def plate_text(b, rect, side, u, z, text, height, width=None, mat='st_letter_lit', out=0.05):
    """Lettering alone, standing just out of a wall face (letters fixed to a facade or a canopy fascia)."""
    o, along, n = kit.face_frame(rect, side)
    c = o + along * u + n * out
    c.z = z
    return lettering(b.signs, text, c, side, height, width, mat)


# vehicles and the forecourt ----------------------------------------------------------------------------------------------

def _wheel(p, m, x, y, r, w, mat='st_tyre', seg=8):
    p.cyl(r, r, w, mat, m @ T(x, y, r) @ R(90, 0, 0), seg=seg, smooth=False)


def bicycle(p, x, y, facing=0.0, mat='paint_blue', basket=False):
    """A roadster bicycle, 1.7 m long, standing on its kickstand (facing = the way it points, degrees from +X)."""
    m = T(x, y, 0) @ R(0, 0, facing)
    for s in (-0.55, 0.55):
        p.torus(0.33, 0.022, 'black', m @ T(s, 0, 0.35) @ R(90, 0, 0), seg=10, seg_minor=3, smooth=False)
    pts = [(-0.55, 0, 0.35), (-0.05, 0, 0.38), (-0.17, 0, 0.88), (0.42, 0, 0.86), (0.55, 0, 0.35)]
    V = Vector
    for a, c in ((0, 1), (1, 2), (2, 3), (3, 4), (1, 3), (0, 2)):
        p.rod(m @ V(pts[a]), m @ V(pts[c]), 0.018, mat, seg=4, smooth=False)
    p.box((0.24, 0.1, 0.05), 'black', m @ T(-0.2, 0, 0.93))
    p.rod(m @ V((0.42, -0.25, 1.02)), m @ V((0.42, 0.25, 1.02)), 0.016, 'steel', seg=4, smooth=False)
    p.rod(m @ V((0.42, 0, 0.86)), m @ V((0.42, 0, 1.02)), 0.018, 'steel', seg=4, smooth=False)
    if basket:
        p.box((0.32, 0.36, 0.22), 'straw', m @ T(0.62, 0, 0.92))
    return p


def samlor(p, x, y, facing=0.0, hood='awning_red'):
    """A pedal rickshaw (สามล้อ): the rider's bicycle front, the passengers' bench behind on two wheels under a
    folding canvas hood."""
    m = T(x, y, 0) @ R(0, 0, facing)
    V = Vector
    p.torus(0.33, 0.022, 'black', m @ T(0.9, 0, 0.35) @ R(90, 0, 0), seg=10, seg_minor=3, smooth=False)
    for s in (-0.55, 0.55):
        p.torus(0.33, 0.022, 'black', m @ T(-0.6, s, 0.35) @ R(90, 0, 0), seg=10, seg_minor=3, smooth=False)
    p.rod(m @ V((-0.6, -0.55, 0.35)), m @ V((-0.6, 0.55, 0.35)), 0.025, 'iron', seg=4, smooth=False)
    for a, c in (((0.9, 0, 0.35), (0.6, 0, 0.95)), ((0.6, 0, 0.95), (0.1, 0, 0.9)), ((0.1, 0, 0.9), (-0.2, 0, 0.45)),
                 ((0.6, 0, 0.95), (-0.2, 0, 0.45)), ((-0.2, 0, 0.45), (-0.6, 0, 0.35))):
        p.rod(m @ V(a), m @ V(c), 0.02, 'paint_red', seg=4, smooth=False)
    p.box((0.22, 0.1, 0.05), 'black', m @ T(0.1, 0, 0.95))
    p.rod(m @ V((0.62, -0.25, 1.08)), m @ V((0.62, 0.25, 1.08)), 0.016, 'steel', seg=4, smooth=False)
    p.box((0.7, 1.15, 0.12), 'teak', m @ T(-0.75, 0, 0.62))
    p.box((0.62, 1.05, 0.12), 'awning_red', m @ T(-0.75, 0, 0.72))
    p.box((0.1, 1.15, 0.6), 'teak', m @ T(-1.08, 0, 0.95))
    for s in (-1, 1):
        p.box((0.75, 0.04, 0.25), 'teak', m @ T(-0.75, s * 0.57, 0.8))
    for k in range(3):
        a = math.radians(15 + k * 35)
        p.box((0.06, 1.2, 0.5), hood, m @ T(-0.75 - 0.42 * math.cos(a), 0, 1.15 + 0.42 * math.sin(a)) @ R(0, -90 + 15 + k * 35, 0))
    return p


def motorbike(p, x, y, facing=0.0, mat='paint_red'):
    """A small step-through motorbike (1.8 m), parked on its stand."""
    m = T(x, y, 0) @ R(0, 0, facing)
    for s in (-0.62, 0.62):
        _wheel(p, m, s, 0, 0.28, 0.1, seg=10)
    p.box((0.9, 0.3, 0.3), mat, m @ T(-0.25, 0, 0.55), bevel=0.04)
    p.box((0.6, 0.26, 0.1), 'black', m @ T(-0.25, 0, 0.75))
    p.box((0.25, 0.28, 0.7), mat, m @ T(0.42, 0, 0.62) @ R(0, -18, 0))
    p.rod(m @ Vector((0.55, -0.32, 1.08)), m @ Vector((0.55, 0.32, 1.08)), 0.02, 'steel', seg=4, smooth=False)
    p.box((0.08, 0.16, 0.12), 'lamp', m @ T(0.62, 0, 1.02))
    return p


def car(p, x, y, facing=0.0, mat='st_car_white', era=3):
    """A parked car, 4.3 x 1.7 m (facing = the way its nose points): a boxy saloon in era 3, a rounder hatchback in
    era 4, a small electric pod in era 5."""
    m = T(x, y, 0) @ R(0, 0, facing)
    if era >= 5:
        L, W = 2.8, 1.5
        p.box((L, W, 0.75), mat, m @ T(0, 0, 0.6), bevel=0.25)
        p.box((L * 0.72, W * 0.92, 0.6), 'glass_dark', m @ T(-0.05, 0, 1.2), bevel=0.2)
        for sx in (-0.95, 0.95):
            for sy in (-0.62, 0.62):
                _wheel(p, m, sx, sy, 0.28, 0.2, seg=8)
        p.box((0.04, W * 0.8, 0.08), 'st_green_lit', m @ T(L / 2 + 0.01, 0, 0.75))
        return p
    L, W = (4.3, 1.68) if era == 3 else (4.1, 1.75)
    p.box((L, W, 0.62), mat, m @ T(0, 0, 0.62), bevel=0.06 if era == 3 else 0.14)
    cab = (2.2, W - 0.12, 0.55) if era == 3 else (2.4, W - 0.1, 0.58)
    cx = -0.15 if era == 3 else -0.25
    p.box(cab, 'glass_dark', m @ T(cx, 0, 1.2), bevel=0.04 if era == 3 else 0.12)
    p.box((cab[0] - 0.1, cab[1] + 0.02, 0.07), mat, m @ T(cx, 0, 1.48))
    for sx in (-L * 0.32, L * 0.32):
        for sy in (-W / 2 + 0.12, W / 2 - 0.12):
            _wheel(p, m, sx, sy, 0.31, 0.24)
    for sy in (-W / 2 + 0.25, W / 2 - 0.25):
        p.box((0.04, 0.3, 0.12), 'lamp', m @ T(L / 2 + 0.01, sy, 0.72))
        p.box((0.04, 0.3, 0.1), 'red_light', m @ T(-L / 2 - 0.01, sy, 0.75))
    return p


def lorry(p, x, y, facing=0.0, mat='paint_blue', box='paint_white', era=3):
    """A six-wheel delivery lorry, 7 m long, its box toward the loading dock (the cab at +X before turning)."""
    m = T(x, y, 0) @ R(0, 0, facing)
    p.box((1.8, 2.2, 2.1), mat, m @ T(2.6, 0, 1.55), bevel=0.06)
    p.box((0.05, 1.9, 0.8), 'glass_dark', m @ T(3.51, 0, 1.95))
    p.box((5.0, 2.3, 2.5), box, m @ T(-0.9, 0, 2.0), bevel=0.03)
    p.box((5.6, 1.0, 0.25), 'iron', m @ T(0.0, 0, 0.62))
    for sx in (2.6, -1.4, -2.6):
        for sy in (-0.95, 0.95):
            _wheel(p, m, sx, sy, 0.48, 0.32, seg=10)
    return p


def bike_rack(p, x0, x1, y, n=None, facing=90.0, mats=('paint_blue', 'paint_red', 'teak_dark', 'paint_green')):
    """A row of bicycles along x, each pointing `facing`, in a steel rack."""
    n = n or max(2, int((x1 - x0) / 0.7))
    p.rod((x0, y + 0.25, 0.45), (x1, y + 0.25, 0.45), 0.025, 'steel', seg=4, smooth=False)
    for i in range(n):
        x = x0 + (x1 - x0) * (i + 0.5) / n
        bicycle(p, x, y, facing, mats[i % len(mats)], basket=i % 3 == 1)
    return p
