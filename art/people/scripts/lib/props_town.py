# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Props of the town eras (2-5): shop, post, railway, factory, office, delivery, the future."""

import math

from mathutils import Matrix, Vector

from .mesh import R, S, T
from .props import prop


@prop
def abacus(part, e, body):
    """A wooden abacus (ลูกคิด) held flat against the chest."""
    w, h = 0.24, 0.17
    part.box((w, 0.02, 0.022), 'wood_dark', T(0, 0, h / 2), bevel=0.004)
    part.box((w, 0.02, 0.022), 'wood_dark', T(0, 0, -h / 2), bevel=0.004)
    for x in (-w / 2, w / 2):
        part.box((0.022, 0.022, h + 0.02), 'wood_dark', T(x, 0, 0), bevel=0.004)
    part.box((w, 0.016, 0.012), 'wood_dark', T(0, 0, h * 0.22))
    for i in range(7):
        x = -w / 2 + 0.03 + i * (w - 0.06) / 6
        part.rod((x, 0, -h / 2), (x, 0, h / 2), 0.003, 'metal', seg=3)
        part.sphere(0.013, 'wood', T(x, 0, h * 0.34) @ S(1, 1, 0.7), seg=6, rings=4)
        for j in range(3):
            part.sphere(0.013, 'wood', T(x, 0, -h * 0.4 + j * 0.03 + (0.02 if i % 2 else 0)) @ S(1, 1, 0.7), seg=6,
                        rings=4)


@prop
def sack(part, e, body):
    """A full rice sack (กระสอบ) carried on the shoulder, tied at one end."""
    c = e.get('color', 'cream')
    part.sphere(0.2, c, S(1.45, 0.75, 0.75), seg=10, rings=7)
    part.cyl(0.05, 0.03, 0.08, c, T(0.31, 0, 0.02) @ R(0, 90, 0), seg=8)
    part.torus(0.04, 0.01, 'rope', T(0.27, 0, 0.02) @ R(0, 90, 0), seg=8, seg_minor=3)


@prop
def lantern(part, e, body):
    """A railway hand lamp with a red lens, hanging from the hand."""
    part.torus(0.04, 0.007, 'iron', T(0, 0, -0.02) @ R(90, 0, 0), seg=10, seg_minor=3, arc=180)
    part.box((0.1, 0.1, 0.14), 'iron', T(0, 0, -0.13), bevel=0.01)
    part.cyl(0.035, 0.035, 0.03, 'red_light', T(0, -0.055, -0.13) @ R(90, 0, 0), seg=10)
    part.cyl(0.05, 0.03, 0.03, 'iron', T(0, 0, -0.045), seg=8)


@prop
def book(part, e, body):
    part.box((0.03, 0.15, 0.2), e.get('color', 'blue'), T(0, 0, 0), bevel=0.004)
    part.box((0.026, 0.142, 0.19), 'paper', T(0.004, 0.004, 0))


def wheel(part, m, r=0.3, tyre=0.018, spokes=8, mat='rubber'):
    """A spoked wheel in the YZ plane (its axle along X)."""
    part.torus(r, tyre, mat, m @ R(0, 90, 0), seg=18, seg_minor=5)
    part.torus(r - tyre * 1.4, tyre * 0.5, 'metal', m @ R(0, 90, 0), seg=18, seg_minor=3)
    part.cyl(0.03, 0.03, 0.06, 'metal', m @ R(0, 90, 0), seg=8)
    for i in range(spokes):
        a = 2 * math.pi * i / spokes
        part.rod(tuple(m @ Vector((0, 0, 0))),
                 tuple(m @ Vector((0, math.cos(a) * (r - tyre), math.sin(a) * (r - tyre)))), 0.004, 'metal', seg=3)


def bicycle_front(part, m, frame='iron', r=0.3):
    """The front half of a bicycle along -Y: wheel, fork, bars, top tube to the saddle near the origin."""
    def W(*p):
        return tuple(m @ Vector(p))
    wheel(part, m @ T(0, -0.75, r), r)
    part.polyline([W(0, -0.75, r), W(0, -0.68, 0.72), W(0, -0.66, 0.92)], 0.016, frame, seg=5)
    part.rod(W(-0.24, -0.66, 0.94), W(0.24, -0.66, 0.94), 0.014, frame, seg=5)
    for x in (-0.24, 0.24):
        part.cyl(0.02, 0.02, 0.09, 'rubber', m @ T(x, -0.66, 0.94) @ R(0, 90, 0), seg=6)
    part.polyline([W(0, -0.68, 0.72), W(0, -0.08, 0.7), W(0, -0.05, 0.8)], 0.017, frame, seg=5)
    part.polyline([W(0, -0.62, 0.62), W(0, -0.12, 0.3), W(0, -0.08, 0.7)], 0.017, frame, seg=5)
    part.box((0.1, 0.2, 0.04), 'leather', m @ T(0, -0.04, 0.83), bevel=0.012)
    part.cyl(0.05, 0.05, 0.02, 'iron', m @ T(0, -0.12, 0.3) @ R(0, 90, 0), seg=10)
    for side in (-1, 1):
        part.box((0.06, 0.1, 0.015), 'iron', m @ T(side * 0.07, -0.12 + side * 0.05, 0.3 - side * 0.1))


@prop
def bicycle(part, e, body):
    """A plain bicycle along -Y, its saddle near the origin (for the bike clip and parked)."""
    m = Matrix.Identity(4)
    c = e.get('color', 'teal')
    bicycle_front(part, m, frame=c)
    wheel(part, T(0, 0.38, 0.3), 0.3)
    part.polyline([(0, -0.12, 0.3), (0, 0.38, 0.3), (0, -0.06, 0.74)], 0.015, c, seg=5)
    if e.get('basket'):
        part.lathe([(0.1, 0), (0.13, 0.12)], 'straw', T(0, -0.85, 0.85), seg=10, cap_bottom=True)


@prop
def samlor(part, e, body):
    """A pedal rickshaw (สามล้อถีบ): a bicycle in front, a canopied seat for two between two rear wheels."""
    bicycle_front(part, Matrix.Identity(4))
    r = 0.3
    for side in (-1, 1):
        wheel(part, T(side * 0.42, 0.45, r), r)
    part.rod((-0.42, 0.45, r), (0.42, 0.45, r), 0.016, 'iron', seg=5)
    part.polyline([(0, -0.08, 0.7), (0, 0.15, 0.48), (0, 0.45, r)], 0.018, 'iron', seg=5)
    part.box((0.78, 0.5, 0.06), 'red', T(0, 0.45, 0.5), bevel=0.015)
    part.box((0.7, 0.42, 0.08), 'tan', T(0, 0.45, 0.56), bevel=0.02)
    part.box((0.74, 0.08, 0.4), 'red', T(0, 0.7, 0.72), bevel=0.015)
    part.box((0.68, 0.06, 0.32), 'tan', T(0, 0.66, 0.74), bevel=0.015)
    for side in (-1, 1):
        part.box((0.04, 0.5, 0.18), 'red', T(side * 0.39, 0.45, 0.62), bevel=0.01)
    part.box((0.5, 0.25, 0.03), 'iron', T(0, 0.1, 0.32), bevel=0.006)
    # Folding hood over the seat.
    for i in range(6):
        a0, a1 = math.radians(i * 18), math.radians((i + 1) * 18)
        y0, z0 = 0.72 - 0.45 * math.sin(a0), 0.9 + 0.38 * math.cos(a0)
        y1, z1 = 0.72 - 0.45 * math.sin(a1), 0.9 + 0.38 * math.cos(a1)
        L = math.hypot(y1 - y0, z1 - z0)
        ang = math.degrees(math.atan2(z1 - z0, y1 - y0))
        part.box((0.84, L + 0.012, 0.02), e.get('hood', 'olive'), T(0, (y0 + y1) / 2, (z0 + z1) / 2) @ R(ang, 0, 0))
    for side in (-1, 1):
        part.rod((side * 0.41, 0.72, 0.72), (side * 0.41, 0.36, 1.18), 0.01, 'metal', seg=4)
        part.rod((side * 0.41, 0.72, 0.72), (side * 0.41, 0.62, 1.26), 0.01, 'metal', seg=4)


# era 3: factories and the first city jobs ------------------------------------------------------------------------

@prop
def tiffin(part, e, body):
    """A stacked food carrier (ปิ่นโต) hanging from the hand."""
    c = e.get('color', 'steel')
    for i in range(3):
        part.cyl(0.06, 0.06, 0.05, c, T(0, 0, -0.17 + i * 0.052), seg=12)
        part.lathe([(0.062, -0.145 + i * 0.052), (0.062, -0.14 + i * 0.052)], 'metal', seg=12)
    part.cyl(0.05, 0.02, 0.025, c, T(0, 0, -0.03), seg=10)
    for side in (-1, 1):
        part.rod((side * 0.065, 0, -0.18), (side * 0.065, 0, -0.02), 0.005, 'metal', seg=3)
    part.rod((-0.065, 0, -0.02), (0.065, 0, -0.02), 0.006, 'metal', seg=3)


@prop
def moto_helmet(part, e, body):
    """A motorbike helmet with a dark visor, held against the hip."""
    c = e.get('color', 'black')
    part.cap(0.14, c, None, keep=lambda co: co.z > -0.06, seg=12, rings=8)
    part.cap(0.142, 'screen', None, keep=lambda co: co.y < -0.06 and -0.04 < co.z < 0.07, seg=12, rings=8)


@prop
def scanner(part, e, body):
    """A hand barcode scanner."""
    part.box((0.05, 0.12, 0.06), 'charcoal', T(0, -0.05, 0.03), bevel=0.01)
    part.box((0.04, 0.05, 0.12), 'charcoal', T(0, 0.0, -0.03) @ R(-15, 0, 0), bevel=0.01)
    part.box((0.04, 0.005, 0.03), 'red_light', T(0, -0.112, 0.035))


@prop
def clipboard(part, e, body):
    part.box((0.02, 0.18, 0.25), e.get('color', 'wood'), T(0, 0, 0), bevel=0.004)
    part.box((0.012, 0.16, 0.2), 'paper', T(-0.012, 0, -0.01))
    part.box((0.02, 0.06, 0.02), 'metal', T(-0.012, 0, 0.12))


# era 4: the modern city ----------------------------------------------------------------------------------------

@prop
def tablet(part, e, body):
    part.box((0.2, 0.012, 0.14), 'charcoal', T(0, 0, 0), bevel=0.006)
    part.box((0.18, 0.004, 0.12), 'screen', T(0, -0.007, 0))


@prop
def bindle(part, e, body):
    """A tied cloth bundle on the ground (the homeless man's things)."""
    part.sphere(0.13, e.get('color', 'cream'), S(1, 1, 0.85), seg=10, rings=7)
    part.cyl(0.04, 0.02, 0.08, e.get('color', 'cream'), T(0, 0, 0.13), seg=8)
    part.torus(0.035, 0.01, 'rope', T(0, 0, 0.1), seg=8, seg_minor=3)


# era 5: the future ----------------------------------------------------------------------------------------------

def _robot_wheel(part, m, r=0.1):
    part.cyl(r, r, 0.08, 'rubber', m @ R(0, 90, 0), seg=12)
    part.cyl(r * 0.55, r * 0.55, 0.085, 'robot_orange', m @ R(0, 90, 0), seg=10)


@prop
def delivery_robot(part, e, body):
    """A small six-wheeled delivery robot with a face screen and a beacon."""
    part.box((0.5, 0.62, 0.36), 'robot_white', T(0, 0, 0.36), bevel=0.05)
    part.box((0.52, 0.64, 0.05), 'robot_orange', T(0, 0, 0.2), bevel=0.01)
    part.box((0.36, 0.02, 0.18), 'screen', T(0, -0.315, 0.4), bevel=0.02)
    for x in (-0.08, 0.08):
        part.sphere(0.03, 'robot_orange', T(x, -0.325, 0.42) @ S(1, 0.3, 1), seg=8, rings=5)
    part.cyl(0.04, 0.04, 0.05, 'robot_orange', T(0, 0.1, 0.57), seg=10)
    part.cyl(0.006, 0.006, 0.3, 'charcoal', T(0.18, 0.22, 0.68), seg=4)
    for side in (-1, 1):
        for y in (-0.22, 0.0, 0.22):
            _robot_wheel(part, T(side * 0.27, y, 0.1))


@prop
def farm_robot(part, e, body):
    """A field robot carrying a tray of seedlings, with a small arm."""
    part.box((0.5, 0.7, 0.18), 'robot_white', T(0, 0, 0.3), bevel=0.03)
    part.box((0.52, 0.72, 0.04), 'robot_orange', T(0, 0, 0.2))
    part.box((0.4, 0.4, 0.08), 'wood', T(0, 0.1, 0.43), bevel=0.01)
    for i in range(16):
        x, y = -0.15 + (i % 4) * 0.1, -0.05 + (i // 4) * 0.1
        part.cyl(0.02, 0.0, 0.14, 'leaf', T(x, y, 0.52), seg=4)
    part.polyline([(0.1, -0.25, 0.39), (0.1, -0.3, 0.7), (0.1, -0.42, 0.78)], 0.025, 'robot_white', seg=6)
    part.box((0.08, 0.06, 0.06), 'robot_orange', T(0.1, -0.46, 0.76))
    for side in (-1, 1):
        for y in (-0.25, 0.25):
            _robot_wheel(part, T(side * 0.28, y, 0.12), 0.12)
