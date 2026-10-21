# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The parts of a Thai Buddhist temple compound (วัด) in true metres (PLAN.md "Temples", CLAUDE.md licence rule 8):
the ordination hall (อุโบสถ, the Isan สิม) and the viharn (วิหาร) with their tiered roofs, the chedi of each region
(bell, Lanna, Isan ธาตุ, Srivijaya, Mon, a Khmer prang), the sala (ศาลาการเปรียญ), the bell tower (หอระฆัง), monks'
huts (กุฏิ), the scripture hall in its pond (หอไตร), the sema stones (ใบเสมา), the bodhi tree, and the compound wall
(กำแพงแก้ว) with its gates (ซุ้มประตู).

ช่อฟ้า, ใบระกา and หางหงส์ (gable_trim) belong to these temple buildings only and must never be used by any other
building file. No Buddha images, no figures, no royal symbols, no flags, no text: interiors are not modelled (doors and
shutters are closed, open halls show a dark inside), and every temple is inspired by real ones, never a replica.

Everything is dressed by the era (b.era: timber and thatch, then brick and whitewash with clay tiles, then glazed
tiles and gold, then cleaner stone and solar, then white and gold with ponds and planting) and the region (b.region).
A building faces -Y (the road); X right, Z up.
"""

import math

import bmesh
from mathutils import Vector

from . import kit, props, regions
from . import era4_parts as e4
from . import era5_parts as e5
from .mesh import Part, R, S, T

SQ2 = math.sqrt(2.0)
# The compound wall's centre line from the compound's centre (its coping reaches 23.5 m, the 47 m square's edge).
WALL_E = 23.2
WALL_T = 0.4
INNER = WALL_E - WALL_T / 2 - 0.1   # the yard inside the wall

# The region's temple: roof pitch (rise over half span), chedi form, whether a full compound has a scripture hall in a
# pond, the colonnade skirt (ปีกนก) and the tiers of the great hall at level 3.
TSTYLE = {
    'central': {'pitch': 1.5, 'chedi': 'bell', 'chedi3': 'bell', 'hotrai': True, 'skirt': True, 'front': 2, 'back': 1,
                'step': 1.0},
    'east': {'pitch': 1.45, 'chedi': 'bell', 'chedi3': 'prang', 'hotrai': False, 'skirt': True, 'front': 2, 'back': 1,
             'step': 1.0},
    'south': {'pitch': 1.25, 'chedi': 'srivijaya', 'chedi3': 'srivijaya', 'hotrai': False, 'skirt': True, 'front': 1,
              'back': 1, 'step': 1.1},
    'west': {'pitch': 1.4, 'chedi': 'mon', 'chedi3': 'mon', 'hotrai': False, 'skirt': False, 'front': 2, 'back': 1,
             'step': 1.0},
    'north': {'pitch': 0.95, 'chedi': 'lanna', 'chedi3': 'lanna', 'hotrai': True, 'skirt': True, 'front': 3, 'back': 2,
              'step': 0.75},
    'northeast': {'pitch': 1.45, 'chedi': 'that', 'chedi3': 'that', 'hotrai': True, 'skirt': False, 'front': 1,
                  'back': 0, 'step': 0.9},
}

# Glazed roofs from era 3: (tiles, border, tile rows)
ROOF3 = {
    'central': ('temple_orange', 'temple_green', 'temple_orange_dark'),
    'east': ('temple_orange', 'temple_green', 'temple_orange_dark'),
    'south': ('temple_green', 'temple_orange', 'roof_green'),
    'west': ('temple_brown', 'temple_brown_light', 'temple_brown_light'),
    'north': ('temple_red_roof', 'temple_brown', 'temple_brown'),
    'northeast': ('temple_red_roof', 'temple_green', 'temple_brown'),
}


def style(b):
    return TSTYLE[b.region]


def mats(b):
    """The colours of one temple by era and region."""
    e, r = b.era, b.region
    st = regions.style(r)
    if e == 1:
        m = dict(roof='shingle', border='shingle_dark', course='shingle_dark', orn='teak_light', face='teak',
                 wall=st['wood'], trim='teak_dark', base='stone', band='stone_pale', door='teak', frame='teak_dark',
                 step='stone', col='teak_dark', cap='teak_light', chedi='plaster', chedi_top='plaster',
                 chedi_band='stone_pale', sema='sema_stone', fence='bamboo', coping='teak_dark',
                 yard={'northeast': 'laterite', 'south': 'sand'}.get(r, 'dirt'), path='dirt_dark', court=None, small_roof='thatch',
                 floor='plank', pillar='teak_dark')
    elif e == 2:
        m = dict(roof='clay_tile', border='clay_tile_dark', course='clay_tile_dark', orn='gold_dark', face='teak_dark',
                 wall='plaster_white', trim='teak_dark', base='plaster', band='brick', door='teak_dark',
                 frame='cream', step='brick', col='plaster_white', cap='cream', chedi='whitewash',
                 chedi_top='whitewash', chedi_band='plaster', sema='sema_stone', fence='plaster_white',
                 coping='plaster', yard='sand', path='paving', court=None, small_roof='clay_tile',
                 floor='plank', pillar='plaster_white')
        if r == 'north':
            m.update(roof='clay_tile_dark', border='teak_dark', course='teak_dark')
    else:
        roof, border, course = ROOF3[r]
        m = dict(roof=roof, border=border, course=course, orn='gold_leaf', face='lacquer_red', wall='whitewash',
                 trim='gold_leaf', base='whitewash', band='whitewash_shade', door='lacquer_red', frame='gold_leaf',
                 step='whitewash_shade', col='whitewash', cap='gold_leaf', chedi='whitewash', chedi_top='gold_leaf',
                 chedi_band='gold_leaf', sema='whitewash', fence='whitewash', coping='whitewash_shade',
                 yard='sand', path='paving', court='paving', small_roof=roof, floor='concrete_light',
                 pillar='whitewash')
        if r in ('north', 'west'):
            m['chedi'] = 'gold_leaf'
            m['chedi_band'] = 'gold_dark'
        if r == 'north':
            m['col'] = 'lacquer_red'
        if r == 'west':
            m.update(face='lacquer_black', door='lacquer_black')
        if r == 'east':
            m['prang'] = 'sandstone'
        if e == 4:
            m.update(base='granite', band='whitewash', step='granite', coping='granite', yard='granite',
                     path='granite_dark', court='granite', floor='granite', sema='whitewash')
        if e == 5:
            m.update(base='whitewash', band='gold_leaf', step='granite', coping='gold_leaf', yard='grass',
                     path='granite', court='granite', floor='granite')
    m.setdefault('prang', m['chedi'] if e < 3 else 'whitewash')
    if r == 'northeast' and e <= 2:
        m['yard'] = 'laterite' if e == 1 else 'sand'
    return m


# placing a drawing turned ----------------------------------------------------------------------------------------------

def _merge(dst, src, matrix):
    bmesh.ops.transform(src.bm, matrix=matrix, verts=src.bm.verts)
    idx = [dst._mat(name) for name in src.mats]
    vmap = {v: dst.bm.verts.new(v.co) for v in src.bm.verts}
    for f in src.bm.faces:
        try:
            nf = dst.bm.faces.new([vmap[v] for v in f.verts])
        except ValueError:
            continue
        nf.material_index = idx[f.material_index]
        nf.smooth = f.smooth
    src.bm.free()


def turned(b, x, y, angle, fn):
    """fn(p, q) draws a thing at the origin facing -Y into a main and a props part; it is turned by angle degrees
    (90: facing +X, -90: facing -X) and moved to (x, y)."""
    tp, tq = Part('tmp'), Part('tmp')
    fn(tp, tq)
    m = T(x, y, 0) @ R(0, 0, angle)
    _merge(b.main, tp, m)
    _merge(b.props, tq, m)


# roofs: tiers and their ornaments ----------------------------------------------------------------------------------------

def _board(p, a, c, w, y0, y1, mat):
    """A flat board in an XZ plane between y0 and y1, along the line a-c ((x, z) points), w wide upward."""
    a, c = Vector(a), Vector(c)
    d = (c - a).normalized()
    n = Vector((-d.y, d.x))
    if n.y < 0:
        n = -n
    pts = []
    for q in (a, c, a + n * w, c + n * w):
        for y in (y0, y1):
            pts.append((q.x, y, q.y))
    kit.hull(p, pts, mat)
    return d, n


def gable_trim(p, m, bc, a, dirn, z, half, over, rise, k=1.0, teeth=9, chofa=True, face=True):
    """The dress of a temple gable (หน้าบัน) at y = a, facing dirn (-1 the front, +1 the back): bargeboards (ป้านลม)
    with ใบระกา fins along them, หางหงส์ curling up at their feet, a ช่อฟ้า rising from the apex, and the gable face
    (lacquer with a gilt panel and a beam). Temple buildings only."""
    slope = rise / half
    ez = z - over * slope
    top = z + rise
    w = 0.3 * k
    orn = m['orn']
    ya, yb = a - dirn * 0.05, a + dirn * 0.1
    if face:
        X = half + over * 0.35
        zb = z - over * 0.35 * slope - 0.12
        ft = top - 0.2
        f0, f1 = a - dirn * 0.18, a - dirn * 0.05
        kit.hull(p, [(bc - X, f0, zb), (bc + X, f0, zb), (bc, f0, ft), (bc - X, f1, zb), (bc + X, f1, zb), (bc, f1, ft)],
                 m['face'])
        # the gilt panel: a smaller triangle and a lozenge in the middle
        h = ft - zb
        g0, g1 = a - dirn * 0.06, a - dirn * 0.01
        kit.hull(p, [(bc - X * 0.55, g0, zb + h * 0.12), (bc + X * 0.55, g0, zb + h * 0.12), (bc, g0, zb + h * 0.66),
                     (bc - X * 0.55, g1, zb + h * 0.12), (bc + X * 0.55, g1, zb + h * 0.12), (bc, g1, zb + h * 0.66)],
                 orn)
        kit.hull(p, [(bc, g0, zb + h * 0.7), (bc - 0.25 * k, g0, zb + h * 0.78), (bc, g0, zb + h * 0.86),
                     (bc + 0.25 * k, g0, zb + h * 0.78), (bc, g1, zb + h * 0.7), (bc, g1, zb + h * 0.86)], orn)
        # the beam under the gable (คอสอง)
        kit.block(p, bc - X - 0.1, f0 - dirn * 0.02, zb - 0.3 * k, bc + X + 0.1, a + dirn * 0.02, zb, orn)
    for s in (-1, 1):
        A = (bc + s * (half + over + 0.08), ez - 0.07)
        B = (bc, top + 0.07)
        d, n = _board(p, A, B, w, ya, yb, orn)
        A, B = Vector(A), Vector(B)
        L = (B - A).length
        # ใบระกา: a row of fins on the board's top edge, leaning down the slope
        t0, t1 = a - dirn * 0.02, a + dirn * 0.06
        for i in range(teeth):
            t = (i + 0.6) / (teeth + 0.4)
            c = A + n * w + d * (L * t)
            hl = L / teeth * 0.33
            hh = 0.34 * k
            tip = c + Vector((0, hh)) - d * (hh * 0.45)
            q0, q1 = c - d * hl, c + d * hl
            kit.hull(p, [(q0.x, t0, q0.y), (q1.x, t0, q1.y), (tip.x, t0, tip.y),
                         (q0.x, t1, q0.y), (q1.x, t1, q1.y), (tip.x, t1, tip.y)], orn)
        # หางหงส์: the foot of the board curls up and outward
        base = A + n * (w * 0.5)
        curl = [(0.0, 0.0), (0.3, 0.12), (0.46, 0.45), (0.36, 0.78), (0.18, 0.86)]
        pts = [Vector((base.x + s * u * k, a + dirn * 0.02, base.y + v * k)) for u, v in curl]
        for i, (p0, p1) in enumerate(zip(pts, pts[1:])):
            p.rod(p0, p1, (0.1 - i * 0.015) * k, orn, seg=5, smooth=False)
    if chofa:
        # ช่อฟ้า: a slender gilt horn rising from the ridge's end, hooking outward and up at its tip
        o = Vector((bc, a + dirn * 0.03, top + 0.12 + w * 0.4))
        path = [(0.0, 0.0), (0.06, 0.55), (0.3, 1.1), (0.62, 1.38), (0.86, 1.52), (0.9, 1.82)]
        pts = [o + Vector((0, dirn * u * k, v * k)) for u, v in path]
        for i, (p0, p1) in enumerate(zip(pts, pts[1:])):
            p.rod(p0, p1, (0.13 - i * 0.018) * k, orn, seg=5, smooth=False)
    return top


def tier(p, m, x0, x1, ya, yb, z, rise, over=0.8, over_ends=0.5, ends=(), k=1.0, fill=None, courses=6, chofa=True,
         border=0.3, teeth=9):
    """One tier of a temple roof, its ridge along Y: the border tiles (green round central roofs) under the field of
    tiles, rows of tiles, and the trim on the given ends ('front', 'back'). Returns the ridge height."""
    half = (x1 - x0) / 2
    bc = (x0 + x1) / 2
    kit.gable_roof(p, (x0, ya, x1, yb), z - 0.05, rise, m['border'], over=over, over_ends=over_ends, axis='y',
                   thick=0.2, fill=fill)
    top = kit.gable_roof(p, (x0, ya, x1, yb), z + 0.04, rise, m['roof'], over=max(0.1, over - border),
                         over_ends=max(0.1, over_ends - border * 0.4), axis='y', thick=0.12, courses=courses,
                         course_mat=m['course'])
    for end in ends:
        a = ya - over_ends if end == 'front' else yb + over_ends
        gable_trim(p, m, bc, a, -1 if end == 'front' else 1, z + 0.04, half, over, rise, k, teeth, chofa)
    return top


# halls ---------------------------------------------------------------------------------------------------------------

def _window(p, m, rect, side, u, z0, w, h):
    """A closed temple window: lacquered shutters in a frame, a sill, and a pointed pediment (ซุ้มหน้าต่าง) above."""
    kit.on_face(p, rect, side, u, z0 - 0.1, w + 0.26, h + 0.2, 0.06, m['frame'])
    kit.on_face(p, rect, side, u, z0, w, h, 0.09, m['door'])
    kit.on_face(p, rect, side, u, z0, 0.04, h, 0.11, m['frame'])
    kit.on_face(p, rect, side, u, z0 - 0.26, w + 0.5, 0.14, 0.16, m['frame'])
    o, along, n = kit.face_frame(rect, side)
    c = o + along * u
    zb, zt = z0 + h + 0.12, z0 + h + 0.12 + h * 0.55
    pts = []
    for dd in (0.02, 0.14):
        for q, zz in ((c + along * (w / 2 + 0.3), zb), (c - along * (w / 2 + 0.3), zb), (c, zt)):
            v = q + n * dd
            pts.append((v.x, v.y, zz))
    kit.hull(p, pts, m['frame'])


def _door(p, m, rect, side, u, z0, w, h):
    kit.on_face(p, rect, side, u, z0, w + 0.36, h + 0.18, 0.07, m['frame'])
    kit.on_face(p, rect, side, u, z0, w, h, 0.1, m['door'])
    kit.on_face(p, rect, side, u, z0, 0.05, h, 0.12, m['frame'])
    o, along, n = kit.face_frame(rect, side)
    c = o + along * u
    zb, zt = z0 + h + 0.2, z0 + h + 0.2 + h * 0.6
    pts = []
    for dd in (0.02, 0.16):
        for q, zz in ((c + along * (w / 2 + 0.4), zb), (c - along * (w / 2 + 0.4), zb), (c, zt)):
            v = q + n * dd
            pts.append((v.x, v.y, zz))
    kit.hull(p, pts, m['frame'])


def _column(p, m, x, y, z0, z1, r=0.22, era=3):
    """A hall's column: a timber post (era 1), a plastered round one (era 2), a square one with a gilt lotus capital."""
    if era == 1:
        p.cyl(r * 0.8, r * 0.75, z1 - z0, m['col'], T(x, y, (z0 + z1) / 2), seg=8, smooth=False)
        return
    if era == 2:
        p.cyl(r, r * 0.92, z1 - z0, m['col'], T(x, y, (z0 + z1) / 2), seg=10, smooth=False)
        kit.block(p, x - r - 0.06, y - r - 0.06, z1 - 0.2, x + r + 0.06, y + r + 0.06, z1, m['cap'])
        return
    kit.block(p, x - r, y - r, z0, x + r, y + r, z1 - 0.4, m['col'])
    p.cyl(r * 0.95, r * 1.5, 0.4, m['cap'], T(x, y, z1 - 0.2), seg=8, smooth=False)
    kit.block(p, x - r - 0.08, y - r - 0.08, z0, x + r + 0.08, y + r + 0.08, z0 + 0.25, m['cap'])


def _murals(p, rect, z0, z1, sides=('left', 'right', 'back')):
    """Isan ฮูปแต้ม read as colour from afar: bands of ochre, blue, green and red on the outer walls (abstract only)."""
    cols = ('mural_ochre', 'mural_blue', 'mural_green', 'mural_red')
    h = (z1 - z0) / 5
    for side in sides:
        fw = kit.face_width(rect, side)
        for i in range(4):
            kit.on_face(p, rect, side, 0, z0 + h * (i + 0.5), fw - 0.6, h * 0.8, 0.03, cols[(i + len(side)) % 4])


def hall(b, cx, y0, y1, w, wall_h, base_h, front=1, back=0, porch=2.0, back_porch=0.0, skirt=False, col_d=1.8,
         step=None, pitch=None, open_=False, murals=False, k=None, doors=None, chofa=True):
    """An ordination hall or viharn, its ridge along Y and its gable to the front: a raised base with mouldings and a
    stair, whitewashed (or timber) walls with pilasters, closed doors and windows under pointed pediments, a porch on
    columns, and a roof of tiers stepping down to the front (front) and back (back) with a ช่อฟ้า, ใบระกา and หางหงส์
    on every gable; skirt adds a colonnade with lean-to roofs (ปีกนก) down the sides. open_: the north's open viharn
    (low walls between posts, a dark inside); open_='posts' an open hall on columns (the sala). Returns the base's
    rectangle."""
    p, q = b.main, b.props
    m = mats(b)
    era = b.era
    slope = pitch or style(b)['pitch']
    step = step or style(b)['step'] * w / 10
    k = k or max(0.55, min(1.15, w / 9.0))
    half = w / 2
    x0, x1 = cx - half, cx + half
    cd = col_d if skirt else 0.0
    yP = y0 - porch
    yQ = y1 + back_porch
    px0, px1 = x0 - cd - 0.5, x1 + cd + 0.5
    py0, py1 = yP - 0.5, yQ + 0.5
    # the base (ฐานบัว) with its mouldings and the stair
    kit.block(p, px0, py0, 0, px1, py1, base_h, m['base'], bevel=0.03)
    if base_h >= 0.5:
        kit.bands(p, (px0, py0, px1, py1), base_h * 0.18, 0.12, 0.06, m['band'])
        kit.bands(p, (px0, py0, px1, py1), base_h - 0.16, 0.12, 0.05, m['band'])
    sw = min(3.2, w * 0.4)
    run = kit.stairs(p, cx, py0, base_h, sw, '-y', m['step'], open_=False)
    for s in (-1, 1):
        xs = cx + s * (sw / 2 + 0.15)
        if b.region == 'north' and era >= 2:
            # a naga balustrade: a plain body down the stair rising to a raised head (no figure detail)
            body = [(xs, py0 + 0.2, base_h + 0.6), (xs, py0 - run, 0.75), (xs, py0 - run - 0.6, 0.6),
                    (xs, py0 - run - 0.9, 1.5)]
            for a, c in zip(body, body[1:]):
                p.rod(a, c, 0.18, m['orn'] if era >= 3 else m['wall'], seg=6, smooth=False)
            p.sphere(0.3, m['orn'] if era >= 3 else m['wall'], T(xs, py0 - run - 1.0, 1.7) @ S(1, 1.4, 1), seg=8,
                     rings=5)
        else:
            kit.hull(p, [(xs - 0.15, py0, base_h + 0.5), (xs + 0.15, py0, base_h + 0.5), (xs - 0.15, py0 - run, 0.5),
                         (xs + 0.15, py0 - run, 0.5), (xs - 0.15, py0, 0), (xs + 0.15, py0, 0),
                         (xs - 0.15, py0 - run, 0), (xs + 0.15, py0 - run, 0)], m['base'])
    if back_porch > 0:
        kit.stairs(p, cx, py1, base_h, sw * 0.7, '+y', m['step'], open_=False)
    fz = base_h
    z_e = fz + wall_h
    # tiers along Y: front tiers cover [yP, yF], the main tier [yF, yB], back tiers [yB, yQ]
    tl = 2.2
    yF = y0 + max(0, front - 1) * tl if front else yP
    yB = y1 - max(0, back - 1) * tl if back else yQ
    if back and back_porch <= 0 and back == 1:
        yB = y1 - 0.01
    over = 0.8
    rise = half * slope
    top = z_e + rise
    segs = []   # (i, ya, yb, end)
    if front:
        fl = (yF - yP) / front
        for i in range(front, 0, -1):
            ya = yF - i * fl
            segs.append((i, ya, ya + fl, 'front'))
    segs.append((0, yF, yB, None))
    if back:
        bl = (yQ - yB) / back
        for i in range(1, back + 1):
            ya = yB + (i - 1) * bl
            segs.append((i, ya, ya + bl, 'back'))
    # walls: under each tier the wall stops at that tier's eave
    rect = (x0, y0, x1, y1)
    for i, ya, yb, end in segs:
        a, c = max(ya, y0), min(yb, y1)
        if c - a < 0.05:
            continue
        zt = z_e - i * step
        if open_ == 'posts':
            kit.block(p, x0 - 0.1, a, zt - 0.5, x1 + 0.1, c, zt, m['band'] if era >= 2 else m['trim'])
            continue
        if open_:
            kit.block(p, x0, a, fz, x1, c, fz + 1.1, m['wall'])
            kit.block(p, x0 + 0.5, max(a, y0 + 0.5), fz, x1 - 0.5, min(c, y1 - 0.2), zt - 0.3, 'lacquer_black')
            kit.block(p, x0 - 0.05, a, zt - 0.6, x1 + 0.05, c, zt, m['wall'])
        else:
            kit.block(p, x0, a, fz, x1, c, zt, m['wall'])
    if open_:
        if open_ != 'posts':
            kit.block(p, x0, y1 - 0.3, fz, x1, y1, z_e - (back and 1 or 0) * step, m['wall'])
        for yy in [y0 + (y1 - y0) * j / max(1, int((y1 - y0) / 2.6)) for j in range(int((y1 - y0) / 2.6) + 1)]:
            for xx in (x0 + 0.2, x1 - 0.2):
                _column(p, m, xx, yy, fz, z_e - step * (front - 1 if yy < yF else 0) - 0.05, 0.22, era)
    else:
        if murals:
            _murals(p, rect, fz + 0.3, min(z_e - (front - 1) * step, z_e) - 0.3)
        # pilasters and windows on the sides
        n = max(2, int((y1 - y0) / 2.7))
        for side in ('left', 'right'):
            for j in range(n + 1):
                u = -(y1 - y0) / 2 + (y1 - y0) * j / n
                kit.on_face(p, rect, side, u, fz, 0.42, wall_h - 0.4 - (front - 1) * step, 0.1,
                            m['band'] if era >= 2 else m['trim'])
            for j in range(n):
                u = -(y1 - y0) / 2 + (y1 - y0) * (j + 0.5) / n
                _window(p, m, rect, side, u, fz + 1.0, 1.0, min(1.8, wall_h * 0.36))
        # doors on the front, one or three; one at the back
        nd = doors or (3 if w >= 9 else 1)
        dh = min(3.2, wall_h * 0.55)
        for j in range(nd):
            u = (j - (nd - 1) / 2) * (w / nd)
            _door(p, m, rect, 'front', u, fz, 1.3 if nd > 1 else 1.4, dh if j == (nd - 1) // 2 or nd == 1 else dh * 0.85)
        if back_porch > 0:
            _door(p, m, rect, 'back', 0, fz, 1.2, dh * 0.85)
        kit.bands(p, rect, z_e - (front - 1) * step - 0.35, 0.2, 0.05, m['band'] if era >= 2 else m['trim'])
    # the colonnade skirt down the sides, stepping with the tiers
    z_low = {}
    if skirt:
        for i, ya, yb, end in segs:
            a, c = max(ya, y0), min(yb, y1)
            if c - a < 0.05:
                continue
            zh = z_e - i * step - over * slope - 0.2
            zl = zh - cd * 0.5
            z_low[i] = zl
            for s in (-1, 1):
                xa, xb = (x0 - cd, x0) if s < 0 else (x1, x1 + cd)
                kit.shed_roof(p, (xa, a - 0.02, xb, c + 0.02), zl, zh, m['roof'], over=0.35,
                              low_side='left' if s < 0 else 'right', thick=0.12, courses=3, course_mat=m['course'])
                kit.block(p, xa - 0.4 if s < 0 else xb, a, zl - 0.25, xa if s < 0 else xb + 0.4, c, zl - 0.12,
                          m['border'])
                xc = x0 - cd + 0.3 if s < 0 else x1 + cd - 0.3
                nn = max(1, int((c - a) / 2.6))
                for j in range(nn + 1):
                    _column(p, m, xc, a + (c - a) * j / nn, fz, zl - 0.1, 0.24 if b.region != 'south' else 0.32, era)
    # the roof tiers
    tops = []
    for i, ya, yb, end in segs:
        lowest = (end == 'front' and i == front) or (end == 'back' and i == back)
        zt = z_e - i * step
        tt = top - i * step
        hx0, hx1 = x0, x1
        if lowest and skirt:
            hx0, hx1 = x0 - cd, x1 + cd
            zt = min(z_low.values()) - step * 0.4
        r = tt - zt
        ends = []
        if end == 'front' or (i == 0 and front):
            ends.append('front')
        if end == 'back' or (i == 0 and back and back_porch > 0) or (i == 0 and not back):
            ends.append('back')
        if i == 0 and not front:
            ends.append('front')
        if end == 'front':
            yy0, yy1 = ya, yb + 0.6
        elif end == 'back':
            yy0, yy1 = ya - 0.6, yb
        else:
            yy0, yy1 = ya, yb
        kk = k * (1 - 0.1 * i)
        tops.append(tier(p, m, hx0, hx1, yy0, yy1, zt, r, over=over + 0.15 * i, over_ends=0.5, ends=ends, k=kk,
                         fill=m['face'], courses=max(3, int(r / 1.2)), chofa=chofa,
                         teeth=max(5, int(7 * (hx1 - hx0) / 10))))
        # porch columns under the lowest tiers
        if lowest:
            yc = ya + 0.35 if end == 'front' else yb - 0.35
            if skirt:
                xs = [hx0 + 0.3 + (hx1 - hx0 - 0.6) * j / 5 for j in range(6)]
            else:
                ncol = 4 if w >= 8 else 2
                xs = [hx0 + 0.3 + (hx1 - hx0 - 0.6) * j / (ncol - 1) for j in range(ncol)]
            for xx in xs:
                _column(p, m, xx, yc, fz, zt - 0.05, 0.26 if b.region == 'south' else 0.22, era)
            kit.block(p, hx0 + 0.1, yc - 0.18, zt - 0.3, hx1 - 0.1, yc + 0.18, zt, m['trim'] if era >= 3 else m['col'])
            # the porch's side columns back to the wall
            ylo, yhi = (yc, y0) if end == 'front' else (y1, yc)
            for xx in (hx0 + 0.3, hx1 - 0.3):
                if yhi - ylo > 1.6:
                    _column(p, m, xx, (ylo + yhi) / 2, fz, zt - 0.05, 0.22, era)
    return {'base': (px0, py0, px1, py1), 'run': run, 'top': max(tops), 'floor': fz}


def sema(b, rect, gap=1.4, front_off=0.0):
    """The eight boundary stones (ใบเสมา) round an ordination hall: at the corners and the middle of each side, each a
    leaf-shaped stone on a pedestal (a lotus base from era 3), facing out."""
    p = b.main
    m = mats(b)
    x0, y0, x1, y1 = rect
    x0, y0, x1, y1 = x0 - gap, y0 - gap - front_off, x1 + gap, y1 + gap
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    spots = [(x0, y0, 225), (x1, y0, 315), (x1, y1, 45), (x0, y1, 135), (cx, y0, 270), (x1, cy, 0), (cx, y1, 90),
             (x0, cy, 180)]
    leaf = [(-0.3, 0.0), (0.3, 0.0), (0.33, 0.5), (0.2, 0.86), (0.0, 1.08), (-0.2, 0.86), (-0.33, 0.5)]
    for x, y, ang in spots:
        if b.era >= 3:
            p.lathe([(0.45, 0), (0.45, 0.2), (0.34, 0.3), (0.42, 0.45), (0.3, 0.5)], [m['sema'], m['band'],
                                                                                        m['orn'], m['sema']],
                    T(x, y, 0), seg=8, cap_top=True, smooth=False)
            z = 0.5
        else:
            kit.block(p, x - 0.4, y - 0.4, 0, x + 0.4, y + 0.4, 0.3, m['base'] if b.era == 2 else 'stone', bevel=0.03)
            z = 0.3
        p.poly_prism(leaf, 0.14, m['sema'], T(x, y, z) @ R(0, 0, ang - 90) @ R(90, 0, 0) @ S(1.0))
    return p


# chedis --------------------------------------------------------------------------------------------------------------

def _rings(p, x, y, z, r0, r1, n, h, mat, seg=12):
    """Stacked rings (ปล้องไฉน) narrowing from r0 to r1 over n rings of height h."""
    prof = []
    for i in range(n):
        r = r0 + (r1 - r0) * i / max(1, n - 1)
        zz = z + i * h
        prof += [(r * 0.86, zz), (r, zz + h * 0.25), (r, zz + h * 0.55), (r * 0.86, zz + h)]
    p.lathe(prof, mat, T(x, y, 0), seg=seg, smooth=False)
    return z + n * h


def _spire(p, x, y, z, r, h, mat, seg=10):
    p.lathe([(r, z), (r * 0.6, z + h * 0.45), (r * 0.25, z + h * 0.85), (0.02, z + h)], mat, T(x, y, 0), seg=seg,
            cap_bottom=True, smooth=False)
    p.sphere(r * 0.45, mat, T(x, y, z + h * 0.72), seg=8, rings=5)
    return z + h


def _terraces(p, x, y, steps, mat, band=None):
    z = 0.0
    for hs, h in steps:
        kit.block(p, x - hs, y - hs, z, x + hs, y + hs, z + h, mat, bevel=0.03)
        if band:
            kit.block(p, x - hs - 0.04, y - hs - 0.04, z + h - 0.12, x + hs + 0.04, y + hs + 0.04, z + h, band)
        z += h
    return z


def chedi_bell(p, m, x, y, H):
    """A bell-shaped chedi (เจดีย์ทรงระฆัง): square terraces, lotus mouldings, the bell, a square throne (บัลลังก์),
    rings and a spire."""
    k = H / 24.0
    z = _terraces(p, x, y, [(3.6 * k, 0.8 * k), (3.1 * k, 0.7 * k), (2.6 * k, 0.6 * k)], m['chedi'], m['chedi_band'])
    prof = [(2.35, 0), (2.35, 0.3), (2.05, 0.45), (2.15, 0.8), (1.9, 0.95), (2.0, 1.3), (1.85, 1.45), (2.05, 1.6),
            (2.1, 2.8), (2.0, 4.1), (1.75, 5.3), (1.3, 6.2), (0.75, 6.8), (0.3, 7.05)]
    mm = [m['chedi']] * (len(prof) - 1)
    mm[1] = mm[3] = mm[5] = m['chedi_band']
    p.lathe([(r * k, z + zz * k) for r, zz in prof], mm, T(x, y, 0), seg=16, smooth=False)
    z += 7.0 * k
    kit.block(p, x - 0.8 * k, y - 0.8 * k, z, x + 0.8 * k, y + 0.8 * k, z + 0.9 * k, m['chedi'])
    kit.block(p, x - 0.9 * k, y - 0.9 * k, z + 0.9 * k, x + 0.9 * k, y + 0.9 * k, z + 1.05 * k, m['chedi_band'])
    z += 1.05 * k
    p.cyl(0.35 * k, 0.45 * k, 0.5 * k, m['chedi'], T(x, y, z + 0.25 * k), seg=10)
    z = _rings(p, x, y, z + 0.5 * k, 0.62 * k, 0.22 * k, 9, 0.5 * k, m['chedi_top'])
    return _spire(p, x, y, z, 0.2 * k, 5.2 * k, m['chedi_top'])


def chedi_lanna(p, m, x, y, H):
    """A Lanna chedi: a tall square stepped base, redented octagonal mouldings, a round bell, rings, a tall spire and a
    small gilt parasol finial."""
    k = H / 24.0
    z = _terraces(p, x, y, [(3.7 * k, 1.1 * k), (3.2 * k, 1.0 * k), (2.7 * k, 0.9 * k), (2.3 * k, 1.4 * k)],
                  m['chedi'], m['chedi_band'])
    prof = [(2.6, 0), (2.6, 0.4), (2.2, 0.6), (2.3, 1.1), (2.0, 1.3), (2.05, 1.8), (1.75, 2.0)]
    p.lathe([(r * k, z + zz * k) for r, zz in prof], m['chedi'], T(x, y, 0) @ R(0, 0, 22.5), seg=8, smooth=False)
    z += 2.0 * k
    prof = [(1.8, 0), (1.95, 0.6), (1.9, 1.6), (1.6, 2.6), (1.0, 3.3), (0.45, 3.6)]
    p.lathe([(r * k, z + zz * k) for r, zz in prof], m['chedi'], T(x, y, 0), seg=16, smooth=False)
    z += 3.6 * k
    z = _rings(p, x, y, z, 0.6 * k, 0.2 * k, 8, 0.48 * k, m['chedi_top'])
    z = _spire(p, x, y, z, 0.2 * k, 5.0 * k, m['chedi_top'])
    for i, r in enumerate((0.55, 0.42, 0.3)):
        p.cyl(r * k, r * k * 0.7, 0.12 * k, m['chedi_top'], T(x, y, z - 2.6 * k + i * 0.45 * k), seg=10)
    return z


def chedi_that(p, m, x, y, H):
    """An Isan ธาตุ: square in plan throughout, a stepped base, a tall body with niches, a swelling lotus bud and a
    long square spire."""
    k = H / 20.0
    prof = [(2.7, 0), (2.7, 0.7), (2.35, 0.7), (2.35, 1.3), (2.0, 1.3), (2.0, 1.9), (1.6, 1.9), (1.6, 2.1),
            (1.45, 2.25), (1.45, 6.0), (1.7, 6.3), (1.95, 7.4), (1.85, 8.4), (1.4, 10.2), (0.9, 11.8), (0.55, 13.2),
            (0.42, 13.4), (0.42, 13.9), (0.28, 14.2), (0.04, 18.5)]
    mm = [m['chedi']] * (len(prof) - 1)
    for i in (9, 10, 11, 15, 16, 17, 18):
        mm[i] = m['chedi_top'] if i >= 15 else m['chedi_band'] if i == 9 else m['chedi']
    p.lathe([(r * k * SQ2, zz * k) for r, zz in prof], mm, T(x, y, 0) @ R(0, 0, 45), seg=4, smooth=False,
            cap_top=False)
    # niches on the body
    for side in kit.SIDES:
        rect = (x - 1.45 * k, y - 1.45 * k, x + 1.45 * k, y + 1.45 * k)
        kit.on_face(p, rect, side, 0, 2.7 * k, 1.0 * k, 2.4 * k, 0.05, 'lacquer_black' if side == 'front' else
                    m['chedi_band'])
    return 18.5 * k


def chedi_srivijaya(p, m, x, y, H):
    """A southern chedi in the Srivijaya way: a square base, a redented square body with niches, small stupas at its
    corners, and a bell, rings and spire in the middle."""
    k = H / 22.0
    z = _terraces(p, x, y, [(3.5 * k, 1.0 * k), (3.1 * k, 0.5 * k)], m['chedi'], m['chedi_band'])
    hs = 2.4 * k
    kit.block(p, x - hs, y - hs, z, x + hs, y + hs, z + 3.2 * k, m['chedi'])
    rect = (x - hs, y - hs, x + hs, y + hs)
    for side in kit.SIDES:
        kit.on_face(p, rect, side, 0, z + 0.5 * k, 1.6 * k, 2.2 * k, 0.25 * k, m['chedi'])
        kit.on_face(p, rect, side, 0, z + 0.8 * k, 0.9 * k, 1.6 * k, 0.28 * k, 'lacquer_black')
    kit.block(p, x - hs - 0.15 * k, y - hs - 0.15 * k, z + 3.2 * k, x + hs + 0.15 * k, y + hs + 0.15 * k, z + 3.5 * k,
              m['chedi_band'])
    z += 3.5 * k
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = x + sx * 1.85 * k, y + sy * 1.85 * k
            p.lathe([(0.45 * k, z), (0.5 * k, z + 0.6 * k), (0.4 * k, z + 1.1 * k), (0.15 * k, z + 1.35 * k)],
                    m['chedi'], T(cx, cy, 0), seg=8, smooth=False)
            _spire(p, cx, cy, z + 1.35 * k, 0.1 * k, 1.4 * k, m['chedi_top'], seg=6)
    prof = [(1.5, 0), (1.55, 0.4), (1.5, 1.6), (1.25, 2.6), (0.8, 3.2), (0.3, 3.45)]
    p.lathe([(r * k, z + zz * k) for r, zz in prof], m['chedi'], T(x, y, 0), seg=14, smooth=False)
    z += 3.4 * k
    kit.block(p, x - 0.55 * k, y - 0.55 * k, z, x + 0.55 * k, y + 0.55 * k, z + 0.7 * k, m['chedi_band'])
    z = _rings(p, x, y, z + 0.7 * k, 0.45 * k, 0.16 * k, 7, 0.45 * k, m['chedi_top'])
    return _spire(p, x, y, z, 0.15 * k, 4.0 * k, m['chedi_top'])


def chedi_mon(p, m, x, y, H):
    """A slender Mon chedi: octagonal terraces stepping in, a tall bell, a long cone of stacked rings and a finial
    with a small parasol."""
    k = H / 24.0
    prof = [(3.3, 0), (3.3, 0.6), (2.9, 0.6), (2.9, 1.2), (2.5, 1.2), (2.5, 1.8), (2.15, 1.8), (2.15, 2.5),
            (1.85, 2.6), (1.95, 3.1)]
    p.lathe([(r * k, zz * k) for r, zz in prof], [m['chedi'], m['chedi_band']] * 4 + [m['chedi']], T(x, y, 0) @
            R(0, 0, 22.5), seg=8, cap_top=False, smooth=False)
    z = 3.1 * k
    prof = [(1.9, 0), (1.85, 1.0), (1.6, 2.4), (1.15, 3.6), (0.7, 4.4), (0.5, 4.7)]
    p.lathe([(r * k, z + zz * k) for r, zz in prof], m['chedi'], T(x, y, 0), seg=14, smooth=False)
    z += 4.7 * k
    z = _rings(p, x, y, z, 0.5 * k, 0.16 * k, 13, 0.55 * k, m['chedi_top'], seg=10)
    z = _spire(p, x, y, z, 0.16 * k, 3.6 * k, m['chedi_top'])
    for i, r in enumerate((0.5, 0.38, 0.26)):
        p.cyl(r * k, r * k * 0.7, 0.12 * k, m['chedi_top'], T(x, y, z - 2.2 * k + i * 0.4 * k), seg=10)
    return z


def prang(p, m, x, y, H):
    """A Khmer-style prang (ปรางค์): stepped square terraces, a redented body with a porch and a dark doorway, and
    tiers swelling and narrowing into a rounded top like a corn cob, with a plain spike."""
    k = H / 16.0
    mat = m['prang']
    z = _terraces(p, x, y, [(3.0 * k, 0.8 * k), (2.6 * k, 0.7 * k), (2.25 * k, 0.6 * k)], mat)
    hs = 1.7 * k
    kit.block(p, x - hs, y - hs, z, x + hs, y + hs, z + 4.0 * k, mat)
    for sx in (-1, 1):
        for sy in (-1, 1):
            kit.block(p, x + sx * hs - 0.3 * k, y + sy * hs - 0.3 * k, z, x + sx * hs + 0.3 * k, y + sy * hs + 0.3 * k,
                      z + 4.0 * k, mat)
    rect = (x - hs, y - hs, x + hs, y + hs)
    kit.on_face(p, rect, 'front', 0, z, 1.6 * k, 3.2 * k, 0.7 * k, mat)
    kit.on_face(p, rect, 'front', 0, z, 0.8 * k, 2.2 * k, 0.75 * k, 'lacquer_black')
    kit.hull(p, [(x - 1.0 * k, y - hs - 0.7 * k, z + 3.2 * k), (x + 1.0 * k, y - hs - 0.7 * k, z + 3.2 * k),
                 (x, y - hs - 0.7 * k, z + 4.4 * k), (x - 1.0 * k, y - hs, z + 3.2 * k), (x + 1.0 * k, y - hs, z + 3.2 * k),
                 (x, y - hs, z + 4.4 * k)], mat)
    z += 4.0 * k
    prof = []
    r, zz = 2.0, 0.0
    for i in range(5):
        h = 1.25 - i * 0.12
        prof += [(r * 0.92, zz), (r * 1.02, zz + 0.25 * h), (r * 0.95, zz + 0.8 * h), (r * 0.82, zz + h)]
        zz += h
        r *= 0.8
    prof += [(r * 0.8, zz + 0.4), (0.25, zz + 0.9), (0.05, zz + 1.0)]
    p.lathe([(rr * k, z + zz * k) for rr, zz in prof], mat, T(x, y, 0) @ R(0, 0, 22.5), seg=8, smooth=False)
    z += prof[-1][1] * k
    p.cyl(0.04 * k, 0.02 * k, 1.4 * k, m['chedi_top'] if mat != 'sandstone' else 'iron', T(x, y, z + 0.7 * k), seg=5)
    return z + 1.4 * k


def chedi(p, m, kind, x, y, H):
    return {'bell': chedi_bell, 'lanna': chedi_lanna, 'that': chedi_that, 'srivijaya': chedi_srivijaya,
            'mon': chedi_mon, 'prang': prang}[kind](p, m, x, y, H)


# the other buildings -------------------------------------------------------------------------------------------------

class _Sub:
    """A stand-in for a Build whose main and props are temporary parts (to draw a hall and turn it)."""

    def __init__(self, b, main, props):
        self.main, self.props, self.yard = main, props, b.yard
        self.era, self.region, self.spec = b.era, b.region, b.spec


def sala(b, x0, y0, x1, y1, z_floor=0.8, h=3.2):
    """The sala (ศาลาการเปรียญ): an open hall on posts with a raised floor, its long side to the front. Timber and
    thatch in era 1, timber and clay tiles in era 2, a concrete base and glazed tiles with lean-to skirts from era 3
    (the south's on red columns), a multi-purpose hall with a back wall and solar panels in era 4, and in era 5 a
    rounded base, timber louvres and a solar roof."""
    p, q = b.main, b.props
    m = mats(b)
    era, r = b.era, b.region
    rect = (x0, y0, x1, y1)
    if era <= 2:
        from . import houses
        top = houses.pavilion(p, rect, z_floor, h, r, roof_mat='thatch' if era == 1 else m['roof'], thatch=era == 1,
                              axis='x', wood='teak' if era == 1 else 'teak_dark', floor_mat='plank', rail=era == 2)
        kit.stairs(p, (x0 + x1) / 2, y0, z_floor, 2.0, '-y', 'teak' if era == 1 else 'brick', open_=era == 1)
        return top
    if era in (3, 4):
        # an open hall on columns under a temple roof in tiers, its gables to the sides, its stair toward the path
        L, W = x1 - x0, y1 - y0
        cd = 1.3

        def draw(pp, qq):
            hall(_Sub(b, pp, qq), 0.0, -L / 2 + 1.4 + 0.5, L / 2 - 1.4 - 0.5, W - 2 * cd - 1.0, h + 1.6, z_floor,
                 front=1, back=1, porch=1.4, back_porch=1.4, skirt=True, col_d=cd, pitch=1.1, open_='posts',
                 k=0.75, step=0.7)
        turned(b, (x0 + x1) / 2, (y0 + y1) / 2, 90, draw)
        return
    # era 5
    if era == 5:
        e5.rbox(p, x0 - 0.3, y0 - 0.3, 0, x1 + 0.3, y1 + 0.3, z_floor, 1.0, m['base'])
    else:
        kit.block(p, x0 - 0.3, y0 - 0.3, 0, x1 + 0.3, y1 + 0.3, z_floor, m['base'], bevel=0.04)
        kit.bands(p, (x0 - 0.3, y0 - 0.3, x1 + 0.3, y1 + 0.3), z_floor - 0.15, 0.1, 0.04, m['band'])
    kit.stairs(p, (x0 + x1) / 2, y0 - 0.3, z_floor, 2.6, '-y', m['step'], open_=False)
    colm = 'lacquer_red' if r in ('south', 'north') else m['col']
    nx = max(3, int((x1 - x0) / 3.0) + 1)
    zc = z_floor + h
    for i in range(nx):
        xx = x0 + 0.3 + (x1 - x0 - 0.6) * i / (nx - 1)
        for yy in (y0 + 0.3, y1 - 0.3):
            kit.block(p, xx - 0.2, yy - 0.2, z_floor, xx + 0.2, yy + 0.2, zc, colm)
    for yy in (y0 + 0.3 + (y1 - y0 - 0.6) / 2,):
        for xx in (x0 + 0.3, x1 - 0.3):
            kit.block(p, xx - 0.2, yy - 0.2, z_floor, xx + 0.2, yy + 0.2, zc, colm)
    kit.bands(p, (x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1), zc - 0.35, 0.35, 0.04, m['band'] if era < 5 else 'timber')
    if era == 4:
        # a multi-purpose hall: a back wall with windows, the rest open
        kit.block(p, x0 + 0.2, y1 - 0.45, z_floor, x1 - 0.2, y1 - 0.25, zc - 0.35, 'whitewash')
        wrect = (x0 + 0.2, y1 - 0.45, x1 - 0.2, y1 - 0.25)
        kit.windows(p, wrect, 'front', z_floor + 1.0, int((x1 - x0) / 2.4), 1.2, 1.4, frame='e4_alu',
                    glass='glass_dark', mullion=False)
    if era == 5:
        for side in ('left', 'right'):
            e5.louvres(p, (x0 + 0.3, y0 + 0.3, x1 - 0.3, y1 - 0.3), side, z_floor + 0.1, zc - 0.4, spacing=0.35,
                       mat='timber')
        e5.louvres(p, (x0 + 0.3, y0 + 0.3, x1 - 0.3, y1 - 0.3), 'back', z_floor + 0.1, zc - 0.4, spacing=0.35,
                   mat='timber')
    roof_mat = m['roof'] if r != 'south' else 'temple_green'
    depth = y1 - y0
    pitch = 0.7 if r == 'north' else 0.8
    if era == 5:
        d = e5.dress(r)
        d['roof'] = roof_mat
        return e5.solar_roof(p, rect, zc, d, axis='x', pitch=0.75, over=1.2, over_ends=0.8, panels='both',
                             fill='whitewash')
    top = regions.house_roof(p, rect, zc, r, roof_mat, axis='x', over=1.3, over_ends=0.8, fill='whitewash',
                             pitch=pitch, courses=6)
    if era == 4:
        e4.gable_solar(p, (x0 - 1.3, y0, x1 + 1.3, y1), zc, depth / 2 * pitch * (0.85 if r == 'south' else 1.0),
                       max(2, int((x1 - x0) / 1.2)), 2, margin=1.4)
    return top


def bell(p, x, y, z_mouth, s=1.0, mat='bell_bronze'):
    """A temple bell hanging with its mouth at z_mouth."""
    p.lathe([(0.36 * s, 0), (0.34 * s, 0.1 * s), (0.29 * s, 0.5 * s), (0.22 * s, 0.75 * s), (0.08 * s, 0.86 * s),
             (0.0, 0.87 * s)], mat, T(x, y, z_mouth), seg=12, smooth=False)
    p.rod((x, y, z_mouth + 0.86 * s), (x, y, z_mouth + 1.15 * s), 0.04, 'iron', seg=4)


def drum_frame(b, x, y):
    """A village temple's drum and bell under a little thatched roof on four posts (era 1's bell tower)."""
    p = b.main
    m = mats(b)
    for sx in (-1, 1):
        for sy in (-1, 1):
            kit.block(p, x + sx * 1.3 - 0.1, y + sy * 0.9 - 0.1, 0, x + sx * 1.3 + 0.1, y + sy * 0.9 + 0.1, 3.0,
                      'teak_dark')
    kit.block(p, x - 1.5, y - 0.12, 2.6, x + 1.5, y + 0.12, 2.8, 'teak_dark')
    bell(p, x + 0.6, y, 1.4, 1.0)
    p.cyl(0.42, 0.42, 0.75, 'lacquer_red', T(x - 0.6, y, 1.6) @ R(90, 0, 0), seg=12)
    for s in (-1, 1):
        p.cyl(0.44, 0.44, 0.04, 'cream', T(x - 0.6, y + s * 0.38, 1.6) @ R(90, 0, 0), seg=12)
    p.rod((x - 0.6, y, 2.05), (x - 0.6, y, 2.6), 0.03, 'rope', seg=4)
    regions.house_roof(p, (x - 1.4, y - 1.0, x + 1.4, y + 1.0), 3.0, b.region,
                       'thatch' if b.era == 1 else m['roof'], axis='x', over=0.5, over_ends=0.4, thatch=b.era == 1,
                       fill=m['wall'], courses=3)


def bell_tower(b, x, y, s=1.0):
    """The bell tower (หอระฆัง): a square tower whose top storey is an open belfry with a bell, under a pyramid roof
    in two tiers with a gilt finial; timber on posts in era 1."""
    p = b.main
    m = mats(b)
    era = b.era
    hs = 1.8 * s
    if era == 1:
        for sx in (-1, 1):
            for sy in (-1, 1):
                kit.block(p, x + sx * hs - 0.12, y + sy * hs - 0.12, 0, x + sx * hs + 0.12, y + sy * hs + 0.12, 6.6,
                          'teak_dark')
        kit.floor_deck(p, (x - hs, y - hs, x + hs, y + hs), 3.6, 'plank', 0.15)
        kit.railing(p, [(x - hs, y - hs), (x + hs, y - hs), (x + hs, y + hs), (x - hs, y + hs)], 3.6, 'teak', h=0.8,
                    closed=True, spacing=0.3)
        kit.stairs(p, x + hs - 0.5, y - hs, 3.6, 0.8, '-y', 'teak', open_=True)
        bell(p, x, y, 4.6, 1.0)
        kit.block(p, x - hs, y - 0.1, 6.2, x + hs, y + 0.1, 6.4, 'teak_dark')
        kit.hip_roof(p, (x - hs, y - hs, x + hs, y + hs), 6.6, 2.4, 'thatch', over=0.7, ridge=0, thick=0.3, courses=4,
                     course_mat='thatch_dark')
        return
    wall = m['wall'] if era >= 3 else 'plaster_white'
    kit.block(p, x - hs - 0.4, y - hs - 0.4, 0, x + hs + 0.4, y + hs + 0.4, 0.6, m['base'])
    kit.block(p, x - hs, y - hs, 0.6, x + hs, y + hs, 4.2, wall)
    rect = (x - hs, y - hs, x + hs, y + hs)
    _door(p, m, rect, 'front', 0, 0.6, 1.0, 2.1)
    kit.bands(p, rect, 4.0, 0.3, 0.12, m['band'] if era >= 3 else 'brick')
    for sx in (-1, 1):
        for sy in (-1, 1):
            kit.block(p, x + sx * (hs - 0.25) - 0.25, y + sy * (hs - 0.25) - 0.25, 4.2, x + sx * (hs - 0.25) + 0.25,
                      y + sy * (hs - 0.25) + 0.25, 7.2, wall)
    kit.railing(p, [(x - hs, y - hs), (x + hs, y - hs), (x + hs, y + hs), (x - hs, y + hs)], 4.3, wall, h=0.7,
                closed=True, spacing=0.5, baluster=0.08)
    bell(p, x, y, 5.2, 1.1)
    kit.block(p, x - hs, y - hs, 6.9, x + hs, y + hs, 7.2, m['band'] if era >= 3 else wall)
    roof = m['roof']
    kit.hip_roof(p, (x - hs, y - hs, x + hs, y + hs), 7.2, 1.0, m['border'], over=0.9, ridge=0, thick=0.2)
    kit.hip_roof(p, (x - hs * 0.7, y - hs * 0.7, x + hs * 0.7, y + hs * 0.7), 7.9, 2.8, roof, over=0.3, ridge=0,
                 thick=0.15, courses=3, course_mat=m['course'])
    _spire(p, x, y, 10.6, 0.25, 2.4, m['orn'] if era >= 2 else roof)


def kuti(b, x, y, w=4.0, d=5.0, angle=0.0, i=0):
    """A monk's hut (กุฏิ), facing -Y before it is turned: on posts with plank walls and a thatched or tiled roof in
    eras 1-2, whitewashed on a plinth with a tiled roof in era 3, with solar panels in era 4, a rounded body under a
    solar roof in era 5. Plain bargeboards, no temple ornaments."""
    era, r = b.era, b.region
    m = mats(b)

    def draw(p, q):
        x0, y0, x1, y1 = -w / 2, -d / 2, w / 2, d / 2
        rect = (x0, y0, x1, y1)
        if era <= 2:
            fz = 1.2
            kit.stilts(p, rect, fz, 3, 3, 'teak_dark', 0.18, 'stone')
            kit.floor_deck(p, (x0 - 0.1, y0 - 1.0, x1 + 0.1, y1 + 0.1), fz, 'plank', 0.12)
            regions.house_walls(p, rect, fz, fz + 2.5, r)
            regions.house_window(p, rect, 'left', 0, fz + 0.9, r)
            regions.house_window(p, rect, 'right', 0, fz + 0.9, r)
            regions.house_door(p, rect, 'front', 0.6, fz, r)
            kit.stairs(p, -1.2, y0 - 1.0, fz, 0.8, '-y', 'teak', open_=True)
            regions.house_roof(p, (x0, y0 - 1.0, x1, y1), fz + 2.5, r, 'thatch' if era == 1 else 'clay_tile',
                               axis='y', over=0.6, over_ends=0.4, thatch=era == 1, courses=4)
            props.water_jar(q, x1 + 0.6, y0 - 0.6, 0.8)
            return
        fz = 0.6
        if era == 5:
            e5.rbox(p, x0 - 0.2, y0 - 1.2, 0, x1 + 0.2, y1 + 0.2, fz, 0.6, m['base'])
            e5.rbox(p, x0, y0, fz, x1, y1, fz + 2.8, 0.9, 'whitewash')
            e5.louvres(p, rect, 'front', fz + 0.3, fz + 2.6, x0 + 0.6, -0.4, spacing=0.3, mat='timber')
            kit.door(p, rect, 'front', 1.0, fz, 0.9, 2.1, leaf='timber', frame='timber')
            d5 = e5.dress(r)
            d5['roof'] = m['roof']
            e5.solar_roof(p, (x0, y0 - 1.0, x1, y1), fz + 2.8, d5, axis='y', pitch=0.6, over=0.5, over_ends=0.4,
                          panels='both', fill='whitewash')
            return
        kit.block(p, x0 - 0.2, y0 - 1.2, 0, x1 + 0.2, y1 + 0.2, fz, m['base'])
        kit.walls(p, rect, fz, fz + 2.8, 'whitewash')
        kit.bands(p, rect, fz + 2.6, 0.2, 0.04, m['band'])
        for side in ('left', 'right'):
            kit.window(p, rect, side, 0, fz + 0.9, 0.9, 1.2, frame='teak_dark', glass='window_dark')
        kit.door(p, rect, 'front', 0.8, fz, 0.9, 2.1, leaf='teak', frame='teak_dark')
        kit.stairs(p, 0.8, y0 - 1.2, fz, 1.0, '-y', m['step'], open_=False)
        rm = 'clay_tile' if r != 'north' else 'clay_tile_dark'
        regions.house_roof(p, (x0, y0 - 1.0, x1, y1), fz + 2.8, r, rm, axis='x', over=0.6, over_ends=0.4, courses=4)
        if era == 4:
            pitch = regions.style(r)['pitch']
            e4.gable_solar(p, (x0 - 0.4, y0 - 1.0, x1 + 0.4, y1), fz + 2.8, (y1 - y0 + 1.0) / 2 * pitch *
                           (0.85 if r == 'south' else 1.0), 3, 1, margin=0.5)
        props.potted(q, x1 + 0.5, y0 - 0.8, 0, 0.5, 'leafy', i)

    turned(b, x, y, angle, draw)


def hotrai(b, x0, y0, angle=0.0, pond=(8.0, 8.0)):
    """The scripture hall (หอไตร) on posts in its pond, reached by a plank bridge from its front (-Y before it is
    turned by angle): a small closed timber hall under a two-tier temple roof."""
    m = mats(b)
    era = b.era
    pw, pd = pond
    yard = b.yard
    ex, ey = (pw, pd) if angle in (0, 180) else (pd, pw)
    kit.block(yard, x0 - ex / 2 - 0.4, y0 - ey / 2 - 0.4, 0, x0 + ex / 2 + 0.4, y0 + ey / 2 + 0.4, 0.07,
              'stone' if era <= 2 else m['base'] if era != 5 else 'grass_dark')
    kit.block(yard, x0 - ex / 2, y0 - ey / 2, 0, x0 + ex / 2, y0 + ey / 2, 0.09, 'water')
    turned(b, x0, y0, angle, lambda p, q: _hotrai(b, p, q, m, era, pw, pd))


def _hotrai(b, p, q, m, era, pw, pd):
    x, y = 0.0, 0.0
    w, d = 3.6, 4.4
    fz = 2.2
    rect = (x - w / 2, y - d / 2, x + w / 2, y + d / 2)
    kit.stilts(p, (x - w / 2 - 0.4, y - d / 2 - 0.4, x + w / 2 + 0.4, y + d / 2 + 0.4), fz, 3, 3,
               'teak_dark' if era <= 2 else m['col'], 0.22, None)
    kit.floor_deck(p, (x - w / 2 - 0.6, y - d / 2 - 0.6, x + w / 2 + 0.6, y + d / 2 + 0.6), fz, 'plank', 0.18)
    kit.railing(p, [(x - w / 2 - 0.6, y - d / 2 - 0.6), (x - 0.5, y - d / 2 - 0.6)], fz, 'teak_dark', h=0.7,
                spacing=0.25)
    kit.railing(p, [(x + 0.5, y - d / 2 - 0.6), (x + w / 2 + 0.6, y - d / 2 - 0.6), (x + w / 2 + 0.6, y + d / 2 + 0.6),
                    (x - w / 2 - 0.6, y + d / 2 + 0.6), (x - w / 2 - 0.6, y - d / 2 - 0.6)], fz, 'teak_dark', h=0.7,
                spacing=0.25)
    regions.house_walls(p, rect, fz, fz + 2.6, b.region, wood='teak' if era <= 3 else 'teak_light')
    _door(p, m, rect, 'front', 0, fz, 1.0, 1.9)
    for side in ('left', 'right'):
        _window(p, m, rect, side, 0, fz + 0.9, 0.8, 1.0)
    # the plank bridge to the bank
    kit.block(p, x - 0.5, y - pd / 2 - 0.8, fz - 0.15, x + 0.5, y - d / 2 - 0.6, fz, 'plank')
    kit.hull(p, [(x - 0.5, y - pd / 2 - 0.8, fz), (x + 0.5, y - pd / 2 - 0.8, fz), (x - 0.5, y - pd / 2 - 3.0, 0.1),
                 (x + 0.5, y - pd / 2 - 3.0, 0.1), (x - 0.5, y - pd / 2 - 0.8, fz - 0.15),
                 (x + 0.5, y - pd / 2 - 0.8, fz - 0.15), (x - 0.5, y - pd / 2 - 3.0, 0.0),
                 (x + 0.5, y - pd / 2 - 3.0, 0.0)], 'plank')
    slope = 1.2 if b.region != 'north' else 0.9
    tier(p, m, x - w / 2, x + w / 2, y - d / 2 - 0.6, y + d / 2 + 0.6, fz + 2.6 - 0.6, (w / 2) * slope, over=0.9,
         over_ends=0.4, ends=('front', 'back'), k=0.5, fill=m['face'], courses=3, teeth=6)
    tier(p, m, x - w / 2 + 0.3, x + w / 2 - 0.3, y - d / 2 + 0.6, y + d / 2 - 0.6, fz + 2.6 + 0.4,
         (w / 2 - 0.3) * slope, over=0.5, over_ends=0.3, ends=('front', 'back'), k=0.45, fill=m['face'], courses=3,
         teeth=5)
    for i in range(6):
        q.cyl(0.32, 0.32, 0.03, ('leaf_dark', 'leaf')[i % 2],
              T(x - pw / 2 + 0.9 + (i % 3) * 1.0, y + pd / 2 - 1.0 - (i // 3) * 1.2, 0.1), seg=8)
    for i in range(3):
        q.sphere(0.12, 'lotus', T(x + pw / 2 - 1.0 - i * 0.7, y - pd / 2 + 1.0 + (i % 2) * 0.8, 0.2), seg=6, rings=4)


def pavilion(b, x, y, w=4.0, d=4.0):
    """A small open pavilion (ศาลาราย) with benches, its roof the era's small roof."""
    from . import houses
    m = mats(b)
    era = b.era
    houses.pavilion(b.main, (x - w / 2, y - d / 2, x + w / 2, y + d / 2), 0.45, 2.6, b.region,
                    roof_mat='thatch' if era == 1 else (m['roof'] if era >= 3 else 'clay_tile'), thatch=era == 1,
                    axis='x', wood='teak' if era <= 2 else 'whitewash', floor_mat='plank' if era <= 2 else m['floor'])


# the compound --------------------------------------------------------------------------------------------------------

def gate(b, x, y, angle, opening=4.0, big=True):
    """A gate (ซุ้มประตู) in the compound wall at (x, y) on the wall line, drawn facing -Y and turned to its wall: two
    pillars running from the wall's outer face inward and a lintel under a small temple roof (thatched timber in era
    1), the roof set back inside so that nothing reaches past the compound's edge."""
    m = mats(b)
    era = b.era
    d = 1.2 if big else 1.0
    inset = (1.05 if big else 0.82) if era > 1 else 0.9

    def draw(p, q):
        hw = opening / 2
        ph = 3.4 if big else 2.7
        ps = 0.45 if big else 0.32
        y0 = -inset - WALL_T / 2   # the wall's outer face
        if era == 1:
            for s in (-1, 1):
                for yy in (-0.55, 0.55):
                    kit.block(p, s * (hw + 0.15) - 0.13, yy - 0.13, 0, s * (hw + 0.15) + 0.13, yy + 0.13, ph,
                              'teak_dark')
                kit.block(p, s * (hw + 0.15) - 0.1, y0, 0.3, s * (hw + 0.15) + 0.1, 0.55, 0.42, 'teak_dark')
            kit.block(p, -hw - 0.4, -0.7, ph - 0.3, hw + 0.4, 0.7, ph, 'teak_dark')
            regions.house_roof(p, (-(hw + 0.4), -0.55, hw + 0.4, 0.55), ph, 'central', 'thatch', axis='y', over=0.5,
                               over_ends=0.3, thatch=True, fill='teak')
            return
        for s in (-1, 1):
            cx = s * (hw + ps)
            kit.block(p, cx - ps, y0, 0, cx + ps, d / 2 + 0.1, ph, m['pillar'], bevel=0.04)
            kit.block(p, cx - ps - 0.08, y0, 0, cx + ps + 0.08, d / 2 + 0.18, 0.4, m['band'])
            kit.block(p, cx - ps - 0.08, -d / 2 - 0.18, ph - 0.3, cx + ps + 0.08, d / 2 + 0.18, ph, m['band'])
            if era >= 3:
                kit.on_face(p, (cx - ps, y0, cx + ps, d / 2 + 0.1), 'front', 0, 0.8, ps, ph * 0.5, 0.04, m['orn'])
        kit.block(p, -hw - ps * 2, -0.35, ph, hw + ps * 2, 0.35, ph + 0.55, m['pillar'])
        kit.block(p, -hw, -0.4, ph - 0.25, hw, 0.4, ph, m['band'])
        w = opening + ps * 4 + 0.2
        tier(p, m, -w / 2, w / 2, -d / 2, d / 2, ph + 0.55, (w / 2) * 1.2, over=0.5, over_ends=0.25,
             ends=('front', 'back'), k=0.45 if big else 0.35, fill=m['face'], courses=3, teeth=5)
        if era >= 4:
            for s in (-1, 1):
                p.cyl(0.16, 0.16, 0.36, 'lamp', T(s * (hw + ps), d / 2 + 0.28, ph - 0.6), seg=8)

    a = math.radians(angle)
    turned(b, x - math.sin(a) * inset, y + math.cos(a) * inset, angle, draw)


def compound_wall(b, gates):
    """The compound wall (กำแพงแก้ว) along the 47 m square's edge, closed but for its gates: a timber and woven bamboo
    fence in era 1, a plastered wall with a coping and pillars after (lotus-bud pillar tops from era 3).
    gates: [(side, u, opening)] with u along the side (x on the front and back, y on the sides)."""
    p = b.main
    m = mats(b)
    era = b.era
    e = WALL_E
    t = WALL_T
    h = 1.25
    for side in ('front', 'back', 'left', 'right'):
        cuts = sorted([(u - op / 2 - (0.9 if era > 1 else 0.3), u + op / 2 + (0.9 if era > 1 else 0.3))
                       for s, u, op in gates if s == side])
        edges = []
        a = -e - t / 2
        for c0, c1 in cuts:
            edges.append((a, c0))
            a = c1
        edges.append((a, e + t / 2))

        def box(u0, u1, z0, z1, th, mat):
            if side in ('front', 'back'):
                yy = -e if side == 'front' else e
                kit.block(p, u0, yy - th / 2, z0, u1, yy + th / 2, z1, mat)
            else:
                xx = -e if side == 'left' else e
                kit.block(p, xx - th / 2, u0, z0, xx + th / 2, u1, z1, mat)

        for u0, u1 in edges:
            if u1 - u0 < 0.2:
                continue
            if era == 1:
                box(u0, u1, 0.25, 1.05, 0.05, m['fence'])
                box(u0, u1, 0.2, 0.32, 0.12, 'teak_dark')
                box(u0, u1, 0.95, 1.1, 0.14, 'teak_dark')
                n = max(1, int((u1 - u0) / 2.4))
                for i in range(n + 1):
                    uu = u0 + 0.08 + (u1 - u0 - 0.16) * i / n
                    box(uu - 0.08, uu + 0.08, 0, 1.35, 0.16, 'teak_dark')
                continue
            box(u0, u1, 0, h, t, m['fence'])
            box(u0, u1, 0, 0.18, t + 0.06, m['band'] if era >= 3 else 'brick')
            box(u0 - 0.02, u1 + 0.02, h, h + 0.12, t + 0.16, m['coping'])
            n = max(1, int((u1 - u0) / 5.0))
            for i in range(n + 1):
                uu = u0 + 0.25 + (u1 - u0 - 0.5) * i / n
                box(uu - 0.25, uu + 0.25, 0, h + 0.35, 0.56, m['fence'])
                box(uu - 0.28, uu + 0.28, h + 0.35, h + 0.45, 0.6, m['coping'])
                if era >= 3:
                    if side in ('front', 'back'):
                        cx, cy = uu, (-e if side == 'front' else e)
                    else:
                        cx, cy = (-e if side == 'left' else e), uu
                    # a lotus-bud top, read as a small pointed cap
                    z0 = h + 0.45
                    kit.hull(p, [(cx - 0.18, cy - 0.18, z0), (cx + 0.18, cy - 0.18, z0), (cx + 0.18, cy + 0.18, z0),
                                 (cx - 0.18, cy + 0.18, z0), (cx, cy, z0 + 0.5)],
                             m['coping'] if era != 5 else 'gold_leaf')
    for side, u, op in gates:
        if side == 'front':
            gate(b, u, -e, 0, op, op >= 3.5)
        elif side == 'back':
            gate(b, u, e, 180, op, op >= 3.5)
        elif side == 'left':
            gate(b, -e, u, -90, op, op >= 3.5)
        else:
            gate(b, e, u, 90, op, op >= 3.5)


def bodhi(b, x, y, h=12.5, r=5.2, seed=17):
    """The bodhi tree (ต้นโพธิ์): a broad spreading tree on a raised round bed with a low wall."""
    m = mats(b)
    ring = 'brick' if b.era <= 2 else m['base']
    b.main.lathe([(2.3, 0), (2.3, 0.55), (2.0, 0.55), (2.0, 0.35)], ring, T(x, y, 0), seg=16, smooth=False)
    b.main.cyl(2.0, 2.0, 0.3, 'dirt_dark', T(x, y, 0.2), seg=16)
    q = b.props
    q.cyl(0.5, 0.38, h * 0.5, 'trunk', T(x, y, h * 0.25), seg=9)
    for a in (30, 150, 270):
        aa = math.radians(a)
        q.rod((x, y, h * 0.42), (x + math.cos(aa) * r * 0.55, y + math.sin(aa) * r * 0.55, h * 0.62), 0.22, 'trunk',
              seg=6)
    props.tree(q, x, y, h, r, seed, mats=('leaf_dark', 'leaf', 'leaf_dark'))
    for a in (60, 200, 320):
        aa = math.radians(a)
        q.sphere(r * 0.55, 'leaf', T(x + math.cos(aa) * r * 0.7, y + math.sin(aa) * r * 0.7, h * 0.62) @ S(1, 1, 0.7),
                 seg=10, rings=6)


def lotus_pond(b, x0, y0, x1, y1, seed=0):
    """A lotus pond with a kerb, pads and a few flowers (era 5)."""
    kit.block(b.yard, x0 - 0.35, y0 - 0.35, 0, x1 + 0.35, y1 + 0.35, 0.12, 'granite')
    kit.block(b.yard, x0, y0, 0, x1, y1, 0.15, 'water')
    rnd = props._rng(seed + 5)
    q = b.props
    for i in range(int((x1 - x0) * (y1 - y0) / 2.2)):
        xx = x0 + 0.4 + rnd() * (x1 - x0 - 0.8)
        yy = y0 + 0.4 + rnd() * (y1 - y0 - 0.8)
        q.cyl(0.32 + rnd() * 0.2, 0.32, 0.03, ('leaf_dark', 'leaf')[i % 2], T(xx, yy, 0.18), seg=8)
        if i % 3 == 0:
            q.sphere(0.13, 'lotus', T(xx + 0.1, yy, 0.32), seg=6, rings=4)
