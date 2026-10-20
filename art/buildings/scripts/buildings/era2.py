# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 2, the market town (assets/concept/era2_A_house.jpg, era2_B_town.jpg and the region_*_B_town sheets):
two-storey timber shophouses with clay tile roofs and Thai gables, folding plank doors, striped awnings and painted
signs (no brands), wooden power poles with sagging wires, half-brick half-timber houses, rice mills and sawmills
under zinc with brick chimneys, a railway halt. Every building is dressed by region (lib/regions.py): Isan's
plastered ground floors and zinc awnings, Lanna's กาแล and balconies, the south's Sino-Portuguese stucco with its
five-foot way and arched windows, the central and eastern turned-up bargeboards, the west's thatch and jars.
True sizes (PLAN.md)."""

from lib import houses, kit, props, regions
from lib import era2_parts as e2
from lib import props_region as pr
from lib import props_work as pw
from lib.builder import registry
from lib.mesh import R, S, T

BUILDINGS, building = registry(2)


def yard(b):
    b.ground(regions.ground_mat(b.region, b.era))


def path_mat(b):
    return {'northeast': 'dirt_dark', 'south': 'paving', 'north': 'paving'}.get(b.region, 'gravel')


def fence_mat(b):
    return {'north': 'teak', 'south': 'teak', 'west': 'bamboo'}.get(b.region, 'teak')


def drop_to(b, tops, x, y, z):
    """A service wire from a pole's lower arm to a wall."""
    e2.service_drop(b.props, tops[-1][0], (x, y, z))


# homes ---------------------------------------------------------------------------------------------------------------

@building('home_1', 1, 'เรือนไม้หลังคากระเบื้อง', 'Timber house with a tiled roof')
def home_1(b):
    """A small timber house on posts under clay tiles (thatch in the west), an open deck with stairs, a zinc lean-to
    kitchen, jars, a picket fence on the road and the first wire from a wooden pole."""
    yard(b)
    r = b.region
    p = b.props
    floor = 2.3 if r == 'northeast' else 1.5
    info = houses.stilt_house(b, -1.4, 1.6, 6.0, 4.6, floor_z=floor, wall_h=2.6, thatch=(r == 'west'),
                              deck=('right', 2.2), posts_every=2.0)
    x0, y0, x1, y1 = info['rect']
    houses.open_shed(b.main, (-6.6, 4.4, -4.6, 6.6), 2.2, 'zinc', posts_mat='teak_dark', low_side='front', rise=0.5)
    pw.well(p, -5.6, -3.0, 0.7, roof_mat='clay_tile') if r != 'west' else props.water_jar(p, -5.6, -3.0, 1.0)
    props.water_jar(p, 3.6, 4.4, 1.0)
    props.water_jar(p, 4.5, 4.6, 0.85)
    props.water_jar(p, -5.6, 5.4, 0.8)
    regions.under_house(b, -2.4, 1.2)
    e = 7.3
    props.fence(p, [(-e, -e), (-0.4, -e)], 1.1, fence_mat(b), spacing=0.22)
    props.fence(p, [(1.6, -e), (e, -e)], 1.1, fence_mat(b), spacing=0.22)
    tops = e2.pole(p, 6.6, -6.8, 8.0, 0)
    drop_to(b, tops, x0 + 0.3, y0 - 0.05, info['eave'] - 0.4)
    props.spirit_house(p, -5.8, -6.0)
    regions.plant(b, 6.2, 5.8, 1)
    regions.plant(b, -6.2, 0.8, 2, big=False)
    regions.plant(b, 5.8, -3.6, 3, big=False)
    regions.craft(b, 4.0, 1.6) if r != 'northeast' else pr.big_jars(p, 4.2, -1.6)
    b.path(-0.3, -7.9, 1.5, y0 - 0.2, path_mat(b), z=0.05)


@building('home_2', 2, 'เรือนครึ่งตึกครึ่งไม้', 'Half-brick half-timber house')
def home_2(b):
    """The market town's house: a plastered brick ground floor with barred windows, a timber upper floor with open
    shutters, the region's tiled roof, a tiled porch over the door, jars, a spirit house, a pole and its wire."""
    yard(b)
    r = b.region
    p = b.props
    info = e2.townhouse(b, (-4.4, -1.6, 3.6, 4.6), 0, axis='x', door_u=-1.6)
    x0, y0, x1, y1 = info['rect']
    props.spirit_house(p, -5.8, -5.6)
    props.water_jar(p, 5.0, 3.0, 1.0)
    props.water_jar(p, 5.0, 4.1, 0.85)
    props.water_tank(p, 5.2, 0.6, 0.0, 'stainless', stand=0.0) if r == 'south' else pr.big_jars(p, 4.6, 0.2)
    tops = e2.pole(p, 6.8, -6.9, 8.2, 0)
    drop_to(b, tops, x1 - 0.2, y0 - 0.05, info['eave'] - 0.4)
    props.fence(p, [(-7.3, -7.3), (-3.3, -7.3)], 1.1, fence_mat(b), spacing=0.22)
    props.fence(p, [(-0.7, -7.3), (5.6, -7.3)], 1.1, fence_mat(b), spacing=0.22)
    for x in (-3.3, -0.7):
        p.box((0.16, 0.16, 1.5), 'teak_dark', T(x, -7.3, 0.75))
    regions.plant(b, -6.4, 5.8, 1)
    regions.plant(b, 6.2, 6.4, 2, big=False)
    regions.plant(b, -6.6, 0.6, 3, big=False)
    props.bush(p, 2.0, -4.6, 0.5, 3, flowers='flower_red')
    props.bush(p, 3.6, -4.8, 0.45, 8, flowers='flower_yellow')
    regions.craft(b, 2.6, -6.2)
    b.path(-2.8, -7.9, -0.4, y0 - 2.0, path_mat(b), z=0.05)


@building('home_3', 3, 'เรือนไม้มีระเบียง', 'House with an upstairs veranda')
def home_3(b):
    """A bigger half-brick house with a timber veranda across its front upstairs, a timber kitchen house beside it
    under zinc, a well, jars, washing on a line and a picket fence with a gate."""
    yard(b)
    r = b.region
    p = b.props
    info = e2.townhouse(b, (-5.6, -0.4, 3.2, 5.8), 1, axis='x', door_u=-1.4, porch=r == 'south',
                        veranda=r != 'south')
    x0, y0, x1, y1 = info['rect']
    k = (3.2, 0.8, 6.4, 5.4)
    kit.block(b.main, k[0], k[1], 0, k[2], k[3], 0.3, 'stone')
    regions.house_walls(b.main, k, 0.3, 2.9, r)
    e2.house_window(b.main, k, 'right', 0.0, 1.2, r, 0.8, 1.0)
    regions.house_door(b.main, k, 'front', 0.4, 0.3, r, 0.9, 2.1)
    kit.corrugated(b.main, k, 2.9, 3.7, 'zinc', 'zinc_dark', over=0.35, low_side='right')
    props.chimney(b.main, 5.6, 4.4, 1.2, 0.18, 0.15, 'concrete_dark', 'iron', z=3.4)
    for k2 in range(2):
        p.box((1.6, 0.3, 0.15), 'stone', T(x0 + 4.2, y0 - 0.15 - k2 * 0.28, 0.3 - k2 * 0.15))
    pw.well(p, -5.4, -4.6, 0.75, roof_mat='clay_tile')
    pw.cloth_line(p, 1.0, -3.2, 5.6, -3.2, cloths=('cream', 'paint_blue', 'silk', 'paint_white'))
    props.water_jar(p, 6.2, -0.2, 1.0)
    props.water_jar(p, 6.2, -1.2, 0.9)
    e = 7.3
    props.fence(p, [(-e, -e), (-2.2, -e)], 1.1, fence_mat(b), spacing=0.2)
    props.fence(p, [(0.2, -e), (e, -e)], 1.1, fence_mat(b), spacing=0.2)
    for x in (-2.2, 0.2):
        p.box((0.18, 0.18, 1.6), 'teak_dark', T(x, -e, 0.8))
    tops = e2.pole(p, -6.9, -6.6, 8.2, 0)
    drop_to(b, tops, x0 + 0.2, y0 - 0.05, info['eave'] - 0.4)
    props.spirit_house(p, 5.6, -6.0)
    regions.plant(b, -6.4, 6.4, 1)
    regions.plant(b, 6.6, 6.6, 2, big=False)
    regions.plant(b, -6.6, 1.6, 3, big=False)
    b.path(-1.6, -7.9, -0.4, y0 - 1.7, path_mat(b), z=0.05)


@building('home_4', 4, 'บ้านใหญ่มีรั้ว', 'Large house in a walled yard')
def home_4(b):
    """A large L-shaped house: a two-storey main block with a porch and a wing whose gable faces the road, a low
    plastered wall with a gate, a spirit house, a garden, jars and a shade tree."""
    yard(b)
    r = b.region
    p = b.props
    main = e2.townhouse(b, (-6.4, 0.6, 2.9, 6.3), 2, axis='x', door_u=-1.4)
    wing = e2.townhouse(b, (3.0, -4.6, 6.5, 6.3), 0, axis='y', door_side='left', door_u=2.0, porch=False,
                        windows={'left': 2, 'right': 3, 'front': 1, 'back': 1})
    e = 7.4
    wall = regions.plaster(r, 1)
    props.fence(p, [(-2.6, -e), (-e, -e), (-e, e), (e, e), (e, -e), (-0.2, -e)], 1.2, wall, kind='wall',
                post_mat='e2_moulding')
    for x in (-2.6, -0.2):
        kit.block(b.main, x - 0.25, -e - 0.25, 0, x + 0.25, -e + 0.25, 1.8, 'e2_moulding')
        b.props.cyl(0.2, 0.12, 0.25, 'e2_moulding', T(x, -e, 1.92), seg=8)
    props.spirit_house(p, -6.0, -5.6)
    props.tree(p, -5.0, -2.8, 6.5, 2.6, 17)
    for k in range(4):
        props.bush(p, 0.8 + k * 0.6, -6.6 + (k % 2) * 0.4, 0.4, k + 2, flowers=('flower_red', 'flower_pink')[k % 2])
    pr.lotus_pot(p, 1.2, -2.0)
    props.water_jar(p, -6.8, 6.6, 0.9)
    props.water_jar(p, -5.9, 6.7, 0.9)
    tops = e2.pole(p, 7.0, -7.0, 8.2, 0)
    drop_to(b, tops, 6.5, -4.0, wing['eave'] - 0.4)
    regions.plant(b, -1.0, 6.9, 2, big=False)
    regions.craft(b, 1.6, -4.4)
    b.path(-2.0, -7.9, -0.8, 0.6 - 2.0, path_mat(b), z=0.05)


def raft_house(b, x0, y0, x1, y1):
    """The west's floating house (เรือนแพ) on a pond: a bamboo raft, a small timber room under thatch, a plank
    walk to the bank and a boat tied alongside."""
    r = b.region
    pr.water_pond(b.yard, x0, y0, x1, y1)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    raft = (cx - 2.6, cy - 2.2, cx + 2.6, cy + 2.2)
    pr.raft(b.main, *raft, z=0.2)
    room = (cx - 1.8, cy - 1.0, cx + 1.8, cy + 1.9)
    kit.block(b.main, raft[0], raft[1], 0.3, raft[2], raft[3], 0.4, 'plank')
    regions.house_walls(b.main, room, 0.4, 2.6, r)
    regions.house_door(b.main, room, 'front', 0.0, 0.4, r, 0.9, 1.9)
    e2.house_window(b.main, room, 'left', 0.0, 1.2, r, 0.8, 0.9)
    regions.house_roof(b.main, room, 2.6, r, None, axis='x', over=0.7, over_ends=0.5, thatch=True)
    kit.railing(b.main, [(raft[0], raft[1]), (raft[2], raft[1])], 0.4, 'bamboo', h=0.8, spacing=0.3)
    kit.block(b.main, x1 - 0.2, cy - 0.5, 0.25, x1 + 0.8, cy + 0.5, 0.35, 'plank')
    kit.block(b.main, raft[2], cy - 0.5, 0.3, x1, cy + 0.5, 0.4, 'plank')
    pr.boat(b.props, cx, raft[1] - 0.9, 3.6, facing=0)
    pr.orchid_hanging(b.props, room[0] - 0.3, room[1] - 0.3, 2.2)


@building('home_5', 5, 'บ้านหมู่เครือญาติ', 'Family compound')
def home_5(b):
    """A family's compound on a joined lot: the big two-storey house with its veranda, the grandparents' old house
    on posts, a smaller house, a zinc store with rice sacks, a paved yard with a well and jars, vegetable beds, a
    walled front with a roofed gate."""
    yard(b)
    r = b.region
    p = b.props
    main = e2.townhouse(b, (-7.0, 5.4, 7.0, 12.2), 0, axis='x', door_u=0.0, porch=r == 'south', veranda=r != 'south')
    if r != 'south':
        for k in range(3):
            p.box((2.0, 0.3, 0.15), 'stone', T(0.0, 5.4 - 1.75 - k * 0.28, 0.3 - k * 0.15))
    houses.stilt_house(b, -10.6, -4.0, 6.0, 4.6, floor_z=2.3, wall_h=2.6, deck=('right', 2.4), stair_at=-6.4)
    e2.townhouse(b, (8.4, -7.4, 13.8, -0.6), 1, axis='y', door_side='left', door_u=0.0, upper=False)
    houses.open_shed(b.main, (9.6, 3.0, 14.6, 12.6), 2.8, 'zinc', posts_mat='teak_dark', low_side='left', rise=0.7)
    props.sacks(p, 10.6, 5.0, 6)
    props.sacks(p, 12.4, 8.0, 4)
    pw.ox_cart(p, 12.0, 11.0, facing=90)
    b.path(-6.0, -9.0, 6.0, 3.6, 'paving' if r != 'northeast' else 'laterite', z=0.06)
    pw.well(p, 2.6, -3.0, 0.85, roof_mat='clay_tile')
    for k in range(4):
        props.water_jar(p, -4.8 + k * 1.1, 3.0, 1.0)
    if r == 'west':
        raft_house(b, -15.2, 5.0, -8.6, 15.2)
    for k in range(5 if r != 'west' else 0):
        x = -14.4 + k * 1.1
        kit.block(b.yard, x, 6.0, 0, x + 0.8, 14.5, 0.22, 'dirt_dark')
        for j in range(5):
            p.sphere(0.3, ('leaf', 'leaf_light', 'leaf_dark')[(k + j) % 3], T(x + 0.4, 6.8 + j * 1.7, 0.35) @
                     S(1, 1, 0.7), seg=8, rings=4)
    e = 15.4
    wall = regions.plaster(r, 2)
    props.fence(p, [(-1.8, -e), (-e, -e)], 1.2, wall, kind='wall', post_mat='e2_moulding')
    props.fence(p, [(1.8, -e), (e, -e)], 1.2, wall, kind='wall', post_mat='e2_moulding')
    props.fence(p, [(-e, -e), (-e, e), (e, e), (e, -e)], 1.2, fence_mat(b), spacing=0.25)
    for x in (-1.8, 1.8):
        kit.block(b.main, x - 0.3, -e - 0.3, 0, x + 0.3, -e + 0.3, 2.8, 'e2_moulding')
    regions.house_roof(b.main, (-2.1, -e - 0.6, 2.1, -e + 0.6), 2.8, r, None, axis='x', over=0.3, over_ends=0.3,
                       courses=2)
    props.spirit_house(p, -4.0, -13.0)
    tops = e2.pole_line(p, [(-14.8, -14.6), (14.8, -14.6)], 8.5)
    drop_to(b, tops[1], 13.8, -4.0, 3.2)
    drop_to(b, tops[0], -7.0, 5.4, main['eave'] - 0.4)
    props.tree(p, 4.6, -11.0, 7.0, 3.0, 23)
    for k, (x, y) in enumerate(((-14.0, 2.0), (14.0, 14.4), (-3.0, 14.4), (5.0, 14.4))):
        regions.plant(b, x, y, k + 1)
    regions.craft(b, -6.0, -9.5)
    regions.under_house(b, -11.0, -4.0)
    b.path(-1.2, -15.9, 1.2, -9.0, path_mat(b), z=0.05)


# shops ---------------------------------------------------------------------------------------------------------------

@building('shop_1', 1, 'ร้านไม้หัวมุม', 'Corner timber shop')
def shop_1(b):
    """The concept's shop: one two-storey timber shophouse on a corner, striped awnings on two sides, crates of
    fruit, a bench, a hanging lantern, the owner's jars behind."""
    yard(b)
    r = b.region
    p = b.props
    rect = (-3.4, -4.6, 2.6, 3.4)
    u = e2.shophouse(b, rect, 0, 2, sides=('left', 'right'), lamp=True)
    if r != 'south':
        stripes = e2.awning_stripes(r)
        zinc = stripes[0].startswith('zinc')
        props.awning(p, rect, 'right', -1.2, e2.GROUND - 0.15, 4.6, 1.5, 0.55 if not zinc else 0.4, stripes=stripes,
                     valance=not zinc)
    for k, f in enumerate(('durian', 'paint_orange', 'leaf_light')):
        e2.crate(p, 4.0, -2.8 + k * 0.8, f, facing=90, stack=1 + k % 2)
    props.bench(p, 4.1, 0.6, 1.5, facing=90)
    props.water_jar(p, 0.6, 4.6, 1.0)
    props.water_jar(p, 1.6, 4.8, 0.85)
    tops = e2.pole(p, -6.8, -6.8, 8.2, 0)
    drop_to(b, tops, rect[0] - 0.05, -2.0, u['eave'] - 0.5)
    regions.plant(b, -6.0, 5.6, 1)
    regions.plant(b, 6.2, 5.8, 2, big=False)
    regions.craft(b, -6.0, 1.0)
    b.path(-7.9, -7.9, 7.9, rect[1] - 0.2, path_mat(b), z=0.05)


@building('shop_2', 2, 'ห้องแถวไม้สองคูหา', 'Two timber shophouses')
def shop_2(b):
    """Two timber shophouses side by side, each with its gable to the street, folding doors, an awning and a sign;
    a pole with wires to both, a vendor's cart, jars in the back yard."""
    yard(b)
    r = b.region
    p = b.props
    us = e2.shop_row(b, -4.6, -5.4, 2, 4.6, 11.0, 2, i0=1)
    tops = e2.pole(p, -7.0, -7.1, 8.2, 0)
    for k, x in enumerate((-4.4, 4.4)):
        drop_to(b, tops, x if k else x, -5.45, us[k]['eave'] - 0.6)
    e2.vendor_cart(p, 5.8, -6.6, facing=0, stripes=e2.awning_stripes(r) if r != 'northeast' else
                   ('awning_blue', 'awning_white'))
    if r == 'west':
        pr.big_jars(p, -3.6, 6.4, 3)
    else:
        for x in (-3.0, 2.0):
            props.water_jar(p, x, 6.6, 0.95)
    regions.plant(b, -6.4, 6.4, 1, big=False)
    regions.plant(b, 6.4, 6.4, 2)
    b.path(-7.9, -7.9, 7.9, -5.5, path_mat(b), z=0.05)


@building('shop_3', 3, 'ห้องแถวไม้สามคูหา', 'Row of three shophouses')
def shop_3(b):
    """A row of three two-storey timber shophouses, each its own gable, awning and painted sign; wooden poles and
    sagging wires along the front."""
    yard(b)
    r = b.region
    p = b.props
    us = e2.shop_row(b, -6.9, -5.6, 3, 4.6, 11.4, 2, i0=0)
    tops = e2.pole_line(p, [(-7.2, -7.2), (7.2, -7.2)], 8.4, sag=0.6)
    drop_to(b, tops[0], -4.6, -5.65, us[0]['eave'] - 0.6)
    drop_to(b, tops[1], 4.6, -5.65, us[2]['eave'] - 0.6)
    e2.vendor_cart(p, 0.0, -7.0, facing=0, stripes=('awning_blue', 'awning_white'))
    props.water_jar(p, -5.0, 6.6, 0.9)
    props.water_tank(p, 4.6, 6.6, 0.0, 'stainless', stand=0.0) if r == 'south' else props.water_jar(p, 4.6, 6.6, 1.0)
    regions.plant(b, 0.0, 6.8, 2, big=False)
    b.path(-7.9, -7.9, 7.9, -5.7, path_mat(b), z=0.05)


@building('shop_4', 4, 'ห้องแถวไม้สามชั้น', 'Three-storey shophouse row')
def shop_4(b):
    """Three shophouses of three storeys, the tallest timber row of the town: awnings, signs, a lantern, crates,
    wires from two poles."""
    yard(b)
    r = b.region
    p = b.props
    us = e2.shop_row(b, -6.9, -5.6, 3, 4.6, 12.0, heights=(3, 3, 3), i0=2)
    tops = e2.pole_line(p, [(-7.2, -7.2), (7.2, -7.2)], 9.0, sag=0.6)
    drop_to(b, tops[0], -4.6, -5.65, e2.GROUND + 0.9)
    drop_to(b, tops[1], 4.6, -5.65, e2.GROUND + 0.9)
    e2.vendor_cart(p, 0.0, -7.0, facing=0, stripes=e2.awning_stripes(r) if r != 'northeast' else
                   ('awning_red', 'awning_white'))
    regions.plant(b, -6.6, 7.0, 1, big=False)
    regions.plant(b, 6.6, 7.0, 3, big=False)
    b.path(-7.9, -7.9, 7.9, -5.7, path_mat(b), z=0.05)


@building('shop_5', 5, 'ตลาดห้องแถว', 'Market block')
def shop_5(b):
    """The market town's block on a joined lot: six shophouses along the street (two of them three storeys), and
    behind them a zinc-roofed market shed with stalls round a well, carts, crates and a line of poles and wires."""
    yard(b)
    r = b.region
    p = b.props
    hs = (2, 3, 2, 2, 3, 2) if r != 'south' else (2, 2, 2, 2, 2, 2)
    us = e2.shop_row(b, -14.4, -13.4, 6, 4.8, 12.0, heights=hs, i0=0)
    shed = (-12.0, 2.0, 12.0, 11.0)
    for x in range(-12, 13, 4):
        for y in (2.0, 6.5, 11.0):
            kit.block(b.main, x - 0.1, y - 0.1, 0, x + 0.1, y + 0.1, 3.4, 'teak_dark')
    kit.block(b.main, shed[0], shed[1], 0, shed[2], shed[3], 0.15, 'concrete')
    kit.gable_ribbed(b.main, shed, 3.4, 1.8, 'zinc', 'zinc_dark', over=0.6, over_ends=0.4, axis='x', pitch=0.7)
    for x in (-9.0, -4.5, 0.0, 4.5, 9.0):
        for y in (4.0, 9.0):
            props.table_stall(p, x, y, 3.0, 1.1, goods=(('banana_fruit', 'leaf_light', 'paint_orange'),
                                                        ('flower_red', 'leaf', 'rambutan'))[int(x + y) % 2])
    pw.well(p, 0.0, -0.4, 0.8, roof=False)
    for k in range(3):
        e2.vendor_cart(p, -13.6 + k * 1.0, 13.6 - k * 2.4, facing=90, stripes=('awning_blue', 'awning_white'))
    for k in range(5):
        e2.crate(p, 13.2, 12.0 - k * 0.8, ('durian', 'banana_fruit', 'paint_orange')[k % 3], facing=90, stack=2)
    props.sacks(p, 13.0, 3.0, 6)
    tops = e2.pole_line(p, [(-15.2, -15.0), (-5.0, -15.0), (5.0, -15.0), (15.2, -15.0)], 9.0, sag=0.7)
    for k, (t, x) in enumerate(((0, -12.0), (1, -4.8), (2, 4.8), (3, 12.0))):
        drop_to(b, tops[t], x, -13.45, e2.GROUND + 0.9)
    for x in (-9.6, 0.2, 9.6):
        e2.vendor_cart(p, x, -14.6, facing=0, stripes=e2.awning_stripes(r) if r != 'northeast' else
                       ('awning_red', 'awning_white'))
    regions.plant(b, -14.6, 14.6, 1)
    regions.plant(b, 14.6, -0.6, 2, big=False)
    props.spirit_house(p, 14.4, 14.4)
    b.path(-15.9, -15.9, 15.9, -13.5, path_mat(b), z=0.05)
    b.path(-12.5, -1.4, 12.5, 12.0, 'paving_dark' if r != 'northeast' else 'laterite', z=0.06)


# workshops -------------------------------------------------------------------------------------------------------------

@building('factory_1', 1, 'โรงช่างไม้และตีเหล็ก', 'Carpenter and smithy')
def factory_1(b):
    """A timber workshop under a zinc roof, its folding doors wide open on a workbench; a smithy lean-to with a
    brick forge and its little chimney, cart wheels, planks and logs."""
    yard(b)
    r = b.region
    st = regions.style(r)
    m = b.main
    p = b.props
    rect = (-4.6, -2.4, 4.0, 5.4)
    kit.block(m, rect[0], rect[1], 0, rect[2], rect[3], 0.2, 'concrete')
    regions.house_walls(m, rect, 0.2, 4.0, r)
    kit.folding_doors(m, rect, 'front', -0.6, 0.2, 5.0, 3.0, leaf=st['shutter'], frame=st['trim'], open_=0.85)
    e2.house_window(m, rect, 'right', 0.0, 1.4, r, 1.0, 1.1)
    kit.gable_ribbed(m, rect, 4.0, 1.9, 'zinc', 'zinc_dark', over=0.5, over_ends=0.4, axis='x', pitch=0.6)
    kit.prism_x(m, [(rect[1], 4.0), (rect[3], 4.0), ((rect[1] + rect[3]) / 2, 5.88)], rect[0] + 0.02, rect[2] - 0.02,
                st['wood'])
    props.sign_board(p, rect, 'front', -0.6, 3.35, 3.0, 0.5, 'sign_cream', 'teak_dark', out=0.05)
    # inside: a workbench with tools
    kit.block(p, -3.4, -1.6, 0.85, 0.6, -0.9, 0.95, 'teak')
    for x in (-3.2, 0.4):
        kit.block(p, x - 0.05, -1.55, 0.2, x + 0.05, -0.95, 0.85, 'teak_dark')
    # the smithy lean-to
    sm = (-7.0, -2.4, -4.6, 2.2)
    for x, y in ((sm[0], sm[1]), (sm[0], sm[3])):
        kit.block(m, x - 0.08, y - 0.08, 0, x + 0.08, y + 0.08, 2.6, 'teak_dark')
    kit.corrugated(m, sm, 2.6, 3.4, 'rust', 'zinc_dark', over=0.3, low_side='left')
    kit.block(m, -6.4, -1.0, 0, -5.2, 0.6, 0.85, 'brick', bevel=0.03)
    kit.block(m, -6.2, -0.8, 0.85, -5.4, 0.4, 0.95, 'black')
    props.chimney(m, -5.8, 0.4, 3.4, 0.22, 0.18, 'brick', 'brick_dark', z=0.85)
    p.cyl(0.18, 0.22, 0.5, 'iron', T(-5.6, -1.8, 0.25), seg=8)
    p.box((0.5, 0.2, 0.12), 'iron', T(-5.6, -1.8, 0.56))
    props.barrel(p, -6.6, 1.6, 'rust', 0.8)
    for k in range(3):
        p.torus(0.6, 0.05, 'teak_dark', T(-1.0 + k * 0.5, -3.6, 0.6) @ R(75, 0, 0), seg=14, seg_minor=4)
        p.cyl(0.1, 0.1, 0.2, 'teak_dark', T(-1.0 + k * 0.5, -3.6, 0.6) @ R(75, 0, 0), seg=6)
    if r == 'west':
        pw.pot_rows(p, 2.8, -6.4, 4, 2, 0.9)
    else:
        e2.plank_stack(p, 4.6, -5.0, 1.2, 4.0, 0.7, axis='x')
    e2.log_pile(p, -3.4, -6.0, 4.0, 2, 0.25)
    props.woodpile(p, 5.4, 1.0, 2.0, 3)
    tops = e2.pole(p, 7.0, -7.0, 8.2, 0)
    drop_to(b, tops, rect[2] + 0.02, -1.2, 3.4)
    regions.plant(b, -6.4, 6.4, 1)
    regions.plant(b, 6.4, 6.6, 2, big=False)
    b.path(-7.9, -7.9, 7.9, rect[1] - 0.3, path_mat(b), z=0.05)


@building('factory_2', 2, 'โรงเลื่อย', 'Sawmill')
def factory_2(b):
    """A sawmill: a long open shed under a zinc roof over the saw bench and its log, a brick engine house with a
    chimney and a belt to the saw, logs waiting, boards stacked to dry, a sawdust heap."""
    yard(b)
    r = b.region
    m = b.main
    p = b.props
    shed = (-6.6, -1.6, 3.2, 5.4)
    for i in range(5):
        x = shed[0] + (shed[2] - shed[0]) * i / 4
        for y in (shed[1], shed[3]):
            kit.block(m, x - 0.12, y - 0.12, 0, x + 0.12, y + 0.12, 4.0, 'teak_dark')
            kit.block(m, x - 0.25, y - 0.25, 0, x + 0.25, y + 0.25, 0.25, 'concrete')
    kit.bands(m, (shed[0], shed[1], shed[2], shed[3]), 3.75, 0.25, -0.05, 'teak')
    kit.block(m, shed[0], shed[1], 0, shed[2], shed[3], 0.12, 'concrete')
    kit.gable_ribbed(m, shed, 4.0, 1.9, 'zinc', 'zinc_dark', over=0.5, over_ends=0.4, axis='x', pitch=0.6)
    kit.prism_x(m, [(shed[1], 4.0), (shed[3], 4.0), ((shed[1] + shed[3]) / 2, 5.88)], shed[0], shed[0] + 0.04, 'plank')
    # the saw bench and its log
    kit.block(m, -5.8, 1.6, 0, 1.8, 2.6, 0.8, 'teak')
    for k in range(5):
        kit.block(m, -5.6 + k * 1.8, 1.55, 0.8, -5.4 + k * 1.8, 2.65, 0.88, 'iron')
    p.cyl(0.32, 0.32, 6.5, 'trunk', T(-2.6, 2.1, 1.2) @ R(0, 90, 0), seg=10)
    p.cyl(0.6, 0.6, 0.04, 'steel', T(1.0, 2.1, 1.0) @ R(90, 0, 0), seg=18)
    kit.block(m, 0.6, 1.9, 0.8, 1.4, 2.3, 1.05, 'iron')
    # the engine house
    eh = (4.0, 1.0, 6.9, 5.4)
    kit.walls(m, eh, 0, 3.4, 'brick', bevel=0.0)
    kit.bands(m, eh, 0, 0.4, 0.03, 'brick_dark')
    kit.bands(m, eh, 3.2, 0.2, 0.05, 'brick_dark')
    kit.door(m, eh, 'front', 0.0, 0.0, 1.2, 2.2, leaf='iron', frame='brick_dark', panels=False)
    kit.window(m, eh, 'right', 0.0, 1.2, 0.8, 1.0, frame='brick_dark', bars=3)
    kit.window(m, eh, 'left', 0.9, 1.4, 0.7, 0.8, frame='brick_dark', bars=2)
    kit.corrugated(m, eh, 3.4, 3.9, 'rust', 'zinc_dark', over=0.3, low_side='right')
    props.chimney(m, 6.0, 4.6, 7.5, 0.35, 0.25, 'brick', 'brick_dark')
    props.smoke(p, 6.2, 4.8, 8.4, 3, 0.6)
    p.rod((4.0, 2.4, 2.4), (1.0, 2.2, 1.1), 0.05, 'black', seg=4)
    p.rod((4.0, 2.0, 2.0), (1.0, 2.0, 0.9), 0.05, 'black', seg=4)
    e2.log_pile(p, -2.2, -4.6, 6.0, 3, 0.32)
    e2.log_pile(p, -2.2, -6.6, 5.0, 2, 0.28)
    e2.plank_stack(p, 5.4, -3.6, 1.2, 4.4, 1.0, axis='y')
    e2.plank_stack(p, 3.6, -3.6, 1.2, 4.4, 0.7, axis='y')
    e2.mound(p, -5.6, 6.4, 1.2, 0.9, 'straw')
    props.barrel(p, 6.6, 0.0, 'rust', 0.9)
    tops = e2.pole(p, 7.0, -7.0, 8.2, 0)
    drop_to(b, tops, eh[2], 2.0, 3.0)
    regions.plant(b, -6.6, -6.4, 2, big=False)
    regions.plant(b, 6.6, 6.8, 1, big=False)
    b.path(-7.9, -7.9, 7.9, -1.8, path_mat(b), z=0.05)


def mill_house(b, rect, z_top, axis='y', door_side='front'):
    """A rice mill's tall body: a brick plinth, zinc walls with ribs and small windows, a ribbed zinc roof."""
    m = b.main
    x0, y0, x1, y1 = rect
    kit.block(m, x0 - 0.1, y0 - 0.1, 0, x1 + 0.1, y1 + 0.1, 0.8, 'brick', bevel=0.02)
    kit.plank_walls(m, rect, 0.8, z_top, 'zinc', 'zinc_dark', board=0.3, posts_mat='teak_dark')
    kit.bands(m, rect, z_top * 0.55, 0.15, 0.04, 'teak_dark')
    for side in kit.SIDES:
        fw = kit.face_width(rect, side)
        for u in kit.spread(fw, max(1, int(fw / 3.0)), 0.8):
            kit.window(m, rect, side, u, z_top * 0.55 + 0.6, 0.8, 0.8, frame='teak_dark', mullion=False,
                       shutters='rust', open_shutters=True)
    span = (x1 - x0) if axis == 'y' else (y1 - y0)
    top = kit.gable_ribbed(m, rect, z_top, span * 0.32, 'zinc', 'zinc_dark', over=0.5, over_ends=0.4, axis=axis,
                           pitch=0.6)
    pts = [(x0, z_top), (x1, z_top), ((x0 + x1) / 2, top - 0.05)] if axis == 'y' else \
        [(y0, z_top), (y1, z_top), ((y0 + y1) / 2, top - 0.05)]
    if axis == 'y':
        kit.prism_y(m, pts, y0 + 0.01, y1 - 0.01, 'zinc')
    else:
        kit.prism_x(m, pts, x0 + 0.01, x1 - 0.01, 'zinc')
    kit.folding_doors(m, rect, door_side, 0, 0.8, 2.6, 2.6, leaf='zinc_dark', frame='teak_dark', open_=0.8)
    return top


@building('factory_3', 3, 'โรงสีข้าว', 'Rice mill')
def factory_3(b):
    """A rice mill: a tall zinc-clad mill house on a brick plinth with its bucket elevator, a lean-to store of
    sacks, a loading dock, a brick chimney with smoke and a heap of husks."""
    yard(b)
    r = b.region
    m = b.main
    p = b.props
    rect = (-4.8, -1.6, 2.4, 5.8)
    top = mill_house(b, rect, 7.2, axis='y')
    kit.block(m, -4.8, -3.6, 0, 2.4, -1.6, 0.8, 'concrete', bevel=0.02)
    for k in range(4):
        kit.block(m, 2.4 + k * 0.25, -3.6, 0, 2.65 + k * 0.25, -2.4, 0.8 - (k + 1) * 0.18, 'concrete')
    props.sacks(p, -4.2, -3.2, 6)
    for k in range(4):
        p.sphere(0.32, 'canvas', T(-1.0 + k * 0.6, -2.6, 1.0) @ S(1, 0.7, 0.55), seg=8, rings=5)
    # the bucket elevator up the side
    kit.block(m, -5.9, 1.0, 0, -4.8, 2.0, 9.6, 'zinc')
    kit.block(m, -6.0, 0.9, 9.6, -4.7, 2.1, 9.8, 'zinc_dark')
    p.rod((-5.3, 1.5, 9.4), (-3.0, 3.6, top - 0.3), 0.12, 'zinc_dark', seg=6)
    # the lean-to store
    lt = (2.4, 0.0, 6.6, 5.8)
    for y in (lt[1], lt[3]):
        kit.block(m, lt[2] - 0.08, y - 0.08, 0, lt[2] + 0.08, y + 0.08, 3.2, 'teak_dark')
    kit.corrugated(m, lt, 3.2, 4.4, 'zinc', 'zinc_dark', over=0.35, low_side='right')
    props.sacks(p, 3.2, 1.0, 8)
    props.sacks(p, 4.6, 3.6, 8)
    props.chimney(m, -6.0, 5.6, 14.0, 0.55, 0.38, 'brick', 'brick_dark')
    props.smoke(p, -5.8, 5.8, 14.8, 3, 0.8)
    e2.mound(p, 5.6, -4.6, 1.5, 1.2, 'straw')
    props.sign_board(p, rect, 'front', 0, 5.3, 4.0, 0.7, 'sign_cream', 'teak_dark', out=0.05)
    pw.ox_cart(p, -1.0, -5.8, facing=180) if r in ('northeast', 'north') else props.sacks(p, -1.0, -5.8, 4)
    tops = e2.pole(p, 7.0, -7.0, 8.5, 0)
    drop_to(b, tops, rect[2] - 0.2, rect[1] - 0.05, 6.0)
    regions.plant(b, -6.6, -6.4, 1, big=False)
    b.path(-7.9, -7.9, 7.9, -3.7, path_mat(b), z=0.05)


@building('factory_4', 4, 'โรงสีและโรงน้ำแข็ง', 'Rice mill and ice works')
def factory_4(b):
    """The town's big works on a joined lot: a large rice mill, a brick ice works with blocks of ice being loaded,
    a tall brick chimney, a water tank on a tower, a yard of paddy drying on mats, sacks and poles with wires."""
    yard(b)
    r = b.region
    m = b.main
    p = b.props
    mill = (-14.4, -1.0, -2.0, 11.0)
    top = mill_house(b, mill, 8.5, axis='y')
    kit.block(m, mill[0], mill[1] - 2.2, 0, mill[2], mill[1], 0.8, 'concrete')
    for k in range(10):
        props.sacks(p, -13.6 + k * 1.2, -2.8, 4)
    kit.block(m, -2.0, 8.0, 0, -0.8, 9.2, 11.0, 'zinc')
    p.rod((-1.4, 8.6, 10.8), (-6.0, 7.0, top - 0.4), 0.14, 'zinc_dark', seg=6)
    ice = (1.6, -1.0, 14.4, 8.6)
    kit.walls(m, ice, 0, 5.6, 'brick', bevel=0.0)
    kit.bands(m, ice, 0, 0.5, 0.03, 'brick_dark')
    kit.bands(m, ice, 5.3, 0.3, 0.06, 'brick_dark')
    kit.corner_posts(m, ice, 0, 5.6, 0.5, 'brick_dark')
    for u in kit.spread(12.8, 4, 0.8):
        kit.window(m, ice, 'front', u, 3.0, 1.2, 1.5, frame='brick_dark', glass='window_dark', bars=3)
    for u in kit.spread(9.6, 3, 0.8):
        kit.window(m, ice, 'right', u, 2.4, 1.2, 1.5, frame='brick_dark', glass='window_dark', bars=3)
    kit.door(m, ice, 'front', 0.0, 0.0, 2.4, 2.6, leaf='iron', frame='brick_dark', panels=False)
    kit.gable_ribbed(m, ice, 5.6, 2.6, 'zinc', 'zinc_dark', over=0.5, over_ends=0.4, axis='x', pitch=0.7)
    kit.prism_x(m, [(ice[1], 5.6), (ice[3], 5.6), ((ice[1] + ice[3]) / 2, 8.15)], ice[0] + 0.02, ice[2] - 0.02,
                'brick')
    props.sign_board(p, ice, 'front', 0, 5.75, 5.0, 0.8, 'sign_blue', 'teak_dark', out=0.02)
    for k in range(6):
        kit.block(p, 4.6 + (k % 3) * 0.7, -3.0 - (k // 3) * 0.6, 0, 5.2 + (k % 3) * 0.7, -2.5 - (k // 3) * 0.6, 0.5,
                  'e2_ice')
    for k in range(3):
        kit.block(p, 4.9 + k * 0.7, -2.95, 0.5, 5.5 + k * 0.7, -2.45, 1.0, 'e2_ice')
    p.box((1.2, 0.8, 0.05), 'straw', T(7.6, -2.8, 0.03))
    props.chimney(m, 9.0, 11.8, 18.0, 0.8, 0.5, 'brick', 'brick_dark')
    props.smoke(p, 9.2, 12.0, 18.9, 4, 1.0)
    e2.water_tower(m, 13.0, 12.6, 7.0, 1.6, 2.4, 'zinc', 'iron')
    props.pipe_run(p, [(13.0, 11.0, 0.6), (13.0, 9.2, 0.6), (13.0, 8.6, 0.6)], 0.12, 'metal')
    # paddy drying on mats in the yard
    for k in range(3):
        y = -14.4 + k * 2.8
        kit.block(b.yard, -14.4, y, 0, -3.0, y + 2.2, 0.06, 'canvas')
        kit.block(b.yard, -14.2, y + 0.2, 0.06, -3.2, y + 2.0, 0.1, 'hay')
        for j in range(6):
            kit.block(b.yard, -13.8 + j * 1.8, y + 0.3, 0.1, -13.6 + j * 1.8, y + 1.9, 0.12, 'straw')
    p.rod((-2.6, -8.0, 0.1), (-1.6, -9.0, 1.5), 0.03, 'teak', seg=4)
    p.box((0.6, 0.1, 0.12), 'teak', T(-2.7, -7.9, 0.08))
    e2.drums(p, 1.0, 12.0, 3, 'paint_blue')
    tops = e2.pole_line(p, [(-15.2, -15.0), (0.0, -15.0), (15.2, -15.0)], 9.0, sag=0.8)
    drop_to(b, tops[1], -2.1, -1.0, 6.5)
    drop_to(b, tops[2], 14.4, -1.0, 4.8)
    for k, (x, y) in enumerate(((14.6, -14.0), (-15.0, 14.6), (0.0, 14.8))):
        regions.plant(b, x, y, k + 1)
    b.path(-1.5, -15.9, 1.5, -1.0, path_mat(b), z=0.06)
    b.path(1.5, -4.0, 14.4, -1.0, 'concrete', z=0.06)


# services (3x3 tiles, 47 m) --------------------------------------------------------------------------------------------

def fence_round(b, e, gate_w=4.0, wall=False, h=1.2):
    """A fence round the lot with a gap in the front middle: a low plastered wall (government buildings) or a
    timber picket fence."""
    pts = [(-gate_w / 2, -e), (-e, -e), (-e, e), (e, e), (e, -e), (gate_w / 2, -e)]
    if wall:
        props.fence(b.props, pts, h, regions.plaster(b.region, 1), kind='wall', post_mat='e2_moulding')
    else:
        props.fence(b.props, pts, h, fence_mat(b), spacing=0.3)


def gate_pillars(b, x, y, w=4.0, lamps=True):
    """Two plastered gate pillars with caps (and lamps)."""
    for s in (-1, 1):
        cx = x + s * (w / 2 + 0.35)
        kit.block(b.main, cx - 0.35, y - 0.35, 0, cx + 0.35, y + 0.35, 2.2, 'e2_moulding', bevel=0.03)
        kit.block(b.main, cx - 0.45, y - 0.45, 2.2, cx + 0.45, y + 0.45, 2.4, 'plaster', bevel=0.03)
        if lamps:
            b.props.cyl(0.14, 0.14, 0.4, 'lamp', T(cx, y, 2.6), seg=8)
            b.props.cyl(0.2, 0.05, 0.15, 'iron', T(cx, y, 2.86), seg=8)


def name_sign(b, rect, z, w=5.0, mat='sign_cream'):
    props.sign_board(b.props, rect, 'front', 0, z, w, 0.7, mat, 'teak_dark', out=0.08)


@building('ruler_house', None, 'จวนเจ้าเมือง', 'Ruler’s mansion')
def ruler_house(b):
    """The ruler's mansion: a long two-storey house, plastered below and timber above, a two-storey portico with a
    balcony and its own gable, two single-storey wings, a lawn with a lotus pond, the flag, a plastered wall with
    lamp-topped gate pillars and big trees."""
    yard(b)
    r = b.region
    p = b.props
    st = regions.style(r)
    main = e2.townhouse(b, (-12.0, 4.0, 12.0, 14.0), 0, axis='x', door_u=0.0, porch=False)
    zt = main['eave']
    z1 = 0.45 + e2.HOME
    por = (-3.6, -0.4, 3.6, 4.0)
    kit.block(b.main, por[0], por[1], 0, por[2], por[3], 0.45, 'stone', bevel=0.03)
    for k in range(3):
        kit.block(b.main, -2.6, por[1] - 0.3 - k * 0.3, 0, 2.6, por[1] - k * 0.3, 0.45 - (k + 1) * 0.15, 'stone')
    for x in (por[0] + 0.3, -1.2, 1.2, por[2] - 0.3):
        kit.block(b.main, x - 0.22, por[1] + 0.1, 0.45, x + 0.22, por[1] + 0.54, zt, 'e2_moulding')
    kit.floor_deck(b.main, por, z1, 'plank' if r != 'south' else 'paving', 0.2, edge=st['trim'])
    kit.railing(b.main, [(por[0], por[3]), (por[0], por[1]), (por[2], por[1]), (por[2], por[3])], z1,
                st['trim'] if r != 'south' else 'e2_moulding', spacing=0.15)
    regions.house_roof(b.main, por, zt, r, None, axis='y', over=0.4, over_ends=0.5)
    kit.door(b.main, main['rect'], 'front', 0.0, z1, 1.4, 2.3, leaf=st['shutter'], frame=st['trim'])
    for s in (-1, 1):
        wx0, wx1 = (-21.0, -12.4) if s < 0 else (12.4, 21.0)
        e2.townhouse(b, (wx0, 2.0, wx1, 10.0), 2, axis='y', door_side='front', porch=True, upper=False)
    props.flag_pole(p, 0.0, -17.5, 10.0)
    kit.block(b.yard, -1.0, -18.5, 0, 1.0, -16.5, 0.3, 'stone')
    kit.block(b.yard, -15.0, -14.0, 0, -3.0, -4.0, 0.06, 'grass')
    kit.block(b.yard, 3.0, -14.0, 0, 15.0, -4.0, 0.06, 'grass')
    pr.water_pond(b.yard, -12.0, -12.0, -5.0, -6.0)
    for x, y in ((-11.0, -6.6), (-6.0, -11.4), (-8.5, -6.4)):
        pr.lotus_pot(p, x, y + 0.0, 0.0, 0.4)
    for k in range(6):
        props.bush(p, 4.5 + k * 1.9, -5.0, 0.55, k + 30, flowers=('flower_red', 'flower_pink', 'flower_yellow')[k % 3])
    props.tree(p, 10.0, -10.0, 9.0, 3.6, 41)
    props.spirit_house(p, 18.0, -18.0)
    fence_round(b, 23.4, 5.0, wall=True)
    gate_pillars(b, 0.0, -23.4, 5.0)
    tops = e2.pole_line(p, [(-22.6, -22.6), (-8.0, -22.6)], 8.5)
    drop_to(b, tops[1], -12.0, 4.0, 5.6)
    regions.border(b, 22.0, 7.0, 1)
    b.path(-1.8, -23.9, 1.8, -0.8, path_mat(b) if r != 'northeast' else 'paving', z=0.06)
    b.path(-12.0, -2.4, 12.0, 2.0, 'paving', z=0.05)
    for k, (x, y) in enumerate(((-20.0, -16.0), (-20.0, 18.0), (20.0, 18.0))):
        regions.plant(b, x, y, k)
    regions.craft(b, 16.0, 14.0)


@building('school', None, 'โรงเรียนไม้สองชั้น', 'Two-storey timber school')
def school(b):
    """A long two-storey timber school with open corridors on both floors behind a railing, stairs at both ends, a
    tiled roof over all; the flag on a stone base, a bell, a playing field with goals, a well and shade trees."""
    yard(b)
    r = b.region
    st = regions.style(r)
    m = b.main
    p = b.props
    trim = st['trim']
    body = (-15.0, 7.0, 15.0, 14.0)
    cor = (-15.0, 4.6, 15.0, 7.0)
    whole = (-15.0, 4.6, 15.0, 14.0)
    z1 = 0.6 + 3.2
    zt = z1 + 3.2
    kit.block(m, whole[0] - 0.2, whole[1] - 0.2, 0, whole[2] + 0.2, whole[3] + 0.2, 0.6, 'concrete', bevel=0.03)
    regions.house_walls(m, body, 0.6, zt, r)
    kit.bands(m, body, z1 - 0.1, 0.2, 0.06, trim)
    for k in range(5):
        u = -12.0 + k * 6.0
        kit.door(m, body, 'front', u - 1.4, 0.6, 1.0, 2.2, leaf=st['shutter'], frame=trim)
        kit.door(m, body, 'front', u - 1.4, z1, 1.0, 2.2, leaf=st['shutter'], frame=trim)
        for du in (0.4, 1.8):
            e2.house_window(m, body, 'front', u + du, 1.5, r, 0.9, 1.3)
            e2.house_window(m, body, 'front', u + du, z1 + 0.9, r, 0.9, 1.3)
    for u in kit.spread(30.0, 10, 0.8):
        e2.house_window(m, body, 'back', u, 1.5, r, 0.9, 1.3)
        e2.house_window(m, body, 'back', u, z1 + 0.9, r, 0.9, 1.3)
    for side in ('left', 'right'):
        for u in (-1.5, 1.5):
            e2.house_window(m, body, side, u, z1 + 0.9, r, 0.9, 1.3)
    # the corridors: posts, the upper floor and its railing
    for i in range(11):
        x = cor[0] + 0.15 + (cor[2] - cor[0] - 0.3) * i / 10
        kit.block(m, x - 0.12, cor[1] + 0.03, 0.6, x + 0.12, cor[1] + 0.27, zt, trim)
    kit.floor_deck(m, (cor[0], cor[1], cor[2], body[1]), z1, 'plank', 0.18, edge=trim, boards=60, board_mat=trim)
    kit.railing(m, [(cor[0], cor[1] + 0.15), (cor[2], cor[1] + 0.15)], z1, trim, spacing=0.15)
    regions.house_roof(m, whole, zt, r, None, axis='x', over=0.9, over_ends=0.7)
    kit.gutter(m, whole, 'front', zt - 0.75, 'zinc_dark')
    for s, d in ((-1, '-x'), (1, '+x')):
        houses.stair_flight(m, s * 15.0, 5.8, z1, 1.3, d, 'plank', rail=trim)
    name_sign(b, (-15, 4.4, 15, 14), zt - 1.0, 6.0)
    props.flag_pole(p, 0.0, -4.0, 10.0)
    kit.block(b.yard, -1.2, -5.2, 0, 1.2, -2.8, 0.35, 'stone')
    for k in range(3):
        kit.block(b.yard, -1.6 + k * 0.2, -5.6 + k * 0.2, 0, 1.6 - k * 0.2, -2.4 - k * 0.2, 0.12 * (k + 1), 'stone')
    kit.block(b.yard, -20.0, -21.0, 0, 8.0, -8.0, 0.05, 'grass')
    for x in (-19.0, 7.0):
        p.box((0.1, 3.0, 0.1), 'paint_white', T(x, -14.5, 2.0))
        for s in (-1, 1):
            p.box((0.1, 0.1, 2.0), 'paint_white', T(x, -14.5 + s * 1.5, 1.0))
    for x in (-6.0,):
        kit.block(b.yard, x - 0.05, -21.0, 0.05, x + 0.05, -8.0, 0.07, 'paint_white')
    for s in (-1, 1):
        kit.block(p, 12.0 + s * 0.9, -4.0, 0, 12.0 + s * 0.9 + 0.12, -3.88, 2.6, 'teak_dark')
    kit.block(p, 11.0, -4.05, 2.5, 13.1, -3.83, 2.65, 'teak_dark')
    p.cyl(0.25, 0.3, 0.45, 'gold', T(12.06, -3.95, 2.2), seg=10)
    pw.well(p, 18.0, -2.0, 0.85, roof_mat='clay_tile')
    for k in range(4):
        props.bench(p, -12.0 + k * 3.0, 1.2, 2.2)
    fence_round(b, 23.4, 4.0)
    gate_pillars(b, 0.0, -23.4, 4.0, lamps=False)
    tops = e2.pole_line(p, [(22.6, -22.6), (22.6, 2.0)], 8.5)
    drop_to(b, tops[1], 15.0, 10.0, 6.0)
    for k, (x, y) in enumerate(((-21.0, 0.0), (-21.0, 20.0), (21.0, 20.0), (16.0, -16.0), (12.0, -10.0))):
        regions.plant(b, x, y, k)
    props.tree(p, 16.0, -12.0, 9.0, 3.6, 21)
    regions.border(b, 22.0, 8.0, 2, sides=('back',))
    b.path(-1.4, -23.9, 1.4, -5.6, path_mat(b), z=0.06)
    b.path(-16.0, -1.0, 16.0, 4.4, path_mat(b), z=0.05)


@building('hospital', None, 'สถานีอนามัย', 'Health centre')
def hospital(b):
    """The town's health centre: a two-storey house, plastered below and timber above, with an upstairs veranda,
    a green sign with a white H (no red cross), a waiting pavilion with benches, herb beds, a rain cistern and a
    well."""
    yard(b)
    r = b.region
    p = b.props
    info = e2.townhouse(b, (-12.0, 2.0, 12.0, 10.0), 1, axis='x', door_u=0.0, porch=r == 'south',
                        veranda=r != 'south')
    if r != 'south':
        for k in range(3):
            p.box((2.4, 0.3, 0.15), 'stone', T(0.0, 2.0 - 1.75 - k * 0.28, 0.3 - k * 0.15))
    rect = info['rect']
    zt = info['eave']
    sign_rect = (rect[0], rect[1] - (1.7 if r != 'south' else 0.0), rect[2], rect[3])
    props.sign_board(p, sign_rect, 'front', -6.0, zt - 0.5 if r != 'south' else zt - 0.9, 4.0, 0.8, 'sign_green',
                     'teak_dark', out=0.05)
    hx, hy, hz = -8.6, sign_rect[1] - 0.2, (zt - 0.1 if r != 'south' else zt - 0.5)
    for dx in (-0.16, 0.16):
        p.box((0.08, 0.06, 0.5), 'paint_white', T(hx + dx, hy, hz))
    p.box((0.32, 0.06, 0.08), 'paint_white', T(hx, hy, hz))
    houses.pavilion(b.main, (-20.0, -10.0, -10.0, -3.0), 0.45, 2.8, r, 'clay_tile', rail=False)
    for k in range(3):
        props.bench(p, -15.0, -8.6 + k * 1.8, 3.6)
    for i in range(4):
        x = 5.0 + i * 3.6
        kit.block(b.yard, x - 1.2, -16.0, 0.0, x + 1.2, -5.0, 0.25, 'dirt_dark')
        for j in range(5):
            props.bush(p, x, -15.0 + j * 2.2, 0.4, i * 7 + j, ('leaf', 'leaf_dark', 'leaf_light')[(i + j) % 3])
    p.cyl(1.4, 1.4, 2.2, 'concrete', T(15.0, 13.0, 1.1), seg=16)
    p.cyl(1.5, 1.5, 0.15, 'concrete_dark', T(15.0, 13.0, 2.25), seg=16)
    p.rod((12.0, 10.0, info['eave'] - 0.6), (14.0, 12.0, 2.3), 0.06, 'zinc_dark', seg=6)
    pw.well(p, -16.0, 13.0, 0.8, roof_mat='clay_tile')
    fence_round(b, 23.4, 4.0, wall=True)
    gate_pillars(b, 0.0, -23.4, 4.0)
    tops = e2.pole_line(p, [(-22.6, -22.6), (-22.6, 0.0)], 8.5)
    drop_to(b, tops[1], -12.0, 6.0, 5.6)
    regions.border(b, 22.0, 7.5, 3, sides=('back', 'right'))
    for k, (x, y) in enumerate(((-20.0, 18.0), (-20.0, -18.0), (20.0, -20.0))):
        regions.plant(b, x, y, k)
    b.path(-1.4, -23.9, 1.4, 0.0, path_mat(b), z=0.06)


@building('police', None, 'สถานีตำรวจ', 'Police station')
def police(b):
    """The police station: a two-storey house with a porch, plastered below and timber above, a name board, the
    flag, a sentry box at the gate, a lock-up behind with barred windows and a low plastered wall."""
    yard(b)
    r = b.region
    p = b.props
    info = e2.townhouse(b, (-10.0, 2.0, 10.0, 10.0), 2, axis='x', door_u=0.0)
    name_sign(b, info['rect'], 0.45 + e2.HOME + 0.15, 4.6, 'sign_blue')
    lock = e2.townhouse(b, (11.0, 12.0, 19.0, 18.0), 0, axis='x', door_side='front', door_u=-2.6, porch=False,
                        upper=False, windows={'front': 3, 'back': 2, 'left': 1, 'right': 1})
    props.flag_pole(p, 0.0, -6.0, 10.0)
    kit.block(b.yard, -1.0, -7.0, 0, 1.0, -5.0, 0.3, 'stone')
    sb = (3.0, -22.6, 4.4, -21.2)
    kit.block(b.main, sb[0], sb[1], 0, sb[2], sb[3], 2.3, 'plank')
    kit.window(b.main, sb, 'front', 0.0, 1.1, 0.8, 0.7, frame='teak_dark', mullion=False)
    kit.window(b.main, sb, 'left', 0.0, 1.1, 0.8, 0.7, frame='teak_dark', mullion=False)
    regions.house_roof(b.main, sb, 2.3, r, None, axis='x', over=0.3, over_ends=0.3, courses=2)
    for k in range(3):
        kit.block(b.yard, -16.0 + k * 3.0, -14.0, 0, -14.4 + k * 3.0, -8.0, 0.06, 'grass')
    props.tree(p, -14.0, -2.0, 8.0, 3.2, 33)
    fence_round(b, 23.4, 4.0, wall=True)
    gate_pillars(b, 0.0, -23.4, 4.0)
    tops = e2.pole_line(p, [(22.6, -22.6), (22.6, 0.0)], 8.5)
    drop_to(b, tops[1], 10.0, 6.0, 5.6)
    e2.townhouse(b, (-20.0, 4.0, -12.0, 12.0), 1, axis='y', door_side='right', door_u=0.0, upper=False)
    regions.border(b, 22.0, 7.5, 6, sides=('back',))
    for k, (x, y) in enumerate(((16.0, -16.0), (-20.0, -20.0))):
        regions.plant(b, x, y, k)
    b.path(-1.6, -23.9, 1.6, 2.0, path_mat(b), z=0.06)
    b.path(-1.0, 10.0, 12.0, 12.0, path_mat(b), z=0.05)


@building('fire', None, 'สถานีดับเพลิง', 'Fire station and watch tower')
def fire(b):
    """The fire station: a timber engine house with wide doors open on two hand-pumped fire carts, a tall timber
    watch tower with a bell, a brick cistern, hoses drying, red buckets on a rack and big water jars."""
    yard(b)
    r = b.region
    st = regions.style(r)
    m = b.main
    p = b.props
    rect = (-14.0, 2.0, 4.0, 12.0)
    kit.block(m, rect[0] - 0.2, rect[1] - 0.2, 0, rect[2] + 0.2, rect[3] + 0.2, 0.3, 'concrete', bevel=0.02)
    if r in ('south', 'northeast'):
        e2.plaster_walls(m, rect, 0.3, 4.6, regions.plaster(r, 0))
    else:
        regions.house_walls(m, rect, 0.3, 4.6, r)
    for u in (-6.0, 0.0, 6.0):
        kit.folding_doors(m, rect, 'front', u, 0.3, 3.6, 3.4, leaf='paint_red', frame=st['trim'], open_=0.85)
    for u in (-3.0, 3.0):
        e2.house_window(m, rect, 'left', u, 1.6, r, 0.9, 1.2)
    regions.house_roof(m, rect, 4.6, r, None, axis='x', over=0.8, over_ends=0.6)
    props.sign_board(p, rect, 'front', 0, 3.9, 6.0, 0.55, 'sign_red', 'teak_dark', out=0.05)
    e2.pump_cart(p, -11.0, -0.6, facing=90)
    e2.pump_cart(p, -5.0, 0.2, facing=80)
    pw.watch_tower(m, 13.0, 9.0, 11.0, 3.0, roof_mat=None, region=r, thatch=False)
    p.cyl(0.35, 0.45, 0.6, 'gold', T(13.0, 9.0, 12.4), seg=10)
    p.rod((13.0, 9.0, 12.4), (13.6, 6.0, 0.9), 0.012, 'rope', seg=3)
    for s in (-1, 1):
        p.box((0.12, 0.12, 6.0), 'teak_dark', T(8.0 + s * 1.6, 15.0, 3.0))
    p.box((3.4, 0.1, 0.1), 'teak_dark', T(8.0, 15.0, 6.0))
    for k in range(4):
        p.box((0.18, 0.05, 5.6), ('canvas', 'cream')[k % 2], T(6.8 + k * 0.8, 15.0, 3.1))
    kit.block(m, -20.0, -8.0, 0, -14.0, -2.0, 1.4, 'brick', bevel=0.03)
    kit.block(m, -19.7, -7.7, 1.2, -14.3, -2.3, 1.35, 'water')
    for k in range(6):
        props.water_jar(p, 4.0 + k * 1.3, -6.0, 1.05)
    e2.bucket_row(p, -12.0, -6.0, 8, 0.5)
    for s in (-1, 1):
        p.box((0.1, 0.1, 1.4), 'teak_dark', T(-10.25 + s * 2.2, -6.6, 0.7))
    p.box((4.6, 0.1, 0.08), 'teak_dark', T(-10.25, -6.6, 1.3))
    for k in range(4):
        p.torus(0.35, 0.08, 'canvas', T(-12.0 + k * 1.2, -6.6, 0.95) @ R(90, 0, 0), seg=10, seg_minor=4)
    props.flag_pole(p, -6.0, -14.0, 9.0)
    q = e2.townhouse(b, (10.0, -18.0, 20.0, -11.0), 1, axis='x', door_u=-2.0)
    kit.block(b.yard, -20.0, -20.0, 0, -10.0, -10.0, 0.06, 'paving_dark')
    pw.drum(p, -15.0, -15.0, 1.0, 0.5)
    for k in range(3):
        p.rod((-19.0 + k * 1.2, -12.0, 0.05), (-18.6 + k * 1.2, -11.2, 4.2), 0.04, 'teak', seg=4)
    fence_round(b, 23.4, 6.0)
    gate_pillars(b, 0.0, -23.4, 6.0, lamps=True)
    tops = e2.pole_line(p, [(-22.6, -22.6), (-22.6, 0.0)], 8.5)
    drop_to(b, tops[1], -14.0, 6.0, 3.8)
    regions.border(b, 22.0, 7.5, 4, sides=('back',))
    for k, (x, y) in enumerate(((20.0, -18.0), (-20.0, 14.0), (20.0, 2.0))):
        regions.plant(b, x, y, k)
    b.path(-8.0, -23.9, 8.0, 2.0, 'paving' if r != 'northeast' else 'laterite', z=0.06)


@building('water_works', None, 'โรงสูบน้ำและหอถังสูง', 'Pump house and water tower')
def water_works(b):
    """The town's first piped water: a settling pond, a brick pump house with a little steam chimney, pipes to a
    big steel tank on a braced tower, and a tap stand where people fill their buckets."""
    yard(b)
    r = b.region
    m = b.main
    p = b.props
    pr.water_pond(b.yard, -22.0, 6.0, -4.0, 22.0)
    pr.jetty(m, -10.0, 5.0, -8.0, 10.0, 0.5)
    ph = (-14.0, -6.0, -4.0, 2.0)
    kit.walls(m, ph, 0, 4.2, 'brick', bevel=0.0)
    kit.bands(m, ph, 0, 0.5, 0.03, 'brick_dark')
    kit.bands(m, ph, 3.9, 0.3, 0.06, 'brick_dark')
    kit.corner_posts(m, ph, 0, 4.2, 0.45, 'brick_dark')
    for u in (-3.0, 3.0):
        kit.window(m, ph, 'front', u, 1.6, 1.1, 1.6, frame='brick_dark', bars=3)
    kit.door(m, ph, 'front', 0.0, 0.0, 1.6, 2.4, leaf='paint_green', frame='brick_dark')
    kit.window(m, ph, 'right', 0.0, 1.6, 1.1, 1.6, frame='brick_dark', bars=3)
    kit.gable_ribbed(m, ph, 4.2, 2.2, 'zinc', 'zinc_dark', over=0.5, over_ends=0.4, axis='x', pitch=0.6)
    kit.prism_x(m, [(ph[1], 4.2), (ph[3], 4.2), ((ph[1] + ph[3]) / 2, 6.35)], ph[0] + 0.02, ph[2] - 0.02, 'brick')
    props.chimney(m, -5.0, 1.2, 9.0, 0.3, 0.22, 'brick', 'brick_dark')
    props.smoke(p, -4.8, 1.4, 9.7, 2, 0.6)
    props.sign_board(p, ph, 'front', 0, 3.0, 3.4, 0.5, 'sign_blue', 'teak_dark', out=0.05)
    e2.water_tower(m, 8.0, 6.0, 12.0, 2.4, 3.4, 'steel', 'iron')
    props.pipe_run(p, [(-9.0, 7.0, 0.3), (-9.0, 2.0, 0.3)], 0.18, 'metal')
    props.pipe_run(p, [(-4.0, -1.0, 0.6), (8.0, -1.0, 0.6), (8.0, 6.0, 0.6)], 0.16, 'metal')
    props.pipe_run(p, [(8.0, 3.0, 0.6), (8.0, -14.0, 0.6), (2.0, -14.0, 0.6)], 0.1, 'metal')
    # a tap stand by the gate
    kit.block(m, 0.0, -15.0, 0, 4.0, -13.0, 0.3, 'concrete')
    for k in range(3):
        p.rod((0.8 + k * 1.2, -14.0, 0.6), (0.8 + k * 1.2, -14.0, 1.1), 0.04, 'metal', seg=6)
        p.rod((0.8 + k * 1.2, -14.0, 1.1), (0.8 + k * 1.2, -14.3, 1.0), 0.03, 'metal', seg=6)
    e2.bucket_row(p, 0.6, -15.6, 5, 0.6)
    for k in range(3):
        x0 = -21.0 + k * 5.4
        kit.block(m, x0, -19.0, 0, x0 + 4.8, -9.0, 0.9, 'concrete', bevel=0.02)
        kit.block(m, x0 + 0.25, -18.75, 0.9, x0 + 4.55, -9.25, 0.92, 'water')
        kit.block(m, x0 + 2.3, -19.0, 0.9, x0 + 2.5, -9.0, 1.0, 'concrete_dark')
    props.pipe_run(p, [(-18.6, -9.0, 0.6), (-18.6, -6.8, 0.6), (-14.0, -6.8, 0.6)], 0.14, 'metal')
    e2.townhouse(b, (10.0, -20.0, 19.0, -13.0), 2, axis='x', door_u=0.0, upper=False)
    fence_round(b, 23.4, 4.0)
    gate_pillars(b, 0.0, -23.4, 4.0, lamps=False)
    tops = e2.pole_line(p, [(22.6, -22.6), (22.6, -6.0)], 8.5)
    drop_to(b, tops[1], -4.0, -4.0, 3.8)
    for k, (x, y) in enumerate(((20.0, 20.0), (20.0, -20.0), (-20.0, -20.0), (14.0, 14.0))):
        regions.plant(b, x, y, k)
    pr.boat(p, -16.0, 16.0, 3.6, facing=30)
    b.path(-1.4, -23.9, 1.4, -6.0, path_mat(b), z=0.06)


@building('power_plant', None, 'โรงไฟฟ้าเครื่องจักรไอน้ำ', 'Steam and diesel power house')
def power_plant(b):
    """The town's first electricity: a long brick engine house under a zinc roof with arched windows, a tall
    brick chimney, a fuel tank and oil drums, a woodpile for the boiler, a cooling pond, and the poles that carry
    the wires out to the town."""
    yard(b)
    r = b.region
    m = b.main
    p = b.props
    eh = (-16.0, -5.0, 8.0, 8.0)
    kit.walls(m, eh, 0, 6.0, 'brick', bevel=0.0)
    kit.bands(m, eh, 0, 0.6, 0.04, 'brick_dark')
    kit.bands(m, eh, 5.6, 0.4, 0.08, 'brick_dark')
    kit.corner_posts(m, eh, 0, 6.0, 0.5, 'brick_dark')
    for u in kit.spread(24.0, 6, 1.0):
        e2.arched_window(m, eh, 'front', u, 1.6, 1.4, 2.4, frame='brick_dark', shutter='rust', mould='brick_dark')
    for u in (-3.0, 3.0):
        e2.arched_window(m, eh, 'left', u, 1.6, 1.4, 2.4, frame='brick_dark', shutter='rust', mould='brick_dark')
    kit.door(m, eh, 'right', 0.0, 0.0, 2.6, 3.4, leaf='iron', frame='brick_dark', panels=False)
    top = kit.gable_ribbed(m, eh, 6.0, 3.0, 'zinc', 'zinc_dark', over=0.5, over_ends=0.4, axis='x', pitch=0.7)
    kit.prism_x(m, [(eh[1], 6.0), (eh[3], 6.0), ((eh[1] + eh[3]) / 2, top - 0.05)], eh[0] + 0.02, eh[2] - 0.02,
                'brick')
    kit.gable_ribbed(m, (-12.0, 0.7, 4.0, 2.3), top, 0.6, 'zinc', 'zinc_dark', over=0.3, over_ends=0.2, axis='x')
    props.sign_board(p, eh, 'front', 0, 4.6, 5.0, 0.6, 'sign_cream', 'teak_dark', out=0.05)
    props.chimney(m, 10.0, 6.0, 22.0, 1.0, 0.6, 'brick', 'brick_dark')
    props.smoke(p, 10.2, 6.2, 23.0, 4, 1.2)
    p.rod((8.0, 4.0, 3.0), (9.2, 5.6, 3.0), 0.4, 'brick_dark', seg=8)
    props.tank(p, 15.0, -8.0, 2.4, 4.0, 'zinc', 'cone')
    e2.drums(p, 12.0, -14.0, 6, 'paint_blue')
    e2.log_pile(p, 2.0, -12.0, 6.0, 3, 0.3)
    houses.open_shed(m, (-21.0, -19.0, -9.0, -11.0), 3.2, 'zinc', posts_mat='teak_dark', low_side='front', rise=0.8)
    for x in (-19.0, -16.0, -13.0, -10.5):
        props.woodpile(p, x, -16.0, 2.4, 4)
        props.woodpile(p, x, -13.0, 2.4, 3)
    e2.townhouse(b, (3.0, -21.5, 11.5, -16.0), 0, axis='x', door_u=0.0, upper=False)
    pr.water_pond(b.yard, -22.0, 12.0, -2.0, 21.0)
    props.pipe_run(p, [(-8.0, 8.0, 0.5), (-8.0, 12.5, 0.5)], 0.2, 'metal')
    # the line out: a transformer between two poles, then poles to the front
    for x in (16.0, 19.0):
        p.cyl(0.14, 0.11, 8.5, 'teak_dark', T(x, 2.0, 4.25), seg=8)
    kit.block(p, 15.6, 1.4, 4.2, 19.4, 2.6, 4.35, 'teak')
    p.box((1.0, 0.8, 1.4), 'grey', T(17.5, 2.0, 5.1))
    tops = e2.pole_line(p, [(17.5, 2.0), (22.6, -8.0), (22.6, -22.6)], 8.5, sag=0.6)
    drop_to(b, tops[0], 8.0, 4.0, 5.4)
    e2.pole_line(p, [(-22.6, -22.6), (0.0, -22.6)], 8.5)
    fence_round(b, 23.4, 4.0)
    gate_pillars(b, 0.0, -23.4, 4.0, lamps=False)
    for k, (x, y) in enumerate(((20.0, 20.0), (-20.0, -18.0), (14.0, 14.0))):
        regions.plant(b, x, y, k)
    b.path(-1.6, -23.9, 1.6, -4.0, path_mat(b), z=0.06)


@building('waste', None, 'เตาเผาขยะ', 'Rubbish incinerator')
def waste(b):
    """Where the town's rubbish goes: a brick incinerator with a fire door and a chimney, a zinc sorting shed with
    heaps and baskets, compost pens, hand carts and a thin smoke."""
    yard(b)
    m = b.main
    p = b.props
    inc = (-5.0, 3.0, 5.0, 11.0)
    kit.walls(m, inc, 0, 4.6, 'brick', bevel=0.0)
    kit.bands(m, inc, 4.3, 0.3, 0.08, 'brick_dark')
    kit.corner_posts(m, inc, 0, 4.6, 0.5, 'brick_dark')
    for u in (-2.0, 2.0):
        kit.on_face(m, inc, 'front', u, 0.4, 1.4, 1.0, 0.1, 'black')
        kit.on_face(m, inc, 'front', u, 0.3, 1.6, 1.2, 0.06, 'iron')
    kit.stairs(m, 5.0, 7.0, 4.6, 1.0, '+x', 'iron', stringer='iron')
    kit.block(m, inc[0], inc[1], 4.6, inc[2], inc[3], 4.8, 'concrete_dark')
    props.chimney(m, 0.0, 8.0, 14.0, 0.6, 0.4, 'brick', 'brick_dark', z=4.8)
    props.smoke(p, 0.2, 8.2, 19.4, 3, 0.9)
    houses.open_shed(m, (-18.0, -8.0, -6.0, 2.0), 3.4, 'zinc', posts_mat='teak_dark', low_side='front', rise=1.0)
    for k, (x, y) in enumerate(((-15.0, -4.0), (-11.0, -3.0), (-8.0, -5.0))):
        e2.mound(p, x, y, 1.6, 1.0, ('dirt_dark', 'grey', 'straw')[k])
    for k in range(6):
        p.cyl(0.32, 0.26, 0.55, 'straw', T(-16.0 + k * 1.4, 0.6, 0.28), seg=10)
    for i in range(3):
        pw.compost_pen(p, 10.0 + i * 3.6, 12.0, 3.0)
    for k in range(3):
        e2.mound(p, 8.0 + k * 3.0, -2.0, 1.4, 0.8, ('dirt_dark', 'grey')[k % 2])
    for k in range(2):
        e2.vendor_cart(p, -2.0 + k * 3.0, -8.0, facing=20, stripes=('zinc', 'zinc_dark'))
    e2.drums(p, 14.0, -18.0, 4, 'rust')
    houses.open_shed(m, (6.0, -15.0, 18.0, -7.0), 3.0, 'rust', posts_mat='teak_dark', low_side='front', rise=0.8)
    for k in range(4):
        for j in range(3):
            x, y = 7.5 + k * 3.0, -13.5 + j * 2.4
            if (k + j) % 2:
                props.barrel(p, x, y, ('paint_blue', 'rust', 'grey')[(k + j) % 3], 0.7)
                continue
            for i in range(8):
                p.cyl(0.05, 0.05, 0.28, ('glass', 'glass_green', 'glass_dark')[i % 3],
                      T(x - 0.4 + (i % 4) * 0.25, y - 0.2 + (i // 4) * 0.25, 0.14), seg=6)
    houses.stilt_house(b, -15.0, 14.0, 5.0, 3.6, floor_z=1.6, wall_h=2.5)
    fence_round(b, 23.4, 4.0)
    gate_pillars(b, 0.0, -23.4, 4.0, lamps=False)
    regions.border(b, 22.0, 7.5, 5)
    b.path(-1.6, -23.9, 1.6, 4.0, path_mat(b), z=0.06)


@building('station', None, 'สถานีรถไฟ', 'Railway halt')
def station(b):
    """A small railway halt: a piece of metre-gauge track across the lot, a raised platform with a canopy, a
    timber station house with a ticket window and name boards, benches and lamps, a water tank for the steam
    engines with its crane, a signal post and a forecourt to the road."""
    yard(b)
    r = b.region
    st = regions.style(r)
    m = b.main
    p = b.props
    trim = st['trim']
    e2.rail_track(m, -23.9, 23.9, 12.0)
    pf = (-20.0, 3.0, 20.0, 10.3)
    kit.block(m, pf[0], pf[1], 0, pf[2], pf[3], 0.9, 'concrete', bevel=0.02)
    kit.block(m, pf[0], pf[3] - 0.3, 0.9, pf[2], pf[3], 0.92, 'paint_white')
    for s in (-1, 1):
        for k in range(5):
            x = s * 20.0 + s * (0.3 + k * 0.28)
            kit.block(m, min(x, x - s * 0.28), pf[1] + 1.0, 0, max(x, x - s * 0.28), pf[1] + 3.0, 0.9 - k * 0.18,
                      'concrete')
    house = (-7.0, 0.0, 7.0, 6.0)
    kit.block(m, house[0] - 0.2, house[1] - 0.4, 0, house[2] + 0.2, house[1] + 0.1, 0.9, 'concrete')
    if r == 'south':
        e2.plaster_walls(m, house, 0.9, 4.6, regions.plaster(r, 0))
    else:
        regions.house_walls(m, house, 0.9, 4.6, r)
    for side in ('front', 'back'):
        kit.door(m, house, side, -3.6, 0.9, 1.4, 2.4, leaf=st['shutter'], frame=trim)
        kit.door(m, house, side, 3.6, 0.9, 1.4, 2.4, leaf=st['shutter'], frame=trim)
        e2.house_window(m, house, side, 0.0, 1.9, r, 1.0, 1.3)
    kit.on_face(m, house, 'back', -1.4, 1.9, 1.0, 0.9, 0.06, 'window_dark')
    kit.on_face(m, house, 'back', -1.4, 1.85, 1.2, 0.08, 0.3, trim)
    for side in ('left', 'right'):
        e2.house_window(m, house, side, 0.0, 1.9, r, 1.0, 1.3)
    regions.house_roof(m, house, 4.6, r, None, axis='x', over=0.9, over_ends=0.7)
    # the platform canopy
    can = (-18.0, 6.6, 18.0, 9.6)
    for k in range(10):
        x = can[0] + 0.2 + (can[2] - can[0] - 0.4) * k / 9
        kit.block(m, x - 0.1, 7.9, 0.9, x + 0.1, 8.1, 4.1, trim)
        p.rod((x, 8.0, 3.4), (x, 6.9, 4.0), 0.05, trim, seg=4)
        p.rod((x, 8.0, 3.4), (x, 9.3, 4.0), 0.05, trim, seg=4)
    kit.gable_ribbed(m, can, 4.0, 0.7, 'zinc', 'zinc_dark', over=0.3, over_ends=0.2, axis='x', pitch=0.7)
    for x in (-12.0, 12.0):
        p.box((0.12, 0.12, 2.6), trim, T(x - 1.0, 4.0, 2.2))
        p.box((0.12, 0.12, 2.6), trim, T(x + 1.0, 4.0, 2.2))
        p.box((2.4, 0.1, 0.6), 'paint_white', T(x, 4.0, 3.2))
        p.box((1.8, 0.12, 0.16), 'sign_text', T(x, 4.0, 3.2))
    for x in (-15.0, -10.0, 10.0, 15.0):
        props.bench(p, x, 7.0, 1.8)
    for x in (-18.5, 18.5):
        p.cyl(0.06, 0.06, 3.0, 'iron', T(x, 5.0, 2.4), seg=6)
        e2.lantern(p, x, 4.6, 3.3)
        p.rod((x, 5.0, 3.85), (x, 4.6, 3.85), 0.02, 'iron', seg=4)
    # the engines' water tank and crane, beyond the track
    e2.water_tower(m, -15.0, 18.6, 5.0, 1.8, 2.4, 'rust', 'teak_dark')
    p.rod((-12.6, 15.0, 0.0), (-12.6, 15.0, 4.2), 0.12, 'iron', seg=8)
    p.rod((-12.6, 15.0, 4.0), (-12.6, 13.2, 4.0), 0.1, 'iron', seg=8)
    p.rod((-15.0, 16.6, 0.3), (-12.6, 15.0, 0.3), 0.1, 'metal', seg=6)
    # a semaphore signal post
    p.cyl(0.1, 0.08, 7.0, 'iron', T(20.0, 15.0, 3.5), seg=8)
    p.box((1.4, 0.08, 0.25), 'paint_red', T(20.6, 15.0, 6.4) @ R(0, -20, 0))
    p.box((0.18, 0.1, 0.18), 'paint_white', T(21.1, 15.0, 6.6))
    p.sphere(0.12, 'lamp', T(19.9, 14.88, 6.2), seg=6, rings=4)
    # a luggage trolley and sacks on the platform
    kit.block(p, 4.0, 7.6, 1.3, 6.0, 8.6, 1.38, 'plank')
    for x in (4.2, 5.8):
        p.cyl(0.25, 0.25, 0.08, 'iron', T(x, 7.55, 1.15) @ R(90, 0, 0), seg=10)
        p.cyl(0.25, 0.25, 0.08, 'iron', T(x, 8.65, 1.15) @ R(90, 0, 0), seg=10)
    for k in range(3):
        p.box((0.6, 0.4, 0.35), ('plank', 'canvas', 'teak')[k], T(4.4 + k * 0.6, 8.1, 1.56))
    name_sign(b, (house[0], house[1], house[2], house[3]), 3.55, 3.6)
    b.path(-14.0, -14.0, 14.0, -0.4, 'paving' if r != 'northeast' else 'laterite', z=0.06)
    b.path(-1.6, -23.9, 1.6, -14.0, path_mat(b), z=0.06)
    tops = e2.pole_line(p, [(-22.6, -22.6), (-22.6, -2.0)], 8.5)
    drop_to(b, tops[1], -7.0, 2.0, 3.8)
    for k, (x, y) in enumerate(((-20.0, -18.0), (20.0, -18.0), (-18.0, -6.0), (18.0, -6.0), (20.0, 21.0))):
        regions.plant(b, x, y, k)
    for x in (-9.0, 9.0):
        e2.vendor_cart(p, x, -10.0, facing=0, stripes=('awning_blue', 'awning_white'))
    gs = (12.0, -9.0, 21.0, -1.0)
    kit.block(m, gs[0] - 1.2, gs[1], 0, gs[2], gs[3], 1.0, 'concrete', bevel=0.02)
    if r == 'south':
        e2.plaster_walls(m, gs, 1.0, 5.0, regions.plaster(r, 2))
    else:
        regions.house_walls(m, gs, 1.0, 5.0, r)
    kit.folding_doors(m, gs, 'left', 0.0, 1.0, 3.0, 2.8, leaf='plank', frame=trim, open_=0.8)
    kit.gable_ribbed(m, gs, 5.0, 2.2, 'zinc', 'zinc_dark', over=1.2, over_ends=0.4, axis='y', pitch=0.6)
    props.sacks(p, 11.0, -7.0, 6)
    props.crates(p, 11.0, -3.0, 4)
    e2.townhouse(b, (-21.0, -13.0, -13.0, -6.0), 1, axis='x', door_u=0.0, upper=False)
    pw.well(p, -9.0, -18.0, 0.8, roof_mat='clay_tile')
    regions.craft(b, 10.0, -16.0)


@building('market', None, 'ตลาดสดหลังคาสังกะสี', 'Covered market hall')
def market(b):
    """The town's fresh market: a big hall on timber posts under a zinc roof with a raised vent along its ridge,
    rows of stalls inside, crates, sacks and carts round it, umbrellas over the outdoor stalls, poles and wires."""
    yard(b)
    r = b.region
    m = b.main
    p = b.props
    hall = (-18.0, -4.0, 18.0, 16.0)
    kit.block(m, hall[0], hall[1], 0, hall[2], hall[3], 0.2, 'concrete')
    for i in range(10):
        x = hall[0] + 0.2 + (hall[2] - hall[0] - 0.4) * i / 9
        for j in range(6):
            y = hall[1] + 0.2 + (hall[3] - hall[1] - 0.4) * j / 5
            kit.block(m, x - 0.13, y - 0.13, 0.2, x + 0.13, y + 0.13, 5.0, 'teak_dark')
        kit.block(m, x - 0.08, hall[1], 4.7, x + 0.08, hall[3], 5.0, 'teak')
    top = kit.gable_ribbed(m, hall, 5.0, 4.0, 'zinc', 'zinc_dark', over=0.8, over_ends=0.5, axis='x', pitch=0.8)
    vent = (hall[0], 4.6, hall[2], 7.4)
    for x in range(-18, 19, 4):
        for y in (vent[1] + 0.2, vent[3] - 0.2):
            kit.block(m, x - 0.06, y - 0.06, top - 1.0, x + 0.06, y + 0.06, top + 0.8, 'teak_dark')
    kit.gable_ribbed(m, vent, top + 0.8, 0.8, 'zinc', 'zinc_dark', over=0.5, over_ends=0.5, axis='x', pitch=0.8)
    goods = (('banana_fruit', 'leaf_light', 'paint_orange'), ('flower_red', 'leaf', 'rambutan'),
             ('cream', 'leaf_dark', 'flower_yellow'), ('durian', 'banana_fruit', 'leaf'))
    for i, x in enumerate((-14.0, -9.0, -4.0, 1.0, 6.0, 11.0, 15.0)):
        for j, y in enumerate((-1.0, 3.5, 8.0, 12.5)):
            props.table_stall(p, x, y, 3.0, 1.2, goods=goods[(i + j) % 4])
    props.sign_board(p, (hall[0], hall[1] - 0.8, hall[2], hall[3]), 'front', 0, 4.2, 6.0, 0.7, 'sign_cream',
                     'teak_dark', out=0.0)
    for k, x in enumerate((-16.0, -10.0, 10.0, 16.0)):
        props.umbrella(p, x, -10.0, 1.4, 2.3, 'awning_red' if k % 2 else 'awning_blue', 'awning_white')
        props.table_stall(p, x, -10.0, 1.8, 0.9, goods=goods[k % 4])
    for k in range(6):
        e2.crate(p, -5.0 + k * 0.8, -8.0, ('durian', 'banana_fruit', 'paint_orange')[k % 3], stack=1 + k % 2)
    props.sacks(p, 4.0, -8.6, 8)
    for k, x in enumerate((-20.0, 20.0)):
        e2.vendor_cart(p, x, -16.0, facing=90, stripes=e2.awning_stripes(r) if r != 'northeast' else
                       ('awning_blue', 'awning_white'))
    for k in range(4):
        pw.ox_cart(p, -14.0 + k * 9.0, 20.5, facing=0) if r in ('northeast', 'north', 'central') and k % 2 == 0 \
            else props.sacks(p, -14.0 + k * 9.0, 20.0, 6)
    tops = e2.pole_line(p, [(-22.6, -20.0), (-7.0, -20.0), (7.0, -20.0), (22.6, -20.0)], 8.5, sag=0.7)
    drop_to(b, tops[1], -6.0, -4.8, 4.6)
    drop_to(b, tops[2], 6.0, -4.8, 4.6)
    props.spirit_house(p, 21.0, 21.0)
    for k, (x, y) in enumerate(((-21.0, 21.0), (-21.0, 6.0), (21.0, 6.0), (21.0, -10.0))):
        regions.plant(b, x, y, k + 1)
    regions.craft(b, -21.0, -12.0)
    b.path(-23.9, -23.9, 23.9, -4.8, 'paving' if r != 'northeast' else 'laterite', z=0.06)
