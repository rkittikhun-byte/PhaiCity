# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 1, the farming village (assets/concept/era1_C_vehicles.jpg): buffalo and ox carts with spoked wooden wheels,
a roadster bicycle with a basket and a rack, and a hand cart pulled between its shafts. (The sheet's boats belong to
the water, not the roads.)"""

import math

from mathutils import Vector

import vlib
from lib import kit
from lib.mesh import Part, R, S, T

from . import registry

VEHICLES, vehicle = registry(1)


def cart_bed(p, y0, y1, w, z, rails=0.55, front_board=True, spindles=7):
    """A cart's bed (กระบะเกวียน): slatted floor on two runners, spindle rails on both sides, high end boards."""
    for s in (-1, 1):
        kit.block(p, s * w / 2 - 0.06, y0 - 0.1, z - 0.16, s * w / 2 + 0.06, y1 + 0.15, z - 0.02, 'teak_dark')
    n = int((y1 - y0) / 0.24)
    for i in range(n):
        y = y0 + (i + 0.5) * (y1 - y0) / n
        p.box((w + 0.1, (y1 - y0) / n - 0.03, 0.05), 'plank', T(0, y, z + 0.01))
    for s in (-1, 1):
        x = s * (w / 2 + 0.02)
        p.box((0.07, y1 - y0 + 0.1, 0.07), 'teak', T(x, (y0 + y1) / 2, z + rails))
        p.box((0.06, y1 - y0, 0.05), 'teak', T(x, (y0 + y1) / 2, z + 0.12))
        for k in range(spindles):
            y = y0 + 0.05 + k * (y1 - y0 - 0.1) / (spindles - 1)
            p.cyl(0.028, 0.028, rails - 0.06, 'teak_light' if k % 2 else 'teak', T(x, y, z + rails / 2 + 0.02), seg=5)
    for y, h in ((y0, rails + 0.35 if front_board else rails), (y1, rails + 0.15)):
        for s in (-1, 1):
            p.box((0.08, 0.08, h + 0.1), 'teak_dark', T(s * (w / 2 + 0.02), y, z + h / 2))
        p.box((w + 0.04, 0.06, 0.08), 'teak', T(0, y, z + h))
        for k in range(3):
            p.box((0.05, 0.05, h - 0.1), 'teak', T((k - 1) * w * 0.28, y, z + h / 2))
    return p


def draught_cart(v, kind):
    big = kind == 'buffalo'
    p = v.body
    w, wr = (1.25, 0.8) if big else (1.05, 0.66)
    y0, y1 = (0.15, 3.15) if big else (0.2, 2.6)
    z = wr + 0.22
    ay = y0 + (y1 - y0) * 0.55
    off = -0.25 if big else -0.15
    yy = lambda y: y + off  # noqa: E731  (the whole rig shifted so its footprint is centred)
    cart_bed(p, yy(y0), yy(y1), w, z, rails=0.6 if big else 0.5)
    # axle and its blocks
    p.cyl(0.07, 0.07, w + 0.5, 'teak_dark', T(0, yy(ay), wr) @ R(0, 90, 0), seg=6)
    for s in (-1, 1):
        p.box((0.14, 0.3, z - wr), 'teak_dark', T(s * w * 0.35, yy(ay), (wr + z) / 2 - 0.06))
    # the pole from under the bed to the yoke on the animal's neck
    shoulder = -2.05 if big else -1.75
    neck_z = (1.38 if big else 1.3) - 0.2
    p.rod((0, yy(y0) + 0.8, z - 0.12), (0, yy(shoulder) - 0.12, neck_z), 0.06, 'teak_dark', seg=6)
    vlib.yoke(p, yy(shoulder) - 0.1, neck_z + 0.08, w=1.0 if big else 0.9)
    vlib.animal(v, yy(shoulder), 'buffalo' if big else 'ox')
    # the rope from the animal's nose to the driver's hands
    p.polyline([Vector((0, yy(shoulder) - 0.9, neck_z - 0.15)), Vector((0.05, yy(y0) - 0.6, z + 0.25)),
                Vector((0.1, yy(y0) + 0.05, z + 0.55))], 0.01, 'rope', seg=3, joints=False)
    # the driver on the front of the bed, legs over the front board, a straw hat
    vlib.figure(p, (0.0, yy(y0) + 0.3, z + 0.12), [(-0.12, yy(y0) - 0.05, z + 0.55), (0.14, yy(y0) + 0.0, z + 0.58)],
                [(-0.14, yy(y0) - 0.3, z - 0.2), (0.14, yy(y0) - 0.35, z - 0.15)], shirt='v_mohom',
                pants='v_mohom', head='hat', lean=10)
    # the load: rice in sacks (buffalo) or a rack of hay and jars (ox)
    if big:
        vlib.sacks(p, -0.05, yy(y0) + 1.1, z + 0.02, n=6, size=0.45)
        p.cyl(0.25, 0.22, 0.5, 'jar', T(0.35, yy(y1) - 0.35, z + 0.27), seg=8)
        p.box((0.9, 0.5, 0.3), 'bamboo', T(-0.2, yy(y1) - 0.35, z + 0.17))
    else:
        p.box((0.85, 1.2, 0.45), 'hay', T(0, yy(y0) + 1.25, z + 0.25), bevel=0.12)
        for k in range(3):
            p.box((0.9, 0.05, 0.05), 'rope', T(0, yy(y0) + 0.8 + k * 0.45, z + 0.5))
        p.cyl(0.2, 0.17, 0.42, 'clay_pot', T(0.25, yy(y1) - 0.3, z + 0.22), seg=8)
    v.wheel(vlib.cart_wheel(wr, 0.12, 12 if big else 10), wr, [(s * (w / 2 + 0.3), yy(ay), wr) for s in (-1, 1)])


@vehicle('buffalo_cart', 'เกวียนควาย', 'Buffalo cart', cls='cart', slow=0.3)
def buffalo_cart(v):
    draught_cart(v, 'buffalo')


@vehicle('ox_cart', 'เกวียนวัว', 'Ox cart', cls='cart', slow=0.35)
def ox_cart(v):
    draught_cart(v, 'ox')


def bicycle_frame(p, paint, wb=1.1, wr=0.34, basket=True, rack=True):
    """A roadster (จักรยานโบราณ) facing -Y: its wheels' axles at y = -wb/2 and +wb/2."""
    fy, ry = -wb / 2, wb / 2
    bb = Vector((0, 0.06, 0.3))
    seat = Vector((0, 0.3, 0.86))
    head_t, head_b = Vector((0, fy + 0.15, 0.95)), Vector((0, fy + 0.11, 0.74))
    for a, b in ((bb, seat), (seat, head_t), (bb, head_b), (head_t, head_b)):
        p.rod(a, b, 0.019, paint, seg=6)
    for s in (-1, 1):
        axle = Vector((s * 0.05, ry, wr))
        p.rod(bb + Vector((s * 0.04, 0, 0)), axle, 0.012, paint, seg=5)
        p.rod(seat + Vector((s * 0.03, 0, -0.04)), axle, 0.012, paint, seg=5)
        p.rod(head_b + Vector((s * 0.03, 0, 0)), Vector((s * 0.05, fy, wr)), 0.014, paint, seg=5)
    # mudguards
    for y in (fy, ry):
        pts = []
        for k in range(7):
            a = math.radians(30 + k * 20) if y == ry else math.radians(10 + k * 20)
            pts.append(Vector((0, y + math.cos(a) * (wr + 0.04) * (1 if y == ry else -1), wr + math.sin(a) * (wr + 0.04))))
        p.polyline(pts, 0.03, paint, seg=4, joints=False)
    # handlebar swept back, grips, a bell and the lamp
    stem = head_t + Vector((0, 0, 0.1))
    p.rod(head_t, stem, 0.015, 'v_chrome', seg=5)
    for s in (-1, 1):
        p.polyline([stem, stem + Vector((s * 0.18, 0.02, 0.0)), stem + Vector((s * 0.28, 0.14, 0.02))], 0.012,
                   'v_chrome', seg=4, joints=False)
        p.rod(stem + Vector((s * 0.26, 0.12, 0.02)), stem + Vector((s * 0.3, 0.2, 0.02)), 0.018, 'v_rubber', seg=5)
    p.cyl(0.04, 0.04, 0.06, 'lamp', T(0, fy + 0.04, 0.88) @ R(90, 0, 0), seg=8)
    # saddle with springs, chain ring, chain and pedals
    p.box((0.16, 0.26, 0.06), 'v_seat', T(0, 0.31, 0.92), bevel=0.02)
    for s in (-1, 1):
        p.cyl(0.02, 0.02, 0.06, 'v_chrome', T(s * 0.05, 0.38, 0.87), seg=5)
    for s in (-1, 1):
        p.box((0.01, wb / 2 - 0.05, 0.015), 'v_trim', T(0.07, (bb.y + ry) / 2, wr + s * 0.05 - 0.02))
    if basket:
        c = Vector((0, fy - 0.06, 0.98))
        p.box((0.34, 0.26, 0.02), 'v_chrome', T(c.x, c.y, c.z - 0.12))
        for k in range(5):
            z = c.z - 0.12 + k * 0.06
            for (sx, sy, lx, ly) in ((0, -0.13, 0.34, 0.01), (0, 0.13, 0.34, 0.01), (-0.17, 0, 0.01, 0.26),
                                     (0.17, 0, 0.01, 0.26)):
                p.box((lx, ly, 0.008), 'v_chrome', T(c.x + sx, c.y + sy, z))
        for sx in (-0.17, -0.06, 0.06, 0.17):
            for sy in (-0.13, 0.13):
                p.box((0.008, 0.008, 0.25), 'v_chrome', T(sx, c.y + sy, c.z - 0.0))
    if rack:
        for s in (-1, 1):
            p.rod(Vector((s * 0.1, ry - 0.3, 0.86)), Vector((s * 0.06, ry, wr)), 0.008, 'v_chrome', seg=3)
        for k in range(4):
            p.box((0.2, 0.012, 0.012), 'v_chrome', T(0, ry - 0.3 + k * 0.12, 0.86))
        for s in (-1, 1):
            p.box((0.012, 0.42, 0.012), 'v_chrome', T(s * 0.1, ry - 0.12, 0.86))
    return p


def crank_part(p_name='crank'):
    """A bicycle's chain ring, cranks and pedals, round the bottom bracket (the origin), axle along X."""
    c = Part(p_name)
    c.cyl(0.1, 0.1, 0.02, 'v_chrome', T(0.06, 0, 0) @ R(0, 90, 0), seg=12)
    for s in (-1, 1):
        crank = Vector((s * 0.1, s * 0.12, -s * 0.08))
        c.rod(Vector((s * 0.08, 0, 0)), crank, 0.012, 'v_chrome', seg=4)
        c.box((0.1, 0.06, 0.025), 'v_rubber', T(crank.x + s * 0.05, crank.y, crank.z))
    return c


# A crank turns once for 2.4 turns of the wheel (a roadster's gear): its radius for the turning is the wheel's x 2.4
GEAR = 2.4


@vehicle('bicycle', 'จักรยาน', 'Bicycle', cls='small', paints=('v_navy', 'v_maroon', 'v_green_dark', 'iron'), slow=0.45)
def bicycle(v):
    p = v.body
    bicycle_frame(p, 'v_navy')
    # a villager riding and pedalling, a straw hat, a bunch of bananas in the basket
    vlib.figure(p, (0, 0.31, 0.99), [(-0.27, -0.27, 1.07), (0.27, -0.27, 1.07)],
                [(-0.14, 0.18, 0.24), (0.14, -0.06, 0.4)], shirt='v_mohom', pants='v_pants', head='hat', lean=22,
                pedal=(v, 0.34 * GEAR))
    v.wheel(crank_part(), 0.34 * GEAR, [(0, 0.06, 0.3)])
    for k in range(3):
        p.cyl(0.03, 0.025, 0.2, 'banana_fruit', T(-0.06 + k * 0.06, -0.61, 1.0) @ R(15, 0, k * 10), seg=5)
    v.wheel(vlib.spoke_wheel(0.34, 0.04, 12), 0.34, [(0, -0.55, 0.34), (0, 0.55, 0.34)])


@vehicle('hand_cart', 'รถเข็นของ', 'Hand cart', cls='cart', slow=0.3)
def hand_cart(v):
    p = v.body
    wr, z, w = 0.45, 0.62, 0.95
    y0, y1 = -0.15, 1.35
    # bed on two side beams that run on forward into the shafts
    for s in (-1, 1):
        p.polyline([Vector((s * w / 2, y1, z)), Vector((s * w / 2, y0, z)), Vector((s * 0.36, -1.15, 0.9))], 0.035,
                   'teak_dark', seg=5, joints=False)
    n = 6
    for i in range(n):
        p.box((w, (y1 - y0) / n - 0.03, 0.04), 'plank', T(0, y0 + (i + 0.5) * (y1 - y0) / n, z + 0.03))
    for s in (-1, 1):
        p.box((0.04, y1 - y0, 0.22), 'teak', T(s * w / 2, (y0 + y1) / 2, z + 0.16))
    p.box((w, 0.04, 0.3), 'teak', T(0, y1, z + 0.18))
    # a prop leg, the axle
    p.cyl(0.035, 0.035, w + 0.2, 'teak_dark', T(0, 0.75, wr) @ R(0, 90, 0), seg=6)
    p.rod((0, y1 - 0.1, z), (0, y1 + 0.05, 0.12), 0.03, 'teak_dark', seg=4)
    # the load: jars, a basket of fruit, a sack
    p.cyl(0.2, 0.17, 0.4, 'jar', T(-0.22, 0.95, z + 0.25), seg=8)
    p.cyl(0.08, 0.1, 0.06, 'jar_glaze', T(-0.22, 0.95, z + 0.48), seg=8)
    p.cyl(0.24, 0.2, 0.22, 'bamboo', T(0.2, 0.25, z + 0.16), seg=10)
    for k in range(5):
        p.sphere(0.07, 'rambutan' if k % 2 else 'banana_fruit', T(0.1 + (k % 3) * 0.09, 0.2 + (k // 3) * 0.12, z + 0.3),
                 seg=6, rings=4)
    vlib.sacks(p, 0.2, 0.85, z + 0.02, n=2, size=0.36)
    # the man between the shafts, pulling, walking
    vlib.walker(p, (0, -1.35, 0), 0.0, hands_z=0.9, shirt='v_shirt', pants='v_mohom', head='hat', v=v)
    v.wheel(vlib.cart_wheel(wr, 0.08, 10), wr, [(s * (w / 2 + 0.12), 0.75, wr) for s in (-1, 1)])
