# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The parts of era 5, the future city (assets/concept/era5_A_house.jpg, era5_B_town.jpg): rounded slabs and
curved balconies, timber louvres, glass with mullions, planted terraces, green towers, solar gables and arrays,
drone pads, wind turbines, glass domes, maglev tubes, robot lockers and delivery robots, rain gardens.

Thai roof lines stay as modern gables (regions.small_roof, solar_roof): never a spire, ช่อฟ้า, ใบระกา or หางหงส์.
Every function draws into a mesh.Part in true metres; X right, Y back (the front faces -Y), Z up.
"""

import math

from mathutils import Vector

from . import kit, palette, props, regions
from . import props_region as pr
from .mesh import R, S, T

# Era 5's own colours (prefix e5_), added to the palette at import time.
for _k, _v in {
    'e5_cream': '#F0E2C2', 'e5_mint': '#DCE8CC', 'e5_glow': '#8EE05A', 'e5_grow': '#E27BCB',
    'e5_tube': '#EEF2F1', 'e5_hgreen': '#2FA36B', 'e5_battery': '#5D7A8C', 'e5_reactor': '#E3EAEC',
    'e5_soil': '#6B4A33', 'e5_court': '#5E9E7A', 'e5_track': '#C0623E', 'e5_glass_light': '#B9DCE0',
    'e5_sky_glass': '#9CC9D6', 'e5_pool': '#6FC3CF', 'e5_shade': '#F7F3E8',
}.items():
    palette.COLORS.setdefault(_k, _v)
palette.EMISSIVE.setdefault('e5_glow', 1.0)
palette.EMISSIVE.setdefault('e5_grow', 0.8)

LEAVES = ('leaf', 'leaf_dark', 'leaf_light')

# The region's dress over the future city: walls, floor bands, louvres, roof, trim.
DRESS = {
    'northeast': {'wall': 'e5_cream', 'wall2': 'plaster_white', 'band': 'laterite', 'louvre': 'timber',
                  'roof': 'clay_tile', 'glass': 'glass', 'accent': 'clay_tile_light', 'path': 'laterite'},
    'north': {'wall': 'e5_cream', 'wall2': 'plaster', 'band': 'teak', 'louvre': 'teak_dark',
              'roof': 'clay_tile_dark', 'glass': 'glass', 'accent': 'teak_light', 'path': 'stone_pale'},
    'central': {'wall': 'plaster_white', 'wall2': 'e5_cream', 'band': 'clay_tile', 'louvre': 'teak',
                'roof': 'clay_tile', 'glass': 'glass', 'accent': 'clay_tile_light', 'path': 'paving_dark'},
    'east': {'wall': 'e5_cream', 'wall2': 'plaster_peach', 'band': 'clay_tile_light', 'louvre': 'teak_light',
             'roof': 'roof_green', 'glass': 'glass_green', 'accent': 'paint_green', 'path': 'paving_dark'},
    'west': {'wall': 'e5_mint', 'wall2': 'e5_cream', 'band': 'timber', 'louvre': 'bamboo',
             'roof': 'clay_tile', 'glass': 'glass_green', 'accent': 'bamboo_dark', 'path': 'paving_dark'},
    'south': {'wall': 'plaster_yellow', 'wall2': 'plaster_white', 'band': 'plaster_white', 'louvre': 'teak',
              'roof': 'clay_tile_light', 'glass': 'glass', 'accent': 'plaster_sky', 'path': 'sand'},
}


def dress(region, i=0):
    """The colours of one building; the south's walls take its pastels in turn."""
    d = dict(DRESS[region])
    if region == 'south':
        d['wall'] = regions.plaster(region, i)
    d['trim'] = regions.style(region)['trim']
    d['region'] = region
    return d


# shapes -----------------------------------------------------------------------------------------------------------------

def rrect(x0, y0, x1, y1, r, seg=3):
    """A rectangle's outline with rounded corners, counter-clockwise. r is one radius or four, in the order
    front-right, back-right, back-left, front-left."""
    rs = r if isinstance(r, (tuple, list)) else (r, r, r, r)
    lim = min(x1 - x0, y1 - y0) / 2 - 1e-3
    corners = ((x1, y0, -90), (x1, y1, 0), (x0, y1, 90), (x0, y0, 180))
    pts = []
    for (cx, cy, a0), rr in zip(corners, rs):
        rr = max(0.0, min(rr, lim))
        if rr < 0.02:
            pts.append((cx, cy))
            continue
        ox = cx - rr if cx == x1 else cx + rr
        oy = cy + rr if cy == y0 else cy - rr
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((ox + rr * math.cos(a), oy + rr * math.sin(a)))
    return pts


def ellipse(cx, cy, rx, ry, n=24):
    return [(cx + rx * math.cos(math.tau * i / n), cy + ry * math.sin(math.tau * i / n)) for i in range(n)]


def prism(p, pts, z0, z1, mat):
    """A flat outline (counter-clockwise) standing from z0 to z1."""
    if z1 - z0 < 1e-4:
        return p
    return p.poly_prism(pts, z1 - z0, mat, T(0, 0, (z0 + z1) / 2))


def rbox(p, x0, y0, z0, x1, y1, z1, r, mat, seg=3):
    """A box with rounded upright corners."""
    return prism(p, rrect(x0, y0, x1, y1, r, seg), z0, z1, mat)


def ring_band(p, pts, z0, h, t, mat, closed=True):
    """A thin wall along an outline: parapets, glass railings, curved balcony fronts."""
    seq = list(pts) + ([pts[0]] if closed else [])
    for a, c in zip(seq, seq[1:]):
        dx, dy = c[0] - a[0], c[1] - a[1]
        length = math.hypot(dx, dy)
        if length < 1e-3:
            continue
        p.box((length + t * 0.9, t, h), mat, T((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, z0 + h / 2)
              @ R(0, 0, math.degrees(math.atan2(dy, dx))))
    return p


def glass_rail(p, pts, z, closed=False, h=1.05, frame='steel'):
    """A glass balustrade with a slim top rail along an outline."""
    ring_band(p, pts, z, h - 0.06, 0.04, 'e5_glass_light', closed)
    ring_band(p, pts, z + h - 0.06, 0.06, 0.08, frame, closed)
    return p


def face_rect(rect, side, u, w, d0, d1):
    """The axis-aligned rectangle in front of a wall face: w wide round u, from d0 to d1 metres out of it."""
    o, along, n = kit.face_frame(rect, side)
    a = o + along * (u - w / 2) + n * d0
    c = o + along * (u + w / 2) + n * d1
    return (min(a.x, c.x), min(a.y, c.y), max(a.x, c.x), max(a.y, c.y))


def inset(rect, d):
    x0, y0, x1, y1 = rect
    return (x0 + d, y0 + d, x1 - d, y1 - d)


# walls and openings ----------------------------------------------------------------------------------------------------

def louvres(p, rect, side, z0, z1, u0=None, u1=None, spacing=0.4, depth=0.3, w=0.08, mat='timber', out=0.02):
    """Vertical timber fins (บานเกล็ดไม้) along a face from u0 to u1."""
    fw = kit.face_width(rect, side)
    u0 = -fw / 2 + 0.15 if u0 is None else u0
    u1 = fw / 2 - 0.15 if u1 is None else u1
    n = max(1, int(abs(u1 - u0) / spacing))
    for i in range(n + 1):
        u = u0 + (u1 - u0) * i / n
        kit.on_face(p, rect, side, u, z0, w, z1 - z0, depth, mat, out=out)
    return p


def glass_facade(p, rect, z0, z1, glass='glass', frame='steel', spacing=1.5, floors=0, sides=kit.SIDES):
    """A glass box with mullions on its faces and a transom at every floor."""
    x0, y0, x1, y1 = rect
    kit.block(p, x0, y0, z0, x1, y1, z1, glass)
    for side in sides:
        fw = kit.face_width(rect, side)
        n = max(1, int(fw / spacing))
        for i in range(1, n):
            kit.on_face(p, rect, side, -fw / 2 + fw * i / n, z0, 0.06, z1 - z0, 0.05, frame)
    if floors > 1:
        fh = (z1 - z0) / floors
        for k in range(1, floors):
            kit.bands(p, rect, z0 + fh * k - 0.05, 0.1, 0.03, frame)
    return p


def window(p, rect, side, u, z0, w, h, d, transom=True):
    """A big modern window: a timber frame, light glass, a mullion, a transom and a sill in the band colour."""
    kit.window(p, rect, side, u, z0, w, h, frame=d['trim'], glass=d['glass'], sill=d['band'], mullion=True)
    if transom:
        kit.on_face(p, rect, side, u, z0 + h * 0.68, w, 0.05, 0.09, d['trim'])
    if w > 2.0:
        for s in (-1, 1):
            kit.on_face(p, rect, side, u + s * w / 4, z0, 0.04, h, 0.09, d['trim'])
    return p


def glass_door(p, rect, side, u, z0, d, w=1.8, h=2.4):
    kit.on_face(p, rect, side, u, z0, w + 0.16, h + 0.08, 0.06, d['trim'])
    kit.on_face(p, rect, side, u, z0, w, h, 0.08, d['glass'])
    kit.on_face(p, rect, side, u, z0, 0.05, h, 0.1, d['trim'])
    kit.on_face(p, rect, side, u, z0 + h + 0.1, w + 0.8, 0.12, 0.9, d['wall'])  # a slim canopy
    return p


def green_wall(p, rect, side, u, z0, w, h, seed=0, out=0.02):
    """A living wall: a frame of planted panels in three greens."""
    rnd = props._rng(seed + 41)
    kit.on_face(p, rect, side, u, z0, w, h, 0.08, 'e5_soil', out=out)
    nx = max(1, int(w / 0.9))
    nz = max(1, int(h / 0.9))
    for i in range(nx):
        for j in range(nz):
            uu = u - w / 2 + w * (i + 0.5) / nx
            zz = z0 + h * j / nz + 0.05
            kit.on_face(p, rect, side, uu, zz, w / nx - 0.06, h / nz - 0.1, 0.12 + rnd() * 0.12,
                        LEAVES[int(rnd() * 3)], out=out + 0.05)
    return p


def garden_strip(p, rect, side, u, z0, floors, fh, w=2.4, seed=0, out=0.1):
    """A vertical garden up a tower face: one planted panel per floor in alternating greens, on a dark frame."""
    rnd = props._rng(seed + 5)
    kit.on_face(p, rect, side, u, z0, w + 0.2, floors * fh, 0.1, 'e5_soil', out=out)
    for i in range(floors):
        kit.on_face(p, rect, side, u + (rnd() - 0.5) * 0.3, z0 + i * fh + 0.05, w - rnd() * 0.5, fh - 0.4,
                    0.25 + rnd() * 0.2, LEAVES[int(rnd() * 3)], out=out + 0.1)
    return p


def glow_line(p, pts, z, closed=True):
    """The thin green light along a slab edge, as on the concept's towers."""
    return ring_band(p, pts, z, 0.07, 0.07, 'e5_glow', closed)


# plants ---------------------------------------------------------------------------------------------------------------

def shrub(p, x, y, z=0.0, r=0.5, seed=0, mat=None):
    p.sphere(r, mat or LEAVES[seed % 3], T(x, y, z + r * 0.55) @ S(1, 1, 0.8), seg=6, rings=4)
    return p


def small_tree(p, x, y, z=0.0, h=3.2, r=1.2, seed=0):
    """A small tree for a terrace or a roof garden (light: the towers carry many)."""
    rnd = props._rng(seed + 17)
    p.cyl(0.08, 0.05, h * 0.62, 'trunk', T(x, y, z + h * 0.31), seg=5)
    for i in range(2):
        a = rnd() * math.tau
        rr = r * (0.7 + 0.3 * rnd())
        p.sphere(rr, LEAVES[(seed + i) % 3], T(x + math.cos(a) * r * 0.3, y + math.sin(a) * r * 0.3,
                                               z + h * (0.68 + 0.18 * i)) @ S(1, 1, 0.8), seg=7, rings=5)
    return p


def planter(main, plants, rect, z, h=0.6, mat='concrete_dark', seed=0, step=1.4, flowers=True, tall=0, bevel=0.08):
    """A planter box with a clipped hedge and shrubs along it; tall adds that many small trees."""
    x0, y0, x1, y1 = rect
    kit.block(main, x0, y0, z, x1, y1, z + h, mat)
    kit.block(main, x0 + 0.06, y0 + 0.06, z + h, x1 - 0.06, y1 - 0.06, z + h + 0.03, 'e5_soil')
    kit.block(plants, x0 + 0.05, y0 + 0.05, z + h, x1 - 0.05, y1 - 0.05, z + h + 0.32, 'leaf_dark', bevel=bevel)
    long_x = (x1 - x0) >= (y1 - y0)
    length = (x1 - x0) if long_x else (y1 - y0)
    n = max(1, int(length / step))
    rnd = props._rng(seed + 3)
    for i in range(n):
        t = (i + 0.5) / n
        x = x0 + (x1 - x0) * t if long_x else (x0 + x1) / 2
        y = (y0 + y1) / 2 if long_x else y0 + (y1 - y0) * t
        shrub(plants, x, y, z + h + 0.1, 0.32 + rnd() * 0.22, seed + i,
              'flower_pink' if flowers and (i + seed) % 4 == 1 else None)
    for k in range(tall):
        t = (k + 0.5) / tall
        x = x0 + (x1 - x0) * t if long_x else (x0 + x1) / 2
        y = (y0 + y1) / 2 if long_x else y0 + (y1 - y0) * t
        small_tree(plants, x, y, z + h, 2.6 + rnd() * 1.2, 1.0, seed + k)
    return main


def bamboo_pot(p, x, y, z=0.0, h=3.0, seed=0):
    """Bamboo in a round concrete planter, as by the concept's front door."""
    p.cyl(0.6, 0.55, 0.55, 'concrete_light', T(x, y, z + 0.275), seg=14)
    p.cyl(0.55, 0.55, 0.03, 'e5_soil', T(x, y, z + 0.56), seg=14)
    pr.bamboo_clump(p, x, y, h, n=3, seed=seed + 11)
    return p


def rain_garden(main, plants, x0, y0, x1, y1, seed=0):
    """A sunken rain garden (สวนซับน้ำฝน): a gravel edge, still water, reeds and stepping stones."""
    kit.block(main, x0, y0, 0.0, x1, y1, 0.08, 'gravel')
    kit.block(main, x0 + 0.3, y0 + 0.3, 0.0, x1 - 0.3, y1 - 0.3, 0.1, 'e5_pool')
    rnd = props._rng(seed + 9)
    n = max(2, int((x1 - x0 + y1 - y0) / 1.2))
    for i in range(n):
        x = x0 + 0.4 + rnd() * (x1 - x0 - 0.8)
        y = y0 + 0.4 + rnd() * (y1 - y0 - 0.8)
        props.grass_tuft(plants, x, y, 0.6 + rnd() * 0.4, ('leaf', 'leaf_light')[i % 2])
    for i in range(3):
        t = (i + 0.5) / 3
        plants.cyl(0.3, 0.32, 0.14, 'stone', T(x0 + (x1 - x0) * t, (y0 + y1) / 2 + (i % 2 - 0.5) * 0.4, 0.07),
                   seg=8)
    return main


def lawn(b, x0, y0, x1, y1, mat='grass'):
    kit.block(b.yard, x0, y0, 0.0, x1, y1, 0.06, mat)
    return b


# roofs and energy -------------------------------------------------------------------------------------------------------

def panels_on_plane(p, base, u, v, width, length, pw=1.0, ph=1.65, gap=0.06, lift=0.05, t0=0.06, t1=0.92,
                    half_at=None):
    """Solar panels laid on a sloping plane: base is the middle of its lower edge, u along it, v up the slope."""
    u, v, base = Vector(u).normalized(), Vector(v).normalized(), Vector(base)
    nrm = u.cross(v).normalized()
    if nrm.z < 0:
        nrm = -nrm
    rows = int(length * (t1 - t0) / (ph + gap))
    for j in range(rows):
        cv = length * t0 + j * (ph + gap)
        w = width if half_at is None else min(width, 2 * half_at((cv + ph) / length) - 0.3)
        cols = int(w / (pw + gap))
        for i in range(cols):
            cu = (i - (cols - 1) / 2) * (pw + gap)
            c = base + u * cu + v * cv + nrm * lift
            a, b = c - u * pw / 2, c + u * pw / 2
            top = nrm * 0.05
            kit.slab(p, a + top, b + top, b + v * ph + top, a + v * ph + top, 0.05, 'solar')
    return p


def solar_roof(p, rect, z, d, axis='y', pitch=0.55, over=0.6, over_ends=0.5, panels='both', fill=None,
               thick=0.22):
    """The house roof of the future: a modern gable in the region's way (plain in Isan, กาแล boards in the north,
    upturned bargeboard ends in central, east and west; a hip in the south) covered in solar panels. No spire and
    no temple ornaments. Returns the ridge height."""
    region = d['region']
    st = regions.style(region)
    x0, y0, x1, y1 = rect
    span = (y1 - y0) if axis == 'x' else (x1 - x0)
    rise = span / 2 * pitch
    mat = d['roof']
    if st['roof'] == 'hip':
        rise *= 0.85
        top = kit.hip_roof(p, rect, z, rise, mat, over=over, thick=thick)
        ex0, ey0, ex1, ey1 = x0 - over, y0 - over, x1 + over, y1 + over
        w, dd = ex1 - ex0, ey1 - ey0
        slope = rise / (min(w, dd) / 2)
        ez = z - over * slope * 0.5
        cx, cy = (ex0 + ex1) / 2, (ey0 + ey1) / 2
        ridge = abs(w - dd)
        if panels:
            rx = ridge / 2 if w >= dd else 0.0
            ry = ridge / 2 if w < dd else 0.0
            sides = [('front', (cx, ey0, ez), (cx, cy - ry, top), (1, 0, 0), w / 2, rx),
                     ('left', (ex0, cy, ez), (cx - rx, cy, top), (0, 1, 0), dd / 2, ry),
                     ('right', (ex1, cy, ez), (cx + rx, cy, top), (0, 1, 0), dd / 2, ry)]
            if panels == 'both':
                sides.append(('back', (cx, ey1, ez), (cx, cy + ry, top), (1, 0, 0), w / 2, rx))
            for _, base, q, u, half_eave, half_ridge in sides:
                base, q = Vector(base), Vector(q)
                panels_on_plane(p, base, u, q - base, 2 * half_eave, (q - base).length, t1=0.85,
                                half_at=lambda t, a=half_eave, r=half_ridge: a * (1 - t) + r * t)
        return top
    top = kit.gable_roof(p, rect, z, rise, mat, over=over, over_ends=over_ends, axis=axis, thick=thick,
                         fill=fill or d['wall'], barge=d['trim'])
    regions.gable_dress(p, rect, z, rise, region, axis, over, over_ends)
    if panels:
        if axis == 'x':
            a0, a1, bc, e0, e1 = x0 - over_ends, x1 + over_ends, (y0 + y1) / 2, y0 - over, y1 + over
        else:
            a0, a1, bc, e0, e1 = y0 - over_ends, y1 + over_ends, (x0 + x1) / 2, x0 - over, x1 + over
        half = abs(bc - e0) - over
        ez = z - over * rise / max(half, 0.1)
        ac = (a0 + a1) / 2
        for k, e in enumerate((e0, e1)):
            if panels == 'front' and k == 1:
                continue
            if axis == 'x':
                base, q, u = Vector((ac, e, ez)), Vector((ac, bc, top)), (1, 0, 0)
            else:
                base, q, u = Vector((e, ac, ez)), Vector((bc, ac, top)), (0, 1, 0)
            panels_on_plane(p, base, u, q - base, (a1 - a0) - 0.6, (q - base).length)
    return top


def solar_array(p, x0, y0, x1, y1, z, tilt=12.0, pw=1.0, ph=1.65):
    """Rows of tilted panels filling a flat rectangle, facing south (-Y, the front)."""
    cols = max(1, int((x1 - x0) / (pw + 0.05)))
    row_d = ph * math.cos(math.radians(tilt)) + 0.7
    rows = max(1, int((y1 - y0) / row_d))
    for j in range(rows):
        y = y0 + row_d * (j + 0.5)
        props.solar_panels(p, (x0 + x1) / 2, y, z, cols, 1, tilt, 0.0, pw, ph)
    return p


def solar_pergola(main, rect, z, h=2.6, post='steel'):
    """A pergola whose roof is solar glass, on slim posts."""
    x0, y0, x1, y1 = rect
    nx = max(2, int((x1 - x0) / 3.5) + 1)
    for i in range(nx):
        x = x0 + 0.1 + (x1 - x0 - 0.2) * i / (nx - 1)
        for y in (y0 + 0.1, y1 - 0.1):
            main.cyl(0.07, 0.07, h, post, T(x, y, z + h / 2), seg=8)
    kit.block(main, x0, y0, z + h, x1, y1, z + h + 0.1, 'solar_frame')
    cols = max(1, int((x1 - x0) / 1.05))
    rows = max(1, int((y1 - y0) / 1.7))
    for i in range(cols):
        for j in range(rows):
            cx = x0 + (x1 - x0) * (i + 0.5) / cols
            cy = y0 + (y1 - y0) * (j + 0.5) / rows
            main.box(((x1 - x0) / cols - 0.06, (y1 - y0) / rows - 0.06, 0.04), 'solar', T(cx, cy, z + h + 0.12))
    return main


def solar_tree(p, x, y, h=5.0, arms=4, seed=0):
    """A 'solar tree' for a plaza: a steel trunk with panels on branching arms."""
    p.cyl(0.14, 0.1, h, 'steel', T(x, y, h / 2), seg=8)
    for i in range(arms):
        a = math.tau * i / arms + seed
        zz = h * (0.7 + 0.15 * (i % 2))
        tip = (x + math.cos(a) * 1.4, y + math.sin(a) * 1.4, zz + 0.5)
        p.rod((x, y, zz - 0.4), tip, 0.05, 'steel', seg=5)
        p.box((1.3, 1.0, 0.05), 'solar', T(*tip) @ R(0, 0, math.degrees(a)) @ R(0, -12, 0))
    p.box((1.6, 1.2, 0.05), 'solar', T(x, y, h + 0.05))
    return p


def wind_turbine(p, x, y, z, h=12.0, r=3.0, facing=0.0, blade_angle=20.0):
    """A small horizontal-axis wind turbine on a slim mast, its blades facing the front."""
    m = T(x, y, z) @ R(0, 0, facing)
    p.cyl(0.18, 0.1, h, 'paint_white', m @ T(0, 0, h / 2), seg=10)
    p.box((0.4, 1.2, 0.45), 'paint_white', m @ T(0, 0.2, h + 0.2), bevel=0.08)
    p.sphere(0.25, 'paint_white', m @ T(0, -0.45, h + 0.2) @ S(1, 1.4, 1), seg=10, rings=6)
    for k in range(3):
        a = blade_angle + k * 120
        p.box((0.3, 0.06, r), 'paint_white', m @ T(0, -0.55, h + 0.2) @ R(0, a, 0) @ T(0, 0, r / 2 + 0.15))
    return p


def vawt(p, x, y, z, h=3.0, r=0.8, mat='paint_white'):
    """A vertical-axis wind turbine (the twisted kind on roofs)."""
    p.cyl(0.06, 0.06, h + 0.8, 'steel', T(x, y, z + (h + 0.8) / 2), seg=6)
    for k in range(3):
        pts = []
        for i in range(6):
            t = i / 5
            a = math.tau * k / 3 + t * 1.6
            pts.append((x + math.cos(a) * r, y + math.sin(a) * r, z + 0.8 + t * h))
        for a_, c_ in zip(pts, pts[1:]):
            p.rod(a_, c_, 0.06, mat, seg=4)
    for zz in (z + 0.8, z + 0.8 + h):
        for k in range(3):
            a = math.tau * k / 3 + (0 if zz == z + 0.8 else 1.6)
            p.rod((x, y, zz), (x + math.cos(a) * r, y + math.sin(a) * r, zz), 0.03, 'steel', seg=4)
    return p


def drone_with_parcel(p, x, y, z, size=0.8):
    props.drone(p, x, y, z, size)
    p.box((0.32, 0.32, 0.26), 'cream', T(x, y, z - 0.25), bevel=0.02)
    return p


# street things ----------------------------------------------------------------------------------------------------------

def robot_locker(p, x, y, facing=0.0, w=3.0, h=2.0, cols=6, rows=4, roof=True):
    """A delivery robot locker (ตู้รับพัสดุ): a grid of doors with a screen, under a slim solar canopy."""
    m = T(x, y, 0) @ R(0, 0, facing)
    p.box((w, 0.7, h), 'robot_white', m @ T(0, 0, h / 2), bevel=0.04)
    cw, ch = w / cols, (h - 0.3) / rows
    for i in range(cols):
        for j in range(rows):
            if i == cols // 2 and j in (rows // 2, rows // 2 - 1):
                continue
            p.box((cw - 0.07, 0.04, ch - 0.07), ('steel', 'grey')[(i + j) % 2],
                  m @ T(-w / 2 + cw * (i + 0.5), -0.36, 0.2 + ch * (j + 0.5)))
    p.box((cw - 0.1, 0.05, ch * 1.6), 'screen_lit', m @ T(-w / 2 + cw * (cols // 2 + 0.5), -0.37, 0.2 + ch * rows / 2))
    p.box((w, 0.05, 0.08), 'e5_glow', m @ T(0, -0.37, h - 0.06))
    if roof:
        p.box((w + 0.4, 1.3, 0.08), 'solar', m @ T(0, -0.2, h + 0.15))
    return p


def delivery_robot(p, x, y, facing=0.0, mat='robot_white'):
    """A six-wheeled sidewalk delivery robot, 0.7 m long, with its flag light."""
    m = T(x, y, 0) @ R(0, 0, facing)
    p.box((0.55, 0.7, 0.42), mat, m @ T(0, 0, 0.36), bevel=0.06)
    p.box((0.4, 0.04, 0.12), 'screen_lit', m @ T(0, -0.36, 0.42))
    for sx in (-1, 1):
        for sy in (-0.25, 0.0, 0.25):
            p.cyl(0.09, 0.09, 0.06, 'black', m @ T(sx * 0.3, sy, 0.1) @ R(0, 90, 0), seg=8)
    p.rod(m @ Vector((0.2, 0.3, 0.55)), m @ Vector((0.2, 0.3, 1.2)), 0.008, 'iron', seg=3)
    p.sphere(0.04, 'paint_orange', m @ T(0.2, 0.3, 1.22), seg=6, rings=3)
    return p


def mower_robot(p, x, y, facing=0.0):
    m = T(x, y, 0) @ R(0, 0, facing)
    p.box((0.6, 0.8, 0.25), 'robot_white', m @ T(0, 0, 0.2), bevel=0.08)
    p.box((0.4, 0.4, 0.06), 'paint_orange', m @ T(0, 0.05, 0.34), bevel=0.02)
    for sx in (-1, 1):
        p.cyl(0.14, 0.14, 0.06, 'black', m @ T(sx * 0.32, 0.22, 0.14) @ R(0, 90, 0), seg=10)
    return p


def bench(p, x, y, length=2.0, facing=0.0, mat='timber'):
    """A curved-ended timber bench on a concrete base."""
    m = T(x, y, 0) @ R(0, 0, facing)
    p.box((length, 0.5, 0.4), 'concrete_light', m @ T(0, 0, 0.2), bevel=0.08)
    for k in range(4):
        p.box((length - 0.1, 0.1, 0.05), mat, m @ T(0, -0.18 + k * 0.12, 0.43))
    return p


def lamp_post(p, x, y, h=4.5):
    """A slim solar street light."""
    p.cyl(0.06, 0.05, h, 'steel', T(x, y, h / 2), seg=8)
    p.box((0.7, 0.45, 0.04), 'solar', T(x, y, h + 0.1) @ R(-15, 0, 0))
    p.cyl(0.18, 0.18, 0.1, 'lamp', T(x, y, h - 0.15), seg=10)
    return p


def bollards(p, pts, h=0.7):
    for x, y in pts:
        props.bollard_light(p, x, y, h)
    return p


def charger(p, x, y, facing=0.0):
    """A charging post for e-bikes and pods."""
    m = T(x, y, 0) @ R(0, 0, facing)
    p.box((0.35, 0.25, 1.3), 'robot_white', m @ T(0, 0, 0.65), bevel=0.05)
    p.box((0.22, 0.03, 0.3), 'screen_lit', m @ T(0, -0.13, 1.0))
    p.box((0.36, 0.03, 0.06), 'e5_glow', m @ T(0, -0.13, 1.25))
    return p


# big pieces -------------------------------------------------------------------------------------------------------------

def dome(p, x, y, z, r, mat='e5_sky_glass', ribs=12, rib_mat='steel', squash=1.0, rings=(0.35, 0.65), seg=24):
    """A glass dome with steel ribs and rings."""
    p.cap(r, mat, T(x, y, z) @ S(1, 1, squash), keep=lambda co: co.z >= z - 0.01, seg=seg, rings=12)
    n = 7
    for k in range(ribs):
        a = math.tau * k / ribs
        pts = []
        for i in range(n):
            phi = (math.pi / 2) * i / (n - 1)
            rr = (r + 0.04) * math.cos(phi)
            pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr, z + (r + 0.04) * math.sin(phi) * squash))
        for a_, c_ in zip(pts, pts[1:]):
            p.rod(a_, c_, 0.07, rib_mat, seg=4, smooth=False)
    for t in rings:
        phi = math.asin(t)
        p.torus((r + 0.03) * math.cos(phi), 0.06, rib_mat, T(x, y, z + r * t * squash), seg=seg, seg_minor=4)
    p.torus(r + 0.05, 0.12, rib_mat, T(x, y, z + 0.05), seg=seg, seg_minor=4)
    return p


def vault(p, x0, x1, yc, half, z, rise, t=0.15, mat='e5_shade', n=10):
    """A barrel vault running along X: an arc of span 2*half rising by rise above z, t thick."""
    outer, inner = [], []
    for i in range(n + 1):
        a = math.pi * i / n
        outer.append((yc + half * math.cos(a), z + rise * math.sin(a)))
        inner.append((yc + (half - t) * math.cos(a), z + (rise - t) * math.sin(a)))
    pts = outer + list(reversed(inner))
    kit.prism_x(p, pts, x0, x1, mat)
    return p


def guideway(main, x0, x1, y, z, w=3.2, piers=None, mat='concrete_light'):
    """A raised maglev guideway along X: a rounded beam with its rail and Y-shaped piers."""
    rbox(main, x0, y - w / 2, z - 1.1, x1, y + w / 2, z, 0.0, mat)
    kit.block(main, x0, y - 0.5, z, x1, y + 0.5, z + 0.25, 'steel')
    for s in (-1, 1):
        kit.block(main, x0, y + s * (w / 2 - 0.1) - 0.08, z, x1, y + s * (w / 2 - 0.1) + 0.08, z + 0.5, 'e5_tube')
    for px in (piers or ()):
        main.cyl(0.55, 0.7, z - 1.1, mat, T(px, y, (z - 1.1) / 2), seg=12)
        main.box((1.2, w - 0.4, 0.8), mat, T(px, y, z - 1.5), bevel=0.15)
    return main


def maglev_train(p, x0, x1, y, z, cars=2):
    """A sleek maglev train on the guideway: rounded white cars with a window band and a green stripe."""
    length = (x1 - x0) / cars
    for c in range(cars):
        cx = x0 + length * (c + 0.5)
        L = length - 0.3
        p.sphere(1.0, 'robot_white', T(cx, y, z + 1.6) @ S(L / 2, 1.45, 1.35), seg=20, rings=10)
        p.box((L * 0.8, 2.95, 0.7), 'window_dark', T(cx, y, z + 2.0))
        p.box((L * 0.85, 2.92, 0.12), 'e5_glow', T(cx, y, z + 1.1))
    return p


def tube(p, x0, x1, y, z, r=2.0, mat='e5_tube', rings_every=4.0, window=True):
    """A raised hyperloop-like tube along X with ribs and a glass strip."""
    p.cyl(r, r, x1 - x0, mat, T((x0 + x1) / 2, y, z) @ R(0, 90, 0), seg=20)
    n = max(1, int((x1 - x0) / rings_every))
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        p.torus(r + 0.06, 0.1, 'steel', T(x, y, z) @ R(0, 90, 0), seg=20, seg_minor=4)
    if window:
        p.box((x1 - x0 - 0.4, 0.06, 0.6), 'e5_sky_glass', T((x0 + x1) / 2, y - r + 0.05, z + 0.2))
    return p


def sky_bridge(main, x0, y0, x1, y1, z, h=3.4, d=None):
    """A glass bridge between two towers with a planted roof."""
    kit.block(main, x0, y0, z - 0.4, x1, y1, z, d['wall'] if d else 'e5_cream')
    glass_facade(main, (x0, y0 + 0.1, x1, y1 - 0.1), z, z + h, 'e5_sky_glass', 'steel', 1.2)
    kit.block(main, x0, y0, z + h, x1, y1, z + h + 0.4, d['wall'] if d else 'e5_cream')
    kit.block(main, x0 + 0.1, y0 + 0.1, z + h + 0.4, x1 - 0.1, y1 - 0.1, z + h + 0.65, 'leaf_dark', bevel=0.06)
    return main


def drone_pad_raised(main, plants, x, y, z, r=2.2, drones=1):
    """A drone pad on a roof with its charging lights, and a drone or two."""
    props.drone_pad(main, x, y, z, r)
    for k in range(drones):
        props.drone(plants, x + (k - (drones - 1) / 2) * 1.1, y + 0.2 * k, z + 0.35 + 0.0 * k, 0.8)
    return main


def thai_crown(b, rect, z, d, h=3.4, glass=True, mat=None, axis='y'):
    """A roof pavilion of glass under the region's own small roof (the Thai roof line kept as a modern gable:
    กาแล boards in the north, a hip in the south, plain in Isan), in place of the concept's spires."""
    p = b.main
    x0, y0, x1, y1 = rect
    if glass:
        glass_facade(p, rect, z, z + h, d['glass'], d['trim'], 1.3)
    else:
        kit.walls(p, rect, z, z + h, d['wall'])
    kit.bands(p, rect, z + h - 0.2, 0.2, 0.06, d['band'])
    return regions.small_roof(p, rect, z + h, d['region'], mat=mat or d['roof'], axis=axis, over=0.6)


def parapet(b, rect, z, d, r=1.0, h=1.0, glow=True):
    """A rounded parapet round a flat roof (and the green light along its top)."""
    x0, y0, x1, y1 = rect
    pts = rrect(x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, max(0.0, r - 0.1), 3)
    ring_band(b.main, pts, z, h, 0.2, d['wall'])
    if glow:
        glow_line(b.main, rrect(x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, max(0.0, r - 0.1), 3), z + h)
    return b


def terrace(b, rect, side, u, w, depth, z, d, seed=0, tree=False, rail=False):
    """A terrace jutting out of a tower face at floor height z: a rounded slab, a planter along its edge with a
    hedge and shrubs (and a small tree), a green light under the edge."""
    tr = face_rect(rect, side, u, w, -0.2, depth)
    x0, y0, x1, y1 = tr
    rad = min(1.2, depth * 0.55)
    rbox(b.main, x0, y0, z - 0.3, x1, y1, z, rad, d['wall'], 2)
    pr_ = face_rect(rect, side, u, w - 0.5, depth - 0.65, depth - 0.1)
    planter(b.main, b.props, pr_, z, 0.55, d['band'], seed, step=2.0, tall=1 if tree else 0, bevel=0.0)
    o, along, n = kit.face_frame(rect, side)
    a = o + along * (u - w / 2 + rad) + n * (depth + 0.02)
    c = o + along * (u + w / 2 - rad) + n * (depth + 0.02)
    glow_line(b.main, [(a.x, a.y), (c.x, c.y)], z - 0.2, closed=False)
    if rail:
        glass_rail(b.main, [(a.x, a.y), (c.x, c.y)], z + 0.55, closed=False, h=0.5)
    return b


def tower(b, rect, z0, floors, fh, d, seed=0, r=1.8, fins=('front',), fin_span=0.45, terraces=None, glass=None,
          piers=True, band_every=5, slab_ext=0.3):
    """A green tower: a glass core with mullions, rounded corner piers, a rounded slab band at every floor (the
    region's band colour every few floors), timber fins on part of some faces and planted terraces.

    terraces: a function floor -> list of (side, u, w, depth, tree) for that floor, or None."""
    p = b.main
    x0, y0, x1, y1 = rect
    z1 = z0 + floors * fh
    gi = inset(rect, 0.35)
    glass_facade(p, gi, z0, z1, glass or d['glass'], 'steel', 1.5)
    if piers:
        pw = min(1.6, (x1 - x0) * 0.15)
        for (cx, cy, rr) in ((x0, y0, (0, 0, 0, r)), (x1 - pw, y0, (r, 0, 0, 0)), (x0, y1 - pw, (0, 0, r, 0)),
                             (x1 - pw, y1 - pw, (0, r, 0, 0))):
            rbox(p, cx, cy, z0, cx + pw, cy + pw, z1, rr, d['wall'])
    for i in range(1, floors + 1):
        z = z0 + i * fh
        mat = d['band'] if band_every and i % band_every == 0 else d['wall']
        rbox(p, x0 - slab_ext, y0 - slab_ext, z - 0.32, x1 + slab_ext, y1 + slab_ext, z, r + slab_ext, mat, 2)
    for k, side in enumerate(fins or ()):
        fw = kit.face_width(rect, side)
        span = fw * fin_span
        u0 = -fw / 2 + (fw - span) * (0.15 if k % 2 == 0 else 0.85)
        louvres(p, rect, side, z0 + fh, z1, u0, u0 + span, 0.45, 0.35, 0.09, d['louvre'], out=slab_ext * 0.4)
    if terraces:
        for i in range(1, floors):
            for side, u, w, depth, tree in terraces(i) or ():
                terrace(b, rect, side, u, w, depth, z0 + i * fh, d, seed + i, tree)
    return z1


def roof_garden(b, rect, z, seed=0, trees=2):
    """Lawn, planters and small trees on a flat roof."""
    x0, y0, x1, y1 = rect
    kit.block(b.main, x0, y0, z, x1, y1, z + 0.08, 'grass')
    rnd = props._rng(seed + 77)
    for k in range(trees):
        small_tree(b.props, x0 + 1.0 + rnd() * (x1 - x0 - 2.0), y0 + 1.0 + rnd() * (y1 - y0 - 2.0), z + 0.08,
                   2.8 + rnd(), 1.1, seed + k)
    for k in range(trees * 2):
        shrub(b.props, x0 + 0.6 + rnd() * (x1 - x0 - 1.2), y0 + 0.6 + rnd() * (y1 - y0 - 1.2), z + 0.08,
              0.35 + rnd() * 0.25, seed + k)
    return b


def flag(b, x, y, h=9.0):
    """The Thai flag on a pole on a round plinth (government buildings only)."""
    b.main.cyl(0.9, 1.0, 0.4, 'concrete_light', T(x, y, 0.2), seg=14)
    props.flag_pole(b.props, x, y, h)
    return b


def fence_glass(b, e, gate_w=6.0, h=1.1, mat='steel'):
    """A low planted wall round a 3x3 lot with a gap for the gate in the front middle."""
    pts = [(-gate_w / 2, -e), (-e, -e), (-e, e), (e, e), (e, -e), (gate_w / 2, -e)]
    for a, c in zip(pts, pts[1:]):
        x0, x1 = sorted((a[0], c[0]))
        y0, y1 = sorted((a[1], c[1]))
        kit.block(b.main, x0 - 0.2, y0 - 0.2, 0, x1 + 0.2, y1 + 0.2, 0.5, 'concrete_light')
        kit.block(b.props, x0 - 0.15, y0 - 0.15, 0.5, x1 + 0.15, y1 + 0.15, h, 'leaf_dark', bevel=0.1)
    for s in (-1, 1):
        rbox(b.main, s * gate_w / 2 - 0.4, -e - 0.4, 0, s * gate_w / 2 + 0.4, -e + 0.4, 2.4, 0.3, 'concrete_light')
        b.main.box((0.5, 0.05, 0.08), 'e5_glow', T(s * gate_w / 2, -e - 0.42, 2.0))
    return b
