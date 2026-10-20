# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 2's frontage variants (PLAN.md "Frontage"): the market town's timber shophouse (ห้องแถวไม้) one bay wide, 4 m,
its own gable to the street as on the concept sheet, folding plank doors, an awning and a painted sign (no brands);
two storeys in the lower row, three in the taller; and a half-brick half-timber house on a 12 m plot. Built with
lib/era2_parts.shophouse as the era's own rows are; a bay has windows on a side only where it ends a terrace
(bay_ends), so a run of bays reads as one row. Dressed by region: Isan's plastered ground floor and zinc awning,
Lanna's balcony and กาแล, the south's stucco with its five-foot way. True sizes (PLAN.md)."""

from lib import era2_parts as e2
from lib import frontage_parts as fp
from lib import houses, kit, props, regions
from lib import props_region as pr
from lib import props_work as pw
from lib.builder import BAY_M, registry
from lib.mesh import T

BUILDINGS, building = registry(2)

FRONT = -6.0      # the shophouse's front wall: a 2 m walk in front of it to the plot's edge (-8)
DEPTH = 11.0      # ... its back wall at 5.0, a yard behind
INDEX = {'one': 0, 'left': 1, 'mid': 2, 'mid2': 3, 'right': 4}


def path_mat(b):
    return {'northeast': 'dirt_dark', 'south': 'paving', 'north': 'paving'}.get(b.region, 'gravel')


def bay(b, storeys):
    """One timber shophouse: its walk in front, the shophouse, end walls where it ends a terrace; a pole and its wire
    at a terrace's left end; jars, a water jar or a well behind."""
    r = b.region
    q = b.props
    place = fp.place_of(b)
    left, right = fp.ends_of(b)
    i = INDEX[place]
    x0 = -BAY_M / 2
    b.ground(regions.ground_mat(r, b.era))
    fp.sidewalk(b, FRONT, path_mat(b) if r != 'south' else 'paving', 'stone' if r != 'northeast' else 'laterite',
                z=0.06)
    sides = tuple(s for s, end in (('left', left), ('right', right)) if end)
    u = e2.shophouse(b, (x0, FRONT, x0 + BAY_M, FRONT + DEPTH), i, storeys, sides=sides, lamp=place in ('right', 'one'),
                     wares=place in ('one', 'left', 'mid2'))
    if left:
        tops = e2.pole(q, x0 + 0.35, -7.6, 8.2 if storeys == 2 else 9.0, 0)
        e2.service_drop(q, tops[-1][0], (x0 + 0.5, FRONT - 0.05, e2.GROUND + 0.9))
    if place == 'mid':
        e2.vendor_cart(q, 0.6, -7.3, facing=0, stripes=e2.awning_stripes(r) if r != 'northeast'
                       else ('awning_blue', 'awning_white'))
    # the yard behind
    yb = FRONT + DEPTH
    if r == 'west':
        pr.big_jars(q, -0.8, yb + 1.6, 2)
    elif place in ('one', 'mid2'):
        props.water_jar(q, -1.2, yb + 1.4, 0.95)
        props.water_jar(q, -0.2, yb + 1.6, 0.8)
    elif place == 'mid':
        regions.plant(b, 1.0, yb + 1.6, 2, big=False)
    else:
        props.water_tank(q, 1.0, yb + 1.5, 0.0, 'stainless', stand=0.0) if r == 'south' else \
            props.water_jar(q, 1.0, yb + 1.5, 1.0)
    return u


def house(b, big):
    """A half-brick half-timber house (เรือนครึ่งตึกครึ่งไม้) on a 12 m plot: the plastered ground floor and timber upper
    floor under the region's tiled roof, a porch (an upstairs veranda on the bigger one, and a kitchen house under
    zinc), jars, a spirit house, a picket fence on the road and the wire from a wooden pole."""
    r = b.region
    p = b.props
    b.ground(regions.ground_mat(r, b.era))
    if not big:
        info = e2.townhouse(b, (-4.6, -1.4, 2.4, 4.4), 0, axis='x', door_u=-1.4)
    else:
        info = e2.townhouse(b, (-5.2, -0.6, 2.4, 5.6), 1, axis='x', door_u=-1.4, porch=r == 'south',
                            veranda=r != 'south')
        k = (2.8, 1.6, 5.6, 5.8)
        kit.block(b.main, k[0], k[1], 0, k[2], k[3], 0.3, 'stone')
        regions.house_walls(b.main, k, 0.3, 2.8, r)
        e2.house_window(b.main, k, 'right', 0.0, 1.2, r, 0.8, 1.0)
        regions.house_door(b.main, k, 'front', 0.2, 0.3, r, 0.9, 2.1)
        kit.corrugated(b.main, k, 2.8, 3.5, 'zinc', 'zinc_dark', over=0.3, low_side='right')
        props.chimney(b.main, 4.8, 5.0, 1.1, 0.16, 0.13, 'concrete_dark', 'iron', z=3.3)
        if r != 'south':
            for k2 in range(2):
                p.box((1.6, 0.3, 0.15), 'stone', T(-1.2, -0.6 - 0.15 - k2 * 0.28, 0.3 - k2 * 0.15))
    x0, y0, x1, y1 = info['rect']
    if not big:
        houses.open_shed(b.main, (2.9, 2.2, 5.3, 4.6), 2.2, 'zinc', posts_mat='teak_dark', low_side='right', rise=0.4)
        pw.cloth_line(p, 3.0, -2.4, 5.4, -2.4, cloths=('cream', 'paint_blue', 'silk'))
    props.water_jar(p, 4.8, 6.6, 1.0)
    props.water_jar(p, 3.8, 6.8, 0.85)
    props.spirit_house(p, -4.9, -5.8)
    e = 7.6
    fm = {'north': 'teak', 'south': 'teak', 'west': 'bamboo'}.get(r, 'teak')
    props.fence(p, [(-5.9, -e), (-2.6, -e)], 1.1, fm, spacing=0.22)
    props.fence(p, [(-0.4, -e), (5.9, -e)], 1.1, fm, spacing=0.22)
    for x in (-2.6, -0.4):
        p.box((0.16, 0.16, 1.5), 'teak_dark', T(x, -e, 0.75))
    tops = e2.pole(p, 5.5, -7.3, 8.2, 0)
    e2.service_drop(p, tops[-1][0], (x1 - 0.2, y0 - 0.05, info['eave'] - 0.4))
    regions.plant(b, -5.0, 6.2, 1)
    regions.plant(b, 1.0, -5.4, 3, big=False)
    if r == 'northeast':
        pr.big_jars(p, -5.0, 2.0)
    else:
        regions.craft(b, 1.6, -6.4)
    b.path(-2.4, -7.95, -0.6, y0 - 1.8, path_mat(b), z=0.05)


@building('bay1_one', 1, 'ห้องแถวไม้คูหาเดียว', 'Single timber shophouse')
def bay1_one(b):
    bay(b, 2)


@building('bay1_left', 1, 'ห้องแถวไม้ห้องหัว (ซ้าย)', 'Timber shophouse, left end of a row')
def bay1_left(b):
    bay(b, 2)


@building('bay1_mid', 1, 'ห้องแถวไม้ห้องกลาง', 'Timber shophouse, middle of a row')
def bay1_mid(b):
    bay(b, 2)


@building('bay1_mid2', 1, 'ห้องแถวไม้ห้องกลาง (แบบ 2)', 'Timber shophouse, middle of a row (2)')
def bay1_mid2(b):
    bay(b, 2)


@building('bay1_right', 1, 'ห้องแถวไม้ห้องท้าย (ขวา)', 'Timber shophouse, right end of a row')
def bay1_right(b):
    bay(b, 2)


@building('bay2_one', 3, 'ห้องแถวไม้สามชั้นคูหาเดียว', 'Single three-storey timber shophouse')
def bay2_one(b):
    bay(b, 3)


@building('bay2_left', 3, 'ห้องแถวไม้สามชั้นห้องหัว (ซ้าย)', 'Three-storey timber shophouse, left end')
def bay2_left(b):
    bay(b, 3)


@building('bay2_mid', 3, 'ห้องแถวไม้สามชั้นห้องกลาง', 'Three-storey timber shophouse, middle')
def bay2_mid(b):
    bay(b, 3)


@building('bay2_mid2', 3, 'ห้องแถวไม้สามชั้นห้องกลาง (แบบ 2)', 'Three-storey timber shophouse, middle (2)')
def bay2_mid2(b):
    bay(b, 3)


@building('bay2_right', 3, 'ห้องแถวไม้สามชั้นห้องท้าย (ขวา)', 'Three-storey timber shophouse, right end')
def bay2_right(b):
    bay(b, 3)


@building('house12_1', 1, 'เรือนครึ่งตึกครึ่งไม้ หน้ากว้าง 12 ม.', 'Half-brick half-timber house, 12 m plot')
def house12_1(b):
    house(b, False)


@building('house12_2', 3, 'เรือนครึ่งตึกครึ่งไม้มีระเบียง หน้ากว้าง 12 ม.', 'House with an upstairs veranda, 12 m plot')
def house12_2(b):
    house(b, True)
