# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 1's frontage variants (PLAN.md "Frontage"): the farming village's row of timber shop rooms (ห้องแถวไม้ริมทาง)
one bay wide, 4 m, under one long thatched roof running along the road, each room open behind its folding plank doors
onto a plank veranda under a thatched lean-to, its goods out front and a hand-painted sign (no brands); the taller row
is a rice trader's store with a loft. The roof runs on across the bays of a terrace and closes in a gable only at its
ends (lib/frontage_parts.row_roof), dressed by region there (a plain กาแล in the north, fretwork in the south, turned
bargeboard ends in the centre, east and west). And a house on posts on a 12 m plot. True sizes (PLAN.md)."""

from lib import era2_parts as e2
from lib import frontage_parts as fp
from lib import houses, kit, props, regions
from lib import props_region as pr
from lib import props_work as pw
from lib.builder import BAY_M, registry
from lib.mesh import T

BUILDINGS, building = registry(1)

ROOM = (-4.4, 2.6)     # the shop room's front and back walls (y); the veranda in front of it
VERANDA = -6.4
INDEX = {'one': 0, 'left': 1, 'mid': 2, 'mid2': 3, 'right': 4}
SIGNS = ('sign_cream', 'sign_cream', 'sign_red', 'sign_green', 'sign_blue')


def path_mat(b):
    return 'dirt_dark' if b.region == 'northeast' else 'paving'


def goods(b, place, y, tall):
    """What the shop sells, out on its veranda and in front of it."""
    q = b.props
    r = b.region
    if tall:
        props.sacks(q, -0.8, y + 0.2, 4)
        props.sacks(q, 0.9, y + 0.1, 3)
        if place in ('one', 'right'):
            q.box((0.12, 0.12, 2.0), 'teak_dark', T(1.4, y - 1.2, 1.0))
            q.box((1.4, 0.08, 0.08), 'teak_dark', T(1.4, y - 1.2, 2.0))
            for s in (-1, 1):
                q.rod((1.4 + s * 0.65, y - 1.2, 2.0), (1.4 + s * 0.65, y - 1.2, 1.3), 0.01, 'rope', seg=3)
                q.cyl(0.22, 0.22, 0.05, 'metal', T(1.4 + s * 0.65, y - 1.2, 1.28), seg=8)
        return
    if place in ('one', 'left'):
        props.table_stall(q, -0.4, y - 0.9, 2.2, 0.8)
        for x in (-1.4, -0.5, 0.4, 1.3):
            q.rod((x, VERANDA + 0.1, 2.5), (x, VERANDA + 0.1, 2.0), 0.01, 'rope', seg=3)
            q.cyl(0.12, 0.06, 0.4, 'banana_fruit', T(x, VERANDA + 0.1, 1.8), seg=6)
    elif place == 'mid':
        props.table_stall(q, 0.2, y - 0.9, 2.0, 0.8, goods=('banana_fruit', 'flower_red'))
        props.water_jar(q, -1.4, y - 0.6, 0.8)
    elif place == 'mid2':
        if r == 'northeast':
            pr.rice_baskets(q, -0.4, y - 0.8)
        else:
            props.sacks(q, -0.6, y - 0.7, 3)
        props.bench(q, 0.9, y - 0.9, 1.4, facing=90)
    else:
        props.table_stall(q, 0.3, y - 0.9, 2.0, 0.8, goods=('leaf_light', 'paint_orange', 'cream'))
        props.bench(q, -1.3, y - 1.0, 1.2, facing=90)


def bay(b, tall):
    """One shop room of the row: a plank floor on a low plinth, walls of the region's boards (end walls only where it
    ends a terrace), folding plank doors open on the veranda, the long thatched roof, the veranda's thatched lean-to
    on posts at the party lines, the sign; jars, a woodpile and a banana behind."""
    r = b.region
    st = regions.style(r)
    p, q = b.main, b.props
    place = fp.place_of(b)
    left, right = fp.ends_of(b)
    i = INDEX[place]
    trim = st['trim']
    x0, x1 = -BAY_M / 2, BAY_M / 2
    b.ground(regions.ground_mat(r, b.era))
    fp.sidewalk(b, VERANDA, path_mat(b), 'dirt_dark' if r != 'northeast' else 'laterite', z=0.05)
    floor = 0.6 if tall else 0.45
    wall_top = floor + (4.0 if tall else 3.0)
    rect = (x0, ROOM[0], x1, ROOM[1])
    # the floor and the veranda in front of it, a step down to the road
    kit.block(p, x0, VERANDA, 0, x1, ROOM[1], floor, 'stone' if r == 'south' else 'plank', bevel=0.0)
    kit.block(p, x0, VERANDA - 0.32, 0, x1, VERANDA, floor * 0.5, 'stone')
    for k in range(int(BAY_M / 0.3)):
        xx = x0 + 0.15 + k * 0.3
        kit.block(p, xx - 0.012, VERANDA, floor, xx + 0.012, ROOM[0], floor + 0.012, trim)
    faces = ('front', 'back') + tuple(s for s, end in (('left', left), ('right', right)) if end)
    e2.timber_walls(p, rect, floor, wall_top, r, faces)
    kit.folding_doors(p, rect, 'front', 0, floor, BAY_M - 0.6, 2.3 if not tall else 2.6, leaf=st['shutter'],
                      frame=trim, open_=0.5 + 0.1 * (i % 3))
    regions.house_door(p, rect, 'back', 0, floor, r, 0.9, 2.0)
    for side, end in (('left', left), ('right', right)):
        if end:
            regions.house_window(p, rect, side, -1.2 if side == 'left' else 1.2, floor + 0.9, r, 0.9, 1.1)
            if tall:
                regions.house_window(p, rect, side, 1.6 if side == 'left' else -1.6, floor + 0.9, r, 0.9, 1.1)
    if tall:
        # the loft's vents under the eave, front and back
        for side in ('front', 'back'):
            e2.gable_vent(p, rect, side, wall_top - 0.85, 1.6, frame=trim)
    # the long roof along the road and the veranda's lean-to
    span = ROOM[1] - ROOM[0]
    rise = span / 2 * (1.0 if not tall else 1.1) * (st['pitch'] / 0.95)
    top = fp.row_roof(p, rect, wall_top, rise, 'thatch', left, right, over=0.6, over_end=0.6, thick=0.32,
                      courses=6, course_mat='thatch_dark', fill=st['wood'], barge=trim)
    fp.end_gable_dress(p, rect, wall_top, rise, r, left, right, over=0.6, over_end=0.65)
    a0, a1 = x0 - (0.6 if left else 0.0), x1 + (0.6 if right else 0.0)
    ez = wall_top - 0.6 * rise / (span / 2)
    fp.fringe(p, a0, a1, ROOM[0] - 0.62, ez + 0.05, -1, seed=i)
    fp.fringe(p, a0, a1, ROOM[1] + 0.62, ez + 0.05, 1, seed=i + 3)
    lean = (a0, VERANDA - 0.3, a1, ROOM[0])
    z_hi, z_lo = ez - 0.1, floor + 2.25
    kit.shed_roof(p, lean, z_lo, z_hi, 'thatch', over=0.0, low_side='front', thick=0.26, courses=3,
                  course_mat='thatch_dark')
    posts = [x0 + 0.1] + ([x1 - 0.1] if right else [])
    for x in posts:
        kit.block(p, x - 0.08, VERANDA + 0.05, floor, x + 0.08, VERANDA + 0.21, z_lo + 0.1, trim)
        kit.block(p, x - 0.15, VERANDA + 0.0, floor - 0.02, x + 0.15, VERANDA + 0.26, floor + 0.06, 'stone')
    kit.block(p, a0, VERANDA + 0.06, z_lo - 0.08, a1, VERANDA + 0.2, z_lo + 0.06, trim)
    # the hand-painted sign is nailed to the lean-to's front edge, where the road and the camera above both see it
    # (hung under the beam, the eave hid it from above), lined up along the row
    props.sign_board(q, (x0, VERANDA - 0.3, x1, ROOM[0]), 'front', 0, z_lo - 0.3, BAY_M - 1.4, 0.42, SIGNS[i],
                     'teak_dark', out=0.02)
    goods(b, place, VERANDA - 0.2, tall)
    # behind the room
    yb = ROOM[1] + 0.9
    if place in ('one', 'mid2'):
        props.water_jar(q, -1.1, yb + 0.5, 0.9)
        props.woodpile(q, 0.8, yb + 1.6, 1.4, 2)
    elif place in ('left', 'right'):
        regions.plant(b, 0.6 if place == 'left' else -0.6, yb + 2.4, i, big=False)
        props.water_jar(q, -0.9 if place == 'left' else 0.9, yb + 0.6, 0.8)
    else:
        props.water_jar(q, 0.9, yb + 0.6, 1.0)
        regions.craft(b, -0.6, yb + 2.2) if r in ('central', 'west') else None
    return top


def house(b, big):
    """A house on posts on a 12 m plot: the rooms and an open deck with stairs (the twin house with its kitchen house
    on the bigger one, and a rice barn), the region's thatched roof, jars, a spirit house, the region's plants and a
    bamboo fence along the road."""
    r = b.region
    q = b.props
    b.ground(regions.ground_mat(r, b.era))
    if not big:
        info = houses.stilt_house(b, -1.6, 2.4, 5.6, 4.2, floor_z=2.3, wall_h=2.5, thatch=True, deck=('right', 2.6),
                                  posts_every=2.0)
        regions.under_house(b, -2.2, 2.0)
        props.buffalo(q, -3.4, -2.2, facing=20) if r in ('northeast', 'central', 'north') else \
            props.water_jar(q, -3.6, -1.8, 1.0)
        pw.rice_barn(b, 3.6, -3.6, 2.2, 1.9) if r == 'northeast' else props.haystack(q, 3.8, -4.0, 0.9, 1.7)
    else:
        info = houses.stilt_house(b, -3.0, 2.6, 4.6, 4.0, floor_z=2.4, wall_h=2.5, thatch=True, deck=('right', 2.8),
                                  stair_at=0.6, posts_every=2.0)
        kx0 = info['deck'][2]
        houses.stilt_house(b, kx0 + 1.45, 3.2, 2.8, 2.8, floor_z=2.05, wall_h=2.2, thatch=True, stairs=False,
                           deck=(), door_side='left', axis='x' if r != 'northeast' else 'y')
        pw.rice_barn(b, -3.6, -3.8, 2.4, 2.0)
        regions.under_house(b, -3.0, 2.2)
        props.water_jar(q, 2.4, -0.9, 1.0)
        props.water_jar(q, 3.4, -0.7, 0.8)
    x0, y0, x1, y1 = info['rect']
    props.spirit_house(q, 4.6, -6.2)
    props.water_jar(q, -5.0, 6.6, 0.9)
    regions.plant(b, -5.0, 6.4 if big else 0.0, 1)
    regions.plant(b, 4.8, 6.6, 2, big=False)
    regions.craft(b, 0.6, -5.8)
    e = 7.6
    gx = 1.2 if not big else 0.8
    fm = 'bamboo' if r != 'north' else 'teak'
    props.fence(q, [(-5.9, -e), (gx - 0.8, -e)], 1.1, fm, spacing=0.3)
    props.fence(q, [(gx + 0.8, -e), (5.9, -e)], 1.1, fm, spacing=0.3)
    for s in (-1, 1):
        q.box((0.16, 0.16, 1.6), 'teak_dark', T(gx + s * 0.8, -e, 0.8))
    b.path(gx - 0.6, -7.95, gx + 0.6, (info['deck'] or info['rect'])[1] - 1.2, path_mat(b), z=0.05)


@building('bay1_one', 1, 'ห้องแถวไม้ริมทางห้องเดียว', 'Single timber shop room')
def bay1_one(b):
    bay(b, False)


@building('bay1_left', 1, 'ห้องแถวไม้ริมทางห้องหัว (ซ้าย)', 'Timber shop room, left end of a row')
def bay1_left(b):
    bay(b, False)


@building('bay1_mid', 1, 'ห้องแถวไม้ริมทางห้องกลาง', 'Timber shop room, middle of a row')
def bay1_mid(b):
    bay(b, False)


@building('bay1_mid2', 1, 'ห้องแถวไม้ริมทางห้องกลาง (แบบ 2)', 'Timber shop room, middle of a row (2)')
def bay1_mid2(b):
    bay(b, False)


@building('bay1_right', 1, 'ห้องแถวไม้ริมทางห้องท้าย (ขวา)', 'Timber shop room, right end of a row')
def bay1_right(b):
    bay(b, False)


@building('bay2_one', 3, 'โรงค้าข้าวห้องเดียว', 'Single rice trader’s store')
def bay2_one(b):
    bay(b, True)


@building('bay2_left', 3, 'โรงค้าข้าวห้องหัว (ซ้าย)', 'Rice trader’s store, left end of a row')
def bay2_left(b):
    bay(b, True)


@building('bay2_mid', 3, 'โรงค้าข้าวห้องกลาง', 'Rice trader’s store, middle of a row')
def bay2_mid(b):
    bay(b, True)


@building('bay2_mid2', 3, 'โรงค้าข้าวห้องกลาง (แบบ 2)', 'Rice trader’s store, middle of a row (2)')
def bay2_mid2(b):
    bay(b, True)


@building('bay2_right', 3, 'โรงค้าข้าวห้องท้าย (ขวา)', 'Rice trader’s store, right end of a row')
def bay2_right(b):
    bay(b, True)


@building('house12_1', 1, 'เรือนไม้ใต้ถุนสูง หน้ากว้าง 12 ม.', 'House on stilts, 12 m plot')
def house12_1(b):
    house(b, False)


@building('house12_2', 3, 'เรือนแฝด หน้ากว้าง 12 ม.', 'Twin house with a shared deck, 12 m plot')
def house12_2(b):
    house(b, True)
