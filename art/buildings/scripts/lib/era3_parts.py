# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Parts of the factory town (era 3, assets/concept/era3_*.jpg), in true metres: concrete shophouses (ตึกแถว) with a
Thai gable or a Sino-Portuguese parapet on the front, grille windows with sunshades, roller shutters and folding steel
gates, AC units with their trunking, rooftop tanks and aerials, concrete houses with car porches, walk-up flats with
open galleries, warehouse sheds with ribbed walls and roofs, concrete power poles with tangled wires and transformers,
a convenience store front (a blank light box and a rainbow awning, no brand), vending machines, plastic chairs, bins
and the concrete drainage canal.

Everything draws into the Parts of a lib.builder.Build (b.main, b.props, b.yard) and is dressed by b.region.
"""

import math

from mathutils import Vector

from . import kit, palette, props, regions
from .mesh import R, S, T

for _name, _hex in (
        ('e3_band', '#B4683E'), ('e3_skirt', '#A9583A'), ('e3_duct', '#7B4B2E'), ('e3_purple', '#7E5BAA'),
        ('e3_store_glass', '#D3ECF1'), ('e3_lightbox', '#F7F7F2'), ('e3_gable', '#C88A4E'),
        ('e3_tile', '#E4E8E6'), ('e3_liner', '#2F3A30'), ('e3_lignite', '#2B2724'), ('e3_sign_white', '#F2F2EE'),
        ('e3_hose', '#C0453A'), ('e3_rail', '#5A5652')):
    palette.COLORS.setdefault(_name, _hex)
palette.EMISSIVE.setdefault('e3_store_glass', 0.35)
palette.EMISSIVE.setdefault('e3_lightbox', 0.6)

RAINBOW = ('awning_red', 'paint_orange', 'awning_yellow', 'awning_green', 'awning_blue', 'e3_purple')
GOODS = ('paint_red', 'paint_yellow', 'paint_blue', 'cream', 'paint_green', 'paint_orange', 'paint_white')
FACING = {'front': 0.0, 'back': 180.0, 'left': -90.0, 'right': 90.0}


# the region's dress for concrete ------------------------------------------------------------------------------------------

def band_mat(region):
    """The floor bands and cornices (the concept's terracotta lines): teak in the north, white on the south's pastel."""
    return {'north': 'teak', 'south': 'paint_white'}.get(region, 'e3_band')


def roof_mat(region, i=0):
    table = {'central': ('clay_tile', 'clay_tile_light'), 'north': ('clay_tile_dark', 'cement_tile'),
             'northeast': ('cement_tile', 'zinc'), 'east': ('clay_tile', 'roof_green'),
             'west': ('clay_tile_light', 'roof_green'), 'south': ('roof_blue', 'clay_tile')}
    t = table[region]
    return t[i % len(t)]


def course_of(mat):
    return {'clay_tile': 'clay_tile_dark', 'clay_tile_light': 'clay_tile', 'clay_tile_dark': 'teak_dark',
            'cement_tile': 'concrete_dark', 'zinc': 'zinc_dark', 'roof_green': 'leaf_dark',
            'roof_blue': 'paint_blue'}.get(mat, mat)


def gable_fill(region):
    """What fills a shophouse's front gable: orange timber framing (central, east, west, as the concept), teak boards
    (north), plain plaster (northeast)."""
    return {'central': 'e3_gable', 'east': 'e3_gable', 'west': 'e3_gable', 'north': 'teak'}.get(region)


def at_face(rect, side, u, out=0.0, z=0.0):
    o, along, n = kit.face_frame(rect, side)
    c = o + along * u + n * out
    c.z = z
    return c


# openings -------------------------------------------------------------------------------------------------------------------

def grille_window(p, rect, side, u, z0, w=1.2, h=1.3, frame='teak_dark', hood='concrete_light', grille='iron',
                  glass='glass_dark'):
    """A window with a steel grille (เหล็กดัด) in front and a concrete sunshade over it."""
    kit.window(p, rect, side, u, z0, w, h, frame=frame, glass=glass, mullion=True)
    if grille:
        for k in (1, 2):
            kit.on_face(p, rect, side, u - w / 2 + w * k / 3, z0, 0.03, h, 0.12, grille)
        kit.on_face(p, rect, side, u, z0 + h * 0.5, w, 0.03, 0.12, grille)
    if hood:
        kit.on_face(p, rect, side, u, z0 + h + 0.14, w + 0.45, 0.08, 0.42, hood)
    return p


def arch(p, rect, side, u, z, w, mat, depth=0.08, tube=0.06, fill=None):
    """A half-round arch head standing on a face at height z (Sino-Portuguese windows and arcades); fill fills it."""
    o, along, n = kit.face_frame(rect, side)
    c = o + along * u + n * (depth / 2)
    c.z = z
    rot = R(90, 0, 0) if side in ('front', 'back') else R(90, 0, 90)
    p.torus(w / 2, tube, mat, T(*c) @ rot, seg=12, seg_minor=4, arc=180)
    if fill:
        disc = R(90, 0, 0) if side in ('front', 'back') else R(0, 90, 0)
        p.cyl(w / 2 - tube, w / 2 - tube, depth * 0.8, fill, T(*c) @ disc, seg=12)
    return p


def shop_interior(p, rect, side, u, z0, w, h, goods=True):
    """A dark shop opening with shelves of goods."""
    kit.on_face(p, rect, side, u, z0, w, h, 0.02, 'window_dark')
    if goods:
        n = max(3, int(w / 0.36))
        for k, zz in enumerate((0.9, 1.55, 2.2)):
            if zz + 0.4 > h:
                break
            kit.on_face(p, rect, side, u, z0 + zz, w - 0.3, 0.05, 0.035, 'plank')
            for i in range(n):
                if (i + k) % 4 == 3:
                    continue
                uu = u - (w - 0.4) / 2 + (w - 0.4) * (i + 0.5) / n
                kit.on_face(p, rect, side, uu, z0 + zz + 0.05, 0.24, 0.3, 0.03, GOODS[(i * 3 + k) % len(GOODS)])
    return p


def steel_gate(p, rect, side, u, z0, w, h, open_=0.5, mat='iron'):
    """A folding steel shop gate (ประตูเหล็กยืด): bars on a top track, the rest folded at one side."""
    kit.on_face(p, rect, side, u, z0 + h - 0.08, w, 0.08, 0.12, mat)
    shut = w * (1 - open_)
    if shut > 0.2:
        a = u - w / 2
        n = int(shut / 0.16)
        for i in range(n + 1):
            kit.on_face(p, rect, side, a + shut * i / max(n, 1), z0, 0.035, h - 0.1, 0.1, mat)
        for zz in (0.1, h * 0.5, h - 0.35):
            kit.on_face(p, rect, side, a + shut / 2, z0 + zz, shut, 0.04, 0.1, mat)
    kit.on_face(p, rect, side, u + w / 2 - 0.15, z0, 0.3, h - 0.1, 0.14, mat)
    return p


def store_front(p, q, rect, side, u, z0, w, h=3.0, awning=True):
    """A convenience store (ร้านสะดวกซื้อ) front: glass with lit shelves behind it, a blank light box (no brand, no
    lettering) and a rainbow-striped awning."""
    kit.shopfront(p, rect, side, u, z0, w, h, frame='steel', glass='e3_store_glass', door_w=1.6)
    sw = w / 2 - 1.1
    if sw > 0.4:
        for s in (-1, 1):
            cu = u + s * (0.8 + sw / 2 + 0.1)
            m = max(1, int(sw / 0.3))
            for k, zz in enumerate((0.55, 1.15, 1.75)):
                kit.on_face(p, rect, side, cu, z0 + zz - 0.04, sw, 0.04, 0.074, 'steel')
                for i in range(m):
                    uu = cu - sw / 2 + sw * (i + 0.5) / m
                    kit.on_face(p, rect, side, uu, z0 + zz, sw / m - 0.06, 0.3, 0.074, GOODS[(i + k * 2) % len(GOODS)])
    kit.on_face(p, rect, side, u, z0 + h + 0.15, w, 0.7, 0.22, 'e3_lightbox')
    for zz in (z0 + h + 0.1, z0 + h + 0.85):
        kit.on_face(p, rect, side, u, zz, w + 0.1, 0.06, 0.26, 'steel')
    if awning:
        props.awning(q, rect, side, u, z0 + h + 0.12, w, depth=0.9, drop=0.35, stripes=RAINBOW)
    return p


def flat_roof(p, rect, z, mat='concrete', parapet=0.9, parapet_mat=None, coping=None, thick=0.25):
    """A flat roof with a parapet (kit.flat_roof) and a coping ring along the parapet's top (not a lid)."""
    zt = kit.flat_roof(p, rect, z, mat, parapet=parapet, parapet_mat=parapet_mat, thick=thick)
    if coping and parapet > 0:
        x0, y0, x1, y1 = rect
        d, t = 0.05, 0.15
        kit.block(p, x0 - d, y0 - d, zt, x1 + d, y0 + t + d, zt + 0.08, coping)
        kit.block(p, x0 - d, y1 - t - d, zt, x1 + d, y1 + d, zt + 0.08, coping)
        kit.block(p, x0 - d, y0 - d, zt, x0 + t + d, y1 + d, zt + 0.08, coping)
        kit.block(p, x1 - t - d, y0 - d, zt, x1 + d, y1 + d, zt + 0.08, coping)
    return zt


# services on walls and roofs ------------------------------------------------------------------------------------------------

def ac_on(q, rect, side, u, z, duct=True):
    """An AC outdoor unit on its bracket against a face, its brown trunking running up the wall."""
    c = at_face(rect, side, u, 0.2)
    props.ac_unit(q, c.x, c.y, z, FACING[side])
    if duct:
        kit.on_face(q, rect, side, u + 0.62, z + 0.3, 0.1, 1.3, 0.08, 'e3_duct')
        kit.on_face(q, rect, side, u + 0.45, z + 0.32, 0.4, 0.1, 0.08, 'e3_duct')
    return q


def antenna(q, x, y, z, h=3.0):
    """A TV aerial on the roof."""
    q.rod((x, y, z), (x, y, z + h), 0.025, 'steel', seg=4)
    for k, ln in enumerate((1.4, 1.1, 0.8)):
        zz = z + h - 0.15 - k * 0.35
        q.rod((x - ln / 2, y, zz), (x + ln / 2, y, zz), 0.012, 'steel', seg=4)
    q.rod((x, y, z + h * 0.7), (x + 1.2, y + 0.6, z), 0.006, 'cable', seg=3)
    return q


def laundry(q, a, b, z, cloths=('paint_white', 'paint_blue', 'flower_pink', 'paint_yellow', 'cream')):
    """Washing on a line between two points at height z."""
    a, b = Vector((a[0], a[1], z)), Vector((b[0], b[1], z))
    props.wires(q, a, b, sag=0.12, mat='rope', r=0.01, n=4)
    d = b - a
    n = max(2, int(d.length / 0.6))
    ang = math.degrees(math.atan2(d.y, d.x))
    for i in range(1, n):
        if i % 3 == 0:
            continue
        c = a.lerp(b, i / n)
        sag = 0.12 * 4 * (i / n) * (1 - i / n)
        hh = 0.45 + (i % 2) * 0.25
        q.box((0.42, 0.02, hh), cloths[i % len(cloths)], T(c.x, c.y, c.z - sag - hh / 2) @ R(0, 0, ang))
    return q


def stair_head(p, x0, y0, x1, y1, z, wall, h=2.5, roof=None, region=None):
    """The small room over a stair on a flat roof, with its door to the front and a slab (or the region's) roof."""
    kit.block(p, x0, y0, z, x1, y1, z + h, wall)
    kit.door(p, (x0, y0, x1, y1), 'front', 0, z, 0.9, 2.1, leaf='paint_blue' if region == 'south' else 'teak',
             frame='concrete_dark', panels=True)
    if roof and region:
        regions.small_roof(p, (x0, y0, x1, y1), z + h, region, mat=roof, axis='x', over=0.35)
    else:
        kit.block(p, x0 - 0.25, y0 - 0.35, z + h, x1 + 0.25, y1 + 0.25, z + h + 0.15, 'concrete_light')
    return p


def roof_things(b, rect, z, tanks=1, kind='stainless', aerial=True, seed=0, ac=0):
    """What stands on a flat roof: water tanks on stands toward the back, an aerial, a few AC units."""
    x0, y0, x1, y1 = rect
    q = b.props
    for k in range(tanks):
        x = x1 - 0.9 - k * 1.3
        if x < x0 + 0.6:
            break
        props.water_tank(q, x, y1 - 1.0, z, kind if (k + seed) % 3 else ('plastic' if kind == 'stainless'
                                                                          else 'stainless'), stand=0.9)
    if aerial:
        antenna(q, x0 + 0.8, y1 - 1.2, z, 3.2)
    for k in range(ac):
        props.ac_unit(q, x0 + 1.0 + k * 1.1, (y0 + y1) / 2 + 1.0, z + 0.35, 0)
    return q


# power ------------------------------------------------------------------------------------------------------------------------

def pole(q, x, y, h=9.0, transformer=False, lamp=False, facing=0.0):
    """A concrete power pole (เสาไฟฟ้า) with cross arms; a transformer on a platform; a street lamp arm."""
    props.power_pole(q, x, y, h, 'concrete', arms=2)
    q.box((0.06, 0.4, 0.06), 'iron', T(x, y, h - 2.2))
    q.torus(0.35, 0.04, 'cable', T(x + 0.2, y, h - 2.6) @ R(0, 90, 0), seg=10, seg_minor=4)
    q.box((0.3, 0.16, 0.42), 'paint_white', T(x, y - 0.18, 2.2))
    if transformer:
        zt = h - 3.4
        q.box((1.5, 0.6, 0.08), 'iron', T(x, y - 0.35, zt))
        for s in (-1, 1):
            q.rod((x + s * 0.7, y - 0.1, zt), (x + s * 0.3, y, zt - 0.8), 0.03, 'iron', seg=4)
        for s in (-1, 1):
            cx = x + s * 0.38
            q.cyl(0.3, 0.3, 1.0, 'grey', T(cx, y - 0.42, zt + 0.55), seg=10)
            q.cyl(0.32, 0.32, 0.06, 'grey', T(cx, y - 0.42, zt + 1.08), seg=10)
            for k in range(-2, 3):
                q.box((0.04, 0.12, 0.8), 'concrete_dark', T(cx + k * 0.1, y - 0.75, zt + 0.55))
            for k in (-1, 1):
                q.cyl(0.04, 0.05, 0.25, 'paint_white', T(cx + k * 0.12, y - 0.42, zt + 1.25), seg=6)
                q.rod((cx + k * 0.12, y - 0.42, zt + 1.35), (cx + k * 0.3, y, h - 0.35), 0.012, 'cable', seg=3)
    if lamp:
        m = T(x, y, 0) @ R(0, 0, facing)
        q.rod(m @ Vector((0, 0, h - 2.0)), m @ Vector((0, -1.6, h - 1.6)), 0.04, 'steel', seg=5)
        q.box((0.5, 0.25, 0.1), 'steel', m @ T(0, -1.7, h - 1.6))
        q.box((0.4, 0.2, 0.03), 'lamp', m @ T(0, -1.7, h - 1.66))
    return q


def tangle(q, a, b, n=4, sag=0.5):
    """A bundle of sagging cables between two poles (the tangled wires of a Thai street)."""
    a, b = Vector(a), Vector(b)
    for k in range(n):
        off = Vector(((k % 2) * 0.25 - 0.12, (k % 3) * 0.12 - 0.12, -k * 0.22))
        props.wires(q, a + off, b + off * 0.8, sag=sag * (1 + 0.25 * k), mat='cable', r=0.015, n=6)
    return q


def service_drop(q, pole_top, wall_pt, n=2):
    a = Vector(pole_top)
    b = Vector(wall_pt)
    for k in range(n):
        props.wires(q, a + Vector((0, 0, -k * 0.3)), b + Vector((k * 0.15, 0, 0)), sag=0.4, mat='cable', r=0.012,
                    n=5)
    return q


# street things ----------------------------------------------------------------------------------------------------------------

def vending(q, x, y, facing=0.0, mat='paint_red'):
    """A drinks vending machine (no brand): a coloured cabinet, a lit window of bottles, a coin panel and a slot."""
    m = T(x, y, 0) @ R(0, 0, facing)
    q.box((1.0, 0.75, 1.85), mat, m @ T(0, 0, 0.925), bevel=0.02)
    q.box((0.62, 0.05, 1.0), 'e3_store_glass', m @ T(-0.12, -0.38, 1.25))
    for k in range(4):
        q.box((0.56, 0.06, 0.12), GOODS[(k * 2 + int(abs(x) * 3)) % len(GOODS)], m @ T(-0.12, -0.39, 0.9 + k * 0.24))
    q.box((0.2, 0.05, 0.5), 'grey', m @ T(0.33, -0.38, 1.25))
    q.box((0.6, 0.06, 0.18), 'black', m @ T(-0.1, -0.38, 0.35))
    q.box((1.04, 0.8, 0.06), 'iron', m @ T(0, 0, 1.88))
    return q


def chair(q, x, y, facing=0.0, mat='paint_red'):
    """A plastic stool-chair (เก้าอี้พลาสติก)."""
    m = T(x, y, 0) @ R(0, 0, facing)
    q.box((0.45, 0.45, 0.04), mat, m @ T(0, 0, 0.45))
    q.box((0.45, 0.04, 0.4), mat, m @ T(0, 0.22, 0.68) @ R(-8, 0, 0))
    for sx in (-1, 1):
        for sy in (-1, 1):
            q.rod(m @ Vector((sx * 0.19, sy * 0.19, 0.44)), m @ Vector((sx * 0.22, sy * 0.22, 0)), 0.02, mat, seg=4)
    return q


def table_set(q, x, y, chairs=4, mat='paint_white', chair_mat='paint_red', umbrella=False):
    """A round plastic table with stools round it (a street restaurant's)."""
    q.cyl(0.45, 0.45, 0.04, mat, T(x, y, 0.74), seg=12)
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        q.rod((x + math.cos(a) * 0.12, y + math.sin(a) * 0.12, 0.72), (x + math.cos(a) * 0.35, y + math.sin(a) * 0.35, 0),
              0.02, mat, seg=4)
    for k in range(chairs):
        a = k * 2 * math.pi / chairs
        chair(q, x + math.cos(a) * 0.75, y + math.sin(a) * 0.75, math.degrees(a) + 90, chair_mat)
    if umbrella:
        props.umbrella(q, x, y, 1.3, 2.3)
    return q


def wheelie_bin(q, x, y, mat='paint_blue', facing=0.0):
    m = T(x, y, 0) @ R(0, 0, facing)
    q.box((0.58, 0.7, 0.92), mat, m @ T(0, 0, 0.5), bevel=0.03)
    q.box((0.62, 0.78, 0.06), mat, m @ T(0, -0.02, 0.98))
    for s in (-1, 1):
        q.cyl(0.1, 0.1, 0.06, 'black', m @ T(s * 0.28, 0.3, 0.1) @ R(0, 90, 0), seg=8)
    return q


def cooler(q, x, y, facing=0.0):
    """A glass-door drinks fridge (ตู้แช่) outside a shop."""
    m = T(x, y, 0) @ R(0, 0, facing)
    q.box((0.7, 0.65, 1.9), 'paint_white', m @ T(0, 0, 0.95), bevel=0.02)
    q.box((0.56, 0.04, 1.4), 'e3_store_glass', m @ T(0, -0.33, 1.05))
    for k in range(4):
        q.box((0.5, 0.05, 0.14), GOODS[k * 2 % len(GOODS)], m @ T(0, -0.34, 0.5 + k * 0.33))
    q.box((0.7, 0.66, 0.25), 'paint_red', m @ T(0, 0, 1.78))
    return q


def gas_tanks(q, x, y, n=3):
    """LPG cylinders in a row."""
    for i in range(n):
        q.cyl(0.18, 0.18, 0.75, ('paint_green', 'paint_red', 'paint_blue')[i % 3], T(x + i * 0.42, y, 0.38), seg=10)
        q.sphere(0.18, ('paint_green', 'paint_red', 'paint_blue')[i % 3], T(x + i * 0.42, y, 0.75) @ S(1, 1, 0.5),
                 seg=10, rings=4)
        q.torus(0.09, 0.025, 'steel', T(x + i * 0.42, y, 0.88), seg=8, seg_minor=4)
    return q


def food_cart(q, x, y, facing=0.0, top='awning_red'):
    """A street food cart (รถเข็น) with a glass case and a little roof (a stall, not a vehicle to drive)."""
    m = T(x, y, 0) @ R(0, 0, facing)
    q.box((1.6, 0.8, 0.7), 'steel', m @ T(0, 0, 0.6))
    q.box((1.2, 0.6, 0.5), 'e3_store_glass', m @ T(-0.1, 0, 1.2))
    for sx in (-0.75, 0.75):
        q.cyl(0.25, 0.25, 0.06, 'black', m @ T(sx, -0.42, 0.25) @ R(90, 0, 0), seg=10)
    for sx in (-0.7, 0.7):
        for sy in (-0.35, 0.35):
            q.box((0.04, 0.04, 1.3), 'steel', m @ T(sx, sy, 1.55))
    q.box((1.9, 1.1, 0.06), top, m @ T(0, 0, 2.22))
    q.box((1.9, 0.04, 0.2), 'awning_white', m @ T(0, -0.55, 2.12))
    return q


def potted_row(q, x0, y, n, step=0.9, size=0.5, seed=0):
    for i in range(n):
        props.potted(q, x0 + i * step, y, 0, size, ('leafy', 'flowers', 'leafy')[(i + seed) % 3], seed + i)
    return q


def scooter_shed(p, rect, h=2.4, roof='zinc'):
    """A motorbike shelter: steel posts and a ribbed shed roof."""
    x0, y0, x1, y1 = rect
    n = max(2, int((x1 - x0) / 3) + 1)
    for i in range(n):
        x = x0 + (x1 - x0) * i / (n - 1)
        for y, hh in ((y0, h), (y1, h + 0.5)):
            kit.block(p, x - 0.05, y - 0.05, 0, x + 0.05, y + 0.05, hh, 'steel')
    kit.corrugated(p, rect, h, h + 0.5, roof, 'zinc_dark' if roof != 'roof_blue' else 'paint_blue', 0.3, 'front')
    return p


def parking_lines(b, x0, y0, x1, y1, n, axis='x', z=0.06):
    """White bay lines painted on a paved forecourt."""
    for i in range(n + 1):
        if axis == 'x':
            x = x0 + (x1 - x0) * i / n
            kit.block(b.yard, x - 0.06, y0, 0, x + 0.06, y1, z, 'paint_white')
        else:
            y = y0 + (y1 - y0) * i / n
            kit.block(b.yard, x0, y - 0.06, 0, x1, y + 0.06, z, 'paint_white')
    return b


def drain(b, x0, y0, x1, y1, crossings=()):
    """The concrete drainage canal (คลองระบายน้ำ): a channel with a dark floor and water between two raised walls,
    slab crossings, an outfall pipe."""
    along_x = (x1 - x0) >= (y1 - y0)
    kit.block(b.yard, x0, y0, 0, x1, y1, 0.05, 'concrete_dark')
    if along_x:
        kit.block(b.yard, x0, y0 + 0.3, 0, x1, y1 - 0.3, 0.12, 'water')
        for y in (y0, y1 - 0.3):
            kit.block(b.main, x0, y, 0, x1, y + 0.3, 0.45, 'concrete')
        for c in crossings:
            kit.block(b.main, c - 1.0, y0 - 0.1, 0.45, c + 1.0, y1 + 0.1, 0.6, 'concrete_light')
        b.props.rod((x0 + 2.0, y1 - 0.1, 0.35), (x0 + 2.0, y1 - 0.7, 0.3), 0.15, 'rust', seg=8)
    else:
        kit.block(b.yard, x0 + 0.3, y0, 0, x1 - 0.3, y1, 0.12, 'water')
        for x in (x0, x1 - 0.3):
            kit.block(b.main, x, y0, 0, x + 0.3, y1, 0.45, 'concrete')
        for c in crossings:
            kit.block(b.main, x0 - 0.1, c - 1.0, 0.45, x1 + 0.1, c + 1.0, 0.6, 'concrete_light')
        b.props.rod((x0 + 0.1, y0 + 2.0, 0.35), (x0 + 0.7, y0 + 2.0, 0.3), 0.15, 'rust', seg=8)
    return b


# lots ---------------------------------------------------------------------------------------------------------------------------

def lot_wall(b, e, gates=((0.0, 3.0),), h=1.6, front_h=0.9, mat=None, rail=True, sides=('left', 'back', 'right'),
             gate_open=0.4, ex=None):
    """The lot's wall: a low plastered front wall with steel pickets and sliding steel gates, higher walls round the
    sides and back, pillars with caps. e is the half size (ex the half width when it differs)."""
    ex = ex or e
    p = b.props
    mat = mat or ('concrete' if b.region == 'northeast' else regions.plaster(b.region, 1))
    cap = 'concrete_light'
    gs = sorted(gates)
    xs = [-ex]
    for gx, gw in gs:
        xs += [gx - gw / 2, gx + gw / 2]
    xs.append(ex)
    for a, c in zip(xs[0::2], xs[1::2]):
        if c - a < 0.2:
            continue
        props.fence(p, [(a, -e), (c, -e)], front_h, mat, kind='wall', post_mat=cap)
        if rail:
            kit.railing(p, [(a + 0.2, -e), (c - 0.2, -e)], front_h + 0.07, 'iron', h=0.75, spacing=0.3,
                        posts_every=2.6, baluster=0.03)
    corners = {'left': [(-ex, -e), (-ex, e)], 'back': [(-ex, e), (ex, e)], 'right': [(ex, e), (ex, -e)]}
    for s in sides:
        props.fence(p, corners[s], h, mat, kind='wall', post_mat=cap)
    pillars = set(xs)
    for x in pillars:
        kit.block(p, x - 0.2, -e - 0.2, 0, x + 0.2, -e + 0.2, max(h, front_h + 0.85), mat)
        kit.block(p, x - 0.26, -e - 0.26, max(h, front_h + 0.85), x + 0.26, -e + 0.26, max(h, front_h + 0.85) + 0.1,
                  cap)
    for gx, gw in gs:
        leaf = gw * (1 - gate_open)
        a = gx - gw / 2
        gh = front_h + 0.7
        n = int(leaf / 0.15)
        for i in range(n + 1):
            p.box((0.03, 0.03, gh), 'iron', T(a + leaf * i / max(n, 1), -e + 0.25, gh / 2 + 0.05))
        for zz in (0.12, gh * 0.55, gh):
            p.box((leaf, 0.05, 0.05), 'iron', T(a + leaf / 2, -e + 0.25, zz))
        p.cyl(0.06, 0.06, 0.05, 'black', T(a + 0.2, -e + 0.25, 0.06) @ R(0, 90, 0), seg=6)
    return b


def car_porch(b, rect, z=2.7, kind='slab', posts='steel'):
    """A car porch (โรงจอดรถ) beside a house: a paved floor, two posts and a flat slab, or a zinc lean-to."""
    x0, y0, x1, y1 = rect
    p = b.main
    kit.block(b.yard, x0, y0, 0, x1, y1, 0.08, 'concrete')
    pm = 'steel' if posts == 'steel' else 'concrete_light'
    r = 0.06 if posts == 'steel' else 0.15
    for x in (x0 + 0.2, x1 - 0.2):
        for y in (y0 + 0.2,):
            kit.block(p, x - r, y - r, 0, x + r, y + r, z, pm)
    if kind == 'slab':
        kit.block(p, x0 - 0.2, y0 - 0.3, z, x1 + 0.2, y1, z + 0.18, 'concrete_light')
        bm = band_mat(b.region)
        kit.block(p, x0 - 0.24, y0 - 0.34, z + 0.1, x1 + 0.24, y0 - 0.22, z + 0.32, bm)
        for x in (x0 - 0.24, x1 + 0.12):
            kit.block(p, x, y0 - 0.34, z + 0.1, x + 0.12, y1, z + 0.32, bm)
    else:
        kit.corrugated(p, (x0, y0, x1, y1), z - 0.2, z + 0.3, kind, 'zinc_dark' if kind == 'zinc' else 'concrete_dark',
                       0.25, 'front')
    return p


def concrete_house(b, cx, cy, w, d, floors=1, i=0, storey=3.0, plinth=0.45, door_u=None, axis='x', roof=None,
                   balcony=True, pitch=None, ac=True):
    """A concrete single house (บ้านเดี่ยว): a plinth, plastered walls with a skirting band, grille windows with
    sunshades, a door with a little canopy and steps, a balcony upstairs, and the region's roof in cement or clay
    tiles. Returns its rect and heights."""
    r = b.region
    p = b.main
    q = b.props
    wall = regions.plaster(r, i)
    band = band_mat(r)
    rect = (cx - w / 2, cy - d / 2, cx + w / 2, cy + d / 2)
    x0, y0, x1, y1 = rect
    kit.block(p, x0 - 0.25, y0 - 0.25, 0, x1 + 0.25, y1 + 0.25, plinth, 'concrete', bevel=0.02)
    top = plinth + storey * floors
    kit.block(p, x0, y0, plinth, x1, y1, top, wall)
    kit.bands(p, rect, plinth, 0.35, 0.02, 'e3_skirt')
    for k in range(1, floors):
        kit.bands(p, rect, plinth + storey * k - 0.1, 0.2, 0.06, band)
    kit.bands(p, rect, top - 0.2, 0.2, 0.04, band)
    if door_u is None:
        door_u = -w / 2 + 1.4
    for k in range(floors):
        z = plinth + storey * k
        for side in kit.SIDES:
            fw = kit.face_width(rect, side)
            n = max(1, int(fw / 2.6))
            us = kit.spread(fw, n, 0.7)
            if side == 'front' and k == 0:
                us = [u for u in us if abs(u - door_u) > 1.4]
                kit.door(p, rect, 'front', door_u, z, 0.9, 2.1, leaf='teak', frame='teak_dark')
                kit.on_face(p, rect, 'front', door_u, z + 2.35, 1.6, 0.1, 0.9, 'concrete_light')
                kit.stairs(p, cx + door_u, y0 - 0.25, plinth, 1.4, '-y', 'concrete', open_=False)
            if side == 'front' and k == 1 and balcony:
                bu = door_u
                kit.balcony(p, rect, 'front', bu, z, 2.4, 1.0, 'concrete_light', 'iron')
                kit.door(p, rect, 'front', bu, z, 1.4, 2.2, leaf='glass_dark', frame='teak_dark', panels=True)
                us = [u for u in us if abs(u - bu) > 1.8]
            for u in us:
                grille_window(p, rect, side, u, z + 0.9, 1.2, 1.25)
        if ac and k == floors - 1:
            ac_on(q, rect, 'left', -d / 2 + 1.0, z + 0.4)
    st = regions.style(r)
    rm = roof or roof_mat(r, i)
    pt = pitch or st['pitch'] * 0.72
    rtop = regions.house_roof(p, rect, top, r, mat=rm, axis=axis, over=0.8, over_ends=0.6, fill=wall, pitch=pt)
    return {'rect': rect, 'top': top, 'ridge': rtop, 'plinth': plinth}


# the shophouse (ตึกแถว) -----------------------------------------------------------------------------------------------------------

def levels(floors, ground_h=4.0, storey=3.4):
    zs = [0.0]
    z = ground_h
    for _ in range(1, floors):
        zs.append(z)
        z += storey
    return zs, z


def front_gable(p, region, x0, x1, y_front, z, depth=2.6, roof=None, wall='plaster'):
    """The Thai gable on a shophouse front, standing above its flat roof (the concept's look): the region's roof form
    and bargeboards (turned-up ends in central, east and west; a plain กาแล in the north; plain in the northeast),
    the gable framed in timber or plain plaster with a vent. No temple ornaments."""
    w = x1 - x0
    st = regions.style(region)
    pitch = {'central': 1.35, 'east': 1.25, 'west': 1.25, 'north': 0.95, 'northeast': 0.8}.get(region, 1.0)
    rect = (x0 + 0.12, y_front, x1 - 0.12, y_front + depth)
    span = rect[2] - rect[0]
    rise = span / 2 * pitch
    rm = roof or roof_mat(region)
    fm = gable_fill(region) or wall
    trim = st['trim']
    kit.block(p, x0, y_front - 0.08, z - 0.15, x1, y_front + depth, z + 0.02, trim if fm != wall else band_mat(region))
    top = kit.gable_roof(p, rect, z, rise, rm, over=0.3, over_ends=0.25, axis='y', thick=0.12, fill=fm, courses=3,
                         course_mat=course_of(rm), barge=trim)
    regions.gable_dress(p, rect, z, rise, region, axis='y', over=0.3, over_ends=0.25)
    cx = (x0 + x1) / 2
    yf0, yf1 = y_front - 0.02, y_front + 0.04
    if fm != wall:
        # a timber frame on the gable: king post, a tie, two posts, and boards between
        kit.block(p, cx - 0.06, yf0, z, cx + 0.06, yf1, top - 0.1, trim)
        ht = rise * 0.4
        hw = span / 2 * (1 - 0.4)
        kit.block(p, cx - hw, yf0, z + ht - 0.05, cx + hw, yf1, z + ht + 0.05, trim)
        for s in (-1, 1):
            xx = cx + s * span * 0.2
            hh = rise * (1 - abs(xx - cx) / (span / 2))
            kit.block(p, xx - 0.05, yf0, z, xx + 0.05, yf1, z + hh - 0.1, trim)
            p.rod((cx, y_front - 0.01, z + ht), (cx + s * span * 0.2, y_front - 0.01, z + ht + rise * 0.3), 0.04, trim,
                  seg=4, smooth=False)
        kit.block(p, cx - span * 0.12, yf0 - 0.01, z + 0.25, cx + span * 0.12, yf1, z + ht - 0.2, 'window_dark')
        for k in range(4):
            xx = cx - span * 0.12 + span * 0.24 * (k + 0.5) / 4
            kit.block(p, xx - 0.02, yf0 - 0.03, z + 0.25, xx + 0.02, yf1, z + ht - 0.2, trim)
    else:
        vw, vh = min(1.2, span * 0.3), 0.55
        vz = z + rise * 0.3
        kit.block(p, cx - vw / 2 - 0.06, yf0 - 0.01, vz - 0.06, cx + vw / 2 + 0.06, yf1, vz + vh + 0.06, 'concrete_light')
        kit.block(p, cx - vw / 2, yf0 - 0.03, vz, cx + vw / 2, yf1, vz + vh, 'window_dark')
        for k in range(4):
            kit.block(p, cx - vw / 2, yf0 - 0.05, vz + 0.06 + k * 0.13, cx + vw / 2, yf1, vz + 0.1 + k * 0.13,
                      'concrete_light')
    return top


def sino_parapet(p, x0, x1, y0, z, wall, trim):
    """A Sino-Portuguese front parapet (south): a raised wall with a cornice, a round pediment and pilaster finials."""
    w = x1 - x0
    cx = (x0 + x1) / 2
    kit.block(p, x0, y0, z, x1, y0 + 0.3, z + 1.3, wall)
    kit.block(p, x0 - 0.06, y0 - 0.18, z - 0.1, x1 + 0.06, y0 + 0.3, z + 0.12, trim)
    kit.block(p, x0 - 0.04, y0 - 0.1, z + 1.3, x1 + 0.04, y0 + 0.35, z + 1.42, trim)
    rr = min(1.1, w * 0.26)
    p.cyl(rr, rr, 0.26, wall, T(cx, y0 + 0.15, z + 1.36) @ R(90, 0, 0), seg=16)
    p.torus(rr, 0.07, trim, T(cx, y0 + 0.02, z + 1.36) @ R(90, 0, 0), seg=16, seg_minor=4, arc=180)
    p.torus(rr * 0.45, 0.05, trim, T(cx, y0 - 0.02, z + 1.45) @ R(90, 0, 0), seg=12, seg_minor=4)
    kit.block(p, cx - w * 0.3, y0 - 0.04, z + 0.35, cx + w * 0.3, y0 + 0.1, z + 0.85, 'fretwork')
    for x in (x0 + 0.15, x1 - 0.15):
        kit.block(p, x - 0.18, y0 - 0.12, z, x + 0.18, y0 + 0.3, z + 1.55, trim)
        p.sphere(0.16, trim, T(x, y0 + 0.08, z + 1.7), seg=8, rings=5)
    return p


def shophouse(b, x0, y0, w=4.0, d=12.0, floors=3, i=0, ground='shutter', ground_h=4.0, storey=3.4, front=True,
              tank=True, balcony=None, ac=True, left_open=False, right_open=False, stairhead=False, open_=0.0,
              canopy=True, sign=False, wall=None, side_ground=True):
    """One shophouse unit (ห้องแถว), front at y0, x0 its left side: a ground floor of 4 m with a roller shutter, a
    folding steel gate on an open shop, a convenience store or a home's door, a canopy over it, upper floors of
    grille windows (a balcony on the first) and AC units, floor bands and pilasters, a flat roof with a parapet, the
    region's front (Thai gable, กาแล, plain gable, Sino-Portuguese parapet with arched windows and an arcade) and
    rooftop tanks. Returns a dict with the rect, roof height and (x, y) points used later (wires)."""
    r = b.region
    p = b.main
    q = b.props
    wall = wall or regions.plaster(r, i)
    band = band_mat(r)
    trim = regions.style(r)['trim']
    x1, y1 = x0 + w, y0 + d
    rect = (x0, y0, x1, y1)
    zs, top = levels(floors, ground_h, storey)
    south = r == 'south'
    arcade = 1.8 if south and ground not in ('home',) else 0.0
    if arcade:
        kit.block(p, x0, y0 + arcade, 0, x1, y1, ground_h, wall)
        kit.block(p, x0, y0, ground_h - 0.4, x1, y1, top, wall)
        kit.block(b.yard, x0, y0, 0, x1, y0 + arcade, 0.12, 'e3_tile')
        for x in (x0 + 0.22, x1 - 0.22):
            kit.block(p, x - 0.22, y0, 0, x + 0.22, y0 + 0.44, ground_h - 0.4, wall)
            kit.block(p, x - 0.28, y0 - 0.06, 0, x + 0.28, y0 + 0.5, 0.4, trim)
            kit.block(p, x - 0.28, y0 - 0.06, ground_h - 0.75, x + 0.28, y0 + 0.5, ground_h - 0.55, trim)
        arch(p, rect, 'front', 0, ground_h - 1.4, w - 1.0, trim, depth=0.1, tube=0.08)
        gr = (x0 + 0.1, y0 + arcade, x1 - 0.1, y1)
    else:
        kit.block(p, x0, y0, 0, x1, y1, top, wall)
        gr = rect
    # skirting, floor bands, pilasters
    kit.bands(p, gr, 0, 0.45, 0.025, 'e3_skirt')
    for z in zs[1:]:
        kit.block(p, x0 - 0.04, y0 - 0.16, z - 0.12, x1 + 0.04, y1 + 0.04, z + 0.1, band)
    for x in (x0, x1 - 0.22):
        kit.block(p, x, y0 - 0.1, ground_h if arcade else 0.0, x + 0.22, y0, top, wall if not south else trim)
    # ground floor
    gw = w - 0.7
    gh = ground_h - 0.9
    if ground == 'shutter':
        if w >= 4.6:
            kit.roller_shutter(p, gr, 'front', -0.55, 0, gw - 1.2, gh, 'roller', open_)
            kit.door(p, gr, 'front', gw / 2 - 0.45, 0, 0.9, 2.1, leaf='teak', frame=trim)
        else:
            kit.roller_shutter(p, gr, 'front', 0, 0, gw, gh, 'roller', open_)
    elif ground == 'gate':
        shop_interior(p, gr, 'front', 0, 0, gw, gh)
        steel_gate(p, gr, 'front', 0, 0, gw, gh, 0.35)
    elif ground == 'shop':
        shop_interior(p, gr, 'front', 0, 0, gw, gh)
        steel_gate(p, gr, 'front', 0, 0, gw, gh, 0.9)
    elif ground == 'store':
        store_front(p, q, gr, 'front', 0, 0, gw, 2.9, awning=True)
    elif ground == 'home':
        kit.door(p, gr, 'front', gw / 2 - 0.55, 0, 0.9, 2.1, leaf='teak', frame=trim)
        grille_window(p, gr, 'front', -0.7, 0.9, min(2.0, w - 2.4), 1.3, hood=None)
    if canopy and ground != 'store':
        if r == 'northeast' and ground != 'home':
            zc = ground_h - 0.55
            kit.corrugated(p, (x0 + 0.05, y0 - 2.0, x1 - 0.05, y0), zc - 0.6, zc, 'zinc', 'zinc_dark', 0.1, 'front')
            for x in (x0 + 0.15, x1 - 0.15):
                kit.block(p, x - 0.05, y0 - 2.0, 0, x + 0.05, y0 - 1.9, zc - 0.6, 'steel')
        elif not arcade:
            kit.block(p, x0 + 0.05, y0 - 1.0, ground_h - 0.75, x1 - 0.05, y0, ground_h - 0.63, 'concrete_light')
            kit.block(p, x0 + 0.05, y0 - 1.06, ground_h - 0.85, x1 - 0.05, y0 - 0.96, ground_h - 0.6, band)
    if sign:
        props.sign_board(q, rect, 'front', 0, ground_h - 0.55 if not arcade else ground_h - 0.4, w - 1.0, 0.5,
                         sign if isinstance(sign, str) else 'sign_cream', 'sign_text', out=0.1 if arcade else 1.0)
    # upper floors
    for k, z in enumerate(zs[1:]):
        if (balcony if balcony is not None else True) and k == 0 and not south:
            kit.balcony(p, rect, 'front', 0, z + 0.02, w - 0.7, 0.9, 'concrete_light', 'iron')
            kit.door(p, rect, 'front', -0.4, z, 1.5, 2.3, leaf='glass_dark', frame=trim)
            kit.on_face(p, rect, 'front', -0.4, z + 2.4, 2.0, 0.08, 0.4, 'concrete_light')
            for kk in range(1, 4):
                kit.on_face(p, rect, 'front', -0.4 - 0.75 + 1.5 * kk / 4, z, 0.025, 2.3, 0.12, 'iron')
            if w >= 4.0:
                grille_window(p, rect, 'front', w / 2 - 0.75, z + 0.9, 0.7, 1.3, hood=None)
        elif south:
            for u in kit.spread(w, 2, 0.5):
                regions.house_window(p, rect, 'front', u, z + 0.55, 'south', 0.95, 1.7)
                arch(p, rect, 'front', u, z + 2.62, 1.1, trim, depth=0.12, tube=0.06)
            if k == 0:
                kit.on_face(p, rect, 'front', 0, z - 0.12, w - 0.2, 0.12, 0.6, 'concrete_light')
                kit.railing(p, [(x0 + 0.2, y0 - 0.55), (x1 - 0.2, y0 - 0.55)], z, 'paint_white', h=0.9, spacing=0.2)
        else:
            for u in kit.spread(w, 2 if w >= 3.8 else 1, 0.45):
                grille_window(p, rect, 'front', u, z + 0.9, 1.1, 1.3)
        if ac and (k + i) % 2 == 0 and not south:
            if left_open:
                ac_on(q, rect, 'left', -d / 2 + 1.2, z + 0.5)
            else:
                ac_on(q, rect, 'front', -w / 2 + 0.75, z + 0.25 if k == 0 else z + 0.2)
        elif ac and south and k == 0:
            ac_on(q, rect, 'left' if left_open else 'back', 0.0, z + 0.4)
        for side, flag in (('left', left_open), ('right', right_open)):
            if flag:
                for u in kit.spread(d, 2, 1.5):
                    grille_window(p, rect, side, u, z + 0.9, 1.1, 1.3)
        grille_window(p, rect, 'back', 0, z + 0.9, 1.1, 1.2, hood=None)
    for side, flag in (('left', left_open), ('right', right_open)):
        if flag and side_ground:
            grille_window(p, rect, side, d / 2 - 2.5, 1.0, 1.2, 1.3)
            kit.on_face(p, rect, side, -d / 2 + 0.25, 0.3, 0.12, top - 0.3, 0.12, 'zinc_dark')
    # roof and its front
    pz = flat_roof(p, rect, top, 'concrete', parapet=0.8, parapet_mat=wall, coping=band)
    if front:
        if south:
            sino_parapet(p, x0, x1, y0, top + 0.25, wall, trim)
        else:
            front_gable(p, r, x0, x1, y0, pz - 0.05, depth=2.6, wall=wall)
    if tank:
        kind = 'plastic' if (i + (r == 'northeast')) % 2 else 'stainless'
        props.water_tank(q, x1 - 1.0, y1 - 1.1, top + 0.25, kind, stand=0.9)
    if stairhead:
        stair_head(p, x0 + 0.4, y1 - 3.4, x0 + 2.6, y1 - 0.4, top + 0.25, wall)
    elif (i % 3) == 1:
        antenna(q, x0 + 0.8, y1 - 1.0, top + 0.25, 3.0)
    q.rod((x1 - 0.12, y0 - 0.12, top + 0.2), (x1 - 0.12, y0 - 0.12, 0.05), 0.05, 'zinc_dark', seg=6)
    return {'rect': rect, 'top': top, 'parapet': pz, 'wire': (x0 + 0.5, y0 - 0.1, ground_h + 0.2)}


def row(b, x0, y0, units, d=12.0, floors=3, ground=None, **kw):
    """A row of shophouse units side by side: units is a list of widths (or (width, ground) pairs)."""
    out = []
    x = x0
    n = len(units)
    for k, u in enumerate(units):
        w, g = (u if isinstance(u, tuple) else (u, ground or ('shutter', 'gate', 'shop')[k % 3]))
        out.append(shophouse(b, x, y0, w, d, floors, i=k, ground=g, left_open=k == 0, right_open=k == n - 1, **kw))
        x += w
    return out


# walk-up flats --------------------------------------------------------------------------------------------------------------------

def flats(b, x0, y0, x1, y1, floors, storey=3.0, i=0, gallery=1.5, rooms=4, ground='rooms', stair=True, tanks=4):
    """Walk-up flats (แฟลต): a block with an open gallery along the front on every upper floor behind a parapet
    with breeze blocks (ช่องลม), a door and a grille window per room, laundry on the rails, a breeze-block stair
    tower in the middle rising above the roof, AC units on the side, tanks on the roof. Returns the roof height."""
    r = b.region
    p = b.main
    q = b.props
    wall = regions.plaster(r, i)
    band = band_mat(r)
    top = storey * floors
    body = (x0, y0 + gallery, x1, y1)
    kit.block(p, *body[:2], 0, *body[2:], top, wall)
    kit.bands(p, body, 0, 0.4, 0.02, 'e3_skirt')
    W = x1 - x0
    sw = 2.8 if stair else 0.0
    half = (W - sw) / 2
    room_us = []
    per = max(1, rooms // 2)
    for s in (-1, 1):
        for k in range(per):
            c = s * (sw / 2 + half * (k + 0.5) / per)
            room_us.append(c)
    for f in range(floors):
        z = f * storey
        if f > 0 or ground == 'rooms':
            for c in room_us:
                kit.door(p, body, 'front', c - 0.6, z, 0.9, 2.1, leaf='teak' if (f + int(c)) % 2 else 'paint_blue',
                         frame='teak_dark')
                grille_window(p, body, 'front', c + 0.75, z + 0.95, 1.1, 1.1, hood=None)
        if f > 0:
            kit.block(p, x0, y0, z - 0.2, x1, y0 + gallery, z, 'concrete_light')
            kit.block(p, x0, y0, z, x1, y0 + 0.12, z + 1.0, wall)
            kit.block(p, x0 - 0.03, y0 - 0.05, z + 0.95, x1 + 0.03, y0 + 0.17, z + 1.07, band)
            for c in room_us:
                for kk in range(-1, 2):
                    kit.block(p, c + kk * 0.42 - 0.16, y0 - 0.02, z + 0.4, c + kk * 0.42 + 0.16, y0 + 0.13,
                              z + 0.72, 'concrete_dark')
                if (f + int(c * 3)) % 3 != 0:
                    for kk, col in enumerate(('paint_white', 'flower_pink', 'paint_blue')[:2 + (f % 2)]):
                        kit.block(q, c - 1.0 + kk * 0.55, y0 - 0.06, z + 0.45, c - 0.6 + kk * 0.55, y0 - 0.02,
                                  z + 1.08, col)
            kit.bands(p, body, z - 0.12, 0.2, 0.04, band)
        # columns on the gallery's edge
        if f < floors:
            for x in [x0 + 0.15, x1 - 0.15] + [x0 + W / 2 + s * (sw / 2) for s in (-1, 1)] * bool(stair):
                kit.block(p, x - 0.15, y0, z, x + 0.15, y0 + 0.3, z + storey, wall)
        for u in kit.spread(y1 - y0 - gallery, 2, 1.2):
            grille_window(p, body, 'left', u, z + 0.95, 1.1, 1.2)
            grille_window(p, body, 'right', u, z + 0.95, 1.1, 1.2, hood=None)
        if f % 2 == 1:
            ac_on(q, body, 'left', 0.0, z + 0.3)
        for c in room_us[:2]:
            grille_window(p, body, 'back', c, z + 0.95, 1.0, 1.0, hood=None)
    pz = flat_roof(p, (x0, y0, x1, y1), top, 'concrete', parapet=0.9, parapet_mat=wall, coping=band)
    if stair:
        cx = (x0 + x1) / 2
        sr = (cx - sw / 2, y0 - 0.3, cx + sw / 2, y0 + gallery + 2.6)
        kit.block(p, sr[0], sr[1], 0, sr[2], sr[3], top + 2.8, wall)
        for f in range(floors):
            z = f * storey
            for kx in range(4):
                for kz in range(4):
                    if f == 0 and kz < 2:
                        continue
                    xx = sr[0] + 0.4 + kx * (sw - 0.8) / 3
                    kit.block(p, xx - 0.22, sr[1] - 0.03, z + 0.4 + kz * 0.6, xx + 0.22, sr[1] + 0.05,
                              z + 0.8 + kz * 0.6, 'concrete_dark')
        kit.door(p, sr, 'front', 0, 0, 1.2, 2.2, leaf='window_dark', frame='concrete_dark', panels=False)
        rm = roof_mat(r, i)
        regions.small_roof(p, sr, top + 2.8, r, mat=rm, axis='y' if r != 'south' else 'x', over=0.4)
    for k in range(tanks):
        x = x1 - 1.2 - k * 1.4
        props.water_tank(q, x, y1 - 1.2, top + 0.25, 'stainless' if k % 2 else 'plastic', stand=1.0)
    antenna(q, x0 + 1.0, y1 - 1.5, top + 0.25, 3.0)
    return top


# industry --------------------------------------------------------------------------------------------------------------------------

def ribbed_walls(p, rect, z0, z1, mat='zinc', line='zinc_dark', pitch=0.6, sides=kit.SIDES):
    """Walls of corrugated sheet: a box with vertical ribs on the chosen faces."""
    kit.walls(p, rect, z0, z1, mat, bevel=0.0)
    for side in sides:
        fw = kit.face_width(rect, side)
        n = max(2, int(fw / pitch))
        for u in kit.spread(fw, n, 0.1):
            kit.on_face(p, rect, side, u, z0 + 0.02, 0.05, z1 - z0 - 0.04, 0.03, line)
    return p


def shed(p, rect, wall_h, rise, base_h=2.2, base='concrete', upper='zinc', roof='zinc', axis='x', band=None,
         clerestory=True):
    """A warehouse or factory shed: block walls to base_h, ribbed sheet above, a ribbed gable roof with its gables
    filled, a row of high windows. Returns the ridge height."""
    x0, y0, x1, y1 = rect
    kit.block(p, x0, y0, 0, x1, y1, base_h, base)
    if wall_h - base_h > 0.2:
        ribbed_walls(p, rect, base_h, wall_h, upper, 'zinc_dark' if upper == 'zinc' else 'concrete_dark', 0.6)
    kit.bands(p, rect, base_h - 0.05, 0.15, 0.04, band or 'concrete_dark')
    if axis == 'x':
        yc = (y0 + y1) / 2
        kit.prism_x(p, [(y0, wall_h), (y1, wall_h), (yc, wall_h + rise - 0.05)], x0 + 0.02, x1 - 0.02, upper)
    else:
        xc = (x0 + x1) / 2
        kit.prism_y(p, [(x0, wall_h), (x1, wall_h), (xc, wall_h + rise - 0.05)], y0 + 0.02, y1 - 0.02, upper)
    top = kit.gable_ribbed(p, rect, wall_h, rise, roof, 'zinc_dark' if roof in ('zinc', 'rust') else
                           course_of(roof), over=0.5, over_ends=0.35, axis=axis, pitch=0.7)
    if clerestory:
        sides = ('left', 'right') if axis == 'y' else ('front', 'back')
        for side in sides:
            fw = kit.face_width(rect, side)
            n = max(1, int(fw / 3.0))
            for u in kit.spread(fw, n, 0.8):
                kit.on_face(p, rect, side, u, wall_h - 1.3, 1.8, 0.8, 0.06, 'glass_dark')
                kit.on_face(p, rect, side, u, wall_h - 1.32, 1.9, 0.06, 0.09, 'steel')
    return top


def sawtooth(p, rect, z, n, h=2.2, mat='zinc', glass='glass', wall='concrete'):
    """A saw-tooth factory roof: n bays sloping to the front, each with a band of north lights at its high edge."""
    x0, y0, x1, y1 = rect
    step = (y1 - y0) / n
    for k in range(n):
        ya, yb = y0 + k * step, y0 + (k + 1) * step
        kit.corrugated(p, (x0, ya, x1, yb - 0.05), z, z + h, mat, 'zinc_dark', 0.0, 'front', pitch=0.8)
        kit.block(p, x0, yb - 0.1, z + 0.2, x1, yb, z + h, glass)
        m = max(2, int((x1 - x0) / 1.5))
        for i in range(m + 1):
            x = x0 + (x1 - x0) * i / m
            kit.block(p, x - 0.04, yb - 0.14, z + 0.2, x + 0.04, yb + 0.02, z + h, 'steel')
        for xx in (x0, x1):
            kit.prism_x(p, [(ya, z), (yb, z), (yb, z + h)], xx - 0.08, xx + 0.08, wall)
    return z + h


def vent(q, x, y, z):
    """A turbine roof ventilator."""
    q.cyl(0.15, 0.15, 0.3, 'steel', T(x, y, z + 0.15), seg=8)
    q.sphere(0.26, 'steel', T(x, y, z + 0.45) @ S(1, 1, 0.8), seg=10, rings=5)
    return q


def stack(q, x, y, h=18.0, r0=0.8, r1=0.55, mat='concrete', smoke=True, z=0.0, puffs=4):
    """A factory chimney: concrete with red and white bands near the top, a ladder, smoke."""
    q.cyl(r0, r1, h, mat, T(x, y, z + h / 2), seg=14)
    for k, c in enumerate(('paint_red', 'paint_white', 'paint_red')):
        t = 0.82 + k * 0.06
        rr = r0 + (r1 - r0) * t + 0.03
        q.cyl(rr, rr, h * 0.06, c, T(x, y, z + h * t), seg=14)
    q.torus(r1 + 0.05, 0.06, 'concrete_dark', T(x, y, z + h), seg=14, seg_minor=4)
    for s in (-1, 1):
        q.rod((x + s * 0.18, y - r0 - 0.05, z + 1.0), (x + s * 0.18, y - r1 - 0.05, z + h - 0.5), 0.02, 'iron', seg=4)
    if smoke:
        drift(q, x, y, z + h + 0.6, puffs, r1 * 1.3)
    return q


def drift(q, x, y, z, puffs=4, size=1.0, wind=(1.0, 0.35)):
    """Smoke or steam drifting off with the wind: puffs growing and leaning away, not a stack of balls."""
    rnd = props._rng(int(abs(x * 7 + y * 13)) + 3)
    px, py, pz = x, y, z
    for i in range(puffs):
        s = size * (1 + i * 0.5)
        q.sphere(s, 'smoke', T(px, py, pz) @ S(1.3, 1.0, 0.7), seg=10, rings=6)
        if i % 2:
            q.sphere(s * 0.6, 'smoke', T(px - s * 0.7, py + s * 0.3, pz + s * 0.35), seg=8, rings=5)
        px += wind[0] * s * 1.6 + rnd() * 0.3
        py += wind[1] * s * 1.6
        pz += s * 0.45
    return q


def tyres(q, x, y, n=4):
    for i in range(n):
        q.torus(0.3, 0.1, 'black', T(x, y, 0.1 + i * 0.2), seg=10, seg_minor=4)
    return q


def pallets(q, x, y, n=2, load=True, seed=0):
    for i in range(n):
        kit.block(q, x - 0.6, y - 0.5, i * 0.95, x + 0.6, y + 0.5, i * 0.95 + 0.14, 'plank')
        if load:
            kit.block(q, x - 0.55, y - 0.45, i * 0.95 + 0.14, x + 0.55, y + 0.45, i * 0.95 + 0.9,
                      ('canvas', 'plank', 'cream', 'paint_white')[(i + seed) % 4], bevel=0.02)
    return q


def loading_dock(p, rect, h=1.1, steps_side='left'):
    """A raised concrete loading dock with black bumpers and steps at one end."""
    x0, y0, x1, y1 = rect
    kit.block(p, x0, y0, 0, x1, y1, h, 'concrete')
    kit.block(p, x0 - 0.02, y0 - 0.02, h - 0.06, x1 + 0.02, y1, h, 'paint_yellow')
    n = max(2, int((x1 - x0) / 2.5))
    for i in range(n):
        x = x0 + (x1 - x0) * (i + 0.5) / n
        kit.block(p, x - 0.2, y0 - 0.14, h - 0.6, x + 0.2, y0, h - 0.15, 'black')
    if steps_side == 'left':
        kit.stairs(p, x0, (y0 + y1) / 2, h, 1.2, '-x', 'concrete', open_=False)
    else:
        kit.stairs(p, x1, (y0 + y1) / 2, h, 1.2, '+x', 'concrete', open_=False)
    return p


def guard_booth(p, x, y, region=None, facing_front=True):
    """A small guard booth by a gate: glass all round, a slab roof."""
    rect = (x - 1.0, y - 1.0, x + 1.0, y + 1.0)
    kit.block(p, *rect[:2], 0, *rect[2:], 0.9, 'concrete_light')
    kit.block(p, rect[0] + 0.1, rect[1] + 0.1, 0.9, rect[2] - 0.1, rect[3] - 0.1, 2.0, 'glass_dark')
    for xx in (rect[0], rect[2]):
        for yy in (rect[1], rect[3]):
            kit.block(p, xx - 0.06, yy - 0.06, 0.9, xx + 0.06, yy + 0.06, 2.4, 'steel')
    kit.block(p, rect[0] - 0.4, rect[1] - 0.4, 2.4, rect[2] + 0.4, rect[3] + 0.4, 2.6, 'concrete_light')
    kit.block(p, rect[0] - 0.42, rect[1] - 0.42, 2.38, rect[2] + 0.42, rect[3] + 0.42, 2.5, 'paint_blue')
    return p


def barrier(q, x, y, length=4.0):
    """A red and white boom barrier at a gate."""
    q.box((0.3, 0.3, 1.0), 'paint_white', T(x, y, 0.5))
    for k in range(int(length / 0.5)):
        q.box((0.5, 0.08, 0.08), 'paint_red' if k % 2 else 'paint_white', T(x + 0.4 + k * 0.5, y, 0.95))
    return q


def track(b, x0, x1, y, sleeper_mat='concrete_dark'):
    """A metre-gauge railway track along X on its ballast."""
    kit.block(b.yard, x0, y - 1.5, 0, x1, y + 1.5, 0.25, 'gravel')
    n = int((x1 - x0) / 0.7)
    for i in range(n):
        x = x0 + 0.35 + i * 0.7
        kit.block(b.main, x - 0.11, y - 1.0, 0.25, x + 0.11, y + 1.0, 0.38, sleeper_mat)
    for s in (-1, 1):
        kit.block(b.main, x0, y + s * 0.5 - 0.04, 0.38, x1, y + s * 0.5 + 0.04, 0.52, 'e3_rail')
    return b


def wing_block(b, rect, floors, storey=3.5, i=0, corridor=None, roof=True, pitch=0.55, axis='x', door_us=(),
               wall=None, window_w=1.4, count=None, roof_kind=None):
    """A concrete institutional block (school, hall, hospital, station): floors of windows between bands, an open
    corridor with a railing on one side (corridor=('front', depth)), the region's hipped or gabled roof over it
    (or a flat roof with a parapet). Returns the eave and ridge heights."""
    r = b.region
    p = b.main
    q = b.props
    wall = wall or regions.plaster(r, i)
    band = band_mat(r)
    x0, y0, x1, y1 = rect
    top = storey * floors
    body = rect
    cr = None
    if corridor:
        side, dep = corridor
        if side == 'front':
            body = (x0, y0 + dep, x1, y1)
            cr = (x0, y0, x1, y0 + dep)
        else:
            body = (x0, y0, x1, y1 - dep)
            cr = (x0, y1 - dep, x1, y1)
    kit.block(p, *body[:2], 0, *body[2:], top, wall)
    kit.bands(p, body, 0, 0.45, 0.025, 'e3_skirt')
    fw = body[2] - body[0]
    n = count or max(2, int(fw / 3.2))
    for f in range(floors):
        z = f * storey
        if f > 0:
            kit.bands(p, body, z - 0.12, 0.22, 0.05, band)
        us = kit.spread(fw, n, 1.0)
        for k, u in enumerate(us):
            if f == 0 and any(abs(u - du) < 1.6 for du in door_us):
                continue
            grille_window(p, body, 'front', u, z + 0.95, window_w, 1.5, grille=None if cr else 'iron')
            if k % 3 == 1:
                grille_window(p, body, 'back', u, z + 0.95, window_w, 1.5, hood=None, grille=None)
        if f == 0:
            for du in door_us:
                kit.door(p, body, 'front', du, 0, 1.8, 2.4, leaf='glass_dark', frame='teak_dark', panels=True)
        for side in ('left', 'right'):
            grille_window(p, body, side, 0, z + 0.95, 1.2, 1.4, grille=None)
        if cr:
            if f > 0:
                kit.block(p, cr[0], cr[1], z - 0.2, cr[2], cr[3], z, 'concrete_light')
                kit.railing(p, [(cr[0] + 0.1, cr[1] + 0.1), (cr[2] - 0.1, cr[1] + 0.1)], z, 'paint_white'
                            if r != 'north' else 'teak', h=1.0, spacing=0.4, posts_every=3.2)
                kit.block(p, cr[0], cr[1] - 0.04, z - 0.25, cr[2], cr[1] + 0.06, z + 0.05, band)
            m = max(2, int((cr[2] - cr[0]) / 3.6) + 1)
            for kx in range(m):
                xx = cr[0] + 0.2 + (cr[2] - cr[0] - 0.4) * kx / (m - 1)
                kit.block(p, xx - 0.17, cr[1], z, xx + 0.17, cr[1] + 0.34, z + storey, wall)
    if cr:
        kit.block(p, cr[0], cr[1], top - 0.2, cr[2], cr[3], top, 'concrete_light')
    if roof:
        rm = roof_kind or roof_mat(r, i)
        ridge = regions.house_roof(p, rect, top, r, mat=rm, axis=axis, over=1.0, over_ends=0.8, fill=wall,
                                   pitch=pitch)
    else:
        ridge = flat_roof(p, rect, top, 'concrete', parapet=1.0, parapet_mat=wall, coping=band)
    return {'top': top, 'ridge': ridge, 'body': body, 'corridor': cr}
