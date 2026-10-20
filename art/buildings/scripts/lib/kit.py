# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The parts every building is made of, in true metres (PLAN.md "True scale"): blocks, plank walls, roofs (gable,
hip, shed, flat with a parapet), windows, doors, shutters, stairs, railings, stilts, eaves, gutters.

Every function draws into a mesh.Part. Coordinates: X right, Y back (the front of a building faces -Y), Z up.
A wall face is named by its side of a rectangle (x0, y0, x1, y1): 'front' (y0), 'back' (y1), 'left' (x0),
'right' (x1); along a face, u runs left to right as seen from outside, measured from the face's centre.
"""

import math

import bmesh
from mathutils import Matrix, Vector

from .mesh import R, S, T

# True sizes (metres), PLAN.md.
DOOR_H = 2.1
DOOR_W = 0.9
WINDOW_W = 1.1
WINDOW_H = 1.2
SILL = 0.9
STOREY_HOME = 3.0
STOREY_SHOP = 3.6
GROUND_SHOP = 4.0
RAIL_H = 1.0
STEP_RISE = 0.18
STEP_RUN = 0.25

SIDES = ('front', 'back', 'left', 'right')


# blocks ------------------------------------------------------------------------------------------------------------

def block(p, x0, y0, z0, x1, y1, z1, mat, bevel=0.0):
    """An axis-aligned box between two corners."""
    lo = (min(x0, x1), min(y0, y1), min(z0, z1))
    hi = (max(x0, x1), max(y0, y1), max(z0, z1))
    size = (hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])
    if min(size) <= 1e-6:
        return p
    centre = ((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2)
    return p.box(size, mat, T(*centre), bevel)


def _prism(p, pts, a0, a1, axis, mat):
    """A flat shape extruded along an axis. pts are (u, v) points counter-clockwise; for axis 'x' they are (y, z) and
    the shape runs from x=a0 to x=a1, for axis 'y' they are (x, z) from y=a0 to y=a1."""
    if axis == 'x':
        m = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
        loc = T((a0 + a1) / 2, 0, 0)
    else:
        # local X -> world X, local Y -> world Z, local Z -> world -Y ... keep the winding by mirroring
        m = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
        loc = T(0, (a0 + a1) / 2, 0)
    tmp = bmesh.new()
    depth = abs(a1 - a0)
    bottom = [tmp.verts.new((u, v, -depth / 2)) for u, v in pts]
    top = [tmp.verts.new((u, v, depth / 2)) for u, v in pts]
    tmp.faces.new(list(reversed(bottom)))
    tmp.faces.new(top)
    n = len(pts)
    for i in range(n):
        tmp.faces.new([bottom[i], bottom[(i + 1) % n], top[(i + 1) % n], top[i]])
    bmesh.ops.transform(tmp, matrix=loc @ m, verts=tmp.verts)
    return p.merge(tmp, mat)


def prism_x(p, pts_yz, x0, x1, mat):
    return _prism(p, pts_yz, x0, x1, 'x', mat)


def prism_y(p, pts_xz, y0, y1, mat):
    return _prism(p, pts_xz, y0, y1, 'y', mat)


def hull(p, points, mat, matrix=None):
    """The convex hull of some points: wedges, slanted slabs, odd corners."""
    tmp = bmesh.new()
    for co in points:
        tmp.verts.new(co)
    bmesh.ops.convex_hull(tmp, input=tmp.verts)
    if matrix is not None:
        bmesh.ops.transform(tmp, matrix=matrix, verts=tmp.verts)
    return p.merge(tmp, mat)


def slab(p, a, b, c, d, thickness, mat):
    """A board of some thickness under the quad a-b-c-d (any slope): roof planes, ramps."""
    a, b, c, d = (Vector(v) for v in (a, b, c, d))
    n = (b - a).cross(d - a).normalized()
    if n.z < 0:
        n = -n
    off = n * thickness
    return hull(p, [a, b, c, d, a - off, b - off, c - off, d - off], mat)


# faces of a rectangle ------------------------------------------------------------------------------------------------

def face_frame(rect, side):
    """(origin, along, out) of a wall face: origin at the face's centre at z=0, along is the u direction seen from
    outside, out points away from the wall."""
    x0, y0, x1, y1 = rect
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    if side == 'front':
        return Vector((cx, y0, 0)), Vector((1, 0, 0)), Vector((0, -1, 0))
    if side == 'back':
        return Vector((cx, y1, 0)), Vector((-1, 0, 0)), Vector((0, 1, 0))
    if side == 'left':
        return Vector((x0, cy, 0)), Vector((0, -1, 0)), Vector((-1, 0, 0))
    if side == 'right':
        return Vector((x1, cy, 0)), Vector((0, 1, 0)), Vector((1, 0, 0))
    raise ValueError(side)


def face_width(rect, side):
    x0, y0, x1, y1 = rect
    return abs(x1 - x0) if side in ('front', 'back') else abs(y1 - y0)


def on_face(p, rect, side, u, z0, w, h, depth, mat, out=0.0, bevel=0.0):
    """A box on a wall face: w wide along the face, h high from z0, sticking depth out of the wall (starting out
    metres in front of it, negative to sink it into the wall)."""
    o, along, n = face_frame(rect, side)
    c = o + along * u + n * (out + depth / 2)
    c.z = z0 + h / 2
    if side in ('front', 'back'):
        size = (w, depth, h)
    else:
        size = (depth, w, h)
    return p.box(size, mat, T(*c), bevel)


def spread(width, count, margin=0.0):
    """count positions evenly along a face of this width (centred on 0), keeping margin at both ends."""
    if count <= 0:
        return []
    span = width - 2 * margin
    if count == 1:
        return [0.0]
    step = span / count
    return [-span / 2 + step * (i + 0.5) for i in range(count)]


# walls ---------------------------------------------------------------------------------------------------------------

def walls(p, rect, z0, z1, mat, bevel=0.03):
    x0, y0, x1, y1 = rect
    return block(p, x0, y0, z0, x1, y1, z1, mat, bevel)


def plank_walls(p, rect, z0, z1, mat, line_mat, board=0.25, sides=SIDES, posts_mat=None):
    """A wall box with boards: thin strips on the chosen faces (one every `board` metres, every other one proud),
    the boards running up and down as on Thai plank houses; corner posts in posts_mat."""
    walls(p, rect, z0, z1, mat, bevel=0.0)
    x0, y0, x1, y1 = rect
    for side in sides:
        w = face_width(rect, side)
        n = max(2, int(w / (board * 2)))
        for u in spread(w, n, 0.1):
            on_face(p, rect, side, u, z0 + 0.02, 0.05, z1 - z0 - 0.04, 0.025, line_mat)
    if posts_mat:
        for x, y in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
            block(p, x - 0.09, y - 0.09, z0, x + 0.09, y + 0.09, z1, posts_mat)
    return p


def bands(p, rect, z, h, depth, mat, sides=SIDES):
    """A belt round the walls (a floor line, a sill band, a cornice)."""
    x0, y0, x1, y1 = rect
    d = depth
    return block(p, x0 - d, y0 - d, z, x1 + d, y1 + d, z + h, mat)


def corner_posts(p, rect, z0, z1, size, mat):
    x0, y0, x1, y1 = rect
    s = size / 2
    for x, y in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        block(p, x - s, y - s, z0, x + s, y + s, z1, mat)
    return p


# openings ------------------------------------------------------------------------------------------------------------

def window(p, rect, side, u, z0, w=WINDOW_W, h=WINDOW_H, frame='teak_dark', glass='window_dark', sill=None,
           shutters=None, bars=0, open_shutters=True, mullion=True):
    """A window on a wall face: a frame, the glass (or dark opening) set in it, a sill, and shutters (open, folded
    against the wall either side, or closed over it)."""
    f = 0.07
    on_face(p, rect, side, u, z0 - f, w + 2 * f, h + 2 * f, 0.06, frame)
    on_face(p, rect, side, u, z0, w, h, 0.07, glass)
    if mullion:
        on_face(p, rect, side, u, z0, 0.05, h, 0.09, frame)
    for i in range(bars):
        uu = u - w / 2 + w * (i + 1) / (bars + 1)
        on_face(p, rect, side, uu, z0, 0.025, h, 0.1, 'iron')
    on_face(p, rect, side, u, z0 - f - 0.06, w + 2 * f + 0.1, 0.06, 0.14, sill or frame)
    if shutters:
        if open_shutters:
            for s in (-1, 1):
                on_face(p, rect, side, u + s * (w / 2 + f + w / 4 + 0.02), z0, w / 2, h, 0.05, shutters)
                for k in range(3):
                    on_face(p, rect, side, u + s * (w / 2 + f + w / 4 + 0.02), z0 + h * (k + 0.5) / 3 - 0.02,
                            w / 2 - 0.08, 0.04, 0.07, frame)
        else:
            for s in (-1, 1):
                on_face(p, rect, side, u + s * w / 4, z0, w / 2 - 0.02, h, 0.1, shutters)
    return p


def windows(p, rect, side, z0, count, w=WINDOW_W, h=WINDOW_H, margin=0.6, **kw):
    for u in spread(face_width(rect, side), count, margin):
        window(p, rect, side, u, z0, w, h, **kw)
    return p


def door(p, rect, side, u, z0=0.0, w=DOOR_W, h=DOOR_H, leaf='teak', frame='teak_dark', panels=True, step=None):
    f = 0.08
    on_face(p, rect, side, u, z0, w + 2 * f, h + f, 0.06, frame)
    on_face(p, rect, side, u, z0, w, h, 0.07, leaf)
    if panels:
        on_face(p, rect, side, u, z0, 0.04, h, 0.09, frame)
        for k in (0.3, 0.7):
            on_face(p, rect, side, u, z0 + h * k, w, 0.04, 0.09, frame)
    if step:
        on_face(p, rect, side, u, z0 - STEP_RISE, w + 0.6, STEP_RISE, 0.4, step)
    return p


def folding_doors(p, rect, side, u, z0, w, h, leaf='teak', frame='teak_dark', leaves=None, open_=0.5):
    """Thai shophouse plank doors (บานเฟี้ยม): narrow leaves across the opening, some folded back."""
    n = leaves or max(4, int(w / 0.45))
    on_face(p, rect, side, u, z0, w + 0.16, h + 0.1, 0.06, frame)
    on_face(p, rect, side, u, z0, w, h, 0.03, 'window_dark')
    lw = w / n
    shut = int(n * (1 - open_))
    for i in range(n):
        if i < shut // 2 or i >= n - (shut - shut // 2):
            uu = u - w / 2 + lw * (i + 0.5)
            on_face(p, rect, side, uu, z0, lw - 0.02, h, 0.07, leaf)
            on_face(p, rect, side, uu, z0 + h * 0.5, lw - 0.06, 0.05, 0.09, frame)
    return p


def roller_shutter(p, rect, side, u, z0, w, h, mat='roller', open_=0.0, box_mat='concrete_dark'):
    """A steel roller shutter, open_ 0 shut ... 1 rolled up into its box."""
    shut_h = h * (1 - open_)
    on_face(p, rect, side, u, z0 + h, w + 0.2, 0.35, 0.28, box_mat)
    if shut_h > 0.05:
        on_face(p, rect, side, u, z0 + h - shut_h, w, shut_h, 0.06, mat)
        k = 0
        z = z0 + h - shut_h + 0.12
        while z < z0 + h - 0.05 and k < 30:
            on_face(p, rect, side, u, z, w, 0.025, 0.075, 'zinc_dark')
            z += 0.22
            k += 1
    if open_ > 0:
        on_face(p, rect, side, u, z0, w, h - shut_h, 0.03, 'window_dark')
    return p


def shopfront(p, rect, side, u, z0, w, h, frame='steel', glass='glass', door_w=1.8):
    """A glass shop front with a sliding glass door in the middle."""
    on_face(p, rect, side, u, z0, w, h, 0.05, frame)
    on_face(p, rect, side, u, z0 + 0.4, w - 0.12, h - 0.5, 0.07, glass)
    on_face(p, rect, side, u, z0, w, 0.4, 0.08, frame)
    for s in (-1, 1):
        on_face(p, rect, side, u + s * door_w / 2, z0, 0.06, h - 0.1, 0.1, frame)
    on_face(p, rect, side, u, z0 + h - 0.6, w, 0.06, 0.1, frame)
    return p


# roofs ---------------------------------------------------------------------------------------------------------------

def gable_roof(p, rect, z, rise, mat, over=0.6, over_ends=0.5, axis='x', thick=0.18, fill=None, courses=0,
               course_mat=None, barge=None, barge_tips=0.0):
    """A pitched roof. The ridge runs along `axis` ('x': gables at the left and right; 'y': a gable to the front).
    over is the eave overhang, over_ends the overhang past the gables. fill (a wall colour) closes the gable
    triangles. courses lays that many proud strips down each slope (tile rows, thatch layers). barge adds bargeboards
    along the gable edges; barge_tips lets them cross above the ridge (a plain Lanna กาแล-like V, allowed)."""
    x0, y0, x1, y1 = rect
    if axis == 'x':
        a0, a1, b0, b1 = x0 - over_ends, x1 + over_ends, y0, y1
    else:
        a0, a1, b0, b1 = y0 - over_ends, y1 + over_ends, x0, x1
    half = (b1 - b0) / 2
    bc = (b0 + b1) / 2
    slope = rise / half
    e0, e1 = b0 - over, b1 + over
    ez = z - over * slope
    top = z + rise

    def pt(a, b, zz):
        return (a, b, zz) if axis == 'x' else (b, a, zz)

    if fill:
        tri = [(b0, z), (b1, z), (bc, top - 0.02)]
        if axis == 'x':
            prism_x(p, tri, x0 + 0.02, x1 - 0.02, fill)
        else:
            prism_y(p, [(u, v) for u, v in tri], y0 + 0.02, y1 - 0.02, fill)
    # the two slopes
    slab(p, pt(a0, e0, ez), pt(a1, e0, ez), pt(a1, bc, top), pt(a0, bc, top), thick, mat)
    slab(p, pt(a0, bc, top), pt(a1, bc, top), pt(a1, e1, ez), pt(a0, e1, ez), thick, mat)
    # ridge cap
    rc = course_mat or mat
    if axis == 'x':
        block(p, a0, bc - 0.14, top - 0.05, a1, bc + 0.14, top + 0.12, rc)
    else:
        block(p, bc - 0.14, a0, top - 0.05, bc + 0.14, a1, top + 0.12, rc)
    # courses: strips down each slope
    if courses:
        cm = course_mat or mat
        for i in range(1, courses + 1):
            t = i / (courses + 1)
            for e in (e0, e1):
                b = e + (bc - e) * t
                zz = ez + (top - ez) * t + 0.02
                step_b = (bc - e) / (courses + 1) * (0.35 if thick < 0.25 else 0.55)
                q0 = pt(a0, b - step_b, zz - step_b * slope * math.copysign(1, bc - e))
                q1 = pt(a1, b - step_b, zz - step_b * slope * math.copysign(1, bc - e))
                q2 = pt(a1, b, zz)
                q3 = pt(a0, b, zz)
                slab(p, q0, q1, q2, q3, 0.06 if thick < 0.25 else 0.12, cm)
    if barge:
        for a in (a0, a1):
            for e in (e0, e1):
                tip_b = bc + (bc - e) * (barge_tips / max(half + over, 0.1))
                tip_z = top + barge_tips * slope
                p0 = Vector(pt(a, e, ez - 0.05))
                p1 = Vector(pt(a, tip_b, tip_z))
                p.rod(p0, p1, 0.09, barge, seg=4, smooth=False)
    return top


def hip_roof(p, rect, z, rise, mat, over=0.6, ridge=None, thick=0.15, courses=0, course_mat=None):
    """A hipped roof (ปั้นหยา): slopes on all four sides up to a ridge along the longer side (ridge=0: a pyramid)."""
    x0, y0, x1, y1 = rect
    ex0, ey0, ex1, ey1 = x0 - over, y0 - over, x1 + over, y1 + over
    w, d = ex1 - ex0, ey1 - ey0
    cx, cy = (ex0 + ex1) / 2, (ey0 + ey1) / 2
    slope = rise / (min(w, d) / 2 - over * 0 + 1e-6)
    ez = z - over * slope * 0.5
    top = z + rise
    if ridge is None:
        ridge = max(0.0, abs(w - d))
    if w >= d:
        r0, r1 = (cx - ridge / 2, cy, top), (cx + ridge / 2, cy, top)
    else:
        r0, r1 = (cx, cy - ridge / 2, top), (cx, cy + ridge / 2, top)
    pts = [(ex0, ey0, ez), (ex1, ey0, ez), (ex1, ey1, ez), (ex0, ey1, ez), r0, r1]
    lifted = [(x, y, zz - thick) for x, y, zz in pts[:4]]
    hull(p, pts + lifted, mat)
    if courses:
        cm = course_mat or mat
        for i in range(1, courses + 1):
            t = i / (courses + 1)
            zz = ez + (top - ez) * t
            sx = (ex1 - ex0) / 2 * (1 - t)
            sy = (ey1 - ey0) / 2 * (1 - t)
            rx = (abs(r1[0] - r0[0]) / 2) * t
            ry = (abs(r1[1] - r0[1]) / 2) * t
            hx, hy = sx + rx, sy + ry
            block(p, cx - hx - 0.03, cy - hy - 0.03, zz - 0.05, cx + hx + 0.03, cy + hy + 0.03, zz + 0.0, cm)
    return top


def shed_roof(p, rect, z_low, z_high, mat, over=0.4, low_side='front', thick=0.12, courses=0, course_mat=None):
    """A mono-pitch roof falling toward low_side; courses lays proud strips across the slope (tiles, thatch)."""
    x0, y0, x1, y1 = rect
    x0, y0, x1, y1 = x0 - over, y0 - over, x1 + over, y1 + over
    if low_side == 'front':
        q = [(x0, y0, z_low), (x1, y0, z_low), (x1, y1, z_high), (x0, y1, z_high)]
    elif low_side == 'back':
        q = [(x0, y0, z_high), (x1, y0, z_high), (x1, y1, z_low), (x0, y1, z_low)]
    elif low_side == 'left':
        q = [(x0, y0, z_low), (x1, y0, z_high), (x1, y1, z_high), (x0, y1, z_low)]
    else:
        q = [(x0, y0, z_high), (x1, y0, z_low), (x1, y1, z_low), (x0, y1, z_high)]
    slab(p, *q, thick, mat)
    if courses:
        cm = course_mat or mat
        a = [Vector(v) for v in q]
        # the low edge is the side whose corners are at z_low
        lo = [v for v in a if abs(v.z - z_low) < 1e-6]
        hi = [v for v in a if abs(v.z - z_high) < 1e-6]
        lo.sort(key=lambda v: (v.x, v.y))
        hi.sort(key=lambda v: (v.x, v.y))
        step = 0.55 if thick >= 0.2 else 0.35
        for i in range(courses):
            t0 = i / courses
            t1 = t0 + step / courses
            c0, c1 = lo[0].lerp(hi[0], t0), lo[1].lerp(hi[1], t0)
            d0, d1 = lo[0].lerp(hi[0], t1), lo[1].lerp(hi[1], t1)
            lift = Vector((0, 0, 0.05 if thick < 0.2 else 0.1))
            slab(p, c0 + lift, c1 + lift, d1 + lift, d0 + lift, 0.06 if thick < 0.2 else 0.12, cm)
    return p


def corrugated(p, rect, z_low, z_high, mat, line_mat, over=0.3, low_side='front', pitch=0.5, thick=0.08):
    """A corrugated sheet roof (สังกะสี): a shed roof with ribs running down the slope."""
    shed_roof(p, rect, z_low, z_high, mat, over, low_side, thick)
    x0, y0, x1, y1 = rect
    x0, y0, x1, y1 = x0 - over, y0 - over, x1 + over, y1 + over
    if low_side in ('front', 'back'):
        n = max(2, int((x1 - x0) / pitch))
        for i in range(n + 1):
            x = x0 + (x1 - x0) * i / n
            za, zb = (z_low, z_high) if low_side == 'front' else (z_high, z_low)
            p.rod((x, y0, za + 0.03), (x, y1, zb + 0.03), 0.035, line_mat, seg=4, smooth=False)
    else:
        n = max(2, int((y1 - y0) / pitch))
        for i in range(n + 1):
            y = y0 + (y1 - y0) * i / n
            za, zb = (z_low, z_high) if low_side == 'left' else (z_high, z_low)
            p.rod((x0, y, za + 0.03), (x1, y, zb + 0.03), 0.035, line_mat, seg=4, smooth=False)
    return p


def gable_ribbed(p, rect, z, rise, mat, line_mat, over=0.4, over_ends=0.3, axis='x', pitch=0.6):
    """A corrugated gable roof (warehouses, mills): two ribbed slopes."""
    top = gable_roof(p, rect, z, rise, mat, over, over_ends, axis, thick=0.08)
    x0, y0, x1, y1 = rect
    if axis == 'x':
        a0, a1, bc, e0, e1 = x0 - over_ends, x1 + over_ends, (y0 + y1) / 2, y0 - over, y1 + over
    else:
        a0, a1, bc, e0, e1 = y0 - over_ends, y1 + over_ends, (x0 + x1) / 2, x0 - over, x1 + over
    half = abs(bc - e0) - over
    slope = rise / max(half, 0.1)
    ez = z - over * slope
    n = max(2, int((a1 - a0) / pitch))
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        for e in (e0, e1):
            if axis == 'x':
                p.rod((a, e, ez + 0.04), (a, bc, top + 0.04), 0.035, line_mat, seg=4, smooth=False)
            else:
                p.rod((e, a, ez + 0.04), (bc, a, top + 0.04), 0.035, line_mat, seg=4, smooth=False)
    return top


def flat_roof(p, rect, z, mat, parapet=0.9, parapet_mat=None, thick=0.25, coping=None):
    """A flat concrete roof with a parapet wall round it."""
    x0, y0, x1, y1 = rect
    block(p, x0, y0, z, x1, y1, z + thick, mat)
    if parapet > 0:
        pm = parapet_mat or mat
        t = 0.15
        zt = z + thick + parapet
        block(p, x0, y0, z, x1, y0 + t, zt, pm)
        block(p, x0, y1 - t, z, x1, y1, zt, pm)
        block(p, x0, y0, z, x0 + t, y1, zt, pm)
        block(p, x1 - t, y0, z, x1, y1, zt, pm)
        if coping:
            bands(p, (x0, y0, x1, y1), zt, 0.08, 0.04, coping)
        return zt
    return z + thick


def eave_brackets(p, rect, side, z, count, depth=0.6, mat='teak_dark'):
    """Diagonal struts (คันทวย) under the eave along a face."""
    o, along, n = face_frame(rect, side)
    for u in spread(face_width(rect, side), count, 0.3):
        a = o + along * u
        a.z = z - 0.8
        b = o + along * u + n * depth
        b.z = z - 0.05
        p.rod(a, b, 0.05, mat, seg=4, smooth=False)
    return p


def gutter(p, rect, side, z, mat='zinc_dark', downpipes=(True, True)):
    """A box gutter along a face's eave and downpipes at its ends."""
    o, along, n = face_frame(rect, side)
    w = face_width(rect, side)
    c = o + n * 0.15
    c.z = z
    if side in ('front', 'back'):
        p.box((w + 0.4, 0.14, 0.14), mat, T(*c))
    else:
        p.box((0.14, w + 0.4, 0.14), mat, T(*c))
    for k, s in enumerate((-1, 1)):
        if downpipes[k]:
            q = o + along * (s * (w / 2 - 0.1)) + n * 0.12
            p.rod((q.x, q.y, 0.1), (q.x, q.y, z), 0.05, mat, seg=6)
    return p


# stairs, railings, stilts ----------------------------------------------------------------------------------------------

def stairs(p, x, y, z_top, width, direction='-y', mat='teak', stringer=None, z_base=0.0, open_=True):
    """A straight flight from the ground up to z_top, starting at (x, y) at the top landing's edge and going down
    toward `direction` ('-y', '+y', '-x', '+x'). Real rise and run (STEP_RISE, STEP_RUN)."""
    h = z_top - z_base
    n = max(1, int(round(h / STEP_RISE)))
    rise = h / n
    dx, dy = {'-y': (0, -1), '+y': (0, 1), '-x': (-1, 0), '+x': (1, 0)}[direction]
    run = STEP_RUN
    for i in range(n):
        zt = z_top - rise * i
        d0 = run * i
        if dx == 0:
            cx, cy = x, y + dy * (d0 + run / 2)
            size = (width, run + 0.02, 0.05 if open_ else zt - z_base)
        else:
            cx, cy = x + dx * (d0 + run / 2), y
            size = (run + 0.02, width, 0.05 if open_ else zt - z_base)
        cz = zt - 0.025 if open_ else (zt + z_base) / 2
        p.box(size, mat, T(cx, cy, cz))
    if stringer:
        length = run * n
        for s in (-1, 1):
            if dx == 0:
                a = (x + s * width / 2, y, z_top)
                b = (x + s * width / 2, y + dy * length, z_base)
            else:
                a = (x, y + s * width / 2, z_top)
                b = (x + dx * length, y + s * width / 2, z_base)
            p.rod(a, b, 0.06, stringer, seg=4, smooth=False)
    return n * run


def railing(p, points, z, mat='teak', h=RAIL_H, spacing=0.14, post_mat=None, baluster=0.035, posts_every=1.6,
            closed=False):
    """A railing along a polyline at floor height z: a top rail, a bottom rail, balusters and posts."""
    pts = [Vector((x, y, z)) for x, y in points]
    if closed:
        pts.append(pts[0])
    pm = post_mat or mat
    for a, b in zip(pts, pts[1:]):
        seg_len = (b - a).length
        if seg_len < 1e-3:
            continue
        up = Vector((0, 0, h))
        p.rod(a + up, b + up, 0.045, mat, seg=4, smooth=False)
        p.rod(a + Vector((0, 0, 0.12)), b + Vector((0, 0, 0.12)), 0.03, mat, seg=4, smooth=False)
        n = max(1, int(seg_len / spacing))
        for i in range(1, n):
            q = a + (b - a) * (i / n)
            p.box((baluster, baluster, h - 0.12), mat, T(q.x, q.y, z + 0.12 + (h - 0.12) / 2))
        m = max(1, int(seg_len / posts_every))
        for i in range(m + 1):
            q = a + (b - a) * (i / m)
            p.box((0.09, 0.09, h + 0.08), pm, T(q.x, q.y, z + (h + 0.08) / 2))
    return p


def stilts(p, rect, z_floor, nx, ny, mat='teak_dark', size=0.2, footing='stone', beams=None):
    """Square posts under a raised floor (ใต้ถุน), on stone footings, with the floor beams on top."""
    x0, y0, x1, y1 = rect
    for i in range(nx):
        for j in range(ny):
            x = x0 + (x1 - x0) * i / max(nx - 1, 1)
            y = y0 + (y1 - y0) * j / max(ny - 1, 1)
            block(p, x - size / 2, y - size / 2, 0.0, x + size / 2, y + size / 2, z_floor, mat)
            if footing:
                block(p, x - size, y - size, 0.0, x + size, y + size, 0.22, footing, bevel=0.03)
    if beams:
        for j in range(ny):
            y = y0 + (y1 - y0) * j / max(ny - 1, 1)
            block(p, x0 - 0.15, y - 0.1, z_floor - 0.3, x1 + 0.15, y + 0.1, z_floor, beams)
    return p


def floor_deck(p, rect, z, mat='teak', thick=0.15, edge=None, boards=0, board_mat=None):
    x0, y0, x1, y1 = rect
    block(p, x0, y0, z - thick, x1, y1, z, mat)
    if edge:
        bands(p, rect, z - thick - 0.02, 0.1, 0.03, edge)
    if boards:
        bm = board_mat or edge or mat
        for i in range(1, boards):
            x = x0 + (x1 - x0) * i / boards
            block(p, x - 0.015, y0, z, x + 0.015, y1, z + 0.012, bm)
    return p


def columns(p, points, z0, z1, r, mat, square=True):
    for x, y in points:
        if square:
            block(p, x - r, y - r, z0, x + r, y + r, z1, mat)
        else:
            p.cyl(r, r, z1 - z0, mat, T(x, y, (z0 + z1) / 2), seg=10)
    return p


def balcony(p, rect, side, u, z, w, d, slab_mat='concrete', rail_mat='iron', rail_h=RAIL_H):
    """A balcony slab sticking out of a face, with a railing round its open sides."""
    o, along, n = face_frame(rect, side)
    a = o + along * (u - w / 2)
    b = o + along * (u + w / 2)
    a2 = a + n * d
    b2 = b + n * d
    xs = [a.x, b.x, a2.x, b2.x]
    ys = [a.y, b.y, a2.y, b2.y]
    block(p, min(xs), min(ys), z - 0.18, max(xs), max(ys), z, slab_mat)
    railing(p, [(a.x, a.y), (a2.x, a2.y), (b2.x, b2.y), (b.x, b.y)], z, rail_mat, rail_h, spacing=0.12)
    return p


def frame_lines(p, rect, z0, z1, storeys, mat, depth=0.05):
    """Floor lines round a block at each storey."""
    h = (z1 - z0) / storeys
    for i in range(1, storeys):
        bands(p, rect, z0 + h * i - 0.08, 0.16, depth, mat)
    return p
