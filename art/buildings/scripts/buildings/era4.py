# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 4, the modern city (assets/concept/era4_A_house.jpg, era4_B_town.jpg): modern houses with a Thai gable or a
flat roof with solar, townhouses, condominiums and office towers on concrete frames and glass curtain walls,
glass-railed balconies, rooftop tanks and AC units, a mall with a glass atrium, clean industry, an elevated metro.

The Thai identity comes from the region (lib/era4_parts.DRESS, lib/regions.py): a roof pavilion under the region's
roof on top of the towers, plain gables and laterite or terracotta in Isan (Khon Kaen), กาแล and teak louvres in the
north, hipped roofs and pastel arcades in the south, turned-up bargeboard ends in the centre, east and west.
True sizes: homes 3.1 m a floor, offices 3.9-4.0 m, the mall 5 m (PLAN.md)."""

from lib import kit, props, regions
from lib import era4_parts as e4
from lib import props_region as pr
from lib.builder import registry
from lib.mesh import R, T

BUILDINGS, building = registry(4)

FH_HOME = 3.1
FH_OFFICE = 3.9


def yard(b):
    b.ground(regions.ground_mat(b.region, b.era))


def path_mat(b):
    return 'laterite' if b.region == 'northeast' else 'paving_dark'


def plinth(b, rect, h=0.3, mat=None, out=0.1):
    x0, y0, x1, y1 = rect
    kit.block(b.main, x0 - out, y0 - out, 0, x1 + out, y1 + out, h, mat or e4.dress(b.region)['base'])
    return h


# homes ---------------------------------------------------------------------------------------------------------------

@building('home_1', 1, 'บ้านเดี่ยวสมัยใหม่', 'Modern detached house')
def home_1(b):
    """The concept house: two floors, a carport under the cantilevered upper floor, big framed windows and timber
    louvres, the region's gable over one half and a flat roof with a water tank and solar panels over the other."""
    yard(b)
    r = b.region
    d = e4.dress(r)
    p = b.main
    e4.lawn(b, 0.5, -7.9, 7.9, 7.9)
    g1 = (-2.0, -2.0, 3.5, 5.5)
    g2 = (-6.0, 2.0, -2.0, 5.5)
    up = (-6.0, -2.5, 3.5, 5.5)
    kit.block(p, g1[0] - 0.1, g1[1] - 0.1, 0, g1[2] + 0.1, g1[3] + 0.1, 0.3, d['base'])
    kit.block(p, g2[0] - 0.1, g2[1] - 0.1, 0, g2[2] + 0.1, g2[3] + 0.1, 0.3, d['base'])
    kit.block(p, *g1[:2], 0.3, *g1[2:], 3.3, d['wall'])
    kit.block(p, *g2[:2], 0.3, *g2[2:], 3.3, d['wall2'])
    kit.block(p, *up[:2], 3.3, *up[2:], 6.4, d['wall'])
    kit.bands(p, up, 3.15, 0.3, 0.06, d['accent'])
    kit.bands(p, up, 6.2, 0.25, 0.06, d['accent'])
    kit.block(p, -5.95, -2.45, 0, -5.55, -2.05, 3.3, d['wall'])
    kit.block(p, -5.95, -2.45, 0, -5.55, -2.05, 0.6, d['accent'])
    # ground floor: a picture window and the door under a small canopy
    e4.window_box(p, g1, 'front', e4.u_at(g1, 'front', 1.7), 0.7, 2.8, 2.1, d['trim'])
    kit.door(p, g1, 'front', e4.u_at(g1, 'front', -1.1), 0.3, 1.0, 2.2, leaf='teak', frame='e4_alu')
    e4.canopy(p, -2.0, -3.1, -0.2, -2.0, 2.75, posts=False)
    kit.window(p, g2, 'left', 0, 1.1, 1.6, 1.3, frame='e4_alu', glass='e4_glass')
    kit.window(p, g1, 'right', e4.u_at(g1, 'right', 2.8), 1.1, 1.6, 1.3, frame='e4_alu', glass='e4_glass')
    # upper floor: louvres over the carport, a deep window box beside them
    e4.fins(p, up, 'front', e4.u_at(up, 'front', -4.0), 3.45, 3.4, 2.7, d['louvre'], step=0.3, depth=0.2)
    e4.window_box(p, up, 'front', e4.u_at(up, 'front', 1.5), 4.0, 3.2, 1.9, d['trim'])
    e4.window_box(p, up, 'left', e4.u_at(up, 'left', 0.0), 4.1, 2.6, 1.7, d['trim'])
    e4.fins(p, up, 'left', e4.u_at(up, 'left', 3.9), 3.45, 2.0, 2.7, d['louvre'], step=0.3, depth=0.2)
    kit.window(p, up, 'right', e4.u_at(up, 'right', 3.0), 4.2, 1.6, 1.4, frame='e4_alu', glass='e4_glass')
    # roofs: the region's gable on the right half, a flat roof with the tank and solar on the left
    e4.flat_roof(p, (-6.0, -2.5, -1.0, 5.5), 6.4, 'concrete_light', parapet=0.6, parapet_mat=d['wall'],
                  coping=d['accent'])
    regions.house_roof(p, (-1.0, -2.5, 3.5, 5.5), 6.4, r, mat=d['roof'], axis='y', over=0.6, over_ends=0.5)
    e4.solar_field(b.props, -5.6, -2.0, -1.4, 3.0, 6.65)
    props.water_tank(b.props, -4.6, 4.3, 6.65, 'stainless', stand=0.6)
    e4.ac_unit(b.props, 3.85, 1.0, 0.5, 90)
    e4.ac_unit(b.props, 3.85, 3.0, 3.6, 90)
    # EV charger on the carport wall
    kit.block(b.props, -4.4, 1.82, 1.1, -3.9, 2.0, 1.7, 'paint_white')
    kit.block(b.props, -4.3, 1.78, 1.45, -4.0, 1.82, 1.62, 'screen_lit')
    # yard
    b.path(-6.2, -7.9, -1.8, -2.0, 'paving_dark')
    b.path(-1.6, -7.9, -0.4, -3.1, path_mat(b))
    e4.planter(b, 1.0, -6.6, 7.0, -4.9, seed=3, flowers='flower_red')
    regions.plant(b, 5.8, -3.4, 0)
    props.potted(b.props, 0.4, -2.8, 0, 0.6, 'leafy', 2)
    props.potted(b.props, -0.1, -3.6, 0, 0.5, 'palm', 4)
    regions.plant(b, 6.4, 6.4, 1)
    props.spirit_house(b.props, 6.4, 1.0, facing=-90)
    regions.craft(b, -6.6, 6.6)
    e4.low_wall(b, 7.6, [(-6.4, -0.3)], h=1.1, mat=d['wall2'], top=d['accent'])


@building('home_2', 2, 'บ้านแฝด', 'Twin house')
def home_2(b):
    """Two mirrored two-storey homes sharing a wall, each under its own regional gable, with a steel carport, a
    small garden and a ground water tank."""
    yard(b)
    r = b.region
    d = e4.dress(r)
    p = b.main
    rect = (-7.0, 0.0, 7.0, 6.0)
    kit.block(p, rect[0] - 0.1, rect[1] - 0.1, 0, rect[2] + 0.1, rect[3] + 0.1, 0.25, d['base'])
    kit.block(p, *rect[:2], 0.25, *rect[2:], 6.3, d['wall'])
    kit.bands(p, rect, 3.1, 0.3, 0.06, d['accent'])
    kit.block(p, -0.15, -0.5, 0, 0.15, 6.3, 6.9, d['accent'])
    for s in (-1, 1):
        unit = (min(0, s * 7.0), 0.0, max(0, s * 7.0), 6.0)
        e4.window_box(p, rect, 'front', e4.u_at(rect, 'front', s * 4.6), 0.4, 2.6, 2.3, d['trim'])
        kit.door(p, rect, 'front', e4.u_at(rect, 'front', s * 1.6), 0.25, 1.0, 2.2, leaf='teak', frame='e4_alu')
        e4.canopy(p, s * 0.25 if s > 0 else -2.6, -0.9, 2.6 if s > 0 else -0.25, 0.0, 2.7, posts=False)
        e4.window_box(p, rect, 'front', e4.u_at(rect, 'front', s * 4.4), 3.9, 2.8, 1.8, d['trim'])
        e4.fins(p, rect, 'front', e4.u_at(rect, 'front', s * 1.6), 3.5, 1.8, 2.6, d['louvre'], step=0.28, depth=0.2)
        regions.house_roof(p, unit, 6.3, r, mat=d['roof'], axis='y', over=0.6, over_ends=0.5)
        e4.carport(p, (s * 6.9 if s < 0 else 1.1, -6.6, -1.1 if s < 0 else s * 6.9, -1.0), 2.7)
        e4.ac_unit(b.props, s * 7.15, 3.5, 0.5, 90 * s)
        props.water_tank(b.props, s * 6.4, 6.9, 0, 'tank_blue' if s < 0 else 'stainless', stand=0.25)
        e4.planter(b, s * 0.4 if s > 0 else -0.9, -6.6, 0.9 if s > 0 else -0.4, -1.2, seed=5 + s, bushes=False)
        props.potted(b.props, s * 0.65, -0.9, 0, 0.5, 'leafy', 6 + s)
    for side in ('left', 'right'):
        kit.window(p, rect, side, 0, 3.9, 1.4, 1.4, frame='e4_alu', glass='e4_glass')
        kit.window(p, rect, side, 0, 1.0, 1.4, 1.3, frame='e4_alu', glass='e4_glass')
    b.path(-6.9, -7.9, -1.1, -1.0, 'paving_dark')
    b.path(1.1, -7.9, 6.9, -1.0, 'paving_dark')
    e4.lawn(b, -7.9, 6.0, 7.9, 7.9)
    regions.plant(b, -0.0, 7.0, 2, big=False)
    regions.craft(b, 3.2, 7.0)
    e4.low_wall(b, 7.6, [(-7.0, -1.0), (1.0, 7.0)], h=1.1, mat=d['wall2'], top=d['accent'])


@building('home_3', 3, 'ทาวน์โฮม', 'Townhouse row')
def home_3(b):
    """A row of three 3-storey townhouses: glass ground floors, glass-railed balconies, louvres, party walls
    standing proud, a flat roof with a regional stair-head roof, tank and solar for each home."""
    yard(b)
    r = b.region
    d = e4.dress(r)
    p = b.main
    rect = (-7.2, -2.0, 7.2, 6.8)
    zt = 0.3 + 3 * FH_HOME
    kit.block(p, rect[0] - 0.1, rect[1] - 0.1, 0, rect[2] + 0.1, rect[3] + 0.1, 0.3, d['base'])
    kit.block(p, *rect[:2], 0.3, *rect[2:], zt, d['wall'])
    for i in range(1, 3):
        kit.bands(p, rect, 0.3 + i * FH_HOME - 0.12, 0.24, 0.07, 'e4_white')
    for x in (-7.2, -2.4, 2.4, 7.2):
        kit.block(p, x - 0.15, -3.2, 0, x + 0.15, -1.9, zt + 0.9, d['accent'])
    for k, cx in enumerate((-4.8, 0.0, 4.8)):
        u = e4.u_at(rect, 'front', cx)
        e4.window_box(p, rect, 'front', u + 0.5, 0.45, 3.0, 2.3, 'e4_alu', mull=True)
        kit.door(p, rect, 'front', u - 1.6, 0.3, 0.9, 2.2, leaf='teak', frame='e4_alu')
        z2 = 0.3 + FH_HOME
        kit.on_face(p, rect, 'front', u, z2 + 0.1, 3.6, 2.4, 0.05, 'e4_glass')
        e4.balcony(p, rect, 'front', u, z2, 4.1, 1.1)
        e4.ac_unit(b.props, cx + 1.5, -2.85, z2, 0)
        z3 = 0.3 + 2 * FH_HOME
        e4.window_box(p, rect, 'front', u - 0.7, z3 + 0.7, 2.0, 1.6, d['trim'])
        e4.fins(p, rect, 'front', u + 1.3, z3 + 0.2, 1.4, 2.6, d['louvre'], step=0.25, depth=0.18)
        # roof: stair head under the region's roof, a tank and solar panels
        kit.block(p, cx - 1.6, 3.6, zt, cx + 0.9, 6.6, zt + 2.6, d['wall2'])
        kit.door(p, (cx - 1.6, 3.6, cx + 0.9, 6.6), 'front', 0, zt, 0.9, 2.1, leaf='e4_alu', frame='e4_alu')
        regions.small_roof(p, (cx - 1.6, 3.6, cx + 0.9, 6.6), zt + 2.6, r, mat=d['roof'], axis='y', over=0.35)
        props.water_tank(b.props, cx + 1.6, 5.8, zt + 0.25, 'stainless' if k != 1 else 'tank_blue', stand=0.5)
        props.solar_panels(b.props, cx, 0.2, zt + 0.25, cols=3, rows=1, tilt=12)
    e4.flat_roof(p, rect, zt, 'concrete_light', parapet=0.9, parapet_mat=d['wall'], coping='e4_white')
    kit.windows(p, rect, 'left', 0.3 + FH_HOME + 0.9, 2, 1.2, 1.4, frame='e4_alu', glass='e4_glass')
    kit.windows(p, rect, 'left', 0.3 + 2 * FH_HOME + 0.9, 2, 1.2, 1.4, frame='e4_alu', glass='e4_glass')
    for cx in (-4.8, 0.0, 4.8):
        b.path(cx - 2.2, -7.9, cx + 2.2, -2.0, 'paving_dark')
        e4.planter(b, cx - 2.3, -7.2, cx - 1.6, -2.9, seed=int(cx) + 9, bushes=False)
        props.potted(b.props, cx - 1.95, -3.8, 0.45, 0.45, 'leafy', int(cx) + 3)
    e4.lawn(b, -7.9, 6.8, 7.9, 7.9)
    props.fence(b.props, [(-7.6, -7.6), (7.6, -7.6)], 1.1, 'e4_graphite', post_mat='e4_graphite', spacing=0.5)


@building('home_4', 4, 'คอนโด 8 ชั้น', 'Eight-floor condominium')
def home_4(b):
    """An eight-floor condominium on one plot: a glass lobby with a canopy, seven floors of flats with glass-railed
    balconies and AC units, a stair core in the region's accent, a roof garden pavilion under the regional roof."""
    yard(b)
    r = b.region
    d = e4.dress(r)
    p = b.main
    rect = (-6.6, -4.2, 6.6, 6.2)
    lobby = (-6.0, -3.6, 6.0, 6.2)
    plinth(b, rect, 0.25)
    e4.curtain(p, lobby, 0.25, 4.2, 4.0, step=1.6)
    for x in (-6.4, -2.2, 2.2, 6.4):
        kit.block(p, x - 0.2, -4.2, 0.25, x + 0.2, -3.8, 4.2, d['wall2'])
    n = 7
    zt = e4.ribbon_facade(p, rect, 4.2, n, FH_HOME, d['wall'], bay=4.4, pier=d['wall2'])
    e4.balcony_stack(p, rect, 'front', 4.2, n, FH_HOME, (-4.3, 0.0, 4.3), 3.3, 1.3, start=0)
    e4.balcony_stack(p, rect, 'left', 4.2, n, FH_HOME, (e4.u_at(rect, 'left', 3.6),), 3.0, 1.2, start=0)
    # the stair core in the region's accent up the left face
    kit.block(p, -7.2, -2.2, 0.0, -6.6, 1.4, zt + 2.6, d['accent'])
    for i in range(n):
        kit.block(p, -7.25, -1.2, 4.9 + i * FH_HOME, -7.15, 0.4, 6.4 + i * FH_HOME, 'window_dark')
    zr = e4.flat_roof(p, rect, zt, 'concrete_light', parapet=1.1, parapet_mat=d['wall'], coping='e4_white')
    e4.roof_pavilion(b, p, (-5.6, -3.4, -0.6, 1.2), zt + 0.25, 2.8, axis='y')
    e4.lift_core(p, (1.0, 3.0, 4.2, 5.6), zt + 0.25, 3.0)
    e4.solar_field(b.props, 0.8, -3.6, 6.0, 2.6, zt + 0.25)
    e4.roof_tanks(b.props, -5.2, 4.6, zt + 0.25, 2)
    e4.planter(b, -5.8, 2.2, -1.0, 3.2, seed=21)
    _ = zr
    e4.canopy(p, -2.6, -6.6, 2.6, -4.2, 3.4)
    e4.sign_plate(p, rect, 'front', 0, 4.25, 3.0, 0.5, mat='e4_white')
    b.path(-2.4, -7.9, 2.4, -4.2, path_mat(b))
    e4.planter(b, -7.2, -7.2, -3.0, -5.4, seed=4, flowers='flower_pink')
    e4.planter(b, 3.0, -7.2, 7.2, -5.4, seed=7)
    regions.plant(b, -7.0, 6.8, 1)
    regions.plant(b, 6.9, -4.6, 0, big=False)
    for x in (-2.8, 2.8):
        props.bollard_light(b.props, x, -7.0)


@building('home_5', 5, 'คอนโดสูง 30 ชั้น', 'Thirty-floor condominium tower')
def home_5(b):
    """A 30-floor condominium on a joined lot: a three-floor podium of lobby and parking behind louvres, a pool deck
    with a regional sala on the podium roof, a tower of flats with continuous glass-railed balconies, a full-height
    accent fin, and a sky lounge under the region's roof at the top (about 110 m)."""
    yard(b)
    r = b.region
    d = e4.dress(r)
    p = b.main
    pod = (-14.0, -9.0, 14.0, 13.5)
    zp = 3 * 4.0
    plinth(b, pod, 0.3)
    kit.block(p, *pod[:2], 0.3, *pod[2:], zp, d['wall2'])
    for i in range(1, 3):
        kit.bands(p, pod, i * 4.0 - 0.15, 0.3, 0.1, 'e4_white')
    # lobby glass in the front middle, parking louvres either side and up the left
    kit.on_face(p, pod, 'front', 0, 0.3, 11.0, 3.6, 0.06, 'e4_glass')
    for k in range(1, 7):
        kit.on_face(p, pod, 'front', -5.5 + k * 11.0 / 7, 0.3, 0.06, 3.6, 0.09, 'e4_alu')
    for u in (-9.5, 9.5):
        e4.louvre_screen(p, pod, 'front', u, 0.6, 7.5, 3.0, d['louvre'])
    for z in (4.4, 8.4):
        for u in (-8.5, 0.0, 8.5):
            e4.louvre_screen(p, pod, 'front', u, z, 7.5, 3.0, d['louvre'])
        for u in (-6.0, 6.0):
            e4.louvre_screen(p, pod, 'left', u, z, 9.0, 3.0, d['louvre'])
    e4.canopy(p, -6.0, -12.0, 6.0, -9.0, 3.6)
    e4.flat_roof(p, pod, zp, 'paving', parapet=1.1, parapet_mat='e4_white', coping=d['accent'])
    # pool deck
    zd = zp + 0.25
    kit.block(p, -13.0, -8.0, zd, -3.0, -2.0, zd + 0.15, 'e4_white')
    kit.block(p, -12.6, -7.6, zd, -3.4, -2.4, zd + 0.18, 'e4_pool')
    for i in range(4):
        kit.block(b.props, -12.4 + i * 2.4, -9.0 + 0.2, zd, -11.6 + i * 2.4, -8.15, zd + 0.35, 'e4_white')
    e4.roof_pavilion(b, p, (-12.6, 0.0, -6.6, 5.0), zd, 2.8, axis='y')
    for x, y in ((-1.5, -7.0), (-13.0, 10.0), (-5.0, 10.5)):
        e4.lift(b.props, zd + 0.6, lambda: props.tree(b.props, x, y, 5.0, 1.8, int(abs(x) * 3) % 17))
        b.props.cyl(1.0, 1.0, 0.6, 'e4_white', T(x, y, zd + 0.3), seg=12)
    # tower
    tw = (-3.0, -4.5, 12.0, 10.5)
    n = 30
    zt = e4.ribbon_facade(p, tw, zd, n, FH_HOME, d['wall'], bay=3.75, pier=d['wall'])
    for side in ('front', 'left'):
        fw = kit.face_width(tw, side)
        for i in range(n):
            e4.balcony(p, tw, side, 1.2 if side == 'front' else -1.2, zd + i * FH_HOME + 0.2, fw - 3.2, 1.4)
            if side == 'front':
                for x in (1.8, 9.0):
                    e4.ac_unit(b.props, x, tw[1] - 1.1, zd + i * FH_HOME + 0.2, 0)
    # refuge floors as accent belts, and a glazed corner bay up the front-left corner
    for k in (10, 20):
        kit.bands(p, tw, zd + k * FH_HOME - 0.6, 1.2, 0.18, d['accent'])
    kit.block(p, tw[0] - 0.3, tw[1] - 0.3, zd, tw[0] + 2.4, tw[1] + 2.4, zt + 1.2, 'e4_glass_dark')
    for i in range(n):
        kit.block(p, tw[0] - 0.4, tw[1] - 0.4, zd + i * FH_HOME - 0.1, tw[0] + 2.5, tw[1] + 2.5,
                  zd + i * FH_HOME + 0.15, 'e4_white')
    # the accent fin up the front, through the roof
    kit.block(p, 4.0, -6.4, 0.0, 5.0, -4.5, zt + 4.0, d['accent'])
    kit.block(p, 3.9, -6.5, zt + 3.8, 5.1, -4.4, zt + 4.1, 'e4_white')
    e4.flat_roof(p, tw, zt, 'concrete_light', parapet=1.2, parapet_mat=d['wall'], coping='e4_white')
    e4.roof_pavilion(b, p, (-1.5, -2.5, 6.5, 4.5), zt + 0.25, 3.6, axis='y', walls=d['wall2'])
    e4.lift_core(p, (7.5, 4.5, 11.0, 9.5), zt + 0.25, 3.4)
    e4.roof_tanks(b.props, -1.5, 8.5, zt + 0.25, 3)
    e4.chiller(b.props, 9.2, -2.5, zt + 0.25)
    # ground
    b.path(-6.0, -15.9, 6.0, -9.0, path_mat(b))
    e4.planter(b, -14.6, -14.6, -7.0, -11.5, seed=8, flowers='flower_yellow')
    e4.planter(b, 7.0, -14.6, 14.6, -11.5, seed=12)
    e4.tree_row(b, [(-14.6, -2.0), (-14.6, 6.0), (14.6, -10.6)], 6.5, 2.4)
    for x in (-6.5, 6.5):
        props.street_lamp(b.props, x, -13.5, 5.0)
    e4.gate_posts(b, 0.0, -15.2, 13.0, 1.6)
    regions.craft(b, -9.0, -10.4)


# shops ---------------------------------------------------------------------------------------------------------------

@building('shop_1', 1, 'ร้านสะดวกซื้อและคาเฟ่', 'Minimart and café')
def shop_1(b):
    """A one-storey minimart with a glass front, a canopy and a plain sign (no brand), and a glass café pavilion
    under the region's roof with tables and umbrellas on its deck; parking in front, solar on the roof."""
    yard(b)
    r = b.region
    d = e4.dress(r)
    p = b.main
    rect = (-7.0, -1.8, 1.4, 6.0)
    plinth(b, rect, 0.2, 'e4_white')
    kit.block(p, *rect[:2], 0.2, *rect[2:], 4.2, d['wall'])
    kit.shopfront(p, rect, 'front', 0, 0.2, 7.4, 3.0, frame='e4_alu', glass='e4_glass', door_w=1.8)
    kit.on_face(p, rect, 'front', 0, 3.3, 8.4, 0.9, 0.1, 'sign_blue' if r != 'northeast' else 'e4_terracotta')
    kit.on_face(p, rect, 'front', -1.0, 3.5, 4.0, 0.45, 0.13, 'paint_white')
    e4.canopy(p, -7.0, -3.3, 1.4, -1.8, 3.2, posts=False)
    kit.window(p, rect, 'left', 0, 1.0, 2.4, 1.6, frame='e4_alu', glass='e4_glass')
    zr = e4.flat_roof(p, rect, 4.2, 'concrete_light', parapet=0.8, parapet_mat=d['wall'], coping='e4_white')
    _ = zr
    e4.solar_field(b.props, -6.6, -1.4, -1.2, 5.6, 4.45)
    e4.chiller(b.props, -0.1, 3.5, 4.45, 1.6, 1.2, 1.0, 1)
    e4.ac_unit(b.props, 1.6, 4.0, 0.4, 90)
    # café pavilion
    cafe = (2.6, -1.0, 7.3, 4.6)
    kit.block(p, cafe[0], cafe[1] - 2.6, 0, cafe[2], cafe[3], 0.4, 'teak_light')
    e4.curtain(p, cafe, 0.4, 3.4, 3.0, step=1.2)
    regions.small_roof(p, cafe, 3.4, r, mat=d['roof'], axis='y', over=0.6)
    for x in (3.6, 6.2):
        props.umbrella(b.props, x, -2.6, 1.2, 2.4, 'awning_green' if r != 'northeast' else 'e4_terracotta',
                       'awning_white')
        b.props.cyl(0.45, 0.45, 0.05, 'e4_white', T(x, -2.6, 1.15), seg=10)
        b.props.cyl(0.05, 0.05, 0.75, 'e4_alu', T(x, -2.6, 0.775), seg=6)
    e4.parking(b, -7.9, -7.9, 1.6, -3.6, 4, 'x')
    e4.planter(b, 2.4, -7.6, 7.6, -6.6, seed=2, flowers='flower_pink')
    regions.plant(b, 6.6, 6.6, 0)
    regions.plant(b, -7.1, 7.0, 2, big=False)
    props.bollard_light(b.props, 2.2, -5.0)


@building('shop_2', 2, 'อาคารพาณิชย์ 3 ชั้น', 'Three-storey shop building')
def shop_2(b):
    """A modern three-unit shop building: glass shop fronts with shutter boxes, plain signs and awnings, two upper
    floors on a concrete frame with louvres and a balcony, a flat roof with tanks, AC units and a regional stair
    head roof. In the south the ground floor is an arcade of arches in pastel plaster."""
    yard(b)
    r = b.region
    d = e4.dress(r, 1)
    p = b.main
    rect = (-7.2, -3.6, 7.2, 6.4)
    plinth(b, rect, 0.2, 'e4_white')
    kit.block(p, *rect[:2], 0.2, *rect[2:], 4.2, d['wall'])
    signs = ('sign_red', 'sign_blue', 'sign_green')
    for k, cx in enumerate((-4.8, 0.0, 4.8)):
        u = e4.u_at(rect, 'front', cx)
        if r == 'south':
            e4.arches(p, rect, 'front', 0.2, (u,), 3.4, 2.6, glass='e4_glass')
        else:
            kit.shopfront(p, rect, 'front', u, 0.2, 4.2, 3.0, frame='e4_alu', glass='e4_glass', door_w=1.6)
            kit.on_face(p, rect, 'front', u, 3.25, 4.4, 0.3, 0.25, 'concrete_dark')
        e4.sign_plate(p, rect, 'front', u, 3.6, 4.0, 0.55, mat=signs[k])
        if k != 1:
            props.awning(b.props, rect, 'front', u, 3.4, 4.2, 1.2, 0.45, stripes=regions.awning_colours(r))
    z0 = 4.2
    zt = e4.ribbon_facade(p, rect, z0, 2, 3.6, d['wall'], bay=4.8, pier=d['accent'], sides=('front', 'left'))
    kit.block(p, *rect[:2], z0, *rect[2:], zt, d['wall'])
    e4.fins(p, rect, 'front', e4.u_at(rect, 'front', 4.8), z0 + 0.2, 3.6, 6.8, d['louvre'], step=0.3, depth=0.25)
    e4.balcony(p, rect, 'front', e4.u_at(rect, 'front', 0.0), z0 + 3.6, 3.6, 1.0)
    for k, cx in enumerate((-4.8, 0.0)):
        e4.ac_unit(b.props, cx + 1.4, rect[1] - 0.25, z0 + 0.1, 0)
    for z in (z0 + 0.4, z0 + 4.0):
        e4.ac_unit(b.props, rect[0] - 0.2, 1.0, z, -90)
    e4.flat_roof(p, rect, zt, 'concrete_light', parapet=0.9, parapet_mat=d['wall'], coping=d['accent'])
    kit.block(p, -1.6, 3.2, zt, 1.6, 6.2, zt + 2.6, d['wall2'])
    regions.small_roof(p, (-1.6, 3.2, 1.6, 6.2), zt + 2.6, r, mat=d['roof'], axis='x', over=0.35)
    e4.roof_tanks(b.props, -6.0, 5.0, zt + 0.25, 3, 'stainless', 1.4)
    e4.solar_field(b.props, 2.0, -3.2, 6.8, 2.6, zt + 0.25)
    for x in (-5.5, -3.5):
        e4.ac_unit(b.props, x, 0.0, zt + 0.25, 0)
    b.path(-7.9, -7.9, 7.9, -3.6, 'paving_dark')
    for x in (-6.8, 6.8):
        e4.planter(b, x - 0.6, -7.4, x + 0.6, -5.0, seed=int(x) + 20, bushes=True)
    regions.plant(b, -6.8, 7.2, 2, big=False)
    regions.craft(b, 5.0, -6.6)
    props.street_lamp(b.props, 0.0, -7.4, 6.0)


@building('shop_3', 3, 'อาคารสำนักงาน 7 ชั้น', 'Seven-floor office building')
def shop_3(b):
    """A seven-floor office building: a tall glass lobby under a canopy, ribbon windows between concrete piers,
    full-height fins on the side, a stair core in the region's accent, chillers and a regional roof pavilion on
    top, a plaza with planters."""
    yard(b)
    r = b.region
    d = e4.dress(r, 2)
    p = b.main
    rect = (-6.4, -4.0, 6.4, 6.4)
    plinth(b, rect, 0.2, 'e4_white')
    e4.curtain(p, (-6.0, -3.6, 6.0, 6.4), 0.2, 4.6, 4.4, step=1.5)
    for x in (-6.2, -2.0, 2.0, 6.2):
        kit.block(p, x - 0.22, -4.0, 0.2, x + 0.22, -3.56, 4.6, d['wall2'])
    if r == 'south':
        e4.arches(p, (-6.4, -4.0, 6.4, 6.4), 'front', 0.2, (-4.1, 4.1), 2.8, 2.8, glass='e4_glass', frame=d['wall'])
    n = 6
    zt = e4.ribbon_facade(p, rect, 4.6, n, FH_OFFICE, d['wall'], bay=2.6, pier=d['wall2'],
                          sides=('front', 'back', 'right'))
    e4.fins(p, rect, 'left', 0, 4.6, 9.6, n * FH_OFFICE, d['louvre'], step=0.6, depth=0.5, thick=0.12)
    kit.block(p, 5.4, 6.4, 0.0, 7.2, 7.3, zt + 1.4, d['accent'])
    zr = e4.flat_roof(p, rect, zt, 'concrete_light', parapet=1.2, parapet_mat=d['wall'], coping='e4_white')
    _ = zr
    e4.sign_plate(p, rect, 'front', 0, zt - 0.1, 4.0, 0.9, mat='e4_white')
    e4.roof_pavilion(b, p, (-5.4, -3.0, 0.4, 2.0), zt + 0.25, 3.2, axis='y', walls=d['wall2'])
    e4.chiller(b.props, 3.0, -1.0, zt + 0.25, 3.0, 2.0, 1.8, 2)
    e4.chiller(b.props, 3.0, 2.6, zt + 0.25, 3.0, 2.0, 1.8, 2)
    e4.lift_core(p, (-5.0, 3.0, -1.0, 5.8), zt + 0.25, 3.6)
    e4.canopy(p, -3.0, -6.6, 3.0, -4.0, 4.0)
    b.path(-3.0, -7.9, 3.0, -4.0, path_mat(b))
    e4.planter(b, -7.4, -7.4, -3.6, -5.6, seed=31, flowers='flower_yellow')
    e4.planter(b, 3.6, -7.4, 7.4, -5.6, seed=33)
    for x in (-3.4, 3.4):
        props.bollard_light(b.props, x, -7.2)
    regions.plant(b, -7.0, 0.0, 1)


@building('shop_4', 4, 'อาคารสำนักงาน 15 ชั้น', 'Fifteen-floor office tower')
def shop_4(b):
    """A fifteen-floor office tower in a glass curtain wall: a double-height lobby behind columns, accent fins up the
    front, a set-back crown of two floors and a regional roof pavilion, cooling plant on the roof (about 75 m)."""
    yard(b)
    r = b.region
    d = e4.dress(r, 3)
    p = b.main
    rect = (-6.0, -5.0, 6.0, 6.2)
    plinth(b, rect, 0.2, 'e4_white')
    e4.curtain(p, (-5.0, -4.0, 5.0, 5.2), 0.2, 6.2, 6.0, step=1.25)
    for x in (-5.8, -2.0, 2.0, 5.8):
        kit.block(p, x - 0.25, -5.0, 0.2, x + 0.25, -4.5, 6.2, d['wall2'])
    for y in (-0.4, 5.9):
        kit.block(p, -6.0, y - 0.3, 0.2, -5.4, y + 0.3, 6.2, d['wall2'])
    kit.block(p, -6.1, -5.1, 5.9, 6.1, 6.3, 6.4, d['wall2'])
    n = 14
    zt = e4.curtain(p, rect, 6.4, 6.4 + n * 4.0, 4.0, step=1.5)
    for x in (-2.0, 2.0):
        kit.block(p, x - 0.2, -5.6, 0.2, x + 0.2, -5.0, zt + 1.5, d['accent'])
    kit.bands(p, rect, zt - 0.6, 0.6, 0.05, 'e4_alu')
    crown = (-4.6, -3.6, 4.6, 4.8)
    zc = e4.curtain(p, crown, zt, zt + 8.0, 4.0, glass='e4_glass_dark', step=1.5)
    e4.flat_roof(p, rect, zt, 'concrete_light', parapet=0.0)
    e4.flat_roof(p, crown, zc, 'concrete_light', parapet=1.0, parapet_mat=d['wall2'])
    e4.roof_pavilion(b, p, (-3.6, -2.6, 1.6, 1.6), zc + 0.25, 3.0, axis='y')
    e4.chiller(b.props, 2.8, 2.2, zc + 0.25, 2.4, 2.2, 1.8, 2)
    e4.chiller(b.props, -4.2, -4.0, zt + 0.25, 1.8, 1.0, 1.0, 1)
    e4.sign_plate(p, crown, 'front', 2.4, zt + 5.0, 2.6, 1.2, mat='e4_white')
    e4.canopy(p, -3.0, -7.0, 3.0, -5.0, 5.0)
    b.path(-3.0, -7.9, 3.0, -5.0, path_mat(b))
    e4.planter(b, -7.4, -7.4, -3.6, -6.0, seed=41, flowers='flower_red')
    e4.planter(b, 3.6, -7.4, 7.4, -6.0, seed=43)
    regions.plant(b, -7.0, 3.0, 1)
    regions.plant(b, 7.0, 3.0, 2, big=False)
    for x in (-3.4, 3.4):
        props.bollard_light(b.props, x, -7.6)


@building('shop_5', 5, 'ห้างสรรพสินค้า', 'Shopping mall with a glass atrium')
def shop_5(b):
    """A three-floor mall (5 m floors) on a joined lot: panel walls with blank screens and ribbon windows, a tall glass
    atrium at the entrance under a glass gable of the region's form, a skylight along the roof, solar and chillers,
    a drop-off canopy, parking and planted islands."""
    yard(b)
    r = b.region
    d = e4.dress(r, 0)
    p = b.main
    rect = (-14.8, -4.0, 14.8, 14.8)
    zt = 15.0
    plinth(b, rect, 0.3, 'e4_white')
    kit.block(p, *rect[:2], 0.3, *rect[2:], zt, 'e4_panel')
    for z in (5.0, 10.0):
        kit.bands(p, rect, z - 0.2, 0.4, 0.08, 'e4_white')
        kit.bands(p, rect, z + 2.6, 1.2, 0.04, 'e4_glass')
    kit.bands(p, rect, 0.3, 3.8, 0.04, 'e4_glass')
    for x in range(-14, 15, 3):
        kit.block(p, x - 0.15, rect[1] - 0.12, 0.3, x + 0.15, rect[1], 4.1, 'e4_alu')
    if r == 'south':
        e4.arches(p, rect, 'left', 0.3, (-6.0, -2.0, 2.0, 6.0), 2.6, 2.6, glass='e4_glass', frame=d['wall'])
    for x in (-10.0, 10.0):
        kit.on_face(p, rect, 'front', x, 6.0, 7.5, 5.0, 0.15, 'e4_graphite', out=0.02)
        kit.on_face(p, rect, 'front', x, 6.2, 7.1, 4.6, 0.18, 'screen_lit', out=0.02)
    e4.fins(p, rect, 'left', 0, 5.2, 16.0, 9.6, d['louvre'], step=0.8, depth=0.4, thick=0.12)
    # atrium
    atr = (-6.0, -9.0, 6.0, -4.0)
    za = e4.curtain(p, atr, 0.3, 20.0, 5.0, step=1.5)
    for x in (-6.0, 6.0):
        kit.block(p, x - 0.4, -9.4, 0.0, x + 0.4, -8.6, za + 0.5, d['accent'])
    regions.house_roof(p, (-6.4, -9.4, 6.4, 0.0), za, r, mat=d['roof'], axis='y', over=0.6, over_ends=0.8,
                       fill='e4_glass', courses=2)
    e4.canopy(p, -9.0, -13.0, 9.0, -9.0, 4.5)
    e4.sign_plate(p, atr, 'front', 0, 16.0, 6.0, 1.4, mat='e4_white')
    # roof: skylight, solar, chillers
    e4.flat_roof(p, rect, zt, 'concrete_light', parapet=1.0, parapet_mat='e4_panel', coping=d['accent'])
    kit.gable_roof(p, (-10.0, 3.0, 10.0, 7.0), zt + 0.25, 1.6, 'e4_glass', over=0.1, over_ends=0.1, thick=0.1)
    e4.solar_field(b.props, -14.0, 8.0, 14.0, 14.0, zt + 0.25)
    e4.solar_field(b.props, -14.0, -3.4, -7.0, 2.4, zt + 0.25)
    for x in (8.0, 11.5):
        e4.chiller(b.props, x, -1.0, zt + 0.25, 3.0, 2.2, 2.0, 2)
    # ground
    b.path(-9.0, -15.9, 9.0, -9.0, path_mat(b))
    e4.parking(b, -15.6, -15.6, -9.6, -5.0, 6, 'y')
    e4.parking(b, 9.6, -15.6, 15.6, -5.0, 6, 'y')
    for x in (-9.3, 9.3):
        e4.planter(b, x - 0.3, -15.0, x + 0.3, -5.5, seed=int(x) + 50, bushes=False)
    e4.tree_row(b, [(-12.5, -15.0), (12.5, -15.0), (-15.0, 0.0), (15.2, 0.0)], 6.0, 2.2, 51)
    kit.block(b.props, 13.6, -15.4, 0, 14.6, -14.8, 7.0, 'e4_graphite')
    kit.block(b.props, 13.5, -15.5, 3.5, 14.7, -14.7, 6.8, 'e4_white')
    for x in (-6.0, -3.0, 3.0, 6.0):
        props.bollard_light(b.props, x, -14.0)
    regions.craft(b, -4.0, -11.4)


# factories -----------------------------------------------------------------------------------------------------------

def shed(p, rect, h, d, roof_rise=1.2, pitch=0.8, ribs=True):
    """A clean steel-portal shed: a white dado, ribbed metal cladding above, a low ribbed gable with solar."""
    x0, y0, x1, y1 = rect
    kit.block(p, x0, y0, 0, x1, y1, 1.4, 'e4_white')
    kit.block(p, x0 + 0.05, y0 + 0.05, 1.4, x1 - 0.05, y1 - 0.05, h, 'e4_panel')
    if ribs:
        for side in ('front', 'left'):
            w = kit.face_width(rect, side)
            m = max(2, int(w / pitch))
            for k in range(1, m):
                kit.on_face(p, rect, side, -w / 2 + w * k / m, 1.4, 0.06, h - 1.4, 0.04, 'steel', out=-0.03)
    kit.bands(p, rect, h - 0.4, 0.4, 0.06, d['accent'])
    top = kit.gable_ribbed(p, rect, h, roof_rise, 'e4_roof_metal', 'metal', over=0.4, over_ends=0.3, axis='x',
                           pitch=1.0)
    return top


@building('factory_1', 1, 'โรงงานขนาดเล็ก', 'Clean workshop')
def factory_1(b):
    """A small clean workshop: a steel shed with roller doors and solar on its roof, a two-floor glass office at its
    front corner, pallets and crates, three parking bays and a steel fence."""
    yard(b)
    r = b.region
    d = e4.dress(r)
    p = b.main
    rect = (-6.8, -1.0, 6.8, 7.0)
    shed(p, rect, 6.0, d)
    e4.gable_solar(b.props, rect, 6.0, 1.2, 8, 1)
    for x in (1.0, 4.6):
        kit.roller_shutter(p, rect, 'front', e4.u_at(rect, 'front', x), 0.0, 3.0, 4.0, open_=0.0)
    office = (-6.8, -5.0, -1.4, -1.0)
    e4.ribbon_facade(p, office, 0.2, 2, 3.2, d['wall'], bay=2.7, pier=d['accent'], sides=('front', 'left', 'right'))
    e4.flat_roof(p, office, 6.6, 'concrete_light', parapet=0.6, parapet_mat=d['wall'])
    kit.door(p, office, 'right', 0, 0.2, 1.0, 2.2, leaf='e4_glass', frame='e4_alu', panels=False)
    e4.ac_unit(b.props, -4.0, -5.25, 3.5, 0)
    props.crates(b.props, 6.2, -2.0, 3, 'timber', 0.9)
    props.crates(b.props, 4.4, -2.6, 2, 'timber', 0.9)
    props.barrel(b.props, 6.8, -4.0, 'paint_blue')
    e4.parking(b, -7.6, -7.9, -1.0, -5.6, 3, 'x')
    b.path(0.0, -7.9, 7.6, -1.0, 'asphalt')
    regions.plant(b, -7.0, 7.2, 1)
    e4.planter(b, -7.5, -0.6, -7.0, 6.4, seed=60, bushes=False)
    props.fence(b.props, [(-7.7, -7.7), (-7.7, 7.7), (7.7, 7.7), (7.7, -7.7)], 1.8, 'e4_graphite', spacing=0.6)


@building('factory_2', 2, 'คลังสินค้าโลจิสติกส์', 'Logistics warehouse')
def factory_2(b):
    """A logistics warehouse: a tall panel box with three loading docks (levellers, dock shelters, a cantilever
    canopy), a glass office corner, a solar roof and a marked truck yard."""
    yard(b)
    r = b.region
    d = e4.dress(r)
    p = b.main
    rect = (-7.4, -1.2, 7.4, 7.4)
    h = 9.0
    kit.block(p, *rect[:2], 0, *rect[2:], h, 'e4_panel')
    for z in range(1, 9, 2):
        kit.bands(p, rect, z, 0.06, 0.03, 'steel')
    kit.bands(p, rect, h - 0.6, 0.6, 0.06, d['accent'])
    kit.gable_ribbed(p, rect, h, 0.8, 'e4_roof_metal', 'metal', over=0.3, over_ends=0.2, axis='x', pitch=1.2)
    e4.gable_solar(b.props, rect, h, 0.8, 9, 2)
    dock = (-2.0, -2.6, 7.4, -1.2)
    kit.block(p, dock[0], dock[1], 0, dock[2], dock[3], 1.2, 'concrete')
    for x in (0.0, 3.0, 6.0):
        u = e4.u_at(rect, 'front', x)
        kit.on_face(p, rect, 'front', u, 1.0, 3.2, 3.6, 0.35, 'iron')
        kit.roller_shutter(p, rect, 'front', u, 1.2, 2.6, 3.0, open_=0.0 if x != 3.0 else 0.8)
        kit.block(p, x - 1.2, -2.7, 0.9, x + 1.2, -2.6, 1.2, 'paint_yellow')
        for s in (-1, 1):
            kit.block(p, x + s * 1.3 - 0.1, -2.75, 0.1, x + s * 1.3 + 0.1, -2.6, 1.0, 'black')
    kit.block(p, -2.0, -4.2, 5.4, 7.4, -1.2, 5.65, 'e4_white')
    for x in (-1.8, 7.2):
        p.rod((x, -4.0, 5.5), (x, -1.2, 7.0), 0.05, 'e4_alu', seg=4)
    office = (-7.4, -3.2, -2.6, -1.2)
    e4.curtain(p, office, 0.0, 7.0, 3.5, step=1.2)
    kit.block(p, office[0] - 0.1, office[1] - 0.1, 7.0, office[2] + 0.1, office[3], 7.4, d['wall'])
    e4.parking(b, -7.9, -7.9, 7.9, -2.7, 5, 'x', mat='asphalt')
    e4.planter(b, -7.6, -0.8, -7.0, 7.0, seed=62, bushes=False)
    for x in (-6.0, -4.0):
        props.bollard_light(b.props, x, -3.6)
    regions.plant(b, -6.8, -4.4, 2, big=False)


@building('factory_3', 3, 'โรงงานประกอบ', 'Assembly plant')
def factory_3(b):
    """An assembly plant under a glazed sawtooth roof, a three-floor glass office in front, a slim clean stack,
    stainless process tanks on a pipe rack and rooftop air handlers."""
    yard(b)
    r = b.region
    d = e4.dress(r)
    p = b.main
    hall = (-7.2, -1.0, 7.2, 7.4)
    kit.block(p, *hall[:2], 0, *hall[2:], 1.4, 'e4_white')
    kit.block(p, hall[0] + 0.05, hall[1] + 0.05, 1.4, hall[2] - 0.05, hall[3] - 0.05, 7.0, 'e4_panel')
    kit.bands(p, hall, 6.6, 0.4, 0.06, d['accent'])
    kit.bands(p, hall, 3.2, 1.0, 0.03, 'e4_glass')
    e4.sawtooth(p, hall, 7.0, 4, 2.2)
    for x in (-3.5, 3.0):
        e4.chiller(b.props, x, 0.8, 8.8, 2.0, 1.4, 1.2, 1)
    kit.roller_shutter(p, hall, 'left', e4.u_at(hall, 'left', 3.0), 0.0, 4.0, 4.5, open_=0.3)
    office = (-7.2, -5.6, 0.6, -1.0)
    zt = e4.ribbon_facade(p, office, 0.2, 3, FH_OFFICE - 0.4, d['wall'], bay=2.6, pier=d['wall2'],
                          sides=('front', 'left', 'right'))
    e4.flat_roof(p, office, zt, 'concrete_light', parapet=0.8, parapet_mat=d['wall'], coping=d['accent'])
    regions.small_roof(p, (-6.4, -4.8, -3.0, -1.8), zt + 0.25, r, mat=d['roof'], axis='y', over=0.3)
    kit.block(p, -6.4, -4.8, zt + 0.25, -3.0, -1.8, zt + 0.25, 'e4_white')
    e4.canopy(p, -5.0, -6.8, -1.6, -5.6, 3.2, posts=False)
    # clean stack and process tanks
    p.cyl(0.45, 0.4, 20.0, 'stainless', T(5.6, -4.6, 10.0), seg=12)
    p.cyl(0.9, 0.9, 0.15, 'e4_alu', T(5.6, -4.6, 15.0), seg=12)
    for z in (6.0, 12.0, 19.0):
        p.torus(0.48, 0.05, 'paint_red', T(5.6, -4.6, z), seg=12, seg_minor=4)
    for x in (2.2, 4.0):
        props.tank(b.props, x, -2.6, 0.8, 3.2, 'stainless', 'flat')
    props.pipe_run(b.props, [(2.2, -2.6, 3.0), (2.2, -1.0, 3.0)], 0.12, 'e4_alu')
    props.pipe_run(b.props, [(4.0, -2.6, 2.6), (4.0, -1.0, 2.6)], 0.12, 'e4_alu')
    props.pipe_run(b.props, [(5.6, -4.6, 2.0), (5.6, -1.0, 2.0)], 0.18, 'e4_alu')
    e4.parking(b, -7.9, -7.9, 1.0, -6.0, 4, 'x')
    b.path(1.0, -7.9, 7.9, -1.0, 'asphalt')
    regions.plant(b, -7.0, 7.4, 0, big=False)
    props.fence(b.props, [(-7.7, 7.7), (7.7, 7.7), (7.7, -7.7)], 1.8, 'e4_graphite', spacing=0.6)


@building('factory_4', 4, 'นิคมอุตสาหกรรม', 'Industrial estate block')
def factory_4(b):
    """A block of an industrial estate on a joined lot: a big production hall with a solar roof, a logistics hall
    with docks, a three-floor office under the regional roof, an elevated water tank, a ground solar array, a
    substation, a gatehouse with a barrier and a steel fence."""
    yard(b)
    r = b.region
    d = e4.dress(r)
    p = b.main
    hall = (-15.2, 0.0, 3.0, 15.2)
    shed(p, hall, 9.0, d, 1.6, pitch=1.2)
    e4.gable_solar(b.props, hall, 9.0, 1.6, 12, 2, margin=1.0)
    for x in (-11.0, -4.0):
        kit.roller_shutter(p, hall, 'front', e4.u_at(hall, 'front', x), 0.0, 4.2, 5.0, open_=0.0)
    h2 = (5.0, 2.0, 15.2, 15.2)
    kit.block(p, *h2[:2], 0, *h2[2:], 8.0, 'e4_panel')
    kit.bands(p, h2, 7.4, 0.6, 0.06, d['accent'])
    kit.gable_ribbed(p, h2, 8.0, 0.8, 'e4_roof_metal', 'metal', over=0.3, over_ends=0.2, axis='y', pitch=1.4)
    kit.block(p, 5.0, 0.6, 0, 15.2, 2.0, 1.2, 'concrete')
    for x in (7.5, 10.5, 13.5):
        u = e4.u_at(h2, 'front', x)
        kit.on_face(p, h2, 'front', u, 1.0, 3.0, 3.6, 0.3, 'iron')
        kit.roller_shutter(p, h2, 'front', u, 1.2, 2.5, 3.0)
    kit.block(p, 5.0, -1.0, 5.0, 15.2, 2.0, 5.25, 'e4_white')
    office = (-15.2, -11.0, -4.0, -4.0)
    zt = e4.ribbon_facade(p, office, 0.25, 3, FH_OFFICE, d['wall'], bay=2.8, pier=d['wall2'])
    plinth(b, office, 0.25)
    regions.house_roof(p, office, zt, r, mat=d['roof'], axis='x', over=0.8, over_ends=0.6)
    e4.canopy(p, -11.5, -13.0, -7.5, -11.0, 3.6)
    # elevated water tank
    p.cyl(0.9, 0.9, 16.0, 'concrete', T(0.0, -10.0, 8.0), seg=12)
    p.lathe([(0.9, 16.0), (3.0, 17.5), (3.2, 20.0), (3.0, 20.6), (0.4, 21.6)], 'e4_white', T(0.0, -10.0, 0), seg=16,
            cap_top=True)
    p.torus(3.25, 0.06, 'e4_alu', T(0.0, -10.0, 19.0), seg=16, seg_minor=4)
    # ground solar array and a substation
    for k in range(4):
        props.solar_panels(b.props, 9.8, -14.2 + k * 2.3, 0.4, cols=9, rows=1, tilt=18)
    sub = (-3.0, -1.0, 3.0, -4.0)
    kit.block(b.yard, -3.4, -4.4, 0, 3.0, -0.6, 0.08, 'gravel')
    for x in (-2.0, 0.5):
        kit.block(p, x - 0.8, -3.2, 0.1, x + 0.8, -1.8, 2.2, 'paint_green')
        for k in range(4):
            kit.block(p, x - 0.9, -3.0 + k * 0.35, 0.3, x + 0.9, -2.95 + k * 0.35, 1.9, 'iron')
    _ = sub
    props.fence(b.props, [(-3.4, -4.4), (3.0, -4.4), (3.0, -0.6)], 2.0, 'e4_graphite', spacing=0.4)
    # gate
    kit.block(p, 2.0, -15.0, 0, 4.0, -13.4, 2.8, d['wall'])
    kit.block(p, 1.7, -15.3, 2.8, 4.3, -13.1, 3.1, d['accent'])
    kit.on_face(p, (2.0, -15.0, 4.0, -13.4), 'left', 0, 1.0, 1.0, 1.1, 0.05, 'e4_glass')
    b.props.rod((1.9, -14.0, 1.0), (-4.0, -14.0, 1.0), 0.05, 'paint_red', seg=6)
    e4.steel_fence(b, 15.6, gate_w=12.0, h=2.0, picket=0.9)
    b.path(-4.0, -15.9, 4.0, -12.0, 'asphalt')
    kit.block(b.yard, -4.0, -12.0, 0, 15.6, -1.0, 0.07, 'asphalt')
    e4.tree_row(b, [(-14.4, 14.6), (-14.4, -14.4), (-6.0, -14.4)], 6.0, 2.2, 70)
    regions.craft(b, -2.0, 14.0)


# services (3x3 tiles, 47 m) ------------------------------------------------------------------------------------------

E = 23.4


def service_ground(b, gate_w=8.0, path_to=-6.0, path_w=None):
    yard(b)
    e4.steel_fence(b, E, gate_w=gate_w, h=1.8, picket=1.1)
    e4.gate_posts(b, 0.0, -E, gate_w + 0.8, 2.4)
    w = (path_w or gate_w) / 2
    b.path(-w, -23.9, w, path_to, path_mat(b))


def corner_trees(b, pts, seed=80):
    for k, (x, y) in enumerate(pts):
        if k % 2:
            regions.plant(b, x, y, k)
        else:
            props.tree(b.props, x, y, 7.0, 2.6, seed + k)


@building('ruler_house', None, 'ศาลากลางจังหวัด', 'Provincial hall')
def ruler_house(b):
    """The provincial hall: a three-floor civic block on a stone podium with a colonnade, its centre a taller hall
    under a big roof of the region's form, grand steps, a flag on the plaza, a reflecting pool and lawns."""
    service_ground(b, 10.0, -6.0, 6.0)
    r = b.region
    d = e4.dress(r, 0)
    p = b.main
    pod = (-18.0, -5.0, 18.0, 15.0)
    kit.block(p, *pod[:2], 0, *pod[2:], 1.2, 'e4_sand_stone')
    kit.stairs(p, 0.0, -5.0, 1.2, 10.0, '-y', 'e4_sand_stone', open_=False)
    wing = (-17.0, 1.0, 17.0, 14.0)
    zt = e4.ribbon_facade(p, wing, 1.2, 3, 4.0, d['wall'], bay=3.4, pier=d['wall2'])
    if r == 'south':
        e4.arches(p, wing, 'front', 1.2, [e4.u_at(wing, 'front', x) for x in (-14, -10.5, 10.5, 14)], 2.4, 2.2,
                  glass='e4_glass', frame='paint_white')
    for x in range(-16, 17, 4):
        p.cyl(0.35, 0.35, 8.0, 'e4_white', T(x, -1.0, 1.2 + 4.0), seg=10)
    kit.block(p, -17.0, -1.6, 9.0, 17.0, 1.0, 9.6, d['wall2'])
    e4.flat_roof(p, wing, zt, 'concrete_light', parapet=1.0, parapet_mat=d['wall'], coping=d['accent'])
    for x0 in (-16.0, 8.0):
        e4.solar_field(b.props, x0, 2.0, x0 + 8.0, 13.0, zt + 0.25)
    hall = (-7.0, -3.0, 7.0, 14.0)
    zh = e4.ribbon_facade(p, hall, 1.2, 4, 4.0, d['wall2'], bay=2.8, pier=d['wall'])
    kit.on_face(p, hall, 'front', 0, 1.2, 6.0, 8.0, 0.1, 'e4_glass')
    regions.house_roof(p, hall, zh, r, mat=d['roof'], axis='y', over=1.2, over_ends=1.2)
    e4.canopy(p, -5.0, -6.0, 5.0, -3.0, 5.0, posts=False)
    e4.sign_plate(p, hall, 'front', 0, 9.8, 6.0, 0.9, mat='e4_sand_stone')
    # plaza
    props.flag_pole(b.props, 0.0, -14.0, 14.0)
    b.props.cyl(1.4, 1.6, 0.6, 'e4_sand_stone', T(0.0, -14.0, 0.3), seg=12)
    pr.water_pond(b.yard, -14.0, -18.0, -5.0, -9.0)
    pr.water_pond(b.yard, 5.0, -18.0, 14.0, -9.0)
    e4.lawn(b, -22.0, -21.0, -16.0, -6.0)
    e4.lawn(b, 16.0, -21.0, 22.0, -6.0)
    for x in (-16.0, 16.0):
        for y in (-20.0, -12.0):
            props.street_lamp(b.props, x, y, 6.0)
    e4.parking(b, -23.0, 16.0, -4.0, 22.8, 8, 'x')
    corner_trees(b, [(-20.0, -18.0), (20.0, -18.0), (-21.0, 4.0), (21.0, 4.0), (21.0, 19.0), (6.0, 20.0)])
    regions.craft(b, 4.0, -7.0)
    props.spirit_house(b.props, 12.0, -20.0)


@building('school', None, 'โรงเรียน', 'School campus')
def school(b):
    """A modern school campus: two four- and three-floor classroom blocks with open corridors and the region's
    roofs, a covered sports hall, a football field with a running track, a basketball court and the flag."""
    service_ground(b, 6.0, -12.0)
    r = b.region
    d = e4.dress(r, 1)
    p = b.main
    blk = (-21.0, 9.0, 8.0, 15.0)
    fh = 3.6
    zt = e4.ribbon_facade(p, blk, 0.3, 4, fh, d['wall'], bay=4.0, pier=d['wall'], sides=('front', 'left'))
    plinth(b, blk, 0.3)
    for i in range(1, 4):
        e4.balcony(p, blk, 'front', 0, 0.3 + i * fh, 29.0, 2.2, slab='e4_white', glass=d['wall'], rail=d['accent'])
    for x in range(-21, 9, 4):
        kit.block(p, x - 0.15 + 0.15, 6.8, 0, x + 0.15 + 0.15, 7.1, zt, 'e4_white')
    regions.house_roof(p, (-21.0, 6.8, 8.0, 15.0), zt, r, mat=d['roof'], axis='x', over=0.8, over_ends=0.6)
    kit.stairs(p, 9.6, 9.0, 0.3 + fh, 2.0, '-y', 'concrete', open_=False)
    blk2 = (12.0, -6.0, 18.0, 15.0)
    zt2 = e4.ribbon_facade(p, blk2, 0.3, 3, fh, d['wall2'], bay=4.0, pier=d['wall2'], sides=('front', 'left'))
    for i in range(1, 3):
        e4.balcony(p, blk2, 'left', 0, 0.3 + i * fh, 21.0, 2.2, slab='e4_white', glass=d['wall2'],
                   rail=d['accent'])
    regions.house_roof(p, (9.8, -6.0, 18.0, 15.0), zt2, r, mat=d['roof'], axis='y', over=0.8, over_ends=0.6)
    # sports hall: open sides, a big ribbed roof
    hall = (-21.0, -6.0, -6.0, 5.0)
    for x in range(-21, -5, 5):
        for y in (-6.0, 5.0):
            kit.block(p, x - 0.2 + (0.2 if x == -21 else 0), y - 0.2, 0, x + 0.2, y + 0.2, 6.5, 'e4_white')
    kit.block(p, -5.8, -6.2, 0, -5.4, -5.8, 6.5, 'e4_white')
    kit.block(p, -5.8, 4.8, 0, -5.4, 5.2, 6.5, 'e4_white')
    kit.gable_ribbed(p, hall, 6.5, 2.2, 'e4_roof_metal', 'metal', over=0.8, over_ends=0.5, axis='x', pitch=1.2)
    kit.block(b.yard, -20.5, -5.5, 0, -6.5, 4.5, 0.08, 'e4_court')
    for x in (-18.0, -9.0):
        kit.block(b.props, x - 0.05, -0.5, 0, x + 0.05, 0.5, 2.6, 'steel')
    # field with a running track and goals
    kit.block(b.yard, -4.0, -21.5, 0, 22.0, -8.0, 0.06, 'e4_track')
    kit.block(b.yard, -2.6, -20.1, 0, 20.6, -9.4, 0.08, 'grass')
    kit.block(b.yard, 8.95, -20.1, 0, 9.05, -9.4, 0.09, 'paint_white')
    for x in (-2.2, 20.2):
        for s in (-1, 1):
            b.props.box((0.1, 0.1, 2.4), 'paint_white', T(x, -14.75 + s * 3.6, 1.2))
        b.props.box((0.1, 7.3, 0.1), 'paint_white', T(x, -14.75, 2.4))
    kit.block(b.yard, -21.5, -21.5, 0, -8.5, -11.0, 0.08, 'e4_court_blue')
    for x in (-20.5, -9.5):
        b.props.box((0.15, 0.15, 3.05), 'steel', T(x, -16.25, 1.52))
        b.props.box((0.1, 1.8, 1.05), 'paint_white', T(x + (0.2 if x < -15 else -0.2), -16.25, 3.3))
    # flag and assembly ground
    props.flag_pole(b.props, 0.0, 3.0, 12.0)
    b.props.cyl(1.2, 1.4, 0.5, 'e4_white', T(0.0, 3.0, 0.25), seg=12)
    kit.block(b.yard, -4.5, -6.0, 0, 9.0, 7.0, 0.07, 'paving_dark')
    corner_trees(b, [(-22.0, 21.5), (21.5, 21.5), (21.5, -22.0), (10.0, 20.5), (-22.0, -8.0)])
    regions.craft(b, 4.0, -7.0)


@building('hospital', None, 'โรงพยาบาล', 'Hospital')
def hospital(b):
    """A hospital: a three-floor podium of clinics, a six-floor ward tower with balconies on it, a helipad with a
    green H on the roof (never a red cross), a covered ambulance bay, the main entrance canopy, parking and trees."""
    service_ground(b, 10.0, -8.0, 6.0)
    r = b.region
    d = e4.dress(r, 2)
    p = b.main
    pod = (-21.0, -2.0, 21.0, 15.0)
    plinth(b, pod, 0.3)
    zp = e4.ribbon_facade(p, pod, 0.3, 3, 4.2, d['wall'], bay=4.2, pier=d['wall2'])
    e4.flat_roof(p, pod, zp, 'concrete_light', parapet=1.0, parapet_mat=d['wall'], coping='e4_green_h')
    tw = (-13.0, 2.0, 13.0, 12.0)
    zt = e4.ribbon_facade(p, tw, zp, 6, 3.8, 'e4_white', bay=3.25, pier='e4_white', glass='e4_glass_green')
    for i in range(6):
        e4.balcony(p, tw, 'front', 0, zp + i * 3.8 + 0.1, 24.0, 0.9, glass='e4_rail')
    kit.bands(p, tw, zt - 0.4, 0.4, 0.1, 'e4_green_h')
    e4.flat_roof(p, tw, zt, 'concrete_light', parapet=1.0, parapet_mat='e4_white')
    e4.helipad(b.props, 6.0, 7.0, zt + 0.25, 4.6)
    e4.roof_pavilion(b, p, (-11.0, 3.5, -3.0, 10.5), zt + 0.25, 3.0, axis='y', walls='e4_white')
    e4.green_h_sign(p, tw, 'front', -9.0, zt - 4.0, 3.0)
    e4.green_h_sign(p, pod, 'front', 14.0, 9.0, 2.6)
    e4.sign_plate(p, pod, 'front', -3.0, 9.3, 9.0, 1.2, mat='e4_white', text='e4_green_h')
    # entrance and ambulance bay
    e4.canopy(p, -6.0, -6.5, 6.0, -2.0, 4.0)
    e4.canopy(p, -20.0, -9.0, -11.0, -2.0, 4.4)
    kit.block(b.yard, -20.0, -9.0, 0, -11.0, -2.0, 0.08, 'paving_dark')
    for x in (-18.0, -13.0):
        kit.block(b.yard, x - 1.0, -8.5, 0, x + 1.0, -8.3, 0.1, 'paint_yellow')
    for x in (-8.0, 8.0):
        e4.chiller(b.props, x, 13.0, zp + 0.25, 3.0, 2.0, 1.8, 2)
    e4.roof_tanks(b.props, 15.0, 4.0, zp + 0.25, 3)
    e4.parking(b, 8.0, -21.0, 22.5, -8.0, 9, 'x')
    e4.planter(b, -10.0, -14.0, -4.0, -10.0, seed=90, flowers='flower_yellow')
    corner_trees(b, [(-21.0, -20.0), (-6.0, -20.0), (21.5, 20.0), (-21.5, 20.0), (5.0, -12.0)])
    props.bench(b.props, -8.0, -15.5, 2.0)


@building('police', None, 'สถานีตำรวจ', 'Police station')
def police(b):
    """A modern police station: three floors on a concrete frame with a blue band, a taller entrance block under
    the region's gable, the flag, a radio mast, a guard booth at the gate and marked parking."""
    service_ground(b, 8.0, -4.0, 4.0)
    r = b.region
    d = e4.dress(r, 3)
    p = b.main
    rect = (-15.0, 2.0, 15.0, 14.0)
    plinth(b, rect, 0.4)
    zt = e4.ribbon_facade(p, rect, 0.4, 3, 3.8, d['wall'], bay=3.75, pier=d['wall2'])
    kit.bands(p, rect, zt - 0.7, 0.5, 0.12, 'sign_blue')
    e4.flat_roof(p, rect, zt, 'concrete_light', parapet=1.0, parapet_mat=d['wall'], coping='sign_blue')
    ent = (-5.0, -2.0, 5.0, 2.5)
    ze = e4.ribbon_facade(p, ent, 0.4, 3, 4.2, d['wall2'], bay=3.3, pier=d['wall'], sides=('front', 'left', 'right'))
    kit.on_face(p, ent, 'front', 0, 0.4, 4.0, 3.4, 0.1, 'e4_glass')
    regions.house_roof(p, ent, ze, r, mat=d['roof'], axis='y', over=0.8, over_ends=0.8)
    e4.canopy(p, -3.0, -4.5, 3.0, -2.0, 3.6)
    e4.sign_plate(p, ent, 'front', 0, 4.6, 6.0, 0.9, mat='sign_blue', text='paint_white')
    kit.stairs(p, 0.0, -2.0, 0.4, 4.0, '-y', 'e4_white', open_=False)
    e4.solar_field(b.props, -14.0, 3.0, -6.0, 13.0, zt + 0.25)
    e4.roof_tanks(b.props, 8.0, 11.5, zt + 0.25, 3)
    # radio mast
    p.cyl(0.25, 0.12, 30.0, 'paint_white', T(12.0, 8.0, zt + 15.0), seg=6)
    for z in (8.0, 16.0, 24.0):
        p.box((1.6, 0.08, 0.08), 'paint_red', T(12.0, 8.0, zt + z))
    props.flag_pole(b.props, -8.0, -10.0, 12.0)
    b.props.cyl(1.1, 1.3, 0.5, 'e4_white', T(-8.0, -10.0, 0.25), seg=12)
    # guard booth
    kit.block(p, 5.4, -22.0, 0, 7.4, -20.0, 2.6, 'e4_white')
    kit.on_face(p, (5.4, -22.0, 7.4, -20.0), 'left', 0, 1.0, 1.4, 1.2, 0.05, 'e4_glass')
    kit.block(p, 5.1, -22.3, 2.6, 7.7, -19.7, 2.85, 'sign_blue')
    b.props.rod((5.3, -21.0, 1.0), (0.5, -21.0, 1.0), 0.05, 'paint_red', seg=6)
    e4.parking(b, 6.0, -18.0, 22.5, -6.0, 8, 'x')
    e4.parking(b, -22.5, 16.0, 22.5, 22.8, 18, 'x')
    e4.lawn(b, -22.5, -21.0, -12.0, -5.0)
    corner_trees(b, [(-21.0, -19.0), (-14.0, -7.0), (-21.5, 6.0), (21.0, 6.0)])
    regions.craft(b, -3.5, -8.0)


@building('fire', None, 'สถานีดับเพลิง', 'Fire station')
def fire(b):
    """A modern fire station: four tall engine bays with red frames and roller doors, crew floor above, a
    regional roof pavilion on top, a six-floor training tower, a red-lined apron and the flag."""
    service_ground(b, 18.0, -6.0, 18.0)
    r = b.region
    d = e4.dress(r, 0)
    p = b.main
    rect = (-20.0, -2.0, 6.0, 12.0)
    kit.block(p, *rect[:2], 0, *rect[2:], 5.0, d['wall'])
    for k, x in enumerate((-16.5, -10.5, -4.5, 1.5)):
        u = e4.u_at(rect, 'front', x)
        kit.on_face(p, rect, 'front', u, 0.0, 5.0, 4.8, 0.2, 'paint_red')
        kit.roller_shutter(p, rect, 'front', u, 0.0, 4.2, 4.3, mat='roller', open_=0.7 if k % 2 == 0 else 0.0)
    zt = e4.ribbon_facade(p, rect, 5.0, 1, 3.6, d['wall2'], bay=3.25, pier='paint_red')
    kit.bands(p, rect, 4.7, 0.3, 0.12, 'paint_red')
    e4.flat_roof(p, rect, zt, 'concrete_light', parapet=1.0, parapet_mat=d['wall2'], coping='paint_red')
    e4.roof_pavilion(b, p, (-6.0, 2.0, 2.0, 9.0), zt + 0.25, 2.8, axis='y', walls=d['wall'])
    e4.solar_field(b.props, -19.0, -1.0, -8.0, 11.0, zt + 0.25)
    e4.sign_plate(p, rect, 'front', e4.u_at(rect, 'front', -7.0), 5.4, 8.0, 0.9, mat='paint_red', text='paint_white')
    # training tower
    tw = (11.0, 4.0, 17.0, 10.0)
    for i in range(6):
        z = i * 3.2
        kit.block(p, tw[0], tw[1], z, tw[2], tw[3], z + 3.2, 'concrete' if i % 2 else 'concrete_light')
        for side in ('front', 'left'):
            kit.on_face(p, tw, side, -1.2, z + 1.0, 1.4, 1.6, 0.06, 'window_dark')
            kit.on_face(p, tw, side, 1.4, z + 1.0, 1.4, 1.6, 0.06, 'window_dark')
    e4.flat_roof(p, tw, 19.2, 'concrete_dark', parapet=1.0, parapet_mat='paint_red')
    for z in range(1, 6):
        e4.balcony(p, tw, 'front', 0, z * 3.2, 5.0, 1.0, glass='paint_red', rail='paint_red')
    kit.stairs(p, 17.6, 8.0, 3.2, 1.0, '-y', 'iron', stringer='iron')
    # apron, hydrants, flag
    kit.block(b.yard, -20.0, -16.0, 0, 6.0, -2.0, 0.08, 'concrete_light')
    for x in (-20.0, -14.0, -8.0, -2.0, 4.0):
        kit.block(b.yard, x - 0.1, -12.0, 0, x + 0.1, -2.0, 0.09, 'paint_red')
    for x in (-21.0, 8.0):
        b.props.cyl(0.18, 0.18, 0.8, 'paint_red', T(x, -3.0, 0.4), seg=8)
        b.props.sphere(0.2, 'paint_red', T(x, -3.0, 0.85), seg=8, rings=4)
    props.flag_pole(b.props, 12.0, -10.0, 12.0)
    b.props.cyl(1.1, 1.3, 0.5, 'e4_white', T(12.0, -10.0, 0.25), seg=12)
    e4.lawn(b, 9.0, -21.0, 22.0, -14.0)
    e4.parking(b, -22.5, 15.0, 6.0, 22.5, 10, 'x')
    corner_trees(b, [(20.0, -19.0), (21.0, 2.0), (20.0, 18.0), (10.0, 19.0)])


@building('water_works', None, 'โรงผลิตน้ำประปา', 'Water treatment plant')
def water_works(b):
    """A water treatment plant: two round clarifiers with walkways, open filter beds, a filter house under the
    region's roof, a covered clear-water tank, an elevated water tower and the pipes between."""
    service_ground(b, 6.0, -8.0)
    r = b.region
    d = e4.dress(r, 1)
    p = b.main
    for cx, cy in ((-12.0, 10.0), (4.0, 12.0)):
        p.cyl(7.0, 7.0, 1.6, 'concrete', T(cx, cy, 0.8), seg=28)
        p.cyl(6.6, 6.6, 0.05, 'water', T(cx, cy, 1.5), seg=28)
        p.cyl(0.8, 0.8, 2.2, 'concrete_light', T(cx, cy, 1.1), seg=10)
        kit.block(p, cx, cy - 0.5, 1.8, cx + 7.0, cy + 0.5, 2.0, 'e4_alu')
        kit.railing(p, [(cx, cy - 0.5), (cx + 7.0, cy - 0.5)], 2.0, 'paint_yellow', h=1.0, spacing=0.8)
        kit.railing(p, [(cx, cy + 0.5), (cx + 7.0, cy + 0.5)], 2.0, 'paint_yellow', h=1.0, spacing=0.8)
        p.torus(7.0, 0.05, 'paint_yellow', T(cx, cy, 2.6), seg=28, seg_minor=4)
    beds = (-22.0, -14.0, -6.0, -3.0)
    kit.block(p, beds[0], beds[1], 0, beds[2], beds[3], 1.4, 'concrete')
    for i in range(4):
        x0 = beds[0] + 0.4 + i * 4.0
        kit.block(p, x0, beds[1] + 0.4, 1.0, x0 + 3.4, beds[3] - 0.4, 1.42, 'water')
    kit.railing(p, [(beds[0], beds[1]), (beds[2], beds[1])], 1.4, 'paint_yellow', h=1.0, spacing=1.0)
    house = (-2.0, -14.0, 12.0, -4.0)
    plinth(b, house, 0.3)
    zt = e4.ribbon_facade(p, house, 0.3, 2, 4.0, d['wall'], bay=3.5, pier=d['wall2'])
    regions.house_roof(p, house, zt, r, mat=d['roof'], axis='x', over=0.8, over_ends=0.6)
    e4.canopy(p, 2.0, -16.0, 6.0, -14.0, 3.0, posts=False)
    kit.block(p, 14.0, -21.0, 0, 22.0, -6.0, 2.0, 'concrete')
    kit.block(b.yard, 14.2, -20.8, 2.0, 21.8, -6.2, 2.1, 'grass')
    for x, y in ((16.0, -18.0), (20.0, -9.0)):
        b.props.cyl(0.3, 0.3, 1.0, 'e4_alu', T(x, y, 2.5), seg=8)
    # elevated water tower
    tx, ty = 17.0, 4.0
    p.cyl(1.4, 1.4, 22.0, 'e4_white', T(tx, ty, 11.0), seg=14)
    p.lathe([(1.4, 22.0), (5.2, 25.5), (5.4, 29.5), (5.0, 30.2), (0.6, 31.0)], 'e4_white', T(tx, ty, 0), seg=20,
            cap_top=True)
    p.torus(5.45, 0.08, d['accent'], T(tx, ty, 27.5), seg=20, seg_minor=4)
    p.torus(5.3, 0.06, 'e4_alu', T(tx, ty, 29.6), seg=20, seg_minor=4)
    # pipes
    props.pipe_run(b.props, [(-12.0, 3.0, 0.5), (-12.0, -3.0, 0.5), (-6.0, -8.0, 0.5)], 0.35, 'paint_blue')
    props.pipe_run(b.props, [(4.0, 5.0, 0.5), (4.0, -4.0, 0.5)], 0.35, 'paint_blue')
    props.pipe_run(b.props, [(12.0, -9.0, 0.5), (14.0, -9.0, 0.5)], 0.35, 'paint_blue')
    props.pipe_run(b.props, [(18.0, -6.0, 0.5), (17.0, 2.6, 0.5)], 0.35, 'paint_blue')
    corner_trees(b, [(-21.0, -20.0), (-21.0, 21.0), (21.0, 21.0), (12.0, 21.0)])
    e4.lawn(b, -10.0, -22.0, -2.0, -16.0)


@building('power_plant', None, 'โรงไฟฟ้าพลังความร้อนร่วม', 'Combined-cycle gas power plant')
def power_plant(b):
    """A combined-cycle gas plant: a turbine hall, two heat-recovery boilers with tall stacks, a row of mechanical
    cooling-tower cells, a transformer yard with gantries, a gas line and a control building under the region's
    roof."""
    service_ground(b, 8.0, -14.0)
    r = b.region
    d = e4.dress(r, 2)
    p = b.main
    hall = (-22.0, 3.0, -2.0, 15.0)
    shed(p, hall, 16.0, d, 1.6, pitch=1.2)
    for k in range(4):
        kit.on_face(p, hall, 'front', -7.5 + k * 5.0, 10.0, 3.6, 4.0, 0.05, 'e4_glass')
    for x0 in (0.0, 10.0):
        hr = (x0, 3.0, x0 + 8.0, 14.0)
        kit.block(p, *hr[:2], 0, *hr[2:], 22.0, 'e4_roof_metal')
        for z in range(3, 22, 3):
            kit.bands(p, hr, z, 0.12, 0.04, 'steel')
        kit.block(p, hr[0] + 1.5, hr[1] - 2.0, 0, hr[2] - 1.5, hr[1], 6.0, 'metal')
        kit.block(p, hr[0] + 2.5, 14.0, 18.0, hr[2] - 2.5, 17.0, 20.0, 'metal')
        props.chimney(b.props, x0 + 4.0, 18.5, 42.0, 1.7, 1.5, 'steel', 'paint_red')
        props.pipe_run(b.props, [(-2.0, 9.0, 10.0), (x0, 9.0, 10.0)], 0.6, 'e4_alu')
    for k in range(4):
        e4.chiller(b.props, 1.0 + k * 5.5, -12.0, 0.0, 5.0, 5.0, 6.0, 1)
    yard_r = (-22.0, -21.0, -5.0, -5.0)
    kit.block(b.yard, *yard_r[:2], 0, *yard_r[2:], 0.08, 'gravel')
    for x in (-18.0, -13.0, -8.0):
        kit.block(p, x - 1.4, -15.0, 0, x + 1.4, -12.0, 3.2, 'paint_green')
        for k in range(5):
            kit.block(p, x - 1.6, -14.8 + k * 0.6, 0.4, x + 1.6, -14.7 + k * 0.6, 2.8, 'iron')
        for s in (-1, 1):
            p.cyl(0.12, 0.12, 1.6, 'paint_white', T(x + s * 0.8, -13.5, 4.0), seg=6)
    for x in (-21.0, -13.0, -5.5):
        for y in (-19.0, -8.0):
            p.box((0.3, 0.3, 12.0), 'steel', T(x, y, 6.0))
    for y in (-19.0, -8.0):
        p.box((15.8, 0.3, 0.3), 'steel', T(-13.25, y, 12.0))
    for x in (-21.0, -13.0, -5.5):
        p.box((0.3, 11.3, 0.3), 'steel', T(x, -13.5, 12.0))
    props.fence(b.props, [(-5.0, -21.0), (-5.0, -5.0), (-22.0, -5.0)], 2.2, 'e4_graphite', spacing=0.6)
    ctl = (-1.0, -5.0, 9.0, 1.0)
    plinth(b, ctl, 0.3)
    zt = e4.ribbon_facade(p, ctl, 0.3, 2, 3.8, d['wall'], bay=3.3, pier=d['wall2'])
    regions.house_roof(p, ctl, zt, r, mat=d['roof'], axis='x', over=0.7, over_ends=0.5)
    props.pipe_run(b.props, [(22.0, 18.0, 1.0), (19.0, 18.0, 1.0), (19.0, 2.0, 1.0), (18.0, 2.0, 1.0)], 0.4,
                   'paint_yellow')
    props.tank(b.props, 20.5, -2.0, 1.6, 5.0, 'e4_white', 'cone')
    corner_trees(b, [(-21.5, 20.5), (21.5, -21.0), (12.0, -21.0)])


@building('waste', None, 'โรงคัดแยกและเตาเผาขยะผลิตไฟฟ้า', 'Recycling and waste-to-energy plant')
def waste(b):
    """A recycling and waste-to-energy plant: a tall boiler house with its stack, a tipping hall in front with
    bays, an open sorting hall with conveyors, bales and coloured skips, a weighbridge at the gate, solar on the
    sorting hall."""
    service_ground(b, 8.0, -12.0)
    r = b.region
    d = e4.dress(r, 3)
    p = b.main
    boiler = (-4.0, 2.0, 16.0, 16.0)
    kit.block(p, *boiler[:2], 0, *boiler[2:], 22.0, 'e4_panel')
    e4.fins(p, boiler, 'front', 0, 6.0, 19.0, 15.0, d['louvre'], step=0.8, depth=0.3, thick=0.15)
    e4.fins(p, boiler, 'left', 0, 6.0, 13.0, 15.0, d['louvre'], step=0.8, depth=0.3, thick=0.15)
    kit.bands(p, boiler, 21.0, 1.0, 0.08, d['accent'])
    kit.gable_ribbed(p, boiler, 22.0, 1.4, 'e4_roof_metal', 'metal', over=0.3, over_ends=0.3, axis='x', pitch=1.4)
    tip = (-4.0, -6.0, 16.0, 2.0)
    kit.block(p, *tip[:2], 0, *tip[2:], 11.0, 'e4_white')
    kit.bands(p, tip, 10.4, 0.6, 0.08, d['accent'])
    kit.shed_roof(p, tip, 11.0, 12.5, 'e4_roof_metal', over=0.3, low_side='front', thick=0.15)
    for x in (0.0, 6.0, 12.0):
        kit.roller_shutter(p, tip, 'front', e4.u_at(tip, 'front', x), 0.0, 4.5, 5.5, open_=0.6)
    props.chimney(b.props, 12.0, 19.5, 50.0, 1.6, 1.3, 'e4_white', d['accent'])
    props.pipe_run(b.props, [(10.0, 16.0, 18.0), (12.0, 18.2, 18.0)], 0.8, 'metal')
    # sorting hall
    hall = (-22.0, -8.0, -9.0, 16.0)
    for x in (-22.0, -15.5, -9.0):
        for y in range(-8, 17, 6):
            kit.block(p, x - 0.2, y - 0.2, 0, x + 0.2, y + 0.2, 7.0, 'e4_white')
    kit.block(p, -22.0, 10.0, 0, -9.0, 16.0, 7.0, 'e4_panel')
    kit.gable_ribbed(p, hall, 7.0, 1.6, 'e4_roof_metal', 'metal', over=0.6, over_ends=0.5, axis='y', pitch=1.4)
    e4.plane_panels(b.props, (-21.4, -7.0, 7.1), (-15.9, -7.0, 8.5), (-15.9, 15.0, 8.5), (-21.4, 15.0, 7.1), 4, 6)
    for y0 in (-6.0, 1.0):
        kit.block(p, -20.0, y0, 0.8, -11.0, y0 + 1.2, 1.0, 'iron')
        for x in range(-20, -10, 2):
            kit.block(p, x - 0.1, y0 + 0.1, 0, x + 0.1, y0 + 1.1, 0.8, 'steel')
    for i, c in enumerate(('paint_blue', 'paint_green', 'paint_yellow', 'paint_red', 'grey', 'paint_blue')):
        kit.block(b.props, -20.5 + (i % 3) * 1.6, 4.5 + (i // 3) * 1.6, 0, -19.1 + (i % 3) * 1.6,
                  5.9 + (i // 3) * 1.6, 1.3, c)
    for k, c in enumerate(('paint_green', 'paint_blue', 'paint_yellow', 'paint_orange')):
        x = -21.0 + k * 3.4
        kit.block(b.props, x, -14.0, 0, x + 2.8, -11.6, 1.6, c)
        kit.block(b.props, x - 0.05, -14.05, 1.5, x + 2.85, -11.55, 1.7, 'iron')
    kit.block(b.yard, -3.0, -20.0, 0, 3.0, -16.0, 0.12, 'steel')
    kit.block(p, 4.0, -19.5, 0, 6.0, -17.0, 2.6, 'e4_white')
    kit.block(p, 3.8, -19.7, 2.6, 6.2, -16.8, 2.85, d['accent'])
    kit.on_face(p, (4.0, -19.5, 6.0, -17.0), 'left', 0, 1.0, 1.4, 1.1, 0.05, 'e4_glass')
    kit.block(b.yard, -4.0, -16.0, 0, 18.0, -6.0, 0.07, 'asphalt')
    corner_trees(b, [(20.5, -20.5), (20.5, 0.0), (21.0, 20.0), (-21.0, -20.5)])
    e4.lawn(b, 8.0, -22.0, 22.0, -18.0)


@building('station', None, 'สถานีรถไฟฟ้ายกระดับ', 'Elevated metro station')
def station(b):
    """An elevated metro station over a viaduct section (no operator's livery): T-shaped piers, a deck with two
    tracks, a glass concourse under the platform level, a long platform roof, covered stairs and a lift down to
    the street, where entrance pavilions wear the region's roof."""
    yard(b)
    r = b.region
    d = e4.dress(r, 0)
    p = b.main
    zd = 12.0
    # piers and viaduct
    for x in (-21.0, -9.0, 9.0, 21.0):
        kit.block(p, x - 1.0, -1.0, 0, x + 1.0, 1.0, zd - 1.6, 'concrete_light')
        kit.hull(p, [(x - 1.0, -1.0, zd - 3.2), (x + 1.0, -1.0, zd - 3.2), (x - 1.0, 1.0, zd - 3.2),
                     (x + 1.0, 1.0, zd - 3.2), (x - 1.2, -6.0, zd - 1.6), (x + 1.2, -6.0, zd - 1.6),
                     (x - 1.2, 6.0, zd - 1.6), (x + 1.2, 6.0, zd - 1.6)], 'concrete_light')
    kit.block(p, -23.9, -5.0, zd - 1.6, 23.9, 5.0, zd, 'concrete')
    kit.block(p, -23.9, -5.2, zd - 1.7, 23.9, -5.0, zd + 1.0, 'concrete_light')
    kit.block(p, -23.9, 5.0, zd - 1.7, 23.9, 5.2, zd + 1.0, 'concrete_light')
    for y in (-2.4, 2.4):
        kit.block(p, -23.9, y - 0.9, zd, 23.9, y + 0.9, zd + 0.15, 'gravel')
        for s in (-1, 1):
            kit.block(p, -23.9, y + s * 0.72 - 0.04, zd + 0.15, 23.9, y + s * 0.72 + 0.04, zd + 0.3, 'steel')
    # platforms either side of the tracks, and the roof over them
    for y0, y1 in ((-8.0, -5.2), (5.2, 8.0)):
        kit.block(p, -16.0, y0, zd - 1.6, 16.0, y1, zd + 1.0, 'concrete_light')
        kit.block(p, -16.0, y0, zd + 1.0, 16.0, y1, zd + 1.05, 'paving')
        yy = y0 + 0.2 if y0 < 0 else y1 - 0.2
        kit.block(p, -16.0, yy - 0.05, zd + 1.0, 16.0, yy + 0.05, zd + 3.0, 'e4_rail')
    for x in range(-15, 16, 5):
        for y in (-7.6, 7.6):
            kit.block(p, x - 0.15, y - 0.15, zd + 1.0, x + 0.15, y + 0.15, zd + 5.5, 'e4_alu')
    kit.gable_roof(p, (-16.5, -8.5, 16.5, 8.5), zd + 5.5, 1.8, d['roof'] if r != 'central' else 'e4_roof_metal',
                   over=0.6, over_ends=0.4, thick=0.2)
    kit.bands(p, (-16.5, -8.5, 16.5, 8.5), zd + 5.2, 0.35, 0.6, 'e4_white')
    # concourse below the platforms
    conc = (-12.0, -9.0, 12.0, 9.0)
    e4.curtain(p, conc, 6.0, zd - 1.6, 4.4, step=1.5)
    kit.block(p, conc[0] - 0.2, conc[1] - 0.2, 5.6, conc[2] + 0.2, conc[3] + 0.2, 6.0, 'e4_white')
    e4.sign_plate(p, conc, 'front', 0, zd - 1.5, 8.0, 1.0, mat='paint_white', text='paint_blue')
    # stairs down to the street, covered, and a lift
    for s in (-1, 1):
        x = s * 9.0
        kit.slab(p, (x - 1.4, -9.0, 6.0), (x + 1.4, -9.0, 6.0), (x + 1.4, -19.0, 0.2), (x - 1.4, -19.0, 0.2), 0.3,
                 'concrete_light')
        for xx in (x - 1.5, x + 1.5):
            kit.slab(p, (xx - 0.08, -9.0, 7.1), (xx + 0.08, -9.0, 7.1), (xx + 0.08, -19.0, 1.3),
                     (xx - 0.08, -19.0, 1.3), 1.1, 'e4_rail')
        kit.slab(p, (x - 1.9, -9.0, 9.0), (x + 1.9, -9.0, 9.0), (x + 1.9, -19.5, 3.2), (x - 1.9, -19.5, 3.2), 0.12,
                 'e4_roof_metal')
        rect = (x - 2.6, -23.0, x + 2.6, -19.0)
        for xx, yy in ((rect[0], rect[1]), (rect[2], rect[1]), (rect[0], rect[3]), (rect[2], rect[3])):
            kit.block(p, xx - 0.15, yy - 0.15, 0, xx + 0.15, yy + 0.15, 3.0, d['trim'] if r != 'south' else
                      'paint_white')
        regions.small_roof(p, rect, 3.0, r, mat=d['roof'], axis='y', over=0.4)
    kit.block(p, -2.0, -12.5, 0, 2.0, -9.0, zd + 1.0, 'e4_glass')
    kit.corner_posts(p, (-2.0, -12.5, 2.0, -9.0), 0, zd + 1.0, 0.25, 'e4_alu')
    kit.block(p, -2.2, -12.7, zd + 1.0, 2.2, -8.8, zd + 1.4, 'e4_white')
    # street level
    kit.block(b.yard, -23.9, -3.0, 0, 23.9, 3.0, 0.07, 'asphalt')
    for x in range(-22, 23, 4):
        kit.block(b.yard, x, -0.08, 0, x + 2.0, 0.08, 0.08, 'paint_white')
    kit.block(b.yard, -23.9, -23.9, 0, 23.9, -3.0, 0.08, 'paving')
    kit.block(b.yard, -23.9, 3.0, 0, 23.9, 23.9, 0.08, 'paving')
    for x in (-18.0, 18.0):
        e4.canopy(p, x - 3.0, -6.0, x + 3.0, -4.0, 2.8, posts=False)
        for xx in (x - 2.6, x + 2.6):
            kit.block(p, xx - 0.06, -4.2, 0, xx + 0.06, -4.0, 2.8, 'e4_alu')
        props.bench(b.props, x, -4.6, 3.0)
    e4.tree_row(b, [(-20.0, -20.0), (20.0, -20.0), (-20.0, 18.0), (0.0, 18.0), (20.0, 18.0)], 6.5, 2.4, 95)
    for x in (-5.0, 5.0, -14.0, 14.0):
        e4.planter(b, x - 1.5, -16.0, x + 1.5, -14.5, seed=int(x) + 100, flowers='flower_pink')
    regions.craft(b, 0.0, -21.0)


@building('market', None, 'ตลาดสดสมัยใหม่', 'Modern covered market and food hall')
def market(b):
    """A modern covered market: a big steel hall open at the sides under a high roof of the region's form, rows of
    tiled counters, a food hall with tables at the front, umbrellas on the plaza, parking and shade trees."""
    yard(b)
    r = b.region
    d = e4.dress(r, 1)
    p = b.main
    hall = (-20.0, -6.0, 20.0, 16.0)
    kit.block(p, hall[0] - 0.3, hall[1] - 0.3, 0, hall[2] + 0.3, hall[3] + 0.3, 0.3, 'e4_white')
    for x in range(-20, 21, 5):
        for y in (-6.0, 5.0, 16.0):
            kit.block(p, x - 0.2, y - 0.2, 0.3, x + 0.2, y + 0.2, 7.0, 'e4_graphite')
    kit.bands(p, hall, 6.4, 0.6, 0.1, d['accent'])
    kit.block(p, hall[0], 14.0, 0.3, hall[2], 16.0, 7.0, d['wall'])
    regions.house_roof(p, hall, 7.0, r, mat=d['roof'], axis='x', over=1.2, over_ends=1.0, pitch=0.55, courses=4)
    for y in (2.0, 6.0, 10.0):
        for x in (-16.0, -10.0, -4.0, 4.0, 10.0, 16.0):
            e4.stall_counter(b.props, x, y, 4.4, 1.0)
    for x in range(-16, 17, 4):
        for y in (-4.0, -1.5):
            e4.picnic(b.props, x, y, 2.0)
    e4.sign_plate(p, hall, 'front', 0, 5.6, 10.0, 1.2, mat='e4_white', text=d['accent'])
    # plaza
    for k, x in enumerate((-14.0, -8.0, 8.0, 14.0)):
        props.umbrella(b.props, x, -11.0, 1.6, 2.6, ('awning_red', 'awning_blue', 'awning_green', 'awning_yellow')[k],
                       'awning_white')
        e4.stall_counter(b.props, x, -11.0, 2.0, 0.8)
    b.path(-4.0, -23.9, 4.0, -6.0, path_mat(b))
    e4.parking(b, -23.0, -23.0, -5.0, -15.0, 8, 'x')
    e4.parking(b, 5.0, -23.0, 23.0, -15.0, 8, 'x')
    for x in range(-22, 23, 3):
        kit.block(b.yard, x - 0.06, 18.0, 0, x + 0.06, 22.0, 0.09, 'paint_white')
    kit.block(b.yard, -23.0, 17.5, 0, 23.0, 22.5, 0.07, 'asphalt')
    e4.tree_row(b, [(-22.0, -9.0), (22.0, -9.0), (-22.5, 6.0), (22.5, 6.0)], 7.0, 2.6, 110)
    for x in (-4.5, 4.5):
        props.street_lamp(b.props, x, -18.0, 6.0)
    props.spirit_house(b.props, 20.0, -13.0)
    regions.craft(b, -2.0, -13.0)
