# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The yard and roof things of the concept sheets, in true sizes: plants and trees, jars and pots, the spirit house,
water tanks, AC units, power poles, awnings, signs (no brands), fences, haystacks, solar panels, drone pads.

Every function draws into a mesh.Part at (x, y) on the ground (or at z) and returns the Part.
"""

import math

from mathutils import Vector

from . import kit
from .mesh import R, S, T


def _rng(seed):
    """A tiny deterministic generator, so a rebuild makes the same plants."""
    state = [seed * 2654435761 % 4294967296 or 1]

    def nxt():
        state[0] = (state[0] * 1103515245 + 12345) % 2147483648
        return state[0] / 2147483648
    return nxt


# plants ----------------------------------------------------------------------------------------------------------------

def leaf_blade(p, base, angle, droop, length, width, mat, tilt=0.0):
    """One long leaf (banana, palm frond) as a flattened ellipsoid from base outward along `angle` (degrees),
    drooping by droop degrees."""
    m = T(*base) @ R(0, 0, angle) @ R(0, droop, 0) @ R(tilt, 0, 0) @ T(length / 2, 0, 0) @ S(length / 2, width / 2, 0.03)
    return p.sphere(1.0, mat, m, seg=8, rings=4, smooth=True)


def banana(p, x, y, h=3.4, seed=1, fruit=True):
    """A banana plant (กล้วย): a soft trunk and big arching leaves, 3-4 m."""
    rnd = _rng(seed)
    p.cyl(0.16, 0.11, h * 0.62, 'leaf_yellow', T(x, y, h * 0.31), seg=8)
    top = (x, y, h * 0.6)
    for i in range(9):
        a = i * 360 / 9 + rnd() * 30
        droop = 10 + rnd() * 35 if i % 3 else -40
        mat = ('leaf', 'leaf_light', 'leaf_dark')[i % 3]
        leaf_blade(p, top, a, droop, 1.7 + rnd() * 0.6, 0.6, mat)
    if fruit:
        p.cyl(0.14, 0.08, 0.45, 'banana_fruit', T(x + 0.18, y - 0.1, h * 0.45), seg=8)
    return p


def coconut(p, x, y, h=9.0, seed=2, lean=8.0):
    """A coconut palm (มะพร้าว), 8-12 m, its trunk curving a little."""
    rnd = _rng(seed)
    a = math.radians(rnd() * 360)
    pts = []
    for i in range(6):
        t = i / 5
        off = math.sin(math.radians(lean)) * h * t * t
        pts.append((x + math.cos(a) * off, y + math.sin(a) * off, h * t))
    for (p0, p1) in zip(pts, pts[1:]):
        p.rod(p0, p1, 0.17, 'palm_trunk', seg=7, r_end=0.15)
    for i in range(0, 5, 2):
        q = pts[i]
        p.cyl(0.2, 0.2, 0.08, 'trunk', T(*q), seg=7)
    top = pts[-1]
    for i in range(10):
        ang = i * 36 + rnd() * 15
        leaf_blade(p, top, ang, -20 + rnd() * 35, 2.6 + rnd() * 0.6, 0.45, ('leaf', 'leaf_dark')[i % 2])
    for i in range(4):
        ang = math.radians(i * 90 + 45)
        p.sphere(0.13, 'leaf_dark', T(top[0] + math.cos(ang) * 0.22, top[1] + math.sin(ang) * 0.22, top[2] - 0.25),
                 seg=6, rings=4)
    return p


def tree(p, x, y, h=6.0, r=2.4, seed=3, mats=('leaf', 'leaf_dark', 'leaf_light')):
    """A broad shade tree (มะม่วง, ก้ามปู...): a trunk and a crown of overlapping blobs."""
    rnd = _rng(seed)
    p.cyl(0.22, 0.16, h * 0.55, 'trunk', T(x, y, h * 0.27), seg=8)
    for i in range(6):
        a = rnd() * math.tau
        d = rnd() * r * 0.5
        rr = r * (0.55 + rnd() * 0.3)
        p.sphere(rr, mats[i % len(mats)], T(x + math.cos(a) * d, y + math.sin(a) * d,
                                            h * 0.62 + rnd() * h * 0.2) @ S(1, 1, 0.75), seg=10, rings=6)
    return p


def bush(p, x, y, r=0.6, seed=4, mat='leaf_dark', flowers=None):
    rnd = _rng(seed)
    for i in range(3):
        a = rnd() * math.tau
        p.sphere(r * (0.7 + rnd() * 0.3), (mat, 'leaf')[i % 2],
                 T(x + math.cos(a) * r * 0.4, y + math.sin(a) * r * 0.4, r * 0.6) @ S(1, 1, 0.8), seg=8, rings=5)
    if flowers:
        for i in range(5):
            a = rnd() * math.tau
            p.sphere(0.08, flowers, T(x + math.cos(a) * r * 0.7, y + math.sin(a) * r * 0.7, r * (0.8 + rnd() * 0.4)),
                     seg=5, rings=3)
    return p


def potted(p, x, y, z=0.0, size=0.5, plant='leafy', seed=5):
    """A clay pot with a plant: leafy (a fan of leaves), palm, or flowers."""
    rnd = _rng(seed)
    p.lathe([(size * 0.32, 0), (size * 0.42, size * 0.55), (size * 0.48, size * 0.62), (size * 0.44, size * 0.66)],
            'clay_pot', T(x, y, z), seg=10, cap_bottom=True, smooth=False)
    p.cyl(size * 0.4, size * 0.4, 0.02, 'dirt_dark', T(x, y, z + size * 0.6), seg=10)
    top = (x, y, z + size * 0.6)
    if plant == 'flowers':
        bush(p, x, y, size * 0.5, seed, 'leaf', 'flower_red')
        return p
    n = 7 if plant == 'leafy' else 5
    for i in range(n):
        ang = i * 360 / n + rnd() * 20
        leaf_blade(p, top, ang, 40 + rnd() * 25 if plant == 'leafy' else 30, size * (1.0 + rnd() * 0.4), size * 0.35,
                   ('leaf', 'leaf_dark', 'leaf_light')[i % 3])
    return p


def grass_tuft(p, x, y, h=0.5, mat='leaf'):
    for i in range(4):
        a = i * 90 + 20
        leaf_blade(p, (x, y, 0.02), a, -70, h, 0.08, mat)
    return p


# jars, pots, household -------------------------------------------------------------------------------------------------

def water_jar(p, x, y, size=1.0, mat='jar', lid=True):
    """A big glazed water jar (โอ่งมังกร), about 0.9 m high."""
    s = size
    p.lathe([(0.28 * s, 0), (0.42 * s, 0.25 * s), (0.46 * s, 0.5 * s), (0.4 * s, 0.75 * s), (0.27 * s, 0.86 * s),
             (0.28 * s, 0.9 * s)], mat, T(x, y, 0), seg=14, cap_bottom=True)
    p.torus(0.3 * s, 0.025 * s, 'jar_glaze', T(x, y, 0.5 * s), seg=14, seg_minor=4)
    if lid:
        p.cyl(0.3 * s, 0.26 * s, 0.05, 'plank', T(x, y, 0.92 * s), seg=12)
    return p


def spirit_house(p, x, y, facing=0.0, scale=1.0):
    """A household spirit house (ศาลพระภูมิ) on its post: a small plain house with a gable roof, a ledge for offerings
    and garlands. No temple roof ornaments."""
    s = scale
    m = T(x, y, 0) @ R(0, 0, facing)

    def at(lx, ly, lz):
        return m @ T(lx * s, ly * s, lz * s)
    p.box((0.18 * s, 0.18 * s, 1.15 * s), 'spirit_red', at(0, 0, 0.575))
    p.box((0.5 * s, 0.5 * s, 0.12 * s), 'stone', at(0, 0, 0.06))
    p.box((0.75 * s, 0.75 * s, 0.07 * s), 'spirit_red', at(0, 0, 1.18))
    p.box((0.75 * s, 0.75 * s, 0.03 * s), 'gold', at(0, 0, 1.23))
    p.box((0.42 * s, 0.38 * s, 0.42 * s), 'cream', at(0, 0, 1.45))
    p.box((0.2 * s, 0.03 * s, 0.28 * s), 'gold', at(0, -0.2, 1.4))
    for sx in (-1, 1):
        p.box((0.05 * s, 0.05 * s, 0.5 * s), 'gold', at(sx * 0.24, -0.22, 1.47))
    # plain gable roof
    for sy in (-1, 1):
        p.box((0.6 * s, 0.32 * s, 0.03 * s), 'spirit_red', at(0, sy * 0.11, 1.8) @ R(sy * 38, 0, 0))
    p.box((0.62 * s, 0.05 * s, 0.05 * s), 'gold', at(0, 0, 1.91))
    # garland and offerings on the ledge
    p.torus(0.08 * s, 0.02 * s, 'flower_yellow', at(0, -0.28, 1.24), seg=8, seg_minor=4)
    p.cyl(0.04 * s, 0.04 * s, 0.08 * s, 'paint_white', at(0.2, -0.28, 1.27), seg=6)
    p.cyl(0.04 * s, 0.04 * s, 0.08 * s, 'flower_red', at(-0.2, -0.28, 1.27), seg=6)
    return p


def haystack(p, x, y, r=1.0, h=1.8):
    """A rice straw stack (ลอมฟาง) round a pole."""
    p.lathe([(r * 0.8, 0), (r, h * 0.3), (r * 0.85, h * 0.65), (r * 0.3, h * 0.95), (0.05, h)], 'hay', T(x, y, 0),
            seg=12, cap_bottom=True, smooth=False)
    p.cyl(0.04, 0.04, 0.5, 'trunk', T(x, y, h + 0.15), seg=5)
    return p


def woodpile(p, x, y, length=1.6, rows=3, mat='plank'):
    for r in range(rows):
        for i in range(rows - r + 1):
            p.cyl(0.08, 0.08, length, mat, T(x + (i - (rows - r) / 2) * 0.17, y, 0.08 + r * 0.15) @ R(90, 0, 0), seg=6)
    return p


def crates(p, x, y, n=3, mat='plank', size=0.5):
    for i in range(n):
        kit.block(p, x - size / 2 + (i % 2) * size * 1.05, y - size / 2, (i // 2) * size,
                  x + size / 2 + (i % 2) * size * 1.05, y + size / 2, (i // 2 + 1) * size - 0.02, mat, bevel=0.02)
    return p


def sacks(p, x, y, n=4, mat='canvas'):
    for i in range(n):
        p.sphere(0.32, mat, T(x + (i % 2) * 0.6, y + (i // 2 % 2) * 0.45, 0.2 + (i // 4) * 0.35) @ S(1, 0.7, 0.55),
                 seg=8, rings=5)
    return p


def barrel(p, x, y, mat='paint_blue', h=0.9):
    p.cyl(0.29, 0.29, h, mat, T(x, y, h / 2), seg=12)
    for z in (0.15, h - 0.15):
        p.torus(0.295, 0.02, 'iron', T(x, y, z), seg=12, seg_minor=4)
    return p


def bench(p, x, y, length=1.6, facing=0.0, mat='teak'):
    m = T(x, y, 0) @ R(0, 0, facing)
    p.box((length, 0.4, 0.06), mat, m @ T(0, 0, 0.45))
    for sx in (-1, 1):
        p.box((0.06, 0.36, 0.45), mat, m @ T(sx * (length / 2 - 0.1), 0, 0.225))
    return p


def table_stall(p, x, y, w=1.8, d=0.9, facing=0.0, top='plank', goods=('flower_red', 'leaf', 'banana_fruit')):
    """A market table with goods in baskets."""
    m = T(x, y, 0) @ R(0, 0, facing)
    p.box((w, d, 0.06), top, m @ T(0, 0, 0.8))
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((0.06, 0.06, 0.8), 'teak_dark', m @ T(sx * (w / 2 - 0.08), sy * (d / 2 - 0.08), 0.4))
    n = max(2, int(w / 0.5))
    for i in range(n):
        lx = -w / 2 + w * (i + 0.5) / n
        p.cyl(0.2, 0.16, 0.12, 'straw', m @ T(lx, 0, 0.89), seg=8)
        p.sphere(0.15, goods[i % len(goods)], m @ T(lx, 0, 0.98) @ S(1, 1, 0.6), seg=8, rings=4)
    return p


def umbrella(p, x, y, r=1.3, h=2.3, mat='awning_red', mat2='awning_white'):
    p.cyl(0.03, 0.03, h, 'steel', T(x, y, h / 2), seg=5)
    for i in range(8):
        a = i * 45
        m = T(x, y, h) @ R(0, 0, a)
        c0 = m @ Vector((0, 0, 0.25))
        c1 = m @ Vector((r, -r * 0.41, -0.15))
        c2 = m @ Vector((r, r * 0.41, -0.15))
        kit.hull(p, [c0, c1, c2, c0 + Vector((0, 0, -0.02))], (mat, mat2)[i % 2])
    return p


# services on buildings -------------------------------------------------------------------------------------------------

def water_tank(p, x, y, z=0.0, kind='stainless', stand=1.2):
    """A 1,000 L water tank (ถังเก็บน้ำ) on a steel stand: stainless (silver), or plastic (blue)."""
    mat = 'stainless' if kind == 'stainless' else 'tank_blue'
    if stand > 0:
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.box((0.06, 0.06, stand), 'iron', T(x + sx * 0.4, y + sy * 0.4, z + stand / 2))
        p.box((1.0, 1.0, 0.06), 'iron', T(x, y, z + stand))
    zb = z + stand
    p.lathe([(0.52, 0), (0.56, 0.1), (0.56, 1.1), (0.5, 1.25), (0.3, 1.35), (0.14, 1.38)], mat, T(x, y, zb), seg=16,
            cap_bottom=True)
    p.cyl(0.15, 0.15, 0.08, mat, T(x, y, zb + 1.42), seg=10)
    for zz in (0.35, 0.75):
        p.torus(0.565, 0.02, 'metal', T(x, y, zb + zz), seg=16, seg_minor=4)
    p.rod((x + 0.57, y, zb + 0.2), (x + 0.57, y, z), 0.035, 'paint_white', seg=6)
    return p


def ac_unit(p, x, y, z, facing=0.0):
    """An air conditioner's outdoor unit (คอมแอร์) on its bracket: 0.8 x 0.3 x 0.55 m."""
    m = T(x, y, z) @ R(0, 0, facing)
    p.box((0.82, 0.3, 0.56), 'paint_white', m @ T(0, 0, 0.28), bevel=0.02)
    p.cyl(0.2, 0.2, 0.02, 'grey', m @ T(-0.12, -0.155, 0.28) @ R(90, 0, 0), seg=12)
    for k in range(-2, 3):
        p.box((0.4, 0.015, 0.012), 'iron', m @ T(-0.12, -0.17, 0.28 + k * 0.07))
    p.box((0.8, 0.35, 0.03), 'iron', m @ T(0, 0.02, -0.015))
    for sx in (-1, 1):
        p.rod(m @ Vector((sx * 0.35, 0.18, -0.02)), m @ Vector((sx * 0.35, 0.18, -0.35)), 0.02, 'iron', seg=4)
    p.rod(m @ Vector((0.3, 0.1, 0.4)), m @ Vector((0.3, 0.17, 0.9)), 0.025, 'paint_white', seg=4)
    return p


def power_pole(p, x, y, h=8.5, mat='concrete', arms=2, insulators=True):
    """A power pole: wood (era 2) or concrete (later), with cross arms and insulators."""
    p.cyl(0.14, 0.1, h, mat, T(x, y, h / 2), seg=8)
    for k in range(arms):
        z = h - 0.4 - k * 0.7
        p.box((1.6, 0.1, 0.1), 'teak_dark' if mat == 'teak' else 'iron', T(x, y, z))
        if insulators:
            for sx in (-0.65, 0.0, 0.65):
                p.cyl(0.04, 0.05, 0.14, 'paint_white', T(x + sx, y, z + 0.12), seg=6)
    return p


def wires(p, a, b, sag=0.6, mat='cable', r=0.018, n=6):
    """A sagging cable from a to b (3D points)."""
    a, b = Vector(a), Vector(b)
    pts = []
    for i in range(n + 1):
        t = i / n
        q = a.lerp(b, t)
        q.z -= sag * 4 * t * (1 - t)
        pts.append(q)
    for q0, q1 in zip(pts, pts[1:]):
        p.rod(q0, q1, r, mat, seg=4, smooth=False)
    return p


def awning(p, rect, side, u, z, w, depth=1.4, drop=0.5, stripes=('awning_red', 'awning_white'), valance=True):
    """A striped canvas awning over a shop front, sloping down and out from z."""
    o, along, n = kit.face_frame(rect, side)
    k = max(2, int(w / 0.4))
    sw = w / k
    for i in range(k):
        uu = u - w / 2 + sw * (i + 0.5)
        a = o + along * (uu - sw / 2)
        b = o + along * (uu + sw / 2)
        a.z = b.z = z
        a2 = a + n * depth
        b2 = b + n * depth
        a2.z = b2.z = z - drop
        mat = stripes[i % len(stripes)]
        kit.slab(p, a, b, b2, a2, 0.04, mat)
        if valance:
            c = (a2 + b2) / 2
            size = (sw, 0.03, 0.25) if side in ('front', 'back') else (0.03, sw, 0.25)
            p.box(size, mat, T(c.x, c.y, c.z - 0.12))
    # two thin arms
    for s in (-1, 1):
        a = o + along * (u + s * (w / 2 - 0.1))
        a.z = z - 0.9
        b = a + n * depth
        b.z = z - drop
        p.rod(a, b, 0.02, 'iron', seg=4)
    return p


def sign_board(p, rect, side, u, z, w, h, mat='sign_cream', frame='sign_text', text_lines=2, out=0.05):
    """A shop sign over the front: a board with a frame and dark bars standing for Thai lettering (no brands)."""
    kit.on_face(p, rect, side, u, z, w + 0.1, h + 0.1, 0.06, frame, out=out)
    kit.on_face(p, rect, side, u, z + 0.05, w - 0.02, h - 0.02, 0.08, mat, out=out)
    for i in range(text_lines):
        lw = w * (0.7 - 0.2 * i)
        kit.on_face(p, rect, side, u, z + h * (0.62 - 0.32 * i), lw, h * 0.14, 0.1, 'sign_text', out=out)
    return p


def blade_sign(p, x, y, z, h=1.6, w=0.5, mat='sign_red', facing=0.0):
    """A vertical sign sticking out from a wall corner."""
    m = T(x, y, z) @ R(0, 0, facing)
    p.box((0.08, w, h), mat, m @ T(0, 0, h / 2))
    for i in range(3):
        p.box((0.1, w * 0.5, 0.18), 'sign_cream', m @ T(0, 0, h * (0.25 + i * 0.25)))
    return p


def fence(p, points, h=1.1, mat='bamboo', post_mat=None, spacing=0.12, kind='picket', closed=False):
    """A fence along a polyline on the ground: bamboo/wood pickets, or a low wall."""
    pts = [Vector((x, y, 0)) for x, y in points]
    if closed:
        pts.append(pts[0])
    for a, b in zip(pts, pts[1:]):
        length = (b - a).length
        if length < 1e-3:
            continue
        if kind == 'wall':
            mid = (a + b) / 2
            ang = math.degrees(math.atan2(b.y - a.y, b.x - a.x))
            p.box((length, 0.18, h), mat, T(mid.x, mid.y, h / 2) @ R(0, 0, ang))
            p.box((length + 0.04, 0.24, 0.07), post_mat or 'concrete_light', T(mid.x, mid.y, h + 0.035) @ R(0, 0, ang))
            continue
        for z in (h * 0.3, h * 0.75):
            p.rod(a + Vector((0, 0, z)), b + Vector((0, 0, z)), 0.03, post_mat or mat, seg=4, smooth=False)
        n = max(1, int(length / spacing))
        for i in range(n + 1):
            q = a + (b - a) * (i / n)
            hh = h * (0.9 + 0.1 * ((i * 7) % 3) / 2)
            p.cyl(0.03, 0.025, hh, mat, T(q.x, q.y, hh / 2), seg=5, smooth=False)
    return p


def solar_panels(p, x, y, z, cols=3, rows=2, tilt=12.0, facing=0.0, pw=1.0, ph=1.7):
    """Rows of solar panels on a frame."""
    m = T(x, y, z) @ R(0, 0, facing)
    for i in range(cols):
        for j in range(rows):
            lx = (i - (cols - 1) / 2) * (pw + 0.05)
            ly = (j - (rows - 1) / 2) * (ph * math.cos(math.radians(tilt)) + 0.05)
            pm = m @ T(lx, ly, 0.35 + ly * math.tan(math.radians(tilt))) @ R(tilt, 0, 0)
            p.box((pw, ph, 0.04), 'solar_frame', pm)
            p.box((pw - 0.06, ph - 0.06, 0.05), 'solar', pm)
            for k in (-1, 1):
                p.box((pw - 0.06, 0.012, 0.055), 'solar_frame', pm @ T(0, k * ph / 6, 0))
    p.box((cols * (pw + 0.05), 0.06, 0.06), 'iron', m @ T(0, 0, 0.3))
    return p


def drone_pad(p, x, y, z, r=1.6):
    """A drone landing pad (era 5): a round deck with an H ring and lights."""
    p.cyl(r, r, 0.12, 'concrete_light', T(x, y, z + 0.06), seg=20)
    p.torus(r * 0.75, 0.04, 'paint_yellow', T(x, y, z + 0.13), seg=20, seg_minor=4)
    p.box((0.12, r * 0.8, 0.02), 'paint_yellow', T(x - r * 0.25, y, z + 0.13))
    p.box((0.12, r * 0.8, 0.02), 'paint_yellow', T(x + r * 0.25, y, z + 0.13))
    p.box((r * 0.5, 0.12, 0.02), 'paint_yellow', T(x, y, z + 0.13))
    for i in range(8):
        a = i * math.tau / 8
        p.sphere(0.06, 'lamp', T(x + math.cos(a) * (r - 0.1), y + math.sin(a) * (r - 0.1), z + 0.15), seg=6, rings=3)
    return p


def drone(p, x, y, z, size=0.7):
    p.box((size * 0.4, size * 0.4, size * 0.12), 'robot_white', T(x, y, z), bevel=0.03)
    for sx in (-1, 1):
        for sy in (-1, 1):
            q = (x + sx * size * 0.42, y + sy * size * 0.42, z + 0.04)
            p.rod((x, y, z), q, 0.02, 'grey', seg=4)
            p.cyl(size * 0.18, size * 0.18, 0.01, 'grey', T(*q) @ T(0, 0, 0.03), seg=10)
    return p


def bollard_light(p, x, y, h=0.7):
    p.cyl(0.07, 0.07, h, 'iron', T(x, y, h / 2), seg=8)
    p.cyl(0.075, 0.075, 0.12, 'lamp', T(x, y, h - 0.1), seg=8)
    return p


def street_lamp(p, x, y, h=6.0, facing=0.0, mat='steel'):
    m = T(x, y, 0) @ R(0, 0, facing)
    p.cyl(0.08, 0.06, h, mat, m @ T(0, 0, h / 2), seg=8)
    p.rod(m @ Vector((0, 0, h - 0.1)), m @ Vector((0, -1.2, h + 0.2)), 0.04, mat, seg=5)
    p.box((0.5, 0.25, 0.1), mat, m @ T(0, -1.3, h + 0.17))
    p.box((0.4, 0.2, 0.03), 'lamp', m @ T(0, -1.3, h + 0.11))
    return p


def flag_pole(p, x, y, h=8.0, thai=True):
    """A flag pole; the Thai flag only on government buildings (MODEL_SPEC 6)."""
    p.cyl(0.05, 0.04, h, 'steel', T(x, y, h / 2), seg=8)
    p.sphere(0.08, 'gold', T(x, y, h + 0.05), seg=8, rings=4)
    if thai:
        fw, fh = 1.8, 1.2
        bands = ('flag_red', 'flag_white', 'flag_blue', 'flag_white', 'flag_red')
        heights = (1, 1, 2, 1, 1)
        z = h - 0.1
        for mat, k in zip(bands, heights):
            bh = fh * k / 6
            p.box((fw, 0.02, bh), mat, T(x + fw / 2 + 0.05, y, z - bh / 2))
            z -= bh
    return p


def chimney(p, x, y, h=18.0, r0=1.0, r1=0.7, mat='brick', bands_mat='brick_dark', z=0.0):
    p.cyl(r0, r1, h, mat, T(x, y, z + h / 2), seg=14)
    for k in (0.3, 0.6, 0.95):
        rr = r0 + (r1 - r0) * k + 0.04
        p.cyl(rr, rr, 0.35, bands_mat, T(x, y, z + h * k), seg=14)
    return p


def smoke(p, x, y, z, puffs=4, size=1.2):
    for i in range(puffs):
        s = size * (1 + i * 0.35)
        p.sphere(s, 'smoke', T(x + i * 0.9, y + i * 0.3, z + i * s * 1.1) @ S(1, 1, 0.8), seg=10, rings=6)
    return p


def tank(p, x, y, r=2.5, h=5.0, mat='stainless', roof='cone', z=0.0):
    """A storage tank or silo."""
    p.cyl(r, r, h, mat, T(x, y, z + h / 2), seg=18)
    if roof == 'cone':
        p.cyl(r + 0.05, 0.2, r * 0.45, mat, T(x, y, z + h + r * 0.225), seg=18)
    else:
        p.cyl(r + 0.05, r + 0.05, 0.12, mat, T(x, y, z + h + 0.06), seg=18)
    for k in (0.25, 0.5, 0.75):
        p.torus(r + 0.02, 0.03, 'metal', T(x, y, z + h * k), seg=18, seg_minor=4)
    return p


def pipe_run(p, points, r=0.15, mat='metal'):
    for a, b in zip(points, points[1:]):
        p.rod(a, b, r, mat, seg=8)
    for q in points[1:-1]:
        p.sphere(r * 1.05, mat, T(*q), seg=8, rings=4)
    return p


def buffalo(p, x, y, facing=0.0, lying=True):
    """A water buffalo (ควาย) lying in the shade: low poly, 2.4 m long."""
    m = T(x, y, 0) @ R(0, 0, facing)
    zb = 0.45 if lying else 0.95
    p.sphere(1.0, 'buffalo', m @ T(0, 0, zb) @ S(1.15, 0.6, 0.48), seg=12, rings=8)
    p.sphere(0.32, 'buffalo', m @ T(1.25, 0, zb + 0.1) @ S(1.3, 0.8, 0.8), seg=10, rings=6)
    for s in (-1, 1):
        p.rod(m @ Vector((1.25, s * 0.15, zb + 0.32)), m @ Vector((1.05, s * 0.5, zb + 0.42)), 0.05, 'stone',
              seg=5, r_end=0.02)
    if lying:
        for s in (-1, 1):
            p.box((0.7, 0.2, 0.18), 'buffalo', m @ T(0.6, s * 0.45, 0.09))
    else:
        for sx in (-0.7, 0.7):
            for sy in (-0.3, 0.3):
                p.cyl(0.1, 0.08, 0.7, 'buffalo', m @ T(sx, sy, 0.35), seg=6)
    return p


def hammock(p, a, b, sag=0.5):
    """A hammock (เปล) between two posts (3D points)."""
    wires(p, a, b, sag=sag, mat='rope', r=0.02, n=6)
    a, b = Vector(a), Vector(b)
    mid = a.lerp(b, 0.5)
    mid.z -= sag * 0.9
    d = (b - a)
    ang = math.degrees(math.atan2(d.y, d.x))
    p.box((d.length * 0.55, 0.6, 0.03), 'canvas', T(*mid) @ R(0, 0, ang))
    return p


def rice_field(p, x0, y0, x1, y1, rows=True):
    """A paddy with its dykes and young rice in rows (flat, for yards)."""
    kit.block(p, x0, y0, 0.0, x1, y1, 0.03, 'mud_field')
    for xx in (x0, x1):
        kit.block(p, xx - 0.15, y0 - 0.15, 0.0, xx + 0.15, y1 + 0.15, 0.2, 'grass_dark')
    for yy in (y0, y1):
        kit.block(p, x0 - 0.15, yy - 0.15, 0.0, x1 + 0.15, yy + 0.15, 0.2, 'grass_dark')
    if rows:
        n = max(2, int((x1 - x0) / 0.5))
        m = max(2, int((y1 - y0) / 0.5))
        for i in range(1, n):
            for j in range(1, m):
                if (i + j) % 2 == 0:
                    x = x0 + (x1 - x0) * i / n
                    y = y0 + (y1 - y0) * j / m
                    p.cyl(0.07, 0.03, 0.35, 'rice_young', T(x, y, 0.2), seg=4, smooth=False)
    return p
