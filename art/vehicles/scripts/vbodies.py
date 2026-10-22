# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Bodies more than one era builds on: the pickup (a songthaew is a pickup with a covered back), the box bus, the
step-through motorcycle, the bonneted truck front. Every one faces -Y, its origin the middle of its footprint."""

from mathutils import Vector

import vlib
from lib import kit
from lib.mesh import R, S, T


# pickup ---------------------------------------------------------------------------------------------------------------

def pickup(v, paint, L=5.0, W=1.72, cab='single', modern=False, bed=True, grille='v_grille', wr=0.36):
    """A one-tonne pickup (กระบะ): bonnet, cab, and a bed (or nothing behind the cab, bed=False, for a songthaew's
    passenger body). modern: the rounded nose and bigger glass of eras 4-5. Returns where the cab ends (y)."""
    p = v.body
    f, r = -L / 2, L / 2
    zb = 0.42
    belt = 1.08 if not modern else 1.12
    roof = 1.74 if not modern else 1.82
    cab_back = -0.25 if cab == 'single' else 0.55
    cowl = f + 1.35
    # nose and cab lower: one profile
    nose = [(f, zb + 0.05), (f - 0.02, zb + 0.42), (f + 0.06, belt - 0.12 if not modern else belt - 0.18),
            (f + 0.25, belt - 0.06), (cowl, belt), (cab_back, belt), (cab_back, zb), (f + 0.1, zb)]
    if modern:
        nose = [(f, zb + 0.08), (f - 0.03, zb + 0.4), (f + 0.08, belt - 0.2), (f + 0.45, belt - 0.07),
                (cowl, belt), (cab_back, belt), (cab_back, zb), (f + 0.12, zb)]
    vlib.shell(p, nose, W, paint)
    # cab glass, roof and pillars
    vlib.greenhouse(p, belt, roof, cowl + 0.02, cowl + (0.48 if not modern else 0.62), cab_back - 0.08,
                    cab_back - 0.02, W, paint, bs=(cab_back - 0.62,) if cab == 'double' else ())
    rear_end = cab_back
    if bed:
        bz = zb + 0.32
        kit.block(p, -W / 2 + 0.06, cab_back + 0.03, bz - 0.05, W / 2 - 0.06, r - 0.05, bz + 0.02, 'v_trim')
        for s in (-1, 1):
            kit.block(p, s * W / 2 - (0.06 if s > 0 else -0.06), cab_back + 0.03, zb, s * W / 2, r, belt, paint)
            p.box((0.07, r - cab_back, 0.04), 'v_trim', T(s * (W / 2 - 0.03), (cab_back + r) / 2, belt + 0.02))
        kit.block(p, -W / 2, r - 0.06, zb, W / 2, r, belt, paint)
        kit.block(p, -W / 2, cab_back + 0.03, zb, W / 2, cab_back + 0.09, belt + 0.05, paint)
        kit.block(p, -W / 2 + 0.06, cab_back + 0.09, zb, W / 2 - 0.06, r - 0.06, bz - 0.05, paint)
        # tailgate handle, tail lamps, rear bumper and plate
        p.box((0.3, 0.02, 0.05), 'v_trim', T(0, r + 0.01, belt - 0.12))
        vlib.lamp_pair(p, r, belt - 0.22, W / 2 - 0.08, facing=1, w=0.1, h=0.26, mat='red_light')
        vlib.bumper(p, r + 0.06, zb + 0.06, W - 0.05, mat='v_chrome' if not modern else 'v_trim')
        vlib.plate(p, r + 0.01, zb + 0.32, facing=1)
        rear_end = r
    # front: grille, lamps, bumper, plate, indicators
    p.box((W - 0.5, 0.05, 0.28), grille, T(0, f - 0.01, zb + 0.4))
    for k in range(4):
        p.box((W - 0.55, 0.06, 0.025), 'v_chrome', T(0, f - 0.02, zb + 0.3 + k * 0.065))
    if modern:
        vlib.lamp_pair(p, f + 0.02, zb + 0.52, W / 2 - 0.22, w=0.36, h=0.1)
    else:
        vlib.lamp_pair(p, f, zb + 0.42, W / 2 - 0.16, w=0.24, h=0.17)
    vlib.lamp_pair(p, f, zb + 0.24, W / 2 - 0.1, w=0.1, h=0.06, mat='paint_orange')
    vlib.bumper(p, f - 0.05, zb + 0.06, W + 0.04, mat='v_chrome' if not modern else 'v_trim')
    vlib.plate(p, f - 0.13, zb + 0.06)
    # doors, mirrors, wipers, arches, steps
    vlib.door_lines(p, W / 2, (cowl + 0.08, cab_back - 0.03) if cab == 'single' else
                    (cowl + 0.08, cab_back - 0.62, cab_back - 0.03), zb + 0.08, belt - 0.02)
    vlib.mirrors(p, W / 2 - 0.02, cowl + 0.25, belt + 0.06)
    vlib.wipers(p, cowl + 0.12, belt + 0.06)
    fy, ry = f + 0.95, r - 1.0
    for y in (fy, ry):
        vlib.arch(p, y, wr, wr + 0.08, W / 2 + 0.005)
    v.wheel(vlib.car_wheel(wr, 0.22), wr, [(s * (W / 2 - 0.1), y, wr) for y in (fy, ry) for s in (-1, 1)])
    return {'cab_back': cab_back, 'belt': belt, 'roof': roof, 'f': f, 'r': r, 'zb': zb, 'rear_end': rear_end}


def cage(p, y0, y1, w, z0, z1, mat='v_chrome', bars=6):
    """The steel cage (คอกกระบะ) over a pickup's bed: posts, rails and a front frame higher than the cab."""
    for s in (-1, 1):
        x = s * (w / 2 - 0.03)
        for k in range(bars + 1):
            y = y0 + (y1 - y0) * k / bars
            p.rod((x, y, z0), (x, y, z1), 0.018, mat, seg=4)
        for z in (z0 + (z1 - z0) * 0.45, z1):
            p.rod((x, y0, z), (x, y1, z), 0.02, mat, seg=4)
    for z in (z0 + (z1 - z0) * 0.45, z1):
        p.rod((-w / 2 + 0.03, y0, z), (w / 2 - 0.03, y0, z), 0.02, mat, seg=4)
        p.rod((-w / 2 + 0.03, y1, z), (w / 2 - 0.03, y1, z), 0.02, mat, seg=4)
    for k in range(1, 5):
        x = -w / 2 + w * k / 5
        p.rod((x, y0, z0), (x, y0, z1), 0.016, mat, seg=4)
    # the front frame leans over the cab
    for s in (-1, 1):
        p.rod((s * (w / 2 - 0.03), y0, z1), (s * (w / 2 - 0.06), y0 - 0.55, z1 + 0.12), 0.02, mat, seg=4)
    p.rod((-w / 2 + 0.06, y0 - 0.55, z1 + 0.12), (w / 2 - 0.06, y0 - 0.55, z1 + 0.12), 0.02, mat, seg=4)
    return p


# box bus --------------------------------------------------------------------------------------------------------------

def bus(v, paint, L=10.5, W=2.45, H=3.05, wr=0.5, band=None, stripe=None, lower=None, windows=8, rounded=0.25,
        vents=3, aircon=False, low_floor=False, front_glass=1.25, doors=2, wheel_rim='v_rim'):
    """A city bus (รถเมล์): a box with a rounded roof edge, a two-pane windscreen and its destination board, a row of
    side windows, doors on the left (+X, the kerb side as Thailand drives on the left), and the livery bands."""
    p = v.body
    f, r = -L / 2, L / 2
    zb = 0.45 if not low_floor else 0.3
    belt = 1.35 if not low_floor else 1.15
    hw = W / 2
    # body: a profile with the roof edges rounded
    prof = [(f, zb), (f - 0.02, belt), (f + 0.08, H - rounded), (f + 0.08 + rounded * 0.7, H), (r - rounded * 0.7, H),
            (r, H - rounded), (r, zb)]
    vlib.shell(p, prof, W, paint)
    if rounded > 0.12:
        for s in (-1, 1):
            kit.hull(p, [(s * hw, f + 0.4, H - rounded), (s * (hw - rounded), f + 0.4, H), (s * hw, r - 0.3, H - rounded),
                         (s * (hw - rounded), r - 0.3, H), (s * (hw - 0.4), f + 0.4, H - 0.01),
                         (s * (hw - 0.4), r - 0.3, H - 0.01)], paint)
    if lower:
        vlib.side_band(p, hw, f + 0.05, r - 0.02, zb + (belt - zb) / 2, belt - zb - 0.05, lower)
        p.box((W - 0.05, 0.02, belt - zb - 0.05), lower, T(0, f - 0.025, zb + (belt - zb) / 2))
    if band:
        vlib.side_band(p, hw, f + 0.05, r - 0.02, belt - 0.22, 0.56, band)
        p.box((W - 0.05, 0.02, 0.56), band, T(0, f - 0.025, belt - 0.22))
    if stripe:
        vlib.side_band(p, hw + 0.004, f + 0.05, r - 0.02, belt - 0.06, 0.08, stripe)
    # windscreen in two panes, the destination board above, wipers
    gz0, gz1 = belt + 0.05, belt + 0.05 + front_glass
    for s in (-1, 1):
        p.box((hw - 0.18, 0.04, gz1 - gz0), 'v_glass', T(s * (hw / 2), f - 0.01, (gz0 + gz1) / 2))
    p.box((0.08, 0.05, gz1 - gz0), 'v_trim', T(0, f - 0.015, (gz0 + gz1) / 2))
    p.box((W - 0.3, 0.05, 0.05), 'v_trim', T(0, f - 0.015, gz1 + 0.02))
    p.box((W * 0.62, 0.05, 0.24), 'v_trim', T(0, f + 0.05, gz1 + 0.2))
    p.box((W * 0.58, 0.05, 0.17), 'screen_lit' if aircon else 'sign_cream', T(0, f + 0.03, gz1 + 0.2))
    vlib.wipers(p, f - 0.03, gz0 + 0.08, x=0.6, length=0.7, tilt=0)
    # side windows (behind the door on the left)
    door_y = [f + 0.35, f + L * 0.52] if doors == 2 else [f + 0.35]
    wz0, wz1 = belt + 0.12, belt + (1.05 if not low_floor else 1.25)
    vlib.window_row(p, hw, f + 1.25, r - 0.35, wz0, wz1, windows, sides=(-1,))
    if doors == 2:
        vlib.window_row(p, hw, f + 1.25, door_y[-1] - 0.15, wz0, wz1, max(2, windows // 2 - 1), sides=(1,))
    vlib.window_row(p, hw, (door_y[-1] + 1.2) if doors == 2 else f + 1.25, r - 0.35, wz0, wz1,
                    windows // 2 if doors == 2 else windows, sides=(1,))
    # the driver's window on the right (-X)
    p.box((0.03, 0.8, wz1 - wz0), 'v_glass', T(-hw - 0.02, f + 0.6, (wz0 + wz1) / 2))
    for dy in door_y:
        p.box((0.04, 1.0, H - zb - 0.55), 'v_trim', T(hw + 0.01, dy + 0.5, zb + (H - zb - 0.55) / 2 + 0.05))
        for k in (-1, 1):
            p.box((0.04, 0.42, H - zb - 0.75), 'v_glass', T(hw + 0.025, dy + 0.5 + k * 0.23, zb + (H - zb - 0.55) / 2))
        p.box((0.05, 0.03, H - zb - 0.65), 'v_chrome', T(hw + 0.03, dy + 0.5, zb + (H - zb - 0.55) / 2))
    # back: rear window, lamps, bumper, plate
    p.box((W - 0.5, 0.04, 0.6), 'v_glass', T(0, r + 0.01, H - 0.75))
    vlib.lamp_pair(p, r, belt - 0.4, hw - 0.18, facing=1, w=0.16, h=0.3, mat='red_light')
    vlib.bumper(p, r + 0.06, zb + 0.08, W, h=0.18)
    vlib.plate(p, r + 0.01, zb + 0.4, facing=1)
    # front: lamps, grille, bumper, plate
    vlib.lamp_pair(p, f, zb + 0.45, hw - 0.28, r=0.11)
    vlib.lamp_pair(p, f, zb + 0.45, hw - 0.55, r=0.09)
    p.box((W * 0.45, 0.04, 0.32), 'v_grille', T(0, f - 0.01, zb + 0.5))
    vlib.bumper(p, f - 0.06, zb + 0.1, W + 0.02, h=0.18, mat='v_chrome' if not aircon else 'v_trim')
    vlib.plate(p, f - 0.15, zb + 0.12)
    # bus mirrors on arms ahead of the windscreen
    for s in (-1, 1):
        p.polyline([Vector((s * (hw - 0.1), f + 0.05, gz1 - 0.1)), Vector((s * (hw + 0.15), f - 0.35, gz1 - 0.05)),
                    Vector((s * (hw + 0.12), f - 0.4, gz0 + 0.3))], 0.02, 'v_trim', seg=4, joints=False)
        p.box((0.06, 0.12, 0.32), 'v_mirror', T(s * (hw + 0.12), f - 0.42, gz0 + 0.35))
    # roof: vents, or the air conditioner
    if aircon:
        p.box((W * 0.7, 2.4, 0.26), 'concrete_light', T(0, f + L * 0.35, H + 0.12), bevel=0.06)
        for k in (-1, 1):
            p.cyl(0.32, 0.32, 0.04, 'v_grille', T(0, f + L * 0.35 + k * 0.6, H + 0.26), seg=12)
    for k in range(vents):
        p.box((0.7, 0.7, 0.12), paint, T(0, f + 1.6 + k * (L - 3.0) / max(1, vents - 1 if vents > 1 else 1), H + 0.06),
              bevel=0.04)
    fy, ry = f + 2.2, r - 2.6
    for y in (fy, ry):
        vlib.arch(p, y, wr, wr + 0.1, hw + 0.005)
    v.wheel(vlib.car_wheel(wr, 0.3, rim=wheel_rim, spokes=4), wr,
            [(s * (hw - 0.17), y, wr) for y in (fy, ry) for s in (-1, 1)])
    return {'f': f, 'r': r, 'belt': belt, 'H': H, 'zb': zb}


# step-through motorcycle ----------------------------------------------------------------------------------------------

def step_through(v, paint, shield='v_cub_cream', seat='v_cub_seat', wr=0.29, wb=1.2, rack=True, box=None):
    """The step-through motorcycle (รถเครื่อง, unbranded) of the era 2 and 3 sheets: a leg shield, a spine frame over
    the engine, side covers under the seat, a rack. Wheels at y = -wb/2 and +wb/2. Returns the seat's top."""
    p = v.body
    fy, ry = -wb / 2, wb / 2
    # front fork, fender and the handlebar cowl with its lamp
    head = Vector((0, fy + 0.22, 0.98))
    for s in (-1, 1):
        p.rod((s * 0.06, fy, wr), (s * 0.05, head.y - 0.03, head.z - 0.15), 0.025, 'v_chrome', seg=5)
    p.cap(wr + 0.05, paint, T(0, fy, wr) @ S(0.22, 1, 1), keep=lambda co: co.z > wr * 0.55, seg=12, rings=6)
    p.box((0.62, 0.12, 0.08), paint, T(0, head.y, head.z + 0.04), bevel=0.03)
    p.box((0.2, 0.2, 0.16), paint, T(0, head.y - 0.04, head.z + 0.02), bevel=0.05)
    p.cyl(0.07, 0.07, 0.05, 'lamp', T(0, head.y - 0.15, head.z + 0.02) @ R(90, 0, 0), seg=10)
    for s in (-1, 1):
        p.rod((s * 0.3, head.y, head.z + 0.05), (s * 0.38, head.y + 0.03, head.z + 0.05), 0.02, 'v_rubber', seg=5)
        p.rod((s * 0.18, head.y, head.z + 0.08), (s * 0.24, head.y - 0.02, head.z + 0.36), 0.008, 'v_chrome', seg=3)
        p.cyl(0.04, 0.04, 0.015, 'v_mirror', T(s * 0.25, head.y - 0.02, head.z + 0.38) @ R(90, 0, 0), seg=8)
    # leg shield: a curved panel behind the fork
    kit.hull(p, [(-0.24, fy + 0.3, 0.45), (0.24, fy + 0.3, 0.45), (-0.2, fy + 0.22, 0.92), (0.2, fy + 0.22, 0.92),
                 (-0.14, fy + 0.42, 0.45), (0.14, fy + 0.42, 0.45), (-0.1, fy + 0.34, 0.9), (0.1, fy + 0.34, 0.9)],
             shield)
    # spine and step floor
    p.rod((0, fy + 0.38, 0.62), (0, 0.05, 0.42), 0.06, paint, seg=8)
    p.box((0.34, 0.42, 0.05), 'v_rubber', T(0, -0.05, 0.36))
    # engine, exhaust, footpegs
    p.sphere(0.17, 'v_engine', T(0.0, 0.05, 0.3) @ S(0.9, 1.2, 0.9), seg=10, rings=6)
    p.cyl(0.08, 0.08, 0.16, 'v_engine', T(0, -0.14, 0.33) @ R(70, 0, 0), seg=8)
    p.polyline([Vector((0.06, -0.12, 0.25)), Vector((0.16, 0.05, 0.2)), Vector((0.2, 0.55, 0.28))], 0.03, 'v_chrome',
               seg=5, joints=False)
    p.cyl(0.05, 0.045, 0.4, 'v_chrome', T(0.2, 0.62, 0.3) @ R(84, 0, 0), seg=8)
    # side covers and the body under the seat, rear fender
    kit.hull(p, [(-0.17, 0.05, 0.42), (0.17, 0.05, 0.42), (-0.17, 0.58, 0.48), (0.17, 0.58, 0.48),
                 (-0.15, 0.12, 0.74), (0.15, 0.12, 0.74), (-0.13, 0.7, 0.78), (0.13, 0.7, 0.78),
                 (0, 0.85, 0.66)], paint)
    p.cap(wr + 0.05, paint, T(0, ry, wr) @ S(0.24, 1, 1), keep=lambda co: co.z > wr * 0.45 and co.y > -0.1, seg=12,
          rings=6)
    # seat and grab strap, tail lamp, plate
    kit.hull(p, [(-0.14, 0.1, 0.76), (0.14, 0.1, 0.76), (-0.14, 0.72, 0.8), (0.14, 0.72, 0.8),
                 (-0.12, 0.14, 0.86), (0.12, 0.14, 0.86), (-0.12, 0.68, 0.88), (0.12, 0.68, 0.88)], seat)
    p.box((0.12, 0.06, 0.06), 'red_light', T(0, ry + 0.25, 0.7))
    vlib.plate(p, ry + 0.28, 0.58, w=0.2, h=0.12, facing=1)
    # rear swing arm and shocks
    for s in (-1, 1):
        p.rod((s * 0.08, 0.2, 0.32), (s * 0.08, ry, wr), 0.025, 'v_engine', seg=5)
        p.rod((s * 0.12, ry - 0.08, wr + 0.05), (s * 0.13, ry - 0.2, 0.72), 0.022, 'v_chrome', seg=5)
    if rack:
        for k in range(4):
            p.box((0.26, 0.012, 0.012), 'v_chrome', T(0, 0.75 + k * 0.08, 0.84))
        for s in (-1, 1):
            p.box((0.012, 0.3, 0.012), 'v_chrome', T(s * 0.13, 0.87, 0.84))
    if box:
        p.box((0.42, 0.42, 0.4), box, T(0, 0.9, 1.08), bevel=0.03)
        p.box((0.43, 0.43, 0.04), 'v_trim', T(0, 0.9, 1.27))
    v.wheel(vlib.spoke_wheel(wr, 0.08, 12, drum=True, tyre='v_tyre'), wr, [(0, fy, wr), (0, ry, wr)])
    return 0.88


def rider_on_motorcycle(p, seat_z=0.88, wb=1.2, shirt='v_shirt', pants='v_pants', head='bare', vest=None,
                        hat_mat=None, pillion=None):
    fy = -wb / 2
    hy = fy + 0.22
    vlib.figure(p, (0, 0.28, seat_z + 0.06), [(-0.33, hy + 0.02, 1.03), (0.33, hy + 0.02, 1.03)],
                [(-0.17, -0.12, 0.4), (0.17, -0.12, 0.4)], shirt=shirt, pants=pants, head=head, lean=8,
                vest=vest, hat_mat=hat_mat)
    if pillion:
        vlib.figure(p, (0, 0.62, seat_z + 0.07), [(-0.2, 0.4, 1.12), (0.2, 0.4, 1.12)],
                    [(-0.22, 0.4, 0.38), (0.22, 0.42, 0.38)], **pillion)
    return p


# bonneted truck front -------------------------------------------------------------------------------------------------

def truck_front(p, f, W, paint, cab_len=1.7, hood_len=1.4, zb=0.55, belt=1.45, roof=2.35, fender='v_trim',
                round_nose=True):
    """The old truck's long bonnet with round front fenders, its cab with a split windscreen, the running boards.
    Returns the y where the cab ends."""
    hw = W / 2
    hood_end = f + hood_len
    cab_end = hood_end + cab_len
    # bonnet: narrower than the cab, rounded on top
    hb = 0.42
    kit.hull(p, [(-hb, f + 0.1, zb + 0.3), (hb, f + 0.1, zb + 0.3), (-hb, f + 0.05, belt - 0.15), (hb, f + 0.05, belt - 0.15),
                 (-hb + 0.12, f + 0.15, belt), (hb - 0.12, f + 0.15, belt), (-hb - 0.05, hood_end, zb + 0.3),
                 (hb + 0.05, hood_end, zb + 0.3), (-hb - 0.05, hood_end, belt + 0.05), (hb + 0.05, hood_end, belt + 0.05),
                 (-hb + 0.1, hood_end, belt + 0.15), (hb - 0.1, hood_end, belt + 0.15)], paint)
    # radiator grille with its bars, the round lamps on the fenders
    p.box((hb * 2 - 0.14, 0.04, belt - zb - 0.45), 'v_grille', T(0, f + 0.04, (zb + 0.3 + belt - 0.15) / 2))
    for k in range(6):
        x = -hb + 0.14 + k * (hb * 2 - 0.28) / 5
        p.box((0.025, 0.05, belt - zb - 0.5), 'v_chrome', T(x, f + 0.02, (zb + 0.3 + belt - 0.15) / 2))
    # fenders: quarter round over each front wheel
    for s in (-1, 1):
        x = s * (hw - 0.2)
        if round_nose:
            p.cap(0.62, fender if fender != 'paint' else paint, T(x, f + 0.75, zb + 0.08) @ S(0.42, 1.1, 0.9),
                  keep=lambda co: co.z > -0.02, seg=14, rings=8)
        else:
            kit.block(p, x - 0.22, f + 0.1, zb + 0.35, x + 0.22, f + 1.4, zb + 0.55, fender)
        p.cyl(0.13, 0.11, 0.18, 'v_chrome', T(s * (hb + 0.18), f + 0.2, belt - 0.12) @ R(90, 0, 0), seg=10)
        p.cyl(0.1, 0.1, 0.02, 'lamp', T(s * (hb + 0.18), f + 0.1, belt - 0.12) @ R(90, 0, 0), seg=10)
        # running board to the cab
        kit.block(p, x - 0.2, f + 1.3, zb + 0.08, x + 0.2, cab_end - 0.05, zb + 0.13, 'v_trim')
    vlib.bumper(p, f - 0.05, zb + 0.22, W - 0.1, mat='v_chrome', h=0.16)
    vlib.plate(p, f - 0.12, zb + 0.22)
    # cab
    kit.block(p, -hw, hood_end, zb + 0.15, hw, cab_end, belt, paint)
    vlib.greenhouse(p, belt, roof, hood_end + 0.02, hood_end + 0.18, cab_end - 0.05, cab_end, W, paint, tumble=0.05)
    p.box((0.06, 0.05, roof - belt - 0.05), paint, T(0, hood_end + 0.08, (roof + belt) / 2))
    vlib.door_lines(p, hw, (hood_end + 0.12, cab_end - 0.1), zb + 0.2, belt - 0.05)
    vlib.mirrors(p, hw, hood_end + 0.1, belt + 0.25, arm=0.22, size=(0.04, 0.12, 0.25))
    return cab_end


# car ------------------------------------------------------------------------------------------------------------------

CAR_STYLES = {
    # L, W, belt, roof, nose (cowl from the front), windscreen run, rear glass top and bottom from the back, B pillars
    'sedan': (4.6, 1.78, 0.9, 1.45, 1.2, 0.75, 1.5, 0.95, True),
    'hatch': (3.8, 1.68, 0.92, 1.52, 0.85, 0.7, 0.35, 0.08, True),
    'ev': (4.75, 1.86, 0.88, 1.44, 1.05, 0.95, 1.2, 0.55, False),
}


def car(v, paint, style='sedan', wr=0.31, lamps='lamp', light_bar=False, roof_mat=None):
    """A car (รถเก๋ง): a lower body from a side profile and the glass cabin over it. Returns the dimensions."""
    p = v.body
    L, W, belt, roof, nose, run, rtop, rbot, bpillar = CAR_STYLES[style]
    f, r = -L / 2, L / 2
    zb = 0.3
    cowl = f + nose
    if style == 'hatch':
        prof = [(f, zb + 0.05), (f - 0.02, zb + 0.32), (f + 0.12, belt - 0.12), (f + 0.4, belt - 0.05), (cowl, belt),
                (r - 0.08, belt + 0.02), (r, belt - 0.1), (r + 0.02, zb + 0.3), (r - 0.05, zb)]
    elif style == 'ev':
        prof = [(f, zb + 0.1), (f - 0.03, zb + 0.3), (f + 0.25, belt - 0.15), (cowl, belt), (r - 0.4, belt + 0.04),
                (r, belt - 0.02), (r + 0.02, zb + 0.3), (r - 0.05, zb)]
    else:
        prof = [(f, zb + 0.05), (f - 0.02, zb + 0.3), (f + 0.1, belt - 0.14), (f + 0.4, belt - 0.07), (cowl, belt),
                (r - rbot, belt + 0.02), (r - 0.12, belt - 0.02), (r, belt - 0.12), (r + 0.02, zb + 0.3), (r - 0.05, zb)]
    vlib.shell(p, prof, W, paint)
    yc0 = r - rbot
    yc1 = r - rtop
    mid = (cowl + yc0) / 2
    vlib.greenhouse(p, belt, roof, cowl + 0.02, cowl + run, yc1, yc0, W, paint, bs=(mid,) if bpillar else (),
                    roof_mat=roof_mat, tumble=0.1, pillar=0.08)
    # lamps, grille, bumpers, plates
    if light_bar:
        p.box((W - 0.2, 0.04, 0.05), 'v_neon', T(0, f - 0.01, belt - 0.16))
        p.box((W - 0.2, 0.04, 0.05), 'red_light', T(0, r + 0.02, belt - 0.12))
    else:
        vlib.lamp_pair(p, f + 0.06, belt - 0.2, W / 2 - 0.22, w=0.34, h=0.11, mat=lamps)
        vlib.lamp_pair(p, r + 0.01, belt - 0.2, W / 2 - 0.16, facing=1, w=0.3, h=0.12, mat='red_light')
        p.box((W * 0.38, 0.04, 0.14), 'v_grille', T(0, f - 0.01, zb + 0.32))
    vlib.bumper(p, f + 0.02, zb + 0.1, W - 0.02, depth=0.1, h=0.16, mat=paint if style == 'ev' else 'v_trim')
    vlib.bumper(p, r - 0.02, zb + 0.1, W - 0.02, depth=0.1, h=0.16, mat=paint if style == 'ev' else 'v_trim')
    vlib.plate(p, f - 0.04, zb + 0.16, w=0.34, h=0.11)
    vlib.plate(p, r + 0.04, zb + 0.3, w=0.34, h=0.11, facing=1)
    doors = (cowl + 0.05, mid, yc0 - 0.02) if style != 'hatch' else (cowl + 0.05, yc0 - 0.45)
    vlib.door_lines(p, W / 2, doors, zb + 0.1, belt - 0.03)
    vlib.mirrors(p, W / 2 - 0.08, cowl + 0.22, belt + 0.05, arm=0.12, size=(0.05, 0.1, 0.1))
    fy, ry = f + 0.85 if style != 'hatch' else f + 0.65, r - 0.8 if style != 'hatch' else r - 0.6
    for y in (fy, ry):
        vlib.arch(p, y, wr, wr + 0.07, W / 2 + 0.005)
    v.wheel(vlib.car_wheel(wr, 0.2, spokes=3 if style != 'ev' else 2), wr,
            [(s * (W / 2 - 0.1), y, wr) for y in (fy, ry) for s in (-1, 1)])
    return {'f': f, 'r': r, 'W': W, 'belt': belt, 'roof': roof, 'zb': zb, 'cowl': cowl}
