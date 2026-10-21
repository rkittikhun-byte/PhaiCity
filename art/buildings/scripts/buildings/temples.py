# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The temple compounds (วัด, PLAN.md "Temples"; owner, 21 Oct 2026: every community has a temple, and its temple
changes with the era): three levels in every era and region, each a 3x3 compound (47 x 47 m inside its 48 m square)
enclosed by its wall (กำแพงแก้ว) with the main gate in the middle of the front (-Y) and side gates.

    temple_1  a village's first temple: a sala, a small hall with its eight sema stones, two monks' huts, the bodhi
              tree, a drum and bell under a little roof, bananas and coconuts
    temple_2  a proper ordination hall, a bell tower, a small chedi, four huts, a bigger sala
    temple_3  the full compound: ordination hall in tiers with a colonnade, viharn, a large chedi (a prang in the east),
              sala, bell tower, the hut row, a scripture hall in its pond where the region has one, three gates

The buildings grow in the same compound: the hall in the middle-back, the chedi behind it, the sala front-left, the
huts down the right side, the bodhi tree back-left. Dressed by era and region in lib/temple_parts.py. No Buddha images,
no figures, no flags, no text; ช่อฟ้า, ใบระกา and หางหงส์ only on the temple buildings (CLAUDE.md licence rule 8).
"""

from lib import props, regions
from lib import era4_parts as e4
from lib import era5_parts as e5
from lib import props_region as pr
from lib import temple_parts as tp
from lib.builder import registry

NAMES = {
    1: ('วัดประจำหมู่บ้าน', 'Village temple'),
    2: ('วัดประจำตำบล', 'Town temple'),
    3: ('พระอารามประจำเมือง', 'Great temple of the city'),
}


# the yard ----------------------------------------------------------------------------------------------------------

def ground(b, m):
    b.ground(m['yard'])
    if b.era == 4:
        # grass beds in the corners of the granite
        for x0, y0, x1, y1 in ((-22.8, 19.5, -19.0, 22.8), (19.0, 19.5, 22.8, 22.8)):
            e4.lawn(b, x0, y0, x1, y1)


def court(b, m, rect, pad=2.2):
    """The paved court round a hall from era 3 (sand round it before)."""
    if not m['court']:
        return
    x0, y0, x1, y1 = rect
    b.path(x0 - pad, y0 - pad, x1 + pad, y1 + pad, m['court'], z=0.06)


def main_path(b, m, y_end, w=2.8):
    b.path(-w / 2, -tp.INNER - 0.25, w / 2, y_end, m['path'], z=0.075)


def lamps(b, ys, x=2.3):
    """Lamps along the main path: street lamps in era 4, slim solar lights in era 5."""
    for y in ys:
        for s in (-1, 1):
            if b.era == 4:
                props.street_lamp(b.props, s * x, y, 4.5, 90 if s < 0 else -90, 'e4_graphite')
            elif b.era == 5:
                e5.lamp_post(b.props, s * x, y, 4.0)


def front_ponds(b):
    """Era 5's lotus ponds either side of the main path."""
    tp.lotus_pond(b, -8.6, -21.6, -3.0, -16.2, 1)
    tp.lotus_pond(b, 3.0, -21.6, 8.6, -16.2, 2)


def parking(b, x0=3.0, x1=13.4):
    """Era 4's small parking lane inside the front wall."""
    e4.parking(b, x0, -22.75, x1, -19.0, int((x1 - x0) / 2.6), axis='x')


def greenery(b, spots, seed=0):
    """The yard's trees and plants: the region's plants (fruit trees in the east), more and greener in era 5."""
    q = b.props
    for i, (x, y) in enumerate(spots):
        k = seed + i
        # keep crowns and fronds inside the compound
        x, y = max(-18.8, min(18.8, x)), max(-18.8, min(18.8, y))
        if b.region == 'east' and i % 3 == 0:
            pr.fruit_tree(q, x, y, ('durian', 'rambutan')[k % 2], 5.5, 2.2, 21 + k)
        elif i % 4 == 3:
            props.coconut(q, x, y, 9.0 + (k % 3), seed=k)
        elif i % 4 == 1 and b.era <= 2:
            props.banana(q, x, y, seed=k)
        else:
            regions.plant(b, x, y, k, big=True)
        if b.era == 5:
            props.bush(q, x + 1.4, y - 0.6, 0.6, k, 'leaf_dark', 'flower_pink' if k % 2 else 'flower_yellow')


def wall_shrubs(b, seed=0):
    """Era 5's planting along the inside of the wall."""
    q = b.props
    for i in range(9):
        t = -20.0 + i * 5.0
        for x, y in ((-22.2, t), (22.2, t)):
            props.bush(q, x, y, 0.7, seed + i, 'leaf_dark', 'flower_red' if i % 3 == 0 else None)


def stair_pots(b, hall, n=2):
    """Lotus basins either side of the hall's stair from era 2."""
    if b.era < 2:
        return
    x0, y0, x1, y1 = hall['base']
    yy = y0 - hall['run'] - 0.9
    for s in (-1, 1):
        pr.lotus_pot(b.props, s * 2.6, yy, 0.0, 0.45)


_last = {}


def tick(b, label):
    """With TEMPLE_DEBUG set, print how many triangles the last step added to the building."""
    import os
    if not os.environ.get('TEMPLE_DEBUG'):
        return
    n = sum(len(f.verts) - 2 for f in b.main.bm.faces)
    k = id(b)
    print('STEP    %-12s %6d' % (label, n - _last.get(k, 0)))
    _last[k] = n


def parts_report(b):
    def tris(part):
        return sum(len(f.verts) - 2 for f in part.bm.faces)
    print('PARTS   era%d_%s_%s main %d props %d yard %d' % (b.era, b.region, b.spec['kind'], tris(b.main),
                                                            tris(b.props), tris(b.yard)))


# the three levels ----------------------------------------------------------------------------------------------------

def temple_1(b):
    """A village's first temple: a small hall (a sim in Isan) with sema, a sala, two huts, the bodhi tree, a drum and
    bell frame, bananas and coconuts."""
    m = tp.mats(b)
    r, era = b.region, b.era
    ground(b, m)
    w = 6.0 if era == 1 else 6.6
    north = r == 'north'
    hall = tp.hall(b, 0.0, 0.0, 10.0, w + (0.6 if north else 0), 3.0 if north else 3.4, 0.6 if era == 1 else 0.8,
                   front=2 if north else 1, back=1 if north else 0, porch=1.8, back_porch=1.0 if north else 0.0,
                   skirt=False, pitch=1.15 if north else None, murals=r == 'northeast' and era >= 2)
    court(b, m, hall['base'])
    tp.sema(b, hall['base'], 1.3, hall['run'])
    main_path(b, m, hall['base'][1] - hall['run'])
    stair_pots(b, hall)
    tp.sala(b, -19.6, -19.6, -9.8, -12.0, 0.8, 3.0)
    for y in (1.5, 10.0):
        tp.kuti(b, 18.6, y, angle=-90, i=int(y))
    tp.bodhi(b, -14.0, 14.0, 11.5, 4.8)
    tp.drum_frame(b, 12.0, -14.0)
    tp.compound_wall(b, [('front', 0.0, 4.0), ('right', -11.0, 2.2)])
    if era == 4:
        parking(b, 3.2, 16.2)
    if era == 5:
        front_ponds(b)
        wall_shrubs(b, 3)
    lamps(b, (-19.0, -12.0, -6.0))
    greenery(b, [(-21.0, 3.0), (-20.5, 8.5), (20.8, 20.8), (-21.5, -6.5), (-5.5, 19.5), (6.5, 19.0), (10.0, 6.0),
                 (21.0, -19.5)], 1)
    props.water_jar(b.props, -9.0, -10.0, 0.9)
    parts_report(b)


def temple_2(b):
    """A town temple: a proper ordination hall with sema, a bell tower, a small chedi behind the hall, four huts and a
    bigger sala."""
    m = tp.mats(b)
    st = tp.style(b)
    r, era = b.region, b.era
    ground(b, m)
    north, isan = r == 'north', r == 'northeast'
    w = 7.2 if isan else (8.6 if north else 8.0)
    hall = tp.hall(b, 0.0, -2.0, 12.0, w, 5.6 if north else 4.6, 0.6 if era == 1 else 0.9,
                   front=2 if north else 1, back=0 if isan else 1, porch=2.2, back_porch=0.0 if isan else 1.2,
                   skirt=north, col_d=1.4, murals=isan and era >= 2)
    court(b, m, hall['base'])
    tp.sema(b, hall['base'], 1.4, hall['run'])
    main_path(b, m, hall['base'][1] - hall['run'])
    stair_pots(b, hall)
    tp.chedi(b.main, m, st['chedi'], 0.0, 18.9, 10.5 if st['chedi'] != 'mon' else 12.0)
    tp.sala(b, -20.6, -20.6, -7.6, -11.0, 0.9, 3.4)
    tp.bell_tower(b, 12.5, -13.5, 1.0)
    for y in (-5.5, 1.5, 8.5, 15.5):
        tp.kuti(b, 18.6, y, angle=-90, i=int(y + 10))
    tp.bodhi(b, -15.0, 15.0, 12.5, 5.2)
    tp.compound_wall(b, [('front', 0.0, 4.0), ('right', -11.5, 2.2)])
    if era == 4:
        parking(b, 3.0, 16.0)
    if era == 5:
        front_ponds(b)
        wall_shrubs(b, 5)
    lamps(b, (-20.0, -14.0, -9.0))
    greenery(b, [(-21.0, 2.0), (-21.0, -6.0), (-7.5, 20.5), (7.5, 20.5), (-14.0, 4.0), (-9.0, -6.0), (20.8, -20.8),
                 (-21.5, 21.5)], 2)
    parts_report(b)


def temple_3(b):
    """The full compound: the ordination hall in tiers with its colonnade and sema, a viharn, a large chedi (a prang
    in the east), the sala, a bell tower, the hut row, a scripture hall in its pond (Isan, central, north) or a small
    pavilion, the bodhi tree and three gates."""
    m = tp.mats(b)
    st = tp.style(b)
    r, era = b.region, b.era
    ground(b, m)
    north, isan = r == 'north', r == 'northeast'
    if isan:
        hall = tp.hall(b, 0.0, -6.0, 9.0, 8.0, 5.4, 1.0 if era > 1 else 0.7, front=1, back=0, porch=2.4,
                       back_porch=0.0, skirt=era >= 3, col_d=1.5, murals=era >= 2)
    elif north:
        hall = tp.hall(b, 0.0, -8.0, 10.0, 11.0, 6.0, 0.8, front=st['front'], back=st['back'], porch=2.6,
                       back_porch=1.6, skirt=True, col_d=1.6)
    else:
        sk = st['skirt'] and era >= 2
        hall = tp.hall(b, 0.0, -8.0, 10.0, 10.0, 6.8 if sk else 5.8, 1.2 if era > 1 else 0.8,
                       front=st['front'] if era > 1 else 1, back=st['back'], porch=2.6, back_porch=1.6, skirt=sk,
                       col_d=1.8)
    tick(b, 'hall')
    court(b, m, hall['base'], 2.0)
    tp.sema(b, hall['base'], 1.4, hall['run'])
    main_path(b, m, hall['base'][1] - hall['run'])
    stair_pots(b, hall)
    tick(b, 'sema')
    # the viharn, left of the hall
    vw = 8.6 if north else 8.0
    vx = -15.3 if north else -14.6
    vihan = tp.hall(b, vx, -2.4, 11.0, vw, 5.0 if north else 5.4, 0.9 if era > 1 else 0.6,
                    front=2 if north else 1, back=1 if north else 0, porch=2.0, back_porch=0.8 if north else 0.0,
                    skirt=False, open_=north and era >= 2, murals=isan and era >= 2,
                    pitch=1.0 if north else None)
    tick(b, 'viharn')
    court(b, m, vihan['base'], 1.0)
    b.path(vx - 1.2, -11.6, vx + 1.2, vihan['base'][1] - vihan['run'], m['path'], z=0.075)
    b.path(vx, -12.8, 0, -11.2, m['path'], z=0.075)
    # the chedi (or prang) behind the hall
    kind = st['chedi3'] if era >= 3 else st['chedi']
    H = {'bell': 23.0, 'lanna': 23.0, 'that': 21.0, 'srivijaya': 21.0, 'mon': 25.0, 'prang': 17.0}[kind]
    if era == 1:
        H *= 0.7
    tp.chedi(b.main, m, kind, 0.0, 18.6, H)
    tick(b, 'chedi')
    tp.sala(b, -21.6, -21.6, -11.0, -13.6, 1.0, 3.6)
    tick(b, 'sala')
    tp.bell_tower(b, 13.0, -10.5, 1.0)
    tick(b, 'bell')
    if st['hotrai']:
        tp.hotrai(b, 18.6, -18.0, -90, (8.0, 8.0))
    else:
        tp.pavilion(b, 18.0, -18.0, 4.6, 4.6)
        greenery(b, [(21.0, -13.5), (14.5, -21.5)], 9)
    for y in (-4.0, 3.0, 10.0, 17.0):
        tp.kuti(b, 18.8, y, angle=-90, i=int(y + 10))
    tick(b, 'hotrai+kuti')
    tp.bodhi(b, -16.4, 17.0, 13.0, 4.7)
    tp.compound_wall(b, [('front', 0.0, 4.4), ('left', -9.5, 2.4), ('right', -11.0, 2.4)])
    tick(b, 'wall')
    if era == 4:
        parking(b, 2.6, 11.0)
    if era == 5:
        front_ponds(b)
        wall_shrubs(b, 7)
    lamps(b, (-20.0, -15.0))
    greenery(b, [(-8.0, 21.0), (8.0, 21.0), (-21.5, 21.5), (-8.5, -20.5) if era != 5 else (-10.0, -10.5),
                 (8.5, -20.5) if era < 4 else (11.5, -16.0)], 3)
    parts_report(b)


TEMPLE_SETS = {}
for _era in range(1, 6):
    _items, _building = registry(_era)
    for _level, _fn in ((1, temple_1), (2, temple_2), (3, temple_3)):
        _building('temple_%d' % _level, _level, *NAMES[_level])(_fn)
    TEMPLE_SETS['era%d' % _era] = _items
