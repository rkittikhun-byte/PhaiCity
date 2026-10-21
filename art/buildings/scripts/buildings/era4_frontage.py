# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 4's frontage variants (PLAN.md "Frontage"): the modern city's shop building (อาคารพาณิชย์) one bay wide, 4 m:
a glass shop front with its shutter box and a plain sign (no brands), upper floors on a concrete frame with deep
window boxes, timber louvres and a glass-railed balcony, party walls standing proud of the front between the bays, a
flat roof with a tank, solar panels and AC units, and on some bays a stair head under the region's small roof; three
storeys in the lower row, four in the taller. The south's ground floor is an arcade of arches in pastel plaster. And
a modern house on a 12 m plot. Dressed by lib/era4_parts.DRESS. True sizes: shop floor 4.2 m, floors 3.4 m."""

from lib import era4_parts as e4
from lib import frontage_parts as fp
from lib import kit, props, regions
from lib.builder import BAY_M, registry
from lib.mesh import T

BUILDINGS, building = registry(4)

FRONT = -5.6      # the shop front: a forecourt in front of it to the plot's edge (-8)
DEPTH = 12.0      # ... its back wall at 6.4
GROUND_H = 4.2
FH = 3.4
INDEX = {'one': 0, 'left': 1, 'mid': 2, 'mid2': 3, 'right': 4}
SIGNS = ('sign_blue', 'sign_red', 'sign_green', 'sign_cream', 'sign_blue')


def path_mat(b):
    return 'laterite' if b.region == 'northeast' else 'paving_dark'


def bay(b, floors):
    """One modern shop building of the row (floors above the shop floor)."""
    r = b.region
    p, q = b.main, b.props
    place = fp.place_of(b)
    left, right = fp.ends_of(b)
    i = INDEX[place]
    d = e4.dress(r, i)
    x0, x1 = -BAY_M / 2, BAY_M / 2
    rect = (x0, FRONT, x1, FRONT + DEPTH)
    b.ground('paving')
    fp.sidewalk(b, FRONT, 'paving_dark', 'e4_white', z=0.08)
    kit.block(p, x0, FRONT - 0.1, 0, x1, FRONT + DEPTH, 0.2, 'e4_white')
    zt = GROUND_H + floors * FH
    kit.block(p, x0, FRONT, 0.2, x1, FRONT + DEPTH, zt, d['wall'])
    # the shop floor
    if r == 'south':
        e4.arches(p, rect, 'front', 0.2, (0.0,), 2.6, 2.6, glass='e4_glass')
        e4.sign_plate(p, rect, 'front', 0, 3.55, 3.0, 0.5, mat=SIGNS[i])
    else:
        kit.shopfront(p, rect, 'front', 0, 0.2, BAY_M - 0.7, 3.0, frame='e4_alu', glass='e4_glass', door_w=1.4)
        kit.on_face(p, rect, 'front', 0, 3.25, BAY_M - 0.5, 0.3, 0.25, 'concrete_dark')
        e4.sign_plate(p, rect, 'front', 0, 3.6, BAY_M - 0.8, 0.5, mat=SIGNS[i])
        if place in ('left', 'mid2', 'one'):
            props.awning(q, rect, 'front', 0, 3.45, BAY_M - 0.7, 1.1, 0.4, stripes=regions.awning_colours(r))
    # the floors above
    for k in range(floors):
        z = GROUND_H + k * FH
        kit.bands(p, rect, z - 0.12, 0.24, 0.06, 'e4_white')
        if k == 0 and place in ('mid2', 'one', 'right'):
            kit.door(p, rect, 'front', -0.5, z, 1.6, 2.3, leaf='e4_glass', frame='e4_alu', panels=False)
            e4.balcony(p, rect, 'front', -0.3, z, 2.8, 0.9)
            e4.fins(p, rect, 'front', 1.35, z + 0.2, 0.7, 2.6, d['louvre'], step=0.24, depth=0.18)
        elif (k + i) % 2 == 0:
            e4.window_box(p, rect, 'front', -0.35, z + 0.8, 2.3, 1.8, d['trim'])
            e4.fins(p, rect, 'front', 1.4, z + 0.2, 0.6, 2.8, d['louvre'], step=0.22, depth=0.18)
        else:
            kit.window(p, rect, 'front', 0, z + 0.9, 2.8, 1.6, frame='e4_alu', glass='e4_glass')
            e4.louvre_screen(p, rect, 'front', 0, z + 0.4, 3.0, 0.4, d['louvre'])
        if k % 2 == 1:
            e4.ac_unit(q, -1.3, FRONT - 0.2, z + 0.05, 0)
        # end walls: windows and an AC unit
        for side, end in (('left', left), ('right', right)):
            if end:
                for u in (-2.4, 2.6):
                    kit.window(p, rect, side, u, z + 0.9, 1.3, 1.5, frame='e4_alu', glass='e4_glass')
        kit.window(p, rect, 'back', 0, z + 0.9, 1.6, 1.4, frame='e4_alu', glass='e4_glass')
    for side, end in (('left', left), ('right', right)):
        if end:
            kit.window(p, rect, side, 2.0 if side == 'left' else -2.0, 1.0, 2.2, 1.6, frame='e4_alu', glass='e4_glass')
            e4.ac_unit(q, (x0 - 0.2) if side == 'left' else (x1 + 0.2), FRONT + 8.5, 0.5, -90 if side == 'left' else 90)
    kit.door(p, rect, 'back', 0.8, 0.2, 0.9, 2.1, leaf='e4_alu', frame='e4_alu', panels=False)
    # the roof: parapet, tank, panels, AC; a stair head under the region's roof on some bays
    zr = e4.flat_roof(p, rect, zt, 'concrete_light', parapet=0.9, parapet_mat=d['wall'], coping='e4_white')
    fp.light_tank(q, x1 - 0.9, FRONT + DEPTH - 1.0, zt + 0.25, 'stainless' if i % 2 else 'tank_blue', stand=0.6)
    props.solar_panels(q, -0.4, FRONT + 3.0, zt + 0.25, cols=3, rows=1, tilt=12)
    e4.ac_unit(q, -1.2, FRONT + DEPTH - 1.4, zt + 0.25, 180)
    if place in ('mid2', 'one'):
        sh = (x0 + 0.5, FRONT + 5.2, x1 - 0.5, FRONT + 8.0)
        kit.block(p, sh[0], sh[1], zt, sh[2], sh[3], zt + 2.6, d['wall2'])
        kit.door(p, sh, 'front', 0, zt, 0.9, 2.1, leaf='e4_alu', frame='e4_alu')
        regions.small_roof(p, sh, zt + 2.6, r, mat=d['roof'], axis='y', over=0.35)
    # the party walls standing proud of the front, half in each bay; a whole pier where the row ends
    for side, end, x, s in (('left', left, x0, 1), ('right', right, x1, -1)):
        w = 0.3 if end else 0.15
        xa, xb = (x, x + w) if s > 0 else (x - w, x)
        kit.block(p, xa, FRONT - 0.45, 0.0, xb, FRONT + 0.3, zr + 0.25, d['accent'])
    # the forecourt
    if place == 'mid':
        e4.planter(b, -1.6, -7.6, 1.6, -6.9, seed=7, bushes=True)
    elif place in ('left', 'one'):
        props.street_lamp(q, x0 + 0.5, -7.5, 5.5)
        props.potted(q, 1.2, FRONT - 0.6, 0, 0.6, 'leafy', i)
    elif place == 'right':
        props.bollard_light(q, 1.4, -7.3)
        props.potted(q, -1.2, FRONT - 0.6, 0, 0.55, 'palm', i)
    else:
        props.potted(q, -1.3, FRONT - 0.6, 0, 0.6, 'leafy', i)
        props.bench(q, 0.8, -7.2, 1.4)


def house(b, big):
    """A modern house on a 12 m plot: two floors (three on the bigger one) with big framed windows and timber
    louvres, the region's gable over one part and a flat roof with solar and a tank over the other (a roof terrace
    under a stair head on the bigger one), a steel carport, a lawn, a low wall on the road and a spirit house."""
    r = b.region
    d = e4.dress(r, 1 if big else 0)
    p, q = b.main, b.props
    b.ground('paving')
    e4.lawn(b, -5.95, -7.95, 0.0, -2.4)
    floors = 3 if big else 2
    g = (-5.2, -1.6, 1.4, 5.6)
    x0, y0, x1, y1 = g
    kit.block(p, x0 - 0.1, y0 - 0.1, 0, x1 + 0.1, y1 + 0.1, 0.3, d['base'])
    zt = 0.3 + floors * 3.1
    kit.block(p, x0, y0, 0.3, x1, y1, zt, d['wall'])
    for k in range(1, floors):
        kit.bands(p, g, 0.3 + k * 3.1 - 0.12, 0.26, 0.06, d['accent'])
    e4.window_box(p, g, 'front', 1.2, 0.7, 2.6, 2.1, d['trim'])
    kit.door(p, g, 'front', -1.8, 0.3, 1.0, 2.2, leaf='teak', frame='e4_alu')
    e4.canopy(p, x0 + 0.6, y0 - 1.0, x0 + 2.8, y0, 2.75, posts=False)
    for k in range(1, floors):
        z = 0.3 + k * 3.1
        if k == 1:
            e4.balcony(p, g, 'front', -1.4, z, 2.6, 1.0)
            kit.door(p, g, 'front', -1.4, z, 1.6, 2.3, leaf='e4_glass', frame='e4_alu', panels=False)
            e4.window_box(p, g, 'front', 1.8, z + 0.8, 1.8, 1.6, d['trim'])
        else:
            e4.fins(p, g, 'front', -1.0, z + 0.1, 3.0, 2.8, d['louvre'], step=0.3, depth=0.2)
            e4.window_box(p, g, 'front', 2.0, z + 0.8, 1.6, 1.6, d['trim'])
        for side in ('left', 'right'):
            kit.window(p, g, side, 0.8, z + 0.9, 1.4, 1.4, frame='e4_alu', glass='e4_glass')
        kit.window(p, g, 'back', 0, z + 0.9, 1.8, 1.4, frame='e4_alu', glass='e4_glass')
    kit.window(p, g, 'left', -1.0, 1.0, 1.6, 1.4, frame='e4_alu', glass='e4_glass')
    # the roofs: the region's gable over the back half, a flat roof with solar over the front
    front, back = (x0, y0, x1, y0 + 3.4), (x0, y0 + 3.4, x1, y1)
    e4.flat_roof(p, front, zt, 'concrete_light', parapet=0.6 if not big else 1.0, parapet_mat=d['wall'],
                 coping=d['accent'])
    regions.house_roof(p, back, zt, r, mat=d['roof'], axis='x', over=0.6, over_ends=0.5)
    if big:
        sh = (x1 - 2.6, y0 + 0.4, x1 - 0.4, y0 + 3.0)
        kit.block(p, sh[0], sh[1], zt + 0.25, sh[2], sh[3], zt + 2.7, d['wall2'])
        regions.small_roof(p, sh, zt + 2.7, r, mat=d['roof'], axis='y', over=0.3)
        props.potted(q, x0 + 1.0, y0 + 1.0, zt + 0.25, 0.7, 'palm', 3)
        e4.ac_unit(q, x0 + 2.6, y0 + 2.4, zt + 0.25, 0)
    else:
        props.solar_panels(q, x0 + 2.6, y0 + 1.7, zt + 0.25, cols=4, rows=1, tilt=12)
    fp.light_tank(q, x0 + 0.9, y1 - 0.9, 0.0, 'stainless', stand=1.6)
    e4.ac_unit(q, x1 + 0.2, 2.6, 0.5, 90)
    # the carport and the drive, the walk to the door, the yard
    e4.carport(p, (1.9, -6.4, 5.7, -0.8), 2.7)
    b.path(1.9, -7.95, 5.7, -0.8, 'paving_dark')
    b.path(-4.4, -7.95, -3.4, y0 - 0.2, path_mat(b))
    e4.planter(b, -2.8, -7.4, -0.4, -6.6, seed=11, flowers='flower_red')
    e4.lawn(b, -5.95, y1 + 0.4, 5.95, 7.95)
    props.spirit_house(q, -5.1, -4.0, facing=0)
    regions.plant(b, 4.6, 5.8, 0)
    regions.plant(b, -0.4, -3.4, 2, big=False)
    regions.craft(b, 3.4, 2.6)
    for a, c in ((-5.95, -4.9), (-2.9, 1.9)):
        props.fence(q, [(a, -7.7), (c, -7.7)], 1.1, d['wall2'], post_mat=d['accent'], kind='wall')


@building('bay1_one', 1, 'อาคารพาณิชย์สามชั้นคูหาเดียว', 'Single three-storey shop building')
def bay1_one(b):
    bay(b, 2)


@building('bay1_left', 1, 'อาคารพาณิชย์สามชั้นห้องหัว (ซ้าย)', 'Three-storey shop building, left end')
def bay1_left(b):
    bay(b, 2)


@building('bay1_mid', 1, 'อาคารพาณิชย์สามชั้นห้องกลาง', 'Three-storey shop building, middle')
def bay1_mid(b):
    bay(b, 2)


@building('bay1_mid2', 1, 'อาคารพาณิชย์สามชั้นห้องกลาง (แบบ 2)', 'Three-storey shop building, middle (2)')
def bay1_mid2(b):
    bay(b, 2)


@building('bay1_right', 1, 'อาคารพาณิชย์สามชั้นห้องท้าย (ขวา)', 'Three-storey shop building, right end')
def bay1_right(b):
    bay(b, 2)


@building('bay2_one', 2, 'อาคารพาณิชย์สี่ชั้นคูหาเดียว', 'Single four-storey shop building')
def bay2_one(b):
    bay(b, 3)


@building('bay2_left', 2, 'อาคารพาณิชย์สี่ชั้นห้องหัว (ซ้าย)', 'Four-storey shop building, left end')
def bay2_left(b):
    bay(b, 3)


@building('bay2_mid', 2, 'อาคารพาณิชย์สี่ชั้นห้องกลาง', 'Four-storey shop building, middle')
def bay2_mid(b):
    bay(b, 3)


@building('bay2_mid2', 2, 'อาคารพาณิชย์สี่ชั้นห้องกลาง (แบบ 2)', 'Four-storey shop building, middle (2)')
def bay2_mid2(b):
    bay(b, 3)


@building('bay2_right', 2, 'อาคารพาณิชย์สี่ชั้นห้องท้าย (ขวา)', 'Four-storey shop building, right end')
def bay2_right(b):
    bay(b, 3)


@building('house12_1', 1, 'บ้านเดี่ยวสมัยใหม่ หน้ากว้าง 12 ม.', 'Modern house, 12 m plot')
def house12_1(b):
    house(b, False)


@building('house12_2', 2, 'บ้านสามชั้นสมัยใหม่ หน้ากว้าง 12 ม.', 'Three-storey modern house, 12 m plot')
def house12_2(b):
    house(b, True)
