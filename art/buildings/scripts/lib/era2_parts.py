# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 2's own pieces (the market town, assets/concept/era2_*.jpg and the region_*_B_town sheets): the two-storey
timber shophouse (ห้องแถวไม้) and its rows, the Sino-Portuguese shophouse of the south with its five-foot way and
arched windows, the half-brick half-timber house (เรือนครึ่งตึกครึ่งไม้), wooden power poles with sagging wires,
fruit crates, a vendor's cart, a lantern, a piece of railway, a water tower, a hand pump fire cart. True sizes."""

import math

from mathutils import Vector

from . import houses, kit, palette, props, regions
from .mesh import R, S, T

palette.COLORS.setdefault('e2_ice', '#DDEEF2')
palette.COLORS.setdefault('e2_ballast', '#8F8A82')
palette.COLORS.setdefault('e2_rail', '#5A5652')
palette.COLORS.setdefault('e2_sleeper', '#6B4A32')
palette.COLORS.setdefault('e2_moulding', '#F7F1E4')

GROUND = 4.0   # a shophouse's ground floor
UPPER = 3.2    # its upper floors
HOME = 3.0     # a house's storey
PLINTH = 0.25


def style(b):
    return regions.style(b.region)


def ground_kind(region, i=0):
    """How a shophouse's ground floor is built: plaster (Isan's brick ground floor, the south's stucco), or timber."""
    if region in ('northeast', 'south'):
        return 'plaster'
    if region == 'central' and i % 3 == 2:
        return 'plaster'
    return 'timber'


def awning_stripes(region):
    return regions.awning_colours(region)


# small pieces ------------------------------------------------------------------------------------------------------

SHUTTER = {'northeast': 'teak_light', 'central': 'shutter_green', 'west': 'teak_light'}


def house_window(p, rect, side, u, z0, region, w=0.9, h=1.25):
    """The region's window, with shutters in a colour that shows against the region's boards."""
    if region in SHUTTER:
        st = regions.style(region)
        return kit.window(p, rect, side, u, z0, w, h, frame=st['trim'], glass='window_dark', shutters=SHUTTER[region])
    return regions.house_window(p, rect, side, u, z0, region, w, h)


def timber_walls(p, rect, z0, z1, region, faces=kit.SIDES):
    """regions.house_walls, with boards only on the faces that show (a shophouse in a row hides its sides)."""
    st = regions.style(region)
    w = st['wood']
    trim = st['trim']
    kind = st['walls']
    if kind == 'board_v':
        return kit.plank_walls(p, rect, z0, z1, w, trim, board=0.22, sides=faces, posts_mat=trim)
    kit.walls(p, rect, z0, z1, w, bevel=0.0)
    kit.corner_posts(p, rect, z0, z1, 0.18, trim)
    for side in faces:
        fw = kit.face_width(rect, side)
        if kind == 'board_h':
            n = int((z1 - z0) / 0.24)
            for i in range(1, n):
                kit.on_face(p, rect, side, 0, z0 + i * (z1 - z0) / n - 0.015, fw - 0.1, 0.03, 0.025, trim)
        else:
            for zz in (z0 + 0.08, z0 + (z1 - z0) * 0.45, z1 - 0.12):
                kit.on_face(p, rect, side, 0, zz, fw - 0.1, 0.08, 0.035, trim)
            n = max(2, int(fw / 0.9))
            for i in range(1, n):
                kit.on_face(p, rect, side, -fw / 2 + fw * i / n, z0 + 0.08, 0.07, z1 - z0 - 0.2, 0.035, trim)
    return p


def gable_vent(p, rect, side, z, w, mat='fretwork', frame='teak_dark'):
    """A louvred vent in a gable's triangle, over the top floor."""
    kit.on_face(p, rect, side, 0, z, w + 0.12, 0.62, 0.05, frame)
    kit.on_face(p, rect, side, 0, z + 0.06, w, 0.5, 0.07, mat)
    for k in range(4):
        kit.on_face(p, rect, side, 0, z + 0.1 + k * 0.12, w - 0.06, 0.03, 0.09, frame)
    return p


def plaster_walls(p, rect, z0, z1, mat, trim='concrete_dark', skirting=True, pilasters=True):
    """A plastered brick wall box with a dark skirting and corner pilasters."""
    kit.walls(p, rect, z0, z1, mat, bevel=0.0)
    if skirting:
        kit.bands(p, rect, z0, 0.35, 0.03, trim)
    if pilasters:
        x0, y0, x1, y1 = rect
        for x, y in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
            kit.block(p, x - 0.14, y - 0.14, z0, x + 0.14, y + 0.14, z1, 'e2_moulding' if mat != 'e2_moulding'
                      else 'plaster')
    return p


def arch(p, cx, y0, y1, z_spring, half_w, z_top, mat, seg=8):
    """The wall over an arched opening: from a half circle (centre cx, z_spring, radius half_w) up to z_top,
    between y0 and y1 (an arcade's front, a gate). Drawn as convex slices."""
    pts = []
    for k in range(seg + 1):
        a = math.pi * (1 - k / seg)
        pts.append((cx + math.cos(a) * half_w, z_spring + math.sin(a) * half_w))
    for (xa, za), (xb, zb) in zip(pts, pts[1:]):
        q = [(xa, za), (xb, zb), (xb, z_top), (xa, z_top)]
        kit.hull(p, [(x, y, z) for x, z in q for y in (y0, y1)], mat)
    # the moulded edge of the arch
    p.torus(half_w, 0.06, 'e2_moulding', T(cx, y0 - 0.02, z_spring) @ R(90, 0, 0), seg=seg, seg_minor=4, arc=180)
    return p


def arched_window(p, rect, side, u, z0, w=0.9, h=1.4, frame='teak_dark', shutter='teak', mould='e2_moulding'):
    """A tall window with a half-round fanlight, louvred shutters and a moulded arch (Sino-Portuguese)."""
    kit.window(p, rect, side, u, z0, w, h, frame=frame, glass='window_dark', shutters=None, mullion=True)
    for s in (-1, 1):
        kit.on_face(p, rect, side, u + s * w / 4, z0, w / 2 - 0.04, h, 0.09, shutter)
        for k in range(6):
            kit.on_face(p, rect, side, u + s * w / 4, z0 + 0.1 + k * (h - 0.2) / 6, w / 2 - 0.12, 0.03, 0.11, frame)
    o, along, n = kit.face_frame(rect, side)
    c = o + along * u + n * 0.04
    zc = z0 + h + 0.07
    r = w / 2 + 0.07
    half = [(math.cos(math.pi * k / 8) * r, math.sin(math.pi * k / 8) * r) for k in range(9)]
    pts = []
    for a, zz in half:
        q = c + along * a
        pts.append((q.x, q.y, zc + zz))
        q2 = q + n * 0.06
        pts.append((q2.x, q2.y, zc + zz))
    kit.hull(p, pts, 'window_dark')
    rot = R(90, 0, 0) if side in ('front', 'back') else R(90, 0, 90)
    q = c + n * 0.06
    p.torus(r + 0.06, 0.06, mould, T(q.x, q.y, zc) @ rot, seg=8, seg_minor=4, arc=180)
    for k in (-1, 0, 1):
        a = math.pi / 2 + k * 0.6
        e = c + along * (math.cos(a) * r) + n * 0.07
        p.rod((c.x + n.x * 0.07, c.y + n.y * 0.07, zc), (e.x, e.y, zc + math.sin(a) * r), 0.015, frame, seg=4)
    kit.on_face(p, rect, side, u, zc + r + 0.02, 0.16, 0.22, 0.12, mould)   # keystone
    return p


def lantern(p, x, y, z):
    """A hanging oil lantern (ตะเกียง) from a bracket."""
    p.rod((x, y, z + 0.5), (x, y, z + 0.25), 0.01, 'iron', seg=3)
    p.cyl(0.09, 0.11, 0.08, 'iron', T(x, y, z + 0.22), seg=8)
    p.cyl(0.08, 0.08, 0.2, 'lamp', T(x, y, z + 0.08), seg=8)
    p.cyl(0.1, 0.1, 0.04, 'iron', T(x, y, z - 0.03), seg=8)
    return p


def crate(p, x, y, fruit='banana_fruit', facing=0.0, stack=1):
    """A slatted wooden crate of fruit (ลังผลไม้)."""
    m = T(x, y, 0) @ R(0, 0, facing)
    for k in range(stack):
        z = k * 0.32
        p.box((0.62, 0.42, 0.3), 'plank', m @ T(0, 0, z + 0.15))
        for s in (-1, 1):
            p.box((0.64, 0.02, 0.05), 'teak_dark', m @ T(0, s * 0.215, z + 0.08))
            p.box((0.64, 0.02, 0.05), 'teak_dark', m @ T(0, s * 0.215, z + 0.22))
    zt = stack * 0.32
    fruit_mat = fruit
    if fruit == 'banana_fruit':
        for i in range(3):
            p.cyl(0.07, 0.05, 0.36, 'banana_fruit', m @ T(-0.18 + i * 0.18, 0, zt + 0.04) @ R(90, 0, 15), seg=6)
    else:
        for i in range(4):
            p.sphere(0.1 if fruit != 'durian' else 0.13, fruit_mat,
                     m @ T(-0.18 + (i % 2) * 0.36, -0.08 + (i // 2) * 0.16, zt + 0.06), seg=6, rings=4)
    return p


def vendor_cart(p, x, y, facing=0.0, stripes=('awning_red', 'awning_white')):
    """A street vendor's cart (รถเข็น) with two wheels, a glass box of goods and a striped roof."""
    m = T(x, y, 0) @ R(0, 0, facing)
    p.box((1.6, 0.8, 0.08), 'teak', m @ T(0, 0, 0.82))
    p.box((1.6, 0.8, 0.45), 'plank', m @ T(0, 0, 0.55))
    p.box((1.0, 0.6, 0.4), 'glass', m @ T(-0.2, 0, 1.06))
    for i in range(3):
        p.sphere(0.1, ('paint_orange', 'leaf_light', 'flower_red')[i], m @ T(-0.5 + i * 0.3, 0, 0.95), seg=6, rings=4)
    for s in (-1, 1):
        p.cyl(0.32, 0.32, 0.06, 'teak_dark', m @ T(0.25, s * 0.45, 0.32) @ R(90, 0, 0), seg=12)
        p.cyl(0.06, 0.06, 0.1, 'iron', m @ T(0.25, s * 0.48, 0.32) @ R(90, 0, 0), seg=6)
    p.box((0.05, 0.05, 0.3), 'teak_dark', m @ T(-0.75, 0, 0.18))
    for sx in (-0.75, 0.75):
        for sy in (-0.35, 0.35):
            p.box((0.04, 0.04, 1.2), 'teak_dark', m @ T(sx, sy, 1.46))
    for i in range(4):
        q = m @ T(-0.75 + 0.375 * (i + 0.5), 0, 2.1) @ R(0, 0, 0)
        p.box((0.375, 1.1, 0.04), stripes[i % 2], q)
    p.rod(m @ Vector((0.8, -0.3, 0.9)), m @ Vector((1.25, -0.3, 0.95)), 0.025, 'teak_dark', seg=4)
    p.rod(m @ Vector((0.8, 0.3, 0.9)), m @ Vector((1.25, 0.3, 0.95)), 0.025, 'teak_dark', seg=4)
    return p


def pole(p, x, y, h=8.5, facing=0.0, arms=2):
    """A wooden power pole (เสาไฟไม้) with cross arms across `facing` (degrees, the line's direction) and white
    insulators; returns the insulators' tops (one list per arm)."""
    p.cyl(0.14, 0.11, h, 'teak_dark', T(x, y, h / 2), seg=8)
    m = T(x, y, 0) @ R(0, 0, facing + 90)
    tops = []
    for k in range(arms):
        z = h - 0.35 - k * 0.75
        p.box((1.7, 0.1, 0.12), 'teak', m @ T(0, 0, z))
        for s in (-1, 1):
            p.rod(m @ Vector((0, 0, z - 0.6)), m @ Vector((s * 0.55, 0, z - 0.05)), 0.025, 'iron', seg=4)
        row = []
        for u in (-0.7, 0.7):
            p.cyl(0.04, 0.05, 0.14, 'paint_white', m @ T(u, 0, z + 0.13), seg=6)
            row.append(m @ Vector((u, 0, z + 0.2)))
        tops.append(row)
    return tops


def pole_line(p, points, h=8.5, sag=0.45):
    """Poles at points (x, y) with sagging wires from each to the next."""
    tops = []
    for i, (x, y) in enumerate(points):
        nxt = points[min(i + 1, len(points) - 1)]
        prv = points[max(i - 1, 0)]
        ang = math.degrees(math.atan2(nxt[1] - prv[1], nxt[0] - prv[0]))
        tops.append(pole(p, x, y, h, ang))
    for a, c in zip(tops, tops[1:]):
        for ra, rc in zip(a, c):
            for qa, qc in zip(ra, rc):
                props.wires(p, qa, qc, sag, n=6)
    return tops


def service_drop(p, top, to, sag=0.35):
    """A wire from a pole's insulator to a building's wall (with a little white insulator there)."""
    props.wires(p, top, to, sag, n=5, r=0.012)
    p.cyl(0.035, 0.035, 0.1, 'paint_white', T(*to), seg=6)
    return p


def rail_track(p, x0, x1, y, z=0.0, gauge=1.0):
    """A metre-gauge railway (ทางรถไฟ): ballast, sleepers every 0.7 m and two rails."""
    kit.hull(p, [(x0, y - 1.6, z), (x1, y - 1.6, z), (x0, y + 1.6, z), (x1, y + 1.6, z),
                 (x0, y - 1.1, z + 0.3), (x1, y - 1.1, z + 0.3), (x0, y + 1.1, z + 0.3), (x1, y + 1.1, z + 0.3)],
             'e2_ballast')
    n = int((x1 - x0) / 0.7)
    for i in range(n):
        x = x0 + 0.35 + i * 0.7
        p.box((0.22, 2.0, 0.12), 'e2_sleeper', T(x, y, z + 0.34))
    for s in (-1, 1):
        p.box((x1 - x0, 0.07, 0.12), 'e2_rail', T((x0 + x1) / 2, y + s * gauge / 2, z + 0.46))
    return p


def water_tower(p, x, y, h=12.0, r=2.2, tank_h=3.2, mat='steel', legs='iron'):
    """A raised water tank on a braced steel tower (หอถังสูง) with a ladder."""
    a = r * 0.85
    corners = [(x - a, y - a), (x + a, y - a), (x + a, y + a), (x - a, y + a)]
    for cx, cy in corners:
        p.rod((cx * 1.0 + (cx - x) * 0.25, cy + (cy - y) * 0.25, 0), (cx, cy, h), 0.12, legs, seg=6)
        kit.block(p, cx + (cx - x) * 0.25 - 0.35, cy + (cy - y) * 0.25 - 0.35, 0,
                  cx + (cx - x) * 0.25 + 0.35, cy + (cy - y) * 0.25 + 0.35, 0.4, 'concrete')
    levels = (0.3, 0.55, 0.8)
    for t in levels:
        zz = h * t
        ring = [(x + (cx - x) * (1 + 0.25 * (1 - t)), y + (cy - y) * (1 + 0.25 * (1 - t))) for cx, cy in corners]
        for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1]):
            p.rod((ax, ay, zz), (bx, by, zz), 0.05, legs, seg=4)
    for (ax, ay), (bx, by) in zip(corners, corners[1:] + corners[:1]):
        p.rod((ax + (ax - x) * 0.17, ay + (ay - y) * 0.17, h * 0.3), (bx, by, h * 0.8), 0.035, legs, seg=4)
        p.rod((bx + (bx - x) * 0.17, by + (by - y) * 0.17, h * 0.3), (ax, ay, h * 0.8), 0.035, legs, seg=4)
    kit.block(p, x - a - 0.5, y - a - 0.5, h - 0.15, x + a + 0.5, y + a + 0.5, h, 'iron')
    kit.railing(p, [(x - a - 0.5, y - a - 0.5), (x + a + 0.5, y - a - 0.5), (x + a + 0.5, y + a + 0.5),
                    (x - a - 0.5, y + a + 0.5)], h, 'iron', h=0.9, spacing=0.4, closed=True)
    p.cyl(r, r, tank_h, mat, T(x, y, h + tank_h / 2), seg=18)
    p.cyl(r + 0.05, 0.25, r * 0.4, mat, T(x, y, h + tank_h + r * 0.2), seg=18)
    for k in (0.33, 0.66):
        p.torus(r + 0.02, 0.04, 'metal', T(x, y, h + tank_h * k), seg=18, seg_minor=4)
    # ladder up the front leg and the pipe down the middle
    lx, ly = x, y - a - 0.6
    for s in (-0.22, 0.22):
        p.rod((lx + s, ly, 0), (lx + s, ly, h), 0.025, legs, seg=4)
    for k in range(int(h / 0.4)):
        p.box((0.44, 0.03, 0.03), legs, T(lx, ly, 0.3 + k * 0.4))
    p.rod((x, y, 0.4), (x, y, h), 0.16, 'metal', seg=8)
    return h + tank_h + r * 0.4


def pump_cart(p, x, y, facing=0.0):
    """A hand-pumped fire cart (รถสูบน้ำมือโยก): a red tank on two big wheels, a rocking beam and a hose reel."""
    m = T(x, y, 0) @ R(0, 0, facing)
    p.box((1.8, 1.0, 0.7), 'paint_red', m @ T(0, 0, 0.95), bevel=0.05)
    p.box((1.9, 1.05, 0.06), 'gold', m @ T(0, 0, 1.3))
    for s in (-1, 1):
        p.cyl(0.6, 0.6, 0.08, 'teak_dark', m @ T(0, s * 0.62, 0.6) @ R(90, 0, 0), seg=14)
        p.torus(0.58, 0.04, 'iron', m @ T(0, s * 0.66, 0.6) @ R(90, 0, 0), seg=14, seg_minor=4)
    p.box((0.12, 0.12, 0.7), 'iron', m @ T(0, 0, 1.6))
    p.box((2.8, 0.08, 0.08), 'teak', m @ T(0, 0, 1.95) @ R(0, 8, 0))
    for s in (-1, 1):
        p.box((0.08, 1.0, 0.08), 'teak', m @ T(s * 1.38, 0, 1.95 - s * 0.19))
    p.cyl(0.3, 0.3, 0.4, 'iron', m @ T(-1.2, 0, 0.6) @ R(90, 0, 0), seg=10)
    p.torus(0.3, 0.06, 'canvas', m @ T(-1.2, 0, 0.6) @ R(90, 0, 0), seg=10, seg_minor=4)
    p.rod(m @ Vector((0.9, 0, 0.9)), m @ Vector((1.9, 0, 0.6)), 0.04, 'teak_dark', seg=4)
    return p


def bucket_row(p, x, y, n=6, step=0.5):
    for i in range(n):
        p.cyl(0.16, 0.12, 0.28, 'paint_red', T(x + i * step, y, 0.14), seg=8)
    return p


def drums(p, x, y, n=4, mat='paint_blue'):
    """Oil drums (ถังน้ำมัน) standing in a row."""
    for i in range(n):
        props.barrel(p, x + (i % 3) * 0.62, y + (i // 3) * 0.62, (mat, 'rust', 'paint_red')[i % 3], 0.9)
    return p


def log_pile(p, x, y, length=5.0, rows=3, r=0.3, axis='x'):
    """Logs stacked in a pyramid (ซุง)."""
    for k in range(rows):
        for i in range(rows - k):
            off = (i - (rows - k - 1) / 2) * r * 2.05
            z = r + k * r * 1.75
            if axis == 'x':
                p.cyl(r, r, length, 'trunk', T(x, y + off, z) @ R(0, 90, 0), seg=8)
                for s in (-1, 1):
                    p.cyl(r * 0.85, r * 0.85, 0.02, 'timber', T(x + s * length / 2, y + off, z) @ R(0, 90, 0), seg=8)
            else:
                p.cyl(r, r, length, 'trunk', T(x + off, y, z) @ R(90, 0, 0), seg=8)
    return p


def plank_stack(p, x, y, w=1.2, length=4.0, h=0.9, axis='x'):
    """Sawn boards stacked to dry, with spacers."""
    n = int(h / 0.1)
    for k in range(n):
        if axis == 'x':
            kit.block(p, x - length / 2, y - w / 2, k * 0.1 + 0.08, x + length / 2, y + w / 2, k * 0.1 + 0.16, 'timber')
        else:
            kit.block(p, x - w / 2, y - length / 2, k * 0.1 + 0.08, x + w / 2, y + length / 2, k * 0.1 + 0.16, 'timber')
    for s in (-1, 0, 1):
        if axis == 'x':
            kit.block(p, x + s * length * 0.4 - 0.06, y - w / 2, 0, x + s * length * 0.4 + 0.06, y + w / 2, 0.08,
                      'teak_dark')
        else:
            kit.block(p, x - w / 2, y + s * length * 0.4 - 0.06, 0, x + w / 2, y + s * length * 0.4 + 0.06, 0.08,
                      'teak_dark')
    return p


def mound(p, x, y, r, h, mat):
    p.cap(r, mat, T(x, y, 0) @ S(1, 1, h / r), keep=lambda co: co.z >= -0.01, seg=10, rings=6)
    return p


# shophouses ----------------------------------------------------------------------------------------------------------

def shophouse(b, rect, i=0, storeys=2, ground=None, awning=True, sign=True, sides=('left', 'right'), roof=True,
              wares=True, lamp=False, balcony=None):
    """One shophouse unit (ห้องแถว) on rect (x0, y0, x1, y1), its front on y0 toward the road: a 4 m ground floor
    behind folding plank doors, timber upper floors with shuttered windows, the region's gable to the front (a
    hip roof and a stucco front with a five-foot way and arched windows in the south). sides: the outer side walls
    that get windows. Returns a dict with the eave and ridge heights."""
    r = b.region
    st = regions.style(r)
    p = b.main
    x0, y0, x1, y1 = rect
    w = x1 - x0
    cx = (x0 + x1) / 2
    trim = st['trim']
    ground = ground or ground_kind(r, i)
    south = r == 'south'
    z_top = GROUND + UPPER * (storeys - 1)
    plaster = regions.plaster(r, i)
    if balcony is None:
        balcony = r == 'north' and i % 2 == 0 and storeys > 1
    # the floor slab and the step to the road
    kit.block(p, x0, y0, 0, x1, y1, PLINTH, 'paving_dark' if south else 'concrete' if ground == 'plaster' else 'stone')
    arcade = 1.8 if south else 0.0
    grect = (x0 + 0.02, y0 + arcade + (0.0 if south else 0.0), x1 - 0.02, y1)
    # ground floor
    if ground == 'plaster':
        plaster_walls(p, grect, PLINTH, GROUND, plaster if south else regions.plaster(r, i), pilasters=not south)
    else:
        timber_walls(p, grect, PLINTH, GROUND, r, ('front', 'back') + tuple(sides))
    dw = w - 0.9
    kit.folding_doors(p, grect, 'front', 0, PLINTH, dw, 2.9, leaf=st['shutter'] if ground != 'plaster' or i % 2 else
                      'shutter_green' if south else st['shutter'], frame=trim, open_=0.55 + 0.1 * (i % 3))
    kit.on_face(p, grect, 'front', 0, PLINTH + 3.05, dw, 0.45, 0.06, 'fretwork' if ground == 'plaster' else trim)
    for k in range(int(dw / 0.3)):
        kit.on_face(p, grect, 'front', -dw / 2 + 0.15 + k * 0.3, PLINTH + 3.1, 0.04, 0.35, 0.08, trim)
    # upper floors
    urect = (x0, y0, x1, y1)
    if south:
        plaster_walls(p, urect, GROUND, z_top, plaster, skirting=False, pilasters=False)
        # pilasters between the units and the five-foot way's arch
        for x in (x0 + 0.2, x1 - 0.2):
            kit.block(p, x - 0.22, y0 - 0.05, PLINTH, x + 0.22, y0 + 0.4, GROUND, 'e2_moulding')
            kit.block(p, x - 0.2, y0 - 0.08, GROUND, x + 0.2, y0, z_top, 'e2_moulding')
        hw = (w - 0.84) / 2
        arch(p, cx, y0, y0 + 0.4, GROUND - 0.35 - hw, hw, GROUND, plaster, seg=8)
        kit.block(p, x0, y0 + 0.4, GROUND - 0.12, x1, y0 + arcade, GROUND, 'e2_moulding')
    else:
        timber_walls(p, urect, GROUND, z_top, r, ('front', 'back') + tuple(sides))
    kit.bands(p, urect, GROUND - 0.1, 0.2, 0.06, trim if not south else 'e2_moulding')
    for k in range(1, storeys - 1):
        kit.bands(p, urect, GROUND + UPPER * k - 0.08, 0.16, 0.05, trim if not south else 'e2_moulding')
    for k in range(storeys - 1):
        zf = GROUND + UPPER * k
        n = 2 if w >= 3.8 else 1
        for u in kit.spread(w, n, 0.5):
            if south:
                arched_window(p, urect, 'front', u, zf + 0.75, 0.9, 1.5, frame=trim,
                              shutter=('shutter_green', 'shutter_blue', 'teak')[i % 3])
            else:
                house_window(p, urect, 'front', u, zf + 1.0, r, 0.9, 1.3)
        for side in sides:
            for u in kit.spread(y1 - y0, 3, 1.0)[:: 2 if k else 1]:
                if south:
                    arched_window(p, urect, side, u, zf + 0.75, 0.8, 1.4, frame=trim, shutter='shutter_green')
                else:
                    house_window(p, urect, side, u, zf + 1.0, r, 0.8, 1.2)
        if balcony and k == 0:
            # a Lanna shophouse's timber balcony across its front
            kit.balcony(p, urect, 'front', 0, zf + 0.1, w - 0.3, 0.8, 'plank', trim, 1.0)
    for side in sides:
        gd = grect[3] - grect[1]
        for f in (0.25, -0.15):
            if south:
                arched_window(p, grect, side, gd * f, 1.0, 0.8, 1.4, frame=trim, shutter='shutter_green')
            elif ground == 'plaster':
                kit.window(p, grect, side, gd * f, 1.3, 0.8, 1.1, frame=trim, glass='window_dark', bars=3,
                           shutters=SHUTTER.get(r, st['shutter']))
            else:
                house_window(p, grect, side, gd * f, 1.3, r, 0.8, 1.1)
    regions.house_door(p, urect, 'back', 0, PLINTH, r, 0.9, 2.1)
    # roof
    top = z_top
    if roof:
        if south:
            # a stucco parapet with a cornice and a little pediment over the front, the hip roof behind
            kit.bands(p, urect, z_top - 0.05, 0.25, 0.08, 'e2_moulding')
            kit.block(p, x0, y0 - 0.05, z_top, x1, y0 + 0.25, z_top + 0.7, plaster)
            kit.block(p, x0 - 0.05, y0 - 0.1, z_top + 0.7, x1 + 0.05, y0 + 0.3, z_top + 0.82, 'e2_moulding')
            kit.prism_y(p, [(cx - w * 0.3, z_top + 0.82), (cx + w * 0.3, z_top + 0.82), (cx, z_top + 1.4)],
                        y0 - 0.06, y0 + 0.24, 'e2_moulding')
            p.cyl(0.22, 0.22, 0.06, plaster, T(cx, y0 - 0.1, z_top + 0.35) @ R(90, 0, 0), seg=10)
            top = regions.house_roof(p, (x0 + 0.05, y0 + 0.3, x1 - 0.05, y1), z_top, r, None, over=0.4)
        else:
            top = regions.house_roof(p, urect, z_top, r, None, axis='y', over=0.45, over_ends=0.7)
            gable_vent(p, urect, 'front', z_top + 0.25, min(1.6, w * 0.35), frame=trim)
            kit.eave_brackets(p, urect, 'front', z_top + 0.1, 2, depth=0.55, mat=trim)
            kit.eave_brackets(p, urect, 'back', z_top + 0.1, 2, depth=0.55, mat=trim)
    # the street side: awning or arcade sign, wares
    pp = b.props
    if sign:
        mats = ('sign_cream', 'sign_red', 'sign_blue', 'sign_green', 'sign_cream')
        if south:
            props.sign_board(pp, urect, 'front', 0, GROUND + 0.1, w * 0.62, 0.5, mats[i % 5], 'teak_dark', out=0.05)
        elif balcony:
            props.sign_board(pp, (x0, y0 - 0.85, x1, y1), 'front', 0, GROUND + 0.3, w * 0.6, 0.5, mats[i % 5],
                             'teak_dark', out=0.02)
        else:
            props.sign_board(pp, urect, 'front', 0, GROUND + 0.15, w * 0.7, 0.62, mats[i % 5], 'teak_dark', out=0.04)
    if awning and not south:
        stripes = awning_stripes(r)
        zinc = stripes[0].startswith('zinc')
        props.awning(pp, grect, 'front', 0, GROUND - 0.15, w - 0.5, 1.5 if not zinc else 1.7, 0.55 if not zinc else
                     0.4, stripes=stripes, valance=not zinc)
    if wares:
        fruits = ('banana_fruit', 'paint_orange', 'durian' if r in ('east', 'south') else 'leaf_light', 'rambutan')
        yy = y0 - 0.7 if not south else y0 + 1.0
        for k in range(2 + i % 2):
            crate(pp, x0 + 0.7 + k * 0.75, yy, fruits[(k + i) % 4], stack=1 + (k + i) % 2)
        if i % 2 == 0:
            props.bench(pp, x1 - 1.1, yy - (0.1 if not south else -0.2), 1.4)
        else:
            props.sacks(pp, x1 - 1.4, yy - 0.1, 3)
    if lamp:
        pp.rod((x1 - 0.1, y0, GROUND - 0.4), (x1 - 0.1, y0 - 0.5, GROUND - 0.4), 0.02, 'iron', seg=4)
        lantern(pp, x1 - 0.1, y0 - 0.5, GROUND - 1.0)
    return {'rect': urect, 'eave': z_top, 'top': top}


def shop_row(b, x0, y0, n, w, d, storeys=2, i0=0, end_sides=True, heights=None, **kw):
    """n shophouse units side by side from x0, fronts on y0. heights: storeys per unit (overrides storeys)."""
    units = []
    for k in range(n):
        sides = []
        if end_sides and k == 0:
            sides.append('left')
        if end_sides and k == n - 1:
            sides.append('right')
        s = heights[k] if heights else storeys
        kw2 = dict(kw)
        kw2.setdefault('wares', n < 3 or k % 2 == 0)
        units.append(shophouse(b, (x0 + k * w, y0, x0 + (k + 1) * w, y0 + d), i0 + k, s, sides=tuple(sides),
                               lamp=(k == n - 1), **kw2))
    return units


# houses ----------------------------------------------------------------------------------------------------------------

def townhouse(b, rect, i=0, axis='x', door_side='front', door_u=None, porch=True, veranda=False, ground=None,
              upper=True, roof_mat=None, windows=None):
    """The market town's house (เรือนครึ่งตึกครึ่งไม้): a plastered brick ground floor with barred windows, a
    timber upper floor with shuttered windows, the region's tiled roof; a tiled porch over the door, and a timber
    veranda across the front upstairs. Returns a dict with rect, eave and ridge."""
    r = b.region
    st = regions.style(r)
    p = b.main
    trim = st['trim']
    x0, y0, x1, y1 = rect
    ground = ground or ('timber' if r in ('west',) and i % 2 else 'plaster')
    kit.block(p, x0 - 0.2, y0 - 0.2, 0, x1 + 0.2, y1 + 0.2, 0.45, 'stone' if r != 'northeast' else 'brick_dark',
              bevel=0.02)
    z1 = 0.45 + HOME
    pl = regions.plaster(r, i)
    if ground == 'plaster':
        plaster_walls(p, rect, 0.45, z1, pl, trim='brick')
    else:
        regions.house_walls(p, rect, 0.45, z1, r)
    zt = z1 + (HOME if upper else 0.0)
    if upper:
        if r == 'south':
            plaster_walls(p, rect, z1, zt, pl, skirting=False)
        else:
            regions.house_walls(p, rect, z1, zt, r)
        kit.bands(p, rect, z1 - 0.1, 0.2, 0.05, trim)
    for side in kit.SIDES:
        fw = kit.face_width(rect, side)
        n = (windows or {}).get(side, max(1, int(fw / 2.6)))
        us = kit.spread(fw, n, 0.9)
        du = None
        if side == door_side:
            du = door_u if door_u is not None else (us[len(us) // 2] if n % 2 else 0.0)
            regions.house_door(p, rect, side, du, 0.45, r, 1.0 if not porch else 1.6, 2.1)
        for u in us:
            if du is not None and abs(u - du) < 1.4:
                continue
            if ground == 'plaster':
                kit.window(p, rect, side, u, 1.4, 0.9, 1.2, frame=trim, glass='window_dark', bars=3,
                           shutters=SHUTTER.get(r, st['shutter']) if r != 'south' else 'shutter_green')
            else:
                house_window(p, rect, side, u, 1.4, r, 0.9, 1.2)
        if upper:
            for u in us:
                if r == 'south':
                    arched_window(p, rect, side, u, z1 + 0.8, 0.9, 1.3, frame=trim, shutter='shutter_green')
                else:
                    house_window(p, rect, side, u, z1 + 0.9, r, 0.9, 1.25)
    top = regions.house_roof(p, rect, zt, r, roof_mat, axis=axis, over=0.8, over_ends=0.6,
                             thatch=(roof_mat == 'thatch'))
    if r != 'south':
        kit.gutter(p, rect, 'front' if axis == 'x' else 'left', zt - 0.55, 'zinc_dark')
    fo, along, nrm = kit.face_frame(rect, door_side)
    if porch:
        # a small porch with two posts and its own tiled roof, three steps up to the floor
        c = fo + along * (du or 0.0)
        pw_, pd = 2.6, 1.8
        a = c + nrm * pd
        corners = [c - along * (pw_ / 2), c + along * (pw_ / 2), a - along * (pw_ / 2), a + along * (pw_ / 2)]
        prect = (min(q.x for q in corners), min(q.y for q in corners), max(q.x for q in corners),
                 max(q.y for q in corners))
        kit.block(p, prect[0], prect[1], 0, prect[2], prect[3], 0.45, 'stone', bevel=0.02)
        for s in (-1, 1):
            q = a + along * (s * (pw_ / 2 - 0.15))
            kit.block(p, q.x - 0.1, q.y - 0.1, 0.45, q.x + 0.1, q.y + 0.1, 3.0, trim)
        low = {'front': 'front', 'back': 'back', 'left': 'left', 'right': 'right'}[door_side]
        kit.shed_roof(p, prect, 2.9, 3.4, roof_mat or 'clay_tile', over=0.3, low_side=low, thick=0.12, courses=3,
                      course_mat='clay_tile_dark')
        s0 = a + nrm * 0.0
        for k in range(2):
            q = s0 + nrm * (0.15 + k * 0.28)
            sx, sy = (1.6, 0.3) if door_side in ('front', 'back') else (0.3, 1.6)
            p.box((sx, sy, 0.15 * (2 - k)), 'stone', T(q.x, q.y, 0.075 * (2 - k)))
    if veranda and upper and r != 'south':
        side = door_side
        fw = kit.face_width(rect, side)
        vd = 1.6
        corner0 = fo - along * (fw / 2)
        corner1 = fo + along * (fw / 2)
        far0 = corner0 + nrm * vd
        far1 = corner1 + nrm * vd
        xs = [corner0.x, corner1.x, far0.x, far1.x]
        ys = [corner0.y, corner1.y, far0.y, far1.y]
        vr = (min(xs), min(ys), max(xs), max(ys))
        kit.floor_deck(p, vr, z1, 'plank', 0.15, edge=trim, boards=int(fw / 0.35), board_mat=trim)
        for k in range(3):
            q = far0.lerp(far1, k / 2)
            kit.block(p, q.x - 0.1, q.y - 0.1, 0.0, q.x + 0.1, q.y + 0.1, z1 + 2.5, trim)
        kit.railing(p, [(corner0.x, corner0.y), (far0.x, far0.y), (far1.x, far1.y), (corner1.x, corner1.y)], z1, trim,
                    spacing=0.14)
        kit.shed_roof(p, vr, z1 + 2.5, zt - 0.2, roof_mat or 'clay_tile', over=0.3, low_side=side, thick=0.12,
                      courses=3, course_mat='clay_tile_dark')
    return {'rect': rect, 'eave': zt, 'top': top}
