# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 3, the factory town (assets/concept/era3_C_vehicles.jpg): the tuk-tuk with its striped bench, the pickup with a
steel cage (and a plain one), the cab-over box truck, the motorcycle taxi's rider in his orange vest, and the orange
air-conditioned bus."""

from mathutils import Vector

import vbodies
import vlib
from lib import kit
from lib.mesh import R, S, T

from . import registry

VEHICLES, vehicle = registry(3)

CAR_PAINTS = ('v_white_car', 'v_silver', 'v_red', 'v_sky', 'v_navy', 'v_maroon', 'v_green_dark')


@vehicle('tuktuk', 'ตุ๊กตุ๊ก', 'Tuk-tuk', cls='cart', paints=('v_tuk_blue', 'v_red', 'v_bus_green', 'v_maroon'))
def tuktuk(v):
    p = v.body
    paint, trim = 'v_tuk_blue', 'v_tuk_yellow'
    fy, ay, track = -1.0, 0.75, 0.55
    fwr, rwr = 0.24, 0.25
    zb = 0.3
    # front: fork, fender, the nose cowl with two round lamps
    for s in (-1, 1):
        p.rod((s * 0.06, fy, fwr), (s * 0.05, fy + 0.25, 0.85), 0.03, 'v_chrome', seg=5)
    p.cap(fwr + 0.05, paint, T(0, fy, fwr) @ S(0.3, 1, 1), keep=lambda co: co.z > fwr * 0.5, seg=12, rings=6)
    kit.hull(p, [(-0.28, fy + 0.1, 0.55), (0.28, fy + 0.1, 0.55), (-0.22, fy + 0.02, 0.95), (0.22, fy + 0.02, 0.95),
                 (-0.5, fy + 0.6, 0.35), (0.5, fy + 0.6, 0.35), (-0.5, fy + 0.6, 1.0), (0.5, fy + 0.6, 1.0)], paint)
    p.box((0.58, 0.04, 0.06), trim, T(0, fy + 0.05, 0.92))
    for s in (-1, 1):
        p.cyl(0.08, 0.08, 0.05, 'lamp', T(s * 0.15, fy + 0.03, 0.8) @ R(90, 0, 0), seg=10)
        p.box((0.06, 0.04, 0.04), 'paint_orange', T(s * 0.25, fy + 0.07, 0.66))
    vlib.plate(p, fy + 0.07, 0.5, w=0.26, h=0.1)
    # the floor and the low side panels, a yellow band, the tail with its lamps
    kit.block(p, -0.66, fy + 0.6, zb, 0.66, ay + 0.55, zb + 0.12, 'v_trim')
    for s in (-1, 1):
        kit.block(p, s * 0.66 - (0.04 if s > 0 else -0.04), fy + 0.6, zb + 0.12, s * 0.66, ay + 0.55, zb + 0.55, paint)
        p.box((0.012, ay + 0.55 - fy - 0.6, 0.06), trim, T(s * 0.665, (ay + 0.55 + fy + 0.6) / 2, zb + 0.45))
        p.cap(rwr + 0.06, paint, T(s * track, ay, rwr) @ S(0.3, 1, 1), keep=lambda co: co.z > rwr * 0.4, seg=12,
              rings=6)
    kit.block(p, -0.66, ay + 0.35, zb + 0.12, 0.66, ay + 0.6, zb + 0.75, paint)
    p.box((1.3, 0.012, 0.06), trim, T(0, ay + 0.605, zb + 0.6))
    vlib.lamp_pair(p, ay + 0.6, zb + 0.4, 0.5, facing=1, w=0.1, h=0.14, mat='red_light')
    vlib.plate(p, ay + 0.6, zb + 0.22, w=0.26, h=0.1, facing=1)
    # the driver's seat, handlebar, the dash and windscreen
    kit.block(p, -0.3, -0.35, zb + 0.5, 0.3, -0.05, zb + 0.62, 'v_seat')
    kit.block(p, -0.3, -0.07, zb + 0.6, 0.3, 0.0, zb + 1.0, 'v_seat')
    stem = Vector((0, fy + 0.45, 1.05))
    p.rod((0, fy + 0.3, 0.9), stem, 0.02, 'v_chrome', seg=4)
    p.rod((-0.32, stem.y + 0.05, stem.z), (0.32, stem.y + 0.05, stem.z), 0.018, 'v_chrome', seg=4)
    p.box((0.95, 0.04, 0.42), 'v_glass', T(0, fy + 0.55, 1.22) @ R(-12, 0, 0))
    p.box((1.0, 0.06, 0.05), 'v_chrome', T(0, fy + 0.5, 1.42))
    # the passengers' bench: striped cushion and back
    stripes = ('v_pink', 'v_lime', 'v_purple', 'v_tuk_yellow', 'v_sky')
    for k, mat in enumerate(stripes):
        x0 = -0.6 + k * 0.24
        kit.block(p, x0, ay - 0.15, zb + 0.4, x0 + 0.24, ay + 0.3, zb + 0.55, mat)
        kit.block(p, x0, ay + 0.25, zb + 0.55, x0 + 0.24, ay + 0.35, zb + 1.05, mat)
    p.box((0.3, 0.3, 0.25), 'plank', T(-0.35, 0.1, zb + 0.24))
    # the roof canopy on chrome posts, with its valance, a taxi sign on top
    top = 1.78
    for (x, y) in ((-0.62, fy + 0.55), (0.62, fy + 0.55), (-0.62, ay + 0.55), (0.62, ay + 0.55), (-0.62, -0.05),
                   (0.62, -0.05)):
        p.rod((x, y, zb + 0.5 if y > fy + 0.6 else 1.0), (x * 0.98, y, top), 0.022, 'v_chrome', seg=4)
    kit.hull(p, [(-0.72, fy + 0.4, top), (0.72, fy + 0.4, top), (-0.72, ay + 0.7, top), (0.72, ay + 0.7, top),
                 (-0.6, fy + 0.5, top + 0.14), (0.6, fy + 0.5, top + 0.14), (-0.6, ay + 0.6, top + 0.14),
                 (0.6, ay + 0.6, top + 0.14)], 'v_tuk_roof')
    for s in (-1, 1):
        p.box((0.02, ay - fy + 0.25, 0.14), trim, T(s * 0.725, (ay + fy) / 2 + 0.15, top - 0.05))
    p.box((1.44, 0.02, 0.14), trim, T(0, fy + 0.39, top - 0.05))
    p.box((0.28, 0.12, 0.12), 'sign_cream', T(0, fy + 0.6, top + 0.2), bevel=0.02)
    p.box((0.22, 0.13, 0.03), 'paint_red', T(0, fy + 0.6, top + 0.22))
    # the driver
    vlib.figure(p, (0, -0.22, zb + 0.66), [(-0.3, stem.y + 0.05, stem.z), (0.3, stem.y + 0.05, stem.z)],
                [(-0.15, fy + 0.65, zb + 0.15), (0.15, fy + 0.65, zb + 0.15)], shirt='v_shirt_green', pants='v_pants',
                head='bare', lean=4)
    v.wheel(vlib.car_wheel(fwr, 0.14), fwr, [(0, fy, fwr)])
    v.wheel(vlib.car_wheel(rwr, 0.16), rwr, [(s * track, ay, rwr) for s in (-1, 1)])


@vehicle('pickup_cage', 'กระบะคอกเหล็ก', 'Pickup with a cage', cls='car', paints=CAR_PAINTS)
def pickup_cage(v):
    d = vbodies.pickup(v, 'v_white_car', L=5.1)
    vbodies.cage(v.body, d['cab_back'] + 0.08, d['r'] - 0.05, 1.72, d['belt'], d['roof'] + 0.15)


@vehicle('pickup', 'รถกระบะ', 'Pickup', cls='car', paints=CAR_PAINTS)
def pickup(v):
    d = vbodies.pickup(v, 'v_silver', L=5.1, cab='extended')
    p = v.body
    # a load under a tarpaulin and a few crates
    kit.block(p, -0.7, d['cab_back'] + 0.25, d['zb'] + 0.3, 0.7, d['cab_back'] + 1.2, d['belt'] + 0.25, 'v_sky')
    for k in range(2):
        p.box((0.5, 0.45, 0.35), 'plank', T(-0.35 + k * 0.7, d['r'] - 0.5, d['zb'] + 0.5))


@vehicle('box_truck', 'รถบรรทุกตู้หกล้อ', 'Box truck', cls='heavy',
         paints=('v_truck_yellow', 'v_white_car', 'v_sky', 'v_bus_green', 'v_red'), slow=0.8)
def box_truck(v):
    p = v.body
    L, W, wr = 6.7, 2.1, 0.45
    f, r = -L / 2, L / 2
    zb, hw = 0.6, W / 2
    paint = 'v_truck_yellow'
    cab_end = f + 1.75
    # the cab-over cab: a box with a raked windscreen, a grille, steps
    kit.block(p, -hw, f + 0.05, zb, hw, cab_end, 1.45, paint)
    vlib.greenhouse(p, 1.45, 2.45, f + 0.08, f + 0.3, cab_end - 0.05, cab_end, W, paint, tumble=0.04, pillar=0.12)
    p.box((W - 0.4, 0.04, 0.32), 'v_grille', T(0, f + 0.03, 1.12))
    for k in range(4):
        p.box((W - 0.45, 0.05, 0.03), paint, T(0, f + 0.02, 1.0 + k * 0.08))
    vlib.lamp_pair(p, f + 0.05, 0.92, hw - 0.25, w=0.3, h=0.16)
    vlib.bumper(p, f, zb + 0.12, W + 0.02, h=0.22, mat='v_trim')
    vlib.plate(p, f - 0.09, zb + 0.12)
    for s in (-1, 1):
        kit.block(p, s * hw - (0.3 if s > 0 else -0.3), f + 0.65, zb - 0.1, s * hw, f + 1.05, zb - 0.04, 'v_trim')
    vlib.door_lines(p, hw, (f + 0.3, cab_end - 0.1), zb + 0.1, 1.42)
    vlib.mirrors(p, hw, f + 0.3, 1.9, arm=0.25, size=(0.04, 0.12, 0.3))
    vlib.wipers(p, f + 0.06, 1.55, x=0.6, length=0.6, tilt=60)
    # chassis and the box with its ribs and back doors
    for s in (-1, 1):
        kit.block(p, s * 0.45 - 0.07, cab_end - 0.1, zb - 0.05, s * 0.45 + 0.07, r - 0.1, zb + 0.15, 'v_trim')
    bx0, bz0, bz1 = cab_end + 0.12, zb + 0.25, 3.15
    kit.block(p, -hw - 0.05, bx0, bz0, hw + 0.05, r, bz1, 'v_box_cream')
    for s in (-1, 1):
        for k in range(8):
            y = bx0 + 0.1 + k * (r - bx0 - 0.2) / 7
            p.box((0.03, 0.06, bz1 - bz0), 'concrete_light', T(s * (hw + 0.06), y, (bz0 + bz1) / 2))
        p.box((0.04, r - bx0, 0.08), 'v_chrome', T(s * (hw + 0.07), (bx0 + r) / 2, bz0 + 0.05))
    p.box((0.03, 0.03, bz1 - bz0 - 0.1), 'v_trim', T(0, r + 0.01, (bz0 + bz1) / 2))
    for s in (-1, 1):
        for z in (bz0 + 0.5, bz1 - 0.5):
            p.box((0.06, 0.03, 0.12), 'v_chrome', T(s * 0.15, r + 0.02, z))
        p.box((0.04, 0.03, bz1 - bz0 - 0.2), 'v_chrome', T(s * 0.25, r + 0.02, (bz0 + bz1) / 2))
    vlib.lamp_pair(p, r, zb + 0.15, hw - 0.15, facing=1, w=0.16, h=0.12, mat='red_light')
    vlib.plate(p, r + 0.02, zb + 0.15, facing=1)
    fy, ry = f + 0.85, r - 1.35
    v.wheel(vlib.car_wheel(wr, 0.26, spokes=4), wr, [(s * (hw - 0.18), fy, wr) for s in (-1, 1)])
    v.wheel(vlib.car_wheel(wr, 0.5, spokes=4), wr, [(s * (hw - 0.3), ry, wr) for s in (-1, 1)])


@vehicle('motorcycle_taxi', 'วินมอเตอร์ไซค์', 'Motorcycle taxi', cls='small',
         paints=('v_cub_blue', 'v_red', 'v_navy', 'v_maroon', 'v_silver'), slow=0.95)
def motorcycle_taxi(v):
    seat = vbodies.step_through(v, 'v_cub_blue', shield='v_cub_blue')
    vbodies.rider_on_motorcycle(v.body, seat, shirt='v_shirt', pants='v_jeans', head='helmet', vest='v_vest',
                                hat_mat='v_helmet')


@vehicle('motorcycle_helmet', 'รถจักรยานยนต์', 'Motorcycle', cls='small',
         paints=('v_red', 'v_navy', 'v_cub_blue', 'v_silver', 'v_green_dark', 'iron'), slow=0.95)
def motorcycle_helmet(v):
    seat = vbodies.step_through(v, 'v_red', shield='v_red', rack=False)
    vbodies.rider_on_motorcycle(v.body, seat, shirt='v_shirt_blue', pants='v_jeans', head='helmet',
                                hat_mat='v_helmet_red',
                                pillion={'shirt': 'v_pink', 'pants': 'v_jeans', 'head': 'bare', 'lean': -2})


@vehicle('bus', 'รถเมล์ปรับอากาศ', 'Air-conditioned bus', cls='heavy')
def bus(v):
    vbodies.bus(v, 'v_orange', L=10.6, windows=6, vents=0, aircon=True, front_glass=1.4, rounded=0.3)
