# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 3's frontage variants (PLAN.md "Frontage"): the factory town's concrete shophouse (ตึกแถว) one bay wide, 4 m,
with the region's front (a Thai gable, a กาแล, Isan's plain gable and zinc canopy, the south's Sino-Portuguese parapet
and arcade), and a concrete house on a 12 m plot. A plot is 16 m deep: the bay's sidewalk in front, the shophouse,
a back yard with its tank. Built with lib/era3_parts.shophouse as the era's own rows are; a bay shows windows on a
side only where it ends a terrace (bay_ends), so a run of bays reads as one terrace. True sizes (PLAN.md)."""

from lib import era3_parts as e3
from lib import frontage_parts as fp
from lib import kit, props, regions
from lib import props_region as pr
from lib.builder import BAY_M, bay_ends, registry
from lib.mesh import T

BUILDINGS, building = registry(3)

FRONT = -6.0      # the shophouse's front wall: a 2 m sidewalk in front of it to the plot's edge (-8)
DEPTH = 11.5      # ... and its back wall at 5.5, a 2.5 m yard behind
# Each place in a terrace gets its own ground floor and sign colour, so a long terrace is not one bay repeated
GROUND = {'one': 'shop', 'left': 'shop', 'mid': 'shutter', 'mid2': 'gate', 'right': 'store'}
SIGN = {'one': 'sign_cream', 'left': 'sign_cream', 'mid': 'sign_blue', 'mid2': 'sign_red', 'right': None}
INDEX = {'one': 0, 'left': 1, 'mid': 2, 'mid2': 3, 'right': 4}


def bay(b, floors):
    """One shophouse bay: the sidewalk, the shophouse from FRONT back DEPTH m, its end walls where it ends a
    terrace, and the street things of its trade in front; tanks and laundry in the back yard."""
    r = b.region
    q = b.props
    place = b.spec['kind'].split('_', 1)[1]
    left, right = bay_ends(b.spec['kind'])
    i = INDEX[place]
    x0 = -BAY_M / 2
    ground = GROUND[place]
    if ground == 'store' and r == 'south':
        ground = 'shop'
    yard = regions.ground_mat(r, b.era)
    b.ground(yard)
    kit.block(b.yard, x0, -8.0 + 0.05, 0, x0 + BAY_M, FRONT, 0.08, 'paving')
    kit.block(b.yard, x0, -8.0 + 0.05, 0, x0 + BAY_M, -7.75, 0.14, 'concrete_light')
    kit.block(b.yard, x0, FRONT + DEPTH, 0, x0 + BAY_M, 7.95, 0.07, 'concrete')
    sign = SIGN[place]
    if sign and r == 'northeast' and place == 'mid':
        sign = 'sign_red'
    unit = e3.shophouse(b, x0, FRONT, BAY_M, DEPTH, floors=floors, i=i, ground=ground, left_open=left,
                        right_open=right, open_=0.55 if ground == 'shutter' else 0.0, sign=sign, tank=False,
                        stairhead=floors >= 3 and place in ('mid2', 'one'))
    # the rooftop tank where the era's row has it, a light one (lib/frontage_parts.py)
    fp.light_tank(q, x0 + BAY_M - 1.0, FRONT + DEPTH - 1.1, unit['top'] + 0.25,
                  'plastic' if (i + (r == 'northeast')) % 2 else 'stainless', stand=0.9)
    # the trade on the sidewalk
    yy = FRONT - 1.1
    if place in ('one', 'left'):
        props.table_stall(q, -0.5, yy + 0.2, 1.8, 0.8, goods=('paint_orange', 'leaf', 'cream'))
        e3.chair(q, 1.4, yy, 200, 'paint_red')
    elif place == 'mid':
        e3.wheelie_bin(q, 1.4, yy + 0.3, 'paint_green')
        props.potted(q, -1.4, yy + 0.5, 0, 0.55, 'leafy', i)
    elif place == 'mid2':
        props.sacks(q, -1.0, yy + 0.4, 2)
        e3.cooler(q, 1.1, yy + 0.4)
    else:
        e3.vending(q, 1.2, yy + 0.4, 0, 'paint_blue' if r != 'northeast' else 'paint_red')
        e3.chair(q, -0.8, yy - 0.2, 170, 'paint_blue')
    if r == 'northeast' and place in ('mid2', 'one'):
        pr.rice_baskets(q, -1.0, FRONT + DEPTH + 1.2, 2)
    elif place in ('mid', 'right'):
        props.water_jar(q, -1.2, FRONT + DEPTH + 1.3, 0.85)
    else:
        e3.laundry(q, (x0 + 0.4, 7.2), (x0 + BAY_M - 0.4, 7.2), 1.8)
        for x in (x0 + 0.4, x0 + BAY_M - 0.4):
            q.box((0.05, 0.05, 1.85), 'steel', T(x, 7.2, 0.92))


def house(b, floors):
    """A concrete house on a 12 m plot: the house beside a car porch, a walled yard with a sliding gate, a tank on
    its stand, a spirit house and pots; in Isan a zinc lean-to kitchen at the back."""
    r = b.region
    q = b.props
    b.ground(regions.ground_mat(r, b.era))
    w, d = (6.6, 6.2) if floors == 1 else (6.8, 7.0)
    h = e3.concrete_house(b, -2.2, 0.6 if floors == 1 else 1.0, w, d, floors=floors, i=floors - 1,
                          door_u=1.4, axis='x')
    x0, y0, x1, y1 = h['rect']
    e3.car_porch(b, (1.6, -4.6, 5.2, y0 + 3.0), 2.7 if floors == 1 else 2.8,
                 'zinc' if r == 'northeast' else 'slab', posts='steel' if floors == 1 else 'concrete')
    e3.lot_wall(b, 7.6, gates=((3.4, 3.2), (-0.8, 1.0)), h=1.5, front_h=0.8, ex=5.85)
    b.path(-1.3, -7.6, -0.3, y0 - 0.9, 'paving', z=0.07)
    if r != 'northeast':
        kit.block(b.yard, -5.6, -7.3, 0, -1.6, y0 - 0.6, 0.06, 'grass')
    else:
        kit.corrugated(b.main, (x0 + 0.2, y1, x0 + 3.4, 7.3), 2.2, 2.8, 'zinc', 'zinc_dark', 0.15, 'back')
        for x in (x0 + 0.3, x0 + 3.3):
            kit.block(b.main, x - 0.05, 7.15, 0, x + 0.05, 7.25, 2.2, 'teak_dark')
        pr.big_jars(q, x0 + 0.9, y1 + 0.9, 2)
    props.spirit_house(q, -4.9, -6.6)
    e3.potted_row(q, -5.0, -3.6, 3, 0.9, 0.5, floors)
    fp.light_tank(q, 4.6, 6.4, 0, 'plastic' if floors == 1 else 'stainless', stand=1.6)
    e3.wheelie_bin(q, 5.0, -6.8)
    if floors > 1:
        e3.ac_on(q, h['rect'], 'back', 1.2, 3.9)
        fp.light_tank(q, 3.4, 6.4, 0, 'plastic', stand=1.6)
    if r != 'northeast':
        e3.laundry(q, (1.4, 6.6), (2.8, 6.6), 1.8) if floors > 1 else e3.laundry(q, (1.6, 6.6), (3.6, 6.6), 1.8)
    regions.plant(b, -5.2, 6.6, floors)
    regions.craft(b, 2.6, y1 + 1.0) if r != 'northeast' else None


@building('bay1_one', 1, 'ตึกแถวคูหาเดียว', 'Single shophouse')
def bay1_one(b):
    bay(b, 2)


@building('bay1_left', 1, 'ตึกแถวห้องหัว (ซ้าย)', 'Shophouse, left end of a row')
def bay1_left(b):
    bay(b, 2)


@building('bay1_mid', 1, 'ตึกแถวห้องกลาง', 'Shophouse, middle of a row')
def bay1_mid(b):
    bay(b, 2)


@building('bay1_mid2', 1, 'ตึกแถวห้องกลาง (แบบ 2)', 'Shophouse, middle of a row (2)')
def bay1_mid2(b):
    bay(b, 2)


@building('bay1_right', 1, 'ตึกแถวห้องท้าย (ขวา)', 'Shophouse, right end of a row')
def bay1_right(b):
    bay(b, 2)


@building('bay2_one', 3, 'ตึกแถวสามชั้นคูหาเดียว', 'Single three-storey shophouse')
def bay2_one(b):
    bay(b, 3)


@building('bay2_left', 3, 'ตึกแถวสามชั้นห้องหัว (ซ้าย)', 'Three-storey shophouse, left end')
def bay2_left(b):
    bay(b, 3)


@building('bay2_mid', 3, 'ตึกแถวสามชั้นห้องกลาง', 'Three-storey shophouse, middle')
def bay2_mid(b):
    bay(b, 3)


@building('bay2_mid2', 3, 'ตึกแถวสามชั้นห้องกลาง (แบบ 2)', 'Three-storey shophouse, middle (2)')
def bay2_mid2(b):
    bay(b, 3)


@building('bay2_right', 3, 'ตึกแถวสามชั้นห้องท้าย (ขวา)', 'Three-storey shophouse, right end')
def bay2_right(b):
    bay(b, 3)


@building('house12_1', 1, 'บ้านปูนชั้นเดียว หน้ากว้าง 12 ม.', 'Concrete house, 12 m plot')
def house12_1(b):
    house(b, 1)


@building('house12_2', 2, 'บ้านปูนสองชั้น หน้ากว้าง 12 ม.', 'Two-storey concrete house, 12 m plot')
def house12_2(b):
    house(b, 2)
