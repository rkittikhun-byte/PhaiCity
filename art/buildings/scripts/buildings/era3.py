# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 3, the factory town (assets/concept/era3_A_house.jpg, era3_B_town.jpg): concrete shophouses of three and four
storeys with a Thai gable on the front, rooftop water tanks, AC units, roller shutters and folding steel gates,
concrete power poles with tangled wires, a convenience store with a rainbow awning (no brand), warehouses and
factories with ribbed roofs and chimneys, the concrete drainage canal. Dressed by region (lib/regions.py,
lib/era3_parts.py): Isan plain gables, zinc lean-tos and laterite; Sino-Portuguese fronts and arcades in the south;
a กาแล and teak in the north; Thai gable ends in central, east and west. True sizes (PLAN.md)."""

import math

from lib import era3_parts as e3
from lib import houses, kit, props, regions
from lib import props_region as pr
from lib.builder import registry
from lib.mesh import R, S, T

BUILDINGS, building = registry(3)


def yard(b):
    b.ground(regions.ground_mat(b.region, b.era))


def pave(b, x0, y0, x1, y1, z=0.08):
    """A paved forecourt or sidewalk; in Isan the laterite stays at its edges."""
    if b.region == 'northeast':
        x0, x1 = x0 + 0.4, x1 - 0.4
    b.path(x0, y0, x1, y1, 'paving', z=z)
    kit.block(b.yard, x0, y0, 0, x1, y0 + 0.25, z + 0.06, 'concrete_light')


def street_poles(b, y=-7.1, x0=-7.0, x1=7.0, h=9.0, transformer=1, drops=()):
    """Concrete poles at the lot's front corners with a tangle of wires between them, and service drops to walls."""
    q = b.props
    e3.pole(q, x0, y, h, transformer=transformer == 0, lamp=transformer != 0)
    e3.pole(q, x1, y, h, transformer=transformer == 1, lamp=transformer == 0)
    e3.tangle(q, (x0, y, h - 0.45), (x1, y, h - 0.45), 4, 0.5)
    for k, pt in enumerate(drops):
        e3.service_drop(q, ((x0, x1)[k % 2], y, h - 1.2), pt)


def roof_of(b, i=0):
    return e3.roof_mat(b.region, i)


# homes ---------------------------------------------------------------------------------------------------------------

@building('home_1', 1, 'บ้านปูนชั้นเดียว', 'Small concrete house')
def home_1(b):
    """A one-storey concrete house on a plinth with grille windows and the region's tiled roof, a car porch, a low
    wall with a sliding gate, a tank on a stand, a spirit house and pots; in Isan a zinc lean-to kitchen."""
    yard(b)
    r = b.region
    q = b.props
    h = e3.concrete_house(b, -2.2, 1.4, 6.8, 5.6, floors=1, i=0, door_u=1.6, axis='x')
    x0, y0, x1, y1 = h['rect']
    e3.car_porch(b, (2.0, -3.4, 5.6, 2.6), 2.7, 'zinc' if r == 'northeast' else 'slab')
    e3.lot_wall(b, 7.3, gates=((3.8, 3.2), (-0.6, 1.0)), h=1.5, front_h=0.8)
    b.path(-1.1, -7.3, -0.1, y0 - 0.9, 'paving', z=0.07)
    if r != 'northeast':
        kit.block(b.yard, -6.9, -6.9, 0, -1.4, y0 - 0.6, 0.06, 'grass')
    else:
        kit.corrugated(b.main, (x0 + 0.2, y1, x0 + 3.6, 6.9), 2.2, 2.8, 'zinc', 'zinc_dark', 0.15, 'back')
        for x in (x0 + 0.3, x0 + 3.5):
            kit.block(b.main, x - 0.05, 6.75, 0, x + 0.05, 6.85, 2.2, 'teak_dark')
        pr.big_jars(q, x0 + 0.8, 5.6, 2)
    props.spirit_house(q, -6.1, -5.6)
    e3.potted_row(q, -5.8, -6.6, 4, 1.0, 0.5, 1)
    props.water_tank(q, 5.8, 5.6, 0, 'plastic', stand=1.6)
    props.water_jar(q, x1 + 0.5, 3.6, 0.9)
    e3.wheelie_bin(q, 6.4, -6.3)
    e3.laundry(q, (1.6, 6.2), (5.0, 6.2), 1.9)
    for x in (1.6, 5.0):
        q.box((0.06, 0.06, 1.95), 'steel', T(x, 6.2, 0.97))
    e3.ac_on(q, h['rect'], 'back', 1.0, 1.0)
    regions.plant(b, -6.3, 6.3, 0)
    regions.plant(b, -6.4, -3.2, 2, big=False)
    regions.craft(b, 2.6, 4.8)
    street_poles(b, drops=((x1, y0 + 0.3, 3.2),))


@building('home_2', 2, 'บ้านปูนสองชั้น', 'Two-storey concrete house')
def home_2(b):
    """A two-storey concrete house with a balcony over the door, grille windows and sunshades, AC units, a car porch
    beside it, the walled yard with its gate, tank stand, spirit house and plants."""
    yard(b)
    r = b.region
    q = b.props
    h = e3.concrete_house(b, -2.0, 1.8, 7.6, 6.4, floors=2, i=1, door_u=1.5, axis='x')
    x0, y0, x1, y1 = h['rect']
    e3.car_porch(b, (2.4, -3.6, 6.4, 2.8), 2.8, 'zinc' if r == 'northeast' else 'slab', posts='concrete')
    e3.lot_wall(b, 7.3, gates=((4.4, 3.6), (-0.5, 1.0)), h=1.6, front_h=0.8)
    b.path(-1.0, -7.3, 0.0, y0 - 0.9, 'paving', z=0.07)
    kit.block(b.yard, -6.9, -6.9, 0, -1.5, y0 - 0.6, 0.06, 'grass' if r != 'northeast' else 'grass_dark')
    e3.ac_on(q, h['rect'], 'back', -1.0, 3.9)
    e3.ac_on(q, h['rect'], 'left', 1.0, 1.0)
    props.spirit_house(q, -6.1, -5.6)
    props.water_tank(q, 5.8, 5.8, 0, 'stainless', stand=1.8)
    props.water_tank(q, 4.5, 5.8, 0, 'plastic', stand=1.8)
    e3.potted_row(q, -5.6, -3.0, 4, 1.1, 0.55, 0)
    e3.wheelie_bin(q, 6.5, -6.2)
    if r == 'northeast':
        kit.corrugated(b.main, (x0 + 0.5, y1, x0 + 4.0, 6.9), 2.2, 2.8, 'zinc', 'zinc_dark', 0.15, 'back')
        pr.big_jars(q, x0 + 1.0, 6.0, 3)
    else:
        e3.laundry(q, (x0 + 0.5, 6.6), (x0 + 4.0, 6.6), 1.9)
    regions.plant(b, -6.3, 6.3, 1)
    regions.plant(b, -6.4, -4.4, 2, big=False)
    regions.craft(b, 2.2, -5.6)
    street_poles(b, drops=((x1, y0 + 0.3, 5.6),))


@building('home_3', 3, 'ทาวน์เฮาส์', 'Townhouse row')
def home_3(b):
    """A row of three two-storey townhouses, each with a Thai gable front (the region's), a balcony, a little paved
    yard behind its own gate, AC units and a tank on its roof."""
    yard(b)
    r = b.region
    q = b.props
    w = 4.6
    xs = [-6.9 + k * w for k in range(3)]
    units = []
    for k, x in enumerate(xs):
        units.append(e3.shophouse(b, x, -2.6, w, 8.8, floors=2, i=k, ground='home', ground_h=3.2, storey=3.0,
                                  left_open=k == 0, right_open=k == 2, balcony=True))
    pave(b, -7.3, -7.3, 7.3, -2.6, 0.07)
    e3.lot_wall(b, 7.3, gates=tuple((x + w / 2 + 1.0, 2.4) for x in xs), h=1.5, front_h=0.8,
                sides=('back',))
    for x in xs[1:]:
        props.fence(q, [(x, -7.3), (x, -2.6)], 1.0, regions.plaster(r, 1), kind='wall', post_mat='concrete_light')
    for k, x in enumerate(xs):
        e3.potted_row(q, x + 0.5, -3.3, 2, 0.8, 0.5, k)
        e3.wheelie_bin(q, x + 0.5, -6.6, ('paint_blue', 'paint_green', 'paint_blue')[k])
        if k != 1:
            props.water_jar(q, x + 1.6, -3.4, 0.8)
    props.spirit_house(q, xs[0] + 1.6, -6.4)
    e3.laundry(q, (-6.8, 6.8), (6.8, 6.8), 1.8)
    if r == 'northeast':
        pr.rice_baskets(q, 1.0, -6.4)
    street_poles(b, transformer=1, drops=(units[0]['wire'],))


@building('home_4', 4, 'แฟลตสี่ชั้น', 'Walk-up flats')
def home_4(b):
    """Four-storey walk-up flats: an open gallery on every floor behind a breeze-block parapet, rooms with doors and
    grille windows, laundry on the rails, a stair tower in the middle with the region's little roof, a motorbike
    shelter and bins in front."""
    yard(b)
    r = b.region
    q = b.props
    e3.flats(b, -6.6, -3.0, 6.6, 6.8, floors=4, storey=3.0, i=0, gallery=1.5, rooms=4, tanks=4)
    pave(b, -7.3, -7.3, 7.3, -3.0, 0.07)
    e3.scooter_shed(b.main, (3.4, -6.6, 7.0, -4.6), 2.3)
    for k in range(3):
        e3.wheelie_bin(q, -6.6 + k * 0.75, -6.4, ('paint_green', 'paint_blue', 'paint_yellow')[k])
    e3.potted_row(q, -3.4, -3.6, 3, 1.0, 0.55, 2)
    e3.lot_wall(b, 7.3, gates=((0.0, 4.0),), h=1.5, front_h=0.8, sides=('back',))
    e3.table_set(q, -2.6, -5.6, 3)
    regions.plant(b, -6.6, -4.4, 2, big=False)
    street_poles(b, transformer=0)
    if r == 'northeast':
        pr.big_jars(q, 5.0, -3.6, 2)


@building('home_5', 5, 'อพาร์ตเมนต์', 'Apartment block')
def home_5(b):
    """A six-storey apartment block on a joined lot: galleries and rooms, two banks of tanks on the roof, the stair
    tower, a car park with bays, a motorbike shelter, a guard booth at the gate, a sala for the residents, trees,
    and the concrete drain behind."""
    yard(b)
    r = b.region
    q = b.props
    e3.flats(b, -13.0, 0.5, 13.0, 12.5, floors=6, storey=3.0, i=1, gallery=1.6, rooms=8, tanks=8)
    pave(b, -15.4, -15.4, 15.4, 0.5, 0.07)
    e3.parking_lines(b, -2.0, -12.5, 13.0, -7.5, 6)
    e3.parking_lines(b, -2.0, -12.5, 13.0, -12.5, 1, axis='y')
    e3.scooter_shed(b.main, (-13.0, -3.5, -4.0, -1.2), 2.3)
    e3.guard_booth(b.main, 13.0, -13.6)
    e3.barrier(q, 9.0, -14.5, 3.5)
    e3.lot_wall(b, 15.3, gates=((8.5, 6.0),), h=1.8, front_h=0.9)
    e3.drain(b, -15.4, 13.4, 15.4, 15.3, crossings=(0.0,))
    houses.pavilion(b.main, (-14.0, -12.5, -8.5, -7.5), 0.3, 2.6, r, roof_of(b), wood='concrete_light',
                    trim=e3.band_mat(r), floor_mat='paving_dark')
    for k in range(2):
        props.bench(q, -11.2, -11.2 + k * 2.4, 2.4)
    for k, (x, y) in enumerate(((-14.2, -14.2), (-5.5, -14.2), (-14.5, -5.5))):
        regions.plant(b, x, y, k)
    for x in (-3.0, 3.0, 9.0):
        props.street_lamp(q, x, -6.2, 5.5, 180)
    for k in range(4):
        e3.wheelie_bin(q, 9.5 + k * 0.75, -1.2, ('paint_green', 'paint_blue', 'paint_yellow', 'paint_blue')[k])
    e3.food_cart(q, -4.0, -13.6, 0, regions.awning_colours(r)[0])
    e3.table_set(q, -6.5, -10.5, 4, umbrella=True)
    street_poles(b, y=-15.0, x0=-15.0, x1=15.0, h=9.5, drops=((-13.0, 0.4, 4.0),))
    if r == 'northeast':
        pr.big_jars(q, -12.0, 13.0 - 1.4, 2)


# shops ---------------------------------------------------------------------------------------------------------------

@building('shop_1', 1, 'ร้านโชห่วย', 'Corner grocery')
def shop_1(b):
    """A one-storey grocery (โชห่วย) open to the street behind a folded steel gate: shelves of goods, a sign, an
    awning (zinc in Isan), a drinks fridge, an ice chest, gas cylinders, a vending machine and plastic tables; the
    family's concrete house behind and the pole with its transformer at the corner."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    rect = (-6.6, -3.2, 0.6, 2.8)
    x0, y0, x1, y1 = rect
    wall = regions.plaster(r, 2)
    kit.block(p, x0, y0, 0, x1, y1, 3.8, wall)
    kit.bands(p, rect, 0, 0.4, 0.025, 'e3_skirt')
    kit.bands(p, rect, 3.6, 0.2, 0.05, e3.band_mat(r))
    e3.shop_interior(p, rect, 'front', -0.3, 0, 5.6, 3.0)
    e3.steel_gate(p, rect, 'front', -0.3, 0, 5.6, 3.0, 0.88)
    e3.grille_window(p, rect, 'left', 0, 1.0, 1.4, 1.3)
    kit.door(p, rect, 'right', -1.0, 0, 0.9, 2.1, leaf='teak', frame='teak_dark')
    if r == 'south':
        regions.house_roof(p, rect, 3.8, r, mat=roof_of(b), axis='x', over=0.6, over_ends=0.5, fill=wall, pitch=0.5)
    else:
        regions.house_roof(p, rect, 3.8, r, mat=roof_of(b), axis='x', over=0.6, over_ends=0.5, fill=wall,
                           pitch=regions.style(r)['pitch'] * 0.7)
    if r == 'northeast':
        kit.corrugated(p, (x0, y0 - 2.6, x1, y0), 2.4, 3.1, 'zinc', 'zinc_dark', 0.15, 'front')
        for x in (x0 + 0.2, x1 - 0.2):
            kit.block(p, x - 0.05, y0 - 2.6, 0, x + 0.05, y0 - 2.5, 2.4, 'steel')
    else:
        props.awning(q, rect, 'front', -0.3, 3.15, 6.4, depth=1.8, drop=0.6, stripes=regions.awning_colours(r))
    props.sign_board(q, rect, 'front', -0.3, 3.35, 4.6, 0.6, 'sign_cream' if r != 'south' else 'sign_blue',
                     'sign_text', out=0.15)
    pave(b, -7.4, -7.4, 1.4, y0, 0.07)
    e3.cooler(q, x1 + 0.5, y0 - 0.6)
    e3.vending(q, x0 + 0.6, y0 - 3.4 if r == 'northeast' else y0 - 2.6, 0, 'paint_blue')
    q.box((0.9, 0.55, 0.6), 'paint_blue', T(-2.8, y0 - 0.6, 0.3), bevel=0.03)
    q.box((0.95, 0.6, 0.06), 'paint_white', T(-2.8, y0 - 0.6, 0.62))
    e3.gas_tanks(q, -4.8, y0 - 0.5, 3)
    props.sacks(q, -1.2, y0 - 0.8, 3)
    e3.table_set(q, -1.5, -6.0, 4, chair_mat='paint_blue')
    e3.table_set(q, -5.0, -6.2, 3)
    h = e3.concrete_house(b, 4.2, 3.8, 5.0, 4.6, floors=1, i=1, door_u=-1.2, axis='x', ac=False)
    e3.ac_on(q, h['rect'], 'front', 1.3, 1.2)
    props.water_tank(q, 6.3, -0.4, 0, 'plastic', stand=1.6)
    props.spirit_house(q, 3.0, -4.6)
    e3.potted_row(q, 2.4, -6.6, 4, 1.1, 0.5, 2)
    regions.plant(b, 6.4, -6.0, 2, big=False)
    regions.plant(b, -6.5, 6.3, 0)
    regions.craft(b, -3.0, 4.8)
    street_poles(b, drops=((x0 + 0.5, y0, 3.4),))


@building('shop_2', 2, 'ตึกแถวสองห้อง', 'Pair of shophouses')
def shop_2(b):
    """Two two-storey shophouses: one shop open behind its folded gate with goods spilling onto the sidewalk, one
    half shut behind its steel gate; signs, the region's gables, tanks, AC units, and a food cart in the side yard."""
    yard(b)
    r = b.region
    q = b.props
    units = [e3.shophouse(b, -4.6, -4.0, 4.6, 10.6, floors=2, i=0, ground='shop', left_open=True, sign='sign_cream'),
             e3.shophouse(b, 0.0, -4.0, 4.6, 10.6, floors=2, i=1, ground='gate', right_open=True,
                          sign='sign_blue' if r != 'northeast' else 'sign_red')]
    pave(b, -7.4, -7.4, 7.4, -4.0, 0.08)
    props.table_stall(q, -2.4, -5.0 if r != 'northeast' else -5.4, 2.4, 0.9, goods=('paint_red', 'leaf', 'cream'))
    props.sacks(q, -4.2, -5.0, 3)
    e3.cooler(q, 4.0, -4.6)
    e3.food_cart(q, 6.1, -2.0, 90, regions.awning_colours(r)[0])
    e3.table_set(q, 6.0, 1.5, 3)
    e3.table_set(q, 6.0, 4.3, 3, chair_mat='paint_blue')
    e3.gas_tanks(q, -7.1, -2.0, 2)
    e3.wheelie_bin(q, -6.8, 0.2)
    props.water_tank(q, -6.5, 5.5, 0, 'plastic', stand=1.4)
    regions.plant(b, -6.6, 2.6, 2, big=False)
    regions.plant(b, 6.6, 6.6, 0)
    street_poles(b, drops=(units[0]['wire'], units[1]['wire']))


@building('shop_3', 3, 'ตึกแถวสามชั้นกับร้านสะดวกซื้อ', 'Shophouse row with a convenience store')
def shop_3(b):
    """The concept's street: three three-storey shophouses with the region's gable fronts, a convenience store on
    the corner (glass, a blank light box and a rainbow awning, no brand), vending machines and plastic stools on
    the sidewalk, the poles' tangle of wires and their transformer."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    y0 = -3.4
    d = 10.6
    store = e3.shophouse(b, -6.6, y0, 4.4, d, floors=3, i=0, ground='store', left_open=True, side_ground=False)
    e3.store_front(p, q, store['rect'], 'left', d / 2 - 2.0, 0, 3.2, 2.9, awning=True)
    mid = e3.shophouse(b, -2.2, y0, 4.4, d, floors=3, i=1, ground='shop', sign='sign_cream')
    e3.shophouse(b, 2.2, y0, 4.4, d, floors=3, i=2, ground='shutter', right_open=True, open_=0.45,
                 sign='sign_blue' if r != 'northeast' else 'sign_red', stairhead=True)
    pave(b, -7.4, -7.4, 7.4, y0, 0.08)
    b.path(-7.4, y0, -6.6, 7.4, 'paving', z=0.08)
    e3.vending(q, -1.2, y0 - 0.55, 0, 'paint_red')
    e3.vending(q, -0.1, y0 - 0.55, 0, 'paint_blue')
    for k in range(3):
        e3.chair(q, -5.6 + k * 0.6, -6.3, 180 + k * 15, ('paint_red', 'paint_blue', 'paint_red')[k])
    props.table_stall(q, 1.6, -4.6 if r != 'northeast' else -5.0, 2.0, 0.8, goods=('paint_orange', 'leaf', 'cream'))
    e3.wheelie_bin(q, -6.9, -6.6, 'paint_green')
    e3.wheelie_bin(q, 7.0, -3.2)
    props.potted(q, 6.9, -4.6, 0, 0.6, 'leafy', 4)
    pr.bamboo_clump(q, 6.9, 6.8, 5.0, n=5, seed=3)
    street_poles(b, transformer=1, drops=(store['wire'], mid['wire']))
    if r == 'northeast':
        pr.rice_baskets(q, 4.2, -6.4)


@building('shop_4', 4, 'อาคารพาณิชย์สี่ชั้น', 'Four-storey commercial building')
def shop_4(b):
    """A four-storey commercial block: a glass shop floor under a deep canopy and a blank sign band, ribbons of
    windows between concrete fins, a blade sign at the corner, AC units up the side, the region's gable (or a
    Sino-Portuguese parapet) over the middle, a blank billboard frame, tanks and a stair head on the roof."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    wall = regions.plaster(r, 1)
    band = e3.band_mat(r)
    rect = (-6.6, -4.2, 6.6, 6.4)
    x0, y0, x1, y1 = rect
    gh, st, floors = 4.4, 3.4, 4
    top = gh + st * (floors - 1)
    kit.block(p, x0, y0, 0, x1, y1, top, wall)
    kit.bands(p, rect, 0, 0.4, 0.025, 'e3_skirt')
    for k, u in enumerate((-4.2, 0.0, 4.2)):
        kit.shopfront(p, rect, 'front', u, 0, 3.8, 3.2, frame='steel', glass='glass' if k != 1 else 'e3_store_glass',
                      door_w=1.6 if k == 1 else 0.01)
    for u in (-6.3, -2.1, 2.1, 6.3):
        kit.on_face(p, rect, 'front', u, 0, 0.4, gh, 0.1, band)
    kit.block(p, x0 - 0.1, y0 - 1.6, 3.4, x1 + 0.1, y0, 3.6, 'concrete_light')
    kit.block(p, x0 - 0.1, y0 - 1.65, 3.3, x1 + 0.1, y0 - 1.5, 3.7, band)
    props.sign_board(q, rect, 'front', 0, 3.75, 10.0, 0.55, 'sign_blue' if r != 'south' else 'sign_green',
                     'e3_sign_white', text_lines=1, out=0.05)
    for f in range(1, floors):
        z = gh + st * (f - 1)
        kit.block(p, x0 - 0.05, y0 - 0.2, z - 0.15, x1 + 0.05, y1 + 0.05, z + 0.12, band)
        if r == 'south':
            for u in kit.spread(13.2, 5, 0.6):
                regions.house_window(p, rect, 'front', u, z + 0.55, 'south', 1.0, 1.75)
                e3.arch(p, rect, 'front', u, z + 2.62, 1.15, band, depth=0.12, tube=0.06)
        else:
            kit.on_face(p, rect, 'front', 0, z + 0.85, 12.4, 1.5, 0.06, 'glass_dark')
            kit.on_face(p, rect, 'front', 0, z + 0.8, 12.6, 0.08, 0.14, 'concrete_light')
            for k in range(11):
                kit.on_face(p, rect, 'front', -6.0 + k * 1.2, z + 0.3, 0.14, st - 0.5, 0.45, 'concrete_light')
        for u in kit.spread(10.6, 3, 1.0):
            e3.grille_window(p, rect, 'left', u, z + 0.9, 1.2, 1.3)
        e3.ac_on(q, rect, 'left', -3.4 if f % 2 else 3.5, z + 0.25)
        e3.ac_on(q, rect, 'back', -2.0 + f * 1.2, z + 0.3, duct=False)
    pz = e3.flat_roof(p, rect, top, 'concrete', parapet=0.9, parapet_mat=wall, coping=band)
    if r == 'south':
        e3.sino_parapet(p, -3.5, 3.5, y0, top + 0.25, wall, band)
    else:
        e3.front_gable(p, r, -3.2, 3.2, y0, pz - 0.05, depth=3.0, wall=wall)
    q.box((0.12, 0.6, 3.6), 'sign_red', T(x0 - 0.5, y0 + 0.4, 6.6))
    for k in range(4):
        q.box((0.16, 0.36, 0.5), 'e3_sign_white', T(x0 - 0.5, y0 + 0.4, 5.3 + k * 0.85))
    q.rod((x0, y0 + 0.4, 8.2), (x0 - 0.5, y0 + 0.4, 8.2), 0.04, 'iron', seg=4)
    q.rod((x0, y0 + 0.4, 5.0), (x0 - 0.5, y0 + 0.4, 5.0), 0.04, 'iron', seg=4)
    bz = top + 0.25
    for x in (-1.0, 4.0):
        q.box((0.15, 0.15, 3.5), 'iron', T(x, y1 - 1.2, bz + 1.75))
        q.rod((x, y1 - 1.2, bz + 2.0), (x, y1 - 2.6, bz), 0.05, 'iron', seg=4)
    q.box((6.0, 0.2, 2.6), 'e3_sign_white', T(1.5, y1 - 1.3, bz + 3.6))
    q.box((6.2, 0.15, 0.12), 'iron', T(1.5, y1 - 1.3, bz + 2.25))
    e3.stair_head(p, x0 + 0.6, y1 - 3.4, x0 + 3.0, y1 - 0.4, bz, wall, roof=roof_of(b) if r != 'south' else None,
                  region=r)
    for k in range(3):
        props.water_tank(q, x1 - 0.9 - k * 1.25, 1.0, bz, 'stainless' if k % 2 else 'plastic', stand=0.9)
    for k in range(3):
        props.ac_unit(q, -4.5 + k * 1.1, 1.0, bz + 0.3, 0)
    pave(b, -7.4, -7.4, 7.4, y0, 0.08)
    e3.potted_row(q, -5.6, -6.6, 3, 1.2, 0.6, 1)
    e3.potted_row(q, 3.2, -6.6, 3, 1.2, 0.6, 2)
    e3.wheelie_bin(q, 7.0, -5.0)
    props.street_lamp(q, 0.0, -6.9, 6.0, 0)
    street_poles(b, transformer=0, drops=((x0 + 0.5, y0, 4.6),))


@building('shop_5', 5, 'ห้างสรรพสินค้า', 'Small department store')
def shop_5(b):
    """A three-storey department store on a joined lot: a glass entrance under a canopy, ribbons of windows between
    tiled bands, a big blank light box, the region's gable (or Sino-Portuguese parapet) over the entrance, AC
    condensers, tanks and stair heads on the roof; a car park with bays, motorbike shelters, food carts and trees."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    wall = regions.plaster(r, 1)
    band = e3.band_mat(r)
    rect = (-14.5, -3.0, 14.5, 13.0)
    x0, y0, x1, y1 = rect
    gh, st, floors = 4.6, 4.0, 3
    top = gh + st * (floors - 1)
    kit.block(p, x0, y0, 0, x1, y1, top, wall)
    kit.bands(p, rect, 0, 0.45, 0.025, 'e3_skirt')
    for u in (-10.0, 10.0):
        kit.shopfront(p, rect, 'front', u, 0, 8.0, 3.4, frame='steel', glass='glass', door_w=0.01)
    e3.store_front(p, q, rect, 'front', 0, 0, 10.0, 3.4, awning=False)
    for u in (-14.2, -5.5, 5.5, 14.2):
        kit.on_face(p, rect, 'front', u, 0, 0.6, top, 0.12, band)
    kit.block(p, -5.5, y0 - 3.5, 3.9, 5.5, y0, 4.15, 'concrete_light')
    kit.block(p, -5.55, y0 - 3.55, 3.8, 5.55, y0 - 3.4, 4.25, band)
    for x in (-5.0, 5.0):
        kit.block(p, x - 0.12, y0 - 3.3, 0, x + 0.12, y0 - 3.06, 3.9, 'steel')
    for f in range(1, floors):
        z = gh + st * (f - 1)
        kit.block(p, x0 - 0.05, y0 - 0.25, z - 0.15, x1 + 0.05, y1 + 0.05, z + 0.15, band)
        for u in (-10.0, 10.0):
            if r == 'south':
                for uu in kit.spread(8.0, 4, 0.4):
                    regions.house_window(p, rect, 'front', u + uu, z + 0.6, 'south', 1.0, 1.9)
                    e3.arch(p, rect, 'front', u + uu, z + 2.82, 1.15, band, depth=0.12, tube=0.06)
            else:
                kit.on_face(p, rect, 'front', u, z + 1.0, 8.0, 1.6, 0.06, 'glass_dark')
                kit.on_face(p, rect, 'front', u, z + 0.95, 8.2, 0.08, 0.14, 'concrete_light')
                for k in range(9):
                    kit.on_face(p, rect, 'front', u - 4.0 + k * 1.0, z + 1.0, 0.06, 1.6, 0.09, 'steel')
                kit.on_face(p, rect, 'front', u, z + 2.9, 8.0, 0.5, 0.05, 'e3_tile')
        for u in kit.spread(16.0, 4, 1.5):
            e3.grille_window(p, rect, 'left', u, z + 1.0, 1.4, 1.5, grille=None)
        e3.ac_on(q, rect, 'left', -5.5, z + 0.3)
        e3.ac_on(q, rect, 'left', 5.5, z + 0.3)
    kit.on_face(p, rect, 'front', 0, gh + 0.4, 9.6, 6.8, 0.05, 'glass_dark')
    for k in range(7):
        kit.on_face(p, rect, 'front', -4.8 + k * 1.6, gh + 0.4, 0.08, 6.8, 0.1, 'steel')
    for k in range(1, 4):
        kit.on_face(p, rect, 'front', 0, gh + 0.4 + k * 1.7, 9.6, 0.08, 0.1, 'steel')
    pz = e3.flat_roof(p, rect, top, 'concrete', parapet=1.0, parapet_mat=wall, coping=band)
    if r == 'south':
        e3.sino_parapet(p, -5.5, 5.5, y0, top + 0.25, wall, band)
        kit.on_face(p, rect, 'front', 0, top - 1.6, 8.0, 1.3, 0.3, 'e3_lightbox')
    else:
        e3.front_gable(p, r, -5.5, 5.5, y0, pz - 0.05, depth=4.0, wall=wall)
        kit.on_face(p, rect, 'front', 0, top - 1.5, 9.0, 1.2, 0.3, 'e3_lightbox')
    bz = top + 0.25
    for k in range(6):
        q.box((1.6, 1.0, 1.2), 'paint_white', T(-11.0 + k * 2.2, 8.0, bz + 0.6), bevel=0.03)
        q.cyl(0.4, 0.4, 0.05, 'grey', T(-11.0 + k * 2.2, 8.0, bz + 1.22), seg=12)
    for k in range(5):
        props.water_tank(q, 13.2 - k * 1.3, 11.6, bz, 'stainless' if k % 2 else 'plastic', stand=1.0)
    e3.stair_head(p, 7.0, 3.0, 10.0, 6.5, bz, wall, roof=roof_of(b) if r != 'south' else None, region=r)
    e3.stair_head(p, -13.5, 9.0, -10.5, 12.5, bz, wall)
    pave(b, -15.4, -15.4, 15.4, y0, 0.07)
    e3.parking_lines(b, -14.0, -14.5, -6.0, -9.5, 4)
    e3.parking_lines(b, 6.0, -14.5, 14.0, -9.5, 4)
    e3.scooter_shed(b.main, (-14.5, -8.2, -8.0, -6.4), 2.3)
    e3.scooter_shed(b.main, (8.0, -8.2, 14.5, -6.4), 2.3)
    for x in (-3.5, 3.5):
        e3.food_cart(q, x, -9.0, 0, regions.awning_colours(r)[0])
        e3.table_set(q, x, -12.0, 4, umbrella=True)
    for x in (-6.5, 6.5):
        props.street_lamp(q, x, -15.0, 6.5, 0)
    for k, (x, y) in enumerate(((-15.0, 14.8), (15.0, 14.8), (-4.8, -15.0), (4.8, -15.0))):
        regions.plant(b, x, y, k, big=k < 2)
    e3.potted_row(q, -8.0, y0 - 0.6, 3, 1.0, 0.6, 1)
    e3.potted_row(q, 6.0, y0 - 0.6, 3, 1.0, 0.6, 2)
    street_poles(b, y=-15.3, x0=-15.2, x1=15.2, h=9.5)


# workshops and factories ------------------------------------------------------------------------------------------------

@building('factory_1', 1, 'อู่ซ่อมรถ', 'Garage and workshop')
def factory_1(b):
    """A garage (อู่): a concrete workshop of two bays with their shutters rolled up, a ribbed roof, a zinc lean-to
    for tyres, a car lift and an engine hoist on the concrete apron, a workbench, drums, a compressor, a sign."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    rect = (-6.6, -1.6, 3.4, 6.4)
    x0, y0, x1, y1 = rect
    wall = regions.plaster(r, 2)
    e3.shed(p, rect, 4.6, 1.4, base_h=4.6, base=wall, upper=wall, roof=roof_of(b, 1) if r != 'south' else 'zinc',
            axis='x', band=e3.band_mat(r), clerestory=False)
    kit.bands(p, rect, 0, 0.45, 0.025, 'e3_skirt')
    for u in (-2.6, 1.8):
        kit.roller_shutter(p, rect, 'front', u, 0, 3.6, 3.7, 'roller', 0.95)
        kit.on_face(p, rect, 'front', u, 0.4, 2.0, 0.9, 0.04, 'teak')
    e3.grille_window(p, rect, 'left', 1.5, 1.0, 1.4, 1.2)
    kit.door(p, rect, 'left', -1.8, 0, 0.9, 2.1, leaf='paint_blue', frame='concrete_dark')
    props.sign_board(q, rect, 'front', 0, 4.0, 6.0, 0.55, 'sign_red' if r != 'south' else 'sign_blue',
                     'e3_sign_white', out=0.05)
    kit.corrugated(p, (x1, y0 + 0.5, 7.2, y1 - 0.5), 2.6, 3.4, 'zinc', 'zinc_dark', 0.15, 'right')
    for y in (y0 + 0.6, y1 - 0.6):
        kit.block(p, 7.0, y - 0.05, 0, 7.1, y + 0.05, 2.6, 'steel')
    for k, (x, y) in enumerate(((4.4, 0.0), (5.4, 0.2), (6.4, 0.0), (4.6, 1.4), (5.8, 1.6))):
        e3.tyres(q, x, y, 3 + k % 3)
    for k in range(3):
        props.barrel(q, 4.3 + k * 0.7, 4.8, ('paint_blue', 'paint_red', 'paint_green')[k], 0.9)
    kit.block(b.yard, -7.2, -7.4, 0, 3.6, y0, 0.08, 'concrete')
    for x in (-4.4, -0.8):
        kit.block(q, x - 0.15, -4.6, 0, x + 0.15, -4.3, 2.8, 'paint_blue')
        kit.block(q, x - 0.3, -4.75, 0, x + 0.3, -4.15, 0.08, 'iron')
        for s in (-1, 1):
            q.box((0.9, 0.12, 0.08), 'iron', T(x + s * 0.45 * (1 if x < -2 else -1), -5.0 + s * 0.4, 0.5))
    q.box((3.8, 0.1, 0.12), 'paint_yellow', T(-2.6, -4.45, 2.9))
    m = T(2.4, -5.6, 0)
    q.box((1.4, 0.08, 0.08), 'paint_red', m @ T(0, 0, 0.08))
    q.box((0.08, 1.2, 0.08), 'paint_red', m @ T(-0.6, 0.0, 0.08))
    q.rod((1.8, -5.6, 0.1), (2.2, -5.6, 2.1), 0.05, 'paint_red', seg=4)
    q.rod((2.2, -5.6, 2.1), (3.3, -5.6, 1.9), 0.05, 'paint_red', seg=4)
    q.rod((3.3, -5.6, 1.9), (3.3, -5.6, 1.2), 0.012, 'iron', seg=3)
    q.box((2.2, 0.7, 0.08), 'plank', T(-5.0, 5.6, 0.9))
    for sx in (-1, 1):
        q.box((0.08, 0.6, 0.9), 'iron', T(-5.0 + sx, 5.6, 0.45))
    q.cyl(0.3, 0.3, 1.1, 'paint_red', T(5.6, 3.2, 0.45) @ R(0, 90, 0), seg=10)
    q.box((0.4, 0.4, 0.35), 'grey', T(5.6, 3.2, 1.0))
    e3.potted_row(q, -6.9, -6.9, 2, 1.0, 0.5, 3)
    regions.plant(b, -6.6, 6.8, 1)
    regions.craft(b, 4.6, -6.0)
    street_poles(b, transformer=1)


@building('factory_2', 2, 'โกดังสินค้า', 'Warehouse')
def factory_2(b):
    """A warehouse (โกดัง): block walls with ribbed sheet above, a ribbed gable roof facing the street with roof
    ventilators, two big roller doors on a raised loading dock, pallets, sacks and drums, a sign on the gable."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    rect = (-6.6, -1.4, 6.6, 7.0)
    x0, y0, x1, y1 = rect
    wall = 'concrete' if r != 'south' else regions.plaster(r, 0)
    upper = 'zinc' if r != 'south' else 'roof_blue'
    ridge = e3.shed(p, rect, 6.2, 2.4, base_h=2.6, base=wall, upper='zinc', roof=roof_of(b, 1)
                    if r in ('northeast', 'south') else 'zinc', axis='y', band=e3.band_mat(r))
    for u in (-3.1, 3.1):
        kit.roller_shutter(p, rect, 'front', u, 1.1, 3.8, 4.0, 'roller', 0.65 if u < 0 else 0.0)
    e3.loading_dock(p, (x0 + 0.4, -3.6, x1 - 0.4, y0), 1.1, 'left')
    props.sign_board(q, rect, 'front', 0, 6.6, 3.8, 0.7, 'sign_blue' if r != 'south' else 'sign_green',
                     'e3_sign_white', out=0.05)
    kit.door(p, rect, 'left', 2.0, 0, 0.9, 2.1, leaf='paint_blue', frame='concrete_dark')
    for u in (-2.0, 1.6):
        e3.grille_window(p, rect, 'left', u - 1.6, 1.0, 1.2, 1.0, hood=None)
    for y in (0.6, 3.0, 5.4):
        e3.vent(q, 0.0, y, ridge)
    for x in (x0 + 0.15, x1 - 0.15):
        q.rod((x, y0 - 0.15, 0.05), (x, y0 - 0.15, 6.0), 0.06, 'zinc_dark', seg=6)
    e3.pallets(q, -4.5, -2.6, 2, seed=1)
    e3.pallets(q, 4.8, -2.6, 1, seed=2)
    props.sacks(q, -1.6, -3.0, 5)
    b.path(-7.4, -7.4, 7.4, -3.6, 'concrete')
    for k in range(4):
        props.barrel(q, 6.9, -6.6 + k * 0.7, ('paint_blue', 'paint_blue', 'paint_red', 'paint_blue')[k], 0.9)
    props.crates(q, -6.8, -6.6, 4)
    e3.pallets(q, -5.0, -6.0, 1, load=False)
    regions.plant(b, -6.8, 6.8, 0)
    street_poles(b)


@building('factory_3', 3, 'โรงงานขนาดเล็ก', 'Small factory with a chimney')
def factory_3(b):
    """A small factory: a ribbed shed with high windows behind a two-storey office, a boiler house and its 18 m
    chimney with smoke, two steel tanks and pipe runs, drums and pallets."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    ridge = e3.shed(p, (-7.0, 0.2, 3.4, 7.2), 5.6, 1.6, base_h=2.4, base='concrete', upper='zinc',
                    roof='zinc' if r != 'south' else 'roof_blue', axis='x')
    kit.roller_shutter(p, (-7.0, 0.2, 3.4, 7.2), 'front', 3.2, 0, 3.4, 3.8, 'roller', 0.6)
    for x in (-4.5, -1.0, 2.0):
        e3.vent(q, x, 3.7, ridge)
    o = e3.wing_block(b, (-7.0, -5.2, -1.4, 0.2), 2, storey=3.2, i=1, roof=False, door_us=(1.4,), count=2,
                      window_w=1.3)
    e3.ac_on(q, (-7.0, -5.2, -1.4, 0.2), 'left', 0.0, 3.6)
    e3.front_gable(p, r, -6.0, -2.4, -5.2, o['ridge'] - 0.05, 2.4) if r != 'south' else \
        e3.sino_parapet(p, -6.0, -2.4, -5.2, o['top'] + 0.25, regions.plaster(r, 1), e3.band_mat(r))
    props.sign_board(q, (-7.0, -5.2, -1.4, 0.2), 'front', 0, 2.75, 4.0, 0.45, 'sign_green', 'e3_sign_white',
                     text_lines=1, out=0.05)
    boiler = (3.8, 1.6, 7.2, 5.2)
    kit.block(p, boiler[0], boiler[1], 0, boiler[2], boiler[3], 4.2, 'brick')
    kit.bands(p, boiler, 4.0, 0.2, 0.04, 'concrete_dark')
    kit.corrugated(p, boiler, 4.2, 4.7, 'rust', 'zinc_dark', 0.2, 'right')
    kit.door(p, boiler, 'front', -0.6, 0, 1.4, 2.4, leaf='iron', frame='concrete_dark', panels=False)
    e3.stack(q, 6.0, 6.2, 18.0, 0.7, 0.45, 'concrete', puffs=4)
    for k, x in enumerate((1.4, 4.4)):
        props.tank(q, x, -4.4, 1.1, 3.4, 'stainless')
        kit.block(q, x - 0.9, -5.3, 0, x + 0.9, -3.5, 0.2, 'concrete')
    props.pipe_run(q, [(1.4, -3.3, 3.0), (1.4, -1.4, 3.0), (1.4, -1.4, 4.0), (1.4, 0.2, 4.0)], 0.1, 'metal')
    props.pipe_run(q, [(4.4, -3.3, 2.6), (4.4, -1.0, 2.6), (5.0, 1.6, 2.6)], 0.1, 'paint_yellow')
    b.path(-7.4, -7.4, 7.4, -5.2, 'concrete')
    for k in range(3):
        props.barrel(q, -0.6 + k * 0.7, -2.0, ('paint_blue', 'paint_green', 'paint_blue')[k], 0.9)
    e3.pallets(q, 0.6, -6.4, 2, seed=3)
    regions.plant(b, -6.8, -6.6, 2, big=False)
    street_poles(b, transformer=0)


@building('factory_4', 4, 'นิคมโรงงาน', 'Factory complex')
def factory_4(b):
    """A factory complex on a joined lot: a saw-tooth production hall with loading bays, a ribbed store shed, a
    two-storey office with the region's roof, a 26 m chimney with smoke, three tanks and a pipe rack, a transformer,
    a walled yard with a guard booth and barrier, and the concrete drain behind."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    hall = (-15.0, -1.0, 4.0, 12.6)
    kit.block(p, hall[0], hall[1], 0, hall[2], hall[3], 2.4, 'concrete')
    e3.ribbed_walls(p, hall, 2.4, 5.6, 'zinc', 'zinc_dark', 0.6)
    kit.bands(p, hall, 2.35, 0.15, 0.04, 'concrete_dark')
    e3.sawtooth(p, hall, 5.6, 4, 2.2)
    for u in (3.0, 7.0):
        kit.roller_shutter(p, hall, 'front', u, 0, 3.4, 4.2, 'roller', 0.55 if u > 4 else 0.0)
    for side in ('left',):
        for u in kit.spread(13.6, 4, 1.0):
            kit.on_face(p, hall, side, u, 3.4, 2.0, 1.2, 0.06, 'glass_dark')
    e3.loading_dock(p, (-6.5, -3.0, 4.0, -1.0), 1.1, 'right')
    store = (7.0, 2.0, 15.0, 12.6)
    sr = e3.shed(p, store, 6.6, 2.0, base_h=2.6, base='concrete', upper='zinc',
                 roof='roof_blue' if r == 'south' else 'zinc', axis='y')
    kit.roller_shutter(p, store, 'front', 0, 0, 4.2, 4.6, 'roller', 0.8)
    for y in (4.0, 7.0, 10.0):
        e3.vent(q, 11.0, y, sr)
    office = (-15.0, -10.0, -5.0, -4.0)
    o = e3.wing_block(b, office, 2, storey=3.4, i=0, roof=True, pitch=0.5, door_us=(2.5,), count=3)
    props.flag_pole(q, -2.5, -11.0, 7.0, thai=False)
    e3.ac_on(q, office, 'left', 0, 1.2)
    e3.stack(q, 10.0, -2.5, 26.0, 1.1, 0.7, 'concrete', puffs=5)
    kit.block(p, 8.4, -4.0, 0, 11.6, -1.0, 3.2, 'brick')
    kit.corrugated(p, (8.4, -4.0, 11.6, -1.0), 3.2, 3.7, 'rust', 'zinc_dark', 0.2, 'front')
    for k, x in enumerate((6.0, 9.4, 12.8)):
        props.tank(q, x, -9.0, 1.5, 5.0, 'stainless' if k != 1 else 'paint_white')
        kit.block(q, x - 1.8, -10.8, 0, x + 1.8, -7.2, 0.25, 'concrete')
    for x in (6.0, 9.4, 12.8):
        q.rod((x, -7.5, 3.5), (x, -5.4, 5.0), 0.12, 'metal', seg=8)
    for x in (5.0, 14.0):
        q.box((0.2, 0.2, 5.2), 'iron', T(x, -5.4, 2.6))
    props.pipe_run(q, [(4.6, -5.4, 5.0), (14.4, -5.4, 5.0)], 0.14, 'metal')
    props.pipe_run(q, [(4.6, -5.2, 4.6), (4.6, -1.0, 4.6)], 0.12, 'paint_yellow')
    e3.lot_wall(b, 15.3, gates=((-1.5, 6.0),), h=2.0, front_h=1.0)
    e3.guard_booth(b.main, 3.2, -13.4)
    e3.barrier(q, -4.5, -14.6, 4.5)
    b.path(-15.4, -15.4, 15.4, -1.0, 'concrete', z=0.07)
    e3.parking_lines(b, -14.6, -14.6, -6.6, -11.2, 4)
    e3.drain(b, -15.4, 13.2, 15.4, 15.2, crossings=(-8.0,))
    e3.pole(q, 14.5, -13.5, 9.5, transformer=True)
    e3.pallets(q, -3.0, -4.6, 2, seed=1)
    e3.pallets(q, 0.0, -4.6, 2, seed=2)
    for k in range(4):
        props.barrel(q, 14.6, -3.0 + k * 0.7, 'paint_blue', 0.9)
    for k, (x, y) in enumerate(((-14.6, -14.6), (14.2, 1.0))):
        regions.plant(b, x, y, k)


# services (3x3 tiles, 47 m) --------------------------------------------------------------------------------------------

def service_lot(b, gate_w=6.0, gate_x=0.0, h=1.8, booth=True, sides=('left', 'back', 'right')):
    """The service's wall and gate, a guard booth beside it, the paved way in."""
    e3.lot_wall(b, 23.3, gates=((gate_x, gate_w),), h=h, front_h=1.0, sides=sides)
    if booth:
        e3.guard_booth(b.main, gate_x + gate_w / 2 + 2.0, -21.6)
    b.path(gate_x - gate_w / 2, -23.9, gate_x + gate_w / 2, -14.0, 'paving_dark', z=0.07)


def flag_base(b, x, y, h=12.0):
    """The flag pole on a three-step base (government buildings only)."""
    for k, rr in enumerate((1.8, 1.3, 0.8)):
        b.main.cyl(rr, rr, 0.2, 'concrete_light' if k % 2 == 0 else 'paint_white', T(x, y, 0.1 + k * 0.2), seg=16)
    props.flag_pole(b.props, x, y, h, thai=True)


def portico(b, rect, z, region, roof=None, cols=4, wall=None):
    """A porch of round columns under the region's gable (a hipped roof in the south) facing the front."""
    p = b.main
    x0, y0, x1, y1 = rect
    for k in range(cols):
        x = x0 + 0.4 + (x1 - x0 - 0.8) * k / (cols - 1)
        p.cyl(0.3, 0.3, z, 'paint_white', T(x, y0 + 0.5, z / 2), seg=12)
        p.cyl(0.4, 0.4, 0.25, 'concrete_light', T(x, y0 + 0.5, 0.12), seg=12)
    kit.block(p, x0, y0, z - 0.6, x1, y1, z, wall or 'concrete_light')
    kit.bands(p, rect, z - 0.65, 0.12, 0.05, e3.band_mat(region))
    return regions.house_roof(p, rect, z, region, mat=roof, axis='y', over=0.6, over_ends=0.5, fill=wall,
                              pitch=regions.style(region)['pitch'] * 0.9)


@building('ruler_house', None, 'ศาลากลางจังหวัด', 'Provincial hall')
def ruler_house(b):
    """The ruler's office in the factory-town era, a provincial hall: a long three-storey concrete block with open
    corridors under the region's roof, a two-storey porch of white columns under a big gable, the flag on its base
    in a round lawn, a drive lined with pots, parking, a wall with a gate and a guard booth."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    wall = regions.plaster(r, 1)
    rm = roof_of(b)
    main = e3.wing_block(b, (-19.0, 5.0, 19.0, 16.0), 3, storey=3.6, i=1, corridor=('front', 2.6), pitch=0.55,
                         door_us=(0.0,), roof_kind=rm)
    portico(b, (-5.0, -0.4, 5.0, 5.2), 7.4, r, rm, 4, wall)
    kit.stairs(p, 0.0, -0.4, 0.75, 8.0, '-y', 'concrete_light', open_=False)
    kit.block(p, -5.0, -0.4, 0, 5.0, 5.0, 0.75, 'concrete_light')
    props.sign_board(q, (-5.0, -0.4, 5.0, 5.2), 'front', 0, 6.85, 6.0, 0.5, 'gold', 'sign_text', text_lines=1)
    b.path(-11.0, -16.0, 11.0, -1.4, 'paving', z=0.06)
    b.main.cyl(5.0, 5.0, 0.12, 'grass', T(0, -9.5, 0.06), seg=24)
    flag_base(b, 0.0, -9.5, 13.0)
    for x in (-8.0, 8.0):
        for k in range(5):
            props.potted(q, x, -13.0 + k * 2.6, 0, 0.6, 'flowers' if k % 2 else 'leafy', k)
    e3.parking_lines(b, 12.0, -14.0, 22.0, -4.0, 4, axis='y')
    e3.parking_lines(b, -22.0, -14.0, -12.0, -4.0, 4, axis='y')
    b.path(12.0, -14.0, 22.0, -4.0, 'asphalt', z=0.05)
    b.path(-22.0, -14.0, -12.0, -4.0, 'asphalt', z=0.05)
    for k in range(4):
        props.water_tank(q, 16.0 - k * 1.4, 21.0, 0, 'stainless', stand=2.0)
    service_lot(b)
    regions.border(b, 22.0, 7.0, 1, sides=('back', 'left', 'right'))
    for k, (x, y) in enumerate(((-15.0, -20.0), (15.0, -20.0), (-21.0, 1.0), (21.0, 1.0))):
        props.tree(q, x, y, 8.0, 3.0, 40 + k)
    regions.craft(b, -10.0, 2.0)
    e3.pole(q, -22.6, -22.6, 9.5, transformer=True)


@building('school', None, 'โรงเรียน', 'School')
def school(b):
    """A three-storey concrete school (อาคารเรียน) with open corridors and stairs at both ends under the region's roof,
    a playing field with goals, the flag on its base before the assembly yard, a canteen shed with tables, a
    motorbike shelter, a wall and a gate."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    wall = regions.plaster(r, 0)
    rm = roof_of(b)
    m = e3.wing_block(b, (-17.0, 9.0, 17.0, 18.5), 3, storey=3.5, i=0, corridor=('front', 2.6), pitch=0.55,
                      roof_kind=rm, count=8)
    for x0 in (-20.2, 17.0):
        sr = (x0, 9.0, x0 + 3.2, 15.0)
        kit.block(p, sr[0], sr[1], 0, sr[2], sr[3], 10.5, wall)
        for f in range(3):
            for kz in range(3):
                for kx in range(3):
                    kit.block(p, sr[0] + 0.45 + kx * 0.9, sr[1] - 0.03, f * 3.5 + 0.8 + kz * 0.7,
                              sr[0] + 0.95 + kx * 0.9, sr[1] + 0.05, f * 3.5 + 1.25 + kz * 0.7, 'concrete_dark')
        regions.small_roof(p, sr, 10.5, r, mat=rm, axis='y', over=0.4)
    b.path(-20.0, 1.0, 20.0, 9.0, 'paving', z=0.06)
    flag_base(b, 0.0, 3.4, 12.0)
    kit.block(b.yard, -21.0, -21.0, 0, 5.0, -2.0, 0.06, 'grass')
    for x in (-19.5, 3.5):
        for s in (-1, 1):
            q.box((0.1, 0.1, 2.2), 'paint_white', T(x, -11.5 + s * 1.6, 1.1))
        q.box((0.1, 3.3, 0.1), 'paint_white', T(x, -11.5, 2.2))
        q.rod((x, -11.5 - 1.6, 2.2), (x + (0.9 if x < 0 else -0.9), -11.5 - 1.6, 0), 0.02, 'paint_white', seg=3)
        q.rod((x, -11.5 + 1.6, 2.2), (x + (0.9 if x < 0 else -0.9), -11.5 + 1.6, 0), 0.02, 'paint_white', seg=3)
    for k in range(5):
        kit.block(b.yard, -21.0, -21.0 + k * 4.75, 0, 5.0, -20.9 + k * 4.75, 0.08, 'paint_white')
    kit.block(b.yard, -8.05, -21.0, 0, -7.95, -2.0, 0.08, 'paint_white')
    houses.pavilion(b.main, (9.0, -19.0, 21.0, -9.0), 0.3, 3.0, r, rm, wood='concrete_light', trim=e3.band_mat(r),
                    floor_mat='paving_dark')
    for y in (-16.5, -13.5, -11.0):
        for x in (12.0, 17.0):
            q.box((3.0, 0.9, 0.06), 'e3_tile', T(x, y, 0.75 + 0.3))
            for s in (-1, 1):
                q.box((3.0, 0.3, 0.06), 'plank', T(x, y + s * 0.75, 0.45 + 0.3))
    e3.scooter_shed(b.main, (9.0, -6.0, 21.0, -3.6), 2.4)
    service_lot(b)
    regions.border(b, 22.0, 8.0, 2, sides=('back', 'left'))
    for k, (x, y) in enumerate(((22.0, 5.0), (22.0, -1.0), (-22.0, 5.0))):
        props.tree(q, x, y, 8.0, 3.0, 50 + k)
    props.spirit_house(q, 7.0, 4.0)
    e3.pole(q, 22.6, -22.6, 9.5, transformer=True)


@building('hospital', None, 'โรงพยาบาล', 'Hospital')
def hospital(b):
    """A four-storey concrete hospital: rows of windows with sunshades, a canopy over the ambulance bay by the doors,
    a green sign with a white H on the roof (no red cross), an outpatient wing under the region's roof, tanks and AC
    units, a car park, gardens and the flag."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    wall = regions.plaster(r, 1) if r != 'northeast' else 'plaster_white'
    band = e3.band_mat(r)
    m = e3.wing_block(b, (-18.0, 4.0, 10.0, 16.0), 4, storey=3.5, i=1, roof=False, door_us=(-4.0,), count=8,
                      wall=wall)
    rect = (-18.0, 4.0, 10.0, 16.0)
    if r == 'south':
        e3.sino_parapet(p, -9.0, 1.0, 4.0, m['top'] + 0.25, wall, band)
    else:
        e3.front_gable(p, r, -9.0, 1.0, 4.0, m['ridge'] - 0.05, 3.5, wall=wall)
    for f in range(1, 4):
        for u in (-12.0, 12.0):
            e3.ac_on(q, rect, 'front', u, f * 3.5 + 0.2)
    z = m['ridge'] + 0.3
    for x in (-15.6, -12.4):
        q.box((0.15, 0.15, 3.6), 'iron', T(x, 5.0, z + 1.8))
    q.box((3.6, 0.2, 3.0), 'sign_green', T(-14.0, 5.0, z + 2.0))
    for s in (-1, 1):
        q.box((0.4, 0.25, 2.0), 'e3_sign_white', T(-14.0 + s * 0.7, 4.95, z + 2.0))
    q.box((1.4, 0.25, 0.4), 'e3_sign_white', T(-14.0, 4.95, z + 2.0))
    for k in range(6):
        props.water_tank(q, 9.0 - k * 1.4, 14.6, m['top'] + 0.25, 'stainless', stand=1.0)
    can = (-9.0, -4.5, 1.0, 4.0)
    for x in (-8.6, 0.6):
        for y in (-4.1,):
            kit.block(p, x - 0.2, y - 0.2, 0, x + 0.2, y + 0.2, 3.8, 'paint_white')
    kit.block(p, can[0] - 0.3, can[1] - 0.3, 3.8, can[2] + 0.3, can[3], 4.1, 'concrete_light')
    kit.block(p, can[0] - 0.35, can[1] - 0.35, 3.75, can[2] + 0.35, can[1] - 0.1, 4.25, 'sign_green')
    for k in range(8):
        kit.block(b.yard, -8.0 + k * 1.1, -3.6, 0, -7.6 + k * 1.1, -0.6, 0.08, 'paint_yellow')
    b.path(-9.0, -23.9, 1.0, 4.0, 'asphalt', z=0.06)
    kit.block(p, 1.0, 1.5, 0, 5.0, 4.0, 0.45, 'concrete_light')
    wing = (11.0, -2.0, 21.0, 12.0)
    e3.wing_block(b, wing, 2, storey=3.5, i=2, corridor=('front', 2.4), pitch=0.5, roof_kind=roof_of(b),
                  door_us=(0.0,), count=3, wall=wall)
    b.path(-22.0, -20.0, -11.0, -6.0, 'asphalt', z=0.05)
    e3.parking_lines(b, -22.0, -20.0, -11.0, -14.0, 5)
    e3.parking_lines(b, -22.0, -12.0, -11.0, -6.0, 5)
    flag_base(b, 7.0, -12.0, 11.0)
    for k in range(4):
        props.bench(q, 4.0 + k * 3.0, -18.0, 2.0)
    service_lot(b, gate_x=-4.0, gate_w=8.0)
    regions.border(b, 22.0, 7.0, 3, sides=('back', 'left'))
    for k, (x, y) in enumerate(((12.0, -20.0), (20.0, -14.0), (8.0, -6.0))):
        props.tree(q, x, y, 7.5, 2.8, 60 + k)
    e3.pole(q, 22.6, -22.6, 9.5, transformer=True)


@building('police', None, 'สถานีตำรวจ', 'Police station')
def police(b):
    """A two-storey concrete police station under the region's roof with a pillared porch, the flag on its base, a
    blank sign on a low wall, parking and a motorbike shelter, the wall, the gate and a guard booth."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    wall = regions.plaster(r, 0)
    rm = roof_of(b)
    e3.wing_block(b, (-14.0, 3.0, 14.0, 13.0), 2, storey=3.6, i=0, pitch=0.6, roof_kind=rm, door_us=(0.0,), count=6)
    portico(b, (-3.2, -0.6, 3.2, 3.2), 3.8, r, rm, 2, wall)
    kit.stairs(p, 0.0, -0.6, 0.45, 5.0, '-y', 'concrete_light', open_=False)
    kit.block(p, -3.2, -0.6, 0, 3.2, 3.2, 0.45, 'concrete_light')
    flag_base(b, -8.0, -6.0, 11.0)
    kit.block(p, 4.0, -9.0, 0, 12.0, -8.6, 1.4, wall)
    props.sign_board(q, (4.0, -9.0, 12.0, -8.6), 'front', 0, 0.3, 7.0, 0.9, 'sign_cream', 'sign_text', out=0.02)
    b.path(-3.0, -14.0, 3.0, -0.6, 'paving', z=0.07)
    b.path(6.0, -20.0, 22.0, -11.0, 'asphalt', z=0.05)
    e3.parking_lines(b, 6.0, -20.0, 22.0, -14.5, 6)
    e3.scooter_shed(b.main, (-20.0, -6.0, -12.0, -3.6), 2.4)
    for k in range(3):
        props.street_lamp(q, -14.0 + k * 14.0, -2.0 if k != 1 else -16.0, 6.0, 0)
    service_lot(b)
    regions.border(b, 22.0, 7.0, 6, sides=('back', 'left', 'right'))
    for k, (x, y) in enumerate(((-16.0, -18.0), (18.0, -2.0))):
        props.tree(q, x, y, 8.0, 3.0, 70 + k)
    e3.pole(q, -22.6, -22.6, 9.5, transformer=True)


@building('fire', None, 'สถานีดับเพลิง', 'Fire station')
def fire(b):
    """A fire station: three engine bays behind red roller doors, offices above, a 16 m hose-drying tower with a
    siren under the region's little roof, hydrants and red-and-white posts on the apron, hose reels, the flag."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    wall = regions.plaster(r, 1)
    band = e3.band_mat(r)
    rect = (-16.0, 2.0, 6.0, 14.0)
    x0, y0, x1, y1 = rect
    top = 4.8 + 3.5
    kit.block(p, x0, y0, 0, x1, y1, top, wall)
    kit.bands(p, rect, 0, 0.4, 0.025, 'e3_skirt')
    kit.bands(p, rect, 4.7, 0.25, 0.08, band)
    for u in (-7.0, -1.0, 5.0):
        kit.roller_shutter(p, rect, 'front', u, 0, 4.2, 4.2, 'paint_red', 0.0 if u != -1.0 else 0.0)
        kit.on_face(p, rect, 'front', u, 0, 0.3, 4.4, 0.08, 'paint_white')
    kit.on_face(p, rect, 'front', -8.6, 0, 0.3, 4.7, 0.08, band)
    for u in kit.spread(22.0, 6, 1.0):
        e3.grille_window(p, rect, 'front', u, 5.7, 1.4, 1.4, grille=None)
    for u in kit.spread(12.0, 3, 1.2):
        e3.grille_window(p, rect, 'left', u, 1.2, 1.2, 1.4)
        e3.grille_window(p, rect, 'left', u, 5.7, 1.2, 1.4)
    pz = e3.flat_roof(p, rect, top, 'concrete', parapet=0.9, parapet_mat=wall, coping=band)
    if r == 'south':
        e3.sino_parapet(p, -9.0, 1.0, y0, top + 0.25, wall, band)
    else:
        e3.front_gable(p, r, -8.0, 0.0, y0, pz - 0.05, 3.0, wall=wall)
    props.sign_board(q, rect, 'front', -1.0, 4.95, 10.0, 0.6, 'paint_red', 'e3_sign_white', text_lines=1, out=0.1)
    tower = (8.0, 5.0, 11.4, 8.4)
    kit.block(p, tower[0], tower[1], 0, tower[2], tower[3], 16.0, wall)
    for k in range(1, 5):
        kit.bands(p, tower, k * 3.4, 0.2, 0.05, band)
        kit.on_face(p, tower, 'front', 0, k * 3.4 + 0.6, 0.6, 1.8, 0.06, 'window_dark')
        kit.on_face(p, tower, 'left', 0, k * 3.4 + 0.6, 0.6, 1.8, 0.06, 'window_dark')
    kit.door(p, tower, 'front', 0, 0, 1.0, 2.2, leaf='paint_red', frame='concrete_dark')
    regions.small_roof(p, (tower[0] - 0.3, tower[1] - 0.3, tower[2] + 0.3, tower[3] + 0.3), 16.0, r,
                       mat=roof_of(b), axis='x', over=0.4)
    q.cyl(0.35, 0.25, 0.5, 'paint_red', T(11.6, 6.7, 15.0) @ R(0, 90, 0), seg=10)
    q.cyl(0.1, 0.1, 0.8, 'iron', T(11.5, 6.7, 15.0) @ R(0, 90, 0), seg=6)
    b.path(-16.0, -23.9, 6.0, 2.0, 'concrete', z=0.07)
    for k in range(3):
        u = -7.0 + k * 6.0
        kit.block(b.yard, u - 2.2, -6.0, 0, u - 2.05, 2.0, 0.09, 'paint_yellow')
        kit.block(b.yard, u + 2.05, -6.0, 0, u + 2.2, 2.0, 0.09, 'paint_yellow')
    for x in (-17.0, 7.0):
        q.cyl(0.18, 0.18, 0.7, 'paint_red', T(x, -1.0, 0.35), seg=10)
        q.sphere(0.18, 'paint_red', T(x, -1.0, 0.7), seg=10, rings=5)
        q.cyl(0.08, 0.08, 0.5, 'paint_red', T(x, -1.0, 0.45) @ R(0, 90, 0), seg=8)
    for k in range(10):
        x = -16.0 + k * 2.4
        q.cyl(0.1, 0.1, 0.9, 'paint_white', T(x, -7.0, 0.45), seg=8)
        q.cyl(0.105, 0.105, 0.2, 'paint_red', T(x, -7.0, 0.7), seg=8)
    for u in (-4.0, 2.0):
        c = e3.at_face(rect, 'front', u, 0.2, 2.0)
        q.cyl(0.5, 0.5, 0.25, 'e3_hose', T(c.x, c.y, 2.0) @ R(90, 0, 0), seg=12)
    flag_base(b, 16.0, -10.0, 11.0)
    service_lot(b, gate_x=-5.0, gate_w=14.0, booth=False)
    regions.border(b, 22.0, 7.0, 4, sides=('back', 'right'))
    for k, (x, y) in enumerate(((-21.0, -6.0), (20.0, -20.0))):
        props.tree(q, x, y, 7.5, 2.8, 80 + k)
    e3.pole(q, 22.6, -22.6, 9.5, transformer=True)


@building('water_works', None, 'การประปา', 'Water works')
def water_works(b):
    """The town water works (การประปา): an elevated concrete water tower on columns and ring beams, a pumping house
    under the region's roof, two settling basins and a round clarifier with its bridge, pipes between them, a
    chlorine shed, a wall and a gate."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    wall = regions.plaster(r, 0)
    tx, ty, h = 13.0, 11.0, 18.0
    for k in range(6):
        a = k * math.pi / 3
        x, y = tx + math.cos(a) * 3.0, ty + math.sin(a) * 3.0
        p.cyl(0.35, 0.3, h, 'concrete_light', T(x, y, h / 2), seg=8)
        p.cyl(0.6, 0.6, 0.3, 'concrete', T(x, y, 0.15), seg=8)
    for zz in (6.0, 12.0):
        p.torus(3.0, 0.22, 'concrete_light', T(tx, ty, zz), seg=12, seg_minor=4)
    p.cyl(0.9, 0.9, h, 'concrete', T(tx, ty, h / 2), seg=10)
    p.lathe([(0.9, 0.0), (4.4, 1.8), (4.4, 6.2), (4.0, 6.7), (1.2, 7.6), (0.3, 7.8)],
            ['concrete_light', 'concrete_light', 'paint_blue', 'concrete_light', 'concrete_light'], T(tx, ty, h),
            seg=24, cap_bottom=True, cap_top=True)
    p.torus(4.45, 0.12, 'paint_white', T(tx, ty, h + 2.6), seg=24, seg_minor=4)
    p.torus(4.45, 0.12, 'paint_white', T(tx, ty, h + 5.4), seg=24, seg_minor=4)
    kit.railing(p, [(tx - 1.0, ty - 4.2), (tx + 1.0, ty - 4.2)], h + 1.8, 'iron', h=0.9, spacing=0.3)
    for s in (-1, 1):
        q.rod((tx + s * 0.25, ty - 0.95, 0.2), (tx + s * 0.25, ty - 0.95, h), 0.03, 'iron', seg=4)
    ph = (-6.0, 8.0, 6.0, 16.0)
    e3.wing_block(b, ph, 1, storey=5.0, i=0, pitch=0.5, roof_kind=roof_of(b), door_us=(2.0,), count=3)
    for k in range(3):
        props.pipe_run(q, [(-4.0 + k * 3.0, 8.0, 0.8), (-4.0 + k * 3.0, 5.5, 0.8), (-4.0 + k * 3.0, 5.5, 0.4)], 0.22,
                       'paint_blue')
    props.pipe_run(q, [(6.0, 12.0, 1.2), (tx - 3.0, 12.0, 1.2), (tx - 0.9, ty, 1.2)], 0.25, 'paint_blue')
    for x0 in (-21.0, -12.0):
        basin = (x0, -12.0, x0 + 8.0, 4.0)
        kit.block(p, basin[0], basin[1], 0, basin[2], basin[3], 1.3, 'concrete')
        kit.block(p, basin[0] + 0.3, basin[1] + 0.3, 1.05, basin[2] - 0.3, basin[3] - 0.3, 1.31, 'water')
        for y in (basin[1] + 5.0, basin[1] + 10.5):
            kit.block(p, basin[0] + 0.3, y - 0.3, 1.0, basin[2] - 0.3, y + 0.3, 1.3, 'concrete_light')
        kit.railing(p, [(basin[0] + 0.1, basin[3] - 0.1), (basin[2] - 0.1, basin[3] - 0.1)], 1.3, 'iron', h=1.0,
                    spacing=0.5, posts_every=2.0)
    cx, cy, rr = 6.0, -8.0, 6.0
    p.lathe([(rr, 0), (rr, 1.4), (rr - 0.3, 1.4), (rr - 0.3, 0.2)], 'concrete', T(cx, cy, 0), seg=28)
    p.cyl(rr - 0.3, rr - 0.3, 0.1, 'water', T(cx, cy, 1.2), seg=28)
    p.cyl(0.8, 0.8, 1.8, 'concrete_light', T(cx, cy, 0.9), seg=10)
    kit.block(p, cx - 0.5, cy - 0.5, 1.6, cx + rr, cy + 0.5, 1.8, 'paint_blue')
    kit.railing(p, [(cx, cy - 0.5), (cx + rr, cy - 0.5)], 1.8, 'iron', h=0.9, spacing=0.4)
    props.pipe_run(q, [(cx - rr, cy, 0.8), (-4.0, cy, 0.8)], 0.22, 'paint_blue')
    shed_r = (14.0, -6.0, 20.0, -1.0)
    kit.block(p, shed_r[0], shed_r[1], 0, shed_r[2], shed_r[3], 3.2, wall)
    kit.corrugated(p, shed_r, 3.2, 3.8, 'zinc', 'zinc_dark', 0.3, 'front')
    kit.door(p, shed_r, 'front', 0, 0, 1.2, 2.2, leaf='paint_blue', frame='concrete_dark')
    for k in range(4):
        q.cyl(0.35, 0.35, 1.4, 'paint_yellow', T(15.0 + k * 1.0, -7.0, 0.7), seg=10)
    props.sign_board(q, (-6.0, 8.0, 6.0, 16.0), 'front', -1.0, 3.3, 6.0, 0.6, 'sign_blue', 'e3_sign_white', out=0.05)
    service_lot(b)
    regions.border(b, 22.0, 7.0, 5, sides=('back', 'left'))
    for k, (x, y) in enumerate(((20.0, -20.0), (-20.0, -20.0), (14.0, -14.0))):
        props.tree(q, x, y, 7.5, 2.8, 90 + k)
    e3.pole(q, 22.6, -22.6, 9.5, transformer=True)


@building('power_plant', None, 'โรงไฟฟ้าลิกไนต์', 'Lignite power plant')
def power_plant(b):
    """A small lignite-fired power plant: a tall boiler house, a turbine hall with a ribbed roof, a 42 m chimney with
    smoke, a small cooling tower with steam, a lignite yard with its conveyor up to the boiler, a switchyard of
    transformers and gantries, pipes, a wall and a gate."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    boiler = (-6.0, 3.0, 6.0, 16.0)
    br = e3.shed(p, boiler, 22.0, 2.0, base_h=6.0, base='concrete', upper='zinc', roof='zinc', axis='x')
    kit.roller_shutter(p, boiler, 'front', 2.0, 0, 4.0, 5.0, 'roller', 0.0)
    for zz in (8.0, 13.0, 18.0):
        kit.on_face(p, boiler, 'front', 0, zz, 10.0, 1.2, 0.06, 'glass_dark')
        kit.on_face(p, boiler, 'left', 0, zz, 11.0, 1.2, 0.06, 'glass_dark')
    hall = (-21.0, 4.0, -6.0, 15.0)
    e3.shed(p, hall, 11.0, 2.4, base_h=3.0, base=regions.plaster(r, 0), upper='zinc', roof='roof_blue'
            if r == 'south' else 'zinc', axis='x')
    kit.roller_shutter(p, hall, 'front', -3.0, 0, 4.5, 5.5, 'roller', 0.3)
    kit.door(p, hall, 'front', 3.5, 0, 1.2, 2.2, leaf='paint_blue', frame='concrete_dark')
    e3.stack(q, 11.0, 13.0, 34.0, 2.0, 1.3, 'concrete', puffs=3)
    pipe = [(6.0, 13.0, 16.0), (9.0, 13.0, 16.0), (9.6, 13.0, 16.0)]
    props.pipe_run(q, pipe, 0.6, 'metal')
    cx, cy = 14.0, -8.0
    p.lathe([(6.5, 0.0), (5.2, 6.0), (4.4, 10.0), (4.7, 14.0)], 'concrete_light', T(cx, cy, 0), seg=28)
    p.cyl(4.3, 4.3, 0.1, 'concrete_dark', T(cx, cy, 11.0), seg=24)
    for k in range(10):
        a = k * math.tau / 10
        p.rod((cx + math.cos(a) * 6.5, cy + math.sin(a) * 6.5, 0), (cx + math.cos(a + 0.3) * 6.0,
                                                                     cy + math.sin(a + 0.3) * 6.0, 1.6), 0.15,
              'concrete', seg=4)
    e3.drift(q, cx, cy, 14.6, 2, 2.6)
    for k, (x, y, rr) in enumerate(((-15.0, -14.0, 4.5), (-6.0, -16.0, 3.5), (-18.0, -6.0, 3.0))):
        q.cyl(rr, 0.3, rr * 0.7, 'e3_lignite', T(x, y, rr * 0.35), seg=14)
    m0, m1 = (-9.0, -12.0, 1.0), (-2.0, 3.0, 17.0)
    for s in (-1, 1):
        q.rod((m0[0] + s * 0.8, m0[1], m0[2]), (m1[0] + s * 0.8, m1[1], m1[2]), 0.12, 'iron', seg=4)
        q.rod((m0[0] + s * 0.8, m0[1], m0[2] + 1.6), (m1[0] + s * 0.8, m1[1], m1[2] + 1.6), 0.08, 'iron', seg=4)
    for k in range(8):
        t = k / 7
        x = m0[0] + (m1[0] - m0[0]) * t
        y = m0[1] + (m1[1] - m0[1]) * t
        z = m0[2] + (m1[2] - m0[2]) * t
        q.box((1.8, 0.12, 0.12), 'iron', T(x, y, z + 0.8))
        if k % 2:
            q.box((0.2, 0.2, z), 'iron', T(x, y, z / 2))
    q.rod(m0, m1, 0.5, 'zinc', seg=6)
    sy = (-22.0, -4.0, -8.0, 2.0)
    kit.block(b.yard, sy[0], sy[1], 0, sy[2], sy[3], 0.08, 'gravel')
    props.fence(q, [(sy[0], sy[1]), (sy[2], sy[1]), (sy[2], sy[3]), (sy[0], sy[3]), (sy[0], sy[1])], 2.0, 'steel',
                spacing=0.5)
    for k in range(3):
        x = sy[0] + 2.5 + k * 4.5
        q.box((2.0, 1.6, 2.0), 'grey', T(x, -1.0, 1.0))
        for kk in range(-3, 4):
            q.box((0.08, 1.7, 1.6), 'concrete_dark', T(x + kk * 0.28, -1.0, 1.0))
        for kk in (-0.6, 0.0, 0.6):
            q.cyl(0.07, 0.09, 0.9, 'paint_white', T(x + kk, -1.0, 2.45), seg=6)
        for s in (-1, 1):
            q.box((0.25, 0.25, 7.0), 'steel', T(x + s * 1.6, 1.4, 3.5))
        q.box((3.5, 0.25, 0.25), 'steel', T(x, 1.4, 7.0))
        e3.tangle(q, (x - 1.4, 1.4, 6.9), (x + 3.1, 1.4, 6.9), 3, 0.3)
    b.path(-3.0, -23.9, 3.0, 3.0, 'asphalt', z=0.06)
    service_lot(b)
    for k, (x, y) in enumerate(((22.0, 20.0), (-22.0, 20.0), (22.0, 6.0))):
        props.tree(q, x, y, 7.0, 2.6, 100 + k)


@building('waste', None, 'ศูนย์กำจัดขยะ', 'Landfill and sorting yard')
def waste(b):
    """The town's waste: a landfill of two cells (one capped with grass, one open on its black liner with heaps of
    rubbish), a sorting shed with a ribbed roof and a conveyor, bales of sorted plastic and paper, rows of bins, a
    weighbridge with its booth, a leachate pond, a wall and a gate."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    rnd = props._rng(7)
    kit.hull(p, [(-22.0, 2.0, 0), (-4.0, 2.0, 0), (-4.0, 22.0, 0), (-22.0, 22.0, 0),
                 (-18.0, 6.0, 4.0), (-8.0, 6.0, 4.0), (-8.0, 18.0, 4.0), (-18.0, 18.0, 4.0)], 'dirt_dark')
    kit.block(p, -17.8, 6.2, 3.95, -8.2, 17.8, 4.05, 'grass')
    for k in range(4):
        p.cyl(0.08, 0.08, 1.2, 'iron', T(-16.0 + k * 2.6, 10.0 + (k % 2) * 3.0, 4.6), seg=6)
    cell = (-22.0, -18.0, -4.0, -1.0)
    kit.block(b.yard, cell[0], cell[1], 0, cell[2], cell[3], 0.08, 'e3_liner')
    for side in ((cell[0], cell[1], cell[2], cell[1] + 1.0), (cell[0], cell[3] - 1.0, cell[2], cell[3]),
                 (cell[0], cell[1], cell[0] + 1.0, cell[3]), (cell[2] - 1.0, cell[1], cell[2], cell[3])):
        kit.block(p, *side[:2], 0, *side[2:], 1.4, 'dirt_dark', bevel=0.2)
    for k in range(9):
        x = -19.0 + (k % 3) * 5.0 + rnd() * 2
        y = -15.0 + (k // 3) * 4.5 + rnd() * 2
        q.cap(1.6 + rnd(), 'dirt_dark' if k % 3 else 'grey', T(x, y, 0) @ S(1.3, 1, 0.5),
              keep=lambda co: co.z >= -0.01, seg=10, rings=6, smooth=False)
        for kk in range(4):
            q.box((0.5, 0.4, 0.3), ('paint_blue', 'paint_white', 'paint_yellow', 'paint_red', 'canvas')[(k + kk) % 5],
                  T(x + rnd() * 2 - 1, y + rnd() * 2 - 1, 0.5 + rnd() * 0.4) @ R(0, 0, rnd() * 90))
    sh = (3.0, 2.0, 21.0, 14.0)
    for i in range(7):
        x = sh[0] + (sh[2] - sh[0]) * i / 6
        for y in (sh[1], sh[3]):
            kit.block(p, x - 0.15, y - 0.15, 0, x + 0.15, y + 0.15, 6.0, 'steel')
    ridge = kit.gable_ribbed(p, sh, 6.0, 2.0, 'zinc', 'zinc_dark', over=0.6, over_ends=0.4, axis='x')
    kit.block(b.yard, sh[0], sh[1], 0, sh[2], sh[3], 0.1, 'concrete')
    e3.ribbed_walls(p, (sh[0], sh[3] - 0.15, sh[2], sh[3]), 0, 6.0, 'zinc', 'zinc_dark', 0.7, ('front',))
    kit.block(p, 5.0, 7.5, 0, 19.0, 8.5, 1.0, 'iron')
    kit.block(p, 5.0, 7.6, 1.0, 19.0, 8.4, 1.1, 'black')
    for k in range(12):
        q.box((0.4, 0.4, 0.2), ('paint_blue', 'paint_white', 'paint_yellow', 'canvas')[k % 4],
              T(5.6 + k * 1.15, 8.0, 1.2))
    kit.block(p, 4.0, 6.0, 0, 6.0, 10.0, 3.0, 'paint_yellow')
    for x in range(6):
        for z in range(2):
            kit.block(q, 4.0 + x * 1.3, -2.0 - (x % 2) * 0.2, z * 1.0, 5.1 + x * 1.3, -0.9, z * 1.0 + 0.95,
                      ('paint_blue', 'cream', 'paint_green', 'paint_white', 'canvas', 'paint_yellow')[(x + z) % 6],
                      bevel=0.05)
    for k in range(8):
        e3.wheelie_bin(q, 12.0 + k * 0.8, -1.5, ('paint_green', 'paint_yellow', 'paint_blue', 'paint_red')[k % 4])
    wb = (6.0, -18.0, 16.0, -14.0)
    kit.block(p, wb[0], wb[1], 0, wb[2], wb[3], 0.25, 'iron')
    kit.block(p, wb[0] + 0.1, wb[1] + 0.1, 0.25, wb[2] - 0.1, wb[3] - 0.1, 0.3, 'concrete_dark')
    e3.guard_booth(b.main, 18.5, -16.0)
    pr.water_pond(b.yard, 10.0, 17.0, 21.0, 22.0)
    b.path(-3.0, -23.9, 3.0, 2.0, 'asphalt', z=0.06)
    b.path(3.0, -18.0, 16.0, -14.0, 'asphalt', z=0.05)
    service_lot(b, booth=False)
    for k, (x, y) in enumerate(((22.0, -6.0), (-1.0, 21.0), (22.0, 6.0))):
        props.tree(q, x, y, 7.0, 2.6, 110 + k)
    regions.border(b, 22.0, 6.0, 5, sides=('right',))
    e3.pole(q, 22.6, -22.6, 9.5, transformer=True)


@building('station', None, 'สถานีรถไฟ', 'Railway station')
def station(b):
    """A concrete railway station: the station building under the region's roof with ticket windows and a gabled
    porch, a long platform under a canopy of steel posts, two metre-gauge tracks, a signal, benches, the name board
    on posts (no lettering), the flag and the forecourt."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    wall = regions.plaster(r, 0)
    rm = roof_of(b)
    track_y = (15.0, 20.0)
    for y in track_y:
        e3.track(b, -23.9, 23.9, y)
    plat = (-22.0, 8.6, 22.0, 13.0)
    kit.block(p, plat[0], plat[1], 0, plat[2], plat[3], 0.9, 'concrete_light')
    kit.block(p, plat[0], plat[3] - 0.4, 0.88, plat[2], plat[3], 0.92, 'paint_yellow')
    for k in range(9):
        x = -18.0 + k * 4.5
        kit.block(p, x - 0.1, 11.2, 0.9, x + 0.1, 11.4, 4.6, 'steel')
    can = (-20.0, 9.2, 20.0, 12.8)
    regions.house_roof(p, can, 4.6, r, mat=rm, axis='x', over=0.5, over_ends=0.4, pitch=0.35, fill='steel',
                       courses=3)
    bld = (-13.0, 1.0, 13.0, 8.6)
    e3.wing_block(b, bld, 1, storey=4.6, i=0, pitch=0.6, roof_kind=rm, door_us=(0.0,), count=6, wall=wall)
    for u in (-4.0, -2.4):
        kit.on_face(p, bld, 'front', u, 1.0, 1.0, 0.8, 0.08, 'window_dark')
        kit.on_face(p, bld, 'front', u, 0.95, 1.2, 0.08, 0.3, 'concrete_light')
    portico(b, (-3.0, -2.6, 3.0, 1.0), 4.6, r, rm, 2, wall)
    q.cyl(0.45, 0.45, 0.1, 'paint_white', T(0, -2.7, 5.9) @ R(90, 0, 0), seg=16)
    q.torus(0.45, 0.04, 'iron', T(0, -2.76, 5.9) @ R(90, 0, 0), seg=16, seg_minor=4)
    q.box((0.03, 0.02, 0.3), 'iron', T(0, -2.8, 6.0))
    q.box((0.22, 0.02, 0.03), 'iron', T(0.1, -2.8, 5.9))
    for x in (-20.5, 20.5):
        for s in (-1, 1):
            q.box((0.1, 0.1, 2.6), 'iron', T(x + s * 1.0, 10.0, 0.9 + 1.3))
        q.box((2.4, 0.08, 0.6), 'paint_white', T(x, 10.0, 3.2))
        q.box((1.8, 0.1, 0.16), 'sign_text', T(x, 9.95, 3.2))
    for k in range(6):
        props.bench(q, -15.0 + k * 6.0, 9.6, 2.0, 0)
    q.box((0.25, 0.25, 6.0), 'iron', T(22.5, 17.5, 3.0))
    q.box((0.5, 0.3, 1.2), 'black', T(22.5, 17.3, 5.6))
    q.sphere(0.12, 'red_light', T(22.5, 17.1, 5.9), seg=8, rings=4)
    q.sphere(0.12, 'paint_green', T(22.5, 17.1, 5.4), seg=8, rings=4)
    b.path(-14.0, -14.0, 14.0, 1.0, 'paving', z=0.07)
    flag_base(b, -9.0, -8.0, 11.0)
    for x in (-6.0, 6.0):
        props.street_lamp(q, x, -10.0, 6.0, 0)
    e3.scooter_shed(b.main, (6.0, -12.0, 14.0, -9.6), 2.4)
    e3.food_cart(q, -2.0, -11.0, 0, regions.awning_colours(r)[0])
    for k in range(2):
        e3.vending(q, 9.0 + k * 1.1, 0.4, 0, ('paint_red', 'paint_blue')[k])
    e3.lot_wall(b, 23.3, gates=((0.0, 14.0),), h=1.6, front_h=0.9, sides=('left', 'right'))
    for k, (x, y) in enumerate(((-20.0, -20.0), (20.0, -20.0), (-20.0, -4.0), (20.0, -4.0))):
        regions.plant(b, x, y, k)
    regions.craft(b, -16.0, -12.0)
    e3.pole(q, -22.6, -22.6, 9.5, transformer=True)
    e3.pole(q, 22.6, -22.6, 9.5)


@building('market', None, 'ตลาดสด', 'Fresh market hall')
def market(b):
    """The fresh market (ตลาดสด): a long hall of steel posts under a ribbed roof with a raised clerestory, rows of
    tiled stall counters heaped with goods under hanging lamps, a row of shop stalls at the back, umbrellas, food
    carts and tables in front, a car park, poles and wires, and the concrete drain."""
    yard(b)
    r = b.region
    p = b.main
    q = b.props
    hall = (-20.0, -4.0, 20.0, 16.0)
    x0, y0, x1, y1 = hall
    kit.block(b.yard, x0, y0, 0, x1, y1, 0.12, 'concrete')
    for i in range(9):
        x = x0 + (x1 - x0) * i / 8
        for y in (y0, (y0 + y1) / 2 - 3.0, (y0 + y1) / 2 + 3.0, y1):
            kit.block(p, x - 0.15, y - 0.15, 0, x + 0.15, y + 0.15, 6.0 if y in (y0, y1) else 8.0, 'steel')
    rm = 'zinc' if r != 'south' else 'roof_blue'
    lm = 'zinc_dark' if r != 'south' else 'paint_blue'
    kit.gable_ribbed(p, hall, 6.0, 2.6, rm, lm, over=0.8, over_ends=0.6, axis='x', pitch=0.8)
    cl = (x0 + 1.0, 3.0, x1 - 1.0, 9.0)
    kit.block(p, cl[0], cl[1], 8.6 - 0.05, cl[2], cl[3], 9.4, 'concrete_dark')
    for k in range(int((cl[2] - cl[0]) / 0.5)):
        for y in (cl[1], cl[3]):
            kit.block(p, cl[0] + k * 0.5, y - 0.05, 8.65, cl[0] + k * 0.5 + 0.3, y + 0.05, 9.35, 'zinc')
    kit.gable_ribbed(p, cl, 9.4, 1.2, rm, lm, over=0.6, over_ends=0.4, axis='x', pitch=0.8)
    for y in (0.0, 4.5, 9.0, 13.0):
        for k in range(5):
            x = -16.0 + k * 7.0
            kit.block(p, x - 2.6, y - 0.6, 0, x + 2.6, y + 0.6, 0.85, 'e3_tile')
            kit.block(p, x - 2.7, y - 0.7, 0.85, x + 2.7, y + 0.7, 0.92, 'paint_white')
            for kk in range(5):
                c = ('leaf', 'paint_red', 'paint_orange', 'leaf_light', 'banana_fruit', 'cream')[(k + kk + int(y)) % 6]
                q.sphere(0.32, c, T(x - 2.0 + kk * 1.0, y, 1.0) @ S(1.2, 1, 0.5), seg=8, rings=4)
            q.rod((x, y, 6.5), (x, y, 2.8), 0.008, 'cable', seg=3)
            q.cyl(0.2, 0.08, 0.2, 'paint_white', T(x, y, 2.7), seg=8)
            q.sphere(0.07, 'lamp', T(x, y, 2.6), seg=6, rings=3)
    back = (-20.0, 16.0, 20.0, 21.0)
    kit.block(p, back[0], back[1], 0, back[2], back[3], 3.6, regions.plaster(r, 1))
    for k in range(8):
        u = -17.5 + k * 5.0
        kit.roller_shutter(p, back, 'front', u, 0, 3.6, 2.8, 'roller', 0.9 if k % 3 else 0.2)
        e3.shop_interior(p, back, 'front', u, 0, 3.6, 2.5, goods=k % 3 != 0)
    e3.flat_roof(p, back, 3.6, 'concrete', parapet=0.6, parapet_mat=regions.plaster(r, 1),
                  coping=e3.band_mat(r))
    for k in range(5):
        props.water_tank(q, -16.0 + k * 8.0, 20.0, 3.85, 'stainless' if k % 2 else 'plastic', stand=0.8)
    if r != 'south':
        e3.front_gable(p, r, -5.0, 5.0, y0 - 0.6, 6.4, 2.0)
    for k, x in enumerate((-18.0, -12.0, 12.0, 18.0)):
        props.umbrella(q, x, -8.0, 1.5, 2.4, 'awning_red' if k % 2 else 'awning_blue', 'awning_white')
        props.table_stall(q, x, -8.0, 2.0, 0.9, goods=('paint_red', 'leaf', 'banana_fruit'))
    for x in (-6.0, 6.0):
        e3.food_cart(q, x, -9.0, 0, regions.awning_colours(r)[0])
        e3.table_set(q, x, -12.5, 4)
    b.path(-23.9, -23.9, 23.9, -4.0, 'asphalt', z=0.05)
    e3.parking_lines(b, -22.0, -22.0, -4.0, -16.0, 7)
    e3.parking_lines(b, 4.0, -22.0, 22.0, -16.0, 7)
    e3.drain(b, 21.6, -23.9, 23.6, 23.9, crossings=(-10.0,))
    for k in range(4):
        e3.wheelie_bin(q, -22.5, -2.0 + k * 0.8, ('paint_green', 'paint_yellow', 'paint_blue', 'paint_green')[k])
    e3.pole(q, -22.8, -23.0, 9.5, transformer=True)
    e3.pole(q, 0.0, -23.0, 9.5, lamp=True)
    e3.pole(q, 20.8, -23.0, 9.5, lamp=True)
    e3.tangle(q, (-22.8, -23.0, 9.0), (0.0, -23.0, 9.0), 4, 0.6)
    e3.tangle(q, (0.0, -23.0, 9.0), (20.8, -23.0, 9.0), 4, 0.6)
    for k, (x, y) in enumerate(((-22.5, 20.0), (-22.5, 8.0))):
        regions.plant(b, x, y, k)
    regions.craft(b, 14.0, -13.0)
