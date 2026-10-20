# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Pieces the frontage variants share (PLAN.md "Frontage", buildings/era<n>_frontage.py): a shophouse bay is drawn
again on every cell of a shop street, so what it carries is kept light (a rooftop tank of a few dozen faces instead of
the full one), and a row roof that runs on across the bays of a terrace, closed by a gable only where the terrace ends.
True sizes (PLAN.md)."""

import math

from mathutils import Vector

from . import kit, regions
from .builder import BAY_M, bay_ends
from .mesh import T


def place_of(b):
    """A bay's place in its terrace: one, left, mid, mid2 or right (builder.BAY_PLACES)."""
    return b.spec['kind'].split('_', 1)[1]


def ends_of(b):
    return bay_ends(b.spec['kind'])


def light_tank(p, x, y, z=0.0, kind='stainless', stand=0.9):
    """A 1,000 L water tank (ถังเก็บน้ำ, 1.1 m across) on a steel stand, in about a hundred triangles."""
    mat = 'stainless' if kind == 'stainless' else 'tank_blue'
    if stand > 0:
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.box((0.06, 0.06, stand), 'iron', T(x + sx * 0.38, y + sy * 0.38, z + stand / 2))
        p.box((0.96, 0.96, 0.06), 'iron', T(x, y, z + stand))
    zb = z + stand
    p.lathe([(0.54, 0), (0.56, 0.12), (0.56, 1.08), (0.46, 1.26), (0.16, 1.36)], mat, T(x, y, zb), seg=10,
            cap_bottom=True, cap_top=True, smooth=False)
    p.cyl(0.15, 0.15, 0.08, mat, T(x, y, zb + 1.4), seg=8)
    return p


def row_roof(p, rect, z, rise, mat, left_end, right_end, over=0.6, over_end=0.5, thick=0.16, courses=0,
             course_mat=None, fill=None, barge=None, ridge_mat=None):
    """A pitched roof whose ridge runs along the street (X) across a terrace's bays: each bay draws its own length of
    it, flush with the next at x0 and x1, and only an end bay's roof runs out past its end wall (over_end) and closes
    its gable (fill: the gable triangle's wall colour; barge: bargeboards on that gable). Returns the ridge height."""
    x0, y0, x1, y1 = rect
    a0 = x0 - (over_end if left_end else 0.0)
    a1 = x1 + (over_end if right_end else 0.0)
    yc = (y0 + y1) / 2
    half = (y1 - y0) / 2
    slope = rise / half
    e0, e1 = y0 - over, y1 + over
    ez = z - over * slope
    top = z + rise
    if fill:
        if left_end:
            kit.prism_x(p, [(y0, z), (y1, z), (yc, top - 0.02)], x0, x0 + 0.12, fill)
        if right_end:
            kit.prism_x(p, [(y0, z), (y1, z), (yc, top - 0.02)], x1 - 0.12, x1, fill)
    kit.slab(p, (a0, e0, ez), (a1, e0, ez), (a1, yc, top), (a0, yc, top), thick, mat)
    kit.slab(p, (a0, yc, top), (a1, yc, top), (a1, e1, ez), (a0, e1, ez), thick, mat)
    kit.block(p, a0, yc - 0.14, top - 0.05, a1, yc + 0.14, top + 0.12, ridge_mat or course_mat or mat)
    if courses:
        cm = course_mat or mat
        for i in range(1, courses + 1):
            t = i / (courses + 1)
            for e in (e0, e1):
                yy = e + (yc - e) * t
                zz = ez + (top - ez) * t + 0.02
                step = (yc - e) / (courses + 1) * (0.35 if thick < 0.25 else 0.55)
                drop = abs(step) * slope
                kit.slab(p, (a0, yy - step, zz - drop), (a1, yy - step, zz - drop), (a1, yy, zz), (a0, yy, zz),
                         0.06 if thick < 0.25 else 0.12, cm)
    if barge:
        for end, a in ((left_end, a0), (right_end, a1)):
            if not end:
                continue
            for e in (e0, e1):
                p.rod(Vector((a, e, ez - 0.05)), Vector((a, yc, top)), 0.09, barge, seg=4, smooth=False)
    return top


def end_gable_dress(p, rect, z, rise, region, left_end, right_end, over=0.6, over_end=0.5):
    """The region's dress on a terrace's end gables only (regions.gable_dress draws both ends of a roof)."""
    x0, y0, x1, y1 = rect
    st = regions.style(region)
    g = st['gable']
    trim = st['trim']
    yc = (y0 + y1) / 2
    half = (y1 - y0) / 2
    slope = rise / half
    e0, e1 = y0 - over, y1 + over
    ez = z - over * slope
    top = z + rise
    for end, a in ((left_end, x0 - over_end - 0.05), (right_end, x1 + over_end + 0.05)):
        if not end:
            continue
        if g == 'tips':
            for e in (e0, e1):
                q = Vector((a, e, ez))
                out = Vector((0, e - yc, 0)).normalized()
                p.rod(q, q + out * 0.25 + Vector((0, 0, 0.5)), 0.07, trim, seg=4, smooth=False)
        elif g == 'kalae':
            for e in (e0, e1):
                d = yc - e
                q0 = Vector((a, yc - d * 0.05, top - 0.15))
                q1 = Vector((a, yc + d * 0.42, top + 1.1))
                p.rod(q0, q1, 0.12, trim, seg=4, smooth=False)
        elif g == 'fret':
            p.box((0.08, half * 0.8, rise * 0.35), 'fretwork', T(a + (0.05 if a > x0 else -0.05) * 0, yc,
                                                                 z + rise * 0.35))
    return p


def fringe(p, xa, xb, y, z, out=-1, seed=7, step=0.18):
    """The shaggy edge of a grass roof along X from xa to xb at (y, z): a rolled edge and tufts hanging below it
    (regions.thatch_fringe for one eave only, so a terrace's bays line theirs up). out: -1 the front, 1 the back."""
    p.rod(Vector((xa, y, z - 0.12)), Vector((xb, y, z - 0.12)), 0.15, 'thatch', seg=6)
    n = max(1, int((xb - xa) / step))
    for i in range(n):
        x = xa + (xb - xa) * (i + 0.5) / n
        ln = 0.25 + ((i * 37 + seed * 11) % 10) / 40
        p.box((step * 0.85, 0.05, ln), ('thatch_dark', 'thatch', 'thatch_light')[(i + seed) % 3],
              T(x, y + out * 0.06, z - 0.2 - ln / 2))
    return p


def sidewalk(b, y_front, mat='paving', kerb='concrete_light', z=0.08):
    """A bay's strip of sidewalk from the plot's front edge to its front wall, flush with the next bay's."""
    x0 = -b.width / 2
    kit.block(b.yard, x0, -b.depth / 2 + 0.05, 0, x0 + b.width, y_front, z, mat)
    kit.block(b.yard, x0, -b.depth / 2 + 0.05, 0, x0 + b.width, -b.depth / 2 + 0.3, z + 0.06, kerb)
    return b


def party_lines(p, rect, z0, z1, mat, left_end, right_end, w=0.14, depth=0.06):
    """Where two bays of a terrace meet, a thin pilaster down the front, half in each bay, so the bays read as units
    of one row; nothing where a bay ends the terrace (its end wall's corner is there)."""
    x0, y0, x1, y1 = rect
    for end, x, s in ((left_end, x0, 1), (right_end, x1, -1)):
        if end:
            continue
        kit.block(p, x - (w / 2 if s < 0 else 0), y0 - depth, z0, x + (w / 2 if s > 0 else 0), y0, z1, mat)
    return p


def spread_bay(n, margin=0.45):
    """n positions across a bay's front."""
    return kit.spread(BAY_M, n, margin)


def angle_of(a, b):
    return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
