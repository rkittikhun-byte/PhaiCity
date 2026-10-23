# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The department stores (ห้างสรรพสินค้า, PLAN.md "Department stores"): one store in each era from the market town
on, dressed by region, each a 3x3 (47 x 47 m inside its 48 m square) with its forecourt, parking and loading yard,
the square's edge marked by a kerb, a wall or a hedge so the ground it takes reads as the store's.

    era 2  a market-hall store of the 1950s market town: a long two-storey hall of plastered brick below and timber
           above over an arcade of shuttered fronts, a three-storey tower in the middle with the big sign board and
           a clock, a zinc-roofed godown behind, awnings, bicycles, samlors and carts in the forecourt
    era 3  a mid-century concrete store (1960s-80s provincial): five storeys of horizontal sun-shade fins, a
           breeze-block screen, a tall lit sign reading downward, a canopy over the glass doors, water tanks and AC
           units on the roof, a car and motorbike park and a loading dock with a lorry
    era 4  a shopping mall: three tall floors of panels and glass with screens, a glass atrium under the region's
           roof, a multi-storey car park beside it with cars on its roof, solar and chillers, a drop-off canopy,
           planted islands
    era 5  a green mall: rounded floors stepping back into planted terraces, timber louvres, a vaulted skylight and
           the region's roof pavilion, a roof garden, solar canopies over the charging bays, a drone pad, rain gardens

Signs carry made-up names in real Thai lettering (lib/store_parts.py), never a brand or logo; no royal symbols, no
Buddha images, no ช่อฟ้า, ใบระกา or หางหงส์ (the region's roofs are plain house roofs). True sizes (PLAN.md).
"""

from lib import era2_parts as e2
from lib import era3_parts as e3
from lib import era4_parts as e4
from lib import era5_parts as e5
from lib import kit, props, regions
from lib import props_region as pr
from lib import props_work as pw
from lib import store_parts as sp
from lib.builder import registry
from lib.mesh import R, T

E = 23.5          # the square's half size the store may fill
WALL_E = 23.3     # the centre line of a wall round the square (its coping reaches E)

NAMES = {
    2: ('ห้างสรรพสินค้าตึกไม้', 'Market-hall department store'),
    3: ('ห้างสรรพสินค้า', 'Department store'),
    4: ('ศูนย์การค้า', 'Shopping mall'),
    5: ('ศูนย์การค้าสีเขียว', 'Green mall'),
}


class InMain:
    """b seen by an era library's wall helper (which draws into .props) so the wall goes into the building part: the
    square's edge is the store's outline and must survive the export's thinning of the props."""

    def __init__(self, b):
        self.main = self.props = b.main
        self.yard = b.yard
        self.region = b.region
        self.era = b.era


def parts_report(b):
    def tris(part):
        return sum(len(f.verts) - 2 for f in part.bm.faces)
    print('PARTS   era%d_%s_store main %d props %d yard %d signs %d' % (b.era, b.region, tris(b.main), tris(b.props),
                                                                       tris(b.yard), tris(b.signs)))


# era 2: the market town ----------------------------------------------------------------------------------------------

def gate_pillars(b, x, y, h=2.2):
    """A plastered gate pillar with a cap and a lamp on top."""
    kit.block(b.main, x - 0.35, y - 0.35, 0, x + 0.35, y + 0.35, h, 'e2_moulding', bevel=0.03)
    kit.block(b.main, x - 0.45, y - 0.45, h, x + 0.45, y + 0.45, h + 0.2, 'plaster', bevel=0.03)
    b.props.cyl(0.14, 0.14, 0.4, 'lamp', T(x, y, h + 0.4), seg=8)
    b.props.cyl(0.2, 0.05, 0.15, 'iron', T(x, y, h + 0.66), seg=8)


def clock(p, x, y, z, r=0.65):
    """A round clock on a gable (white face, dark hands and rim)."""
    p.cyl(r + 0.08, r + 0.08, 0.1, 'teak_dark', T(x, y, z) @ R(90, 0, 0), seg=16)
    p.cyl(r, r, 0.14, 'paint_white', T(x, y, z) @ R(90, 0, 0), seg=16)
    p.box((0.06, 0.04, r * 0.7), 'black', T(x, y - 0.09, z + r * 0.3))
    p.box((r * 0.55, 0.04, 0.06), 'black', T(x + r * 0.25, y - 0.09, z))


def store_era2(b):
    """The market-hall department store of the 1950s market town."""
    r = b.region
    st = regions.style(r)
    trim = st['trim']
    south = r == 'south'
    p, q = b.main, b.props
    nm = sp.name(r)
    b.ground(regions.ground_mat(r, 2))
    wall = regions.plaster(r, 1)
    shutter = e2.SHUTTER.get(r, st['shutter'])
    GH, UH = 4.5, 4.0
    zE = GH + UH
    U = (-18.0, -4.0, 18.0, 6.0)
    G = (-17.6, -1.6, 17.6, 6.0)
    T_ = (-4.5, -5.0, 4.5, 4.0)
    zT = 13.0
    # the forecourt and the side lane
    b.path(-17.0, -23.95, 17.0, -4.4, 'paving' if r != 'northeast' else 'dirt_dark', z=0.06)
    b.path(18.6, -23.95, 22.9, 22.9, 'gravel', z=0.05)
    b.path(-18.4, -4.6, 18.4, 6.4, 'paving_dark', z=0.07)
    # the arcade's floor, the shops' walls behind it
    kit.block(p, U[0] - 0.2, U[1] - 0.4, 0, U[2] + 0.2, U[3] + 0.2, 0.25, 'stone' if not south else 'paving_dark')
    e2.plaster_walls(p, G, 0.25, GH, wall, trim='brick')
    # arcade posts (and the south's arches)
    xs = [-17.7, -14.0, -10.0, -6.0, -2.0, 2.0, 6.0, 10.0, 14.0, 17.7]
    for x in xs:
        if abs(x) == 2.0:
            continue
        kit.block(p, x - 0.25, -4.0, 0.25, x + 0.25, -3.5, GH, 'e2_moulding')
        kit.block(p, x - 0.32, -4.07, GH - 0.45, x + 0.32, -3.43, GH - 0.3, wall)
    for x in (-4.3, 4.3):
        kit.block(p, x - 0.25, -5.0, 0.25, x + 0.25, -4.5, GH, 'e2_moulding')
    if south:
        for x0, x1 in zip(xs, xs[1:]):
            if x0 >= -4.5 and x1 <= 4.5:
                continue
            hw = (x1 - x0) / 2 - 0.3
            e2.arch(p, (x0 + x1) / 2, -4.0, -3.6, GH - 0.3 - hw, hw, GH, wall, seg=6)
    # the shop fronts: folding plank doors with fretwork transoms, the glazed main doors in the middle
    for k, x in enumerate((-15.9, -12.0, -8.0, -4.0, 4.0, 8.0, 12.0, 15.9)):
        w = 3.0 if abs(x) > 15 else 3.2
        kit.folding_doors(p, G, 'front', x, 0.25, w, 3.0, leaf=shutter, frame=trim, open_=(0.45, 0.7, 0.55)[k % 3])
        kit.on_face(p, G, 'front', x, 3.35, w, 0.45, 0.06, 'fretwork')
    kit.door(p, G, 'front', 0.0, 0.25, 2.6, 3.0, leaf='glass', frame=trim)
    kit.on_face(p, G, 'front', 0.0, 3.4, 2.8, 0.5, 0.06, 'fretwork')
    for side in ('left', 'right'):
        kit.folding_doors(p, G, side, 0.0, 0.25, 3.0, 3.0, leaf=shutter, frame=trim, open_=0.6)
        kit.window(p, G, side, -4.2 if side == 'left' else 4.2, 1.3, 1.0, 1.3, frame=trim, glass='window_dark',
                   bars=3, shutters=shutter)
        props.awning(p, G, side, 0.0, GH - 0.3, 3.4, 1.4, 0.5, stripes=e2.awning_stripes(r))
    # the upper floor over the arcade
    if south:
        e2.plaster_walls(p, U, GH, zE, regions.plaster(r, 0), skirting=False, pilasters=True)
    else:
        e2.timber_walls(p, U, GH, zE, r)
    kit.bands(p, U, GH - 0.12, 0.26, 0.07, trim if not south else 'e2_moulding')
    for u in kit.spread(36.0, 16, 0.6):
        if abs(u) < 5.2:
            continue
        if south:
            e2.arched_window(p, U, 'front', u, GH + 0.9, 0.9, 1.6, frame=trim, shutter='shutter_green')
        else:
            e2.house_window(p, U, 'front', u, GH + 1.0, r, 0.9, 1.4)
    for side in ('left', 'right', 'back'):
        n = 4 if side != 'back' else 10
        for u in kit.spread(kit.face_width(U, side), n, 1.0):
            if side == 'back' and u > -6.0:
                continue
            if south:
                e2.arched_window(p, U, side, u, GH + 0.9, 0.9, 1.5, frame=trim, shutter='shutter_green')
            else:
                e2.house_window(p, U, side, u, GH + 1.0, r, 0.9, 1.3)
    for k, x in enumerate((-15.9, -12.0, 12.0, 15.9)):
        props.awning(p, U, 'front', x, GH - 0.35, 3.4, 1.5, 0.55, stripes=e2.awning_stripes(r))
        props.sign_board(q, U, 'front', x, GH + 0.15, 2.4, 0.55, ('sign_cream', 'sign_red', 'sign_blue',
                                                                  'sign_green')[k], 'teak_dark', out=0.04)
    # the roof over the hall
    roof = {'northeast': 'zinc', 'north': 'clay_tile_dark'}.get(r, 'clay_tile')
    regions.house_roof(p, U, zE, r, mat=roof, axis='x', over=0.8, over_ends=0.6, pitch=st['pitch'] * 0.6)
    kit.eave_brackets(p, U, 'front', zE, 10, depth=0.7, mat=trim)
    kit.gutter(p, U, 'back', zE - 0.5)
    # the tower: three storeys of plaster, a balcony, the sign board and a clock in its gable
    kit.block(p, T_[0], T_[1], GH, T_[2], T_[3], zT, 'e2_moulding' if not south else regions.plaster(r, 2))
    for zz in (GH, zE):
        kit.bands(p, T_, zz - 0.1, 0.22, 0.07, trim)
    kit.corner_posts(p, T_, GH, zT, 0.4, wall)
    kit.door(p, T_, 'front', 0.0, GH + 0.15, 1.3, 2.4, leaf=shutter, frame=trim)
    kit.balcony(p, T_, 'front', 0.0, GH + 0.15, 3.4, 0.9, 'concrete', 'iron')
    for u in (-2.8, 2.8):
        if south:
            e2.arched_window(p, T_, 'front', u, GH + 0.9, 0.9, 1.6, frame=trim, shutter='shutter_green')
        else:
            e2.house_window(p, T_, 'front', u, GH + 1.0, r, 0.9, 1.4)
    for side in ('left', 'right'):
        e2.house_window(p, T_, side, 0.0, zE + 1.2, r, 0.9, 1.4)
    sp.board(b, T_, 'front', 0.0, zE + 0.5, 8.2, 3.1, [('ห้าง' + nm, 1.7, 'sign_red'), ('ห้างสรรพสินค้า', 1.0, 'sign_text')],
             'sign_cream', 'teak_dark', out=0.04)
    top = regions.house_roof(p, T_, zT, r, mat=roof, axis='y', over=0.5, over_ends=0.6, pitch=st['pitch'] * 0.75)
    if not south:
        clock(p, 0.0, T_[1] - 0.05, zT + (top - zT) * 0.38, 0.6)
    # the godown behind: brick under a ribbed zinc roof, its doors on the loading yard
    B = (-17.0, 6.0, 5.0, 19.0)
    e2.plaster_walls(p, B, 0.0, 5.2, 'brick', trim='brick_dark', pilasters=True)
    for u in kit.spread(13.0, 4, 1.0):
        kit.window(p, B, 'left', u, 3.2, 1.0, 0.9, frame='teak_dark', glass='window_dark', bars=4)
    for u in (-3.0, 3.0):
        kit.door(p, B, 'right', u, 0.0, 3.0, 3.4, leaf='plank', frame='teak_dark')
    for u in kit.spread(22.0, 5, 1.0):
        kit.window(p, B, 'back', u, 3.2, 1.0, 0.9, frame='teak_dark', glass='window_dark', bars=4)
    kit.gable_ribbed(p, B, 5.2, 2.8, 'zinc', 'zinc_dark', over=0.5, over_ends=0.4, axis='x', pitch=0.7)
    # the loading yard: an ox cart or a hand cart, sacks, crates, drums, the well and the jars
    b.path(6.0, 7.0, 18.6, 22.9, 'dirt' if r != 'northeast' else 'laterite', z=0.055)
    if r in ('northeast', 'north', 'central'):
        pw.ox_cart(q, 12.0, 17.0, facing=180)
    else:
        e2.vendor_cart(q, 12.0, 17.0, 90, ('zinc', 'zinc_dark'))
    props.sacks(q, 7.5, 9.0, 8)
    for k in range(3):
        e2.crate(q, 7.2 + k * 0.7, 12.0, ('durian', 'banana_fruit', 'paint_orange')[k % 3], stack=1 + k % 2)
    e2.drums(q, 9.0, 21.5, 4)
    pw.well(q, 16.0, 10.5, 0.8, roof=False)
    pr.big_jars(q, 6.8, 21.6, 3)
    props.woodpile(q, 15.5, 21.8, 2.0)
    # the forecourt: bicycles in racks, samlors waiting, carts, a stall, the region's thing
    sp.bike_rack(q, -14.5, -11.0, -7.4, 4, 90)
    sp.bike_rack(q, 11.0, 14.5, -7.4, 4, 90)
    sp.samlor(q, 6.5, -15.0, 90, 'awning_red' if r != 'south' else 'awning_blue')
    sp.samlor(q, 9.0, -16.0, 90, 'awning_green')
    e2.vendor_cart(q, -7.0, -12.5, 0, e2.awning_stripes(r) if r != 'northeast' else ('awning_blue', 'awning_white'))
    props.umbrella(q, -12.0, -17.0, 1.4, 2.3, 'awning_red', 'awning_white')
    props.table_stall(q, -12.0, -17.0, 1.8, 0.9, goods=('banana_fruit', 'leaf_light', 'paint_orange'))
    for k in range(3):
        e2.crate(q, -3.4 + k * 0.7, -5.2, ('banana_fruit', 'rambutan', 'paint_orange')[k], stack=1 + k % 2)
    props.bench(q, 7.0, -5.0, 1.8)
    for x in (-9.4, 9.4):
        props.potted(q, x, -4.6, 0.25, 0.5, 'leafy', int(x))
    regions.craft(b, -20.0, -9.0)
    # the edge: a low plastered front wall with lamp pillars at the gate, a higher wall round the rest
    for a, c in ((-WALL_E, -7.0), (7.0, WALL_E)):
        props.fence(p, [(a, -WALL_E), (c, -WALL_E)], 0.7, wall, kind='wall', post_mat='e2_moulding')
    for x in (-7.0, 7.0):
        gate_pillars(b, x, -WALL_E + 0.25)
    props.fence(p, [(WALL_E, -WALL_E), (WALL_E, WALL_E), (-WALL_E, WALL_E), (-WALL_E, -WALL_E)], 1.6, wall,
                kind='wall', post_mat='e2_moulding')
    e2.pole_line(q, [(-21.8, -21.8), (0.0, -21.8), (21.8, -21.8)], 8.5, sag=0.8)
    # trees and plants
    props.tree(q, -19.6, -16.0, 9.0, 2.8, 41)
    props.tree(q, -19.8, 14.0, 8.0, 2.6, 42)
    for k, (x, y) in enumerate(((-20.2, 2.0), (20.6, -18.5), (-20.2, 20.2), (-8.0, 21.2), (0.0, 21.2))):
        regions.plant(b, x, y, k + 3, big=k == 1)
    props.spirit_house(q, 21.4, -21.0, 0)
    props.water_jar(q, -18.8, -2.6, 0.9)
    props.water_jar(q, 18.8, -2.6, 0.9)
    parts_report(b)


# era 3: the factory town -----------------------------------------------------------------------------------------------

def tall_sign(b, x, y, z0, z1, w, d, text, frame='paint_red', box='st_box_lit', letters='st_red_lit'):
    """The tall lit sign of a mid-century store standing out of its front (y its back), the name reading downward,
    and a strut frame back to the roof where it rises over the parapet."""
    s = b.signs
    kit.block(s, x - w / 2 - 0.15, y - d, z0 - 0.15, x + w / 2 + 0.15, y, z1 + 0.15, frame)
    kit.block(s, x - w / 2, y - d - 0.08, z0, x + w / 2, y - d + 0.1, z1, box)
    for k in range(1, 6):
        zz = z0 + (z1 - z0) * k / 6
        kit.block(s, x - w / 2 - 0.17, y - d - 0.02, zz - 0.05, x - w / 2 + 0.02, y - 0.05, zz + 0.05, 'steel')
    sp.lettering(s, text, (x, y - d - 0.1, (z0 + z1) / 2), 'front', w * 0.72, (z1 - z0) * 0.9, letters, vertical=True)


def breeze_screen(p, rect, side, u, z0, w, h, mat='concrete_light', step=0.55, out=0.5):
    """A screen of breeze blocks (ช่องลม) standing out of a face: a frame and a grid of webs over a dark gap."""
    kit.on_face(p, rect, side, u, z0, w, h, 0.05, 'window_dark', out=out - 0.1)
    for a in (u - w / 2, u + w / 2):
        kit.on_face(p, rect, side, a, z0, 0.3, h, out + 0.3, mat)
    kit.on_face(p, rect, side, u, z0 - 0.15, w + 0.3, 0.3, out + 0.3, mat)
    kit.on_face(p, rect, side, u, z0 + h - 0.15, w + 0.3, 0.3, out + 0.3, mat)
    nu = max(2, int(w / step))
    for i in range(1, nu):
        kit.on_face(p, rect, side, u - w / 2 + w * i / nu, z0, 0.1, h, 0.22, mat, out=out)
    nz = max(2, int(h / step))
    for j in range(1, nz):
        kit.on_face(p, rect, side, u, z0 + h * j / nz - 0.05, w, 0.1, 0.22, mat, out=out)


def store_era3(b):
    """The mid-century concrete department store of the factory town."""
    r = b.region
    p, q = b.main, b.props
    nm = sp.name(r)
    south = r == 'south'
    b.ground(regions.ground_mat(r, 3))
    wall = regions.plaster(r, 1) if r != 'northeast' else 'concrete_light'
    band = e3.band_mat(r)
    D = (-19.0, -2.0, 17.0, 18.0)
    x0, y0, x1, y1 = D
    cx = (x0 + x1) / 2
    gh, sth, floors = 5.0, 4.2, 5
    top = gh + sth * (floors - 1)
    # the body: shop windows below, four floors of ribbon windows under deep sun-shade fins
    kit.block(p, x0, y0, 0, x1, y1, top, wall)
    kit.bands(p, D, 0, 0.45, 0.025, 'e3_skirt')
    for u in (-14.0, -7.5, 7.5, 14.0):
        kit.shopfront(p, D, 'front', u, 0, 6.0, 3.9, frame='steel', glass='e3_store_glass', door_w=0.01)
        e3.shop_interior(p, D, 'front', u, 0.45, 5.6, 3.1, goods=True)
    kit.shopfront(p, D, 'front', 0.0, 0, 7.0, 3.9, frame='steel', glass='e3_store_glass', door_w=3.0)
    kit.bands(p, D, gh - 0.4, 0.4, 0.12, band)
    screen = (8.4, 16.4)                        # u range of the breeze-block screen
    for f in range(1, floors):
        z = gh + sth * (f - 1)
        a, c = -17.6, screen[0] - 0.4
        kit.on_face(p, D, 'front', (a + c) / 2, z + 0.95, c - a, 2.3, 0.05, 'glass_dark')
        kit.on_face(p, D, 'front', 0, z + 0.8, 36.3, 0.18, 0.35, 'concrete_light')
        kit.on_face(p, D, 'front', 0, z + 3.45, 36.6, 0.14, 1.1, 'concrete_light')
        kit.on_face(p, D, 'front', 0, z + 3.59, 36.6, 0.12, 0.2, band, out=1.0)
        for u in kit.spread(20.0, 4, 1.4):
            e3.grille_window(p, D, 'left', u, z + 1.0, 1.5, 1.6, grille=None)
            e3.grille_window(p, D, 'right', u, z + 1.0, 1.5, 1.6, grille=None)
        e3.ac_on(q, D, 'left', -5.0, z + 0.4)
        e3.ac_on(q, D, 'left', 5.0, z + 0.4)
        if f % 2:
            e3.ac_on(q, D, 'right', -7.5, z + 0.4)
    for u in [-17.6 + 3.0 * k for k in range(9)]:
        if -16.0 < u < -12.0:
            continue
        kit.on_face(p, D, 'front', u, gh, 0.2, top - gh, 1.0, wall)
    breeze_screen(p, D, 'front', (screen[0] + screen[1]) / 2, gh + 0.4, screen[1] - screen[0], top - gh - 1.0,
                  'concrete_light' if not south else 'paint_white')
    # the canopy over the doors, its fascia lit with the store's word
    can = (cx - 8.0, y0 - 4.6, cx + 8.0, y0)
    kit.block(p, can[0], can[1], 4.1, can[2], can[3], 4.35, 'concrete_light')
    kit.block(p, can[0] - 0.05, can[1] - 0.05, 4.0, can[2] + 0.05, can[1] + 0.25, 4.95, band)
    for x in (can[0] + 0.5, can[2] - 0.5):
        p.cyl(0.18, 0.18, 4.1, 'steel', T(x, can[1] + 0.6, 2.05), seg=10)
    sp.board(b, (can[0], can[1] - 0.05, can[2], can[3]), 'front', 0.0, 4.05, 9.0, 0.85,
             [('ห้างสรรพสินค้า', 1.0, 'st_red_lit')], 'st_box_lit', 'steel', out=0.02, depth=0.08)
    # the tall sign reading downward, rising over the parapet
    sx = x0 + 3.0
    tall_sign(b, sx, y0, gh + 0.4, top + 4.2, 2.6, 1.6, 'ห้าง' + nm)
    for zz in (top + 1.0, top + 3.5):
        q.rod((sx, y0 - 0.1, zz), (sx, y0 + 3.0, top + 0.3), 0.06, 'steel', seg=4, smooth=False)
    # the roof: a parapet, the region's gable over the entrance (a Sino-Portuguese parapet in the south), tanks,
    # condensers, the lift room and the stair head
    pz = e3.flat_roof(p, D, top, 'concrete', parapet=1.0, parapet_mat=wall, coping=band)
    if south:
        e3.sino_parapet(p, cx - 6.0, cx + 6.0, y0, top + 0.25, wall, band)
    else:
        e3.front_gable(p, r, cx - 4.0, cx + 4.0, y0, pz - 0.05, depth=3.2, wall=wall)
    bz = top + 0.25
    for k in range(6):
        x = -15.0 + k * 2.4
        q.box((1.8, 1.1, 1.3), 'paint_white', T(x, 14.5, bz + 0.65), bevel=0.03)
        q.cyl(0.42, 0.42, 0.06, 'grey', T(x, 14.5, bz + 1.32), seg=12)
    for k in range(3):
        props.water_tank(q, 14.6 - k * 1.4, 16.4, bz, 'stainless' if k % 2 else 'plastic', stand=1.0)
    lift = (2.0, 7.0, 8.0, 12.0)
    kit.block(p, lift[0], lift[1], bz, lift[2], lift[3], bz + 3.4, wall)
    kit.bands(p, lift, bz + 3.1, 0.3, 0.06, band)
    regions.small_roof(p, lift, bz + 3.4, r, mat=e3.roof_mat(r), axis='x', over=0.5)
    e3.stair_head(p, -16.5, 8.0, -13.0, 11.5, bz, wall)
    e3.antenna(q, -10.0, 16.0, bz, 3.5)
    # the right side: the loading dock with its shutters and a lorry
    dock = (x1, 9.0, x1 + 2.2, 17.0)
    kit.block(p, dock[0], dock[1], 0, dock[2], dock[3], 1.1, 'concrete')
    kit.block(p, dock[2] - 0.05, dock[1], 0.95, dock[2] + 0.02, dock[3], 1.1, 'paint_yellow')
    for u in (4.0, 9.5):
        kit.roller_shutter(p, D, 'right', u, 1.1, 3.4, 3.0, 'roller', 0.65)
    kit.block(p, dock[0], dock[1] - 0.3, 4.5, dock[2] + 0.4, dock[3] + 0.3, 4.7, 'concrete_light')
    sp.lorry(q, 21.4, 12.0, -90, 'paint_blue' if r != 'south' else 'paint_green', 'paint_white')
    e3.pallets(q, 18.4, 18.4, 2, seed=1)
    # the forecourt: a car park, a motorbike shelter, food carts beside the canopy
    b.path(-23.95, -23.95, 19.6, y0, 'asphalt', z=0.06)
    b.path(19.6, -23.95, 23.95, 23.95, 'asphalt', z=0.06)
    b.path(cx - 3.0, -23.95, cx + 3.0, can[1], 'paving', z=0.075)
    e3.parking_lines(b, -22.6, -22.4, -6.0, -16.4, 7, z=0.07)
    e3.parking_lines(b, 4.0, -22.4, 18.4, -16.4, 6, z=0.07)
    cars = sp.CAR_COLOURS
    for k, i in enumerate((0, 2, 3, 5)):
        sp.car(q, -22.6 + (i + 0.5) * (16.6 / 7), -19.4, 90, cars[k], 3)
    for k, i in enumerate((1, 2, 4)):
        sp.car(q, 4.0 + (i + 0.5) * (14.4 / 6), -19.4, 90, cars[k + 3], 3)
    e3.scooter_shed(p, (-22.6, -12.0, -12.0, -9.6), 2.3, 'zinc' if r != 'south' else 'roof_blue')
    for k in range(7):
        sp.motorbike(q, -21.8 + k * 1.45, -10.8, 90, ('paint_red', 'paint_blue', 'black', 'paint_white')[k % 4])
    e3.food_cart(q, 8.0, -9.5, 0, regions.awning_colours(r)[0])
    e3.table_set(q, 10.5, -12.0, 4, umbrella=True)
    e3.table_set(q, 13.5, -10.5, 4)
    e3.vending(q, x0 + 0.8, y0 - 1.0, 0, 'paint_red')
    e3.cooler(q, x0 + 2.2, y0 - 1.0, 0)
    e3.potted_row(q, cx - 7.0, can[1] - 0.6, 2, 1.2, 0.6, 1)
    e3.potted_row(q, cx + 5.8, can[1] - 0.6, 2, 1.2, 0.6, 2)
    # the back: bins, gas, the drain
    for k in range(4):
        e3.wheelie_bin(q, -10.0 + k * 0.8, 20.0, ('paint_green', 'paint_yellow', 'paint_blue', 'paint_green')[k])
    e3.gas_tanks(q, -4.0, 20.0, 3)
    e3.drain(b, -23.0, 21.0, 17.0, 22.8, crossings=())
    # the edge: the lot wall with its gates, poles and wires along the road
    e3.lot_wall(InMain(b), WALL_E - 0.1, gates=((cx, 6.0), (19.6, 6.0)), h=1.8, front_h=0.9)
    e3.pole(q, -22.0, -22.6, 9.5, transformer=True)
    e3.pole(q, -5.0, -22.6, 9.5, lamp=True, facing=180)
    e3.pole(q, 12.0, -22.6, 9.5, lamp=True, facing=180)
    e3.tangle(q, (-22.0, -22.6, 9.0), (-5.0, -22.6, 9.0), 4, 0.6)
    e3.tangle(q, (-5.0, -22.6, 9.0), (12.0, -22.6, 9.0), 4, 0.6)
    for k, (x, y) in enumerate(((-21.2, 2.0), (-21.2, 9.0), (-21.2, 16.0))):
        regions.plant(b, x, y, k, big=False)
    props.tree(q, -20.8, 12.5, 6.5, 1.8, 51)
    regions.craft(b, -21.0, -6.0)
    props.spirit_house(q, -21.6, -14.6, 0)
    parts_report(b)


# era 4: the modern city --------------------------------------------------------------------------------------------------

def car_park(b, rect, decks, dh, d, cars=6, seed=0):
    """A multi-storey car park: open decks behind white parapets on a grid of columns, a dark inside, a stair and
    lift tower at the back, a solar carport and parked cars on the roof deck. Returns the roof deck's height."""
    p, q = b.main, b.props
    x0, y0, x1, y1 = rect
    zr = 0.3 + decks * dh
    kit.block(p, x0 + 1.0, y0 + 1.0, 0.0, x1 - 1.0, y1 - 1.0, zr, 'concrete_dark')
    nx, ny = max(2, int((x1 - x0) / 6.0)), max(2, int((y1 - y0) / 6.0))
    for i in range(nx + 1):
        for j in (0, ny):
            x, y = x0 + 0.3 + (x1 - x0 - 0.6) * i / nx, y0 + 0.3 + (y1 - y0 - 0.6) * j / ny
            kit.block(p, x - 0.3, y - 0.3, 0.0, x + 0.3, y + 0.3, zr, 'concrete_light')
    for j in range(1, ny):
        for x in (x0 + 0.3, x1 - 0.3):
            y = y0 + 0.3 + (y1 - y0 - 0.6) * j / ny
            kit.block(p, x - 0.3, y - 0.3, 0.0, x + 0.3, y + 0.3, zr, 'concrete_light')
    for k in range(1, decks + 1):
        z = 0.3 + k * dh
        kit.block(p, x0, y0, z - 0.35, x1, y1, z, 'concrete')
        kit.bands(p, rect, z, 1.05, 0.05, 'e4_white')
        kit.bands(p, rect, z + 0.95, 0.12, 0.08, d['accent'])
    # the ramp's slope seen through the front openings
    kit.slab(p, (x0 + 1.2, y0 + 1.2, 0.3), (x0 + 4.6, y0 + 1.2, 0.3), (x0 + 4.6, y0 + 9.0, 0.3 + dh),
             (x0 + 1.2, y0 + 9.0, 0.3 + dh), 0.25, 'concrete')
    core = (x0 + 0.4, y1 - 4.6, x0 + 4.6, y1 - 0.4)
    kit.block(p, core[0], core[1], 0.0, core[2], core[3], zr + 3.2, 'e4_white')
    kit.on_face(p, core, 'front', 0.0, zr + 0.2, 1.4, 2.4, 0.06, 'e4_glass')
    kit.block(p, core[0] - 0.15, core[1] - 0.15, zr + 3.2, core[2] + 0.15, core[3] + 0.15, zr + 3.45, d['accent'])
    # the roof deck: bays, cars, a solar carport over its back half, lamps
    for i in range(4):
        x = x0 + 1.5 + (x1 - x0 - 3.0) * (i + 0.5) / 4
        kit.block(p, x - 0.06, y0 + 0.8, zr, x + 0.06, y0 + 5.6, zr + 0.03, 'paint_white')
    def roof_cars():
        for k in range(cars):
            x = x0 + 1.5 + (x1 - x0 - 3.0) * ((k % 4) + 0.5) / 4
            y = y0 + 3.2 if k < 4 else y1 - 8.8
            sp.car(q, x, y, 90 if k < 4 else -90, sp.CAR_COLOURS[(k + seed) % len(sp.CAR_COLOURS)], 4)
    e4.lift(q, zr, roof_cars)
    cp = (x0 + 5.2, y1 - 12.0, x1 - 0.8, y1 - 5.6)
    e4.carport(p, cp, 2.7 + zr, 'e4_roof_metal', 'e4_graphite')
    e4.solar_field(p, cp[0] + 0.2, cp[1] + 0.2, cp[2] - 0.2, cp[3] - 0.2, zr + 2.9)
    return zr


def store_era4(b):
    """The shopping mall of the modern city."""
    r = b.region
    d = e4.dress(r, 0)
    p, q = b.main, b.props
    nm = sp.name(r)
    b.ground(regions.ground_mat(r, 4))
    M = (-22.6, -0.5, 7.6, 20.0)
    C = (9.4, -0.5, 22.9, 22.9)
    zt = 15.3
    # the mall: three 5 m floors of panels with glass bands and screens
    kit.block(p, M[0] - 0.1, M[1] - 0.1, 0, M[2] + 0.1, M[3] + 0.1, 0.3, 'e4_white')
    kit.block(p, *M[:2], 0.3, *M[2:], zt, 'e4_panel')
    for z in (5.3, 10.3):
        kit.bands(p, M, z - 0.2, 0.4, 0.08, 'e4_white')
        kit.bands(p, M, z + 2.6, 1.2, 0.04, 'e4_glass')
    kit.bands(p, M, 0.3, 3.8, 0.04, 'e4_glass')
    for x in range(-22, 8, 3):
        kit.block(p, x - 0.12, M[1] - 0.12, 0.3, x + 0.12, M[1], 4.1, 'e4_alu')
    if r == 'south':
        e4.arches(p, M, 'left', 0.3, (-6.0, -2.0, 2.0, 6.0), 2.6, 2.6, glass='e4_glass', frame=d['wall'])
    e4.fins(p, M, 'left', -2.0, 5.4, 16.0, 9.4, d['louvre'], step=0.8, depth=0.45, thick=0.12)
    mid = (M[0] + M[2]) / 2
    kit.on_face(p, M, 'front', 3.2 - mid, 6.0, 7.0, 4.8, 0.15, 'e4_graphite', out=0.02)
    kit.on_face(p, M, 'front', 3.2 - mid, 6.2, 6.6, 4.4, 0.18, 'screen_lit', out=0.02)
    sp.board(b, M, 'front', -17.6 - mid, 8.6, 9.0, 3.2, [(nm + 'พลาซ่า', 1.5, 'st_letter_lit'),
                                                       ('ศูนย์การค้า', 0.85, 'st_letter_lit')],
             'e4_graphite', 'e4_alu', out=0.04, depth=0.12)
    for u in (-8.0, 0.0, 8.0):
        kit.roller_shutter(p, M, 'back', u, 0.3, 3.6, 3.4, 'roller', 0.0)
    # the atrium: glass from the plaza to above the roof under the region's roof, a drop-off canopy before it
    atr = (-13.0, -6.0, -1.4, -0.5)
    za = e4.curtain(p, atr, 0.3, 19.5, 5.0, step=1.45)
    for x in (atr[0], atr[2]):
        kit.block(p, x - 0.45, atr[1] - 0.45, 0.0, x + 0.45, atr[1] + 0.45, za + 0.5, d['accent'])
    regions.house_roof(p, (atr[0] - 0.4, atr[1] - 0.4, atr[2] + 0.4, 3.0), za, r, mat=d['roof'], axis='y', over=0.6,
                       over_ends=0.8, fill='e4_glass', courses=2, pitch=regions.style(r)['pitch'] * 0.6)
    e4.canopy(p, atr[0] - 3.0, -11.6, atr[2] + 3.0, atr[1], 4.6)
    sp.board(b, (atr[0] - 3.0, -11.65, atr[2] + 3.0, atr[1]), 'front', 0.0, 4.35, 8.0, 0.75,
             [('ทางเข้า ' + nm + 'พลาซ่า', 1.0, 'paint_white')], d['accent'] if r != 'north' else 'teak_dark',
             'e4_alu', out=0.0, depth=0.06)
    # the mall's roof: a glass ridge light, solar, chillers
    e4.flat_roof(p, M, zt, 'concrete_light', parapet=1.0, parapet_mat='e4_panel', coping=d['accent'])
    kit.gable_roof(p, (-20.0, 6.0, 3.0, 10.0), zt + 0.25, 1.6, 'e4_glass', over=0.1, over_ends=0.1, thick=0.1)
    e4.solar_field(p, -21.6, 11.0, 6.6, 19.0, zt + 0.25)
    e4.solar_field(p, -21.6, 0.5, -15.0, 5.2, zt + 0.25)
    for x in (0.5, 4.0):
        e4.chiller(q, x, 2.4, zt + 0.25, 3.0, 2.2, 2.0, 2)
    # the bridge to the car park and the car park
    kit.block(p, M[2], 6.0, 5.3, C[0], 10.0, 8.6, 'e4_glass')
    kit.block(p, M[2], 5.9, 8.6, C[0], 10.1, 8.9, 'e4_white')
    zr = car_park(b, C, 4, 3.1, d, 6, 1)
    sp.board(b, C, 'front', 0.0, zr - 3.6, 7.0, 2.4, [('P', 1.4, 'paint_white'), ('ที่จอดรถ', 0.8, 'paint_white')],
             'paint_blue', 'e4_alu', out=0.1, depth=0.1)
    # the plaza: the drop-off lane, a taxi, a bus shelter, planted islands, trees and lamps
    b.path(-23.95, -23.95, 23.95, -0.5, 'paving_dark' if r != 'northeast' else 'laterite', z=0.06)
    b.path(-18.0, -15.4, 3.6, -11.6, 'asphalt', z=0.07)
    b.path(-18.0, -23.95, -14.0, -15.4, 'asphalt', z=0.07)
    b.path(-0.4, -23.95, 3.6, -15.4, 'asphalt', z=0.07)
    b.path(C[0], -23.95, C[2], C[1], 'asphalt', z=0.07)
    sp.car(q, -6.0, -13.4, 0, 'st_car_yellow', 4)
    sp.car(q, -12.5, -13.4, 0, 'st_car_white', 4)
    for k, x in enumerate((11.5, 14.5, 17.5, 20.5)):
        kit.block(b.yard, x - 1.4, -21.0, 0.0, x - 1.28, -15.0, 0.085, 'paint_white')
        if k != 2:
            sp.car(q, x, -18.0, 90, sp.CAR_COLOURS[k + 2], 4)
    kit.block(b.yard, 20.5 + 1.4 - 0.06, -21.0, 0.0, 20.5 + 1.46, -15.0, 0.085, 'paint_white')
    for x in (12.0, 20.0):
        e3.barrier(q, x, -3.4, 3.2)
    e3.guard_booth(p, 16.0, -3.0)
    # bus shelter at the road
    kit.block(p, -12.5, -22.9, 2.6, -5.5, -20.9, 2.75, 'e4_glass')
    for x in (-12.3, -5.7):
        kit.block(p, x - 0.06, -21.0, 0.0, x + 0.06, -20.9, 2.6, 'e4_graphite')
    kit.block(p, -12.3, -21.0, 0.3, -5.7, -20.92, 2.4, 'e4_glass')
    props.bench(q, -9.0, -21.5, 3.0)
    for x0, x1 in ((-13.6, -4.4), (5.0, 8.4)):
        e4.planter(b, x0, -17.8, x1, -16.2, seed=int(x0) + 60, flowers='flower_pink')
    e4.planter(b, -23.0, -9.0, -19.0, -1.4, seed=70)
    e4.tree_row(b, [(-20.2, -12.0), (-20.2, -19.5), (5.8, -12.5), (6.2, -20.4), (-20.2, 3.5)], 6.5, 2.2, 61)
    for x in (-19.4, 4.6):
        props.street_lamp(q, x, -13.0, 6.0, 0, 'e4_graphite')
    # bicycles and a coffee kiosk before the mall, motorbike bays by the car park's lane
    sp.bike_rack(q, 0.2, 5.6, -3.2, 6, 90, ('paint_green', 'e4_white', 'paint_orange', 'e4_graphite'))
    kit.block(p, 2.6, -9.6, 0.0, 5.0, -7.4, 2.6, d['wall'], bevel=0.05)
    kit.on_face(p, (2.6, -9.6, 5.0, -7.4), 'front', 0.0, 0.9, 2.0, 1.2, 0.05, 'e4_glass')
    kit.block(p, 2.3, -10.2, 2.6, 5.3, -7.0, 2.8, d['accent'])
    for x, y in ((6.8, -8.0), (6.6, -10.4)):
        e3.table_set(q, x, y, 3, 'e4_white', 'e4_graphite', umbrella=False)
    props.umbrella(q, 6.7, -9.2, 1.6, 2.5, 'awning_white', 'awning_green')
    kit.block(b.yard, 18.8, -12.6, 0.0, 22.6, -5.0, 0.08, 'asphalt')
    for k in range(6):
        y = -12.0 + k * 1.2
        kit.block(b.yard, 18.9, y - 0.6, 0.0, 22.5, y - 0.55, 0.085, 'paint_white')
        sp.motorbike(q, 20.7, y, 180, ('paint_red', 'paint_blue', 'black', 'e4_white')[k % 4])
    for x in (-10.0, -7.0, -4.0):
        props.bollard_light(q, x, -11.0)
    props.spirit_house(q, 7.0, -3.0, 0)
    regions.craft(b, -17.0, -3.0)
    # the edge: a low white wall with a hedge along it, open where the lanes and the walk come in
    e4.low_wall(InMain(b), WALL_E, [(-18.0, -14.0), (-12.5, -5.5), (-0.4, 3.6), (C[0], C[2])], h=0.7)
    for x in range(-22, 23, 2):
        if -18.5 < x < -13.5 or -13 < x < -5 or -1 < x < 4 or x > C[0] - 0.5:
            continue
        props.bush(q, x, -22.7, 0.55, x + 80, 'leaf_dark')
    parts_report(b)


# era 5: the future city ------------------------------------------------------------------------------------------------

def louvre_canopy(b, rect, z, d, step=0.5):
    """An entrance canopy of timber louvres on a rounded frame and slim posts, a green light along its edge."""
    p = b.main
    x0, y0, x1, y1 = rect
    e5.ring_band(p, e5.rrect(x0, y0, x1, y1, 1.6, 3), z, 0.45, 0.25, d['wall'])
    n = int((x1 - x0) / step)
    for i in range(1, n):
        x = x0 + (x1 - x0) * i / n
        kit.block(p, x - 0.05, y0 + 0.2, z + 0.05, x + 0.05, y1 - 0.2, z + 0.4, d['louvre'])
    for x in (x0 + 0.8, x1 - 0.8):
        p.cyl(0.12, 0.12, z, 'steel', T(x, y0 + 0.8, z / 2), seg=8)
    e5.glow_line(p, [(x0 + 1.6, y0 - 0.02), (x1 - 1.6, y0 - 0.02)], z + 0.05, closed=False)


def ev_bays(b, rect, d, cars, seed=0):
    """Charging bays under a solar canopy: bay lines, a charger at the head of each bay, small electric pods."""
    x0, y0, x1, y1 = rect
    q = b.props
    e5.solar_pergola(b.main, rect, 0.0, 2.7)
    n = max(2, int((x1 - x0) / 2.6))
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        kit.block(b.yard, x - 0.05, y0 + 0.3, 0.0, x + 0.05, y1 - 0.6, 0.075, 'paint_white')
    for i in range(n):
        x = x0 + (x1 - x0) * (i + 0.5) / n
        e5.charger(q, x, y1 - 0.4, 180)
        if i in cars:
            sp.car(q, x, (y0 + y1) / 2 - 0.3, 90, sp.CAR_COLOURS[(i + seed) % len(sp.CAR_COLOURS)], 5)


def store_era5(b):
    """The green mall of the future city."""
    r = b.region
    d = e5.dress(r, 1)
    p, q = b.main, b.props
    nm = sp.name(r)
    b.ground('paving')
    r1 = (-21.2, -2.0, 21.2, 21.8)
    r2 = (-21.2, 3.0, 21.2, 21.8)
    r3 = (-21.2, 8.0, 14.6, 21.8)
    fh = 5.0
    e5.rbox(p, r1[0] - 0.4, r1[1] - 0.4, 0.0, r1[2] + 0.4, r1[3] + 0.4, 0.3, 4.4, d['band'])
    # three floors stepping back into planted terraces
    z1 = e5.tower(b, r1, 0.3, 1, fh, d, seed=1, r=4.0, fins=('left',), fin_span=0.6, piers=False)
    for x0, x1, s in ((-20.0, -7.0, 1), (7.0, 20.0, 2)):
        e5.planter(p, q, (x0, r1[1] + 0.1, x1, r1[1] + 0.8), z1, 0.6, d['band'], s, tall=2)
    e4.lift(q, z1, lambda: (e5.bench(q, -12.0, 1.0, 2.2), e5.bench(q, 12.0, 1.0, 2.2),
                            props.umbrella(q, -16.0, 1.2, 1.3, 2.3, 'awning_white', d['accent'] if r != 'south'
                                           else 'awning_blue'),
                            props.umbrella(q, 16.0, 1.2, 1.3, 2.3, 'awning_white', 'awning_green')))
    z2 = e5.tower(b, r2, z1, 1, fh, d, seed=2, r=4.0, fins=('front',), fin_span=0.35, piers=False)
    e5.planter(p, q, (-20.0, r2[1] + 0.1, 20.0, r2[1] + 0.8), z2, 0.6, d['band'], 3, tall=3)
    z3 = e5.tower(b, r3, z2, 1, fh, d, seed=3, r=4.0, fins=(), piers=False)
    e5.planter(p, q, (-20.0, r3[1] + 0.1, 13.4, r3[1] + 0.8), z3, 0.6, d['band'], 4, tall=0)
    e5.green_wall(p, r1, 'left', 6.0, 0.8, 9.0, 3.8, 5)
    e5.green_wall(p, r2, 'left', 8.0, z1 + 0.6, 7.0, 3.8, 6)
    # the entrance: a curved glass front under a louvred canopy, its fascia with the store's word, the name above
    e5.rbox(p, -6.0, -4.4, 0.3, 6.0, -2.0, fh, (2.2, 0, 0, 2.2), d['glass'])
    for k in range(9):
        x = -4.8 + k * 1.2
        kit.block(p, x - 0.04, -4.45, 0.3, x + 0.04, -2.1, fh, 'steel')
    can = (-9.0, -9.2, 9.0, -4.4)
    louvre_canopy(b, can, 4.6, d)
    sp.board(b, (can[0], can[1] - 0.25, can[2], can[3]), 'front', 0.0, 4.3, 10.0, 0.8,
             [('ศูนย์การค้าสีเขียว', 1.0, 'st_letter_lit')], d['louvre'], d['wall'], out=0.0, depth=0.08)
    sp.board(b, r2, 'front', -10.0, z1 + 1.0, 11.0, 3.0, [(nm, 1.0, 'st_letter_lit')], d['louvre'], d['wall'],
             out=0.45, depth=0.15)
    e5.glow_line(p, [(-15.6, r2[1] - 0.66), (-4.4, r2[1] - 0.66)], z1 + 0.85, closed=False)
    # the roof: a vaulted skylight over the atrium, the region's roof pavilion, a solar pergola, a drone pad, a roof
    # garden on the lower roof
    e5.parapet(b, r3, z3, d, 4.0, 1.0)
    e5.vault(p, -10.0, 6.0, 14.6, 3.8, z3, 2.8, 0.15, 'e5_sky_glass', 10)
    for x in (-10.0, -6.0, -2.0, 2.0, 6.0):
        e5.vault(p, x - 0.1, x + 0.1, 14.6, 3.85, z3, 2.85, 0.2, d['louvre'], 10)
    e5.thai_crown(b, (-19.6, 15.0, -14.4, 20.4), z3, d, h=3.0, axis='y')
    e5.solar_pergola(p, (-19.6, 9.2, -13.0, 13.8), z3, 2.4)
    e5.drone_pad_raised(p, q, 10.6, 12.6, z3, 1.8, 2)
    e5.solar_array(p, 8.2, 16.0, 13.6, 20.8, z3)
    e5.roof_garden(b, (15.4, 8.8, 20.4, 21.0), z2, 21, 2)
    e5.glass_rail(p, [(14.8, 8.4), (20.8, 8.4)], z2, h=1.0)
    # the plaza: charging bays under solar canopies, rain gardens, solar trees, a bike rack, lockers and robots
    b.path(-4.0, -23.95, 4.0, can[1], d['path'], z=0.07)
    b.path(-21.6, -22.0, 21.6, -20.6, 'paving_dark', z=0.07)
    ev_bays(b, (-21.0, -19.6, -9.0, -13.4), d, (0, 2, 3), 0)
    ev_bays(b, (9.0, -19.6, 21.0, -13.4), d, (1, 2, 4), 3)
    e5.rain_garden(p, q, -8.6, -11.6, -4.6, -6.0, 1)
    e5.rain_garden(p, q, 4.6, -11.6, 8.6, -6.0, 2)
    e5.solar_tree(q, -6.5, -17.0, 5.0, 4, 0)
    e5.solar_tree(q, 6.5, -17.0, 5.0, 4, 1)
    sp.bike_rack(q, 10.5, 16.5, -9.6, 6, 90, ('paint_green', 'e5_cream', 'paint_orange'))
    e5.robot_locker(q, 19.4, -6.6, 0, 3.0, 2.0, 6, 4)
    e5.delivery_robot(q, 2.6, -14.0, 20)
    e5.delivery_robot(q, -2.4, -11.0, -15, 'paint_yellow')
    e5.drone_with_parcel(q, -3.0, -6.0, 12.0)
    for x in (-15.5, -10.5):
        e5.bench(q, x, -8.4, 2.2)
    for x in (-4.6, 4.6):
        e5.lamp_post(q, x, -19.0, 4.5)
        e5.lamp_post(q, x, -12.8, 4.5)
    e5.lawn(b, -21.6, -12.4, -9.4, -10.0)
    for k, (x, y) in enumerate(((-18.8, -10.8), (18.8, -11.0), (-20.2, -6.0))):
        if b.region in ('south', 'east', 'central') and k == 0:
            props.coconut(q, x, y, 9.0, seed=k)
        else:
            regions.plant(b, x, y, k)
    regions.craft(b, 17.0, -4.0)
    # the edge: a low planted wall round the square, open in the front middle
    e5.fence_glass(b, WALL_E - 0.3, 16.0)
    parts_report(b)


STORE_SETS = {}
for _era, _fn in ((2, store_era2), (3, store_era3), (4, store_era4), (5, store_era5)):
    _items, _building = registry(_era)
    _building('store', None, *NAMES[_era])(_fn)
    STORE_SETS['era%d' % _era] = _items
