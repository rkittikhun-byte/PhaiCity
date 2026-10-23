# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 2, the market town (assets/concept/era2_C_vehicles.jpg): the red bus with its cream band and green stripe, the
red songthaew on a pickup, the samlor (สามล้อถีบ) with its folding hood, the step-through motorcycle, and an early
bonneted truck with a wooden body. Regional: the south's wooden รถโพถ้อง bus and Isan's อีแต๋น farm wagon. (The
steam engine is the railway's.)"""

from mathutils import Vector

import vbodies
import vlib
from lib import kit
from lib.mesh import Part, R, S, T

from . import era1, registry

VEHICLES, vehicle = registry(2)

SONGTHAEW_PAINTS = ('v_red', 'v_sky', 'v_bus_green', 'v_white_car', 'v_tuk_yellow')


@vehicle('bus', 'รถเมล์แดง', 'Red bus', cls='heavy')
def bus(v):
    vbodies.bus(v, 'v_bus_red', L=10.4, band='v_cream', stripe='v_bus_green', windows=8, vents=3)


def songthaew_back(p, paint, y0, y1, W, belt, roof, zb, wood=False):
    """A songthaew's covered back (สองแถว): benches along both sides, open windows, a roof with a rack, a step and
    grab rails at the open back."""
    hw = W / 2
    top = roof + 0.25
    # lower sides over the bed, upper panels with open windows, the roof
    for s in (-1, 1):
        kit.block(p, s * hw - (0.05 if s > 0 else -0.05), y0, zb + 0.1, s * hw, y1, belt + 0.08,
                  'v_wood_bus' if wood else paint)
        kit.block(p, s * hw - (0.05 if s > 0 else -0.05), y0, top - 0.32, s * hw, y1, top,
                  'v_wood_bus' if wood else paint)
        n = 3
        for k in range(n + 1):
            y = y0 + (y1 - y0) * k / n
            p.box((0.06, 0.08, top - belt), 'v_wood_light' if wood else paint, T(s * (hw - 0.03), y, (top + belt) / 2))
        p.box((0.02, y1 - y0, top - belt - 0.4), 'window_dark', T(s * (hw - 0.07), (y0 + y1) / 2, belt + 0.3))
        # the benches inside along the sides
        kit.block(p, s * (hw - 0.45), y0 + 0.1, zb + 0.4, s * (hw - 0.07), y1 - 0.15, zb + 0.48, 'v_seat')
    kit.block(p, -hw - 0.04, y0 - 0.55, top - 0.04, hw + 0.04, y1 + 0.05, top + 0.05, paint)
    # roof rack
    for s in (-1, 1):
        p.rod((s * (hw - 0.1), y0 - 0.3, top + 0.25), (s * (hw - 0.1), y1 - 0.15, top + 0.25), 0.02, 'v_chrome', seg=4)
    for k in range(5):
        y = y0 - 0.3 + (y1 - y0 + 0.15) * k / 4
        p.rod((-hw + 0.1, y, top + 0.1), (-hw + 0.1, y, top + 0.25), 0.015, 'v_chrome', seg=3)
        p.rod((hw - 0.1, y, top + 0.1), (hw - 0.1, y, top + 0.25), 0.015, 'v_chrome', seg=3)
        p.rod((-hw + 0.1, y, top + 0.25), (hw - 0.1, y, top + 0.25), 0.015, 'v_chrome', seg=3)
    # the open back: step, grab rails, the floor's edge
    kit.block(p, -hw + 0.1, y1 - 0.02, zb - 0.05, hw - 0.1, y1 + 0.35, zb + 0.0, 'v_chrome')
    for s in (-1, 1):
        p.rod((s * (hw - 0.12), y1 + 0.02, zb + 0.4), (s * (hw - 0.12), y1 + 0.02, top - 0.1), 0.022, 'v_chrome', seg=5)
    p.box((W - 0.1, 0.05, belt - zb - 0.1), 'v_wood_bus' if wood else paint, T(0, y1 - 0.02, (belt + zb) / 2 + 0.05))
    return top


@vehicle('songthaew', 'รถสองแถว', 'Songthaew', cls='car', paints=SONGTHAEW_PAINTS)
def songthaew(v):
    d = vbodies.pickup(v, 'v_red', L=5.05, W=1.74, bed=False)
    p = v.body
    songthaew_back(p, 'v_red', d['cab_back'] + 0.04, d['r'], 1.82, d['belt'], d['roof'], d['zb'])
    vlib.lamp_pair(p, d['r'] + 0.36, d['zb'] + 0.25, 0.75, facing=1, w=0.1, h=0.18, mat='red_light')
    vlib.plate(p, d['r'] + 0.36, d['zb'] + 0.1, facing=1)


@vehicle('samlor', 'สามล้อถีบ', 'Samlor', cls='cart', paints=('v_red', 'v_tuk_blue', 'v_bus_green', 'v_maroon'),
         slow=0.45)
def samlor(v):
    p = v.body
    paint = 'v_red'
    wr, fy, ay, track = 0.33, -1.05, 0.55, 0.52
    # the front: a bicycle's fork and the rider's saddle on a frame back to the passenger's chassis
    head_t, head_b = Vector((0, fy + 0.14, 1.0)), Vector((0, fy + 0.1, 0.78))
    p.rod(head_t, head_b, 0.024, 'iron', seg=6)
    for s in (-1, 1):
        p.rod(head_b + Vector((s * 0.03, 0, 0)), Vector((s * 0.05, fy, wr)), 0.014, 'iron', seg=5)
    saddle = Vector((0, -0.38, 0.95))
    bb = Vector((0, -0.25, 0.35))
    for a, b in ((head_b, bb), (head_t, saddle + Vector((0, 0, -0.08))), (saddle + Vector((0, 0, -0.08)), bb),
                 (bb, Vector((0, ay - 0.15, 0.42))), (saddle + Vector((0, 0, -0.08)), Vector((0, ay - 0.25, 0.62)))):
        p.rod(a, b, 0.022, 'iron', seg=6)
    p.box((0.16, 0.26, 0.06), 'v_seat', T(saddle.x, saddle.y, saddle.z), bevel=0.02)
    p.cyl(0.04, 0.04, 0.06, 'lamp', T(0, fy + 0.06, 0.92) @ R(90, 0, 0), seg=8)
    stem = head_t + Vector((0, 0, 0.08))
    for s in (-1, 1):
        p.polyline([stem, stem + Vector((s * 0.2, 0.0, 0.0)), stem + Vector((s * 0.28, 0.13, 0.0))], 0.012, 'v_chrome',
                   seg=4, joints=False)
    p.box((0.01, ay - bb.y, 0.015), 'v_trim', T(0.07, (bb.y + ay) / 2, (bb.z + wr) / 2))
    v.wheel(era1.crank_part(), wr * era1.GEAR, [tuple(bb)])
    # the passenger's chassis: an axle frame, the seat box, back and sides, a footboard
    kit.block(p, -track - 0.05, ay - 0.2, 0.4, track + 0.05, ay + 0.15, 0.46, 'iron')
    kit.block(p, -0.42, ay - 0.6, 0.42, 0.42, ay - 0.2, 0.47, 'plank')
    kit.block(p, -0.46, ay - 0.25, 0.47, 0.46, ay + 0.32, 0.66, paint)
    kit.block(p, -0.43, ay - 0.22, 0.66, 0.43, ay + 0.25, 0.74, 'v_seat_tan')
    kit.block(p, -0.46, ay + 0.25, 0.66, 0.46, ay + 0.34, 1.22, paint)
    kit.block(p, -0.42, ay + 0.2, 0.74, 0.42, ay + 0.26, 1.15, 'v_seat_tan')
    for s in (-1, 1):
        kit.hull(p, [(s * 0.46, ay - 0.25, 0.66), (s * 0.5, ay - 0.25, 0.66), (s * 0.46, ay + 0.34, 0.66),
                     (s * 0.5, ay + 0.34, 0.66), (s * 0.46, ay - 0.12, 0.92), (s * 0.5, ay - 0.12, 0.92),
                     (s * 0.46, ay + 0.34, 1.0), (s * 0.5, ay + 0.34, 1.0)], paint)
        p.cap(wr + 0.05, paint, T(s * track, ay, wr) @ S(0.2, 1, 1), keep=lambda co: co.z > wr * 0.5, seg=12, rings=6)
    # the folding hood (ประทุน): canvas over three ribs
    hood = 'v_drone_grey'
    pts = [(ay + 0.35, 1.18), (ay + 0.3, 1.62), (ay + 0.1, 1.86), (ay - 0.25, 1.92), (ay - 0.48, 1.84)]
    for i in range(len(pts) - 1):
        (ya, za), (yb, zb) = pts[i], pts[i + 1]
        kit.slab(p, (-0.5, ya, za), (0.5, ya, za), (0.5, yb, zb), (-0.5, yb, zb), 0.03, hood)
    for k, (yy, zz) in enumerate(pts[1:]):
        for s in (-1, 1):
            p.rod((s * 0.5, ay + 0.0, 0.95), (s * 0.51, yy, zz), 0.012, 'iron', seg=3)
    for s in (-1, 1):
        kit.slab(p, (s * 0.5, ay + 0.35, 1.18), (s * 0.5, ay + 0.3, 1.62), (s * 0.5, ay + 0.1, 1.86),
                 (s * 0.5, ay + 0.34, 1.86), 0.02, hood)
    # the rider and a passenger with a basket
    vlib.figure(p, (0, saddle.y + 0.02, saddle.z + 0.07), [(-0.27, fy + 0.27, 1.08), (0.27, fy + 0.27, 1.08)],
                [(-0.14, bb.y - 0.14, 0.24), (0.14, bb.y + 0.1, 0.42)], shirt='v_shirt', pants='v_pants',
                head='hat', lean=20, pedal=(v, wr * era1.GEAR))
    vlib.figure(p, (0.1, ay + 0.02, 0.8), [(-0.1, ay - 0.3, 0.95), (0.35, ay - 0.15, 0.88)],
                [(-0.05, ay - 0.5, 0.5), (0.22, ay - 0.5, 0.5)], shirt='v_pink', pants='v_sarong', head='bare',
                lean=-4, sarong=True)
    p.cyl(0.15, 0.12, 0.16, 'bamboo', T(-0.25, ay - 0.05, 0.82), seg=8)
    v.wheel(vlib.spoke_wheel(wr, 0.04, 12), wr, [(0, fy, wr), (-track, ay, wr), (track, ay, wr)])


@vehicle('motorcycle', 'รถเครื่องรุ่นแรก', 'Step-through motorcycle', cls='small',
         paints=('v_cub_blue', 'v_red', 'v_bus_green', 'v_maroon', 'v_sky'), slow=0.9)
def motorcycle(v):
    seat = vbodies.step_through(v, 'v_cub_blue')
    vbodies.rider_on_motorcycle(v.body, seat, shirt='v_shirt_blue', pants='v_pants', head='bare')


@vehicle('truck', 'รถบรรทุกหัวยาว', 'Early truck', cls='heavy', paints=('v_bus_green', 'v_sky', 'v_red', 'v_tuk_yellow'),
         slow=0.75)
def truck(v):
    p = v.body
    L, W, wr = 6.8, 2.1, 0.46
    f, r = -L / 2, L / 2
    zb = 0.55
    cab_end = vbodies.truck_front(p, f, W, 'v_bus_green', fender='v_trim')
    # chassis rails and the wooden body (กระบะไม้) with board lines and a tailgate
    for s in (-1, 1):
        kit.block(p, s * 0.45 - 0.07, cab_end - 0.2, zb - 0.05, s * 0.45 + 0.07, r - 0.1, zb + 0.15, 'v_trim')
    bz = zb + 0.32
    kit.block(p, -W / 2, cab_end + 0.08, zb + 0.15, W / 2, r, bz, 'teak_dark')
    hw = W / 2 + 0.03
    for s in (-1, 1):
        kit.block(p, s * hw - (0.06 if s > 0 else -0.06), cab_end + 0.08, bz, s * hw, r, bz + 0.95, 'plank')
        for k in range(4):
            p.box((0.012, r - cab_end - 0.1, 0.02), 'teak_dark', T(s * (hw + 0.005), (cab_end + r) / 2, bz + 0.2 + k * 0.22))
        for k in range(5):
            y = cab_end + 0.15 + k * (r - cab_end - 0.25) / 4
            p.box((0.04, 0.08, 1.0), 'teak_dark', T(s * (hw + 0.01), y, bz + 0.48))
    kit.block(p, -hw, cab_end + 0.08, bz, hw, cab_end + 0.16, bz + 1.4, 'plank')
    kit.block(p, -hw, r - 0.06, bz, hw, r, bz + 0.95, 'plank')
    for k in range(3):
        p.box((W, 0.02, 0.02), 'teak_dark', T(0, r + 0.01, bz + 0.25 + k * 0.25))
    # the load: sacks of rice and a tarpaulin
    vlib.sacks(p, -0.4, cab_end + 0.5, bz, n=6, size=0.5)
    vlib.sacks(p, 0.5, cab_end + 1.9, bz, n=4, size=0.5)
    kit.block(p, -0.85, r - 1.3, bz, 0.85, r - 0.2, bz + 0.55, 'canvas')
    vlib.lamp_pair(p, r, zb + 0.2, W / 2 - 0.15, facing=1, w=0.14, h=0.12, mat='red_light')
    vlib.plate(p, r + 0.02, zb + 0.2, facing=1)
    fy, ry = f + 0.75, r - 1.3
    v.wheel(vlib.car_wheel(wr, 0.26, spokes=4), wr, [(s * (W / 2 - 0.2), fy, wr) for s in (-1, 1)])
    v.wheel(vlib.car_wheel(wr, 0.5, spokes=4), wr, [(s * (W / 2 - 0.3), ry, wr) for s in (-1, 1)])


@vehicle('pothong', 'รถโพถ้อง', 'Wooden bus (south)', cls='heavy', slow=0.7)
def pothong(v):
    """Phuket's wooden-bodied bus (รถโพถ้อง): a truck's bonnet and a wooden passenger body, open windows, painted in
    bright bands, a roof rack with baskets."""
    p = v.body
    L, W, wr = 8.4, 2.3, 0.46
    f, r = -L / 2, L / 2
    zb = 0.55
    cab_end = vbodies.truck_front(p, f, W, 'v_sky', fender='v_trim', cab_len=0.9, roof=2.55)
    y0, top = cab_end - 0.85, 2.75
    hw = W / 2
    bands = ('v_tuk_yellow', 'v_red', 'v_bus_green', 'v_sky')
    kit.block(p, -hw, cab_end, zb + 0.15, hw, r, zb + 0.95, 'v_wood_bus')
    for i, mat in enumerate(bands):
        vlib.side_band(p, hw, cab_end, r, zb + 0.25 + i * 0.17, 0.13, mat)
    for s in (-1, 1):
        kit.block(p, s * hw - (0.06 if s > 0 else -0.06), y0, top - 0.42, s * hw, r, top, 'v_wood_bus')
        vlib.side_band(p, hw, y0, r, top - 0.2, 0.16, 'v_tuk_yellow')
        n = 6
        for k in range(n + 1):
            y = cab_end + (r - cab_end) * k / n
            p.box((0.08, 0.1, top - zb - 0.95), 'v_wood_light', T(s * (hw - 0.03), y, (top + zb + 0.95) / 2))
        p.box((0.02, r - cab_end, top - zb - 1.4), 'window_dark', T(s * (hw - 0.08), (cab_end + r) / 2, zb + 1.6))
        kit.block(p, s * (hw - 0.5), cab_end + 0.2, zb + 0.75, s * (hw - 0.08), r - 0.3, zb + 0.82, 'plank')
    kit.block(p, -hw - 0.06, y0 - 0.1, top, hw + 0.06, r + 0.05, top + 0.1, 'v_red')
    p.box((W * 0.7, 0.05, 0.3), 'sign_cream', T(0, y0 - 0.12, top - 0.2))
    # the rack and a few baskets and sacks on the roof
    for s in (-1, 1):
        p.rod((s * (hw - 0.1), y0, top + 0.3), (s * (hw - 0.1), r - 0.2, top + 0.3), 0.025, 'v_chrome', seg=4)
    for k in range(6):
        y = y0 + (r - 0.2 - y0) * k / 5
        p.rod((s * (hw - 0.1), y, top + 0.1), (s * (hw - 0.1), y, top + 0.3), 0.015, 'v_chrome', seg=3)
        p.rod((-(hw - 0.1), y, top + 0.1), (-(hw - 0.1), y, top + 0.3), 0.015, 'v_chrome', seg=3)
    p.cyl(0.3, 0.25, 0.35, 'bamboo', T(-0.4, y0 + 1.5, top + 0.28), seg=10)
    vlib.sacks(p, 0.4, y0 + 2.5, top + 0.1, n=3, size=0.45)
    p.box((0.9, 0.6, 0.4), 'v_container', T(-0.2, r - 1.2, top + 0.3), bevel=0.05)
    kit.block(p, -hw, r - 0.06, zb + 0.15, hw, r, zb + 0.95, 'v_wood_bus')
    vlib.lamp_pair(p, r, zb + 0.6, hw - 0.15, facing=1, w=0.14, h=0.14, mat='red_light')
    vlib.plate(p, r + 0.02, zb + 0.3, facing=1)
    fy, ry = f + 0.75, r - 1.6
    v.wheel(vlib.car_wheel(wr, 0.26, spokes=4), wr, [(s * (hw - 0.2), fy, wr) for s in (-1, 1)])
    v.wheel(vlib.car_wheel(wr, 0.5, spokes=4), wr, [(s * (hw - 0.3), ry, wr) for s in (-1, 1)])


@vehicle('etan', 'รถอีแต๋น', 'Etan farm wagon (Isan)', cls='cart', slow=0.45)
def etan(v):
    """Isan's อีแต๋น: a single-cylinder engine with its flywheel and radiator on the front axle, a long steering
    column back to the driver's bench, a plank bed behind on a steel frame."""
    p = v.body
    fy, ry, L = -1.55, 1.05, 4.2
    fwr, rwr = 0.3, 0.42
    # steel frame rails from the front axle to the back
    for s in (-1, 1):
        p.rod((s * 0.35, fy, 0.52), (s * 0.55, ry + 0.8, 0.62), 0.04, 'iron', seg=5)
    p.cyl(0.04, 0.04, 1.1, 'iron', T(0, fy, fwr) @ R(0, 90, 0), seg=6)
    # the engine: block, cylinder, the big flywheel, the radiator and its tank, the exhaust
    kit.block(p, -0.3, fy - 0.25, 0.5, 0.3, fy + 0.35, 0.85, 'v_bus_green')
    p.cyl(0.14, 0.14, 0.36, 'v_bus_green', T(0, fy + 0.2, 1.0), seg=8)
    fly = Part('flywheel')
    fly.cyl(0.32, 0.32, 0.08, 'paint_red', R(0, 90, 0), seg=14)
    fly.cyl(0.08, 0.08, 0.1, 'v_hub', T(0.04, 0, 0) @ R(0, 90, 0), seg=6)
    for k in range(3):
        fly.box((0.1, 0.5, 0.06), 'v_engine', R(k * 60, 0, 0) @ T(0.045, 0, 0))
    v.wheel(fly, 0.08, [(0.4, fy + 0.1, 0.78)])
    kit.block(p, -0.28, fy - 0.42, 0.55, 0.28, fy - 0.27, 1.15, 'v_grille')
    p.cyl(0.12, 0.12, 0.5, 'v_bus_green', T(0, fy - 0.35, 1.25) @ R(0, 90, 0), seg=8)
    p.polyline([Vector((-0.2, fy + 0.25, 0.95)), Vector((-0.25, fy + 0.3, 1.45))], 0.04, 'iron', seg=5, joints=False)
    p.cyl(0.06, 0.05, 0.12, 'iron', T(-0.25, fy + 0.3, 1.52), seg=6)
    # front lamp
    p.cyl(0.08, 0.08, 0.05, 'lamp', T(0, fy - 0.45, 1.0) @ R(90, 0, 0), seg=8)
    # the long steering column and the wheel, the driver's bench
    p.rod((0, fy + 0.2, 0.9), (0, -0.25, 1.15), 0.025, 'iron', seg=5)
    p.torus(0.2, 0.02, 'v_rubber', T(0, -0.22, 1.16) @ R(70, 0, 0), seg=12, seg_minor=4)
    kit.block(p, -0.5, -0.05, 0.62, 0.5, 0.35, 0.72, 'plank')
    # the bed: planks and low boards
    y0 = 0.35
    kit.block(p, -0.8, y0, 0.66, 0.8, ry + 0.85, 0.72, 'plank')
    for s in (-1, 1):
        kit.block(p, s * 0.8 - (0.04 if s > 0 else -0.04), y0, 0.72, s * 0.8, ry + 0.85, 1.02, 'teak')
    kit.block(p, -0.8, ry + 0.81, 0.72, 0.8, ry + 0.85, 1.02, 'teak')
    # the load: a few sacks and baskets of sticky rice, a jar
    vlib.sacks(p, -0.2, y0 + 0.3, 0.72, n=4, size=0.42)
    p.cyl(0.2, 0.16, 0.3, 'bamboo', T(0.4, ry + 0.4, 0.88), seg=8)
    p.cyl(0.22, 0.18, 0.45, 'jar', T(-0.35, ry + 0.45, 0.95), seg=8)
    vlib.figure(p, (0, 0.15, 0.78), [(-0.18, -0.24, 1.18), (0.18, -0.2, 1.16)],
                [(-0.16, -0.35, 0.55), (0.16, -0.35, 0.55)], shirt='v_mohom', pants='v_pakoma', head='scarf',
                lean=6)
    v.wheel(vlib.car_wheel(fwr, 0.16, spokes=3), fwr, [(s * 0.5, fy, fwr) for s in (-1, 1)])
    v.wheel(vlib.car_wheel(rwr, 0.24, spokes=4), rwr, [(s * 0.7, ry, rwr) for s in (-1, 1)])
