# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 4, the modern city (assets/concept/era4_C_vehicles.jpg): the small hatchback, the blue low-floor city bus, the
food-delivery scooter with its box, the two-tone taxi; and what the city drives beside them, a family sedan, a
passenger van (รถตู้) and a double-cab pickup. (The elevated train is the railway's.)"""

import vbodies
import vlib
from lib import kit
from lib.mesh import R, T

from . import registry

VEHICLES, vehicle = registry(4)

CAR_PAINTS = ('v_white_car', 'v_silver', 'v_pale_yellow', 'v_red', 'v_navy', 'iron', 'v_sky', 'v_maroon')


@vehicle('hatchback', 'รถเก๋งเล็ก', 'Hatchback', cls='car', paints=('v_pale_yellow',) + CAR_PAINTS[:2] + CAR_PAINTS[3:])
def hatchback(v):
    vbodies.car(v, 'v_pale_yellow', 'hatch', wr=0.29)


@vehicle('sedan', 'รถเก๋ง', 'Sedan', cls='car', paints=CAR_PAINTS)
def sedan(v):
    vbodies.car(v, 'v_white_car', 'sedan')


@vehicle('taxi', 'แท็กซี่', 'Taxi', cls='car')
def taxi(v):
    d = vbodies.car(v, 'v_taxi_yellow', 'sedan')
    p = v.body
    # the lower half green, as the sheet's two-tone taxi; the roof sign
    hw = d['W'] / 2
    vlib.side_band(p, hw, d['f'] + 0.2, d['r'] - 0.15, d['zb'] + 0.26, 0.42, 'v_taxi_green')
    p.box((0.62, 0.3, 0.18), 'sign_cream', T(0, -0.15, d['roof'] + 0.16), bevel=0.03)
    p.box((0.5, 0.31, 0.06), 'paint_red', T(0, -0.15, d['roof'] + 0.18))


@vehicle('van', 'รถตู้', 'Passenger van', cls='car', paints=('v_white_car', 'v_silver', 'iron', 'v_sky'))
def van(v):
    p = v.body
    paint = 'v_white_car'
    L, W, wr = 5.35, 1.9, 0.33
    f, r = -L / 2, L / 2
    zb, belt, roof = 0.35, 1.05, 2.2
    vlib.shell(p, [(f, zb + 0.05), (f - 0.02, zb + 0.4), (f + 0.15, belt - 0.05), (f + 0.75, belt + 0.05),
                   (f + 1.3, roof - 0.05), (f + 1.45, roof), (r - 0.1, roof), (r, roof - 0.1), (r + 0.02, zb + 0.3),
                   (r - 0.05, zb)], W, paint)
    # windscreen, the tinted side windows in a row, the back window
    kit.hull(p, [(-W / 2 + 0.12, f + 0.78, belt + 0.1), (W / 2 - 0.12, f + 0.78, belt + 0.1),
                 (-W / 2 + 0.15, f + 1.3, roof - 0.12), (W / 2 - 0.15, f + 1.3, roof - 0.12),
                 (-W / 2 + 0.12, f + 0.74, belt + 0.1), (W / 2 - 0.12, f + 0.74, belt + 0.1),
                 (-W / 2 + 0.15, f + 1.26, roof - 0.12), (W / 2 - 0.15, f + 1.26, roof - 0.12)], 'v_glass')
    vlib.window_row(p, W / 2, f + 1.0, r - 0.3, belt + 0.15, roof - 0.2, 4, glass='v_glass', frame='v_trim')
    p.box((W - 0.4, 0.04, 0.6), 'v_glass', T(0, r + 0.01, roof - 0.5))
    # sliding door rail, lamps, grille, bumpers
    p.box((0.02, 1.6, 0.03), 'v_trim', T(W / 2 + 0.01, 0.3, belt + 0.1))
    vlib.lamp_pair(p, f + 0.08, belt - 0.15, W / 2 - 0.22, w=0.34, h=0.12)
    p.box((W * 0.5, 0.04, 0.18), 'v_grille', T(0, f - 0.01, zb + 0.42))
    vlib.lamp_pair(p, r, belt - 0.1, W / 2 - 0.1, facing=1, w=0.1, h=0.4, mat='red_light')
    vlib.bumper(p, f, zb + 0.12, W, depth=0.12, h=0.2)
    vlib.bumper(p, r, zb + 0.12, W, depth=0.12, h=0.2)
    vlib.plate(p, f - 0.08, zb + 0.14)
    vlib.plate(p, r + 0.07, zb + 0.4, facing=1)
    vlib.door_lines(p, W / 2, (f + 0.8, f + 1.75), zb + 0.1, belt + 0.8)
    vlib.mirrors(p, W / 2 - 0.05, f + 0.85, belt + 0.25, arm=0.14, size=(0.05, 0.1, 0.16))
    fy, ry = f + 0.85, r - 1.0
    for y in (fy, ry):
        vlib.arch(p, y, wr, wr + 0.08, W / 2 + 0.005)
    v.wheel(vlib.car_wheel(wr, 0.21), wr, [(s * (W / 2 - 0.1), y, wr) for y in (fy, ry) for s in (-1, 1)])


@vehicle('pickup', 'กระบะสี่ประตู', 'Double-cab pickup', cls='car', paints=CAR_PAINTS)
def pickup(v):
    vbodies.pickup(v, 'v_silver', L=5.3, W=1.85, cab='double', modern=True, wr=0.38)


@vehicle('scooter', 'มอเตอร์ไซค์ส่งอาหาร', 'Delivery scooter', cls='small',
         paints=('v_delivery_green', 'v_orange', 'v_red', 'v_pink'), slow=0.95)
def scooter(v):
    seat = vbodies.step_through(v, 'v_delivery_green', shield='v_delivery_green', seat='v_trim', rack=False,
                                box='v_delivery_green', wr=0.26, wb=1.25)
    vbodies.rider_on_motorcycle(v.body, seat, wb=1.25, shirt='v_delivery_green', pants='v_jeans', head='helmet',
                                hat_mat='v_delivery_green')


@vehicle('bus', 'รถเมล์ชานต่ำ', 'Low-floor city bus', cls='heavy')
def bus(v):
    vbodies.bus(v, 'v_blue_grey', L=11.5, H=3.15, low_floor=True, windows=5, vents=0, aircon=True,
                lower='v_blue_grey_dark', front_glass=1.65, rounded=0.35)
