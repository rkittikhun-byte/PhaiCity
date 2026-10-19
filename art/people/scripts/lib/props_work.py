# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Props of the activity clips (PLAN.md "Activities"): farming, gardening, sport, home."""

import math

from .mesh import R, S, T
from .props import prop


@prop
def hoe(part, e, body):
    """A farm hoe (จอบ): grip at the origin, the long handle along +Z/-Z, the blade at the bottom."""
    L = 1.1
    part.cyl(0.018, 0.018, L, 'wood', T(0, 0, -L * 0.3), seg=6)
    part.box((0.18, 0.02, 0.16), 'metal', T(0, -0.08, -L * 0.8) @ R(-20, 0, 0), bevel=0.004)
    part.cyl(0.025, 0.025, 0.06, 'iron', T(0, -0.02, -L * 0.79) @ R(90, 0, 0), seg=6)


@prop
def watering_can(part, e, body):
    """A watering can held by its handle (บัวรดน้ำ)."""
    c = e.get('color', 'green')
    part.cyl(0.09, 0.08, 0.18, c, T(0, 0, -0.14), seg=12)
    part.torus(0.06, 0.01, c, T(0, 0.0, -0.03) @ R(90, 0, 0), seg=10, seg_minor=3, arc=180)
    part.rod((0, -0.07, -0.18), (0, -0.28, -0.04), 0.014, c, seg=6, r_end=0.01)
    part.cyl(0.035, 0.02, 0.03, c, T(0, -0.29, -0.03) @ R(-60, 0, 0), seg=8)


@prop
def broom(part, e, body):
    """A Thai coconut-rib broom (ไม้กวาดทางมะพร้าว): grip at the origin."""
    part.cyl(0.02, 0.02, 0.7, 'bamboo', T(0, 0, -0.2), seg=6)
    for i in range(12):
        a = math.radians(-30 + i * 5.5)
        part.rod((0, 0, -0.5), (math.sin(a) * 0.35, -0.02, -0.5 - math.cos(a) * 0.45), 0.005, 'straw', seg=3)
    part.torus(0.03, 0.008, 'rope', T(0, 0, -0.52), seg=8, seg_minor=3)


@prop
def takraw_ball(part, e, body):
    """A rattan ball (ลูกตะกร้อ)."""
    part.sphere(0.07, 'straw', None, seg=10, rings=7, smooth=False)
    for a in (0, 60, 120):
        part.torus(0.07, 0.006, 'straw_dark', R(a, 0, 0), seg=10, seg_minor=3)


@prop
def football(part, e, body):
    part.sphere(0.11, 'white', None, seg=10, rings=8, smooth=False)
    for i in range(6):
        a = 2 * math.pi * i / 6
        part.sphere(0.035, 'black', T(math.cos(a) * 0.1, math.sin(a) * 0.1, (i % 2) * 0.04) @ S(1, 1, 0.4), seg=5,
                    rings=3)


@prop
def stool(part, e, body):
    """A low plastic stool, the Thai street stool."""
    c = e.get('color', 'red')
    part.box((0.3, 0.3, 0.03), c, T(0, 0, 0.36), bevel=0.01)
    for x in (-0.12, 0.12):
        for y in (-0.12, 0.12):
            part.cyl(0.02, 0.025, 0.36, c, T(x, y, 0.18), seg=6)


@prop
def fruit_basket(part, e, body):
    """A basket of picked fruit, held at the hip."""
    part.lathe([(0.1, -0.1), (0.14, 0.0), (0.15, 0.02)], 'straw', seg=12, cap_bottom=True)
    for i in range(6):
        a = 2 * math.pi * i / 6
        part.sphere(0.04, e.get('fruit', 'orange'), T(math.cos(a) * 0.07, math.sin(a) * 0.07, 0.03), seg=8, rings=5)
    part.torus(0.13, 0.008, 'straw_dark', T(0, 0, 0.0) @ R(90, 0, 0), seg=10, seg_minor=3, arc=180)
