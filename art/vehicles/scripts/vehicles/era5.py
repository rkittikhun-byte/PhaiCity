# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 5, the future city (assets/concept/era5_C_vehicles.jpg): the rounded driverless shuttle in orange and green,
the flying taxi on four ducted rotors, the cargo drone carrying a container, the three-wheeled bubble car; and beside
them a sleek electric car and an electric scooter. (The maglev is the railway's.)"""

import math

from mathutils import Vector

import vbodies
import vlib
from lib import kit
from lib.mesh import R, S, T

from . import registry

VEHICLES, vehicle = registry(5)


def rounded_box(p, x0, y0, z0, x1, y1, z1, rr, mat):
    """A box with every edge chamfered by rr (a convex hull of its corners pulled in)."""
    pts = []
    for x in (x0, x1):
        for y in (y0, y1):
            for z in (z0, z1):
                dx, dy, dz = (rr if x == x0 else -rr), (rr if y == y0 else -rr), (rr if z == z0 else -rr)
                pts += [(x + dx, y, z + dz * 0.6), (x, y + dy, z + dz * 0.6), (x + dx * 0.6, y + dy * 0.6, z)]
    kit.hull(p, pts, mat)


@vehicle('pod_bus', 'รถรับส่งไร้คนขับ', 'Driverless shuttle', cls='heavy', paints=('v_pod_green', 'v_sky', 'v_pod_gold'))
def pod_bus(v):
    p = v.body
    L, W, H, wr = 6.2, 2.2, 2.75, 0.4
    f, r = -L / 2, L / 2
    zb, hw = 0.3, W / 2
    rounded_box(p, -hw, f, zb, hw, r, 1.05, 0.25, 'v_pod_orange')
    # the glass sides and ends, the green waist, the orange roof with its sensor dome
    rounded_box(p, -hw + 0.06, f + 0.08, 1.0, hw - 0.06, r - 0.08, H - 0.35, 0.35, 'v_glass')
    rounded_box(p, -hw, f + 0.02, 0.95, hw, r - 0.02, 1.2, 0.15, 'v_pod_green')
    rounded_box(p, -hw - 0.01, f + 0.1, H - 0.42, hw + 0.01, r - 0.1, H, 0.3, 'v_pod_orange')
    p.box((W - 0.5, L - 1.4, 0.1), 'v_pod_gold', T(0, 0, H + 0.03), bevel=0.04)
    p.sphere(0.18, 'screen', T(0, f + 0.7, H + 0.1) @ S(1, 1, 0.6), seg=10, rings=5)
    # window posts and the doors on the left (+X), a light line round the waist
    for s in (-1, 1):
        for k in range(5):
            y = f + 0.8 + k * (L - 1.6) / 4
            p.box((0.05, 0.1, H - 1.5), 'v_pod_green', T(s * (hw - 0.04), y, (H + 1.1) / 2 - 0.05))
        p.box((0.02, L - 0.6, 0.05), 'v_neon', T(s * (hw + 0.005), 0, 1.22))
    p.box((0.04, 1.4, H - 0.8), 'v_trim', T(hw + 0.01, 0.2, (H - 0.6) / 2 + 0.3))
    p.box((0.05, 0.03, H - 0.9), 'v_pod_gold', T(hw + 0.03, 0.2, (H - 0.6) / 2 + 0.3))
    # both ends alike (it drives either way): a lamp band, a screen, a plate
    for end, facing in ((f, -1), (r, 1)):
        p.box((W - 0.5, 0.04, 0.08), 'lamp' if facing < 0 else 'red_light', T(0, end + facing * 0.015, 0.78))
        p.box((W * 0.5, 0.04, 0.2), 'screen_lit', T(0, end + facing * 0.08, H - 0.55))
        vlib.plate(p, end + facing * 0.01, 0.5, facing=facing)
    for y in (f + 1.2, r - 1.2):
        vlib.arch(p, y, wr, wr + 0.08, hw + 0.005, mat='v_pod_gold')
    v.wheel(vlib.car_wheel(wr, 0.24, rim='v_pod_gold', spokes=2), wr,
            [(s * (hw - 0.12), y, wr) for y in (f + 1.2, r - 1.2) for s in (-1, 1)])


@vehicle('ev_pod', 'รถไฟฟ้าแคปซูล', 'Three-wheeled bubble car', cls='cart',
         paints=('v_ev_blue', 'v_pod_orange', 'v_white_car', 'v_pod_green'), slow=0.85)
def ev_pod(v):
    p = v.body
    L, wr = 2.6, 0.28
    # a bubble body, the glass front and roof, a gold line round it
    p.sphere(1.0, 'v_ev_blue', T(0, 0.05, 0.85) @ S(0.68, L / 2, 0.72), seg=16, rings=10)
    p.cap(1.0, 'v_glass', T(0, -0.02, 0.88) @ S(0.62, L / 2 - 0.05, 0.68),
          keep=lambda co: co.z > 1.05 and co.y < 0.6, seg=16, rings=10)
    kit.block(p, -0.5, -0.85, 0.16, 0.5, 0.9, 0.36, 'v_ev_navy')
    pts = [Vector((0.69 * math.cos(a), (L / 2) * math.sin(a) + 0.05, 0.92)) for a in
           [math.radians(-80 + 10 * k) for k in range(17)]]
    p.polyline(pts, 0.018, 'v_pod_gold', seg=4, joints=False)
    p.polyline([Vector((-q.x, q.y, q.z)) for q in pts], 0.018, 'v_pod_gold', seg=4, joints=False)
    p.box((0.7, 0.04, 0.06), 'v_neon', T(0, -1.27, 0.75) @ R(-20, 0, 0))
    p.box((0.6, 0.04, 0.06), 'red_light', T(0, 1.33, 0.8) @ R(20, 0, 0))
    # door seam and the two front wheels' fairings
    for s in (-1, 1):
        p.box((0.01, 0.02, 0.8), 'v_trim', T(s * 0.68, 0.25, 0.75))
        p.cap(wr + 0.06, 'v_ev_navy', T(s * 0.62, -0.7, wr) @ S(0.3, 1, 1), keep=lambda co: co.z > wr * 0.3, seg=12,
              rings=6)
    vlib.plate(p, 1.12, 0.32, w=0.26, h=0.1, facing=1)
    v.wheel(vlib.car_wheel(wr, 0.15, rim='v_pod_gold', spokes=2), wr, [(s * 0.66, -0.7, wr) for s in (-1, 1)])
    v.wheel(vlib.car_wheel(wr, 0.18, rim='v_pod_gold', spokes=2), wr, [(0, 0.85, wr)])


@vehicle('ev_car', 'รถยนต์ไฟฟ้า', 'Electric car', cls='car',
         paints=('v_white_car', 'v_ev_blue', 'v_silver', 'v_ev_navy', 'v_pod_orange', 'iron'))
def ev_car(v):
    d = vbodies.car(v, 'v_white_car', 'ev', wr=0.33, light_bar=True, roof_mat='v_glass')
    v.body.box((0.02, d['r'] - d['f'] - 0.6, 0.03), 'v_trim', T(d['W'] / 2 + 0.005, 0, d['zb'] + 0.2))


@vehicle('ev_scooter', 'สกู๊ตเตอร์ไฟฟ้า', 'Electric scooter', cls='small',
         paints=('v_drone_grey', 'v_pod_orange', 'v_ev_blue', 'v_pod_green'), slow=0.9)
def ev_scooter(v):
    seat = vbodies.step_through(v, 'v_drone_grey', shield='v_drone_grey', seat='v_trim', rack=False, wr=0.25, wb=1.25)
    v.body.box((0.3, 0.04, 0.05), 'v_neon', T(0, -0.43, 1.0))
    vbodies.rider_on_motorcycle(v.body, seat, wb=1.25, shirt='v_shirt', pants='v_jeans', head='helmet',
                                hat_mat='v_helmet_dark')


def arms_and_rotors(v, p, centre_z, span, rr, arm_mat='v_drone_navy'):
    pos = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            tip = Vector((sx * span * 0.62, sy * span * 0.5, centre_z + 0.25))
            p.rod((sx * 0.4, sy * 0.4, centre_z), tip, 0.06, arm_mat, seg=6)
            p.cyl(0.12, 0.1, 0.28, arm_mat, T(*tip) @ T(0, 0, -0.06), seg=8)
            pos.append((tip.x, tip.y, tip.z + 0.1))
    v.wheel(vlib.rotor(rr), rr, pos, axis='z')


@vehicle('flying_taxi', 'แท็กซี่บินได้', 'Flying taxi', cls='flyer', fly=16.0)
def flying_taxi(v):
    p = v.body
    # a capsule cabin, glass up front, a navy band and skids
    p.sphere(1.0, 'v_white_car', T(0, 0, 1.0) @ S(0.85, 2.0, 0.8), seg=16, rings=10)
    p.cap(1.0, 'v_glass', T(0, -0.05, 1.03) @ S(0.8, 1.95, 0.76), keep=lambda co: co.z > 1.15 and co.y < 0.9,
          seg=16, rings=10)
    p.cap(1.0, 'v_drone_navy', T(0, 0, 0.98) @ S(0.87, 2.02, 0.8), keep=lambda co: co.z < 0.7, seg=16, rings=10)
    p.box((0.2, 0.6, 0.04), 'v_neon', T(0, -1.6, 0.95) @ R(-30, 0, 0))
    for s in (-1, 1):
        p.box((0.02, 1.0, 0.7), 'v_glass', T(s * 0.85, 0.2, 1.15))
        p.rod((s * 0.45, -0.9, 0.1), (s * 0.45, 0.9, 0.1), 0.04, 'v_drone_navy', seg=5)
        for y in (-0.6, 0.6):
            p.rod((s * 0.45, y, 0.1), (s * 0.35, y, 0.45), 0.03, 'v_drone_navy', seg=4)
    arms_and_rotors(v, p, 1.35, 4.6, 0.75)


@vehicle('cargo_drone', 'โดรนขนของ', 'Cargo drone', cls='flyer', fly=26.0)
def cargo_drone(v):
    p = v.body
    # the body, its green lamp, the grab arms and the container under it
    rounded_box(p, -0.5, -1.3, 2.2, 0.5, 1.3, 2.75, 0.18, 'v_drone_navy')
    p.box((0.3, 0.04, 0.08), 'v_neon', T(0, -1.31, 2.45))
    p.box((0.3, 0.04, 0.08), 'v_neon', T(0, 1.31, 2.45))
    for sy in (-1, 1):
        for sx in (-1, 1):
            p.rod((sx * 0.35, sy * 0.9, 2.2), (sx * 0.65, sy * 0.95, 1.95), 0.04, 'v_drone_navy', seg=4)
    kit.block(p, -0.75, -1.15, 0.0, 0.75, 1.15, 1.95, 'v_container')
    for s in (-1, 1):
        for k in range(9):
            y = -1.05 + k * 0.26
            p.box((0.03, 0.07, 1.85), 'v_container_dark', T(s * 0.765, y, 0.975))
    for y in (-1.15, 1.15):
        p.box((1.5, 0.03, 0.1), 'v_container_dark', T(0, y, 1.9))
        p.box((1.5, 0.03, 0.1), 'v_container_dark', T(0, y, 0.05))
    arms_and_rotors(v, p, 2.55, 4.2, 0.85)
