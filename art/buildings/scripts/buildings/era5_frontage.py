# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 5's frontage variants (PLAN.md "Frontage"): the future city's green shophouse one bay wide, 4 m, as the era's
green townhouse terrace has them: a glass shop floor, planted balconies stepping back, timber fins, the top floor set
back under its own solar gable in the region's way (a hip in the south; never a spire or a temple ornament), party fins
between the bays, a living wall and windows on a terrace's end walls; three storeys in the lower row, four in the
taller with a roof garden. And an eco house on a 12 m plot. Dressed by lib/era5_parts.DRESS. True sizes."""

from lib import era5_parts as e5
from lib import frontage_parts as fp
from lib import kit, props, regions
from lib.builder import BAY_M, registry
from lib.era5_parts import dress, rbox
from lib.mesh import T

BUILDINGS, building = registry(5)

FRONT = -5.2      # the shop front: a forecourt in front of it to the plot's edge (-8)
DEPTH = 11.6      # ... the back wall at 6.4
ZF, H = 0.3, 3.4
INDEX = {'one': 0, 'left': 1, 'mid': 2, 'mid2': 3, 'right': 4}
SIGNS = ('sign_green', 'sign_cream', 'sign_blue', 'sign_green', 'sign_cream')


def bay(b, floors):
    """One green shophouse: floors is how many stand under the set-back top floor (2 or 3)."""
    r = b.region
    p, q = b.main, b.props
    place = fp.place_of(b)
    left, right = fp.ends_of(b)
    i = INDEX[place]
    d = dress(r, i)
    x0, x1 = -BAY_M / 2, BAY_M / 2
    y0, y1 = FRONT, FRONT + DEPTH
    g = (x0, y0, x1, y1)
    top = (x0, y0 + 1.8, x1, y1)
    wall = d['wall'] if i % 2 == 0 else d['wall2']
    b.ground('paving')
    fp.sidewalk(b, y0, d['path'], 'concrete_light', z=0.07)
    kit.block(p, x0, y0 - 0.3, 0, x1, y1, ZF, d['band'])
    zl = ZF + floors * H
    kit.block(p, x0 + 0.02, y0, ZF, x1 - 0.02, y1, zl, wall)
    kit.block(p, top[0] + 0.02, top[1], zl, top[2] - 0.02, top[3], zl + H, wall)
    # the shop floor: a glass front, its door and a plain sign (no brand)
    e5.glass_door(p, g, 'front', -0.9, ZF, d, 1.3, 2.5)
    e5.window(p, g, 'front', 0.95, ZF + 0.5, 1.6, 2.2, d, transom=False)
    props.sign_board(q, g, 'front', 0, ZF + 2.75, BAY_M - 1.0, 0.42, SIGNS[i], 'sign_text', out=0.9)
    # the floors over it: a planted balcony on the first, windows and fins above
    for k in range(1, floors):
        z = ZF + k * H
        kit.bands(p, g, z - 0.1, 0.2, 0.08, d['band'])
        if k == 1:
            rbox(p, x0 + 0.3, y0 - 1.0, z - 0.25, x1 - 0.3, y0 + 0.05, z, (0.5, 0, 0, 0.5), d['band'])
            e5.planter(p, q, (x0 + 0.5, y0 - 0.95, x1 - 0.5, y0 - 0.45), z, 0.5, d['band'], i * 3 + k)
            e5.window(p, g, 'front', -0.3, z + 0.15, 2.4, 2.4, d, transom=False)
            e5.louvres(p, g, 'front', z + 0.1, z + H, 1.2, 1.8, 0.22, 0.25, 0.07, d['louvre'])
        else:
            e5.window(p, g, 'front', 0.5, z + 0.5, 2.2, 2.0, d)
            e5.louvres(p, g, 'front', z, z + H, -1.8, -0.9, 0.25, 0.25, 0.07, d['louvre'])
        e5.window(p, g, 'back', 0, z + 0.8, 1.8, 1.6, d)
    # the top floor's front terrace and its solar gable to the road
    rbox(p, x0 + 0.05, y0 - 0.2, zl - 0.05, x1 - 0.05, top[1] + 0.05, zl + 0.2, 0.0, d['band'])
    e5.planter(p, q, (x0 + 0.3, y0 - 0.1, x1 - 0.3, y0 + 0.4), zl + 0.2, 0.5, d['band'], i * 3 + 7,
               tall=1 if place in ('mid2', 'one') else 0)
    e5.window(p, top, 'front', 0.5, zl + 0.4, 2.2, 2.2, d, transom=False)
    e5.louvres(p, top, 'front', zl + 0.2, zl + H, -1.8, -0.9, 0.25, 0.25, 0.07, d['louvre'])
    kit.bands(p, top, zl + H - 0.05, 0.25, 0.1, d['band'])
    if floors >= 3 and place in ('mid', 'one', 'right'):
        # the taller row's roof garden behind a short gable
        back = (top[0], top[1] + 5.0, top[2], top[3])
        front_g = (top[0], top[1], top[2], top[1] + 5.0)
        e5.solar_roof(p, front_g, zl + H + 0.2, d, axis='y', pitch=0.62, over=0.3, over_ends=0.45)
        kit.block(p, back[0], back[1], zl + H, back[2], back[3], zl + H + 0.2, d['band'])
        e5.planter(p, q, (back[0] + 0.3, back[3] - 1.2, back[2] - 0.3, back[3] - 0.3), zl + H + 0.2, 0.5, d['band'],
                   i + 11, tall=1)
        kit.railing(p, [(back[0] + 0.1, back[1] + 0.2), (back[0] + 0.1, back[3] - 0.1)], zl + H + 0.2, 'steel', h=1.0,
                    spacing=0.5)
    else:
        e5.solar_roof(p, top, zl + H + 0.2, d, axis='y', pitch=0.62, over=0.3, over_ends=0.45)
    # the party fins between the bays (half in each), whole at a terrace's ends; the end walls' windows and green
    zt = zl + H
    for end, x, s in ((left, x0, 1), (right, x1, -1)):
        if end:
            rbox(p, x - 0.18, y0 - 1.1, ZF, x + 0.18, y0 + 0.4, zl + 0.2, 0.15, d['band'])
        else:
            xa, xb = (x, x + 0.18) if s > 0 else (x - 0.18, x)
            kit.block(p, xa, y0 - 1.1, ZF, xb, y0 + 0.4, zl + 0.2, d['band'])
    for side, end in (('left', left), ('right', right)):
        if not end:
            continue
        sgn = 1 if side == 'left' else -1
        for k in range(floors):
            e5.window(p, g, side, 2.6 * sgn, ZF + k * H + 0.8, 1.5, 1.6, d)
        e5.window(p, top, side, 1.2 * sgn, zl + 0.7, 1.4, 1.5, d)
        e5.green_wall(p, g, side, -2.2 * sgn, ZF + 0.4, 2.6, floors * H - 0.7, i)
    # the forecourt and the yard behind
    if place == 'one':
        e5.robot_locker(q, 0.6, -7.1, 0, 1.6, 1.8, 3, 4)
        e5.bollards(q, [(-1.5, -7.2)])
    elif place == 'left':
        e5.bamboo_pot(q, -1.2, y0 - 1.6, 0.0, 3.0, i)
        e5.bench(q, 0.9, -7.2, 1.6)
    elif place == 'mid':
        props.potted(q, 1.2, y0 - 1.5, 0.0, 0.7, 'palm', i)
        e5.bollards(q, [(-1.4, -7.3)])
    elif place == 'mid2':
        e5.delivery_robot(q, 0.4, -6.8, 20)
        props.potted(q, -1.3, y0 - 1.5, 0.0, 0.6, 'leafy', i)
    else:
        e5.bench(q, -0.8, -7.2, 1.6)
        props.potted(q, 1.3, y0 - 1.5, 0.0, 0.6, 'leafy', i + 3)
    e5.lawn(b, x0, y1 + 0.3, x1, 7.95)
    if place in ('one', 'mid2', 'right'):
        e5.small_tree(q, 0.6 if place != 'right' else -0.6, y1 + 0.9, 0.0, 3.4, 1.0, i)
    return zt


def house(b, big):
    """An eco house on a 12 m plot: rounded floors in the region's colours with bands, timber fins, a curved
    balcony with a pot plant, a solar gable to the road (and a roof garden over a third floor on the bigger one),
    bamboo, a rain garden, bollard lights and a solar pergola over the drive."""
    r = b.region
    d = dress(r, 1 if big else 0)
    p, q = b.main, b.props
    b.ground('paving')
    rect = (-5.2, -1.6, 1.6, 5.4)
    x0, y0, x1, y1 = rect
    floors = 3 if big else 2
    rbox(p, x0 - 0.4, y0 - 0.4, 0.0, x1 + 0.4, y1 + 0.4, ZF, (0.3, 0.3, 0.3, 1.6), d['band'])
    rbox(p, x0, y0, ZF, x1, y1, ZF + 3.2, (0, 0, 0, 1.3), d['wall'])
    for k in range(1, floors):
        z = ZF + k * 3.2
        rbox(p, x0 - 0.12, y0 - 0.12, z - 0.05, x1 + 0.12, y1 + 0.12, z + 0.22, (0.1, 0.1, 0.1, 1.42), d['band'])
        part = (x0, y0 + (0.0 if k == 1 else 1.6), x1 - (0.0 if k == 1 else 2.4), y1)
        kit.block(p, part[0], part[1], z + 0.22, part[2], part[3], z + 3.2, d['wall'] if k % 2 else d['wall2'])
        e5.window(p, part, 'front', 0.8, z + 0.7, 2.0, 1.6, d)
        e5.louvres(p, part, 'front', z + 0.2, z + 3.2, -2.4, -1.0, 0.3, 0.25, 0.07, d['louvre'])
        e5.window(p, part, 'left', 0.0, z + 0.8, 1.6, 1.5, d)
        e5.window(p, part, 'back', 0.0, z + 0.8, 1.8, 1.5, d)
    zt = ZF + floors * 3.2
    e5.glass_door(p, rect, 'front', -1.0, ZF, d, 1.6, 2.4)
    e5.window(p, rect, 'front', 2.0, ZF + 0.7, 2.2, 1.8, d)
    e5.window(p, rect, 'left', -0.6, ZF + 0.7, 2.0, 1.8, d)
    e5.window(p, rect, 'right', 1.2, ZF + 0.8, 1.6, 1.6, d)
    top_part = (x0, y0 + (0.0 if floors == 2 else 1.6), x1 - (0.0 if floors == 2 else 2.4), y1)
    kit.bands(p, top_part, zt - 0.05, 0.25, 0.12, d['band'])
    e5.solar_roof(p, top_part, zt + 0.2, d, axis='y', pitch=0.6, over=0.5, over_ends=0.6)
    if big:
        # the step back on the third floor: a roof garden with a small tree and a glass rail
        g = (x1 - 2.4, y0 + 1.6, x1, y1)
        kit.block(p, g[0], g[1], ZF + 2 * 3.2 + 0.2, g[2], g[3], ZF + 2 * 3.2 + 0.32, d['band'])
        e5.planter(p, q, (g[0] + 0.2, g[1] + 0.3, g[2] - 0.2, g[1] + 1.0), ZF + 2 * 3.2 + 0.32, 0.5, d['band'], 3, tall=1)
        e5.glass_rail(p, [(g[2] - 0.05, g[1]), (g[2] - 0.05, g[3])], ZF + 2 * 3.2 + 0.32, closed=False, frame=d['louvre'])
    props.potted(q, x0 + 1.4, y0 - 0.6, ZF + 3.2 + 0.2, 0.6, 'leafy', 3)
    # the yard
    e5.solar_pergola(p, (2.4, -6.4, 5.6, -1.0), 0.0, 2.6)
    b.path(2.4, -7.95, 5.6, -1.0, d['path'])
    b.path(-1.7, -7.95, -0.3, y0 - 0.5, d['path'])
    e5.lawn(b, -5.95, -7.95, -2.0, y0 - 0.6)
    e5.lawn(b, -5.95, y1 + 0.6, 5.95, 7.95)
    e5.rain_garden(b.yard, q, -5.6, -7.4, -2.4, -4.6, 2 if big else 1)
    e5.bollards(q, [(-2.0, -7.0), (-2.0, -4.0), (0.0, -6.0)])
    e5.bamboo_pot(q, -4.4, y0 - 1.2, 0.0, 3.0, 1)
    e5.mower_robot(q, 3.6, 6.4, 30)
    regions.plant(b, 4.6, 4.0, 0)
    e5.small_tree(q, -4.6, 6.6, 0.0, 4.2, 1.6, 3)
    regions.craft(b, 0.4, 6.6)


@building('bay1_one', 1, 'ตึกแถวเขียวคูหาเดียว', 'Single green shophouse')
def bay1_one(b):
    bay(b, 2)


@building('bay1_left', 1, 'ตึกแถวเขียวห้องหัว (ซ้าย)', 'Green shophouse, left end of a row')
def bay1_left(b):
    bay(b, 2)


@building('bay1_mid', 1, 'ตึกแถวเขียวห้องกลาง', 'Green shophouse, middle of a row')
def bay1_mid(b):
    bay(b, 2)


@building('bay1_mid2', 1, 'ตึกแถวเขียวห้องกลาง (แบบ 2)', 'Green shophouse, middle of a row (2)')
def bay1_mid2(b):
    bay(b, 2)


@building('bay1_right', 1, 'ตึกแถวเขียวห้องท้าย (ขวา)', 'Green shophouse, right end of a row')
def bay1_right(b):
    bay(b, 2)


@building('bay2_one', 2, 'ตึกแถวเขียวสี่ชั้นคูหาเดียว', 'Single four-storey green shophouse')
def bay2_one(b):
    bay(b, 3)


@building('bay2_left', 2, 'ตึกแถวเขียวสี่ชั้นห้องหัว (ซ้าย)', 'Four-storey green shophouse, left end')
def bay2_left(b):
    bay(b, 3)


@building('bay2_mid', 2, 'ตึกแถวเขียวสี่ชั้นห้องกลาง', 'Four-storey green shophouse, middle')
def bay2_mid(b):
    bay(b, 3)


@building('bay2_mid2', 2, 'ตึกแถวเขียวสี่ชั้นห้องกลาง (แบบ 2)', 'Four-storey green shophouse, middle (2)')
def bay2_mid2(b):
    bay(b, 3)


@building('bay2_right', 2, 'ตึกแถวเขียวสี่ชั้นห้องท้าย (ขวา)', 'Four-storey green shophouse, right end')
def bay2_right(b):
    bay(b, 3)


@building('house12_1', 1, 'บ้านอีโค่ หน้ากว้าง 12 ม.', 'Eco house, 12 m plot')
def house12_1(b):
    house(b, False)


@building('house12_2', 2, 'บ้านอีโค่สามชั้น หน้ากว้าง 12 ม.', 'Three-storey eco house, 12 m plot')
def house12_2(b):
    house(b, True)
