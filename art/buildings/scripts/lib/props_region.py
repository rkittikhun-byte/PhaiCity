# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The things that tell the regions apart on the concept sheets (assets/concept/region_*): bamboo and lotus pots
(central), Bo Sang umbrellas, orchids and water pots on stands (north), the loom, sticky rice baskets and big jars
(northeast), durian and rambutan trees and fruit baskets (east), rubber trees, latex cups and rubber sheet racks
(south), bamboo rafts and hanging orchids (west). True sizes."""

import math

from mathutils import Vector

from . import kit, props
from .mesh import R, S, T


def bamboo_clump(p, x, y, h=7.0, n=7, seed=11):
    """A clump of bamboo (กอไผ่): green culms with nodes and leaf sprays, 6-8 m."""
    rnd = props._rng(seed)
    for i in range(n):
        a = rnd() * math.tau
        d = 0.15 + rnd() * 0.45
        lean = 4 + rnd() * 10
        base = Vector((x + math.cos(a) * d, y + math.sin(a) * d, 0))
        hh = h * (0.75 + rnd() * 0.3)
        top = base + Vector((math.cos(a) * math.sin(math.radians(lean)) * hh,
                             math.sin(a) * math.sin(math.radians(lean)) * hh, hh))
        p.rod(base, top, 0.045, 'leaf_dark' if i % 2 else 'leaf', seg=5, r_end=0.025)
        for k in range(3, 8):
            q = base.lerp(top, k / 8)
            ang = math.degrees(a) + rnd() * 120 - 60
            props.leaf_blade(p, q, ang, -25 - rnd() * 25, 0.9, 0.16, ('leaf', 'leaf_light', 'leaf_dark')[k % 3])
    return p


def lotus_pot(p, x, y, z=0.0, r=0.42):
    """A glazed basin with lotus leaves and a pink flower (อ่างบัว)."""
    p.lathe([(r * 0.6, 0), (r, r * 0.6), (r * 1.02, r * 0.75), (r * 0.95, r * 0.78)], 'paint_blue', T(x, y, z),
            seg=14, cap_bottom=True, smooth=True)
    p.torus(r * 0.82, 0.02, 'paint_white', T(x, y, z + r * 0.45), seg=14, seg_minor=4)
    p.cyl(r * 0.92, r * 0.92, 0.02, 'water', T(x, y, z + r * 0.7), seg=14)
    for i in range(3):
        a = i * 2.1
        p.cyl(0.14, 0.14, 0.015, 'leaf', T(x + math.cos(a) * r * 0.45, y + math.sin(a) * r * 0.45, z + r * 0.73), seg=8)
    p.rod((x, y, z + r * 0.7), (x, y, z + r * 1.3), 0.012, 'leaf_dark', seg=4)
    p.sphere(0.09, 'lotus', T(x, y, z + r * 1.35) @ S(1, 1, 1.3), seg=8, rings=5)
    return p


def orchid_hanging(p, x, y, z):
    """A hanging basket of orchids (กล้วยไม้) from an eave or a post, z is the hook."""
    p.rod((x, y, z), (x, y, z - 0.5), 0.008, 'rope', seg=3)
    p.cyl(0.14, 0.11, 0.14, 'teak', T(x, y, z - 0.57), seg=8)
    for i in range(4):
        a = i * 90 + 30
        props.leaf_blade(p, (x, y, z - 0.5), a, 50, 0.3, 0.08, 'leaf')
    for i in range(5):
        a = i * 1.3
        p.sphere(0.05, 'orchid', T(x + math.cos(a) * 0.12, y + math.sin(a) * 0.12, z - 0.42 + (i % 2) * 0.08),
                 seg=6, rings=3)
    return p


def orchid_pot(p, x, y, z=0.0):
    props.potted(p, x, y, z, 0.38, 'leafy', seed=int(x * 13 + y * 7) % 97)
    for i in range(5):
        a = i * 1.25
        p.sphere(0.055, 'orchid', T(x + math.cos(a) * 0.14, y + math.sin(a) * 0.14, z + 0.62 + (i % 2) * 0.06),
                 seg=6, rings=3)
    return p


def umbrella_rack(p, x, y, facing=0.0):
    """Bo Sang paper umbrellas drying on a bamboo frame (ร่มบ่อสร้าง), north."""
    m = T(x, y, 0) @ R(0, 0, facing)
    for sx in (-1.0, 1.0):
        p.rod(m @ Vector((sx, 0.0, 0.0)), m @ Vector((sx, 0.0, 1.5)), 0.03, 'bamboo', seg=5)
        p.rod(m @ Vector((sx, 0.0, 1.5)), m @ Vector((sx, -0.5, 0.0)), 0.025, 'bamboo', seg=5)
    p.rod(m @ Vector((-1.05, 0, 1.4)), m @ Vector((1.05, 0, 1.4)), 0.03, 'bamboo', seg=5)
    for i, mat in enumerate(('umbrella_red', 'umbrella_blue', 'umbrella_yellow')):
        c = m @ Vector((-0.65 + i * 0.65, -0.15, 0.85))
        disc = T(*c) @ R(0, 0, facing) @ R(80, 0, 0)
        p.cyl(0.42, 0.42, 0.03, mat, disc, seg=16, smooth=False)
        p.cyl(0.05, 0.05, 0.05, 'teak_dark', disc @ T(0, 0, 0.03), seg=6)
        for k in range(8):
            a = k * math.tau / 8
            p.rod(disc @ Vector((0, 0, 0.02)), disc @ Vector((math.cos(a) * 0.4, math.sin(a) * 0.4, 0.02)), 0.006,
                  'bamboo_dark', seg=3)
    return p


def jar_on_stand(p, x, y):
    """A clay water pot on a wooden stand with a dipper (หม้อน้ำ), north."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((0.05, 0.05, 0.6), 'teak', T(x + sx * 0.2, y + sy * 0.2, 0.3))
    p.box((0.5, 0.5, 0.04), 'teak', T(x, y, 0.6))
    p.lathe([(0.12, 0), (0.26, 0.15), (0.27, 0.28), (0.15, 0.45), (0.1, 0.5), (0.12, 0.55)], 'clay_pot',
            T(x, y, 0.62), seg=12, cap_bottom=True)
    p.cyl(0.11, 0.11, 0.03, 'teak_dark', T(x, y, 1.18), seg=10)
    p.rod((x + 0.05, y, 1.2), (x + 0.3, y - 0.1, 1.25), 0.012, 'bamboo', seg=4)
    return p


def loom(p, x, y, facing=0.0):
    """A floor loom (กี่ทอผ้า) with silk on it, under an Isan house."""
    m = T(x, y, 0) @ R(0, 0, facing)
    for sx in (-0.8, 0.8):
        for sy in (-0.7, 0.7):
            p.box((0.07, 0.07, 1.6), 'teak', m @ T(sx, sy, 0.8))
    for z in (1.55, 0.5):
        for sy in (-0.7, 0.7):
            p.box((1.7, 0.06, 0.06), 'teak', m @ T(0, sy, z))
    p.box((1.3, 1.2, 0.02), 'silk', m @ T(0, 0, 0.75) @ R(-8, 0, 0))
    p.box((1.3, 0.1, 0.1), 'teak_dark', m @ T(0, 0.55, 0.85))
    p.box((1.3, 0.06, 0.5), 'cream', m @ T(0, -0.2, 1.05))
    p.box((0.9, 0.35, 0.05), 'teak', m @ T(0, 1.0, 0.45))
    for sx in (-0.4, 0.4):
        p.box((0.05, 0.3, 0.45), 'teak', m @ T(sx, 1.0, 0.22))
    return p


def rice_baskets(p, x, y, n=3):
    """Sticky rice baskets (กระติ๊บข้าวเหนียว) on a low table."""
    p.box((1.1, 0.6, 0.05), 'teak', T(x, y, 0.55))
    for sx in (-0.5, 0.5):
        for sy in (-0.25, 0.25):
            p.box((0.05, 0.05, 0.55), 'teak', T(x + sx, y + sy, 0.27))
    for i in range(n):
        lx = x - 0.35 + i * 0.35
        p.cyl(0.11, 0.11, 0.22, 'bamboo', T(lx, y, 0.69), seg=10)
        p.cyl(0.115, 0.115, 0.05, 'bamboo_dark', T(lx, y, 0.82), seg=10)
    return p


def big_jars(p, x, y, n=2):
    """Big clay jars (ไห, โอ่ง) for water and fermented fish, Isan."""
    for i in range(n):
        props.water_jar(p, x + i * 0.95, y + (i % 2) * 0.3, 1.05, 'clay_pot', lid=False)
        p.torus(0.33, 0.02, 'jar_glaze', T(x + i * 0.95, y + (i % 2) * 0.3, 0.7), seg=12, seg_minor=4)
    return p


def fruit_tree(p, x, y, fruit='durian', h=6.5, r=2.4, seed=21):
    """A durian or rambutan tree with its fruit hanging in the crown (east)."""
    props.tree(p, x, y, h, r, seed)
    rnd = props._rng(seed + 5)
    for i in range(10 if fruit == 'rambutan' else 6):
        a = rnd() * math.tau
        d = r * (0.6 + rnd() * 0.45)
        z = h * (0.45 + rnd() * 0.35)
        q = (x + math.cos(a) * d, y + math.sin(a) * d, z)
        if fruit == 'durian':
            p.sphere(0.2, 'durian', T(*q) @ S(1, 1, 1.25), seg=7, rings=5, smooth=False)
        else:
            for k in range(3):
                p.sphere(0.06, 'rambutan', T(q[0] + k * 0.08, q[1], q[2] - k * 0.05), seg=6, rings=3)
    return p


def fruit_baskets(p, x, y, n=3, fruit=('durian', 'rambutan', 'banana_fruit')):
    for i in range(n):
        bx = x + i * 0.7
        p.lathe([(0.2, 0), (0.28, 0.3), (0.3, 0.32)], 'straw', T(bx, y, 0), seg=10, cap_bottom=True)
        f = fruit[i % len(fruit)]
        for k in range(3):
            a = k * 2.1
            p.sphere(0.12 if f == 'durian' else 0.07, f, T(bx + math.cos(a) * 0.1, y + math.sin(a) * 0.1, 0.36),
                     seg=6, rings=4, smooth=f != 'durian')
    return p


def rubber_tree(p, x, y, h=7.0, seed=31):
    """A rubber tree (ยางพารา) with its tapping cut and latex cup, south."""
    props.tree(p, x, y, h, 1.8, seed, ('leaf', 'leaf_dark'))
    for k in range(3):
        p.torus(0.2, 0.012, 'teak_dark', T(x, y, 1.0 + k * 0.08) @ R(8, 0, 0), seg=10, seg_minor=3)
    p.cyl(0.07, 0.05, 0.08, 'iron', T(x + 0.2, y - 0.08, 0.85), seg=8)
    p.cyl(0.06, 0.06, 0.01, 'latex', T(x + 0.2, y - 0.08, 0.88), seg=8)
    return p


def rubber_rack(p, x, y, facing=0.0, sheets=4):
    """Rubber sheets drying on a pole rack (ราวตากยางแผ่น), south."""
    m = T(x, y, 0) @ R(0, 0, facing)
    for sx in (-1.2, 1.2):
        p.box((0.07, 0.07, 1.9), 'teak', m @ T(sx, 0, 0.95))
        p.box((0.07, 0.07, 1.9), 'teak', m @ T(sx, 0.6, 0.95))
    for sy in (0.0, 0.6):
        p.box((2.5, 0.05, 0.05), 'teak', m @ T(0, sy, 1.85))
    for i in range(sheets):
        lx = -0.9 + i * 0.6
        for sy in (0.0, 0.6):
            p.box((0.45, 0.02, 0.9), 'latex', m @ T(lx, sy, 1.4))
    return p


def raft(p, x0, y0, x1, y1, z=0.0):
    """A bamboo raft (แพ) under a floating house, west: big culms side by side, lashed across."""
    n = max(3, int((x1 - x0) / 0.32))
    for i in range(n):
        x = x0 + (x1 - x0) * (i + 0.5) / n
        p.cyl(0.16, 0.16, y1 - y0, 'bamboo' if i % 3 else 'bamboo_dark', T(x, (y0 + y1) / 2, z) @ R(90, 0, 0), seg=8)
    for y in (y0 + 0.4, (y0 + y1) / 2, y1 - 0.4):
        p.box((x1 - x0 + 0.2, 0.12, 0.08), 'rope', T((x0 + x1) / 2, y, z + 0.17))
    return p


def boat(p, x, y, length=4.5, facing=0.0, mat='teak'):
    """A small wooden rowing boat (เรือพาย) with a paddle."""
    m = T(x, y, 0.05) @ R(0, 0, facing)
    w = length * 0.22
    pts = [(-length / 2, 0), (-length * 0.3, -w / 2), (length * 0.3, -w / 2), (length / 2, 0),
           (length * 0.3, w / 2), (-length * 0.3, w / 2)]
    p.poly_prism(pts, 0.35, mat, m @ T(0, 0, 0.17))
    p.poly_prism([(x_ * 0.9, y_ * 0.8) for x_, y_ in pts], 0.05, 'teak_dark', m @ T(0, 0, 0.33))
    for k in (-0.6, 0.0, 0.6):
        p.box((0.12, w * 0.85, 0.04), 'teak_light', m @ T(k * length * 0.4, 0, 0.3))
    p.rod(m @ Vector((-0.3, -0.2, 0.4)), m @ Vector((1.2, 0.5, 0.35)), 0.025, 'teak_light', seg=4)
    p.box((0.35, 0.14, 0.02), 'teak_light', m @ T(1.3, 0.55, 0.35) @ R(0, 0, 25))
    return p


def jetty(p, x0, y0, x1, y1, z=0.6, mat='teak'):
    """A small plank landing on posts (ท่าน้ำ)."""
    kit.block(p, x0, y0, z - 0.08, x1, y1, z, mat)
    n = max(2, int((x1 - x0) / 0.25))
    for i in range(1, n):
        x = x0 + (x1 - x0) * i / n
        kit.block(p, x - 0.01, y0, z, x + 0.01, y1, z + 0.01, 'teak_dark')
    for x in (x0 + 0.1, x1 - 0.1):
        for y in (y0 + 0.1, y1 - 0.1):
            p.cyl(0.09, 0.09, z + 0.9, 'teak_dark', T(x, y, (z + 0.9) / 2 - 0.3), seg=8)
    return p


def water_pond(p, x0, y0, x1, y1):
    """Open water inside a yard (a canal edge, a pond): a sunken blue sheet with a bank."""
    kit.block(p, x0 - 0.3, y0 - 0.3, 0.0, x1 + 0.3, y1 + 0.3, 0.06, 'grass_dark')
    kit.block(p, x0, y0, 0.0, x1, y1, 0.09, 'water')
    return p


def hanging_pot(p, x, y, z):
    return orchid_hanging(p, x, y, z)
