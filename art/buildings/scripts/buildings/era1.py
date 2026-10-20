# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 1, the farming village (assets/concept/era1_A_house.jpg, era1_B_town.jpg): teak houses on stilts under
steep thatch, open decks and ladders, jars, spirit houses, banana and coconut, rice barns and buffalo, dirt yards.
Every building is dressed by region (lib/regions.py). True sizes (PLAN.md)."""

from lib import houses, kit, props, regions
from lib import props_region as pr
from lib import props_work as pw
from lib.builder import registry
from lib.mesh import R, S, T

BUILDINGS, building = registry(1)


def yard(b):
    b.ground(regions.ground_mat(b.region, b.era))


def path_mat(b):
    return 'dirt_dark' if b.region == 'northeast' else 'paving'


# homes ---------------------------------------------------------------------------------------------------------------

@building('home_1', 1, 'กระต๊อบ', 'Bamboo hut')
def home_1(b):
    """A one-room bamboo hut on low posts, a short flight up to its door, a garden round it."""
    yard(b)
    houses.stilt_house(b, 0.5, 2.0, 4.2, 3.4, floor_z=1.3, wall_h=2.2, thatch=True, wood='bamboo',
                       posts_every=2.1, axis='x')
    props.water_jar(b.props, -2.6, 0.2, 0.9)
    props.woodpile(b.props, 3.6, 4.6)
    regions.plant(b, -5.4, 4.8, 1)
    regions.plant(b, 5.6, -4.8, 2, big=False)
    regions.plant(b, -5.6, -5.2, 3)
    props.bush(b.props, 4.8, -2.0, 0.5, 7)
    b.path(-0.6, -7.9, 0.6, 0.3, path_mat(b), z=0.05)


@building('home_2', 2, 'เรือนไม้ใต้ถุนสูง', 'Teak house on stilts')
def home_2(b):
    """The concept's house: rooms on tall posts, an open deck with stairs, the region's roof in thatch, a spirit
    house, a buffalo in the shade, jars and banana."""
    yard(b)
    if b.region == 'west':
        # the west's floating house (เรือนแพ): on a bamboo raft moored in the water, a boat alongside
        pr.water_pond(b.yard, -7.6, -2.5, 7.6, 7.6)
        pr.raft(b.main, -5.0, 0.0, 5.5, 6.5, 0.12)
        info = houses.stilt_house(b, -1.6, 3.2, 5.6, 4.0, floor_z=0.75, wall_h=2.4, thatch=True,
                                  deck=('right', 2.6), posts_every=2.0, stairs=False)
        pr.boat(b.props, -2.0, -1.4, 4.2, facing=0)
        for x in (-5.4, 5.9):
            b.props.cyl(0.12, 0.12, 2.0, 'teak_dark', T(x, -0.3, 0.6), seg=8)
        pr.orchid_hanging(b.props, 3.0, 1.4, 3.2)
        props.hammock(b.props, (2.0, 0.6, 1.9), (5.2, 0.6, 1.9), 0.4)
        b.path(-0.6, -7.9, 0.6, -2.5, 'paving', z=0.05)
        regions.plant(b, 6.0, -5.5, 1)
        regions.plant(b, -6.0, -5.5, 2)
        return
    info = houses.stilt_house(b, -1.2, 1.6, 6.0, 4.4, floor_z=2.4, wall_h=2.5, thatch=True,
                              deck=('right', 3.0), posts_every=2.0)
    x0, y0, x1, y1 = info['rect']
    regions.under_house(b, -1.8, 1.4)
    props.buffalo(b.props, -3.2, -2.6, facing=15)
    props.hammock(b.props, (x0, y0, 1.6), (x0 + 2.0, y0, 1.6), 0.5)
    props.spirit_house(b.props, -5.2, -5.0, facing=0)
    props.water_jar(b.props, 4.6, -1.6, 1.0)
    regions.plant(b, 5.6, 4.6, 1)
    regions.plant(b, 6.0, -5.6, 4, big=False)
    regions.craft(b, 1.0, -5.6)
    b.path(1.4, -7.9, 2.6, y0 - 1.0, path_mat(b), z=0.05)


@building('home_3', 3, 'เรือนแฝด', 'Twin house with a shared deck')
def home_3(b):
    """Two houses on posts joined by an open deck (ชาน): the sleeping house and the kitchen house, a rice barn."""
    yard(b)
    main = houses.stilt_house(b, -3.2, 2.6, 5.4, 4.2, floor_z=2.4, wall_h=2.5, thatch=True, deck=('right', 3.4),
                              stair_at=1.9)
    kx0 = main['deck'][2]
    houses.stilt_house(b, kx0 + 1.6, 3.2, 3.2, 3.0, floor_z=2.05, wall_h=2.2, thatch=True, stairs=False,
                       door_side='left', axis='x' if b.region != 'northeast' else 'y')
    pw.rice_barn(b, -4.2, -4.4, 2.8, 2.2)
    props.spirit_house(b.props, 5.8, -5.6)
    props.water_jar(b.props, 3.2, -0.6, 1.0)
    props.water_jar(b.props, 4.2, -0.4, 0.8)
    regions.under_house(b, -3.0, 2.0)
    regions.plant(b, 6.2, 6.2, 1)
    regions.plant(b, -6.6, 6.4, 2)
    regions.craft(b, 0.4, -5.8)
    b.path(1.3, -7.9, 2.5, -0.2, path_mat(b), z=0.05)


@building('home_4', 4, 'เรือนหลังใหญ่มีรั้ว', 'Large house in a fenced yard')
def home_4(b):
    """A big house with a front deck and a kitchen house beside it, a rice barn, haystacks, a fence and a gate."""
    yard(b)
    r = b.region
    p = b.props
    main = houses.stilt_house(b, -1.5, 3.0, 7.6, 4.8, floor_z=2.5, wall_h=2.6, thatch=True, deck=('front', 2.4),
                              stair_at=-3.4, posts_every=2.5)
    houses.stilt_house(b, 4.9, 4.2, 3.2, 3.4, floor_z=2.2, wall_h=2.2, thatch=True, stairs=False, door_side='left')
    kit.floor_deck(b.main, (2.3, 2.6, 3.3, 3.8), 2.15, 'plank', 0.1, edge='teak_dark')
    pw.rice_barn(b, 4.6, -3.0, 2.6, 2.2)
    props.haystack(p, 6.0, -6.0, 0.9, 1.7)
    props.haystack(p, 4.4, -6.3, 0.75, 1.4)
    e = 7.6
    gate = 1.6
    props.fence(p, [(-gate / 2 - 3.4, -e), (-e, -e), (-e, e), (e, e), (e, -e), (gate / 2 - 3.4, -e)], 1.1,
                'bamboo' if r != 'north' else 'teak', spacing=0.24)
    for s in (-1, 1):
        p.box((0.16, 0.16, 1.6), 'teak_dark', T(-3.4 + s * gate / 2, -e, 0.8))
    props.spirit_house(p, -6.4, -5.8)
    regions.under_house(b, -1.0, 3.4)
    props.buffalo(p, -5.2, 0.6, facing=-40)
    regions.plant(b, -6.4, 6.4, 1)
    regions.plant(b, 6.6, 0.4, 3, big=False)
    regions.craft(b, 0.6, -5.8)
    b.path(-4.0, -7.9, -2.8, main['deck'][1] - 1.8, path_mat(b), z=0.05)


@building('home_5', 5, 'เรือนหมู่', 'House cluster round a deck')
def home_5(b):
    """A family's cluster of houses round one big deck (เรือนหมู่), a rice barn, a buffalo pen, haystacks, a paddy
    and a pond with a landing, all inside a fence: the village's top home on a joined lot (31 m)."""
    yard(b)
    r = b.region
    p = b.props
    deck = (-6.0, 1.0, 4.0, 7.0)
    kit.stilts(b.main, deck, 2.1, 6, 4, regions.style(r)['trim'], 0.18, 'stone')
    kit.floor_deck(b.main, deck, 2.1, 'plank', 0.12, edge='teak_dark', boards=30, board_mat='teak_dark')
    kit.railing(b.main, [(-6.0, 1.0), (-6.0, 3.0)], 2.1, 'teak_dark')
    houses.stilt_house(b, -1.0, 10.0, 8.0, 5.0, floor_z=2.45, wall_h=2.6, thatch=True, stairs=False,
                       door_side='front', posts_every=2.6)
    houses.stilt_house(b, -9.2, 4.0, 4.6, 4.8, floor_z=2.45, wall_h=2.5, thatch=True, stairs=False,
                       door_side='right', axis='y')
    houses.stilt_house(b, 7.2, 4.0, 4.4, 4.6, floor_z=2.45, wall_h=2.4, thatch=True, stairs=False,
                       door_side='left', axis='y')
    houses.stair_flight(b.main, -1.0, 1.0, 2.1, 1.3, '-y', 'teak', rail='teak_dark')
    pw.rice_barn(b, 11.5, 11.5, 3.4, 2.8)
    pw.buffalo_pen(b, 6.0, -14.0, 14.5, -7.5, 3)
    props.haystack(p, 12.6, -4.5, 1.0, 2.0)
    props.haystack(p, 10.4, -4.0, 0.8, 1.6)
    props.rice_field(b.yard, -14.5, -14.5, -6.5, -6.0)
    pr.water_pond(b.yard, -14.5, -3.5, -9.0, 0.5)
    pr.jetty(p, -11.0, -1.4, -9.2, 0.2, 0.4)
    pr.boat(p, -12.4, -2.2, 3.6, facing=10)
    props.spirit_house(p, 2.5, -4.5)
    pw.well(p, -3.0, -4.0, 0.8, roof_mat='thatch')
    props.water_jar(p, 3.6, 0.0)
    props.water_jar(p, 4.6, 0.3, 0.85)
    e = 15.6
    props.fence(p, [(-2.0, -e), (-e, -e), (-e, e), (e, e), (e, -e), (1.0, -e)], 1.1,
                'bamboo' if r != 'north' else 'teak', spacing=0.26)
    for s in (-2.0, 1.0):
        p.box((0.18, 0.18, 1.7), 'teak_dark', T(s, -e, 0.85))
    for k, (x, y) in enumerate(((-13.5, 13.0), (13.5, 3.0), (-13.5, 7.0), (0.0, 14.0))):
        regions.plant(b, x, y, k + 1)
    if r in ('central', 'south', 'east', 'west'):
        props.coconut(p, 14.0, -1.5, 10.0, seed=3)
    else:
        props.tree(p, 14.0, -1.5, 6.5, 2.5, 3)
    regions.under_house(b, -1.0, 10.0)
    regions.craft(b, -5.0, -8.5)
    b.path(-1.6, -15.9, 0.6, 1.0, path_mat(b), z=0.05)


# shops ---------------------------------------------------------------------------------------------------------------

@building('shop_1', 1, 'เพิงขายของริมทาง', 'Roadside stall')
def shop_1(b):
    """A thatched lean-to by the road with tables of produce, bananas hanging, sacks and a bench."""
    yard(b)
    p = b.main
    rect = (-3.0, -5.0, 3.0, -1.6)
    houses.open_shed(p, rect, 2.3, 'thatch', posts_mat='bamboo', low_side='front', rise=0.9)
    props.table_stall(b.props, -1.2, -3.6, 2.2, 0.9)
    props.table_stall(b.props, 1.6, -3.4, 1.4, 0.8, goods=('banana_fruit', 'flower_red'))
    props.bench(b.props, 0.0, -1.9, 1.8)
    props.sacks(b.props, -2.4, -2.2, 3)
    for x in (-2.0, -0.5, 1.0, 2.4):
        b.props.rod((x, -4.9, 2.3), (x, -4.9, 1.8), 0.01, 'rope', seg=3)
        b.props.cyl(0.12, 0.06, 0.4, 'banana_fruit', T(x, -4.9, 1.6), seg=6)
    houses.stilt_house(b, 1.5, 4.0, 4.0, 3.2, floor_z=1.4, wall_h=2.2, thatch=True, wood='bamboo')
    regions.craft(b, -5.0, -5.6)
    regions.plant(b, -5.6, 4.5, 1)
    regions.plant(b, 6.0, -5.5, 2, big=False)


@building('shop_2', 2, 'ร้านชำไม้', 'Timber village shop')
def shop_2(b):
    """A one-storey timber shop on a low plinth: folding plank doors open on its counter and shelves, a hand-painted
    sign (no brands), jars and sacks in front, the shopkeeper's hut behind."""
    yard(b)
    r = b.region
    st = regions.style(r)
    p = b.main
    rect = (-3.4, -4.2, 3.4, 0.6)
    kit.block(p, rect[0] - 0.3, rect[1] - 1.4, 0, rect[2] + 0.3, rect[3] + 0.3, 0.45,
              'stone' if r == 'south' else 'plank', bevel=0.02)
    regions.house_walls(p, rect, 0.45, 3.4, r)
    kit.folding_doors(p, rect, 'front', -0.4, 0.45, 4.2, 2.4, leaf=st['shutter'], frame=st['trim'], open_=0.6)
    kit.block(p, -2.0, -3.7, 0.45, 1.2, -3.2, 1.4, 'teak')
    for z in (1.0, 1.6, 2.2):
        kit.block(p, -3.1, 0.1, 0.45 + z, 3.1, 0.45, 0.5 + z, 'teak_light')
        for i in range(10):
            p.box((0.25, 0.25, 0.3), ('paint_red', 'paint_yellow', 'cream', 'paint_green')[i % 4],
                  T(-2.8 + i * 0.6, 0.25, 0.67 + z))
    regions.house_window(p, rect, 'left', 0, 1.4, r)
    regions.house_window(p, rect, 'right', 0, 1.4, r)
    regions.house_roof(p, rect, 3.4, r, None, axis='x', over=1.4, thatch=True)
    props.sign_board(b.props, rect, 'front', 0, 3.0, 3.2, 0.55, 'sign_cream', 'teak_dark', out=0.25)
    props.sacks(b.props, 2.2, -5.6, 4)
    props.water_jar(b.props, -3.0, -5.4, 0.8)
    props.bench(b.props, -1.0, -6.0, 1.6)
    houses.stilt_house(b, 3.2, 4.8, 3.6, 3.0, floor_z=1.6, wall_h=2.2, thatch=True)
    regions.plant(b, -5.8, 5.0, 1)
    regions.plant(b, 6.4, -1.8, 3, big=False)
    regions.craft(b, -6.0, 1.4)


@building('shop_3', 3, 'ศาลาตลาด', 'Market pavilion')
def shop_3(b):
    """An open thatched pavilion with rows of produce tables, a small store hut and a shade tree."""
    yard(b)
    rect = (-5.5, -5.0, 3.5, 0.5)
    houses.pavilion(b.main, rect, 0.35, 2.6, b.region, None, thatch=True, wood='teak', floor_mat='plank')
    for x in (-4.0, -1.0, 2.0):
        props.table_stall(b.props, x, -3.2, 2.0, 0.9)
        props.table_stall(b.props, x, -1.2, 2.0, 0.9, goods=('banana_fruit', 'leaf_light', 'paint_orange'))
    props.sacks(b.props, -4.6, -6.6, 3)
    props.water_jar(b.props, 2.6, -6.2, 0.8)
    houses.stilt_house(b, 3.5, 4.5, 3.6, 3.0, floor_z=1.2, wall_h=2.2, thatch=True, wood='bamboo')
    props.tree(b.props, -5.4, 4.8, 7.0, 2.8, 9)
    regions.craft(b, 5.0, -5.6)
    regions.plant(b, 6.2, 0.6, 2, big=False)


@building('shop_4', 4, 'โรงค้าข้าว', 'Rice trader')
def shop_4(b):
    """A rice trader's timber storehouse with big doors open on stacked sacks, a weighing beam, an ox cart, and the
    trader's house on posts."""
    yard(b)
    r = b.region
    st = regions.style(r)
    p = b.main
    rect = (-6.0, -3.6, 2.4, 2.4)
    kit.block(p, rect[0] - 0.2, rect[1] - 0.2, 0, rect[2] + 0.2, rect[3] + 0.2, 0.6, 'stone')
    kit.plank_walls(p, rect, 0.6, 4.2, 'plank', st['trim'], board=0.22, posts_mat=st['trim'])
    kit.folding_doors(p, rect, 'front', -1.8, 0.6, 3.4, 2.9, leaf='plank', frame=st['trim'], open_=0.7)
    regions.house_roof(p, rect, 4.2, r, None, axis='x', over=1.0, thatch=True)
    for i in range(6):
        b.props.sphere(0.36, 'canvas', T(-3.0 + (i % 3) * 0.7, -2.6 + (i // 3) * 0.5, 0.8 + (i // 3) * 0.35)
                       @ S(1, 0.7, 0.55), seg=8, rings=5)
    props.sacks(b.props, 0.4, -5.0, 6)
    b.props.box((0.12, 0.12, 2.0), 'teak_dark', T(1.6, -6.0, 1.0))
    b.props.box((1.6, 0.08, 0.08), 'teak_dark', T(1.6, -6.0, 2.0))
    for s in (-1, 1):
        b.props.rod((1.6 + s * 0.75, -6.0, 2.0), (1.6 + s * 0.75, -6.0, 1.3), 0.01, 'rope', seg=3)
        b.props.cyl(0.25, 0.25, 0.05, 'metal', T(1.6 + s * 0.75, -6.0, 1.28), seg=10)
    pw.ox_cart(b.props, -4.4, -6.2, facing=-10)
    houses.stilt_house(b, 4.8, 3.6, 3.8, 3.4, floor_z=2.2, wall_h=2.3, thatch=True, axis='y')
    regions.plant(b, -6.4, 5.8, 1)
    regions.plant(b, 6.6, -4.5, 2, big=False)
    regions.craft(b, -1.0, 5.6)


@building('shop_5', 5, 'ตลาดหมู่บ้าน', 'Village market')
def shop_5(b):
    """The village market on a joined lot: three thatched pavilions round a yard of stalls, a well, a big shade
    tree, a store barn and a landing on a pond."""
    yard(b)
    r = b.region
    p = b.props
    houses.pavilion(b.main, (-14.5, -5.0, -3.5, 1.5), 0.4, 2.7, r, None, thatch=True)
    houses.pavilion(b.main, (2.0, -5.0, 14.5, 1.5), 0.4, 2.7, r, None, thatch=True)
    houses.pavilion(b.main, (-8.0, 6.0, 8.0, 12.5), 0.4, 2.9, r, None, thatch=True)
    for x in (-12.5, -9.5, -6.5):
        for y in (-3.4, -0.6):
            props.table_stall(p, x, y, 2.0, 0.9)
    for x in (4.0, 7.0, 10.0, 13.0):
        for y in (-3.4, -0.6):
            props.table_stall(p, x, y, 2.0, 0.9, goods=('banana_fruit', 'leaf_light', 'paint_orange'))
    for x in (-5.5, -2.5, 0.5, 3.5, 6.5):
        props.table_stall(p, x, 9.2, 2.2, 1.0, goods=('flower_red', 'cream', 'leaf'))
    for x in (-10.0, -6.0, 6.0, 10.0):
        props.table_stall(p, x, -10.5, 1.8, 0.9)
        props.sacks(p, x + 1.4, -11.8, 2)
    pw.well(p, 0.0, -2.0, 0.85)
    props.tree(p, 0.0, -9.0, 8.0, 3.2, 12)
    pw.rice_barn(b, 12.0, 11.5, 3.6, 3.0)
    pr.water_pond(b.yard, -15.4, 8.0, -10.0, 15.4)
    pr.jetty(p, -12.0, 9.0, -10.0, 11.0, 0.4)
    pr.boat(p, -13.4, 12.5, 3.6, facing=80)
    pw.ox_cart(p, 12.6, -13.6, facing=180)
    for k, (x, y) in enumerate(((-14.0, -14.0), (14.0, 4.0), (-14.0, 4.0))):
        regions.plant(b, x, y, k + 1)
    regions.craft(b, 9.0, 4.0)
    props.spirit_house(p, -1.5, 14.6)


# workshops -------------------------------------------------------------------------------------------------------------

@building('factory_1', 1, 'โรงทอผ้า', 'Weaving shed')
def factory_1(b):
    """An open thatched shed with two looms, dye barrels and cloth drying on lines."""
    yard(b)
    rect = (-5.0, -3.0, 2.0, 2.0)
    houses.pavilion(b.main, rect, 0.2, 2.5, b.region, None, thatch=True, floor_mat='plank')
    pr.loom(b.props, -3.2, -0.4)
    pr.loom(b.props, 0.2, -0.4)
    for i, c in enumerate(('silk', 'paint_red', 'paint_blue', 'paint_yellow')):
        props.barrel(b.props, -4.2 + i * 1.0, -5.0, c, 0.6)
    pw.cloth_line(b.props, 3.4, -6.0, 6.6, -2.0)
    pw.cloth_line(b.props, 3.4, -1.0, 6.6, 3.0, cloths=('cream', 'silk', 'paint_green'))
    pw.kiln(b.props, -4.2, 5.2, 0.9, chimney=False)
    houses.stilt_house(b, 3.8, 5.0, 3.4, 2.8, floor_z=1.6, wall_h=2.2, thatch=True, wood='bamboo')
    regions.plant(b, -6.4, -6.4, 2, big=False)
    regions.plant(b, 6.6, -6.6, 1)


@building('factory_2', 2, 'โรงปั้นหม้อ', 'Pottery and kiln')
def factory_2(b):
    """A potter's yard: a brick kiln, a thatched drying shed with rows of pots, a clay heap and a woodpile."""
    yard(b)
    pw.kiln(b.main, -3.0, 3.2, 1.9)
    houses.open_shed(b.main, (0.5, -5.0, 6.5, 0.5), 2.4, 'thatch', posts_mat='teak', low_side='front', rise=1.0)
    pw.pot_rows(b.props, 1.4, -4.0, 5, 3, 0.6)
    b.props.cap(1.2, 'clay_pot', T(-4.0, -4.0, 0) @ S(1.3, 1, 0.5), keep=lambda co: co.z >= -0.01, seg=10, rings=6)
    props.woodpile(b.props, -6.0, 0.0, 2.0, 3)
    props.woodpile(b.props, -6.0, -1.4, 2.0, 2)
    b.props.box((1.6, 0.8, 0.1), 'plank', T(-1.0, -1.6, 0.75))
    for sx in (-0.7, 0.7):
        b.props.box((0.08, 0.6, 0.75), 'teak_dark', T(-1.0 + sx, -1.6, 0.37))
    regions.plant(b, 6.4, 5.6, 1)
    regions.plant(b, -6.4, -6.6, 3, big=False)
    regions.craft(b, 2.5, 5.6)


@building('factory_3', 3, 'โรงตำข้าว', 'Rice pounding mill')
def factory_3(b):
    """A thatched mill house where rice is pounded and winnowed: foot pounders, sacks, haystacks, an ox cart."""
    yard(b)
    r = b.region
    st = regions.style(r)
    p = b.main
    rect = (-5.6, -2.4, 2.2, 3.6)
    kit.block(p, rect[0], rect[1], 0, rect[2], rect[3], 0.3, 'plank')
    for x in (rect[0], rect[2]):
        for y in (rect[1], rect[3], (rect[1] + rect[3]) / 2):
            kit.block(p, x - 0.12, y - 0.12, 0.3, x + 0.12, y + 0.12, 3.0, st['trim'])
    kit.plank_walls(p, (rect[0], rect[3] - 0.2, rect[2], rect[3]), 0.3, 3.0, 'plank', st['trim'], sides=('front',))
    regions.house_roof(p, rect, 3.0, r, None, axis='x', over=1.0, thatch=True)
    pw.stamp_mill(b.props, -4.4, 0.0)
    pw.stamp_mill(b.props, -4.4, 1.8)
    props.sacks(b.props, -0.6, -0.4, 6)
    b.props.cyl(0.55, 0.4, 0.15, 'straw', T(0.2, 2.2, 0.4), seg=12)
    props.haystack(b.props, 5.0, 4.6, 1.1, 2.2)
    props.haystack(b.props, 5.6, 1.6, 0.9, 1.8)
    pw.ox_cart(b.props, 3.0, -4.8, facing=170)
    regions.plant(b, -6.2, 6.0, 1)
    regions.plant(b, 6.5, -6.4, 2, big=False)
    regions.craft(b, -4.0, -5.8)


@building('factory_4', 4, 'โรงเผาอิฐ', 'Brick and charcoal works')
def factory_4(b):
    """Brick and charcoal works on a joined lot: two big kilns with stacks, long drying sheds full of bricks, a clay
    pit full of water, woodpiles and carts."""
    yard(b)
    p = b.main
    pw.kiln(p, -9.5, 8.0, 3.0)
    pw.kiln(p, -1.5, 9.0, 2.6)
    houses.open_shed(p, (-14.5, -6.0, 2.0, -1.0), 2.6, 'thatch', posts_mat='teak', low_side='front', rise=1.0)
    houses.open_shed(p, (4.0, -6.0, 14.5, 3.0), 2.6, 'thatch', posts_mat='teak', low_side='left', rise=1.0)
    for x in (-13.5, -9.5, -5.5, -1.5):
        pw.bricks(b.props, x, -4.6, 2, 1.4)
    for y in (-4.5, -1.5, 1.5):
        pw.bricks(b.props, 5.0, y, 3, 1.6)
    pr.water_pond(b.yard, 5.0, 7.0, 14.5, 14.5)
    for x in (-14.0, -12.0):
        props.woodpile(b.props, x, 2.0, 2.5, 3)
    props.smoke(b.props, -6.2, 8.0, 5.3, 3, 0.7)
    pw.ox_cart(b.props, -4.0, -12.0, facing=0)
    pw.ox_cart(b.props, 2.0, -12.5, facing=15)
    houses.stilt_house(b, 10.5, -11.0, 4.0, 3.2, floor_z=1.8, wall_h=2.3, thatch=True)
    regions.plant(b, -14.0, -14.0, 1)
    regions.plant(b, 14.0, 5.0, 2)
    regions.plant(b, -14.0, 14.0, 3)


# services (3x3 tiles, 47 m) --------------------------------------------------------------------------------------------

def fence_round(b, e, gate_w=3.0, mat=None, kind='picket', h=1.2):
    """A fence round the whole lot with a gate gap in the front middle."""
    r = b.region
    mat = mat or ('bamboo' if r not in ('north', 'south') else 'teak')
    props.fence(b.props, [(-gate_w / 2, -e), (-e, -e), (-e, e), (e, e), (e, -e), (gate_w / 2, -e)], h, mat,
                spacing=0.3 if kind == 'picket' else 1.0, kind=kind)


def gate(b, x, y, w=3.0, h=3.2, thatch=True):
    """A timber gate frame with a small roof of the region's form."""
    p = b.main
    for s in (-1, 1):
        kit.block(p, x + s * w / 2 - 0.15, y - 0.15, 0, x + s * w / 2 + 0.15, y + 0.15, h, 'teak_dark')
    kit.block(p, x - w / 2 - 0.4, y - 0.2, h - 0.3, x + w / 2 + 0.4, y + 0.2, h, 'teak')
    regions.house_roof(p, (x - w / 2 - 0.3, y - 0.6, x + w / 2 + 0.3, y + 0.6), h, b.region, None, axis='x',
                       over=0.3, over_ends=0.3, thatch=thatch, courses=2)


@building('ruler_house', None, 'คุ้มเจ้าเมือง', 'Ruler’s compound')
def ruler_house(b):
    """The ruler's compound: a big house on posts with a broad front deck, two side houses joined by decks, a
    pavilion for guests, rice barns, a well and a lotus pond, a fence with a roofed gate and the flag."""
    yard(b)
    r = b.region
    p = b.props
    main = houses.stilt_house(b, 0.0, 9.0, 12.0, 6.4, floor_z=2.8, wall_h=2.8, thatch=True, deck=('front', 4.0),
                              stair_at=0.0, posts_every=2.4)
    houses.stilt_house(b, -12.5, 8.0, 6.0, 5.0, floor_z=2.6, wall_h=2.6, thatch=True, stairs=False,
                       door_side='right', axis='y')
    houses.stilt_house(b, 12.5, 8.0, 6.0, 5.0, floor_z=2.6, wall_h=2.6, thatch=True, stairs=False,
                       door_side='left', axis='y')
    for x0, x1 in ((-9.5, -6.0), (6.0, 9.5)):
        kit.stilts(b.main, (x0, 6.5, x1, 9.5), 2.55, 2, 2, 'teak_dark', 0.16, 'stone')
        kit.floor_deck(b.main, (x0, 6.5, x1, 9.5), 2.55, 'plank', 0.1, edge='teak_dark', boards=10)
    houses.pavilion(b.main, (-18.0, -12.0, -9.0, -6.0), 0.5, 2.8, r, None, thatch=True, rail=True)
    pw.rice_barn(b, 15.0, -8.0, 3.6, 3.0)
    pw.rice_barn(b, 19.0, -2.0, 3.0, 2.6)
    pw.well(p, 6.0, -6.0, 0.9)
    pr.water_pond(b.yard, -7.0, -20.0, 7.0, -14.0)
    for x in (-5.0, -1.5, 2.0, 5.0):
        pr.lotus_pot(p, x, -16.5 - (x % 2), 0.0)
    props.flag_pole(p, 0.0, -21.0, 9.0)
    props.spirit_house(p, 9.0, -14.0)
    pw.drum(p, -4.0, -6.5, 1.0, 0.55)
    fence_round(b, 23.4, 4.0, kind='picket')
    regions.border(b, 22.0, 7.5, 1)
    gate(b, 0.0, -23.4, 4.0, 3.6)
    b.path(-1.5, -23.9, 1.5, main['deck'][1] - 2.0, path_mat(b), z=0.05)
    for k, (x, y) in enumerate(((-20.0, 18.0), (20.0, 18.0), (-20.0, 0.0), (20.0, 10.0), (-14.0, -19.0),
                                (14.0, -19.0))):
        regions.plant(b, x, y, k + 1)
    regions.craft(b, -16.0, 16.0)
    regions.under_house(b, 0.0, 9.0)


@building('school', None, 'โรงเรียนศาลา', 'Pavilion school')
def school(b):
    """A village school in a long raised pavilion: rows of benches facing a blackboard, a bell drum, the flag and a
    playing field."""
    yard(b)
    r = b.region
    p = b.props
    houses.pavilion(b.main, (-12.0, 4.0, 12.0, 12.0), 0.8, 2.8, r, None, thatch=True, rail=True)
    kit.block(b.main, -4.0, 11.6, 1.5, 4.0, 11.8, 3.0, 'black')
    kit.block(b.main, -4.1, 11.55, 1.45, 4.1, 11.62, 3.05, 'teak_dark')
    for i in range(5):
        for x in (-9.0, -4.5, 0.0, 4.5, 9.0):
            props.bench(p, x, 5.5 + i * 1.1, 2.4)
            p.box((2.4, 0.4, 0.05), 'teak_light', T(x, 5.9 + i * 1.1, 0.8 + 0.72))
    houses.stair_flight(b.main, 0.0, 4.0, 0.8, 2.0, '-y', 'teak', rail='teak_dark')
    houses.pavilion(b.main, (12.0, -6.0, 20.0, 0.0), 0.5, 2.6, r, None, thatch=True)
    props.flag_pole(p, 0.0, -3.0, 9.0)
    kit.block(b.yard, -1.0, -4.0, 0.0, 1.0, -2.0, 0.3, 'stone')
    pw.drum(p, -8.0, 2.0, 1.0, 0.5)
    kit.block(b.yard, -20.0, -21.0, 0.0, 6.0, -7.0, 0.05, 'grass')
    for x in (-19.0, 5.0):
        p.box((0.1, 2.4, 0.1), 'paint_white', T(x, -14.0, 1.6))
        for s in (-1, 1):
            p.box((0.1, 0.1, 1.6), 'paint_white', T(x, -14.0 + s * 1.2, 0.8))
    pw.well(p, 15.0, 8.0, 0.8)
    fence_round(b, 23.4, 3.0)
    regions.border(b, 22.0, 7.5, 2)
    gate(b, 0.0, -23.4, 3.0, 3.2)
    b.path(-1.2, -23.9, 1.2, 4.0, path_mat(b), z=0.06)
    for k, (x, y) in enumerate(((-20.0, 18.0), (20.0, 18.0), (18.0, -16.0), (-20.0, 2.0), (12.0, 16.0))):
        regions.plant(b, x, y, k)
    props.tree(p, 12.0, -14.0, 9.0, 3.5, 21)


@building('hospital', None, 'โรงหมอยาสมุนไพร', 'Herbal healer’s house')
def hospital(b):
    """The healer's house (โรงหมอ): a house on posts with a waiting pavilion, herb beds, drying racks of herbs,
    medicine jars and a green sign (no red cross)."""
    yard(b)
    r = b.region
    p = b.props
    main = houses.stilt_house(b, -4.0, 9.0, 10.0, 6.0, floor_z=2.4, wall_h=2.6, thatch=True, deck=('right', 4.0))
    houses.pavilion(b.main, (-16.0, -8.0, -6.0, -2.0), 0.45, 2.7, r, None, thatch=True)
    for i in range(3):
        props.bench(p, -11.0, -6.6 + i * 1.6, 3.0)
    for i in range(5):
        x = 4.0 + i * 3.4
        kit.block(b.yard, x - 1.2, -16.0, 0.0, x + 1.2, -4.0, 0.25, 'dirt_dark')
        for j in range(6):
            props.bush(p, x, -15.0 + j * 2.0, 0.45, i * 7 + j, ('leaf', 'leaf_dark', 'leaf_light')[(i + j) % 3])
    for x in (-18.0, -14.0):
        for s in (-1, 1):
            p.box((0.1, 0.1, 1.6), 'bamboo', T(x + s * 1.4, -16.0, 0.8))
        for z in (0.6, 1.1, 1.5):
            p.box((2.8, 1.0, 0.05), 'bamboo', T(x, -16.0, z))
            for k in range(4):
                p.cyl(0.28, 0.28, 0.08, 'straw', T(x - 1.0 + k * 0.66, -16.0, z + 0.06), seg=8)
                p.cyl(0.24, 0.24, 0.04, ('leaf', 'leaf_yellow', 'leaf_dark', 'flower_yellow')[k], T(
                    x - 1.0 + k * 0.66, -16.0, z + 0.11), seg=8)
    pw.pot_rows(p, 6.0, 4.0, 4, 2, 0.5)
    props.sign_board(b.props, main['rect'], 'front', 2.0, 2.4 + 2.7, 2.4, 0.6, 'sign_green', 'teak_dark', out=0.2)
    p.box((0.5, 0.1, 0.14), 'paint_white', T(-2.0, main['rect'][1] - 0.4, 5.4))
    p.box((0.14, 0.1, 0.5), 'paint_white', T(-2.0, main['rect'][1] - 0.4, 5.4))
    pw.well(p, 12.0, 14.0, 0.8)
    fence_round(b, 23.4, 3.0)
    regions.border(b, 22.0, 7.5, 3)
    gate(b, 0.0, -23.4, 3.0, 3.2)
    b.path(-1.2, -23.9, 1.2, 4.0, path_mat(b), z=0.06)
    for k, (x, y) in enumerate(((-20.0, 18.0), (20.0, 18.0), (20.0, -20.0), (-20.0, -20.0))):
        regions.plant(b, x, y, k)


@building('police', None, 'ด่านตรวจ', 'Guard post')
def police(b):
    """The guards' post: a timber hall on a plinth, a watch tower, a log palisade with a roofed gate, the flag and
    an alarm drum."""
    yard(b)
    r = b.region
    st = regions.style(r)
    p = b.main
    rect = (-10.0, 2.0, 6.0, 10.0)
    kit.block(p, rect[0] - 0.4, rect[1] - 2.0, 0, rect[2] + 0.4, rect[3] + 0.4, 0.8, 'stone', bevel=0.03)
    regions.house_walls(p, rect, 0.8, 4.0, r)
    for u in (-5.0, -1.5, 5.0):
        regions.house_window(p, rect, 'front', u, 1.8, r, 1.0, 1.3)
    regions.house_door(p, rect, 'front', 2.0, 0.8, r, 1.6, 2.3)
    for side in ('left', 'right'):
        regions.house_window(p, rect, side, 0, 1.8, r, 1.0, 1.3)
    regions.house_roof(p, rect, 4.0, r, None, axis='x', over=1.6, thatch=True)
    houses.stair_flight(p, 2.0, rect[1] - 2.0, 0.8, 2.0, '-y', 'stone')
    pw.watch_tower(p, 14.0, 12.0, 7.5, 2.6, region=r)
    pw.drum(b.props, 9.0, -2.0, 1.1, 0.55)
    props.flag_pole(b.props, -2.0, -8.0, 9.0)
    kit.block(b.yard, -3.0, -9.0, 0, -1.0, -7.0, 0.3, 'stone')
    e = 23.4
    for pts in ([(-2.0, -e), (-e, -e), (-e, e), (e, e), (e, -e), (2.0, -e)],):
        for a, c in zip(pts, pts[1:]):
            n = int(max(abs(c[0] - a[0]), abs(c[1] - a[1])) / 0.32)
            for i in range(n + 1):
                x = a[0] + (c[0] - a[0]) * i / max(n, 1)
                y = a[1] + (c[1] - a[1]) * i / max(n, 1)
                hh = 2.4 + (i % 3) * 0.15
                b.main.cyl(0.15, 0.13, hh, 'teak' if i % 2 else 'teak_dark', T(x, y, hh / 2), seg=5, smooth=False)
    regions.border(b, 22.0, 7.5, 6)
    gate(b, 0.0, -e, 4.0, 3.6)
    for x in (-16.0, -12.0):
        b.props.box((0.1, 2.0, 0.1), 'teak', T(x, -14.0, 1.3))
        for s in (-1, 1):
            b.props.box((0.1, 0.1, 1.3), 'teak', T(x, -14.0 + s * 1.0, 0.65))
    b.path(-1.6, -23.9, 1.6, 0.0, path_mat(b), z=0.06)
    for k, (x, y) in enumerate(((-19.0, 17.0), (19.0, -18.0), (-19.0, -18.0))):
        regions.plant(b, x, y, k)


@building('fire', None, 'หอกลองดับไฟ', 'Fire watch and water jars')
def fire(b):
    """The village fire watch: a tall tower with a drum, rows of big water jars, buckets and ladders on a rack, two
    wells and a thatched store."""
    yard(b)
    r = b.region
    p = b.props
    pw.watch_tower(b.main, 0.0, 8.0, 9.0, 3.0, region=r)
    pw.drum(p, 0.0, 8.0, 9.6, 0.55)
    for i in range(6):
        for j in range(2):
            props.water_jar(p, -14.0 + i * 1.3, -6.0 + j * 1.4, 1.05)
    for i in range(6):
        props.water_jar(p, 4.0 + i * 1.3, -6.0, 1.05)
    houses.open_shed(b.main, (6.0, 2.0, 16.0, 8.0), 2.6, 'thatch', posts_mat='teak', low_side='front', rise=1.0)
    for k in range(4):
        p.rod((7.0 + k * 2.2, 7.6, 0.1), (7.6 + k * 2.2, 7.6, 3.0), 0.04, 'bamboo', seg=4)
        p.rod((7.5 + k * 2.2, 7.6, 0.1), (8.1 + k * 2.2, 7.6, 3.0), 0.04, 'bamboo', seg=4)
        for z in range(1, 8):
            p.box((0.5, 0.04, 0.04), 'bamboo', T(7.55 + k * 2.2 + z * 0.075, 7.6, z * 0.38))
    for i in range(8):
        p.cyl(0.18, 0.14, 0.3, 'plank', T(-12.0 + i * 0.6, -2.5, 0.15), seg=8)
    pw.well(p, -10.0, 8.0, 0.9)
    pw.well(p, 14.0, -14.0, 0.9)
    fence_round(b, 23.4, 4.0)
    regions.border(b, 22.0, 7.5, 4)
    gate(b, 0.0, -23.4, 4.0, 3.4)
    b.path(-1.6, -23.9, 1.6, 6.0, path_mat(b), z=0.06)
    for k, (x, y) in enumerate(((-20.0, 18.0), (20.0, 18.0), (-20.0, -18.0), (20.0, -4.0))):
        regions.plant(b, x, y, k)
    regions.craft(b, -16.0, 16.0)


@building('water_works', None, 'บ่อน้ำและระหัดวิดน้ำ', 'Village well and water wheel')
def water_works(b):
    """The village water: a pond, a wooden water wheel lifting water into a bamboo trough on posts that runs to a
    raised timber cistern and rows of jars, a covered well and a pavilion."""
    yard(b)
    r = b.region
    p = b.props
    pr.water_pond(b.yard, -23.0, 4.0, -4.0, 23.0)
    pw.water_wheel(b.main, -8.0, 10.0, 2.6, 1.0, facing=0)
    trough = [(-6.6, 10.0, 4.6), (2.0, 10.0, 4.2), (8.0, 4.0, 3.9)]
    for a, c in zip(trough, trough[1:]):
        p.rod(a, c, 0.16, 'bamboo', seg=6)
    for x, y, z in trough[1:]:
        for s in (-1, 1):
            p.box((0.12, 0.12, z), 'teak_dark', T(x + s * 0.3, y, z / 2))
    tank = (6.0, 0.0, 11.0, 5.0)
    kit.stilts(b.main, tank, 2.4, 3, 3, 'teak_dark', 0.22, 'stone')
    kit.plank_walls(b.main, tank, 2.4, 3.9, 'plank', 'teak_dark', board=0.2, posts_mat='teak_dark')
    kit.block(b.main, tank[0] + 0.1, tank[1] + 0.1, 3.7, tank[2] - 0.1, tank[3] - 0.1, 3.8, 'water')
    for i in range(8):
        props.water_jar(p, 3.0 + i * 1.3, -4.0, 1.0)
    p.rod((8.5, 0.0, 2.6), (8.5, -3.6, 1.0), 0.06, 'bamboo', seg=6)
    pw.well(p, 14.0, -10.0, 1.0)
    pw.well(p, -10.0, -12.0, 1.0)
    houses.pavilion(b.main, (12.0, 8.0, 20.0, 14.0), 0.4, 2.6, r, None, thatch=True)
    fence_round(b, 23.4, 3.0)
    gate(b, 0.0, -23.4, 3.0, 3.2)
    b.path(-1.2, -23.9, 1.2, -4.8, path_mat(b), z=0.06)
    for k, (x, y) in enumerate(((20.0, 20.0), (20.0, -20.0), (-20.0, -20.0))):
        regions.plant(b, x, y, k)
    pr.boat(p, -16.0, 16.0, 3.6, facing=30)


@building('power_plant', None, 'โรงสีพลังน้ำ', 'Water mill')
def power_plant(b):
    """Power before electricity: a stream across the lot turns a big water wheel that drives a thatched mill
    house; a weir, a footbridge and a store barn."""
    yard(b)
    r = b.region
    p = b.props
    pr.water_pond(b.yard, -23.9, 6.0, 23.9, 13.0)
    kit.block(b.main, -2.0, 6.0, 0.0, -1.0, 13.0, 0.6, 'stone')
    pw.water_wheel(b.main, 4.0, 9.5, 3.6, 1.4, facing=0)
    rect = (6.5, 2.0, 16.0, 9.0)
    kit.block(b.main, rect[0], rect[1], 0, rect[2], rect[3], 0.6, 'stone')
    kit.plank_walls(b.main, rect, 0.6, 4.6, 'plank', 'teak_dark', board=0.22, posts_mat='teak_dark')
    kit.folding_doors(b.main, rect, 'front', 0, 0.6, 3.6, 2.8, leaf='plank', frame='teak_dark', open_=0.6)
    regions.house_window(b.main, rect, 'left', -1.5, 2.0, r)
    regions.house_roof(b.main, rect, 4.6, r, None, axis='x', over=1.0, thatch=True)
    p.cyl(0.18, 0.18, 4.0, 'teak_dark', T(6.0, 9.5, 3.24) @ R(0, 90, 0), seg=8)
    kit.block(b.main, -14.0, 5.0, 0.5, -10.0, 14.0, 0.75, 'plank')
    kit.railing(b.main, [(-14.0, 5.0), (-14.0, 14.0)], 0.75, 'teak_dark', spacing=0.4)
    kit.railing(b.main, [(-10.0, 5.0), (-10.0, 14.0)], 0.75, 'teak_dark', spacing=0.4)
    props.sacks(p, 8.0, -1.0, 6)
    pw.rice_barn(b, -12.0, -10.0, 4.0, 3.2)
    pw.ox_cart(p, 4.0, -8.0, facing=20)
    fence_round(b, 23.4, 3.0)
    gate(b, 0.0, -23.4, 3.0, 3.2)
    b.path(-1.2, -23.9, 1.2, 2.0, path_mat(b), z=0.06)
    for k, (x, y) in enumerate(((-20.0, 20.0), (20.0, 20.0), (20.0, -20.0), (-20.0, -2.0))):
        regions.plant(b, x, y, k)


@building('waste', None, 'ลานปุ๋ยหมักและหลุมเผา', 'Compost yard and burning pit')
def waste(b):
    """Where the village's waste goes: bamboo compost pens, a stone-ringed burning pit with a thin smoke, a
    thatched shed of baskets and a cart."""
    yard(b)
    p = b.props
    for i in range(4):
        for j in range(2):
            pw.compost_pen(p, -14.0 + i * 4.0, 4.0 + j * 4.0, 2.6)
    p.torus(2.2, 0.3, 'stone', T(10.0, 8.0, 0.15), seg=16, seg_minor=4)
    p.cyl(2.0, 2.0, 0.08, 'black', T(10.0, 8.0, 0.04), seg=16)
    props.smoke(p, 10.0, 8.0, 1.4, 3, 0.7)
    houses.open_shed(b.main, (-6.0, -12.0, 6.0, -6.0), 2.6, 'thatch', posts_mat='teak', low_side='front', rise=1.0)
    for i in range(8):
        p.cyl(0.3, 0.24, 0.5, 'straw', T(-5.0 + i * 1.3, -10.0, 0.25), seg=10)
    pw.ox_cart(p, 12.0, -10.0, facing=-30)
    fence_round(b, 23.4, 3.0)
    regions.border(b, 22.0, 7.5, 5)
    gate(b, 0.0, -23.4, 3.0, 3.2)
    b.path(-1.2, -23.9, 1.2, -12.0, path_mat(b), z=0.06)
    for k, (x, y) in enumerate(((-20.0, 20.0), (20.0, 20.0), (20.0, -20.0), (-20.0, -20.0))):
        regions.plant(b, x, y, k)


@building('station', None, 'ท่าเรือและลานเกวียน', 'Boat landing and cart yard')
def station(b):
    """How people travel in the village era: a long landing on the water with boats, a waiting pavilion, a cart
    shed with ox carts and a signpost."""
    yard(b)
    r = b.region
    p = b.props
    pr.water_pond(b.yard, -23.9, 8.0, 23.9, 23.9)
    pr.jetty(b.main, -10.0, 4.0, 10.0, 8.5, 0.6)
    pr.jetty(b.main, -2.0, 8.5, 2.0, 18.0, 0.6)
    for k, (x, y, f) in enumerate(((-6.0, 10.5, 5), (6.0, 11.0, -8), (5.0, 15.5, 80), (-5.0, 16.0, 95))):
        pr.boat(p, x, y, 4.5, facing=f)
    houses.pavilion(b.main, (-8.0, -4.0, 8.0, 2.0), 0.5, 2.8, r, None, thatch=True)
    for i in range(3):
        props.bench(p, -4.0 + i * 4.0, -1.0, 2.6)
    houses.open_shed(b.main, (10.0, -16.0, 21.0, -6.0), 2.8, 'thatch', posts_mat='teak', low_side='front', rise=1.0)
    for i in range(3):
        pw.ox_cart(p, 12.0 + i * 3.4, -11.0, facing=90)
    p.box((0.14, 0.14, 2.4), 'teak_dark', T(-4.0, -12.0, 1.2))
    for k, z in enumerate((2.1, 1.7)):
        p.box((1.6, 0.08, 0.32), 'sign_cream', T(-3.5 + k * 0.2, -12.0, z) @ R(0, 0, 10 - 20 * k))
    b.path(-1.5, -23.9, 1.5, -4.0, path_mat(b), z=0.06)
    for k, (x, y) in enumerate(((-20.0, -20.0), (-20.0, 2.0), (20.0, 2.0))):
        regions.plant(b, x, y, k)
    regions.craft(b, -16.0, -10.0)


@building('market', None, 'ตลาดนัดใหญ่', 'Big market hall')
def market(b):
    """The town's market day: a long thatched hall full of stalls, two smaller pavilions, umbrellas, a well, a
    landing for boats and shade trees."""
    yard(b)
    r = b.region
    p = b.props
    houses.pavilion(b.main, (-16.0, 0.0, 16.0, 12.0), 0.4, 3.2, r, None, thatch=True)
    for x in (-13.0, -9.0, -5.0, -1.0, 3.0, 7.0, 11.0):
        for y in (2.5, 6.0, 9.5):
            props.table_stall(p, x + 1.0, y, 2.4, 1.0, goods=(('flower_red', 'leaf', 'banana_fruit'),
                                                              ('banana_fruit', 'leaf_light', 'paint_orange'),
                                                              ('cream', 'leaf_dark', 'flower_yellow'))[int(y) % 3])
    houses.pavilion(b.main, (-20.0, -14.0, -10.0, -6.0), 0.4, 2.8, r, None, thatch=True)
    houses.pavilion(b.main, (10.0, -14.0, 20.0, -6.0), 0.4, 2.8, r, None, thatch=True)
    for x in (-17.5, -12.5):
        for y in (-12.0, -8.0):
            props.table_stall(p, x, y, 2.2, 1.0)
    for x in (12.5, 17.5):
        for y in (-12.0, -8.0):
            props.table_stall(p, x, y, 2.2, 1.0, goods=('banana_fruit', 'flower_yellow'))
    for x in (-5.0, 0.0, 5.0):
        props.table_stall(p, x, -16.0, 2.0, 0.9)
        props.sacks(p, x - 1.0, -18.0, 2)
    pw.well(p, 0.0, -8.0, 0.9)
    pr.water_pond(b.yard, -23.9, 16.0, 23.9, 23.9)
    pr.jetty(b.main, -4.0, 14.0, 4.0, 17.5, 0.5)
    pr.boat(p, -8.0, 19.5, 4.5, facing=0)
    pr.boat(p, 7.0, 20.0, 4.5, facing=180)
    for k, (x, y) in enumerate(((-21.0, -21.0), (21.0, -21.0), (-21.0, 2.0), (21.0, 2.0))):
        regions.plant(b, x, y, k + 1)
    props.spirit_house(p, 8.0, -20.0)
    regions.craft(b, -8.0, -20.0)
