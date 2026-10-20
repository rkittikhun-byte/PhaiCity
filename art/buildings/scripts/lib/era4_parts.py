# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The parts of era 4, the modern city (assets/concept/era4_*.jpg): ribbon-window facades on a concrete frame,
glass curtain walls with mullions, glass-railed balconies, vertical fins and louvres, rooftop plant, a small
regional roof pavilion on top (the Thai identity of each region), planters, parking and low walls.

Kept cheap on triangles: a glass sheet runs up a whole face and the floor spandrels are one band round the block per
floor, so a 30-floor tower costs about as much as its balconies.
"""

import math

from mathutils import Vector

from . import kit, palette, props, regions
from .mesh import R, T

# Era 4 colours, added here so the shared palette file stays untouched (prefix e4_).
for _k, _v in {
    'e4_glass': '#7FA9C0', 'e4_glass_dark': '#557A90', 'e4_glass_green': '#7DB3A8', 'e4_alu': '#5C636B',
    'e4_white': '#ECEBE6', 'e4_rail': '#BCD9E2', 'e4_terracotta': '#C46A42', 'e4_court': '#4F8C6A',
    'e4_court_blue': '#4D7DAE', 'e4_track': '#B65E45', 'e4_green_h': '#2F9E5B', 'e4_roof_metal': '#9DB0BC',
    'e4_pool': '#5FC3D3', 'e4_graphite': '#4A4F57', 'e4_panel': '#D9D4CA', 'e4_sand_stone': '#D8C3A0',
}.items():
    palette.COLORS.setdefault(_k, _v)

SIDES = kit.SIDES
OPP = {'front': 'back', 'back': 'front', 'left': 'right', 'right': 'left'}

# The regional dress of a modern building: the roof of its little roof pavilion and gables, an accent (base
# cladding, floor bands), the colour of its louvres, its main wall.
DRESS = {
    'northeast': {'roof': 'clay_tile', 'accent': 'laterite', 'louvre': 'e4_terracotta', 'wall': 'plaster_white',
                  'wall2': 'concrete_light', 'base': 'laterite', 'trim': 'e4_terracotta'},
    'north': {'roof': 'clay_tile_dark', 'accent': 'teak', 'louvre': 'teak', 'wall': 'plaster',
              'wall2': 'cream', 'base': 'stone', 'trim': 'teak_dark'},
    'south': {'roof': 'clay_tile', 'accent': 'plaster_mint', 'louvre': 'teak_light', 'wall': 'plaster_yellow',
              'wall2': 'plaster_white', 'base': 'plaster_sky', 'trim': 'paint_white'},
    'central': {'roof': 'roof_blue', 'accent': 'e4_graphite', 'louvre': 'teak_light', 'wall': 'plaster_white',
                'wall2': 'concrete_light', 'base': 'stone', 'trim': 'teak_dark'},
    'east': {'roof': 'clay_tile', 'accent': 'plaster_peach', 'louvre': 'teak_light', 'wall': 'plaster_white',
             'wall2': 'plaster', 'base': 'stone', 'trim': 'teak_dark'},
    'west': {'roof': 'roof_green', 'accent': 'teak', 'louvre': 'teak', 'wall': 'plaster',
             'wall2': 'plaster_white', 'base': 'stone', 'trim': 'teak_dark'},
}


def dress(region, i=0):
    """The region's dress; in the south the wall is one of the pastel Sino-Portuguese colours, by i."""
    d = dict(DRESS[region])
    if region == 'south':
        d['wall'] = regions.plaster('south', i)
        d['accent'] = regions.plaster('south', i + 1)
    return d


# facades ---------------------------------------------------------------------------------------------------------------

def ribbon_facade(p, rect, z0, n, fh, wall, sides=SIDES, bay=3.4, sill=0.85, head=0.3, glass='e4_glass',
                  pier=None, mull='e4_alu', slab='e4_white', piers=True, mullions=True):
    """A concrete-frame block of n floors from z0: the core in wall colour, a glass sheet up each chosen face, a
    spandrel band round the block at every floor (sill height plus the slab edge), piers every bay and a thin
    mullion between. Returns the top z."""
    x0, y0, x1, y1 = rect
    z1 = z0 + n * fh
    kit.block(p, x0, y0, z0, x1, y1, z1, wall)
    for side in sides:
        w = kit.face_width(rect, side)
        kit.on_face(p, rect, side, 0, z0, w - 0.4, n * fh, 0.04, glass)
        if piers or mullions:
            nb = max(1, int(round(w / bay)))
            for k in range(nb + 1):
                u = -w / 2 + w * k / nb
                if piers and 0 < k < nb:
                    kit.on_face(p, rect, side, u, z0, 0.36, n * fh, 0.11, pier or wall)
                if mullions and k < nb:
                    kit.on_face(p, rect, side, u + w / nb / 2, z0, 0.06, n * fh, 0.07, mull)
    for i in range(n):
        z = z0 + i * fh
        kit.bands(p, rect, z - 0.12, sill + 0.12, 0.08, wall)
        kit.bands(p, rect, z - 0.14, 0.22, 0.12, slab)
    kit.bands(p, rect, z1 - head, head, 0.08, wall)
    kit.corner_posts(p, rect, z0, z1, 0.5, pier or wall)
    return z1


def curtain(p, rect, z0, z1, fh=4.0, glass='e4_glass', mull='e4_alu', step=1.5, sides=SIDES, spandrel=0.12,
            corner=True):
    """A glass curtain wall: the block in glass, mullions every step, a transom at every floor."""
    x0, y0, x1, y1 = rect
    kit.block(p, x0, y0, z0, x1, y1, z1, glass)
    for side in sides:
        w = kit.face_width(rect, side)
        m = max(2, int(round(w / step)))
        for k in range(1, m):
            kit.on_face(p, rect, side, -w / 2 + w * k / m, z0, 0.07, z1 - z0, 0.06, mull)
    floors = max(1, int(round((z1 - z0) / fh)))
    for i in range(1, floors):
        kit.bands(p, rect, z0 + i * (z1 - z0) / floors - spandrel / 2, spandrel, 0.035, mull)
    if corner:
        kit.corner_posts(p, rect, z0, z1, 0.16, mull)
    return z1


def fins(p, rect, side, u, z0, w, h, mat, step=0.35, depth=0.3, thick=0.07):
    """Vertical fins or timber louvres over a part of a face."""
    n = max(2, int(w / step))
    for k in range(n):
        uu = u - w / 2 + w * (k + 0.5) / n
        kit.on_face(p, rect, side, uu, z0, thick, h, depth, mat)
    return p


def louvre_screen(p, rect, side, u, z0, w, h, mat, frame='e4_alu', step=0.18):
    """A framed screen of horizontal louvres (a sunshade over a window or a stair)."""
    kit.on_face(p, rect, side, u, z0, w + 0.1, h + 0.1, 0.06, frame, out=0.02)
    n = max(3, int(h / step))
    for k in range(n):
        kit.on_face(p, rect, side, u, z0 + h * (k + 0.5) / n, w, 0.05, 0.14, mat, out=0.02)
    return p


def window_box(p, rect, side, u, z0, w, h, frame, glass='e4_glass', depth=0.35, mull=True):
    """A deep framed picture window that stands out of the wall (the concept house's big windows)."""
    kit.on_face(p, rect, side, u, z0 - 0.15, w + 0.3, 0.15, depth, frame)
    kit.on_face(p, rect, side, u, z0 + h, w + 0.3, 0.15, depth, frame)
    for s in (-1, 1):
        kit.on_face(p, rect, side, u + s * (w / 2 + 0.075), z0 - 0.15, 0.15, h + 0.3, depth, frame)
    kit.on_face(p, rect, side, u, z0, w, h, 0.06, glass)
    if mull:
        n = max(1, int(w / 1.0))
        for k in range(1, n + 1):
            if k < n + 1 and n > 1 and k < n:
                kit.on_face(p, rect, side, u - w / 2 + w * k / n, z0, 0.05, h, 0.09, frame)
        kit.on_face(p, rect, side, u, z0 + h * 0.62, w, 0.05, 0.09, frame)
    return p


# balconies -------------------------------------------------------------------------------------------------------------

def balcony(p, rect, side, u, z, w, d, slab='e4_white', glass='e4_rail', rail='e4_alu', h=1.05):
    """A balcony slab out of a face with a glass balustrade and a slim top rail on its three open edges."""
    o, along, n = kit.face_frame(rect, side)
    a = o + along * (u - w / 2)
    b = o + along * (u + w / 2) + n * d
    bal = (min(a.x, b.x), min(a.y, b.y), max(a.x, b.x), max(a.y, b.y))
    kit.block(p, bal[0], bal[1], z - 0.2, bal[2], bal[3], z, slab)
    for edge in SIDES:
        if edge == OPP[side]:
            continue
        fw = kit.face_width(bal, edge)
        kit.on_face(p, bal, edge, 0, z, fw, h, 0.025, glass, out=-0.06)
        kit.on_face(p, bal, edge, 0, z + h, fw, 0.05, 0.07, rail, out=-0.08)
    return bal


def balcony_stack(p, rect, side, z0, n, fh, us, w, d, start=1, ac=True, **kw):
    """The same balconies on floors start..n-1 (z0 is the ground floor's level); an AC unit on each."""
    o, along, nrm = kit.face_frame(rect, side)
    for i in range(start, n):
        z = z0 + i * fh
        for u in us:
            balcony(p, rect, side, u, z, w, d, **kw)
            if ac:
                q = o + along * (u + w / 2 - 0.55) + nrm * (d - 0.45)
                ac_unit(p, q.x, q.y, z, facing_of(side))
    return p


def facing_of(side):
    return {'front': 0.0, 'back': 180.0, 'left': -90.0, 'right': 90.0}[side]


def ac_unit(p, x, y, z, facing=0.0):
    """A light air conditioner's outdoor unit (0.8 x 0.3 x 0.55 m) with its fan grille."""
    m = T(x, y, z) @ R(0, 0, facing)
    p.box((0.8, 0.3, 0.55), 'paint_white', m @ T(0, 0, 0.3))
    p.box((0.42, 0.04, 0.42), 'grey', m @ T(-0.12, -0.15, 0.3))
    return p


# roofs -------------------------------------------------------------------------------------------------------------

def roof_pavilion(b, p, rect, z, h=3.0, axis='x', mat=None, walls=None, glass=True):
    """The Thai identity on a modern roof: a small room or open pavilion under the region's roof (plain gable in
    Isan, กาแล-topped in the north, hipped in the south, turned-up bargeboard ends in the centre, east and west).
    Returns the ridge height."""
    r = b.region
    d = dress(r)
    x0, y0, x1, y1 = rect
    if walls:
        kit.block(p, x0 + 0.2, y0 + 0.2, z, x1 - 0.2, y1 - 0.2, z + h, walls)
        if glass:
            for side in ('front', 'left'):
                fw = kit.face_width((x0 + 0.2, y0 + 0.2, x1 - 0.2, y1 - 0.2), side)
                kit.on_face(p, (x0 + 0.2, y0 + 0.2, x1 - 0.2, y1 - 0.2), side, 0, z + 0.3, fw - 0.8, h - 0.7, 0.05,
                            'e4_glass')
    for x, y in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        kit.block(p, x - 0.12, y - 0.12, z, x + 0.12, y + 0.12, z + h, d['trim'] if r != 'south' else 'paint_white')
    kit.bands(p, (x0, y0, x1, y1), z + h - 0.3, 0.3, 0.05, d['trim'] if r != 'south' else 'paint_white')
    return regions.small_roof(p, rect, z + h, r, mat=mat or d['roof'], axis=axis, over=0.5)


def lift_core(p, rect, z, h, mat='e4_white', top='concrete_dark'):
    x0, y0, x1, y1 = rect
    kit.block(p, x0, y0, z, x1, y1, z + h, mat)
    kit.block(p, x0 - 0.1, y0 - 0.1, z + h, x1 + 0.1, y1 + 0.1, z + h + 0.2, top)
    return z + h + 0.2


def roof_tanks(p, x, y, z, n=2, kind='stainless', step=1.4):
    for i in range(n):
        props.water_tank(p, x + i * step, y, z, kind, stand=0.8)
    return p


def solar_field(p, x0, y0, x1, y1, z, tilt=12.0, pw=1.0, ph=1.7):
    """As many panel rows as fit in a rectangle on a roof (facing south, -Y)."""
    cols = max(1, int((x1 - x0) / (pw + 0.05)))
    row_d = ph + 0.9
    rows = max(1, int((y1 - y0) / row_d))
    for j in range(rows):
        y = y0 + row_d * (j + 0.5)
        props.solar_panels(p, (x0 + x1) / 2, y, z, cols=cols, rows=1, tilt=tilt, pw=pw, ph=ph)
    return p


def chiller(p, x, y, z, w=2.4, d=1.6, h=1.6, fans=2):
    """A rooftop chiller or cooling-tower cell: a grey box with fan rings on top."""
    kit.block(p, x - w / 2, y - d / 2, z, x + w / 2, y + d / 2, z + h, 'steel')
    for k in range(4):
        kit.block(p, x - w / 2 - 0.02, y - d / 2 + 0.1, z + 0.2 + k * 0.3, x + w / 2 + 0.02, y + d / 2 - 0.1,
                  z + 0.24 + k * 0.3, 'metal')
    for i in range(fans):
        fx = x - w / 2 + w * (i + 0.5) / fans
        p.cyl(min(w / fans, d) * 0.42, min(w / fans, d) * 0.42, 0.3, 'e4_alu', T(fx, y, z + h + 0.15), seg=12)
        p.cyl(min(w / fans, d) * 0.36, min(w / fans, d) * 0.36, 0.05, 'iron', T(fx, y, z + h + 0.31), seg=12)
    return p


# ground ------------------------------------------------------------------------------------------------------------

def planter(b, x0, y0, x1, y1, seed=1, h=0.45, mat='e4_white', bushes=True, flowers=None):
    """A raised concrete planter with soil, grass and a few shrubs."""
    kit.block(b.props, x0, y0, 0.0, x1, y1, h, mat)
    kit.block(b.props, x0 + 0.12, y0 + 0.12, h, x1 - 0.12, y1 - 0.12, h + 0.03, 'grass_dark')
    if bushes:
        n = max(1, int(max(x1 - x0, y1 - y0) / 1.8))
        long_x = (x1 - x0) >= (y1 - y0)
        for i in range(n):
            t = (i + 0.5) / n
            x = x0 + (x1 - x0) * t if long_x else (x0 + x1) / 2
            y = (y0 + y1) / 2 if long_x else y0 + (y1 - y0) * t
            bush_at(b.props, x, y, h, 0.45, seed + i, flowers=flowers if i % 2 == 0 else None)
    return b


def bush_at(p, x, y, z, r, seed, mat='leaf_dark', flowers=None):
    """props.bush raised to z (a planter's top)."""
    tmp_start = len(p.bm.verts)
    props.bush(p, x, y, r, seed, mat, flowers)
    if z:
        for v in list(p.bm.verts)[tmp_start:]:
            v.co.z += z
    return p


def lift(p, z, fn):
    """Run fn (which draws into p at ground level) and raise what it drew by z: plants on a roof deck."""
    start = len(p.bm.verts)
    fn()
    p.bm.verts.ensure_lookup_table()
    for i in range(start, len(p.bm.verts)):
        p.bm.verts[i].co.z += z
    return p


def lawn(b, x0, y0, x1, y1, mat='grass'):
    kit.block(b.yard, x0, y0, 0.0, x1, y1, 0.06, mat)
    return b


def parking(b, x0, y0, x1, y1, n, axis='x', mat='asphalt', line='paint_white'):
    """Asphalt with n bays marked across it (bays side by side along axis)."""
    kit.block(b.yard, x0, y0, 0.0, x1, y1, 0.07, mat)
    for i in range(n + 1):
        if axis == 'x':
            x = x0 + 0.2 + (x1 - x0 - 0.4) * i / n
            kit.block(b.yard, x - 0.06, y0 + 0.4, 0.0, x + 0.06, y1 - 0.4, 0.075, line)
        else:
            y = y0 + 0.2 + (y1 - y0 - 0.4) * i / n
            kit.block(b.yard, x0 + 0.4, y - 0.06, 0.0, x1 - 0.4, y + 0.06, 0.075, line)
    return b


def low_wall(b, e, gaps, h=1.2, mat=None, top='e4_white', back=True):
    """A low wall round the lot (e from the centre) with gaps in the front: gaps is [(u0, u1), ...] along x."""
    mat = mat or 'e4_white'
    edges = []
    xs = [-e]
    for g0, g1 in sorted(gaps):
        edges.append([(xs[-1], -e), (g0, -e)])
        xs.append(g1)
    edges.append([(xs[-1], -e), (e, -e)])
    for seg in edges:
        if seg[1][0] - seg[0][0] > 0.2:
            props.fence(b.props, seg, h, mat, post_mat=top, kind='wall')
    if back:
        props.fence(b.props, [(e, -e), (e, e), (-e, e), (-e, -e)], h, mat, post_mat=top, kind='wall')
    else:
        props.fence(b.props, [(e, -e), (e, e)], h, mat, post_mat=top, kind='wall')
        props.fence(b.props, [(-e, e), (-e, -e)], h, mat, post_mat=top, kind='wall')
    return b


def steel_fence(b, e, gate_w=6.0, h=1.8, wall_h=0.5, step=2.5, mat='e4_graphite', base='e4_white', picket=0.9):
    """A service lot's fence: a low wall with steel railings on it, a gap for the gate in the front middle."""
    p = b.props
    runs = [[(-gate_w / 2, -e), (-e, -e), (-e, e), (e, e), (e, -e), (gate_w / 2, -e)]]
    for pts in runs:
        for a, c in zip(pts, pts[1:]):
            props.fence(p, [a, c], wall_h, base, post_mat=base, kind='wall')
            a3, c3 = Vector((a[0], a[1], 0)), Vector((c[0], c[1], 0))
            for zz in (wall_h + 0.1, h):
                p.rod(a3 + Vector((0, 0, zz)), c3 + Vector((0, 0, zz)), 0.035, mat, seg=4, smooth=False)
            ln = (c3 - a3).length
            k = max(1, int(ln / step))
            for i in range(k + 1):
                q = a3.lerp(c3, i / k)
                p.box((0.12, 0.12, h + 0.1), mat, T(q.x, q.y, (h + 0.1) / 2))
            m = max(1, int(ln / picket))
            for i in range(m):
                q = a3.lerp(c3, (i + 0.5) / m)
                p.box((0.025, 0.025, h - wall_h), mat, T(q.x, q.y, wall_h + (h - wall_h) / 2))
    return b


def gate_posts(b, x, y, w, h=2.4, mat='e4_white', cap='e4_graphite', sign=True):
    """Two square gate piers with caps, and a name plate (no lettering, just bars)."""
    for s in (-1, 1):
        kit.block(b.main, x + s * w / 2 - 0.35, y - 0.35, 0, x + s * w / 2 + 0.35, y + 0.35, h, mat)
        kit.block(b.main, x + s * w / 2 - 0.42, y - 0.42, h, x + s * w / 2 + 0.42, y + 0.42, h + 0.15, cap)
    if sign:
        kit.block(b.main, x - w / 2 - 0.3, y - 0.42, h * 0.45, x - w / 2 + 0.3, y - 0.36, h * 0.75, 'sign_text')
    return b


def canopy(p, x0, y0, x1, y1, z, mat='e4_white', posts=True, post_mat='e4_alu', edge='e4_alu', thick=0.25):
    """A flat entrance canopy, on slim posts at its outer corners."""
    kit.block(p, x0, y0, z, x1, y1, z + thick, mat)
    kit.bands(p, (x0, y0, x1, y1), z + thick - 0.08, 0.1, 0.02, edge)
    if posts:
        for x in (x0 + 0.2, x1 - 0.2):
            p.cyl(0.1, 0.1, z, post_mat, T(x, y0 + 0.2, z / 2), seg=8)
    return p


def plaza_lamps(b, pts, h=5.0):
    for x, y in pts:
        props.street_lamp(b.props, x, y, h, facing=0.0)
    return b


def tree_row(b, pts, h=6.0, r=2.2, seed=40):
    for k, (x, y) in enumerate(pts):
        props.tree(b.props, x, y, h, r, seed + k)
    return b


def sign_plate(p, rect, side, u, z, w, h, mat='sign_cream', text='sign_text'):
    """A plain sign panel with bars for lettering (no brand, no real words)."""
    kit.on_face(p, rect, side, u, z, w, h, 0.12, mat, out=0.02)
    kit.on_face(p, rect, side, u, z + h * 0.35, w * 0.7, h * 0.3, 0.15, text, out=0.02)
    return p


def helipad(p, x, y, z, r=6.0):
    """A rooftop helipad: a round deck, a green H (never a cross) and edge lights."""
    p.cyl(r, r, 0.3, 'concrete_dark', T(x, y, z + 0.15), seg=24)
    p.torus(r * 0.85, 0.08, 'paint_white', T(x, y, z + 0.31), seg=24, seg_minor=4)
    for s in (-1, 1):
        p.box((0.6, r * 0.8, 0.04), 'e4_green_h', T(x + s * r * 0.25, y, z + 0.32))
    p.box((r * 0.5, 0.6, 0.04), 'e4_green_h', T(x, y, z + 0.32))
    for i in range(8):
        a = i * 6.2832 / 8
        p.box((0.2, 0.2, 0.15), 'lamp', T(x + (r - 0.25) * math.cos(a),
                                           y + (r - 0.25) * math.sin(a), z + 0.37))
    return p


def green_h_sign(p, rect, side, u, z, s=2.4):
    """The hospital's sign: a white panel with a green H (MODEL_SPEC 6: no Red Cross)."""
    kit.on_face(p, rect, side, u, z, s, s, 0.12, 'paint_white', out=0.02)
    for k in (-1, 1):
        kit.on_face(p, rect, side, u + k * s * 0.25, z + s * 0.15, s * 0.16, s * 0.7, 0.15, 'e4_green_h', out=0.02)
    kit.on_face(p, rect, side, u, z + s * 0.43, s * 0.5, s * 0.14, 0.15, 'e4_green_h', out=0.02)
    return p


def u_at(rect, side, c):
    """The u along a face of an absolute coordinate (x on the front and back, y on the sides)."""
    x0, y0, x1, y1 = rect
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return {'front': c - cx, 'back': cx - c, 'left': cy - c, 'right': c - cy}[side]


def plane_panels(p, a, b, c, d, cols, rows, lift=0.12, mat='solar', frame='solar_frame'):
    """Solar panels lying on a sloped roof plane a-b-c-d (a-b the low edge, d-c the high edge)."""
    A, B, C, D = (Vector(v) for v in (a, b, c, d))
    n = (B - A).cross(D - A).normalized()
    if n.z < 0:
        n = -n

    def q(u, v, extra=0.0):
        return A.lerp(B, u).lerp(D.lerp(C, u), v) + n * (lift + extra)
    kit.slab(p, q(0, 0), q(1, 0), q(1, 1), q(0, 1), 0.05, frame)
    for i in range(cols):
        for j in range(rows):
            u0, u1 = (i + 0.04) / cols, (i + 0.96) / cols
            v0, v1 = (j + 0.05) / rows, (j + 0.95) / rows
            kit.slab(p, q(u0, v0, 0.04), q(u1, v0, 0.04), q(u1, v1, 0.04), q(u0, v1, 0.04), 0.03, mat)
    return p


def gable_solar(p, rect, z, rise, cols, rows, margin=0.8, lift=0.12):
    """Panels on the front (-Y) slope of a gable roof whose ridge runs along x (kit.gable_roof axis 'x')."""
    x0, y0, x1, y1 = rect
    bc = (y0 + y1) / 2
    slope = rise / ((y1 - y0) / 2)
    ya, yd = y0 + 0.3, bc - 0.5
    za, zd = z + 0.3 * slope, z + (yd - y0) * slope
    return plane_panels(p, (x0 + margin, ya, za), (x1 - margin, ya, za), (x1 - margin, yd, zd), (x0 + margin, yd, zd),
                        cols, rows, lift)


def sawtooth(p, rect, z, n, h, mat='e4_roof_metal', glass='e4_glass', frame='e4_alu'):
    """A sawtooth factory roof of n teeth along y: each a slope rising toward the back and a glazed upright."""
    x0, y0, x1, y1 = rect
    step = (y1 - y0) / n
    for i in range(n):
        ya, yb = y0 + i * step, y0 + (i + 1) * step
        kit.slab(p, (x0 - 0.3, ya, z + 0.15), (x1 + 0.3, ya, z + 0.15), (x1 + 0.3, yb, z + h), (x0 - 0.3, yb, z + h),
                 0.15, mat)
        kit.block(p, x0, yb - 0.06, z, x1, yb, z + h - 0.05, glass)
        m = max(2, int((x1 - x0) / 1.6))
        for k in range(m + 1):
            x = x0 + (x1 - x0) * k / m
            kit.block(p, x - 0.04, yb - 0.1, z, x + 0.04, yb + 0.02, z + h - 0.05, frame)
    kit.block(p, x0, y0, z - 0.3, x1, y1, z, 'e4_white')
    return z + h


def arches(p, rect, side, z0, us, w, h, glass='window_dark', frame='paint_white', depth=0.12):
    """Arched openings (the south's Sino-Portuguese shophouse arcade) on a face: a rectangle and a half round top."""
    o, along, n = kit.face_frame(rect, side)
    rot = R(90, 0, 0) if side in ('front', 'back') else R(0, 90, 0)
    for u in us:
        kit.on_face(p, rect, side, u, z0, w + 0.3, h, depth, frame)
        kit.on_face(p, rect, side, u, z0, w, h, depth + 0.02, glass)
        c = o + along * u + n * (depth / 2 + 0.01)
        p.cyl(w / 2 + 0.15, w / 2 + 0.15, depth, frame, T(c.x, c.y, z0 + h) @ rot, seg=14)
        c2 = o + along * u + n * (depth / 2 + 0.02)
        p.cyl(w / 2, w / 2, depth + 0.02, glass, T(c2.x, c2.y, z0 + h) @ rot, seg=14)
    return p


def carport(p, rect, h=2.7, mat='e4_roof_metal', post='e4_graphite'):
    """A steel carport: four posts and a thin roof sloping to the back."""
    x0, y0, x1, y1 = rect
    for x in (x0 + 0.1, x1 - 0.1):
        for y in (y0 + 0.1, y1 - 0.1):
            kit.block(p, x - 0.06, y - 0.06, 0, x + 0.06, y + 0.06, h, post)
    kit.slab(p, (x0, y0, h + 0.15), (x1, y0, h + 0.15), (x1, y1, h - 0.05), (x0, y1, h - 0.05), 0.06, mat)
    kit.bands(p, rect, h - 0.1, 0.12, 0.03, post)
    return p


def stall_counter(p, x, y, w=2.2, d=0.9, goods=('flower_red', 'leaf_light', 'paint_orange', 'banana_fruit'),
                  top='steel', body='e4_white', facing=0.0):
    """A modern market counter: a tiled base, a steel top and trays of goods (cheap boxes)."""
    m = T(x, y, 0) @ R(0, 0, facing)
    p.box((w, d, 0.85), body, m @ T(0, 0, 0.425))
    p.box((w + 0.06, d + 0.06, 0.05), top, m @ T(0, 0, 0.875))
    n = max(2, int(w / 0.55))
    for i in range(n):
        lx = -w / 2 + w * (i + 0.5) / n
        p.box((w / n - 0.08, d * 0.7, 0.14), goods[i % len(goods)], m @ T(lx, 0, 0.97))
    return p


def picnic(p, x, y, w=1.8, top='teak_light', frame='e4_alu'):
    """A food-hall table with two benches."""
    p.box((w, 0.8, 0.05), top, T(x, y, 0.75))
    p.box((0.1, 0.6, 0.72), frame, T(x, y, 0.36))
    for s in (-1, 1):
        p.box((w, 0.3, 0.05), top, T(x, y + s * 0.7, 0.45))
    return p


def flat_roof(p, rect, z, mat='concrete_light', parapet=0.9, parapet_mat=None, thick=0.25, coping=None):
    """kit.flat_roof with the coping as a ring on the parapet (kit's coping is a full slab over the roof)."""
    zt = kit.flat_roof(p, rect, z, mat, parapet=parapet, parapet_mat=parapet_mat, thick=thick)
    if coping and parapet > 0:
        x0, y0, x1, y1 = rect
        t, o = 0.2, 0.04
        kit.block(p, x0 - o, y0 - o, zt, x1 + o, y0 + t, zt + 0.08, coping)
        kit.block(p, x0 - o, y1 - t, zt, x1 + o, y1 + o, zt + 0.08, coping)
        kit.block(p, x0 - o, y0 + t, zt, x0 + t, y1 - t, zt + 0.08, coping)
        kit.block(p, x1 - t, y0 + t, zt, x1 + o, y1 - t, zt + 0.08, coping)
        zt += 0.08
    return zt
