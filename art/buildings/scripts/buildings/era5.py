# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 5, the future city (assets/concept/era5_A_house.jpg, era5_B_town.jpg): green towers with planted terraces,
timber louvres, rounded corners and curved balconies, solar gables and solar glass, drone pads, sky bridges, wind
turbines, rain gardens, maglev tubes, robot lockers, clean factories and vertical farms.

The concept's gold spires and หางหงส์ finials are left out (PLAN.md): the Thai roof line stays only as a modern
gable in the region's way (era5_parts.solar_roof and thai_crown over regions.small_roof). True sizes (PLAN.md)."""

import math

from mathutils import Vector

from lib import kit, props, regions
from lib import era5_parts as e5
from lib import props_region as pr
from lib.builder import registry
from lib.era5_parts import dress, rbox, rrect
from lib.mesh import R, S, T

BUILDINGS, building = registry(5)


def yard(b, d=None):
    b.ground('paving')


def path(b, d, x0, y0, x1, y1):
    b.path(x0, y0, x1, y1, d['path'], z=0.07)


def plinth(b, rect, d, h=0.3, out=0.5, r=0.6):
    x0, y0, x1, y1 = rect
    rbox(b.main, x0 - out, y0 - out, 0.0, x1 + out, y1 + out, h, r, d['band'])


def coconut_or_plant(b, x, y, seed):
    if b.region in ('south', 'east', 'central'):
        if seed % 2 == 0:
            props.coconut(b.props, x, y, 9.0, seed=seed)
            return
    regions.plant(b, x, y, seed)


def robot_arm(p, x, y, z=0.0, facing=0.0, mat='paint_orange'):
    """An industrial robot arm on its pedestal."""
    m = T(x, y, z) @ R(0, 0, facing)
    p.cyl(0.5, 0.55, 0.3, 'grey', m @ T(0, 0, 0.15), seg=12)
    p.cyl(0.32, 0.32, 0.6, mat, m @ T(0, 0, 0.6), seg=10)
    pts = [m @ Vector(v) for v in ((0, 0, 0.9), (0.5, 0, 2.0), (1.6, 0, 2.1), (1.9, 0, 1.4))]
    for a, c in zip(pts, pts[1:]):
        p.rod(a, c, 0.15, mat, seg=8)
    for q in pts[:-1]:
        p.sphere(0.2, 'grey', T(*q), seg=8, rings=5)
    for s in (-1, 1):
        p.box((0.06, 0.08, 0.35), 'iron', T(*(pts[-1] + Vector((s * 0.1, 0, -0.15)))))
    return p


def drone_dock(main, plants, x, y, z, d, drone=True):
    """A rounded drone dock on a roof: a charging bay with a lid open and a drone on its pad."""
    rbox(main, x - 1.1, y - 1.1, z, x + 1.1, y + 1.1, z + 0.5, 0.4, 'robot_white')
    main.cyl(0.8, 0.8, 0.04, 'concrete_dark', T(x, y, z + 0.52), seg=14)
    main.torus(0.7, 0.03, 'e5_glow', T(x, y, z + 0.55), seg=14, seg_minor=4)
    main.box((2.2, 0.08, 1.0), 'robot_white', T(x, y + 1.1, z + 0.9) @ R(-20, 0, 0))
    if drone:
        props.drone(plants, x, y, z + 0.7, 0.9)
    return main


def h_sign(p, x, y, z, size=1.6, facing=0.0, plate='paint_white'):
    """The hospital sign: a green H on a white plate (never a red cross)."""
    m = T(x, y, z) @ R(0, 0, facing)
    p.box((size, 0.12, size), plate, m, bevel=0.08)
    for s in (-1, 1):
        p.box((size * 0.16, 0.16, size * 0.7), 'e5_hgreen', m @ T(s * size * 0.22, 0, 0))
    p.box((size * 0.44, 0.16, size * 0.14), 'e5_hgreen', m)
    return p


def green_pad(main, x, y, z, r=3.0):
    """A medical drone pad: a round deck with a green H and a ring of lights."""
    main.cyl(r, r, 0.15, 'concrete_light', T(x, y, z + 0.075), seg=24)
    main.torus(r * 0.8, 0.06, 'e5_hgreen', T(x, y, z + 0.16), seg=24, seg_minor=4)
    for s in (-1, 1):
        main.box((r * 0.16, r * 0.9, 0.03), 'e5_hgreen', T(x + s * r * 0.28, y, z + 0.16))
    main.box((r * 0.5, r * 0.16, 0.03), 'e5_hgreen', T(x, y, z + 0.16))
    for i in range(10):
        a = i * math.tau / 10
        main.sphere(0.08, 'lamp', T(x + math.cos(a) * (r - 0.12), y + math.sin(a) * (r - 0.12), z + 0.18), seg=6,
                    rings=3)
    return main


# homes ---------------------------------------------------------------------------------------------------------------

@building('home_1', 1, 'บ้านอีโค่หลังคาโซลาร์', 'Eco house with a solar gable')
def home_1(b):
    """The concept's house: two rounded floors in cream with terracotta bands, timber fins, a curved balcony with a
    pot plant, a solar gable to the road on one side and a roof terrace with a drone pad on the other; bamboo in a
    round planter, banana, bollard lights, a rain garden and the robot mower."""
    d = dress(b.region, 0)
    yard(b)
    p, q = b.main, b.props
    rect = (-4.6, -1.8, 4.4, 5.0)
    x0, y0, x1, y1 = rect
    zf, H = 0.3, 3.2
    plinth(b, rect, d, zf, 0.5, (0.4, 0.4, 0.4, 1.9))
    xm = -0.2
    # ground floor, its rounded corner to the front-left
    rbox(p, x0, y0, zf, x1, y1, zf + H, (0, 0, 0, 1.4), d['wall'])
    rbox(p, x0 - 0.15, y0 - 0.15, zf + H - 0.05, x1 + 0.15, y1 + 0.15, zf + H + 0.25, (0.1, 0.1, 0.1, 1.55),
         d['band'])
    zu = zf + H + 0.25
    zt = zf + 2 * H
    up_l = (x0, y0 + 1.9, xm, y1)
    up_r = (xm, y0, x1, y1)
    kit.block(p, up_l[0], up_l[1], zu, up_l[2], up_l[3], zt, d['wall'])
    kit.block(p, up_r[0], up_r[1], zu, up_r[2], up_r[3], zt, d['wall'])
    # the curved balcony over the ground floor's rounded corner
    pts = rrect(x0 + 0.02, y0 + 0.02, xm, y0 + 1.9, (0, 0, 0, 1.38), 4)
    arc = pts[2:] + [pts[0]]
    e5.ring_band(p, arc, zu, 0.95, 0.16, d['wall'], closed=False)
    e5.ring_band(p, arc, zu + 0.95, 0.07, 0.24, d['louvre'], closed=False)
    props.potted(q, -1.4, y0 + 0.9, zu, 0.7, 'leafy', 3)
    props.potted(q, -3.4, y0 + 1.4, zu, 0.5, 'flowers', 4)
    # the left part's flat roof: a parapet with a green light and the drone pad
    rbox(p, up_l[0] - 0.15, up_l[1] - 0.15, zt, up_l[2], up_l[3] + 0.15, zt + 0.25, 0.3, d['band'])
    e5.parapet(b, (up_l[0] - 0.15, up_l[1] - 0.15, up_l[2], up_l[3] + 0.15), zt + 0.25, d, 0.3, 0.6)
    e5.drone_pad_raised(p, q, (up_l[0] + up_l[2]) / 2, (up_l[1] + up_l[3]) / 2, zt + 0.25, 1.5)
    # the right part's solar gable to the road
    kit.bands(p, up_r, zt - 0.05, 0.25, 0.12, d['band'])
    e5.solar_roof(p, up_r, zt + 0.2, d, axis='y', pitch=0.6, over=0.55, over_ends=0.6)
    # openings
    e5.glass_door(p, rect, 'front', -1.9, zf, d, 1.6, 2.4)
    e5.window(p, rect, 'front', 2.4, zf + 0.7, 3.0, 1.9, d)
    e5.window(p, up_r, 'front', 1.0, zu + 0.6, 1.8, 1.6, d)
    e5.louvres(p, up_r, 'front', zu - 0.1, zt, -2.1, -0.3, 0.3, 0.3, 0.08, d['louvre'])
    e5.glass_door(p, up_l, 'front', 0.2, zu, d, 2.4, 2.3)
    e5.window(p, rect, 'left', -0.6, zf + 0.7, 2.0, 1.8, d)
    e5.louvres(p, rect, 'left', zf, zf + H - 0.1, 1.2, 2.6, 0.28, 0.25, 0.07, d['louvre'])
    e5.window(p, up_l, 'left', 0.0, zu + 0.6, 1.4, 1.5, d)
    e5.louvres(p, up_l, 'left', zu, zt, -2.4, -1.2, 0.28, 0.25, 0.07, d['louvre'])
    for u in (-1.6, 1.6):
        e5.window(p, rect, 'right', u, zf + 0.8, 1.4, 1.6, d)
        e5.window(p, up_r, 'right', u, zu + 0.7, 1.4, 1.5, d)
    e5.window(p, rect, 'back', 0.0, zf + 0.8, 2.0, 1.6, d)
    kit.gutter(p, up_r, 'left', zt + 0.15, 'steel', (True, False))
    # the yard
    path(b, d, -2.7, -7.95, -1.1, y0 - 0.5)
    e5.lawn(b, -7.95, -7.95, -3.2, y0 - 0.6)
    e5.lawn(b, -0.6, -7.95, 7.95, y0 - 0.6)
    e5.lawn(b, -7.95, y1 + 0.6, 7.95, 7.95)
    e5.rain_garden(b.yard, q, 2.4, -6.8, 6.8, -3.4, 2)
    e5.bollards(q, [(-3.0, -7.0), (-3.0, -4.6), (-0.8, -5.8), (-0.8, -3.2)])
    e5.bamboo_pot(q, -3.8, -3.6, 0.0, 3.2, 1)
    props.potted(q, 0.6, -3.0, 0.0, 0.8, 'palm', 6)
    props.potted(q, 1.5, -3.2, 0.0, 0.6, 'leafy', 7)
    e5.mower_robot(q, -5.6, -5.4, 30)
    regions.plant(b, 6.3, 1.0, 0)
    regions.plant(b, -6.4, 6.4, 1)
    regions.plant(b, -6.3, -0.6, 2, big=False)
    e5.small_tree(q, 5.6, 6.2, 0.0, 4.5, 1.8, 3)
    regions.craft(b, 2.4, 6.4)


@building('home_2', 2, 'บ้านแฝดอีโค่', 'Twin eco houses')
def home_2(b):
    """Two eco houses sharing a wall, each with its solar gable to the road, a curved balcony with a glass rail,
    timber fins and a strip of living wall; front gardens, a shared solar pergola and a parcel drone."""
    d = dress(b.region, 1)
    yard(b)
    p, q = b.main, b.props
    zf, H = 0.3, 3.2
    for k, (ux0, ux1) in enumerate(((-6.5, 0.0), (0.0, 6.5))):
        s = -1 if k == 0 else 1
        rect = (ux0, -1.6, ux1, 5.6)
        x0, y0, x1, y1 = rect
        cx = (x0 + x1) / 2
        plinth(b, rect, d, zf, 0.4, 0.3)
        r_out = (0, 0, 0, 1.2) if k == 0 else (1.2, 0, 0, 0)
        rbox(p, x0, y0, zf, x1, y1, zf + 2 * H, r_out, d['wall'])
        rbox(p, x0 - 0.12, y0 - 0.12, zf + H - 0.05, x1 + 0.12, y1 + 0.12, zf + H + 0.2,
             tuple(rr + 0.12 if rr else 0 for rr in r_out), d['band'])
        zt = zf + 2 * H
        kit.bands(p, rect, zt - 0.05, 0.25, 0.12, d['band'])
        e5.solar_roof(p, rect, zt + 0.2, d, axis='y', pitch=0.62, over=0.5, over_ends=0.6)
        # a curved balcony out of the upper floor
        bx0, bx1 = cx - 2.0, cx + 2.0
        zb = zf + H + 0.2
        rbox(p, bx0, y0 - 1.4, zb - 0.25, bx1, y0 + 0.05, zb, (1.0, 0, 0, 1.0), d['band'])
        rail = rrect(bx0 + 0.05, y0 - 1.35, bx1 - 0.05, y0, (0.95, 0, 0, 0.95), 4)
        e5.glass_rail(p, _front_arc(rail), zb, closed=False, frame=d['louvre'])
        e5.glass_door(p, rect, 'front', 0.0, zb, d, 2.0, 2.3)
        props.potted(q, cx + 1.3 * s, y0 - 0.7, zb, 0.6, 'leafy', 5 + k)
        # ground floor: the door to the outside, a wide window to the inside
        e5.glass_door(p, rect, 'front', -1.7 if k == 0 else 1.7, zf, d, 1.2, 2.4)
        e5.window(p, rect, 'front', 1.0 if k == 0 else -1.0, zf + 0.7, 2.4, 1.8, d)
        side = 'left' if k == 0 else 'right'
        e5.window(p, rect, side, 0.8, zf + 0.8, 1.6, 1.6, d)
        e5.window(p, rect, side, 0.8, zf + H + 0.8, 1.6, 1.5, d)
        e5.louvres(p, rect, side, zf, zf + 2 * H, -2.8, -1.0, 0.3, 0.25, 0.07, d['louvre'])
        e5.window(p, rect, 'back', 0, zf + 0.8, 1.8, 1.6, d)
        e5.window(p, rect, 'back', 0, zf + H + 0.8, 1.8, 1.5, d)
        # the yard
        path(b, d, (-1.7 if k == 0 else 1.7) - 0.7, -7.95, (-1.7 if k == 0 else 1.7) + 0.7, y0 - 0.4)
        lx0, lx1 = (-7.95, -2.7) if k == 0 else (2.7, 7.95)
        e5.lawn(b, lx0, -7.95, lx1, y0 - 0.5)
        px = 1.7 * s
        e5.bollards(q, [(px + 0.95 * s, -6.6), (px + 0.95 * s, -4.0)])
        regions.plant(b, 6.4 * s, 6.6, k, big=k == 0)
        regions.plant(b, 6.8 * s, 1.5, k + 2, big=False)
        e5.bamboo_pot(q, 4.6 * s, -3.4, 0.0, 3.0, k)
    # the shared green strip on the party wall and the pergola between the doors
    e5.green_wall(p, (-0.5, -1.6, 0.5, 5.6), 'front', 0, 0.4, 1.0, 5.8, 3, out=0.0)
    e5.solar_pergola(p, (-1.0, -6.4, 1.0, -2.6), 0.0, 2.6)
    e5.rain_garden(b.yard, q, -7.6, -7.6, -4.4, -5.8, 4)
    e5.rain_garden(b.yard, q, 4.4, -7.6, 7.6, -5.8, 5)
    e5.bench(q, 0.0, -6.9, 1.8)
    e5.drone_with_parcel(q, 2.2, -4.6, 6.0)
    e5.delivery_robot(q, -0.4, -4.4, 20)
    e5.lawn(b, -7.95, 6.2, 7.95, 7.95)


def _front_arc(pts):
    """From an rrect outline: the back-left corner round the front to the front-right corner's arc end (an open
    balcony front)."""
    # rrect order: front-right arc, back-right, back-left, front-left arc; the open front runs
    # back-left -> front-left arc -> front-right arc -> back-right.
    n = len(pts)
    seg = (n - 2) // 2
    fr = pts[:seg]
    rest = pts[seg:]
    br, bl = rest[0], rest[1]
    fl = rest[2:]
    return [bl] + fl + fr + [br]


@building('home_3', 3, 'ทาวน์เฮาส์เขียว', 'Green townhouse terrace')
def home_3(b):
    """A terrace of three green townhouses: planters on every floor stepping back, timber fins, the top floor set
    back under its own solar gable, roof terraces, front gardens and a parcel locker."""
    d = dress(b.region, 2)
    yard(b)
    p, q = b.main, b.props
    zf, H = 0.3, 3.2
    y0, y1 = -3.0, 6.2
    plinth(b, (-7.2, y0, 7.2, y1), d, zf, 0.3, 0.3)
    for k in range(3):
        ux0 = -7.2 + k * 4.8
        ux1 = ux0 + 4.8
        cx = (ux0 + ux1) / 2
        g = (ux0, y0, ux1, y1)
        f2 = (ux0, y0, ux1, y1)
        f3 = (ux0, y0 + 1.8, ux1, y1)
        wall = d['wall'] if k != 1 else d['wall2']
        kit.block(p, ux0 + 0.05, y0, zf, ux1 - 0.05, y1, zf + 2 * H, wall)
        kit.block(p, f3[0] + 0.05, f3[1], zf + 2 * H, f3[2] - 0.05, f3[3], zf + 3 * H, wall)
        # a planter balcony on floor 2
        rbox(p, ux0 + 0.3, y0 - 1.0, zf + H - 0.25, ux1 - 0.3, y0 + 0.05, zf + H, (0.6, 0, 0, 0.6), d['band'])
        e5.planter(p, q, (ux0 + 0.5, y0 - 0.95, ux1 - 0.5, y0 - 0.45), zf + H, 0.5, d['band'], k * 3)
        # floor 3's front terrace on floor 2's roof
        rbox(p, ux0 + 0.05, y0 - 0.2, zf + 2 * H - 0.05, ux1 - 0.05, y0 + 1.85, zf + 2 * H + 0.2, 0.0, d['band'])
        e5.planter(p, q, (ux0 + 0.3, y0 - 0.1, ux1 - 0.3, y0 + 0.4), zf + 2 * H + 0.2, 0.5, d['band'], k * 3 + 1,
                   tall=1 if k == 1 else 0)
        # the solar gable over the top floor, its gable to the road
        kit.bands(p, f3, zf + 3 * H - 0.05, 0.25, 0.1, d['band'])
        e5.solar_roof(p, f3, zf + 3 * H + 0.2, d, axis='y', pitch=0.62, over=0.35, over_ends=0.5)
        # openings
        e5.glass_door(p, g, 'front', -1.2, zf, d, 1.1, 2.4)
        e5.window(p, g, 'front', 0.9, zf + 0.7, 2.0, 1.8, d)
        e5.window(p, f2, 'front', -0.4, zf + H + 0.15, 2.6, 2.4, d, transom=False)
        e5.louvres(p, f2, 'front', zf + H + 0.1, zf + 2 * H, 1.1, 2.2, 0.25, 0.25, 0.07, d['louvre'])
        e5.window(p, f3, 'front', 0.6, zf + 2 * H + 0.4, 2.2, 2.2, d, transom=False)
        e5.louvres(p, f3, 'front', zf + 2 * H + 0.2, zf + 3 * H, -2.2, -1.0, 0.25, 0.25, 0.07, d['louvre'])
        e5.window(p, g, 'back', 0, zf + 0.8, 2.0, 1.6, d)
        e5.window(p, g, 'back', 0, zf + H + 0.8, 2.0, 1.6, d)
        # the end walls: windows, fins and a living wall
        if k in (0, 2):
            side = 'left' if k == 0 else 'right'
            s = 1 if k == 0 else -1
            for z in (zf + 0.8, zf + H + 0.8):
                e5.window(p, g, side, 1.8 * s, z, 1.6, 1.6, d)
            e5.window(p, f3, side, 1.0 * s, zf + 2 * H + 0.7, 1.4, 1.5, d)
            e5.green_wall(p, g, side, -2.4 * s, zf + 0.4, 2.6, 2 * H - 0.6, k)
            e5.louvres(p, f3, side, zf + 2 * H, zf + 3 * H, -2.6 * s - 0.6, -2.6 * s + 0.6, 0.3, 0.25, 0.07,
                       d['louvre'])
        # party fins between the houses
        for x in (ux0, ux1):
            rbox(p, x - 0.18, y0 - 1.1, zf, x + 0.18, y0 + 0.4, zf + 2 * H + 0.2, 0.15, d['band'])
        # front garden
        path(b, d, cx - 1.8, -7.95, cx - 0.6, y0 - 0.4)
        e5.lawn(b, cx - 0.4, -7.95, cx + 2.3, y0 - 1.2)
        e5.bollards(q, [(cx - 2.0, -5.0)])
        props.potted(q, cx + 1.4, -4.6, 0.0, 0.7, 'palm' if k != 1 else 'leafy', 9 + k)
    e5.robot_locker(q, 1.0, -7.0, 0, 2.2, 1.8, 4, 4)
    e5.delivery_robot(q, 5.6, -6.6, -30)
    e5.drone_with_parcel(q, 1.8, -2.0, 11.6)
    e5.lawn(b, -7.95, y1 + 0.4, 7.95, 7.95)
    for k, x in enumerate((-5.6, 0.0, 5.6)):
        regions.plant(b, x, 7.0, k, big=k != 1)


@building('home_4', 4, 'คอนโดเขียว 10 ชั้น', 'Ten-floor green condo')
def home_4(b):
    """A ten-floor green condo: rounded corner piers, a cream band at every floor, timber fins, planted terraces
    that step from side to side with small trees, a glass roof pavilion under the region's gable, a drone pad,
    solar panels and roof turbines; bamboo, lockers and a rain garden at its feet."""
    d = dress(b.region, 0)
    yard(b)
    p, q = b.main, b.props
    rect = (-6.0, -4.4, 6.0, 5.6)
    plinth(b, rect, d, 0.3, 0.6, 2.2)

    def plan(i):
        out = [('front', -2.6 if i % 2 else 2.6, 5.4, 1.6, i % 4 in (1, 2))]
        if i % 3 == 0:
            out.append(('left', 1.6, 5.0, 1.25, True))
        elif i % 3 == 1 and i > 1:
            out.append(('left', -1.8, 4.0, 1.0, False))
        return out
    zt = e5.tower(b, rect, 0.3, 10, 3.2, d, seed=3, r=1.8, fins=('front',), terraces=plan)
    gi = e5.inset(rect, 0.35)
    e5.glass_door(p, gi, 'front', 0.0, 0.3, d, 2.4, 2.6)
    # the roof
    e5.parapet(b, rect, zt, d, 1.8, 1.0)
    e5.thai_crown(b, (-5.2, 0.6, -0.8, 4.8), zt, d, 3.2, axis='y')
    e5.drone_pad_raised(p, q, 2.8, -1.6, zt, 1.8)
    e5.solar_array(p, 0.4, 1.0, 5.4, 4.9, zt, 10.0)
    e5.vawt(p, -4.6, -3.2, zt, 2.6, 0.7)
    e5.vawt(p, -2.4, -3.2, zt, 2.6, 0.7)
    e5.roof_garden(b, (-5.4, -3.8, -1.4, -0.2), zt, 5, 0)
    # the ground
    e5.lawn(b, -7.95, -7.95, -1.6, -5.4)
    e5.lawn(b, 1.6, -7.95, 7.95, -5.4)
    path(b, d, -1.4, -7.95, 1.4, -4.8)
    e5.bamboo_pot(q, -2.6, -6.0, 0.0, 3.4, 2)
    e5.bamboo_pot(q, 2.6, -6.0, 0.0, 3.4, 3)
    e5.robot_locker(q, 5.2, -6.7, 0, 2.6, 1.9, 5, 4)
    e5.rain_garden(b.yard, q, -7.4, -7.6, -4.2, -5.6, 1)
    e5.bollards(q, [(-1.7, -7.4), (1.7, -7.4)])
    e5.delivery_robot(q, 3.2, -7.4, 10)
    regions.plant(b, -7.0, 6.9, 0, big=False)
    regions.plant(b, 7.0, 6.9, 2)


@building('home_5', 5, 'หอคอยป่าแนวตั้ง', 'Vertical forest tower')
def home_5(b):
    """The top home on a joined lot: a 38-floor vertical-forest tower over a two-floor podium, a planted terrace
    jutting out at every floor with trees on every other one, sky gardens, a roof pavilion under the region's gable,
    a drone pad and a wind turbine; the podium's roof is a garden with a pool."""
    d = dress(b.region, 1)
    yard(b)
    p, q = b.main, b.props
    pod = (-14.4, -12.0, 14.4, 13.0)
    plinth(b, pod, d, 0.3, 0.6, 3.6)
    zp = e5.tower(b, pod, 0.3, 2, 4.0, d, seed=1, r=3.0, fins=('front',), fin_span=0.3, piers=False)
    gi = e5.inset(pod, 0.35)
    e5.glass_door(p, gi, 'front', 0.0, 0.3, d, 3.6, 3.0)
    e5.green_wall(p, pod, 'left', 2.0, 0.6, 10.0, 6.6, 4)
    rect = (-8.5, -6.0, 8.5, 9.0)

    def plan(i):
        side = ('front', 'left', 'front', 'right')[i % 4]
        u = {0: -3.8, 1: 2.4, 2: 3.8, 3: -2.4}[i % 4]
        out = [(side, u, 7.4, 2.0, i % 2 == 0)]
        if i in (12, 25):
            out = [('front', 0.0, 15.0, 2.4, True), ('left', 0.0, 13.0, 2.2, True)]
        return out
    zt = e5.tower(b, rect, zp, 38, 3.2, d, seed=7, r=2.4, fins=('front',), fin_span=0.25, terraces=plan,
                  band_every=6)
    e5.garden_strip(p, rect, 'front', 6.2, zp + 0.3, 38, 3.2, 2.4, 1)
    e5.garden_strip(p, rect, 'left', -4.6, zp + 0.3, 38, 3.2, 2.6, 2)
    # the podium's roof garden round the tower
    e5.roof_garden(b, (-14.0, -11.6, 14.0, -6.0), zp, 11, 3)
    e5.roof_garden(b, (8.4, -6.0, 14.0, 12.6), zp, 12, 2)
    kit.block(p, -13.6, -5.0, zp, -8.6, 11.8, zp + 0.25, 'concrete_light')
    kit.block(p, -13.2, -4.6, zp, -9.0, 11.4, zp + 0.3, 'e5_pool')
    e5.parapet(b, pod, zp, d, 3.0, 1.0)
    e5.drone_pad_raised(p, q, 11.2, 10.0, zp + 0.08, 2.0)
    e5.solar_pergola(p, (-7.0, 9.9, 7.0, 12.6), zp, 2.6)
    # the crown
    e5.parapet(b, rect, zt, d, 2.4, 1.1)
    e5.thai_crown(b, (-7.4, 2.0, -0.4, 8.0), zt, d, 3.6, axis='y')
    e5.drone_pad_raised(p, q, 4.0, -2.0, zt, 2.4)
    e5.solar_array(p, 1.0, 2.4, 7.6, 8.0, zt, 10.0)
    e5.wind_turbine(p, -5.6, -3.6, zt, 5.5, 2.4)
    # the ground
    path(b, d, -2.0, -15.95, 2.0, -12.4)
    e5.lawn(b, -15.95, -15.95, -2.4, -13.2)
    e5.lawn(b, 2.4, -15.95, 15.95, -13.2)
    for x in (-11.0, 11.0):
        e5.bamboo_pot(q, x, -14.4, 0.0, 3.6, int(x))
    for x in (-6.0, 6.0):
        e5.planter(p, q, (x - 1.2, -14.9, x + 1.2, -13.9), 0.0, 0.5, d['band'], int(x) + 20)
    e5.robot_locker(q, -13.0, -13.9, 0, 2.4, 1.9, 5, 4)
    e5.bench(q, 8.6, -14.8, 2.2)
    e5.delivery_robot(q, 3.4, -14.6, -20)
    e5.lamp_post(q, -3.0, -15.2, 4.5)
    e5.lamp_post(q, 3.0, -15.2, 4.5)
    for k, (x, y) in enumerate(((-15.0, 14.6), (15.0, 14.6), (15.0, 0.0), (-15.0, 0.0))):
        coconut_or_plant(b, x, y, k)


# shops ---------------------------------------------------------------------------------------------------------------

@building('shop_1', 1, 'คีออสก์อัจฉริยะ', 'Smart kiosk with robot lockers')
def shop_1(b):
    """A rounded kiosk with a serving window under a solar canopy, a green roof with a drone pad, a wall of robot
    lockers, delivery robots, a solar tree and seats among planters."""
    d = dress(b.region, 0)
    yard(b)
    p, q = b.main, b.props
    k = (-3.2, -0.4, 3.2, 3.0)
    plinth(b, k, d, 0.2, 0.3, 1.6)
    rbox(p, k[0], k[1], 0.2, k[2], k[3], 3.4, 1.4, d['wall'])
    kit.on_face(p, k, 'front', 0, 1.0, 4.0, 1.7, 0.07, d['glass'])
    for u in (-1.35, 0.0, 1.35):
        kit.on_face(p, k, 'front', u, 1.0, 0.05, 1.7, 0.1, d['trim'])
    kit.on_face(p, k, 'front', 0, 0.95, 4.3, 0.08, 0.5, d['louvre'])
    e5.louvres(p, k, 'left', 0.2, 3.4, -1.0, 1.0, 0.3, 0.22, 0.07, d['louvre'])
    e5.window(p, k, 'right', 0, 1.0, 1.4, 1.5, d)
    rbox(p, k[0] - 0.3, k[1] - 0.3, 3.4, k[2] + 0.3, k[3] + 0.3, 3.7, 1.7, d['band'])
    e5.glow_line(p, rrect(k[0] - 0.3, k[1] - 0.3, k[2] + 0.3, k[3] + 0.3, 1.7, 3), 3.62)
    kit.block(q, 0.3, 0.2, 3.7, 2.8, 2.6, 4.0, 'leaf_dark', bevel=0.08)
    for i in range(3):
        e5.shrub(q, 0.8 + i * 0.9, 1.4, 3.9, 0.35, i)
    e5.drone_pad_raised(p, q, -1.5, 1.3, 3.7, 1.25)
    # the solar canopy over the window
    for x in (-3.3, 3.3):
        p.cyl(0.07, 0.07, 3.2, 'steel', T(x, -3.3, 1.6), seg=8)
    kit.block(p, -3.6, -3.6, 3.15, 3.6, -0.4, 3.27, 'solar_frame')
    for i in range(6):
        for j in range(2):
            p.box((1.12, 1.5, 0.04), 'solar', T(-3.0 + i * 1.2, -2.8 + j * 1.6, 3.3))
    # lockers, robots and seats
    e5.robot_locker(q, 5.4, 1.0, 0, 3.0, 2.0, 6, 4)
    e5.delivery_robot(q, 4.4, -1.6, 15)
    e5.delivery_robot(q, 6.0, -1.9, -10, 'paint_yellow')
    e5.charger(q, 6.8, -0.8)
    e5.solar_tree(q, -5.6, -4.8, 4.6, 4, 1)
    for x, y in ((-1.8, -5.6), (1.8, -5.6)):
        q.cyl(0.45, 0.45, 0.05, d['louvre'], T(x, y, 0.75), seg=12)
        q.cyl(0.06, 0.06, 0.75, 'steel', T(x, y, 0.37), seg=6)
        for s in (-1, 1):
            q.cyl(0.2, 0.2, 0.45, 'robot_white', T(x + s * 0.75, y, 0.22), seg=10)
    e5.planter(p, q, (-7.4, -7.6, -3.6, -7.0), 0.0, 0.55, d['band'], 1)
    e5.planter(p, q, (3.6, -7.6, 7.4, -7.0), 0.0, 0.55, d['band'], 2)
    e5.bench(q, 0.0, -7.2, 2.4)
    e5.lawn(b, -7.95, 3.6, 7.95, 7.95)
    e5.bamboo_pot(q, -5.6, 1.2, 0.0, 3.0, 2)
    regions.plant(b, -5.8, 6.2, 0)
    regions.plant(b, 5.8, 6.2, 1)
    regions.plant(b, 0.0, 6.4, 2, big=False)


@building('shop_2', 2, 'อาคารร้านค้าเขียว', 'Green shop building')
def shop_2(b):
    """A two-floor shop: a glass shop front under a solar canopy, an upper floor behind timber fins, a living wall
    on its side and a solar gable on top; planters, bikes, a locker and a delivery robot in front."""
    d = dress(b.region, 1)
    yard(b)
    p, q = b.main, b.props
    rect = (-6.0, -2.4, 6.0, 5.6)
    x0, y0, x1, y1 = rect
    zf, G, U = 0.3, 4.0, 3.4
    plinth(b, rect, d, zf, 0.4, 0.4)
    rbox(p, x0, y0, zf, x1, y1, zf + G, (0, 0, 0, 0.8), d['wall'])
    kit.shopfront(p, rect, 'front', -0.4, zf, 9.6, 3.2, d['trim'], d['glass'], 2.0)
    rbox(p, x0 - 0.3, y0 - 0.3, zf + G - 0.05, x1 + 0.3, y1 + 0.3, zf + G + 0.3, (0.3, 0.3, 0.3, 1.1), d['band'])
    zu = zf + G + 0.3
    rbox(p, x0, y0, zu, x1, y1, zu + U, (0, 0, 0, 0.8), d['wall'])
    kit.on_face(p, rect, 'front', -1.6, zu + 0.4, 8.0, 2.4, 0.06, d['glass'])
    e5.louvres(p, rect, 'front', zu, zu + U, -5.6, 2.2, 0.32, 0.3, 0.08, d['louvre'])
    props.sign_board(q, rect, 'front', 4.0, zu + 0.9, 2.6, 1.2, 'sign_green', d['trim'], 2, out=0.05)
    e5.green_wall(p, rect, 'left', 0.0, zf + 0.3, 6.6, G + U - 0.4, 2)
    for u in (-2.2, 2.2):
        e5.window(p, rect, 'right', u, zu + 0.7, 1.6, 1.6, d)
    e5.window(p, rect, 'right', 0, zf + 0.9, 2.4, 1.8, d)
    zt = zu + U
    kit.bands(p, rect, zt - 0.05, 0.3, 0.12, d['band'])
    e5.solar_roof(p, rect, zt + 0.25, d, axis='x', pitch=0.5, over=0.6, over_ends=0.5)
    # the solar canopy over the shop front
    kit.block(p, x0 + 0.4, y0 - 2.0, zf + 3.35, x1 - 0.4, y0, zf + 3.5, 'solar_frame')
    for i in range(9):
        p.box((1.1, 1.8, 0.04), 'solar', T(x0 + 1.0 + i * 1.25, y0 - 1.0, zf + 3.53))
    for x in (x0 + 0.6, x1 - 0.6):
        p.rod((x, y0 - 1.9, zf + 3.4), (x, y0, zf + 4.2), 0.04, 'steel', seg=5)
    # the front
    e5.planter(p, q, (-6.8, -6.0, -2.4, -5.4), 0.0, 0.55, d['band'], 3, tall=1)
    e5.planter(p, q, (2.4, -6.0, 6.8, -5.4), 0.0, 0.55, d['band'], 4)
    for i in range(4):
        x = -1.6 + i * 0.9
        q.torus(0.33, 0.03, 'steel', T(x, -6.4, 0.38) @ R(90, 0, 90), seg=10, seg_minor=4)
    e5.robot_locker(q, 6.9, 1.4, 90, 2.6, 1.9, 5, 4, roof=False)
    e5.delivery_robot(q, 3.8, -4.0, 25)
    e5.bench(q, -4.2, -4.3, 2.0)
    e5.bollards(q, [(-2.0, -7.4), (2.0, -7.4)])
    e5.lawn(b, -7.95, 6.2, 7.95, 7.95)
    regions.plant(b, -6.6, 6.8, 0)
    regions.plant(b, 6.6, 6.8, 1)
    regions.plant(b, 0.0, 6.9, 2, big=False)


@building('shop_3', 3, 'อาคารผสม 8 ชั้น', 'Eight-floor mixed-use with terraces')
def shop_3(b):
    """Shops at the street, flats above stepping back twice into planted terraces with glass rails, timber fins,
    a roof pavilion under the region's gable, a drone pad and solar panels."""
    d = dress(b.region, 2)
    yard(b)
    p, q = b.main, b.props
    ra = (-6.2, -4.6, 6.2, 6.2)
    rb = (-6.2, -2.4, 6.2, 6.2)
    rc = (-6.2, -0.2, 6.2, 6.2)
    plinth(b, ra, d, 0.3, 0.5, 1.4)
    z1 = e5.tower(b, ra, 0.3, 1, 4.5, d, seed=1, r=1.2, fins=(), piers=True)
    gi = e5.inset(ra, 0.35)
    for u in (-3.6, 3.6):
        kit.on_face(p, gi, 'front', u, 0.3, 3.4, 3.6, 0.1, d['trim'])
        kit.on_face(p, gi, 'front', u, 0.4, 3.2, 3.4, 0.14, d['glass'])
        props.sign_board(q, gi, 'front', u, 4.0, 2.6, 0.45, ('sign_green', 'sign_cream')[int(u > 0)], d['trim'], 1,
                         out=0.1)
    e5.glass_door(p, gi, 'front', 0.0, 0.3, d, 1.8, 2.6)

    def plan_a(i):
        return [('front', -3.2, 3.8, 1.0, False), ('front', 3.2, 3.8, 1.0, i == 2)]
    z2 = e5.tower(b, ra, z1, 3, 3.2, d, seed=2, r=1.2, fins=('left',), terraces=plan_a)
    e5.planter(p, q, (-5.8, -4.5, 5.8, -3.9), z2, 0.6, d['band'], 5, tall=2)
    e5.glass_rail(p, [(-6.0, -4.8), (6.0, -4.8)], z2 + 0.6, h=0.5)
    z3 = e5.tower(b, rb, z2, 2, 3.2, d, seed=4, r=1.2, fins=('front',), fin_span=0.3)
    e5.planter(p, q, (-5.8, -2.3, 5.8, -1.7), z3, 0.6, d['band'], 6, tall=1)
    z4 = e5.tower(b, rc, z3, 2, 3.2, d, seed=6, r=1.2, fins=('left',))
    e5.parapet(b, rc, z4, d, 1.2, 1.0)
    e5.thai_crown(b, (-5.6, 1.6, -0.4, 5.6), z4, d, 3.2, axis='y')
    e5.drone_pad_raised(p, q, 3.2, 2.0, z4, 1.7)
    e5.solar_array(p, 0.6, 3.9, 5.6, 5.8, z4, 10.0)
    # the street
    for x in (-5.8, 5.8):
        e5.planter(p, q, (x - 1.4, -7.4, x + 1.4, -6.8), 0.0, 0.5, d['band'], int(x), tall=1)
    e5.bench(q, -2.4, -7.0, 2.0)
    e5.delivery_robot(q, 2.4, -6.4, 30)
    e5.lamp_post(q, 0.0, -7.4, 4.5)
    e5.lawn(b, -7.95, 6.8, 7.95, 7.95)
    regions.plant(b, -7.0, 7.0, 0, big=False)
    regions.plant(b, 7.0, 7.0, 1, big=False)


@building('shop_4', 4, 'สำนักงานเขียว 20 ชั้น', 'Twenty-floor green office')
def shop_4(b):
    """A twenty-floor green office: a tall glass lobby, full-height timber fins on two faces, sky gardens with
    trees every fourth floor, roof turbines, a drone pad and a pavilion under the region's gable."""
    d = dress(b.region, 0)
    yard(b)
    p, q = b.main, b.props
    rect = (-6.0, -5.4, 6.0, 6.0)
    plinth(b, rect, d, 0.3, 0.6, 2.2)
    z1 = e5.tower(b, rect, 0.3, 1, 5.0, d, seed=1, r=2.0, fins=(), piers=True)
    gi = e5.inset(rect, 0.35)
    e5.glass_door(p, gi, 'front', 0.0, 0.3, d, 3.0, 3.0)

    def plan(i):
        if i % 4 == 0:
            return [('front', 0.0, 10.0, 1.3, True), ('left', 0.0, 9.0, 1.1, True)]
        return []
    zt = e5.tower(b, rect, z1, 19, 4.0, d, seed=5, r=2.0, fins=('front', 'left'), fin_span=0.3, terraces=plan,
                  band_every=4)
    e5.parapet(b, rect, zt, d, 2.0, 1.2)
    e5.drone_pad_raised(p, q, -2.6, -2.2, zt, 2.2)
    e5.thai_crown(b, (0.6, 0.6, 5.2, 5.2), zt, d, 3.2, axis='y')
    e5.solar_array(p, -5.2, 1.4, -0.6, 5.2, zt, 10.0)
    for x in (2.0, 4.4):
        e5.vawt(p, x, -3.6, zt, 3.0, 0.8)
    # the plaza
    path(b, d, -2.0, -7.95, 2.0, -5.8)
    e5.lawn(b, -7.95, -7.95, -2.4, -6.4)
    e5.lawn(b, 2.4, -7.95, 7.95, -6.4)
    e5.bamboo_pot(q, -3.4, -6.9, 0.0, 3.4, 2)
    e5.bamboo_pot(q, 3.4, -6.9, 0.0, 3.4, 3)
    e5.robot_locker(q, -6.8, 1.0, -90, 2.6, 1.9, 5, 4, roof=False)
    e5.bench(q, 5.6, -7.0, 2.0)
    e5.lamp_post(q, -6.6, -6.8, 4.5)
    regions.plant(b, 6.9, 6.9, 0, big=False)
    regions.plant(b, -6.9, 6.9, 1, big=False)


@building('shop_5', 5, 'ห้างอีโค่โดมสวน', 'Eco-mall with a garden dome')
def shop_5(b):
    """The top shops on a joined lot: three floors stepping back into planted terraces, a curved glass entrance,
    and on the roof a big glass dome over the planted atrium, roof gardens, solar pergolas and a drone pad; solar
    trees, lockers and benches on the plaza."""
    d = dress(b.region, 1)
    yard(b)
    p, q = b.main, b.props
    r1 = (-14.6, -11.4, 14.6, 14.4)
    r2 = (-14.6, -8.4, 14.6, 14.4)
    r3 = (-14.6, -5.4, 14.6, 14.4)
    plinth(b, r1, d, 0.3, 0.6, 4.2)
    z1 = e5.tower(b, r1, 0.3, 1, 4.6, d, seed=1, r=3.6, fins=('left',), fin_span=0.3, piers=False)
    e5.planter(p, q, (-14.0, -11.3, -4.0, -10.6), z1, 0.6, d['band'], 1, tall=2)
    e5.planter(p, q, (4.0, -11.3, 14.0, -10.6), z1, 0.6, d['band'], 2, tall=2)
    z2 = e5.tower(b, r2, z1, 1, 4.6, d, seed=2, r=3.6, fins=(), piers=False)
    e5.planter(p, q, (-14.0, -8.3, 14.0, -7.6), z2, 0.6, d['band'], 3, tall=3)
    e5.glass_rail(p, [(-14.4, -8.7), (14.4, -8.7)], z2 + 0.6, h=0.5)
    z3 = e5.tower(b, r3, z2, 1, 4.6, d, seed=3, r=3.6, fins=('front',), fin_span=0.4, piers=False)
    # the curved glass entrance
    rbox(p, -5.0, -13.2, 0.3, 5.0, -11.0, 4.6, (2.0, 0, 0, 2.0), d['glass'])
    for k in range(7):
        x = -4.2 + k * 1.4
        kit.block(p, x - 0.04, -13.25, 0.3, x + 0.04, -11.2, 4.6, 'steel')
    rbox(p, -5.6, -13.8, 4.6, 5.6, -11.0, 4.9, (2.4, 0, 0, 2.4), d['band'])
    e5.glow_line(p, [(-3.4, -13.85), (3.4, -13.85)], 4.7, closed=False)
    e5.green_wall(p, r1, 'left', 6.0, 0.8, 8.0, 3.6, 5)
    # the roof: the atrium dome, gardens, pergolas and a drone pad
    e5.parapet(b, r3, z3, d, 3.6, 1.0)
    rbox(p, -8.0, -1.5, z3, 8.0, 11.5, z3 + 0.6, 2.0, d['band'])
    e5.dome(p, 0.0, 5.0, z3 + 0.6, 7.0, 'e5_sky_glass', 14, 'steel', 0.85)
    e5.roof_garden(b, (-14.0, -4.8, -9.0, 13.8), z3, 21, 3)
    e5.roof_garden(b, (9.0, 2.0, 14.0, 13.8), z3, 22, 2)
    e5.solar_pergola(p, (-7.0, 12.0, 7.0, 13.9), z3, 2.4)
    e5.solar_pergola(p, (8.6, -4.8, 14.0, 0.8), z3, 2.4)
    e5.drone_pad_raised(p, q, -4.0, -3.2, z3, 1.6, 2)
    # the plaza
    path(b, d, -5.0, -15.95, 5.0, -13.4)
    e5.lawn(b, -15.95, -15.95, -6.0, -12.6)
    e5.lawn(b, 6.0, -15.95, 15.95, -12.6)
    e5.solar_tree(q, -8.6, -14.0, 5.0, 4, 0)
    e5.solar_tree(q, 8.6, -14.0, 5.0, 4, 1)
    e5.robot_locker(q, -12.8, -13.6, 0, 3.0, 2.0, 6, 4)
    e5.robot_locker(q, 12.8, -13.6, 0, 3.0, 2.0, 6, 4)
    e5.bench(q, -5.8, -15.2, 2.2)
    e5.bench(q, 5.8, -15.2, 2.2)
    e5.delivery_robot(q, 2.0, -14.8, 20)
    e5.delivery_robot(q, -2.4, -15.2, -15, 'paint_yellow')
    for x in (-4.0, 4.0):
        e5.lamp_post(q, x, -15.4, 4.5)
    e5.drone_with_parcel(q, 6.0, -10.0, 14.0)
    for k, (x, y) in enumerate(((-15.2, 15.2), (15.2, 15.2), (15.2, 4.0), (-15.2, 4.0))):
        coconut_or_plant(b, x, y, k)


# factories ------------------------------------------------------------------------------------------------------------

def sawtooth(p, x0, x1, y0, y1, z, teeth, rise, d, glass=None):
    """A sawtooth roof: each tooth slopes up to the back with solar panels on it, glazed on its upright back."""
    step = (y1 - y0) / teeth
    for j in range(teeth):
        ya, yb = y0 + j * step, y0 + (j + 1) * step
        a, c = Vector((x0, ya, z)), Vector((x1, ya, z))
        e, f = Vector((x1, yb, z + rise)), Vector((x0, yb, z + rise))
        kit.slab(p, a, c, e, f, 0.15, 'solar_frame')
        base = Vector(((x0 + x1) / 2, ya, z))
        v = Vector((0, yb - ya, rise))
        e5.panels_on_plane(p, base, (1, 0, 0), v, x1 - x0 - 0.4, v.length, lift=0.0)
        kit.block(p, x0, yb - 0.08, z, x1, yb, z + rise, glass or d['glass'])
        for x in (x0, x1 - 0.15):
            kit.prism_x(p, [(ya, z), (yb, z), (yb, z + rise)], x, x + 0.15, d['wall'])
    return p


@building('factory_1', 1, 'โรงงานหุ่นยนต์สะอาด', 'Clean robotics workshop')
def factory_1(b):
    """A clean workshop under a sawtooth roof of solar panels and north light, big glass doors, a living wall,
    a rounded office with a green roof and a drone pad, a robot arm on its test pad and robots charging."""
    d = dress(b.region, 0)
    yard(b)
    p, q = b.main, b.props
    rect = (-6.2, -0.6, 6.2, 6.8)
    x0, y0, x1, y1 = rect
    H = 5.0
    plinth(b, rect, d, 0.2, 0.3, 0.3)
    kit.walls(p, rect, 0.2, H, d['wall2'])
    kit.bands(p, rect, 0.2, 0.6, 0.04, d['band'])
    kit.bands(p, rect, H - 0.5, 0.5, 0.06, d['band'])
    sawtooth(p, x0, x1, y0, y1, H, 3, 1.6, d)
    for u in (0.4, 4.0):
        kit.on_face(p, rect, 'front', u, 0.2, 3.2, 3.8, 0.08, d['trim'])
        kit.on_face(p, rect, 'front', u, 0.3, 3.0, 3.6, 0.1, d['glass'])
        for k in range(1, 4):
            kit.on_face(p, rect, 'front', u, 0.3 + k * 0.9, 3.0, 0.05, 0.13, d['trim'])
    e5.green_wall(p, rect, 'left', -1.2, 0.8, 4.4, 3.6, 1)
    e5.louvres(p, rect, 'right', 0.8, H - 0.5, -3.0, 3.0, 0.5, 0.3, 0.08, d['louvre'])
    # the office pod
    o = (-6.8, -4.4, -2.2, -0.6)
    rbox(p, o[0], o[1], 0.2, o[2], o[3], 3.6, (0, 0, 0, 1.6), d['wall'])
    kit.on_face(p, o, 'front', 0.6, 1.0, 3.0, 1.8, 0.07, d['glass'])
    e5.glass_door(p, o, 'right', 0.6, 0.2, d, 1.2, 2.4)
    rbox(p, o[0] - 0.2, o[1] - 0.2, 3.6, o[2] + 0.2, o[3], 3.9, (0, 0, 0, 1.8), d['band'])
    e5.drone_pad_raised(p, q, -4.4, -2.4, 3.9, 1.2)
    # the yard: a test pad with a robot arm, robots charging, crates
    kit.block(b.yard, -0.6, -7.2, 0.0, 5.6, -2.4, 0.08, 'e5_court')
    for y in (-7.0, -2.6):
        kit.block(b.yard, -0.6, y - 0.05, 0.0, 5.6, y + 0.05, 0.1, 'paint_yellow')
    robot_arm(q, 1.4, -4.8, 0.08, 20)
    props.crates(q, 3.6, -5.6, 3, 'timber', 0.6)
    for i in range(3):
        e5.delivery_robot(q, 6.8, -5.0 + i * 1.3, 90)
        e5.charger(q, 7.25, -5.0 + i * 1.3 + 0.55, 90)
    e5.lawn(b, -7.95, -7.95, -1.2, -5.0)
    e5.bamboo_pot(q, -5.4, -6.2, 0.0, 3.0, 1)
    regions.plant(b, -3.0, -6.8, 2, big=False)
    regions.plant(b, -7.0, 6.9, 0)


@building('factory_2', 2, 'ฟาร์มแนวตั้ง', 'Vertical farm')
def factory_2(b):
    """A six-floor vertical farm: glass floors full of planted racks under pink grow lights, rounded piers, a solar
    roof with a rain tank and a turbine; a packing shed in front with a drone pad, crates of greens and robots."""
    d = dress(b.region, 1)
    yard(b)
    p, q = b.main, b.props
    rect = (-4.6, -0.8, 4.6, 6.8)
    plinth(b, rect, d, 0.3, 0.4, 1.4)
    zt = e5.tower(b, rect, 0.3, 6, 3.6, d, seed=2, r=1.4, fins=('right',), fin_span=0.6, glass='glass_green',
                  band_every=3)
    gi = e5.inset(rect, 0.35)
    for i in range(6):
        z = 0.3 + i * 3.6
        for side in ('front', 'left'):
            fw = kit.face_width(gi, side) - 2.4
            for k, mat in enumerate(('leaf', 'leaf_light', 'leaf')):
                kit.on_face(p, gi, side, 0, z + 0.5 + k * 0.9, fw, 0.32, 0.04, mat, out=0.0)
                kit.on_face(p, gi, side, 0, z + 0.95 + k * 0.9, fw, 0.05, 0.04, 'e5_grow', out=0.0)
    e5.parapet(b, rect, zt, d, 1.4, 0.9)
    e5.solar_array(p, -3.8, 0.2, 1.8, 6.0, zt, 12.0)
    props.tank(p, 3.0, 4.6, 1.1, 2.2, 'stainless', 'flat', zt)
    e5.vawt(p, 3.0, 0.8, zt, 2.6, 0.7)
    # the packing shed
    s = (-6.8, -6.2, 1.6, -1.6)
    rbox(p, s[0], s[1], 0.2, s[2], s[3], 4.0, (0, 0, 0, 1.8), d['wall'])
    kit.roller_shutter(p, s, 'front', 0.6, 0.2, 3.0, 3.0, 'roller', 0.65)
    e5.window(p, s, 'left', 0.0, 1.2, 2.2, 1.4, d)
    rbox(p, s[0] - 0.2, s[1] - 0.2, 4.0, s[2] + 0.2, s[3], 4.3, (0, 0, 0, 2.0), d['band'])
    e5.drone_pad_raised(p, q, -4.8, -3.9, 4.3, 1.3)
    e5.solar_array(p, -3.2, -5.8, 1.2, -2.0, 4.3, 10.0)
    for i in range(4):
        x = 3.0 + (i % 2) * 0.7
        y = -6.2 + (i // 2) * 0.7
        kit.block(q, x - 0.3, y - 0.3, 0.0, x + 0.3, y + 0.3, 0.45, 'timber')
        e5.shrub(q, x, y, 0.4, 0.28, i, 'leaf_light')
    e5.delivery_robot(q, 5.6, -4.6, 60)
    e5.delivery_robot(q, 4.2, -2.8, 100, 'paint_yellow')
    e5.drone_with_parcel(q, 2.4, -3.8, 7.0)
    e5.rain_garden(b.yard, q, 5.2, 0.4, 7.4, 6.8, 3)
    regions.plant(b, -6.6, 6.6, 0)
    regions.plant(b, -6.8, 1.5, 1, big=False)


@building('factory_3', 3, 'โรงงานหลังคาเขียว', 'Green-roof factory with solar')
def factory_3(b):
    """A clean factory hall: half its roof a meadow with small trees, half solar panels, a glass ridge light, a
    slim heat-recovery stack with no smoke, a loading dock with roller doors, a rounded office with fins, a battery
    container and a rain tank."""
    d = dress(b.region, 2)
    yard(b)
    p, q = b.main, b.props
    rect = (-6.8, -1.0, 6.8, 6.8)
    x0, y0, x1, y1 = rect
    H = 6.5
    plinth(b, rect, d, 0.2, 0.3, 0.3)
    kit.walls(p, rect, 0.2, H, d['wall2'])
    for z in (0.2, 3.2):
        kit.bands(p, rect, z, 0.35, 0.04, d['band'])
    for u in (1.2, 4.6):
        kit.roller_shutter(p, rect, 'front', u, 1.4, 3.0, 3.6, 'roller', 0.3)
    kit.block(p, -0.6, y0 - 1.6, 0.0, 6.4, y0, 1.2, 'concrete')
    for x in (0.0, 2.9, 3.0, 5.8):
        kit.block(p, x - 0.15, y0 - 1.7, 0.6, x + 0.15, y0 - 1.6, 1.1, 'black')
    e5.louvres(p, rect, 'left', 3.6, H - 0.4, -3.4, 3.4, 0.5, 0.3, 0.08, d['louvre'])
    kit.flat_roof(p, rect, H, d['wall'], 0.6, d['band'], 0.25)
    zr = H + 0.25
    e5.roof_garden(b, (x0 + 0.3, y0 + 0.3, -0.8, y1 - 0.3), zr, 31, 3)
    e5.solar_array(p, 0.8, y0 + 0.4, x1 - 0.3, y1 - 0.4, zr, 12.0)
    kit.prism_y(p, [(-0.8, zr), (0.8, zr), (0.0, zr + 1.0)], y0 + 0.3, y1 - 0.3, d['glass'])
    p.cyl(0.55, 0.45, 9.0, 'e5_tube', T(5.6, 5.6, zr + 4.5), seg=14)
    p.torus(0.5, 0.08, 'e5_glow', T(5.6, 5.6, zr + 8.6), seg=14, seg_minor=4)
    p.torus(0.52, 0.08, d['band'], T(5.6, 5.6, zr + 7.0), seg=14, seg_minor=4)
    # the office
    o = (-6.8, -5.4, -1.6, -1.0)
    rbox(p, o[0], o[1], 0.2, o[2], o[3], 6.6, (0, 0, 0, 1.6), d['wall'])
    kit.bands(p, o, 3.4, 0.25, 0.1, d['band'])
    kit.on_face(p, o, 'front', 0.4, 0.8, 3.6, 2.2, 0.07, d['glass'])
    kit.on_face(p, o, 'front', 0.4, 4.0, 3.6, 2.0, 0.07, d['glass'])
    e5.louvres(p, o, 'front', 3.6, 6.6, -1.6, 2.4, 0.3, 0.3, 0.08, d['louvre'])
    e5.glass_door(p, o, 'right', 1.2, 0.2, d, 1.2, 2.4)
    rbox(p, o[0] - 0.2, o[1] - 0.2, 6.6, o[2] + 0.2, o[3], 6.9, (0, 0, 0, 1.8), d['band'])
    e5.roof_garden(b, (o[0] + 0.3, o[1] + 0.3, o[2] - 0.3, o[3] - 0.3), 6.9, 33, 1)
    # the yard
    kit.block(p, 4.4, -7.4, 0.0, 7.2, -5.6, 2.6, 'e5_battery')
    for k in range(6):
        kit.block(p, 4.5 + k * 0.45, -7.45, 0.3, 4.6 + k * 0.45, -7.4, 2.3, 'steel')
    kit.block(p, 4.4, -7.45, 2.3, 7.2, -7.4, 2.4, 'e5_glow')
    props.tank(q, 2.6, -6.6, 0.9, 2.6, 'tank_blue', 'cone')
    e5.delivery_robot(q, 1.0, -4.4, 0)
    e5.lawn(b, -7.95, -7.95, -0.6, -6.0)
    e5.bamboo_pot(q, -1.2, -6.6, 0.0, 3.0, 4)
    regions.plant(b, -7.0, 7.0, 0, big=False)
    regions.plant(b, 7.2, 7.2, 1, big=False)


@building('factory_4', 4, 'นิคมเทคโนโลยีสะอาด', 'Clean-tech park')
def factory_4(b):
    """The top workshops on a joined lot: a green-roofed hall and a sawtooth solar hall, an office with planted
    terraces joined to the hall by a sky bridge, a wind turbine, hydrogen spheres, battery containers, chargers and
    robots."""
    d = dress(b.region, 0)
    yard(b)
    p, q = b.main, b.props
    # hall A with a green roof
    a = (-15.0, 0.0, -1.2, 14.8)
    plinth(b, a, d, 0.2, 0.3, 0.3)
    kit.walls(p, a, 0.2, 7.0, d['wall2'])
    kit.bands(p, a, 0.2, 0.5, 0.04, d['band'])
    kit.bands(p, a, 5.6, 1.0, 0.02, d['glass'])
    for u in (-3.0, 1.6):
        kit.roller_shutter(p, a, 'front', u, 0.2, 3.6, 4.2, 'roller', 0.25)
    kit.flat_roof(p, a, 7.0, d['wall'], 0.6, d['band'], 0.25)
    e5.roof_garden(b, (a[0] + 0.3, a[1] + 0.3, a[2] - 0.3, a[3] - 0.3), 7.25, 41, 5)
    e5.green_wall(p, a, 'left', 0.0, 0.8, 10.0, 4.4, 3)
    # hall B with a sawtooth of solar panels
    hb = (1.2, 3.6, 15.0, 14.8)
    plinth(b, hb, d, 0.2, 0.3, 0.3)
    kit.walls(p, hb, 0.2, 6.0, d['wall2'])
    kit.bands(p, hb, 0.2, 0.5, 0.04, d['band'])
    sawtooth(p, hb[0], hb[2], hb[1], hb[3], 6.0, 4, 1.6, d)
    for u in (-3.6, 0.4, 4.4):
        kit.on_face(p, hb, 'front', u, 0.2, 3.0, 3.8, 0.08, d['trim'])
        kit.on_face(p, hb, 'front', u, 0.3, 2.8, 3.6, 0.1, d['glass'])
    # the office with terraces and the sky bridge to hall A
    o = (-15.0, -14.0, -6.0, -5.6)
    plinth(b, o, d, 0.3, 0.4, 1.6)

    def plan(i):
        return [('front', 0.0, 7.0, 1.2, i == 1), ('right', 0.0, 6.0, 1.2, i == 2)]
    zo = e5.tower(b, o, 0.3, 3, 3.6, d, seed=4, r=1.6, fins=('left',), fin_span=0.6, terraces=plan)
    e5.glass_door(p, e5.inset(o, 0.35), 'front', 2.0, 0.3, d, 2.0, 2.6)
    e5.parapet(b, o, zo, d, 1.6, 0.9)
    e5.roof_garden(b, (o[0] + 0.5, o[1] + 0.5, -10.0, o[3] - 0.5), zo, 43, 2)
    e5.drone_pad_raised(p, q, -8.0, -9.8, zo, 1.6)
    e5.sky_bridge(p, -12.0, -5.6, -9.0, 0.0, 3.9, 3.2, d)
    # energy: a wind turbine, hydrogen spheres, batteries
    e5.wind_turbine(p, 8.0, -9.4, 0.0, 22.0, 6.4)
    p.cyl(1.2, 1.4, 0.4, 'concrete', T(8.0, -9.4, 0.2), seg=14)
    for k, (x, y) in enumerate(((-2.4, -11.2), (1.8, -12.4))):
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.cyl(0.1, 0.1, 1.6, 'steel', T(x + sx * 1.2, y + sy * 1.2, 0.8), seg=6)
        p.sphere(1.9, 'e5_tube', T(x, y, 3.2), seg=16, rings=10)
        p.torus(1.92, 0.06, 'e5_glow', T(x, y, 3.2), seg=16, seg_minor=4)
    props.pipe_run(p, [(-2.4, -9.3, 3.2), (-2.4, -4.0, 3.2), (-2.4, -4.0, 1.0)], 0.12, 'steel')
    for k, x in enumerate((3.4, 9.6)):
        kit.block(p, x, -2.6, 0.0, x + 5.8, -0.4, 2.6, 'e5_battery')
        for i in range(12):
            kit.block(p, x + 0.2 + i * 0.47, -2.65, 0.3, x + 0.28 + i * 0.47, -2.6, 2.3, 'steel')
        kit.block(p, x, -2.65, 2.3, x + 5.8, -2.6, 2.42, 'e5_glow')
        e5.solar_array(p, x, -2.6, x + 5.8, -0.4, 2.6, 10.0)
    # the yard
    for i in range(3):
        e5.charger(q, -4.4 + i * 1.2, -4.2)
        e5.delivery_robot(q, -4.4 + i * 1.2, -3.2, 180)
    e5.rain_garden(b.yard, q, 11.0, -15.6, 15.4, -12.6, 6)
    e5.lawn(b, -15.95, -15.95, -5.4, -14.8)
    e5.lawn(b, 2.6, -15.95, 15.95, -4.0)
    for k, (x, y) in enumerate(((-15.3, 15.3), (0.0, 15.3), (15.3, 1.8), (-4.6, -15.0))):
        regions.plant(b, x, y, k, big=k % 2 == 0)


# services (3x3 tiles, 47 m) --------------------------------------------------------------------------------------------

E = 23.4


def lot(b, d, gate=7.0):
    yard(b)
    e5.fence_glass(b, E, gate)
    path(b, d, -gate / 2 + 0.6, -23.95, gate / 2 - 0.6, -18.0)


@building('ruler_house', None, 'หอว่าการเจ้าเมือง', 'Ruler’s civic hall')
def ruler_house(b):
    """The ruler's civic hall: a long hall on a stepped plinth under a sweeping solar gable, a front portico whose
    modern Thai gable faces the road, glass behind timber fins, two rounded wings with green roofs and a drone pad,
    a reflecting pool with lotus, the flag on its plinth, gardens and solar trees."""
    d = dress(b.region, 0)
    lot(b, d)
    p, q = b.main, b.props
    hall = (-13.0, 1.0, 13.0, 15.0)
    x0, y0, x1, y1 = hall
    zp = 1.2
    rbox(p, x0 - 2.0, y0 - 8.4, 0.0, x1 + 2.0, y1 + 1.5, zp, 1.5, d['band'])
    for i in range(6):
        kit.block(p, -6.0, y0 - 8.4 - (i + 1) * 0.25, 0.0, 6.0, y0 - 8.4 - i * 0.25, zp - (i + 1) * 0.18,
                  d['band'])
    H = 8.0
    kit.walls(p, hall, zp, zp + H, d['wall'])
    e5.glass_facade(p, (x0 + 1.0, y0 - 0.3, x1 - 1.0, y0 + 0.2), zp, zp + H - 0.6, d['glass'], d['trim'], 1.6, 2,
                    sides=('front',))
    e5.louvres(p, hall, 'front', zp + 0.3, zp + H - 0.3, -11.6, -3.4, 0.5, 0.45, 0.1, d['louvre'], out=0.3)
    e5.louvres(p, hall, 'front', zp + 0.3, zp + H - 0.3, 3.4, 11.6, 0.5, 0.45, 0.1, d['louvre'], out=0.3)
    for side in ('left', 'right'):
        for u in (-4.0, 0.0, 4.0):
            e5.window(p, hall, side, u, zp + 1.0, 2.0, 5.0, d, transom=False)
    kit.bands(p, hall, zp + H - 0.4, 0.4, 0.15, d['band'])
    e5.solar_roof(p, hall, zp + H, d, axis='x', pitch=0.62, over=1.2, over_ends=1.0, thick=0.3)
    # the portico to the road
    pt = (-6.0, y0 - 7.0, 6.0, y0)
    for x in (-5.6, -1.9, 1.9, 5.6):
        p.cyl(0.4, 0.4, H - 0.6, d['wall'], T(x, y0 - 6.6, zp + (H - 0.6) / 2), seg=12)
        p.cyl(0.48, 0.48, 0.4, d['band'], T(x, y0 - 6.6, zp + 0.2), seg=12)
    kit.block(p, pt[0] - 0.2, pt[1] - 0.2, zp + H - 0.6, pt[2] + 0.2, pt[3], zp + H, d['band'])
    e5.solar_roof(p, pt, zp + H, d, axis='y', pitch=0.75, over=0.8, over_ends=0.8, panels=False, fill=d['louvre'])
    e5.glass_door(p, hall, 'front', 0.0, zp, d, 4.0, 3.6)
    # two rounded wings
    for s in (-1, 1):
        w = (-22.0, 4.0, -15.4, 16.0) if s < 0 else (15.4, 4.0, 22.0, 16.0)
        rr = (0, 0, 0, 2.4) if s < 0 else (2.4, 0, 0, 0)
        rbox(p, w[0], w[1], 0.0, w[2], w[3], 7.0, rr, d['wall2'])
        kit.bands(p, w, 3.3, 0.3, 0.1, d['band'])
        kit.on_face(p, w, 'front', 0, 0.8, 4.0, 2.0, 0.07, d['glass'])
        kit.on_face(p, w, 'front', 0, 4.2, 4.0, 2.0, 0.07, d['glass'])
        e5.louvres(p, w, 'left' if s < 0 else 'right', 0.6, 6.8, -5.0, 5.0, 0.6, 0.3, 0.08, d['louvre'])
        rbox(p, w[0] - 0.2, w[1] - 0.2, 7.0, w[2] + 0.2, w[3] + 0.2, 7.3, tuple(x + 0.2 if x else 0 for x in rr),
             d['band'])
        e5.roof_garden(b, (w[0] + 0.4, w[1] + 0.4, w[2] - 0.4, w[3] - 0.4), 7.3, 50 + s, 2)
    e5.drone_pad_raised(p, q, 18.7, 13.0, 7.38, 2.0)
    # the forecourt: the reflecting pool, lotus, the flag
    kit.block(b.yard, -9.0, -17.0, 0.0, 9.0, -9.6, 0.15, 'concrete_light')
    kit.block(b.yard, -8.6, -16.6, 0.0, 8.6, -10.0, 0.18, 'e5_pool')
    for x in (-6.0, -2.0, 2.0, 6.0):
        q.cyl(0.35, 0.35, 0.02, 'leaf', T(x, -13.3 + (x % 3) * 0.3, 0.2), seg=8)
        q.sphere(0.14, 'lotus', T(x + 0.2, -13.2, 0.3) @ S(1, 1, 1.3), seg=8, rings=4)
    e5.flag(b, 0.0, -19.6, 10.0)
    path(b, d, -2.0, -19.0, 2.0, y0 - 8.4)
    for s in (-1, 1):
        e5.lawn(b, s * 10.5 - 6.0, -22.8, s * 10.5 + 6.0, -8.0)
        e5.solar_tree(q, s * 12.0, -14.0, 5.2, 4, s)
        e5.planter(p, q, (s * 4.2 - 1.5, -9.4, s * 4.2 + 1.5, -8.6), 0.0, 0.6, d['band'], 5 + s)
        for k in range(3):
            e5.bamboo_pot(q, s * (17.0 + k * 1.8), -20.6, 0.0, 3.4, k + 3 * s)
        e5.lamp_post(q, s * 3.4, -21.0, 4.5)
    for k, (x, y) in enumerate(((-20.0, 20.0), (20.0, 20.0), (-20.0, -4.0), (20.0, -4.0), (0.0, 20.0))):
        coconut_or_plant(b, x, y, k)
    regions.craft(b, -10.0, 19.0)


@building('school', None, 'โรงเรียนสีเขียว', 'Green campus school')
def school(b):
    """A green campus: two three-floor wings with planted terraces and timber fins joined by a sky bridge, an
    entrance pavilion under the region's gable, roof gardens and solar pergolas, a running track and a court, the
    flag and bamboo groves."""
    d = dress(b.region, 1)
    lot(b, d)
    p, q = b.main, b.props

    def plan(i):
        return [('front', -3.0, 7.0, 1.4, i == 1), ('front', 4.0, 6.0, 1.4, i == 2)]
    for s in (-1, 1):
        w = (-21.6, 3.0, -4.4, 13.0) if s < 0 else (4.4, 3.0, 21.6, 13.0)
        plinth(b, w, d, 0.3, 0.4, 2.0)
        zt = e5.tower(b, w, 0.3, 3, 3.6, d, seed=10 + s, r=2.0, fins=('left' if s < 0 else 'right',),
                      fin_span=0.7, terraces=plan)
        e5.parapet(b, w, zt, d, 2.0, 1.0)
        e5.roof_garden(b, (w[0] + 0.6, w[1] + 0.6, (w[0] + w[2]) / 2, w[3] - 0.6), zt, 60 + s, 2)
        e5.solar_pergola(p, ((w[0] + w[2]) / 2 + 0.4, w[1] + 0.6, w[2] - 0.6, w[3] - 0.6), zt, 2.4)
    # the entrance pavilion and the sky bridge
    c = (-4.4, 4.0, 4.4, 11.0)
    e5.glass_facade(p, c, 0.3, 7.5, d['glass'], d['trim'], 1.4, 2)
    rbox(p, c[0] - 0.4, c[1] - 0.4, 7.5, c[2] + 0.4, c[3] + 0.4, 7.8, 0.0, d['band'])
    regions.small_roof(p, (c[0] + 0.6, c[1] + 0.6, c[2] - 0.6, c[3] - 0.6), 7.8, d['region'], d['roof'], 'y', 0.8)
    e5.sky_bridge(p, -4.4, 11.4, 4.4, 13.6, 7.5, 3.2, d)
    e5.glass_door(p, c, 'front', 0.0, 0.3, d, 3.0, 2.8)
    # the playing fields
    rbox(b.yard, -21.8, -21.6, 0.0, 1.0, -6.0, 0.08, 6.0, 'e5_track')
    rbox(b.yard, -19.8, -19.6, 0.0, -1.0, -8.0, 0.1, 4.0, 'grass')
    for k in (1, 2):
        e5.ring_band(b.yard, rrect(-21.8 + k * 0.66, -21.6 + k * 0.66, 1.0 - k * 0.66, -6.0 - k * 0.66,
                                   6.0 - k * 0.66, 3), 0.085, 0.02, 0.05, 'paint_white')
    kit.block(b.yard, 5.0, -20.6, 0.0, 19.0, -8.6, 0.09, 'e5_court')
    e5.ring_band(b.yard, rrect(5.6, -20.0, 18.4, -9.2, 0, 1), 0.09, 0.02, 0.08, 'paint_white')
    kit.block(b.yard, 11.95, -20.0, 0.0, 12.05, -9.2, 0.11, 'paint_white')
    for x in (5.8, 18.2):
        q.box((0.08, 1.4, 0.9), 'grey', T(x, -14.6, 2.7))
        q.cyl(0.06, 0.06, 2.6, 'steel', T(x, -14.6, 1.3), seg=6)
    e5.flag(b, 3.0, -3.0, 10.0)
    path(b, d, -1.8, -23.95, 1.8, 4.0)
    for k in range(5):
        pr.bamboo_clump(q, -22.4, 15.0 + k * 1.6 - 6.0 * (k > 2), 7.0, seed=k + 70)
        pr.bamboo_clump(q, 22.4, 15.0 + k * 1.6 - 6.0 * (k > 2), 7.0, seed=k + 80)
    for k, x in enumerate((-18.0, -10.0, 10.0, 18.0)):
        regions.plant(b, x, 20.0, k)
    for x in (-3.0, 3.0):
        e5.bench(q, x, -1.6, 2.4)
    e5.solar_tree(q, 3.0, -21.0, 5.0, 4, 2)


@building('hospital', None, 'โรงพยาบาลหอคอยเขียว', 'Curved green hospital')
def hospital(b):
    """A curved green hospital tower over a two-floor podium: planted balconies along its curved front, a medical
    drone pad on top with a green H (no red cross), a green H sign over the entrance, a healing garden with a rain
    garden and benches."""
    d = dress(b.region, 2)
    lot(b, d, 8.0)
    p, q = b.main, b.props
    pod = (-20.0, -2.0, 20.0, 18.0)
    plinth(b, pod, d, 0.3, 0.5, 3.0)
    zp = e5.tower(b, pod, 0.3, 2, 4.2, d, seed=2, r=3.0, fins=('front',), fin_span=0.3, piers=False)
    gi = e5.inset(pod, 0.35)
    e5.glass_door(p, gi, 'front', 0.0, 0.3, d, 4.0, 3.0)
    h_sign(p, 0.0, pod[1] - 0.45, zp - 2.2, 2.0)
    e5.parapet(b, pod, zp, d, 3.0, 1.0)
    e5.roof_garden(b, (-19.4, -1.4, -12.0, 17.4), zp, 70, 3)
    e5.roof_garden(b, (12.0, -1.4, 19.4, 17.4), zp, 71, 3)
    # the curved tower
    cx, cy, rx, ry = 0.0, 9.0, 11.0, 6.5
    floors, fh = 8, 3.6
    zt = zp + floors * fh
    core = e5.ellipse(cx, cy, rx - 0.4, ry - 0.4, 32)
    e5.prism(p, core, zp, zt, d['glass'])
    for k, (x, y) in enumerate(e5.ellipse(cx, cy, rx - 0.35, ry - 0.35, 32)):
        p.box((0.08, 0.08, zt - zp), 'steel', T(x, y, (zp + zt) / 2))
    front = [pt for pt in e5.ellipse(cx, cy, rx + 1.0, ry + 1.0, 32)]
    front = front[16:] + front[:1]
    for i in range(1, floors + 1):
        z = zp + i * fh
        ext = 1.4 if i < floors else 0.3
        e5.prism(p, e5.ellipse(cx, cy, rx + ext, ry + ext, 32), z - 0.32, z, d['wall'] if i % 4 else d['band'])
        if i < floors:
            e5.ring_band(p, front, z - 0.3, 0.6, 0.35, d['band'], closed=False)
            e5.ring_band(q, front, z + 0.3, 0.3, 0.32, 'leaf_dark', closed=False)
            for k in range(0, len(front), 3 + i % 2):
                x, y = front[k]
                e5.shrub(q, x, y, z + 0.3, 0.4, i + k, 'flower_pink' if (i + k) % 5 == 0 else None)
            e5.glow_line(p, front, z - 0.25, closed=False)
    # the roof: the medical drone pad and turbines
    e5.prism(p, e5.ellipse(cx, cy, rx + 0.3, ry + 0.3, 32), zt, zt + 0.9, d['wall'])
    e5.prism(p, e5.ellipse(cx, cy, rx, ry, 32), zt + 0.9, zt + 0.95, 'grass')
    green_pad(p, cx - 3.0, cy, zt + 0.95, 3.4)
    e5.drone_with_parcel(q, cx - 3.0, cy, zt + 1.4, 1.2)
    e5.solar_array(p, cx + 1.8, cy - 3.6, cx + 8.0, cy + 3.6, zt + 0.95, 10.0)
    h_sign(p, cx, cy - ry - 0.4, zt - 1.6, 2.4)
    # the healing garden
    e5.rain_garden(b.yard, q, -20.0, -20.0, -9.0, -12.0, 7)
    e5.lawn(b, 6.0, -21.0, 21.0, -5.0)
    for k, (x, y) in enumerate(((9.0, -18.0), (14.0, -15.0), (19.0, -19.0), (17.0, -8.0))):
        props.tree(q, x, y, 6.0, 2.4, 80 + k)
    for x in (9.0, 13.0, 17.0):
        e5.bench(q, x, -11.0, 2.2)
    for x in (-6.0, -2.0, 2.0, 6.0):
        e5.lamp_post(q, x, -16.0 + abs(x) * 0.2, 4.5)
    e5.planter(p, q, (-8.0, -5.6, -3.0, -4.8), 0.0, 0.6, d['band'], 8)
    e5.planter(p, q, (3.0, -5.6, 8.0, -4.8), 0.0, 0.6, d['band'], 9)
    for k, (x, y) in enumerate(((-21.6, 21.0), (21.6, 21.0), (-21.6, 0.0), (21.6, 0.0))):
        coconut_or_plant(b, x, y, k)


@building('police', None, 'สถานีตำรวจโดรน', 'Drone police station')
def police(b):
    """A police station of the future: a rounded two-floor building with fins and a roof of drone docks, a round
    control tower with a glass top and a drone pad, the flag, a plaza and gardens."""
    d = dress(b.region, 0)
    lot(b, d)
    p, q = b.main, b.props
    m = (-18.0, 2.0, 8.0, 16.0)
    plinth(b, m, d, 0.3, 0.5, 2.4)
    zt = e5.tower(b, m, 0.3, 2, 4.0, d, seed=3, r=2.4, fins=('front',), fin_span=0.5, piers=False)
    e5.glass_door(p, e5.inset(m, 0.35), 'front', 5.0, 0.3, d, 3.0, 2.8)
    props.sign_board(q, e5.inset(m, 0.35), 'front', -2.0, 4.6, 6.0, 1.0, 'sign_blue', 'steel', 1, out=0.4)
    e5.parapet(b, m, zt, d, 2.4, 1.0)
    for i in range(4):
        drone_dock(p, q, -15.0 + i * 3.4, 12.0, zt, d)
    e5.drone_pad_raised(p, q, -13.0, 6.0, zt, 2.2)
    e5.solar_array(p, -8.0, 4.0, 6.6, 15.0, zt, 10.0)
    # the control tower
    tx, ty = 15.0, 10.0
    p.cyl(3.0, 3.0, 0.3, d['band'], T(tx, ty, 0.15), seg=24)
    p.cyl(2.2, 2.2, 14.0, d['wall'], T(tx, ty, 7.0), seg=24)
    for k in range(4):
        p.torus(2.25, 0.1, d['band'], T(tx, ty, 3.0 + k * 3.0), seg=24, seg_minor=4)
    p.cyl(3.4, 3.4, 0.3, d['wall'], T(tx, ty, 14.15), seg=24)
    p.cyl(3.2, 3.2, 3.0, 'e5_sky_glass', T(tx, ty, 15.8), seg=24)
    for k in range(12):
        a = math.tau * k / 12
        p.box((0.1, 0.1, 3.0), 'steel', T(tx + math.cos(a) * 3.22, ty + math.sin(a) * 3.22, 15.8))
    p.cyl(3.8, 3.8, 0.35, d['band'], T(tx, ty, 17.45), seg=24)
    e5.glow_line(p, e5.ellipse(tx, ty, 3.82, 3.82, 24), 17.5)
    e5.drone_pad_raised(p, q, tx, ty, 17.6, 3.0)
    kit.block(p, tx - 3.2, ty - 3.4, 0.3, tx - 1.0, ty - 2.0, 2.6, d['glass'])
    e5.sky_bridge(p, 8.0, 8.6, 12.9, 11.4, 4.3, 3.0, d)
    # the plaza and gardens
    e5.flag(b, -6.0, -6.0, 10.0)
    e5.lawn(b, -22.8, -22.8, -6.0, -10.0)
    e5.lawn(b, 6.0, -22.8, 22.8, -4.0)
    e5.rain_garden(b.yard, q, 9.0, -20.0, 19.0, -14.0, 9)
    for x in (-3.0, 3.0):
        e5.bench(q, x, -8.0, 2.2)
        e5.lamp_post(q, x * 1.6, -15.0, 4.5)
    for k in range(3):
        props.drone(q, -12.0 + k * 4.0, -16.0 + k, 12.0 + k * 2.0, 0.9)
    for k, (x, y) in enumerate(((-21.0, 20.0), (21.0, 20.0), (-21.0, -2.0), (21.0, -2.0), (0.0, 20.0))):
        coconut_or_plant(b, x, y, k)
    e5.planter(p, q, (-18.0, -3.8, -8.0, -3.0), 0.0, 0.6, d['band'], 11, tall=2)


@building('fire', None, 'สถานีดับเพลิงโดรน', 'Fire station with drones')
def fire(b):
    """A fire station of the future: an engine hall with three tall bay doors, a living floor behind fins, drone
    bays on the roof with water-carrying drones, a drill tower with a drone pad, hydrants, a water tank and the
    flag."""
    d = dress(b.region, 1)
    lot(b, d, 12.0)
    p, q = b.main, b.props
    h = (-18.0, 1.0, 6.0, 15.0)
    plinth(b, h, d, 0.2, 0.5, 2.0)
    rbox(p, h[0], h[1], 0.2, h[2], h[3], 6.0, (0, 0, 0, 2.0), d['wall'])
    for k, u in enumerate((-7.0, 0.0, 7.0)):
        kit.on_face(p, h, 'front', u, 0.2, 5.4, 5.0, 0.1, 'paint_red')
        kit.roller_shutter(p, h, 'front', u, 0.2, 5.0, 4.6, 'paint_red', 0.75)
        kit.on_face(p, h, 'front', u, 4.95, 4.6, 0.08, 0.2, 'e5_glow')
    rbox(p, h[0] - 0.3, h[1] - 0.3, 6.0, h[2] + 0.3, h[3] + 0.3, 6.3, (0.3, 0.3, 0.3, 2.3), d['band'])
    up = (h[0], h[1] + 3.0, h[2], h[3])
    rbox(p, up[0], up[1], 6.3, up[2], up[3], 9.6, (0, 0, 0, 2.0), d['wall2'])
    kit.on_face(p, up, 'front', 0, 7.0, 22.0, 2.0, 0.06, d['glass'])
    e5.louvres(p, up, 'front', 6.3, 9.6, -11.6, 11.6, 0.6, 0.3, 0.08, d['louvre'])
    e5.planter(p, q, (h[0] + 0.4, h[1] - 0.2, h[2] - 0.4, h[1] + 0.6), 6.3, 0.6, d['band'], 12)
    rbox(p, up[0] - 0.2, up[1] - 0.2, 9.6, up[2] + 0.2, up[3] + 0.2, 9.9, (0, 0, 0, 2.2), d['band'])
    for i in range(4):
        drone_dock(p, q, -15.0 + i * 3.6, 7.0, 9.9, d)
    for k in range(4):
        x = -15.0 + k * 3.6
        q.box((0.5, 0.5, 0.35), 'paint_red', T(x, 7.0, 10.3), bevel=0.05)
    e5.solar_array(p, -16.4, 9.6, 4.6, 14.4, 9.9, 10.0)
    # the drill tower
    t = (10.0, 6.0, 15.0, 11.0)
    rbox(p, t[0], t[1], 0.0, t[2], t[3], 18.0, 1.0, d['wall'])
    for z in range(2, 18, 3):
        kit.on_face(p, t, 'front', 0, z, 2.0, 1.4, 0.07, d['glass'])
        kit.on_face(p, t, 'left', 0, z, 2.0, 1.4, 0.07, d['glass'])
    e5.louvres(p, t, 'front', 0.5, 18.0, 1.4, 2.2, 0.4, 0.25, 0.07, d['louvre'])
    rbox(p, t[0] - 0.4, t[1] - 0.4, 18.0, t[2] + 0.4, t[3] + 0.4, 18.4, 1.4, 'paint_red')
    e5.drone_pad_raised(p, q, 12.5, 8.5, 18.4, 2.2)
    props.tank(p, 18.5, 14.0, 2.4, 6.0, 'stainless', 'flat')
    # the apron and the yard
    kit.block(b.yard, -18.0, -14.0, 0.0, 6.0, 0.6, 0.08, 'concrete')
    for u in (-7.0, 0.0, 7.0):
        kit.block(b.yard, u - 6.0 - 0.1, -14.0, 0.0, u - 6.0 + 0.1, 0.6, 0.1, 'paint_yellow')
    for x, y in ((8.0, -4.0), (-20.0, -2.0), (8.0, 4.0)):
        q.cyl(0.18, 0.18, 0.8, 'paint_red', T(x, y, 0.4), seg=8)
        q.sphere(0.18, 'paint_red', T(x, y, 0.8), seg=8, rings=4)
    for k in range(2):
        e5.drone_with_parcel(q, -8.0 + k * 9.0, -9.0, 9.0 + k * 3.0, 1.1)
    e5.flag(b, 14.0, -8.0, 10.0)
    e5.lawn(b, 9.0, -22.8, 22.8, -12.0)
    for k, (x, y) in enumerate(((-21.0, 20.0), (0.0, 20.0), (-21.0, -12.0), (21.0, 2.0))):
        coconut_or_plant(b, x, y, k)


@building('water_works', None, 'โรงผลิตน้ำฝนและน้ำรีไซเคิล', 'Rainwater and recycling plant')
def water_works(b):
    """Clean water of the future: a membrane hall with a solar roof, two glass domes of planted biofilters,
    round clarifiers full of water, tall rain tanks, pipes, and a reed bed garden in front."""
    d = dress(b.region, 2)
    lot(b, d)
    p, q = b.main, b.props
    m = (-21.0, -6.0, -2.0, 4.0)
    plinth(b, m, d, 0.3, 0.4, 2.0)
    rbox(p, m[0], m[1], 0.3, m[2], m[3], 6.5, (0, 0, 0, 2.0), d['wall'])
    kit.on_face(p, m, 'front', 0, 1.0, 16.0, 4.6, 0.07, d['glass'])
    e5.louvres(p, m, 'front', 0.6, 6.5, -8.8, 8.8, 0.6, 0.3, 0.08, d['louvre'])
    rbox(p, m[0] - 0.3, m[1] - 0.3, 6.5, m[2] + 0.3, m[3] + 0.3, 6.8, (0, 0, 0, 2.3), d['band'])
    e5.solar_array(p, m[0] + 0.6, m[1] + 0.4, m[2] - 0.6, m[3] - 0.4, 6.8, 12.0)
    # the biofilter domes
    for x, y, r in ((-11.5, 14.0, 7.6), (5.0, 14.5, 6.4)):
        p.cyl(r + 0.4, r + 0.4, 0.6, d['band'], T(x, y, 0.3), seg=28)
        e5.prism(p, e5.ellipse(x, y, r - 0.3, r - 0.3, 20), 0.6, 0.7, 'grass')
        for k in range(5):
            a = k * 1.3
            e5.small_tree(q, x + math.cos(a) * r * 0.45, y + math.sin(a) * r * 0.45, 0.7, 3.0, 1.2, k)
        e5.dome(p, x, y, 0.6, r, 'e5_sky_glass', 12, 'steel', 0.8)
    # the clarifiers
    for x, y in ((17.0, -1.0), (17.0, 11.0)):
        p.lathe([(4.6, 0), (4.6, 2.4), (4.3, 2.4), (4.3, 0.6)], d['wall'], T(x, y, 0), seg=28)
        p.cyl(4.35, 4.35, 0.05, 'water', T(x, y, 2.2), seg=28)
        p.box((8.6, 0.6, 0.3), 'steel', T(x, y, 2.6))
        p.cyl(0.4, 0.4, 0.8, 'steel', T(x, y, 2.6), seg=10)
        e5.ring_band(p, e5.ellipse(x, y, 4.6, 4.6, 28), 2.4, 1.0, 0.04, 'steel')
    # the rain tanks and pipes
    for k, x in enumerate((4.0, 9.0)):
        props.tank(p, x, -4.0, 2.0, 8.0, d['wall2'] if k else 'stainless', 'cone')
        p.torus(2.03, 0.07, 'e5_glow', T(x, -4.0, 7.0), seg=18, seg_minor=4)
    props.pipe_run(p, [(-2.0, -1.0, 2.0), (4.0, -1.0, 2.0), (12.6, -1.0, 2.0)], 0.18, 'steel')
    props.pipe_run(p, [(9.0, -2.0, 1.2), (9.0, 11.0, 1.2), (12.6, 11.0, 1.2)], 0.18, 'steel')
    props.pipe_run(p, [(-11.5, 6.4, 1.0), (-11.5, 4.0, 1.0)], 0.18, 'steel')
    # the reed bed garden in front
    e5.rain_garden(b.yard, q, -21.6, -21.6, -4.6, -10.0, 11)
    e5.rain_garden(b.yard, q, 4.6, -21.6, 21.6, -10.0, 12)
    for x in (-3.0, 3.0):
        e5.lamp_post(q, x, -12.0, 4.5)
    for k, (x, y) in enumerate(((-21.6, 21.6), (21.6, 21.6), (-1.0, 21.0))):
        regions.plant(b, x, y, k)


@building('power_plant', None, 'โรงไฟฟ้าสะอาดวงแหวนฟิวชัน', 'Clean power: fusion ring and solar')
def power_plant(b):
    """Clean power: a fusion-like ring hall round a ribbed dome core, banks of batteries with solar on top, a solar
    field to the front, two wind turbines and a control building with a green roof."""
    d = dress(b.region, 0)
    lot(b, d, 6.0)
    p, q = b.main, b.props
    cx, cy = 6.0, 9.0
    p.cyl(13.0, 13.0, 0.4, d['band'], T(cx, cy, 0.2), seg=40)
    p.torus(9.5, 2.6, 'e5_reactor', T(cx, cy, 3.0), seg=40, seg_minor=12)
    for k in range(16):
        a = math.tau * k / 16
        p.torus(2.7, 0.15, d['band'] if k % 2 else 'steel',
                T(cx + math.cos(a) * 9.5, cy + math.sin(a) * 9.5, 3.0) @ R(0, 0, math.degrees(a)) @ R(90, 0, 0),
                seg=14, seg_minor=4)
    p.torus(9.5, 0.12, 'e5_glow', T(cx, cy, 5.62), seg=40, seg_minor=4)
    p.cyl(6.2, 6.2, 5.0, d['wall'], T(cx, cy, 2.9), seg=32)
    e5.dome(p, cx, cy, 5.4, 6.2, 'e5_reactor', 16, d['band'], 0.9, (0.4, 0.75), 32)
    p.cyl(1.0, 1.0, 1.5, 'e5_sky_glass', T(cx, cy, 11.5), seg=16)
    p.torus(1.0, 0.1, 'e5_glow', T(cx, cy, 12.3), seg=16, seg_minor=4)
    # batteries with solar on top
    for k in range(3):
        y = 5.0 + k * 5.0
        kit.block(p, -21.0, y, 0.0, -10.0, y + 2.6, 2.8, 'e5_battery')
        for i in range(16):
            kit.block(p, -20.8 + i * 0.68, y - 0.05, 0.3, -20.7 + i * 0.68, y, 2.5, 'steel')
        kit.block(p, -21.0, y - 0.06, 2.5, -10.0, y, 2.62, 'e5_glow')
        e5.solar_array(p, -21.0, y, -10.0, y + 2.6, 2.8, 8.0)
    # the solar field
    e5.solar_array(p, -21.5, -21.5, -4.0, -8.0, 0.0, 15.0)
    e5.solar_array(p, 4.0, -21.5, 21.5, -8.0, 0.0, 15.0)
    # wind turbines
    for x, y in ((-16.0, 19.5), (16.0, -4.0)):
        p.cyl(1.0, 1.2, 0.4, 'concrete', T(x, y, 0.2), seg=12)
        e5.wind_turbine(p, x, y, 0.0, 24.0, 6.6)
    # the control building
    c = (-8.0, -5.0, 0.0, 1.0)
    rbox(p, c[0], c[1], 0.0, c[2], c[3], 3.8, (1.6, 0, 0, 1.6), d['wall'])
    kit.on_face(p, c, 'front', 0, 0.8, 6.0, 2.2, 0.07, d['glass'])
    e5.louvres(p, c, 'front', 0.2, 3.8, -3.6, 3.6, 0.4, 0.25, 0.07, d['louvre'])
    rbox(p, c[0] - 0.2, c[1] - 0.2, 3.8, c[2] + 0.2, c[3] + 0.2, 4.1, (1.8, 0, 0, 1.8), d['band'])
    e5.roof_garden(b, (c[0] + 0.4, c[1] + 0.4, c[2] - 0.4, c[3] - 0.4), 4.1, 90, 1)
    # transformer yard
    for k in range(3):
        x = -20.0 + k * 3.0
        kit.block(p, x, 19.0, 0.0, x + 2.0, 21.0, 2.4, 'grey')
        for i in range(3):
            p.cyl(0.08, 0.12, 0.8, 'paint_white', T(x + 0.4 + i * 0.6, 20.0, 2.8), seg=6)
    for k, (x, y) in enumerate(((22.0, 22.0), (-2.0, 22.0), (22.0, 6.0))):
        regions.plant(b, x, y, k)


@building('waste', None, 'ศูนย์รีไซเคิลวงกลม', 'Circular recycling centre')
def waste(b):
    """The circular recycling centre: a round hall under a planted cone roof with a glass lantern, a conveyor to
    bays of sorted material, biogas domes, a ring of solar on the yard and robots."""
    d = dress(b.region, 1)
    lot(b, d)
    p, q = b.main, b.props
    cx, cy, R0 = 0.0, 8.0, 12.5
    p.cyl(R0 + 0.6, R0 + 0.6, 0.4, d['band'], T(cx, cy, 0.2), seg=40)
    p.cyl(R0, R0, 6.4, d['wall'], T(cx, cy, 3.6), seg=40)
    p.torus(R0 + 0.05, 0.12, d['band'], T(cx, cy, 3.4), seg=40, seg_minor=4)
    for k in range(20):
        a = math.tau * k / 20
        if math.sin(a) < 0.2:
            p.box((0.12, 0.4, 5.6), d['louvre'], T(cx + math.cos(a) * (R0 + 0.15), cy + math.sin(a) * (R0 + 0.15),
                                                    3.6) @ R(0, 0, math.degrees(a)))
    for a_deg in (-90.0, -60.0, -120.0):
        a = math.radians(a_deg)
        p.box((3.2, 0.2, 3.4), 'roller', T(cx + math.cos(a) * (R0 + 0.05), cy + math.sin(a) * (R0 + 0.05), 2.1)
              @ R(0, 0, a_deg + 90))
    p.lathe([(R0 + 0.8, 0), (R0 + 0.8, 0.3), (4.2, 4.4), (4.0, 4.4)], 'grass', T(cx, cy, 6.8), seg=40,
            cap_bottom=True)
    for k in range(14):
        a = math.tau * k / 14 + 0.2
        rr = 6.5 + (k % 3) * 1.8
        zz = 6.8 + 0.3 + (R0 + 0.8 - rr) / (R0 + 0.8 - 4.2) * 4.1
        e5.shrub(q, cx + math.cos(a) * rr, cy + math.sin(a) * rr, zz - 0.3, 0.6, k)
    p.cyl(4.0, 4.0, 1.8, 'e5_sky_glass', T(cx, cy, 12.1), seg=24)
    p.cyl(4.3, 4.3, 0.3, d['band'], T(cx, cy, 13.15), seg=24)
    e5.glow_line(p, e5.ellipse(cx, cy, 4.32, 4.32, 24), 13.3)
    # conveyor and the sorted bays
    p.rod((5.0, -4.0, 0.9), (5.0, -14.0, 3.2), 0.5, 'grey', seg=6)
    for t in range(6):
        p.box((1.2, 0.1, 0.1), 'iron', T(5.0, -4.0 - t * 2.0, 0.9 + t * 0.46))
    for k, mat in enumerate(('paint_blue', 'paint_green', 'paint_yellow', 'paint_orange', 'grey')):
        x = -18.0 + k * 4.4
        kit.block(p, x - 2.0, -16.0, 0.0, x + 2.0, -12.0, 0.25, 'concrete')
        for wx in (x - 2.0, x + 2.0):
            kit.block(p, wx - 0.12, -16.0, 0.0, wx + 0.12, -12.0, 2.0, 'concrete_light')
        for i in range(4):
            kit.block(q, x - 1.4 + (i % 2) * 1.5, -15.4 + (i // 2) * 1.5, 0.25, x - 0.1 + (i % 2) * 1.5,
                      -14.1 + (i // 2) * 1.5, 1.3, mat, bevel=0.05)
    # biogas domes
    for x, y in ((17.0, -2.0), (17.0, 6.5)):
        p.cyl(3.4, 3.4, 1.2, 'concrete', T(x, y, 0.6), seg=24)
        p.cap(3.2, 'e5_tube', T(x, y, 1.2) @ S(1, 1, 0.8), keep=lambda co, z=1.2: co.z >= z - 0.01, seg=20, rings=10)
        p.torus(3.25, 0.08, 'e5_glow', T(x, y, 1.3), seg=24, seg_minor=4)
    props.pipe_run(p, [(13.6, -2.0, 1.0), (11.0, 2.0, 1.0)], 0.15, 'steel')
    e5.solar_array(p, -21.5, 17.0, 21.5, 21.8, 0.0, 15.0)
    for k in range(3):
        e5.delivery_robot(q, 9.0 + k * 1.4, -18.0, 0, ('paint_green', 'robot_white', 'paint_yellow')[k])
    e5.lawn(b, 10.0, -22.8, 22.8, -10.0)
    for k, (x, y) in enumerate(((20.0, -20.0), (12.0, -13.0), (-21.5, 2.0))):
        regions.plant(b, x, y, k)


@building('station', None, 'สถานีแม็กเลฟ', 'Maglev station')
def station(b):
    """The station of the future: a raised guideway crosses the lot, closed in a ribbed tube outside the station
    and open under a glass vault over the platforms where a maglev train waits; a concourse with fins below, an
    entrance canopy, a drone-taxi pad, lockers and a plaza."""
    d = dress(b.region, 2)
    lot(b, d, 10.0)
    p, q = b.main, b.props
    gy, gz = 6.0, 9.6
    # the concourse
    c = (-15.0, -2.0, 15.0, 14.0)
    plinth(b, c, d, 0.3, 0.5, 2.6)
    rbox(p, c[0], c[1], 0.3, c[2], c[3], gz - 1.4, 2.4, d['wall'])
    gi = c
    kit.on_face(p, c, 'front', 0, 0.8, 24.0, 5.6, 0.07, d['glass'])
    e5.louvres(p, c, 'front', 0.3, gz - 1.4, -13.0, 13.0, 0.7, 0.35, 0.09, d['louvre'])
    e5.glass_door(p, c, 'front', 0.0, 0.3, d, 4.0, 3.0)
    rbox(p, c[0] - 0.3, c[1] - 0.3, gz - 1.4, c[2] + 0.3, c[3] + 0.3, gz - 1.1, 2.7, d['band'])
    # platforms and the train
    for y0, y1 in ((gy - 5.2, gy - 1.8), (gy + 1.8, gy + 5.2)):
        kit.block(p, -14.0, y0, gz - 1.1, 14.0, y1, gz + 0.1, 'concrete_light')
        kit.block(p, -14.0, y0 if y0 > gy else y1 - 0.4, gz + 0.1, 14.0, y0 + 0.4 if y0 > gy else y1, gz + 0.12,
                  'paint_yellow')
    e5.guideway(p, -23.4, 23.4, gy, gz - 0.4, 3.0, (-19.5, 19.5))
    e5.maglev_train(q, -12.0, 12.0, gy, gz - 0.4, 2)
    for y in (gy - 3.6, gy + 3.6):
        for x in (-6.0, 6.0):
            kit.block(p, x - 1.0, y - 0.6, gz + 0.1, x + 1.0, y + 0.6, gz + 2.6, d['glass'])
    # the glass vault over the platforms, with ribs
    zs = gz + 3.6
    e5.vault(p, -14.5, 14.5, gy, 6.6, zs, 4.0, 0.12, 'e5_sky_glass', 14)
    for k in range(9):
        x = -14.5 + k * 29.0 / 8
        e5.vault(p, x - 0.15, x + 0.15, gy, 6.75, zs, 4.15, 0.3, d['band'] if k in (0, 8) else 'steel', 14)
    for x in (-14.2, -7.0, 0.0, 7.0, 14.2):
        for y in (gy - 6.4, gy + 6.4):
            p.cyl(0.25, 0.25, zs - gz + 1.1, 'steel', T(x, y, gz - 1.1 + (zs - gz + 1.1) / 2), seg=8)
    e5.glow_line(p, [(-14.5, gy - 6.75), (14.5, gy - 6.75)], zs, closed=False)
    # the tube outside the station
    for x0, x1 in ((-23.4, -14.6), (14.6, 23.4)):
        e5.tube(p, x0, x1, gy, gz + 1.5, 2.6, 'e5_tube', 3.0)
    # the drone-taxi wing
    w = (15.6, -6.0, 22.0, 2.0)
    rbox(p, w[0], w[1], 0.3, w[2], w[3], 5.0, (1.8, 0, 0, 0), d['wall2'])
    kit.on_face(p, w, 'front', 0, 0.8, 4.4, 3.4, 0.07, d['glass'])
    rbox(p, w[0] - 0.2, w[1] - 0.2, 5.0, w[2] + 0.2, w[3], 5.3, (2.0, 0, 0, 0), d['band'])
    e5.drone_pad_raised(p, q, 18.8, -2.0, 5.3, 2.6, 1)
    # the plaza
    e5.solar_pergola(p, (-6.0, -9.0, 6.0, -3.0), 0.0, 3.4)
    for x in (-12.0, 12.0):
        e5.planter(p, q, (x - 3.0, -10.0, x + 3.0, -9.2), 0.0, 0.6, d['band'], int(x), tall=1)
    e5.robot_locker(q, -12.0, -5.0, 0, 3.0, 2.0, 6, 4)
    e5.lawn(b, -22.8, -22.8, -6.0, -12.0)
    e5.lawn(b, 6.0, -22.8, 22.8, -12.0)
    for x in (-8.0, 8.0):
        e5.solar_tree(q, x, -16.0, 5.0, 4, int(x))
        e5.lamp_post(q, x * 0.5, -20.0, 4.5)
    for k in range(4):
        e5.charger(q, -21.0 + k * 1.2, -6.0)
    for k, (x, y) in enumerate(((-21.0, 20.0), (21.0, 20.0), (0.0, 21.0))):
        coconut_or_plant(b, x, y, k)


@building('market', None, 'ตลาดโดมเขียว', 'Green market dome')
def market(b):
    """The market of the future: a big timber-ribbed dome of green glass on a ring of columns, open all round,
    with rings of stalls under it, a ring of solar panels on its shoulders and a lantern; kiosks with solar
    umbrellas, planters and shade trees outside."""
    d = dress(b.region, 2)
    lot(b, d, 8.0)
    p, q = b.main, b.props
    cx, cy, R0, zc = 0.0, 4.0, 17.0, 5.0
    p.cyl(R0 + 0.8, R0 + 0.8, 0.3, d['band'], T(cx, cy, 0.15), seg=40)
    p.cyl(R0 + 0.5, R0 + 0.5, 0.06, 'paving_dark', T(cx, cy, 0.33), seg=40)
    for k in range(20):
        a = math.tau * k / 20
        x, y = cx + math.cos(a) * (R0 - 0.4), cy + math.sin(a) * (R0 - 0.4)
        p.cyl(0.32, 0.25, zc, d['louvre'], T(x, y, zc / 2 + 0.3), seg=8)
    p.torus(R0 - 0.2, 0.3, d['band'], T(cx, cy, zc + 0.3), seg=40, seg_minor=6)
    squash = 0.55
    e5.dome(p, cx, cy, zc + 0.3, R0, 'glass_green', 20, d['louvre'], squash, (0.3, 0.55, 0.78), 40)
    p.cyl(2.6, 2.6, 1.6, 'e5_sky_glass', T(cx, cy, zc + 0.3 + R0 * squash + 0.5), seg=20)
    p.cyl(3.0, 3.0, 0.3, d['band'], T(cx, cy, zc + 0.3 + R0 * squash + 1.4), seg=20)
    # the solar ring on the dome's shoulders
    rr = R0 * 0.8
    zz = zc + 0.3 + R0 * squash * math.sqrt(1 - 0.8 ** 2)
    slope = math.degrees(math.atan(squash * 0.8 / math.sqrt(1 - 0.8 ** 2)))
    for k in range(28):
        a = math.tau * k / 28
        if math.sin(a) > 0.55:
            continue
        p.box((2.4, 1.6, 0.06), 'solar', T(cx + math.cos(a) * rr, cy + math.sin(a) * rr, zz + 0.12)
              @ R(0, 0, math.degrees(a)) @ R(0, slope, 0))
    # stalls in rings under the dome
    for ring, n in ((12.5, 14), (7.5, 9)):
        for k in range(n):
            a = math.tau * (k + 0.5 * (ring < 10)) / n
            x, y = cx + math.cos(a) * ring, cy + math.sin(a) * ring
            props.table_stall(q, x, y, 2.2, 1.0, math.degrees(a) + 90,
                              goods=(('flower_red', 'leaf', 'banana_fruit'), ('rambutan', 'leaf_light', 'durian'),
                                     ('paint_orange', 'leaf_dark', 'flower_yellow'))[k % 3])
    p.cyl(2.2, 2.4, 0.6, 'stone', T(cx, cy, 0.6), seg=20)
    p.cyl(1.9, 1.9, 0.05, 'e5_pool', T(cx, cy, 0.88), seg=20)
    e5.small_tree(q, cx, cy, 0.9, 3.6, 1.4, 5)
    # outside: kiosks with solar umbrellas, planters, trees
    for x in (-12.0, -4.0, 4.0, 12.0):
        props.table_stall(q, x, -17.5, 2.0, 0.9)
        q.cyl(0.04, 0.04, 2.6, 'steel', T(x, -17.0, 1.3), seg=5)
        q.cyl(1.6, 0.2, 0.4, 'solar', T(x, -17.0, 2.7), seg=12)
    for s in (-1, 1):
        e5.planter(p, q, (s * 14.0 - 4.0, -21.6, s * 14.0 + 4.0, -20.8), 0.0, 0.6, d['band'], 15 + s, tall=1)
    e5.robot_locker(q, 19.0, -13.0, 0, 3.0, 2.0, 6, 4)
    e5.delivery_robot(q, 16.0, -15.0, 20)
    for k, (x, y) in enumerate(((-21.0, 21.0), (21.0, 21.0), (-21.0, -12.0), (21.0, 4.0), (-21.0, 4.0))):
        coconut_or_plant(b, x, y, k)
    regions.craft(b, -16.0, -14.0)
