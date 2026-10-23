# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The vehicle kit: wheels that turn, riders, car bodies from side profiles, lamps, plates, draught animals.

It reuses the era buildings' pipeline (art/buildings/scripts/lib: palette, mesh.Part, kit, scene). Units are metres,
Blender's Z is up and a vehicle faces -Y (its front), its origin the middle of its footprint on the ground; the glTF
export turns that to +Z forward, Y up, as the game's cars drive.

A vehicle's build function gets a V: everything is drawn into v.body (one Part); wheels (and a drone's rotors) are
parts of their own, made once at the origin and placed at each of their positions, so the game can turn them. The
faces in the kind's paint colour (spec 'paints', the first one) are tinted per car in the game.
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BUILDINGS = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'buildings', 'scripts')
if BUILDINGS not in sys.path:
    sys.path.insert(0, BUILDINGS)

from mathutils import Vector  # noqa: E402

from lib import kit, palette  # noqa: E402
from lib.mesh import Part, R, S, T  # noqa: E402

# Vehicle colours, picked from the era vehicle sheets (assets/concept/era*_C_vehicles.jpg); v_ so none clash with the
# buildings' palette. Added to palette.COLORS when this module loads.
VCOLORS = {
    # running gear and trim
    'v_tyre': '#2A2A2E', 'v_rim': '#BFC4C9', 'v_hub': '#8D9399', 'v_chrome': '#DADDE0', 'v_trim': '#2F2F35',
    'v_grille': '#3A3A40', 'v_glass': '#5F6FAE', 'v_glass_light': '#8796CC', 'v_plate': '#F2EEDC',
    'v_plate_ink': '#3A3A44', 'v_seat': '#5A4A44', 'v_seat_tan': '#B47A48', 'v_rubber': '#3A3836',
    'v_mirror': '#2F2F35', 'v_engine': '#5B5E64',
    # paints (the first paint of a kind is tinted per car in the game)
    'v_red': '#D0402E', 'v_bus_red': '#C9392B', 'v_cream': '#EFE2BC', 'v_bus_green': '#4C8A48',
    'v_orange': '#E8742A', 'v_blue_grey': '#5C7E98', 'v_blue_grey_dark': '#45647C', 'v_tuk_blue': '#3E66AE',
    'v_tuk_yellow': '#E8B63C', 'v_tuk_roof': '#4A3B33', 'v_white_car': '#E8E6E0', 'v_silver': '#BCC0C5',
    'v_pale_yellow': '#E8E39C', 'v_truck_yellow': '#E2DC78', 'v_box_cream': '#EEE9BC', 'v_taxi_yellow': '#EFAE2E',
    'v_taxi_green': '#5AA244', 'v_delivery_green': '#3E9A54', 'v_pod_orange': '#DE683A', 'v_pod_green': '#7BAF4A',
    'v_pod_gold': '#E6BC48', 'v_ev_blue': '#3E4E9E', 'v_ev_navy': '#2E3466', 'v_neon': '#78EE66',
    'v_drone_navy': '#394166', 'v_drone_grey': '#C8CCD4', 'v_container': '#B4522E', 'v_container_dark': '#8C3E22',
    'v_cub_blue': '#4C5BA6', 'v_cub_cream': '#E8E2D2', 'v_cub_seat': '#C27838', 'v_navy': '#2E3A5E',
    'v_maroon': '#8E2E2E', 'v_sky': '#7FA9D6', 'v_green_dark': '#3F6E46', 'v_pink': '#E07FA0',
    'v_wood_bus': '#9C5A32', 'v_wood_light': '#C89060', 'v_purple': '#7A5AA6', 'v_lime': '#B8D058',
    # people riding (straw hats, indigo หม้อห้อม, white shirts, the motorcycle taxi's orange vest)
    'v_skin': '#C6855A', 'v_skin_dark': '#A86C46', 'v_hair': '#2A2420', 'v_mohom': '#3A4A7A', 'v_shirt': '#EEE8DA',
    'v_shirt_blue': '#6E8FC0', 'v_shirt_green': '#6E9E6A', 'v_vest': '#E8732A', 'v_helmet': '#E9E4D6',
    'v_helmet_red': '#C0453A', 'v_helmet_dark': '#3A3D48', 'v_hat': '#D8B862', 'v_pants': '#4A4038',
    'v_jeans': '#4E6288', 'v_sarong': '#8E4A6A', 'v_pakoma': '#C0503E',
    # animals
    'v_buffalo': '#4C4C54', 'v_buffalo_dark': '#36363C', 'v_ox': '#C88A52', 'v_ox_dark': '#A86E3E',
    'v_horn': '#D9CEB4', 'v_hoof': '#2E2A28', 'v_muzzle': '#E6D9C4',
}
palette.COLORS.update(VCOLORS)
palette.EMISSIVE.update({'v_neon': 1.6})
# Glow at night in the game (headlamps, tail lights, the future's light strips): the export's `lights` mesh
LIGHT_COLOURS = {'lamp', 'red_light', 'v_neon', 'screen_lit'}

UP = Vector((0, 0, 1))


class V:
    """What a build function draws into: the body and the wheel sets."""

    def __init__(self, spec):
        self.spec = spec
        self.body = Part('body')
        self.wheels = []

    def wheel(self, part, radius, at, axis='x'):
        """A set of wheels (or rotors, axis 'z') of one kind: the part made at the origin, and where each one is. A
        wheel turns by the distance driven over its radius (a crank's radius is the wheel's times its gear)."""
        self.wheels.append({'part': part, 'radius': radius, 'axis': axis, 'motion': 'spin',
                            'at': [tuple(a) for a in at]})
        return self

    def swing(self, part, at, amplitude, phases, stride, axis='x'):
        """A set of parts that swing to and fro about their pivot (legs): the part made with its pivot at the origin,
        each one's pivot, the swing either way (radians), each one's phase (radians) and the distance (m) a cycle."""
        self.wheels.append({'part': part, 'radius': 0.0, 'axis': axis, 'motion': 'swing', 'amplitude': amplitude,
                            'phase': list(phases), 'stride': stride, 'at': [tuple(a) for a in at]})
        return self


# wheels ---------------------------------------------------------------------------------------------------------------

def car_wheel(r=0.33, w=0.22, rim='v_rim', spokes=3, name='wheel'):
    """A tyre with a rim and spokes through it, axle along X; the spokes show it turning. Light (about 110 triangles),
    as the city draws thousands of them."""
    p = Part(name)
    p.cyl(r, r, w, 'v_tyre', R(0, 90, 0), seg=12, smooth=False)
    p.cyl(r * 0.62, r * 0.62, w + 0.02, rim, R(0, 90, 0), seg=8, smooth=False)
    for k in range(spokes):
        p.box((w + 0.05, r * 0.95, r * 0.12), 'v_hub', R(180.0 * k / spokes, 0, 0))
    return p


def spoke_wheel(r=0.34, w=0.04, spokes=14, rim='v_chrome', tyre='v_tyre', name='wheel', drum=False):
    """A bicycle or motorcycle wheel: a thin tyre, the rim and wire spokes."""
    p = Part(name)
    p.torus(r - 0.025, 0.025, tyre, R(0, 90, 0), seg=16, seg_minor=4, smooth=False)
    p.torus(r - 0.055, 0.012, rim, R(0, 90, 0), seg=16, seg_minor=3, smooth=False)
    hub = 0.07 if drum else 0.035
    p.cyl(hub, hub, w + 0.06, 'v_hub' if drum else rim, R(0, 90, 0), seg=8, smooth=False)
    for k in range(spokes):
        a = math.radians(360.0 * k / spokes)
        side = 1 if k % 2 else -1
        p.rod((side * 0.025, math.cos(a) * hub, math.sin(a) * hub),
              (0, math.cos(a + 0.25) * (r - 0.06), math.sin(a + 0.25) * (r - 0.06)), 0.005, rim, seg=3, smooth=False)
    return p


def cart_wheel(r=0.8, w=0.12, spokes=12, name='wheel'):
    """A wooden cart wheel (ล้อเกวียน): a felloe of segments, turned spokes and a big hub."""
    p = Part(name)
    p.torus(r - 0.05, 0.05, 'teak_dark', R(0, 90, 0), seg=20, seg_minor=4, smooth=False)
    p.torus(r - 0.11, 0.035, 'teak', R(0, 90, 0), seg=20, seg_minor=4, smooth=False)
    p.cyl(0.13, 0.11, w + 0.22, 'teak_dark', R(0, 90, 0), seg=10, smooth=False)
    p.cyl(0.06, 0.06, w + 0.3, 'v_hub', R(0, 90, 0), seg=6, smooth=False)
    for k in range(spokes):
        a = 360.0 * k / spokes
        p.box((0.05, 0.055, r - 0.18), 'teak', R(a, 0, 0) @ T(0, 0, (r - 0.18) / 2 + 0.1))
    return p


def rotor(r=1.0, blades=4, duct=True, name='rotor', blade='v_drone_grey', ring='v_drone_navy'):
    """A drone's rotor round Z: blades, a hub and a duct ring as on the era 5 sheet."""
    p = Part(name)
    p.cyl(r * 0.14, r * 0.12, 0.12, ring, None, seg=10, smooth=False)
    for k in range(blades):
        a = 360.0 * k / blades
        p.box((r * 0.86, r * 0.16, 0.025), blade, R(0, 0, a) @ T(r * 0.47, 0, 0.02) @ R(10, 0, 0))
    if duct:
        p.torus(r, 0.05, ring, None, seg=24, seg_minor=4, smooth=False)
    return p


# small parts ----------------------------------------------------------------------------------------------------------

def plate(p, y, z, w=0.36, h=0.12, facing=-1):
    """A blank licence plate with a made-up pattern (no real registration): cream with two dark bars."""
    yy = y + facing * 0.012
    p.box((w, 0.02, h), 'v_plate', T(0, yy, z))
    p.box((w * 0.62, 0.006, h * 0.18), 'v_plate_ink', T(-w * 0.06, yy + facing * 0.012, z + h * 0.16))
    p.box((w * 0.36, 0.006, h * 0.14), 'v_plate_ink', T(w * 0.12, yy + facing * 0.012, z - h * 0.2))
    return p


def lamp_pair(p, y, z, x, r=0.09, mat='lamp', facing=-1, square=False, w=None, h=None):
    """Two lamps on a face at y (front: facing -1, back: +1), x from the middle."""
    for s in (-1, 1):
        if square or w:
            p.box((w or r * 2, 0.04, h or r * 1.4), mat, T(s * x, y + facing * 0.015, z))
        else:
            p.cyl(r, r, 0.05, mat, T(s * x, y + facing * 0.02, z) @ R(90, 0, 0), seg=10, smooth=False)
    return p


def mirrors(p, x, y, z, arm=0.18, size=(0.04, 0.1, 0.14), mat='v_mirror'):
    for s in (-1, 1):
        p.rod((s * x, y, z), (s * (x + arm), y - 0.02, z + 0.05), 0.012, mat, seg=4)
        p.box(size, mat, T(s * (x + arm + size[0] / 2), y - 0.02, z + 0.08))
    return p


def bumper(p, y, z, w, depth=0.16, h=0.14, mat='v_trim'):
    p.box((w, depth, h), mat, T(0, y, z), bevel=0.03)
    return p


def arch(p, y, z, r, half_w, mat='v_trim'):
    """The dark wheel arch on both flanks, a little proud of the body, behind the tyre."""
    for s in (-1, 1):
        p.cyl(r, r, 0.02, mat, T(s * half_w, y, z) @ R(0, 90, 0), seg=14, smooth=False)
    return p


def wipers(p, y, z, x=0.35, length=0.45, tilt=58.0, mat='v_trim'):
    for s in (-1, 1):
        p.box((length, 0.015, 0.015), mat, T(s * x * 0.5, y, z) @ R(tilt, 0, s * 8))
    return p


def door_lines(p, half_w, ys, z0, z1, mat='v_trim'):
    """Shut lines and a handle for each door edge y (on both flanks)."""
    for s in (-1, 1):
        for y in ys:
            p.box((0.008, 0.018, z1 - z0), mat, T(s * (half_w + 0.004), y, (z0 + z1) / 2))
            p.box((0.02, 0.12, 0.03), 'v_chrome', T(s * (half_w + 0.01), y + 0.22, z1 - 0.12))
    return p


def side_band(p, half_w, y0, y1, z, h, mat):
    """A livery band along both flanks."""
    for s in (-1, 1):
        p.box((0.012, abs(y1 - y0), h), mat, T(s * (half_w + 0.006), (y0 + y1) / 2, z))
    return p


# bodies ---------------------------------------------------------------------------------------------------------------

def shell(p, profile_yz, w, mat):
    """A side profile [(y, z), ...] (front at -y) extruded across the width w."""
    return kit.prism_x(p, profile_yz, -w / 2, w / 2, mat)


def greenhouse(p, belt, roof, ya0, ya1, yc1, yc0, w, frame, glass='v_glass', bs=(), roof_mat=None, tumble=0.06,
               pillar=0.09, roof_th=0.07):
    """The cabin above the belt line: glass all round (windscreen from ya0 at the belt to ya1 at the roof, rear glass
    from yc1 to yc0), a roof slab, A and C pillars and B pillars at the ys in bs."""
    wg = w - 2 * tumble
    shell(p, [(ya0, belt), (ya1, roof), (yc1, roof), (yc0, belt)], wg - 0.04, glass)
    rm = roof_mat or frame
    shell(p, [(ya1 - 0.03, roof - roof_th * 0.4), (ya1 + 0.02, roof + roof_th), (yc1 - 0.02, roof + roof_th),
              (yc1 + 0.03, roof - roof_th * 0.4)], wg, rm)
    for s in (-1, 1):
        x0, x1 = s * (wg / 2 - 0.035), s * (wg / 2 + 0.005)
        for (yb, yt) in ((ya0, ya1), (yc0, yc1)):
            d = pillar / 2 * (1 if yb < yt else -1)
            pts = []
            for x in (x0, x1):
                pts += [(x, yb - d, belt), (x, yb + d, belt), (x, yt - d, roof + 0.01), (x, yt + d, roof + 0.01)]
            kit.hull(p, pts, frame)
        for yb in bs:
            f = (yb - ya0) / ((yc0 - ya0) or 1)
            pts = []
            for x in (x0, x1):
                pts += [(x, yb - pillar / 2, belt), (x, yb + pillar / 2, belt),
                        (x, yb - pillar / 2, roof + 0.01), (x, yb + pillar / 2, roof + 0.01)]
            kit.hull(p, pts, frame)
    # the sill along the belt line
    for s in (-1, 1):
        p.box((0.03, abs(yc0 - ya0), 0.05), 'v_trim', T(s * (wg / 2), (ya0 + yc0) / 2, belt + 0.02))
    return p


def window_row(p, half_w, y0, y1, z0, z1, count, glass='v_glass', frame='v_trim', gap=0.12, sides=(-1, 1)):
    """A row of side windows on a box body (a bus, a van): glass panes a little proud, with dark frames."""
    span = (y1 - y0 - gap * (count - 1)) / count
    for s in sides:
        for i in range(count):
            y = y0 + i * (span + gap) + span / 2
            p.box((0.03, span + 0.04, z1 - z0 + 0.04), frame, T(s * (half_w + 0.005), y, (z0 + z1) / 2))
            p.box((0.03, span - 0.04, z1 - z0 - 0.06), glass, T(s * (half_w + 0.02), y, (z0 + z1) / 2))
    return p


# people riding --------------------------------------------------------------------------------------------------------

def _limb(p, a, b, r, mat, r_end=None):
    p.rod(a, b, r, mat, seg=6, r_end=r_end)
    p.sphere(r * 1.05, mat, T(*b), seg=6, rings=4)


def figure(p, hip, hands, feet, shirt='v_shirt', pants='v_pants', head='hat', lean=12.0, skin='v_skin',
           torso_h=0.55, vest=None, hat_mat=None, sarong=False, pedal=None):
    """A seated person (a rider, a driver): hips at hip (x, y, z), hands at hands [(x, y, z) x2], feet at feet
    [(x, y, z) x2]. head: 'hat' a straw hat (งอบ), 'helmet', 'cap', 'bare' or 'scarf'. Low poly, real size (1.6 m).
    pedal=(v, crank_radius): the legs pedal, a part of their own swinging at the hips in turn, a cycle a turn of the
    crank (the distance 2π x crank_radius), the feet's rest the middle of the two given."""
    hx, hy, hz = hip
    tilt = math.radians(lean)
    top = Vector((hx, hy - math.sin(tilt) * torso_h, hz + math.cos(tilt) * torso_h))
    mid = Vector((hx, hy, hz)).lerp(top, 0.5)
    # hips and thighs
    p.sphere(0.17, pants, T(hx, hy, hz + 0.04) @ S(1.1, 0.95, 0.7), seg=8, rings=5)
    p.cyl(0.16, 0.19, torso_h * 0.92, vest or shirt, T(*mid) @ R(-lean, 0, 0) @ S(1.0, 0.72, 1.0), seg=8)
    if vest:
        p.cyl(0.15, 0.17, torso_h * 0.3, shirt, T(*top) @ R(-lean, 0, 0) @ T(0, 0, -0.08) @ S(1.0, 0.72, 1.0), seg=8)
    neck = top + Vector((0, -0.02, 0.06))
    head_c = neck + Vector((0, -0.03, 0.15))
    p.cyl(0.05, 0.05, 0.1, skin, T(*neck), seg=6)
    p.sphere(0.11, skin, T(*head_c) @ S(0.92, 1.0, 1.08), seg=10, rings=7)
    if head == 'hat':
        p.cyl(0.3, 0.04, 0.17, hat_mat or 'v_hat', T(*(head_c + Vector((0, 0, 0.12)))), seg=12, smooth=False)
    elif head == 'helmet':
        p.cap(0.135, hat_mat or 'v_helmet', T(*(head_c + Vector((0, 0.01, 0.015)))), keep=lambda co: co.z > -0.02,
              seg=12, rings=8)
        p.box((0.2, 0.02, 0.06), 'v_glass', T(*(head_c + Vector((0, -0.13, 0.0)))))
    elif head == 'cap':
        p.cap(0.115, hat_mat or 'v_navy', T(*(head_c + Vector((0, 0, 0.03)))), keep=lambda co: co.z > 0.0, seg=10,
              rings=6)
        p.box((0.16, 0.12, 0.02), hat_mat or 'v_navy', T(*(head_c + Vector((0, -0.13, 0.04)))))
    elif head == 'scarf':
        p.cap(0.125, hat_mat or 'v_pakoma', T(*(head_c + Vector((0, 0.01, 0.01)))), keep=lambda co: co.z > -0.04,
              seg=10, rings=6)
    else:
        p.cap(0.115, 'v_hair', T(*(head_c + Vector((0, 0.01, 0.02)))), keep=lambda co: co.z > 0.04 or co.y > 0.05,
              seg=10, rings=6)
    # arms from the shoulders to the hands
    for s, hand in zip((-1, 1), hands):
        sh = top + Vector((s * 0.2, 0.0, -0.05))
        hand = Vector(hand)
        el = sh.lerp(hand, 0.5) + Vector((s * 0.06, 0.04, -0.1))
        _limb(p, sh, el, 0.055, shirt)
        _limb(p, el, hand, 0.045, skin)
    if pedal:
        v, crank = pedal
        foot = (Vector(feet[0]) + Vector(feet[1])) / 2
        legs = Part('legs')
        h0 = Vector((0, 0, 0))
        f = foot - Vector((hx, hy, hz))
        f.x = 0
        knee = Vector((0, min(0.0, f.y) - 0.2, max(0.0, f.z) + 0.1))
        _limb(legs, h0, knee, 0.075, 'v_sarong' if sarong else pants)
        _limb(legs, knee, f + Vector((0, 0, 0.05)), 0.06, 'v_sarong' if sarong else pants, r_end=0.05)
        legs.box((0.09, 0.22, 0.07), 'v_rubber', T(f.x, f.y - 0.05, f.z + 0.02))
        v.swing(legs, [(hx - 0.1, hy, hz), (hx + 0.1, hy, hz)], 0.32, (0.0, math.pi), 2 * math.pi * crank)
        return p
    # legs from the hips to the feet, the knees forward and up
    for s, foot in zip((-1, 1), feet):
        h0 = Vector((hx + s * 0.1, hy, hz))
        foot = Vector(foot)
        knee = Vector((h0.x + (foot.x - h0.x) * 0.3 + s * 0.04, min(h0.y, foot.y) - 0.18, max(h0.z, foot.z) + 0.12))
        if foot.y > hy - 0.15:
            knee = Vector((h0.x + s * 0.02, hy - 0.42, hz + 0.05))
        _limb(p, h0, knee, 0.075, 'v_sarong' if sarong else pants)
        _limb(p, knee, foot + Vector((0, 0, 0.05)), 0.06, 'v_sarong' if sarong else pants, r_end=0.05)
        p.box((0.09, 0.22, 0.07), 'v_rubber', T(foot.x, foot.y - 0.05, foot.z + 0.02))
    return p


def walker(p, at, facing=0.0, hands_z=0.85, shirt='v_mohom', pants='v_pants', head='hat', stride=0.35, v=None):
    """A standing person mid-stride (pulling a hand cart, leading a buffalo), facing -Y turned by facing degrees.
    With v, the legs walk: a part of their own swinging at the hips in turn, a cycle every 1.1 m."""
    m = T(*at) @ R(0, 0, facing)
    hip = m @ Vector((0, 0, 0.88))
    top = m @ Vector((0, -0.04, 1.42))
    p.sphere(0.17, pants, T(*hip) @ S(1.1, 0.9, 0.7), seg=8, rings=5)
    p.cyl(0.16, 0.19, 0.55, shirt, T(*hip.lerp(top, 0.5)) @ R(0, 0, facing) @ R(-6, 0, 0) @ S(1.0, 0.72, 1.0), seg=8)
    head_c = top + Vector((0, 0, 0.26))
    p.cyl(0.05, 0.05, 0.1, 'v_skin', T(*(top + Vector((0, 0, 0.08)))), seg=6)
    p.sphere(0.11, 'v_skin', T(*head_c) @ S(0.92, 1.0, 1.08), seg=10, rings=7)
    if head == 'hat':
        p.cyl(0.3, 0.04, 0.17, 'v_hat', T(*(head_c + Vector((0, 0, 0.12)))), seg=12, smooth=False)
    else:
        p.cap(0.115, 'v_hair', T(*(head_c + Vector((0, 0.01, 0.02)))), keep=lambda co: co.z > -0.01, seg=10, rings=6)
    for s in (-1, 1):
        sh = top + (m.to_3x3() @ Vector((s * 0.2, 0, -0.05)))
        hand = m @ Vector((s * 0.25, 0.25, hands_z))
        el = sh.lerp(hand, 0.5) + Vector((0, 0, -0.05))
        _limb(p, sh, el, 0.055, shirt)
        _limb(p, el, hand, 0.045, 'v_skin')
        if v is not None:
            continue
        h0 = m @ Vector((s * 0.1, 0, 0.86))
        foot = m @ Vector((s * 0.12, -s * stride, 0.0))
        knee = h0.lerp(foot, 0.5) + (m.to_3x3() @ Vector((0, -0.06, 0.02)))
        _limb(p, h0, knee, 0.075, pants)
        _limb(p, knee, foot + Vector((0, 0, 0.06)), 0.06, pants, r_end=0.05)
        p.box((0.09, 0.22, 0.07), 'v_rubber', T(*(foot + Vector((0, 0, 0.03)))) @ R(0, 0, facing))
    if v is not None:
        legs = Part('legs')
        knee = Vector((0, -0.04, -0.44))
        _limb(legs, Vector((0, 0, 0)), knee, 0.075, pants)
        _limb(legs, knee, Vector((0, 0, -0.8)), 0.06, pants, r_end=0.05)
        legs.box((0.09, 0.22, 0.07), 'v_rubber', T(0, -0.05, -0.83))
        v.swing(legs, [tuple(m @ Vector((s * 0.1, 0, 0.86))) for s in (-1, 1)], 0.42, (0.0, math.pi), 1.1)
    return p


# draught animals ------------------------------------------------------------------------------------------------------

def animal(v, y, kind='buffalo', x=0.0):
    """A buffalo (ควาย, dark, swept-back horns) or a zebu ox (วัว, tan, a hump and short upward horns), walking toward
    -Y, its shoulders at y. Real size: a buffalo 2.5 m long and 1.4 m at the shoulder, an ox 2.2 m and 1.3 m. Its legs
    are a part of their own that walks, swinging at the shoulders and hips, the diagonal pairs together."""
    p = v.body
    big = kind == 'buffalo'
    hide, dark = ('v_buffalo', 'v_buffalo_dark') if big else ('v_ox', 'v_ox_dark')
    L, H = (2.5, 1.38) if big else (2.2, 1.3)
    zb = H - 0.42
    yc = y + L * 0.38
    p.sphere(1.0, hide, T(x, yc, zb) @ S(0.5 if big else 0.42, L * 0.42, 0.42 if big else 0.38), seg=14, rings=9)
    # chest and haunch
    p.sphere(0.5, hide, T(x, y + 0.12, zb + 0.02) @ S(1.0, 0.9, 1.0), seg=10, rings=7)
    p.sphere(0.46, hide, T(x, yc + L * 0.3, zb + 0.04), seg=10, rings=7)
    if not big:
        p.sphere(0.22, hide, T(x, y + 0.08, zb + 0.4) @ S(0.9, 1.1, 1.0), seg=8, rings=5)  # the zebu's hump
        p.cyl(0.08, 0.04, 0.5, dark, T(x, y - 0.05, zb - 0.38) @ R(8, 0, 0) @ S(1.6, 1, 1), seg=6)  # dewlap
    # neck and head, low and forward
    neck0, head_c = Vector((x, y - 0.2, zb + 0.08)), Vector((x, y - 0.75, zb - 0.05))
    p.rod(neck0, head_c, 0.27 if big else 0.23, hide, seg=8, r_end=0.2 if big else 0.17)
    p.sphere(0.22, hide, T(*head_c) @ S(0.95, 1.25, 1.0), seg=10, rings=6)
    snout = head_c + Vector((0, -0.3, -0.12))
    p.sphere(0.15, 'v_muzzle' if not big else dark, T(*snout) @ S(1.1, 1.0, 0.9), seg=8, rings=5)
    for s in (-1, 1):
        p.sphere(0.03, 'v_hoof', T(x + s * 0.12, head_c.y - 0.12, head_c.z + 0.1), seg=5, rings=3)  # eyes
        p.box((0.16, 0.05, 0.08), hide, T(x + s * 0.24, head_c.y + 0.05, head_c.z + 0.1) @ R(0, s * 20, 0))  # ears
        base = Vector((x + s * 0.12, head_c.y + 0.02, head_c.z + 0.17))
        if big:
            tip = base + Vector((s * 0.42, 0.25, 0.12))
            p.polyline([base, base + Vector((s * 0.26, -0.02, 0.05)), tip], 0.05, 'v_horn', seg=5)
        else:
            p.rod(base, base + Vector((s * 0.12, -0.02, 0.22)), 0.04, 'v_horn', seg=5, r_end=0.015)
    # one leg, its pivot at the top, set at each shoulder and hip; it walks a cycle every 1.4 m (a buffalo's pace)
    legs = Part('legs')
    top_z = zb - 0.15
    knee = Vector((0, 0.04, -(top_z - zb * 0.45)))
    foot = Vector((0, 0, -(top_z - 0.06)))
    legs.rod((0, 0, 0.05), knee, 0.11 if big else 0.09, hide, seg=6, r_end=0.07)
    legs.rod(knee, foot, 0.07, hide, seg=6, r_end=0.055)
    legs.cyl(0.07, 0.065, 0.1, 'v_hoof', T(*foot) @ T(0, 0, -0.01), seg=6)
    at = [(x + s * 0.2, ly, top_z) for ly, s in ((y + 0.05, -1), (y + 0.05, 1), (yc + L * 0.32, -1), (yc + L * 0.32, 1))]
    v.swing(legs, at, 0.38, (0.0, math.pi, math.pi, 0.0), 1.4)
    # tail
    tail0 = Vector((x, yc + L * 0.42, zb + 0.15))
    p.polyline([tail0, tail0 + Vector((0, 0.12, -0.35)), tail0 + Vector((0.03, 0.1, -0.75))], 0.025, dark, seg=4)
    p.sphere(0.05, dark, T(*(tail0 + Vector((0.03, 0.1, -0.8)))) @ S(1, 1, 2), seg=5, rings=3)
    return p


def yoke(p, y, z, w=1.0, mat='teak_dark'):
    """The neck yoke (แอก) across the animal's neck, with its two pegs."""
    p.cyl(0.05, 0.05, w, mat, T(0, y, z) @ R(0, 90, 0) @ R(0, 0, 0), seg=6, smooth=False)
    for s in (-1, 1):
        p.rod((s * 0.24, y, z + 0.06), (s * 0.22, y, z - 0.3), 0.025, mat, seg=4)
    return p


def sacks(p, x, y, z, n=3, mat='canvas', size=0.42, seed=1):
    for i in range(n):
        ox = (i % 2) * size * 1.05 - size * 0.5
        oy = (i // 2) * size * 1.2
        oz = 0.0 if i < 4 else size * 0.55
        p.sphere(size / 2, mat if i % 3 else 'straw', T(x + ox, y + oy, z + size * 0.3 + oz) @ S(1.0, 1.25, 0.7),
                 seg=8, rings=5)
    return p
