# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Work and village things the early eras share, in true sizes: a rice barn, a well, a kiln, a water wheel, an ox
cart, cloth on a line, a stamp mill, a watch tower, a drum, compost pens, stacks of bricks."""

import math

from mathutils import Vector

from . import kit, props, regions
from .mesh import R, S, T


def rice_barn(b, x, y, w=3.0, d=2.4, thatch=True, roof_mat=None):
    """A rice barn (ยุ้งข้าว) on short posts, walls leaning out a little, a ladder to its small door."""
    p = b.main
    trim = regions.style(b.region)['trim']
    rect = (x - w / 2, y - d / 2, x + w / 2, y + d / 2)
    kit.stilts(p, rect, 1.0, 3, 2, trim, 0.18, 'stone')
    kit.floor_deck(p, (rect[0] - 0.1, rect[1] - 0.1, rect[2] + 0.1, rect[3] + 0.1), 1.0, 'plank', 0.1, edge=trim)
    kit.plank_walls(p, rect, 1.0, 2.7, 'plank', trim, board=0.2, posts_mat=trim)
    kit.door(p, rect, 'front', 0, 1.3, 0.7, 1.1, leaf='plank', frame=trim, panels=False)
    for k in range(5):
        p.box((0.6, 0.05, 0.05), trim, T(x, rect[1] - 0.45 - k * 0.0, 0.2 + k * 0.22) @ T(0, -0.12 * k, 0))
    p.rod((x - 0.3, rect[1] - 0.05, 1.3), (x - 0.3, rect[1] - 0.75, 0.0), 0.03, trim, seg=4)
    p.rod((x + 0.3, rect[1] - 0.05, 1.3), (x + 0.3, rect[1] - 0.75, 0.0), 0.03, trim, seg=4)
    return regions.house_roof(p, rect, 2.7, b.region, roof_mat, axis='x', over=0.6, over_ends=0.4, thatch=thatch)


def well(p, x, y, r=0.8, roof=True, roof_mat='thatch', mat='brick'):
    """A round village well (บ่อน้ำ) with a winch and a little roof."""
    p.lathe([(r, 0), (r, 0.8), (r - 0.18, 0.8), (r - 0.18, 0.05)], mat, T(x, y, 0), seg=16, smooth=False)
    p.cyl(r - 0.2, r - 0.2, 0.02, 'water', T(x, y, 0.5), seg=16)
    p.torus(r - 0.09, 0.1, 'stone', T(x, y, 0.82), seg=16, seg_minor=4)
    if roof:
        for sx in (-1, 1):
            p.box((0.12, 0.12, 2.2), 'teak', T(x + sx * (r + 0.05), y, 1.1))
        p.cyl(0.08, 0.08, 2 * r + 0.3, 'teak_dark', T(x, y, 1.6) @ R(0, 90, 0), seg=8)
        p.rod((x, y, 1.6), (x, y, 0.9), 0.01, 'rope', seg=3)
        p.cyl(0.13, 0.1, 0.22, 'plank', T(x, y, 0.85), seg=8)
        for s in (-1, 1):
            p.box((2 * r + 0.8, 0.95, 0.12), roof_mat, T(x, y + s * 0.4, 2.45) @ R(s * -30, 0, 0))
    return p


def kiln(p, x, y, r=1.8, mat='brick', chimney=True):
    """A brick kiln for pots or bricks (เตาเผา): a dome with a fire mouth and a short stack."""
    p.cap(r, mat, T(x, y, 0) @ S(1.25, 1.0, 0.85), keep=lambda co: co.z >= -0.01, seg=16, rings=10, smooth=True)
    kit.block(p, x - r * 1.25 - 0.5, y - 0.45, 0.0, x - r * 1.25 + 0.15, y + 0.45, 0.8, 'brick_dark')
    kit.block(p, x - r * 1.25 - 0.52, y - 0.3, 0.05, x - r * 1.25 - 0.4, y + 0.3, 0.55, 'black')
    if chimney:
        props.chimney(p, x + r * 1.1, y, 4.5, 0.4, 0.3, mat, 'brick_dark')
    return p


def water_wheel(p, x, y, r=2.4, width=0.9, facing=0.0, spokes=12):
    """A wooden water wheel (กังหันน้ำ / ระหัด) on its axle between two posts, its foot in the water."""
    m = T(x, y, r * 0.9) @ R(0, 0, facing)
    for s in (-1, 1):
        p.torus(r, 0.08, 'teak', m @ T(0, s * width / 2, 0) @ R(90, 0, 0), seg=24, seg_minor=4, smooth=False)
        p.box((0.25, 0.25, r * 0.9 + 0.4), 'teak_dark', T(x, y, 0) @ R(0, 0, facing) @ T(0, s * (width / 2 + 0.3),
                                                                                         (r * 0.9 + 0.4) / 2))
    p.cyl(0.14, 0.14, width + 0.9, 'teak_dark', m @ R(90, 0, 0), seg=8)
    for i in range(spokes // 2):
        for s in (-1, 1):
            p.box((r * 2 - 0.1, 0.06, 0.08), 'teak', m @ T(0, s * width / 2, 0) @ R(0, i * 360 / spokes, 0))
    for i in range(spokes):
        a = i * 360 / spokes
        # paddles
        c = m @ R(0, a, 0) @ Vector((r, 0, 0))
        p.box((0.06, width, 0.5), 'plank', T(*c) @ R(0, 0, facing) @ R(0, a, 0))
    return p


def ox_cart(p, x, y, facing=0.0):
    """An ox cart (เกวียน) resting on its pole: big spoked wheels and a plank bed, 3.5 m long."""
    m = T(x, y, 0) @ R(0, 0, facing)
    for s in (-1, 1):
        p.torus(0.6, 0.05, 'teak_dark', m @ T(0, s * 0.75, 0.62) @ R(90, 0, 0), seg=16, seg_minor=4, smooth=False)
        p.cyl(0.1, 0.1, 0.2, 'teak_dark', m @ T(0, s * 0.75, 0.62) @ R(90, 0, 0), seg=8)
        for k in range(6):
            p.box((1.15, 0.04, 0.04), 'teak', m @ T(0, s * 0.75, 0.62) @ R(0, k * 30, 0))
    p.cyl(0.05, 0.05, 1.7, 'teak_dark', m @ T(0, 0, 0.62) @ R(90, 0, 0), seg=6)
    p.box((2.2, 1.2, 0.08), 'plank', m @ T(0.0, 0, 0.85))
    for s in (-1, 1):
        p.box((2.2, 0.06, 0.4), 'teak', m @ T(0.0, s * 0.6, 1.05))
    p.rod(m @ Vector((1.1, 0, 0.85)), m @ Vector((2.6, 0, 0.15)), 0.06, 'teak_dark', seg=5)
    p.box((0.1, 0.6, 0.08), 'teak_dark', m @ T(2.4, 0, 0.25))
    p.rod(m @ Vector((-0.9, -0.55, 1.25)), m @ Vector((-0.9, 0.55, 1.25)), 0.03, 'bamboo', seg=4)
    return p


def cloth_line(p, x0, y0, x1, y1, h=1.9, cloths=('silk', 'paint_red', 'cream', 'paint_blue')):
    """Dyed cloth or silk hanging on a line between two posts."""
    for x, y in ((x0, y0), (x1, y1)):
        p.box((0.08, 0.08, h + 0.1), 'bamboo', T(x, y, (h + 0.1) / 2))
    p.rod((x0, y0, h), (x1, y1, h), 0.015, 'rope', seg=3)
    a, b = Vector((x0, y0, h)), Vector((x1, y1, h))
    n = len(cloths)
    ang = math.degrees(math.atan2(y1 - y0, x1 - x0))
    for i, c in enumerate(cloths):
        q = a.lerp(b, (i + 0.5) / n)
        p.box(((b - a).length / n * 0.85, 0.02, 1.1), c, T(q.x, q.y, h - 0.57) @ R(0, 0, ang))
    return p


def stamp_mill(p, x, y, facing=0.0):
    """A foot-driven rice pounder (ครกกระเดื่อง): a lever on a post and a mortar."""
    m = T(x, y, 0) @ R(0, 0, facing)
    for s in (-1, 1):
        p.box((0.12, 0.12, 0.7), 'teak_dark', m @ T(0, s * 0.18, 0.35))
    p.box((3.2, 0.16, 0.16), 'teak', m @ T(0.2, 0, 0.6) @ R(0, -8, 0))
    p.box((0.18, 0.18, 0.6), 'teak_dark', m @ T(1.6, 0, 0.55))
    p.lathe([(0.3, 0), (0.35, 0.35), (0.25, 0.4)], 'stone', m @ T(1.6, 0, 0), seg=10, cap_bottom=True)
    return p


def watch_tower(p, x, y, h=7.0, w=2.4, roof_mat='thatch', region='central', thatch=True, mat='teak'):
    """A timber watch tower: four posts with braces, a platform with a railing and a little roof; a ladder."""
    x0, y0, x1, y1 = x - w / 2, y - w / 2, x + w / 2, y + w / 2
    for xx in (x0, x1):
        for yy in (y0, y1):
            kit.block(p, xx - 0.1, yy - 0.1, 0, xx + 0.1, yy + 0.1, h + 2.2, mat)
    for zz in (h * 0.33, h * 0.66):
        for a, bb in (((x0, y0), (x1, y0)), ((x0, y1), (x1, y1)), ((x0, y0), (x0, y1)), ((x1, y0), (x1, y1))):
            p.rod((a[0], a[1], zz - 1.2), (bb[0], bb[1], zz + 1.0), 0.05, 'teak_dark', seg=4)
    kit.floor_deck(p, (x0 - 0.3, y0 - 0.3, x1 + 0.3, y1 + 0.3), h, 'plank', 0.12, edge='teak_dark')
    kit.railing(p, [(x0 - 0.3, y0 - 0.3), (x1 + 0.3, y0 - 0.3), (x1 + 0.3, y1 + 0.3), (x0 - 0.3, y1 + 0.3)], h,
                'teak_dark', spacing=0.25, closed=True)
    for k in range(int(h / 0.3)):
        p.box((0.5, 0.05, 0.05), 'teak_dark', T(x, y0 - 0.25, 0.3 + k * 0.3))
    for s in (-0.25, 0.25):
        p.rod((x + s, y0 - 0.25, 0), (x + s, y0 - 0.25, h), 0.03, 'teak_dark', seg=4)
    regions.house_roof(p, (x0, y0, x1, y1), h + 2.2, region, roof_mat, axis='x', over=0.5, over_ends=0.4,
                       thatch=thatch, courses=3)
    return p


def drum(p, x, y, z, r=0.5, facing=0.0):
    """A big wooden alarm drum (กลอง) on a frame."""
    m = T(x, y, z) @ R(0, 0, facing)
    p.cyl(r, r, r * 1.6, 'paint_red', m @ R(90, 0, 0), seg=14)
    for s in (-1, 1):
        p.cyl(r + 0.02, r + 0.02, 0.04, 'cream', m @ T(0, s * r * 0.8, 0) @ R(90, 0, 0), seg=14)
        p.box((0.1, 0.1, z + r), 'teak_dark', m @ T(s * (r + 0.1), 0, -(z) / 2 + r / 2))
    return p


def compost_pen(p, x, y, w=2.0, mat='bamboo', fill='dirt_dark'):
    """A bamboo-fenced compost pen with its heap."""
    props.fence(p, [(x - w / 2, y - w / 2), (x + w / 2, y - w / 2), (x + w / 2, y + w / 2), (x - w / 2, y + w / 2)],
                0.9, mat, closed=True, spacing=0.15)
    p.cap(w * 0.42, fill, T(x, y, 0) @ S(1, 1, 0.55), keep=lambda co: co.z >= -0.01, seg=10, rings=6)
    return p


def bricks(p, x, y, n=3, w=1.2):
    for i in range(n):
        kit.block(p, x + i * (w + 0.2), y, 0, x + i * (w + 0.2) + w, y + 0.8, 0.9, 'brick', bevel=0.02)
        for k in range(1, 5):
            kit.block(p, x + i * (w + 0.2) - 0.01, y - 0.01, k * 0.18 - 0.01, x + i * (w + 0.2) + w + 0.01,
                      y + 0.81, k * 0.18 + 0.01, 'brick_dark')
    return p


def pot_rows(p, x, y, cols=4, rows=2, size=0.55):
    """Rows of unfired or fired pots drying (เครื่องปั้นดินเผา)."""
    for i in range(cols):
        for j in range(rows):
            props.water_jar(p, x + i * size * 1.1, y + j * size * 1.1, size, ('clay_pot', 'jar')[(i + j) % 2],
                            lid=False)
    return p


def buffalo_pen(b, x0, y0, x1, y1, n=2):
    p = b.props
    props.fence(p, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], 1.2, 'teak', closed=True, spacing=1.0)
    for i in range(n):
        props.buffalo(p, x0 + 1.5 + i * 2.2, (y0 + y1) / 2 + (i % 2) * 0.6, facing=20 + i * 140, lying=i % 2 == 0)
    p.box((1.6, 0.5, 0.4), 'plank', T(x1 - 1.2, y1 - 0.6, 0.2))
    p.box((1.4, 0.35, 0.05), 'hay', T(x1 - 1.2, y1 - 0.6, 0.42))
    return p
