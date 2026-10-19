# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Props of the six regions (assets/concept/people_<region>.jpg)."""

import math

from mathutils import Matrix, Vector

from .mesh import R, S, T
from .props import prop, _basket, hull


def _leaf_tray(part, m, r=0.17, mat='leaf'):
    part.lathe([(r * 0.8, 0.0), (r, 0.03)], 'straw', m, seg=14, cap_bottom=True)
    part.cyl(r * 0.85, r * 0.85, 0.008, mat, m @ T(0, 0, 0.03), seg=12)


# north ----------------------------------------------------------------------------------------------------------

@prop
def paper_umbrella(part, e, body):
    """An open Bo Sang paper umbrella with painted flowers, held by its stick (grip at the origin)."""
    m = T(0, 0, 0.12) @ R(*e.get('tilt', (0, 0, 0)))
    part.lathe([(0.34, 0.0), (0.2, 0.06), (0.02, 0.1)], 'paper', m, seg=16, smooth=False)
    for i in range(16):
        a = 2 * math.pi * i / 16
        part.rod(tuple(m @ Vector((0, 0, 0.1))), tuple(m @ Vector((math.cos(a) * 0.34, math.sin(a) * 0.34, 0.0))),
                 0.003, 'bamboo', seg=3)
    for i, c in enumerate(('flower_red', 'flower_red', 'leaf')):
        a = 2 * math.pi * (i + 0.3) / 5
        part.sphere(0.035, c, m @ T(math.cos(a) * 0.2, math.sin(a) * 0.2, 0.065) @ S(1, 1, 0.3), seg=6, rings=3)
    part.cyl(0.008, 0.008, 0.45, 'bamboo', T(0, 0, -0.08), seg=4)


@prop
def brush(part, e, body):
    part.cyl(0.007, 0.006, 0.16, 'bamboo', T(0, 0, 0.02), seg=4)
    part.cyl(0.011, 0.002, 0.04, e.get('tip', 'black'), T(0, 0, 0.12), seg=5)


@prop
def carving_block(part, e, body):
    """A teak stump for carving with a half-carved block on it."""
    part.box((0.26, 0.26, 0.42), 'wood', T(0, 0, 0.21), bevel=0.02)
    part.box((0.18, 0.16, 0.24), 'wood_light', T(0, 0, 0.54), bevel=0.03)
    for z in (0.47, 0.55, 0.62):
        part.box((0.19, 0.17, 0.012), 'wood_dark', T(0, 0, z) @ R(0, 0, 20))


@prop
def mallet(part, e, body):
    part.cyl(0.014, 0.014, 0.2, 'wood', T(0, 0, 0.05), seg=6)
    part.box((0.11, 0.06, 0.06), 'wood_light', T(0, 0, 0.16), bevel=0.01)


@prop
def chisel(part, e, body):
    part.cyl(0.014, 0.012, 0.1, 'wood', T(0, 0, 0.0), seg=6)
    part.box((0.016, 0.006, 0.09), 'metal', T(0, 0, -0.09))


@prop
def steering_wheel(part, e, body):
    """A bus steering wheel held in both hands (the driver's sign)."""
    m = R(70, 0, 0)
    part.torus(0.17, 0.018, 'rubber', m, seg=18, seg_minor=5)
    part.cyl(0.04, 0.04, 0.03, 'charcoal', m, seg=10)
    for a in (90, 210, 330):
        r = math.radians(a)
        part.rod(tuple(m @ Vector((0, 0, 0))), tuple(m @ Vector((math.cos(r) * 0.16, math.sin(r) * 0.16, 0))),
                 0.012, 'charcoal', seg=4)


@prop
def sausage_tray(part, e, body):
    """Sai ua (ไส้อั่ว) coiled on a banana leaf in a flat basket, with a heap of sticky rice."""
    _leaf_tray(part, Matrix.Identity(4), 0.2)
    for i in range(10):
        a = i * 0.75
        rr = 0.05 + i * 0.009
        part.sphere(0.024, 'sausage', T(0.05 + math.cos(a) * rr, math.sin(a) * rr, 0.055), seg=6, rings=4)
    part.sphere(0.07, 'sticky_rice', T(-0.08, 0.02, 0.05) @ S(1, 1, 0.6), seg=8, rings=5, smooth=False)


# isan -----------------------------------------------------------------------------------------------------------

@prop
def kratip(part, e, body):
    """A woven sticky-rice basket (กระติบข้าว) with its lid and foot."""
    part.cyl(0.09, 0.1, 0.13, 'straw', T(0, 0, 0.07), seg=12)
    part.cyl(0.105, 0.105, 0.06, 'straw', T(0, 0, 0.13), seg=12)
    part.lathe([(0.07, -0.02), (0.08, 0.01)], 'straw_dark', seg=12)
    for z in (0.03, 0.07, 0.12, 0.15):
        part.lathe([(0.102, z), (0.102, z + 0.008)], 'straw_dark', seg=12)


@prop
def khaen(part, e, body):
    """A khaen (แคน): two rows of bamboo pipes through a wind chest, held up to the mouth."""
    part.sphere(0.045, 'wood', S(1.2, 0.8, 1), seg=8, rings=5)
    for i in range(7):
        h = 0.55 + 0.08 * (i % 4)
        for side in (-1, 1):
            x = (i - 3) * 0.012
            part.cyl(0.008, 0.008, h, 'bamboo', T(x, side * 0.012, h * 0.35), seg=5)
    part.cyl(0.012, 0.014, 0.08, 'wood_dark', T(0, -0.05, 0) @ R(90, 0, 0), seg=6)


@prop
def thread_spool(part, e, body):
    """A wooden spool wound with golden silk."""
    part.cyl(0.05, 0.05, 0.12, e.get('thread', 'gold'), R(0, 90, 0), seg=12)
    for x in (-0.07, 0.07):
        part.cyl(0.07, 0.07, 0.02, 'wood_dark', T(x, 0, 0) @ R(0, 90, 0), seg=12)


@prop
def mortar(part, e, body):
    """A clay mortar with a wooden pestle (ครกส้มตำ)."""
    part.lathe([(0.07, 0.0), (0.11, 0.05), (0.13, 0.14), (0.12, 0.17)], 'clay_dark', seg=14, cap_bottom=True)
    part.lathe([(0.11, 0.17), (0.09, 0.12)], 'clay', seg=14)
    part.cyl(0.02, 0.03, 0.26, 'wood', T(0.02, 0.0, 0.2) @ R(0, 18, 0), seg=6)


@prop
def fish_trap(part, e, body):
    """A bamboo fish trap (ไซ): a long woven bottle, carried by the side."""
    m = R(*e.get('tilt', (0, 0, 0)))
    part.lathe([(0.03, 0.2), (0.07, 0.12), (0.12, 0.0), (0.13, -0.15), (0.1, -0.3), (0.05, -0.36)], 'straw', m,
               seg=10, smooth=False)
    for z in (-0.25, -0.12, 0.0, 0.1):
        r = 0.12 if z < 0.05 else 0.08
        part.torus(r + 0.004, 0.006, 'straw_dark', m @ T(0, 0, z), seg=10, seg_minor=3)


# central --------------------------------------------------------------------------------------------------------

@prop
def rice_sheaf(part, e, body):
    """A sheaf of ripe rice, golden heads drooping."""
    for i in range(12):
        a = 2 * math.pi * i / 12
        x, y = math.cos(a) * 0.03, math.sin(a) * 0.03
        part.rod((x * 0.5, y * 0.5, -0.15), (x, y, 0.15), 0.005, 'leaf_dark' if i % 3 else 'olive', seg=3)
        part.rod((x, y, 0.15), (x * 3, y * 3 - 0.05, 0.22), 0.012, 'rice', seg=4, r_end=0.006)
    part.cyl(0.04, 0.04, 0.025, 'straw_dark', T(0, 0, 0.0), seg=8)


@prop
def noodle_cart(part, e, body):
    """A noodle cart (รถเข็นก๋วยเตี๋ยว): glass case, a big pot, bowls, a roof, two big wheels; handle at -Y."""
    part.box((0.5, 0.75, 0.04), 'wood', T(0, 0, 0.75), bevel=0.01)
    part.box((0.48, 0.5, 0.3), 'wood', T(0, 0.08, 0.58), bevel=0.01)
    part.box((0.4, 0.02, 0.22), 'glass', T(0, -0.18, 0.58))
    for x in (-0.24, 0.24):
        for y in (-0.36, 0.36):
            part.cyl(0.012, 0.012, 0.75, 'metal', T(x, y, 1.15), seg=5)
    part.box((0.62, 0.9, 0.04), 'wood_dark', T(0, 0, 1.53), bevel=0.01)
    part.cyl(0.13, 0.13, 0.2, 'steel', T(0, 0.18, 0.88), seg=14)
    part.cyl(0.14, 0.14, 0.02, 'metal', T(0, 0.18, 0.99), seg=14)
    for i in range(3):
        part.lathe([(0.03, 0.0), (0.06, 0.04)], 'white', T(-0.12 + i * 0.12, -0.25, 0.77), seg=10, cap_bottom=True)
    for i in range(5):
        part.cyl(0.006, 0.006, 0.18, 'bamboo', T(0.17 + (i % 2) * 0.01, -0.3 + i * 0.012, 0.86), seg=3)
    from .props_town import wheel
    for x in (-0.3, 0.3):
        wheel(part, T(x, 0.12, 0.28), 0.28, spokes=10)
    part.rod((-0.3, 0.12, 0.28), (0.3, 0.12, 0.28), 0.015, 'iron', seg=5)
    part.polyline([(-0.2, -0.36, 0.78), (-0.22, -0.6, 0.9)], 0.014, 'metal', seg=5)
    part.polyline([(0.2, -0.36, 0.78), (0.22, -0.6, 0.9)], 0.014, 'metal', seg=5)
    part.rod((-0.22, -0.6, 0.9), (0.22, -0.6, 0.9), 0.016, 'metal', seg=5)
    part.cyl(0.015, 0.02, 0.5, 'metal', T(0, -0.32, 0.25), seg=5)


@prop
def malai(part, e, body):
    """A jasmine garland (พวงมาลัย) hanging from the fingers: white buds, a red rose and tassels."""
    part.torus(0.05, 0.016, 'flower', T(0, 0, -0.06) @ R(90, 0, 0), seg=12, seg_minor=4)
    part.sphere(0.022, 'flower_red', T(0, -0.01, -0.12), seg=8, rings=5)
    for x in (-0.012, 0.012):
        part.polyline([(x, 0, -0.13), (x, 0, -0.2)], 0.006, 'flower', seg=3)
        part.sphere(0.012, 'leaf', T(x, 0, -0.205), seg=6, rings=4)


# east -----------------------------------------------------------------------------------------------------------

@prop
def durian(part, e, body):
    """A durian: a spiky oval with a stalk."""
    part.sphere(0.13, 'durian', S(0.95, 0.95, 1.15), seg=10, rings=8, smooth=False)
    for i in range(10):
        for j in range(4):
            a = 2 * math.pi * (i + 0.5 * j) / 10
            el = math.radians(-50 + j * 33)
            d = (math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el) * 1.15)
            from .mesh import align_z
            part.cyl(0.018, 0.0, 0.04, 'olive', T(d[0] * 0.125, d[1] * 0.125, d[2] * 0.125) @ align_z(d), seg=4,
                     smooth=False)
    part.cyl(0.012, 0.015, 0.07, 'wood_dark', T(0, 0, 0.17), seg=5)


@prop
def rambutan_basket(part, e, body):
    """A basket heaped with rambutans and leaves."""
    part.lathe([(0.12, -0.08), (0.17, 0.0), (0.19, 0.04)], 'straw', seg=14, cap_bottom=True)
    for z in (-0.04, 0.0):
        part.lathe([(0.17 + z * 0.4, z), (0.17 + z * 0.4, z + 0.01)], 'straw_dark', seg=14)
    for i in range(14):
        a = i * 2.4
        rr = 0.03 + 0.1 * ((i * 7) % 10) / 10
        part.sphere(0.03, 'rambutan', T(math.cos(a) * rr, math.sin(a) * rr, 0.05 + 0.02 * (i % 3)), seg=6, rings=4,
                    smooth=False)
    for a in (0.5, 2.5, 4.4):
        part.sphere(0.06, 'leaf', T(math.cos(a) * 0.15, math.sin(a) * 0.15, 0.07) @ S(1, 0.5, 0.15), seg=6,
                    rings=4)


@prop
def loupe(part, e, body):
    """A jeweller's loupe held to the eye."""
    part.cyl(0.022, 0.026, 0.03, 'charcoal', R(90, 0, 0), seg=10)
    part.cyl(0.018, 0.018, 0.004, 'glass', T(0, -0.016, 0) @ R(90, 0, 0), seg=10)


@prop
def gem_tweezers(part, e, body):
    """Tweezers holding a red gem (the east's ruby and sapphire trade)."""
    part.rod((0, 0, 0), (0.0, -0.02, 0.09), 0.004, 'steel', seg=3)
    part.rod((0.01, 0, 0), (0.004, -0.02, 0.09), 0.004, 'steel', seg=3)
    part.sphere(0.014, 'red', T(0.003, -0.022, 0.1), seg=6, rings=3, smooth=False)


@prop
def fish_basket(part, e, body):
    """An open bamboo basket of fresh fish, carried against the hip."""
    part.lathe([(0.12, -0.08), (0.17, 0.02), (0.18, 0.07)], 'straw', seg=12, cap_bottom=True, smooth=False)
    for z in (-0.04, 0.0, 0.04):
        part.lathe([(0.15 + z * 0.4, z), (0.15 + z * 0.4, z + 0.008)], 'straw_dark', seg=12)
    for i in range(4):
        a = i * 1.4
        m = T(math.cos(a) * 0.05, math.sin(a) * 0.06, 0.07 + 0.01 * i) @ R(0, 0, math.degrees(a) + 30)
        part.sphere(0.04, 'fish', m @ S(2.6, 0.7, 0.8), seg=8, rings=5)
        part.poly_prism([(0.0, 0.0), (0.05, 0.03), (0.05, -0.03)], 0.01, 'fish', m @ T(0.09, 0, 0) @ R(90, 0, 0))


@prop
def wrench(part, e, body):
    part.box((0.02, 0.012, 0.2), 'steel', T(0, 0, 0.06), bevel=0.003)
    part.torus(0.025, 0.009, 'steel', T(0, 0, 0.18) @ R(90, 0, 0), seg=10, seg_minor=3, arc=290)


@prop
def incense(part, e, body):
    """Three incense sticks held between pressed palms, a wisp of smoke."""
    for x in (-0.012, 0.0, 0.012):
        part.rod((x, 0, -0.02), (x * 1.5, 0, 0.24), 0.003, 'red', seg=3)
        part.sphere(0.005, 'lamp', T(x * 1.5, 0, 0.245), seg=4, rings=3)


# west -----------------------------------------------------------------------------------------------------------

@prop
def fishing_rod(part, e, body):
    """A bamboo fishing rod held in both hands, the line hanging from its tip."""
    tip = Vector((0.1, -0.85, 0.55))
    part.rod((0, 0.25, -0.12), tuple(tip), 0.012, 'bamboo', seg=5, r_end=0.004)
    part.rod(tuple(tip), tuple(tip + Vector((0, 0, -0.45))), 0.002, 'light_grey', seg=3)
    part.torus(0.012, 0.003, 'metal', T(*(tip + Vector((0, 0, -0.46)))) @ R(90, 0, 0), seg=6, seg_minor=3, arc=200)


@prop
def creel(part, e, body):
    """A small woven fish basket worn at the hip (ข้อง)."""
    part.lathe([(0.04, 0.12), (0.08, 0.05), (0.1, -0.05), (0.07, -0.12)], 'straw', seg=10, cap_bottom=True,
               smooth=False)
    part.torus(0.045, 0.006, 'straw_dark', T(0, 0, 0.12), seg=8, seg_minor=3)


@prop
def head_basket(part, e, body):
    """A basket of vegetables balanced on the head on a cloth ring."""
    part.torus(0.09, 0.03, 'white', None, seg=12, seg_minor=5)
    _basket(part, T(0, 0, 0.02), r=0.19, h=0.12)


@prop
def backstrap_loom(part, e, body):
    """A backstrap loom (กี่เอว) stretched in front of a woman sitting on the floor: a frame post, bars and red
    striped cloth. Origin at the weaver's lap."""
    part.box((0.5, 0.65, 0.012), 'cloth_red', T(0, -0.42, 0.18) @ R(-6, 0, 0))
    for i in range(6):
        part.box((0.5, 0.02, 0.014), 'navy', T(0, -0.2 - i * 0.09, 0.19 - i * 0.008))
    for y in (-0.08, -0.75):
        part.cyl(0.02, 0.02, 0.6, 'wood', T(0, y, 0.2) @ R(0, 90, 0), seg=6)
    for x in (-0.28, 0.28):
        part.box((0.06, 0.06, 0.42), 'wood', T(x, -0.8, 0.0), bevel=0.01)
    part.box((0.62, 0.05, 0.05), 'wood', T(0, -0.8, -0.17))


@prop
def bamboo_ladder(part, e, body):
    """A bamboo ladder standing on the ground."""
    H = 1.9
    for x in (-0.15, 0.15):
        part.cyl(0.025, 0.022, H, 'bamboo', T(x, 0, H / 2), seg=6)
    for i in range(7):
        z = 0.25 + i * 0.25
        part.cyl(0.014, 0.014, 0.34, 'bamboo', T(0, 0, z) @ R(0, 90, 0), seg=5)
        for x in (-0.15, 0.15):
            part.torus(0.03, 0.006, 'rope', T(x, 0, z), seg=8, seg_minor=3)


@prop
def bamboo_tube(part, e, body):
    """A bamboo water tube (กระบอกไม้ไผ่) slung at the hip."""
    part.cyl(0.055, 0.055, 0.32, 'bamboo', T(0, 0, -0.1), seg=10)
    for z in (-0.22, 0.02):
        part.torus(0.056, 0.008, 'straw_dark', T(0, 0, z), seg=10, seg_minor=3)


@prop
def water_jar(part, e, body):
    """A big glazed water jar (โอ่งมังกร, plain)."""
    part.lathe([(0.18, 0.0), (0.27, 0.15), (0.3, 0.32), (0.25, 0.5), (0.19, 0.58), (0.2, 0.62)], 'jar', seg=16,
               cap_bottom=True)
    part.lathe([(0.2, 0.62), (0.17, 0.6), (0.16, 0.45)], 'iron', seg=16)
    part.cyl(0.16, 0.16, 0.01, 'glass', T(0, 0, 0.55), seg=14)


# south ----------------------------------------------------------------------------------------------------------

@prop
def roti_tray(part, e, body):
    """A tray of roti (โรตี) squares on a banana leaf."""
    _leaf_tray(part, Matrix.Identity(4), 0.21)
    for i in range(6):
        x, y = -0.08 + (i % 3) * 0.08, -0.04 + (i // 3) * 0.08
        part.box((0.07, 0.07, 0.015), 'mustard', T(x, y, 0.045) @ R(0, 0, 8 * i), bevel=0.004)


@prop
def longtail_engine(part, e, body):
    """A long-tail boat engine (เครื่องเรือหางยาว): the motor and its long shaft with the propeller."""
    part.box((0.2, 0.3, 0.2), 'charcoal', T(0, 0.15, 0.0), bevel=0.02)
    part.box((0.14, 0.12, 0.08), 'red', T(0, 0.12, 0.13), bevel=0.01)
    part.cyl(0.03, 0.025, 1.3, 'metal', T(0, 0.85, -0.15) @ R(-80, 0, 0), seg=8)
    part.box((0.14, 0.02, 0.04), 'metal', T(0, 1.48, -0.26) @ R(0, 30, 0))
    part.cyl(0.02, 0.02, 0.4, 'metal', T(0, -0.15, 0.0) @ R(90, 0, 0), seg=6)
    part.cyl(0.03, 0.03, 0.1, 'red', T(0, -0.35, 0.0) @ R(90, 0, 0), seg=8)


@prop
def tapping_knife(part, e, body):
    """A rubber-tapping knife (มีดกรีดยาง): a short handle and a hooked blade."""
    part.cyl(0.014, 0.014, 0.1, 'wood', T(0, 0, 0.02), seg=6)
    part.polyline([(0, 0, 0.07), (0, -0.02, 0.12), (0, -0.05, 0.13), (0, -0.07, 0.11)], 0.006, 'metal', seg=3)


@prop
def coconut(part, e, body):
    """A green coconut, its top cut open."""
    part.sphere(0.1, 'coconut', S(1, 1, 1.05), seg=10, rings=8)
    part.cyl(0.05, 0.05, 0.01, 'coconut_in', T(0, -0.03, 0.095) @ R(-20, 0, 0), seg=10)


@prop
def korlae_prow(part, e, body):
    """The painted prow of a korlae boat (เรือกอและ), propped up for painting."""
    pts = [(0, 0.0), (0.55, 0.0), (0.62, 0.35), (0.5, 0.95), (0.42, 1.0), (0.36, 0.55), (0.0, 0.35)]
    part.poly_prism(pts, 0.05, 'red', R(90, 0, 0) @ R(0, 0, 0))
    part.poly_prism([(0.06, 0.05), (0.5, 0.05), (0.55, 0.32), (0.06, 0.3)], 0.054, 'blue', R(90, 0, 0))
    for (x, z, c) in ((0.2, 0.18, 'yellow'), (0.38, 0.2, 'flower'), (0.48, 0.55, 'yellow'), (0.3, 0.4, 'green')):
        part.sphere(0.05, c, T(x, -0.03, z) @ S(1, 0.3, 1), seg=8, rings=4)
    part.poly_prism([(0.45, 0.9), (0.6, 1.1), (0.5, 1.15)], 0.05, 'gold', R(90, 0, 0))
