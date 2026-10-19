# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""What a character wears: top, bottom, shoes, hat and extras (sash, bags, vest, apron...).

spec keys (all optional):
  top    = {'type': mandarin|collar|polo|tshirt|blouse|jacket|robe|kebaya|hoodie|suit, 'color', 'sleeve':
            none|short|elbow|long, 'tuck': bool, 'inner': colour under an open jacket, 'buttons': colour}
  bottom = {'type': shorts|knee|trousers|cargo|sin|pleated|pencil|sarong|overalls|robe|leggings, 'color',
            'stripes': [colours], 'belt': colour}
  shoes  = sandals|shoes|student|sneakers|boots|barefoot|heels|rubber_boots ; 'socks': colour
  hat    = {'type': ngob|headband|cap|flat_cap|helmet|hardhat|hijab|kopiah|akha|vr|astronaut|headlamp, 'color'}
  extras = ['sash', 'backpack', 'shoulder_bag', 'satchel', 'vest', 'apron', 'bib', 'camera', 'bow', 'belt',
            'shawl', 'delivery_box', 'back_basket', 'scarf_check', 'watch', 'lanyard'] or dicts {'type': ..., ...}
"""

import math

from mathutils import Vector

from .mesh import R, S, T

FOOT_H = 0.06


def _top(spec):
    t = dict(spec.get('top', {}))
    t.setdefault('type', 'mandarin')
    t.setdefault('color', 'indigo')
    t.setdefault('sleeve', 'short')
    return t


def _bottom(spec):
    b = dict(spec.get('bottom', {}))
    b.setdefault('type', 'knee')
    b.setdefault('color', 'brown')
    return b


def _extras(spec):
    out = []
    for e in spec.get('extras', []):
        out.append(e if isinstance(e, dict) else {'type': e})
    return out


def has_extra(spec, name):
    return any(e['type'] == name for e in _extras(spec))


# arms ---------------------------------------------------------------------------------------------------------------

SLEEVES = {'none': 0.0, 'short': 0.32, 'elbow': 0.55, 'three_quarter': 0.75, 'long': 0.97}


def top_material(spec, side):
    top = _top(spec)
    if top['type'] == 'robe' and side < 0:
        return 'skin'
    if SLEEVES.get(top['sleeve'], 0) == 0 and top['type'] != 'robe':
        return 'skin'
    return top['color']


def sleeve(spec, side):
    top = _top(spec)
    if top['type'] == 'robe':
        return None if side < 0 else (top['color'], 0.6, 1.25)
    length = SLEEVES.get(top['sleeve'], 0.32)
    if length == 0:
        return None
    wide = 1.18 if top['type'] in ('mandarin', 'kebaya', 'blouse', 'jacket', 'hoodie', 'suit') else 1.12
    return (top.get('sleeve_color', top['color']), length, wide)


def hand_material(spec):
    return spec.get('gloves', 'skin')


def arm_extras(spec, side):
    out = []
    if has_extra(spec, 'watch') and side > 0:
        def watch(part, body, a, b):
            p = a + b * 0.85
            part.cyl(body.p['arm_r'] * 0.95, body.p['arm_r'] * 0.95, 0.03, 'black', T(*p) @ _toward(b), seg=8)
        out.append(watch)
    return out


def _toward(d):
    from .mesh import align_z
    return align_z(d)


# legs ---------------------------------------------------------------------------------------------------------------

def leg_bands(spec):
    b = _bottom(spec)
    c = b['color']
    kind = b['type']
    bands = {
        'shorts':   [(0, 0.40, c, 1.18), (0.40, 1, 'skin', 1.0)],
        'knee':     [(0, 0.74, c, 1.22), (0.74, 1, 'skin', 0.95)],
        'trousers': [(0, 1.0, c, 1.12)],
        'cargo':    [(0, 1.0, c, 1.16)],
        'leggings': [(0, 1.0, c, 1.0)],
        'overalls': [(0, 1.0, c, 1.14)],
        'sin':      [(0, 1.0, 'skin', 0.92)],
        'sarong':   [(0, 1.0, 'skin', 0.92)],
        'robe':     [(0, 1.0, 'skin', 0.92)],
        'pleated':  [(0, 1.0, 'skin', 0.95)],
        'pencil':   [(0, 1.0, 'skin', 0.95)],
    }[kind]
    bands = [list(x) for x in bands]
    socks = spec.get('socks')
    shoes = spec.get('shoes', 'sandals')
    if shoes in ('boots', 'rubber_boots'):
        bands = _overlay(bands, 0.62 if shoes == 'rubber_boots' else 0.72, 1.0,
                         'rubber' if shoes == 'rubber_boots' else spec.get('boot_color', 'dark_brown'), 1.25)
    elif socks:
        bands = _overlay(bands, 0.8, 1.0, socks, 1.02)
    return [tuple(x) for x in bands]


def _overlay(bands, start, end, mat, k):
    out = []
    for s, e, m, kk in bands:
        if e <= start or s >= end:
            out.append([s, e, m, kk])
        else:
            if s < start:
                out.append([s, start, m, kk])
            if e > end:
                out.append([end, e, m, kk])
    out.append([start, end, mat, k])
    return sorted(out)


def foot(part, spec, body, ankle, shin_ang):
    shoes = spec.get('shoes', 'sandals')
    kid = spec.get('kind') in ('boy', 'girl')
    L = 0.15 if not kid else 0.135
    W = 0.085 if not kid else 0.078
    m = T(*ankle) @ R(-math.degrees(shin_ang), 0, 0)
    fwd = -0.03
    if shoes == 'barefoot':
        part.box((W * 0.9, L, FOOT_H * 0.8), 'skin', m @ T(0, fwd, -FOOT_H * 0.55), bevel=0.02)
    elif shoes == 'sandals':
        part.box((W * 0.9, L * 0.95, FOOT_H * 0.6), 'skin', m @ T(0, fwd, -FOOT_H * 0.5), bevel=0.02)
        part.box((W * 1.05, L * 1.05, 0.016), spec.get('sandal_color', 'dark_brown'), m @ T(0, fwd, -FOOT_H + 0.008),
                 bevel=0.005)
        part.box((W * 1.0, 0.03, 0.02), spec.get('sandal_color', 'dark_brown'), m @ T(0, fwd - 0.025, -FOOT_H * 0.45),
                 bevel=0.005)
    elif shoes in ('shoes', 'student', 'heels'):
        col = spec.get('shoe_color', 'black')
        part.box((W * 1.08, L * 1.08, FOOT_H * 0.95), col, m @ T(0, fwd - 0.005, -FOOT_H * 0.52), bevel=0.025)
        if shoes == 'heels':
            part.box((0.03, 0.03, 0.03), col, m @ T(0, 0.04, -FOOT_H * 0.9))
    elif shoes == 'sneakers':
        col = spec.get('shoe_color', 'grey')
        part.box((W * 1.12, L * 1.1, FOOT_H * 0.95), col, m @ T(0, fwd - 0.005, -FOOT_H * 0.5), bevel=0.025)
        part.box((W * 1.16, L * 1.14, 0.018), 'white', m @ T(0, fwd - 0.005, -FOOT_H + 0.009), bevel=0.006)
    elif shoes in ('boots', 'rubber_boots'):
        col = 'rubber' if shoes == 'rubber_boots' else spec.get('boot_color', 'dark_brown')
        part.box((W * 1.15, L * 1.1, FOOT_H * 1.1), col, m @ T(0, fwd - 0.005, -FOOT_H * 0.45), bevel=0.025)
        part.box((W * 1.18, L * 1.13, 0.02), 'rubber', m @ T(0, fwd - 0.005, -FOOT_H + 0.01), bevel=0.006)
    else:
        raise ValueError('unknown shoes ' + shoes)


# torso --------------------------------------------------------------------------------------------------------------

def torso_bands(spec, body, zs):
    top = _top(spec)
    bottom = _bottom(spec)
    n = len(zs) - 1
    if top['type'] == 'robe':
        return [top['color']] * n
    start = 3 if top.get('tuck') else (1 if top['type'] in ('mandarin', 'kebaya', 'hoodie', 'jacket') else 2)
    low = bottom['color']
    if bottom['type'] in ('sin', 'sarong', 'pleated', 'pencil', 'robe'):
        low = bottom['color']
    mats = []
    for i in range(n):
        mats.append(top['color'] if i >= start else low)
    if top['type'] == 'jacket' and top.get('inner'):
        pass
    if bottom['type'] == 'overalls':
        for i in range(n):
            if i < 5:
                mats[i] = bottom['color']
    return mats


def _front(body, z, extra=0.0):
    """Y of the torso front at height z."""
    return -(body.torso_r(min(max(z, body.hip_z), body.shoulder_z)) * body.p['depth']) - extra


def _ring(part, body, z, mat, thick=0.03, grow=1.06, seg=14):
    r = body.torso_r(min(max(z, body.hip_z), body.shoulder_z)) * grow
    part.lathe([(r, z - thick / 2), (r, z + thick / 2)], mat, S(1, body.p['depth'], 1), seg=seg)


def dress_body(part, spec, body):
    top = _top(spec)
    bottom = _bottom(spec)
    p = body.p
    d = p['depth']
    tc = top['color']
    neck_z = body.shoulder_z + 0.005
    # Collars and fronts.
    t = top['type']
    if t in ('mandarin', 'kebaya'):
        part.cyl(0.062, 0.058, 0.035, tc, T(0, 0, neck_z + 0.012), seg=10)
        for i in range(4):
            z = body.shoulder_z - 0.04 - i * (p['torso'] * 0.16)
            if z < body.hip_z + 0.02:
                break
            part.box((0.026, 0.01, 0.009), top.get('buttons', 'dark_brown'),
                     T(0, _front(body, z, 0.002), z))
    elif t in ('collar', 'polo', 'blouse', 'suit'):
        cc = top.get('collar', tc)
        for side in (-1, 1):
            part.poly_prism([(0, 0), (0.07, -0.03), (0.035, -0.07)], 0.012, cc,
                            T(side * 0.012, _front(body, neck_z - 0.02, -0.03), neck_z - 0.005) @
                            R(70, 0, 0) @ S(side, 1, 1))
        part.cyl(0.06, 0.056, 0.03, cc, T(0, 0, neck_z + 0.008), seg=10)
        if t in ('collar', 'blouse', 'suit'):
            for i in range(4 if t != 'polo' else 2):
                z = body.shoulder_z - 0.06 - i * 0.07
                if z < body.waist_z:
                    break
                part.sphere(0.0055, top.get('buttons', 'light_grey'), T(0, _front(body, z, 0.002), z), seg=6, rings=4)
        if top.get('pocket'):
            for side in (-1, 1) if top.get('pocket') == 'both' else (1,):
                z = body.shoulder_z - 0.1
                part.box((0.06, 0.008, 0.06), top.get('pocket_color', tc), T(side * 0.07, _front(body, z, 0.004), z))
    elif t in ('tshirt', 'hoodie'):
        part.cyl(0.06, 0.056, 0.025, tc, T(0, 0, neck_z + 0.005), seg=10)
        if t == 'hoodie':
            part.box((0.012, 0.01, p['torso'] * 0.8), 'charcoal',
                     T(0, _front(body, body.waist_z + 0.1, 0.004), body.hip_z + p['torso'] * 0.45))
    elif t == 'jacket':
        inner = top.get('inner', 'white')
        z0, z1 = body.hip_z + 0.02, body.shoulder_z - 0.01
        part.box((0.07, 0.012, z1 - z0), inner, T(0, _front(body, (z0 + z1) / 2, 0.0), (z0 + z1) / 2))
        for side in (-1, 1):
            part.poly_prism([(0, 0), (0.06, -0.02), (0.03, -0.09)], 0.012, tc,
                            T(side * 0.03, _front(body, neck_z - 0.03, -0.02), neck_z - 0.005) @
                            R(70, 0, 0) @ S(side, 1, 1))
    elif t == 'robe':
        # The upper robe over the left shoulder, a fold across the chest to the right hip.
        part.rod((0.13, _front(body, body.shoulder_z - 0.02, 0.01), body.shoulder_z),
                 (-0.12, _front(body, body.waist_z, 0.012), body.waist_z), 0.035, tc, seg=6)
        part.sphere(p['shoulder'] * 0.55, 'skin', T(-p['shoulder'] * 0.65, -0.01, body.shoulder_z - 0.035) @
                    S(1, 0.9, 0.7), seg=10, rings=6)
        part.lathe([(body.torso_r(body.hip_z) * 1.18, 0.16), (body.torso_r(body.hip_z) * 1.12, body.hip_z - 0.1),
                    (body.torso_r(body.hip_z) * 1.04, body.waist_z)], tc, S(1, d, 1), seg=14)
        part.lathe([(body.torso_r(body.hip_z) * 1.19, 0.15), (body.torso_r(body.hip_z) * 1.19, 0.18)],
                   spec.get('robe_hem', 'saffron'), S(1, d, 1), seg=14)
    # Skirts over the legs.
    bt = bottom['type']
    if bt in ('sin', 'sarong'):
        top_z = body.waist_z + 0.02
        hem = 0.09 if bt == 'sin' else 0.17
        r0 = body.torso_r(top_z) * 1.04
        r1 = body.torso_r(body.hip_z) * 1.2
        rings = [(r1, hem), (r1 * 0.97, (hem + body.hip_z) / 2), (body.torso_r(body.hip_z) * 1.08, body.hip_z),
                 (r0, top_z)]
        mats = [bottom['color']] * 3
        part.lathe(rings, mats, S(1, d * 1.02, 1), seg=16)
        stripes = bottom.get('stripes', [])
        for i, c in enumerate(stripes):
            z = hem + 0.03 + i * 0.03
            part.lathe([(r1 * 1.01, z), (r1 * 1.01, z + 0.013)], c, S(1, d * 1.02, 1), seg=16)
        if bottom.get('band'):
            z = hem + 0.035
            part.lathe([(r1 * 1.012, z), (r1 * 1.01, z + 0.07)], bottom['band'], S(1, d * 1.02, 1), seg=16)
        if bt == 'sarong' and bottom.get('plaid'):
            for i in range(8):
                a = 2 * math.pi * i / 8
                part.box((0.012, 0.012, body.hip_z - hem), bottom['plaid'],
                         T(math.cos(a) * r1 * 0.99, math.sin(a) * r1 * d * 0.99, (hem + body.hip_z) / 2) @
                         R(0, 0, math.degrees(a)))
    elif bt == 'pleated':
        top_z = body.waist_z + 0.02
        hem = body.hip_z - p['leg'] * 0.48
        r0 = body.torso_r(top_z) * 1.05
        r1 = body.torso_r(body.hip_z) * 1.55
        part.lathe([(r1, hem), (r0 * 1.12, body.hip_z), (r0, top_z)], bottom['color'], S(1, d * 1.05, 1), seg=12,
                   smooth=False)
    elif bt == 'pencil':
        top_z = body.waist_z + 0.02
        hem = body.hip_z - p['leg'] * 0.5
        r0 = body.torso_r(top_z) * 1.04
        r1 = body.torso_r(body.hip_z) * 1.12
        part.lathe([(r1 * 0.98, hem), (r1, body.hip_z), (r0, top_z)], bottom['color'], S(1, d * 1.04, 1), seg=14)
    if bottom.get('belt') or has_extra(spec, 'belt'):
        _ring(part, body, body.waist_z + 0.005, bottom.get('belt', 'dark_brown'), 0.025, 1.08)
        part.box((0.04, 0.01, 0.03), 'silver', T(0, _front(body, body.waist_z, 0.012), body.waist_z + 0.005))
    for e in _extras(spec):
        EXTRAS[e['type']](part, spec, body, e)


# extras -------------------------------------------------------------------------------------------------------------

def _sash(part, spec, body, e):
    c = e.get('color', 'sash')
    z = body.waist_z + 0.02
    _ring(part, body, z, c, 0.05, 1.12)
    side = e.get('side', -1)
    x = side * body.torso_r(z) * 0.55
    y = _front(body, z, 0.03)
    part.sphere(0.035, c, T(x, y, z), seg=8, rings=5)
    part.box((0.05, 0.02, 0.16), c, T(x - side * 0.01, y - 0.005, z - 0.1) @ R(0, side * 6, 0), bevel=0.006)
    part.box((0.045, 0.02, 0.12), c, T(x + side * 0.03, y + 0.004, z - 0.08) @ R(0, side * -10, 0), bevel=0.006)
    if e.get('check'):
        for dz in (-0.05, -0.1):
            part.box((0.052, 0.022, 0.012), e['check'], T(x - side * 0.01, y - 0.006, z + dz))


def _scarf_check(part, spec, body, e):
    e = dict(e)
    e.setdefault('color', 'cream')
    e.setdefault('check', 'plaid_red')
    _sash(part, spec, body, e)


def _backpack(part, spec, body, e):
    c = e.get('color', 'leather')
    p = body.p
    zc = body.hip_z + p['torso'] * 0.55
    back = body.torso_r(zc) * p['depth']
    h = p['torso'] * 0.75
    part.box((p['torso_r'] * 1.5, 0.11, h), c, T(0, back + 0.055, zc), bevel=0.02)
    part.box((p['torso_r'] * 1.2, 0.04, h * 0.45), e.get('pocket', 'brown'), T(0, back + 0.125, zc - h * 0.15),
             bevel=0.012)
    for side in (-1, 1):
        x = side * p['torso_r'] * 0.5
        part.polyline([(x, back + 0.02, zc + h * 0.4), (x, back * 0.2, body.shoulder_z + 0.03),
                       (x, _front(body, body.shoulder_z - 0.05, 0.012), body.shoulder_z - 0.05),
                       (x * 1.1, _front(body, body.waist_z + 0.08, 0.012), body.waist_z + 0.06)], 0.014, c, seg=4)


def _shoulder_bag(part, spec, body, e):
    c = e.get('color', 'black')
    side = e.get('side', 1)  # the bag hangs on this side (+1 = left)
    p = body.p
    z = body.waist_z - 0.02
    x = side * (p['torso_r'] + 0.05)
    part.box((0.06, e.get('w', 0.2), e.get('h', 0.17)), c, T(x, 0, z), bevel=0.012)
    part.polyline([(x, 0.0, z + 0.08), (side * p['shoulder'] * 0.7, 0.0, body.shoulder_z + 0.025)], 0.012, c, seg=4)


def _satchel(part, spec, body, e):
    c = e.get('color', 'leather')
    p = body.p
    z = body.hip_z + 0.02
    y = _front(body, z, 0.05)
    part.box((0.2, 0.07, 0.16), c, T(0.08, y, z), bevel=0.012)
    part.box((0.2, 0.02, 0.07), e.get('flap', 'brown'), T(0.08, y - 0.036, z + 0.05), bevel=0.006)
    pts = [(0.16, y + 0.01, z + 0.07), (-0.05, _front(body, body.waist_z + 0.12, 0.015), body.waist_z + 0.12),
           (-p['shoulder'] * 0.6, _front(body, body.shoulder_z - 0.04, 0.012), body.shoulder_z + 0.01),
           (-p['shoulder'] * 0.6, 0.06, body.shoulder_z + 0.02)]
    part.polyline(pts, 0.013, c, seg=4)


def _vest(part, spec, body, e):
    c = e.get('color', 'orange_vest')
    p = body.p
    z0, z1 = body.waist_z - 0.03, body.shoulder_z - 0.005
    zs = [z0, (z0 + z1) / 2, z1]
    prof = [(body.torso_r(z) * 1.07, z) for z in zs]
    part.lathe(prof, c, S(1, p['depth'] * 1.05, 1), seg=14)
    for z in (z0 + 0.05, z0 + 0.13):
        _ring(part, body, z, e.get('band', 'reflect'), 0.025, 1.1)


def _apron(part, spec, body, e):
    c = e.get('color', 'leather')
    p = body.p
    z0 = body.hip_z - p['leg'] * 0.45
    z1 = body.shoulder_z - 0.06
    y = _front(body, body.waist_z, 0.012)
    part.box((p['torso_r'] * 1.5, 0.014, z1 - z0), c, T(0, y, (z0 + z1) / 2) @ R(4, 0, 0), bevel=0.004)
    _ring(part, body, body.waist_z, c, 0.02, 1.07)
    part.box((p['torso_r'] * 0.7, 0.016, 0.06), e.get('pocket', 'dark_brown'), T(0, y - 0.01, body.waist_z - 0.07))


def _bib(part, spec, body, e):
    c = e.get('color', _bottom(spec)['color'])
    p = body.p
    z0, z1 = body.waist_z, body.shoulder_z - 0.06
    y = _front(body, (z0 + z1) / 2, 0.008)
    part.box((p['torso_r'] * 1.05, 0.016, z1 - z0), c, T(0, y, (z0 + z1) / 2), bevel=0.006)
    for side in (-1, 1):
        x = side * p['torso_r'] * 0.42
        part.polyline([(x, y, z1), (x, -0.02, body.shoulder_z + 0.02),
                       (x * 0.6, body.torso_r(body.waist_z) * p['depth'], body.waist_z + 0.05)], 0.014, c, seg=4)
        part.sphere(0.012, 'silver', T(x, y - 0.01, z1 - 0.01), seg=6, rings=4)


def _camera(part, spec, body, e):
    p = body.p
    z = body.shoulder_z - p['torso'] * 0.38
    y = _front(body, z, 0.045)
    part.box((0.11, 0.06, 0.075), 'black', T(0, y, z), bevel=0.008)
    part.cyl(0.026, 0.026, 0.04, 'charcoal', T(0, y - 0.045, z) @ R(90, 0, 0), seg=10)
    part.cyl(0.018, 0.018, 0.005, 'glass', T(0, y - 0.066, z) @ R(90, 0, 0), seg=10)
    for side in (-1, 1):
        part.rod((side * 0.05, y + 0.01, z + 0.02), (side * 0.06, -0.02, body.shoulder_z + 0.02), 0.009, 'black',
                 seg=4)


def _bow(part, spec, body, e):
    c = e.get('color', 'navy')
    z = body.shoulder_z - 0.02
    y = _front(body, z, 0.012)
    for side in (-1, 1):
        part.poly_prism([(0, 0), (0.04, 0.02), (0.04, -0.02)], 0.012, c, T(0, y, z) @ R(90, 0, 0) @ S(side, 1, 1))
        part.box((0.012, 0.01, 0.05), c, T(side * 0.012, y, z - 0.03) @ R(0, side * 15, 0))
    part.sphere(0.012, c, T(0, y - 0.004, z), seg=6, rings=4)


def _belt(part, spec, body, e):
    pass  # drawn with the bottom when has_extra(spec, 'belt')


def _shawl(part, spec, body, e):
    """Sabai: a cloth from the left shoulder across the chest to the right hip, its end hanging at the back."""
    c = e.get('color', 'rose')
    p = body.p
    pts = [(0.12, 0.08, body.shoulder_z + 0.005), (0.11, _front(body, body.shoulder_z - 0.05, 0.015),
                                                     body.shoulder_z - 0.04),
           (-0.04, _front(body, body.waist_z + 0.12, 0.018), body.waist_z + 0.1),
           (-p['torso_r'] * 0.95, -0.02, body.waist_z - 0.02)]
    for a, b in zip(pts, pts[1:]):
        part.rod(a, b, 0.032, c, seg=6)
    part.box((0.08, 0.02, 0.3), c, T(0.12, body.torso_r(body.waist_z) * p['depth'] + 0.02, body.waist_z + 0.1),
             bevel=0.005)


def _delivery_box(part, spec, body, e):
    c = e.get('color', 'tan')
    p = body.p
    zc = body.hip_z + p['torso'] * 0.62
    back = body.torso_r(zc) * p['depth']
    part.box((0.36, 0.3, 0.32), c, T(0, back + 0.16, zc), bevel=0.015)
    part.box((0.37, 0.31, 0.03), e.get('band', 'charcoal'), T(0, back + 0.16, zc + 0.12))
    _straps(part, body, back, zc, e.get('strap', 'black'))


def _straps(part, body, back, zc, c):
    p = body.p
    for side in (-1, 1):
        x = side * p['torso_r'] * 0.5
        part.polyline([(x, back, zc + 0.1), (x, 0.0, body.shoulder_z + 0.03),
                       (x, _front(body, body.shoulder_z - 0.05, 0.012), body.shoulder_z - 0.05),
                       (x, _front(body, body.waist_z + 0.06, 0.012), body.waist_z + 0.05)], 0.014, c, seg=4)


def _back_basket(part, spec, body, e):
    p = body.p
    zc = body.hip_z + p['torso'] * 0.5
    back = body.torso_r(zc) * p['depth']
    m = T(0, back + 0.17, zc)
    part.lathe([(0.12, -0.2), (0.17, 0.0), (0.2, 0.2)], 'straw', m, seg=12, cap_bottom=True)
    for z in (-0.12, 0.02, 0.16):
        part.lathe([(0.13 + (z + 0.2) * 0.17, z), (0.13 + (z + 0.2) * 0.17, z + 0.012)], 'straw_dark', m, seg=12)
    if e.get('fill', 'leaf'):
        for i in range(7):
            a = 2 * math.pi * i / 7
            part.sphere(0.07, e.get('fill', 'leaf'), m @ T(math.cos(a) * 0.1, math.sin(a) * 0.1, 0.21) @ S(1, 1, 0.6),
                        seg=6, rings=4)
        part.sphere(0.09, e.get('fill', 'leaf') if e.get('fill') != 'leaf' else 'leaf_dark', m @ T(0, 0, 0.24),
                    seg=6, rings=4)
    _straps(part, body, back, zc, 'leather')


def _watch(part, spec, body, e):
    pass  # drawn on the arm


def _lanyard(part, spec, body, e):
    p = body.p
    z = body.shoulder_z - p['torso'] * 0.42
    y = _front(body, z, 0.01)
    for side in (-1, 1):
        part.rod((side * 0.05, -0.02, body.shoulder_z + 0.02), (0, y, z + 0.02), 0.006, e.get('color', 'blue'), seg=4)
    part.box((0.05, 0.008, 0.07), 'white', T(0, y - 0.005, z - 0.015))


def _necklace(part, spec, body, e):
    part.torus(0.075, 0.008, e.get('color', 'gold'), T(0, -0.035, body.shoulder_z) @ R(-25, 0, 0) @ S(1, 1.2, 1),
               seg=12, seg_minor=4)


def _belt_bag(part, spec, body, e):
    z = body.waist_z - 0.02
    x = e.get('side', 1) * body.torso_r(z) * 0.95
    part.box((0.06, 0.09, 0.12), e.get('color', 'charcoal'), T(x, -0.03, z), bevel=0.01)


EXTRAS = {
    'sash': _sash, 'scarf_check': _scarf_check, 'backpack': _backpack, 'shoulder_bag': _shoulder_bag,
    'satchel': _satchel, 'vest': _vest, 'apron': _apron, 'bib': _bib, 'camera': _camera, 'bow': _bow, 'belt': _belt,
    'shawl': _shawl, 'delivery_box': _delivery_box, 'back_basket': _back_basket, 'watch': _watch,
    'lanyard': _lanyard, 'necklace': _necklace, 'belt_bag': _belt_bag,
}


# hats ---------------------------------------------------------------------------------------------------------------

def hat(part, spec, body):
    h = spec.get('hat')
    if not h:
        return
    if isinstance(h, str):
        h = {'type': h}
    hr = body.p['head']
    hz = body.head_z
    t = h['type']
    c = h.get('color')
    if t == 'ngob':
        part.lathe([(hr * 1.65, hz + hr * 0.8), (hr * 1.1, hz + hr * 1.08), (hr * 0.4, hz + hr * 1.5),
                    (0.001, hz + hr * 1.6)], c or 'straw', seg=20, smooth=False)
        part.lathe([(hr * 1.66, hz + hr * 0.78), (hr * 1.66, hz + hr * 0.82)], 'straw_dark', seg=20)
        part.lathe([(hr * 0.9, hz + hr * 0.62), (hr * 0.92, hz + hr * 0.98)], 'straw_dark', seg=14, smooth=False)
        for i in range(10):
            a = 2 * math.pi * i / 10
            part.box((0.01, 0.01, hr * 0.42), 'wood_dark',
                     T(math.cos(a) * hr * 0.92, math.sin(a) * hr * 0.92, hz + hr * 0.8))
    elif t == 'headband':
        c = c or 'sash'
        part.torus(hr * 1.0, hr * 0.1, c, T(0, 0, hz + hr * 0.38) @ R(-6, 0, 0) @ S(1.0, 0.98, 1.0), seg=16,
                   seg_minor=5)
        side = h.get('side', -1)
        k = T(side * hr * 0.8, hr * 0.55, hz + hr * 0.45)
        part.sphere(hr * 0.13, c, k, seg=8, rings=5)
        part.box((hr * 0.12, hr * 0.32, hr * 0.06), c, k @ T(side * hr * 0.12, -hr * 0.1, hr * 0.1) @ R(25, 0, -side * 30))
        part.box((hr * 0.12, hr * 0.32, hr * 0.06), c, k @ T(side * hr * 0.1, hr * 0.1, -hr * 0.12) @ R(-30, 0, side * 40))
    elif t in ('cap', 'flat_cap'):
        c = c or 'navy'
        if t == 'cap':
            part.cyl(hr * 1.02, hr * 1.14, hr * 0.56, c, T(0, 0, hz + hr * 0.84) @ R(-8, 0, 0), seg=14, smooth=False)
            part.cyl(hr * 1.035, hr * 1.035, hr * 0.12, h.get('band', 'black'), T(0, 0, hz + hr * 0.62) @ R(-8, 0, 0),
                     seg=14)
            part.sphere(hr * 0.07, h.get('badge', 'gold'), T(0, -hr * 1.05, hz + hr * 0.7), seg=6, rings=4)
        else:
            part.cap(hr * 1.1, c, T(0, 0, hz + hr * 0.1) @ S(1, 1, 0.85), keep=lambda co: co.z > hz + hr * 0.38,
                     seg=14, rings=10)
        part.cyl(hr * 0.75, hr * 0.75, 0.016, h.get('visor', 'black' if t == 'cap' else c),
                 T(0, -hr * 0.95, hz + hr * 0.48) @ R(-14, 0, 0) @ S(1, 0.6, 1), seg=12)
    elif t == 'helmet':
        c = c or 'silver'
        part.cap(hr * 1.2, c, T(0, 0, hz + hr * 0.08),
                 keep=lambda co: co.z > hz - hr * 0.2 and not (co.y < -hr * 0.55 and co.z < hz + hr * 0.42),
                 seg=16, rings=12)
        part.lathe([(hr * 1.2, hz + hr * 0.3), (hr * 1.22, hz + hr * 0.36)], h.get('trim', 'grey'), seg=16)
    elif t == 'hardhat':
        c = c or 'hardhat'
        part.cap(hr * 1.13, c, T(0, 0, hz + hr * 0.1), keep=lambda co: co.z > hz + hr * 0.22, seg=16, rings=12)
        part.lathe([(hr * 1.3, hz + hr * 0.24), (hr * 1.12, hz + hr * 0.34)], c, seg=16)
        part.box((hr * 0.18, hr * 1.5, hr * 0.1), c, T(0, 0, hz + hr * 1.18), bevel=0.01)
    elif t == 'hijab':
        c = c or 'teal'
        part.cap(hr * 1.12, c, T(0, 0, hz),
                 keep=lambda co: not (co.y < -hr * 0.3 and abs(co.x) < hr * 0.68 and hz - hr * 0.7 < co.z < hz + hr * 0.55),
                 seg=16, rings=12)
        sz = body.shoulder_z
        tr = body.p['torso_r']
        part.lathe([(tr * 1.35, sz - 0.2), (tr * 1.25, sz - 0.05), (hr * 0.95, sz + 0.06), (hr * 0.9, hz - hr * 0.55)],
                   c, S(1, 0.85, 1), seg=16)
    elif t == 'kopiah':
        c = c or 'white'
        part.cyl(hr * 0.95, hr * 0.95, hr * 0.44, c, T(0, 0, hz + hr * 0.88), seg=14)
        part.lathe([(hr * 0.96, hz + hr * 0.7), (hr * 0.96, hz + hr * 0.75)], 'light_grey', seg=14)
    elif t == 'akha':
        c = c or 'black'
        part.lathe([(hr * 1.02, hz + hr * 0.2), (hr * 1.12, hz + hr * 0.9), (hr * 1.0, hz + hr * 1.45),
                    (0.001, hz + hr * 1.55)], c, seg=16)
        for row, z in enumerate((0.35, 0.6, 0.85, 1.1, 1.3)):
            n = 14
            for i in range(n):
                a = 2 * math.pi * (i + row * 0.5) / n
                rr = hr * (1.07 + 0.05 * math.sin(row))
                part.sphere(hr * 0.1, 'silver', T(math.cos(a) * rr, math.sin(a) * rr, hz + hr * z), seg=6, rings=4)
        part.lathe([(hr * 1.06, hz + hr * 0.45), (hr * 1.08, hz + hr * 0.5)], 'red', seg=16)
        for side in (-1, 1):
            for j in range(4):
                part.sphere(hr * 0.07, 'silver', T(side * hr * 1.05, -hr * 0.1, hz - hr * 0.1 - j * hr * 0.16), seg=6,
                            rings=4)
    elif t == 'vr':
        part.box((hr * 1.45, hr * 0.5, hr * 0.5), c or 'charcoal', T(0, -hr * 0.88, hz - hr * 0.05), bevel=0.02)
        part.torus(hr * 1.02, hr * 0.06, 'black', T(0, 0, hz) @ S(1, 0.98, 1), seg=16, seg_minor=4)
    elif t == 'astronaut':
        c = c or 'robot_white'
        part.cap(hr * 1.35, c, T(0, 0, hz),
                 keep=lambda co: not (co.y < -hr * 0.6 and abs(co.x) < hr * 0.85 and abs(co.z - hz) < hr * 0.75)
                 and co.z > hz - hr * 1.0, seg=18, rings=14)
        part.torus(hr * 1.0, hr * 0.07, 'robot_orange', T(0, -hr * 0.98, hz) @ R(90, 0, 0) @ S(1, 1.05, 1), seg=18,
                   seg_minor=5)
        part.sphere(hr * 0.12, 'robot_orange', T(hr * 1.3, -hr * 0.2, hz), seg=8, rings=5)
    elif t == 'headlamp':
        part.torus(hr * 1.0, hr * 0.06, h.get('band', 'leather'), T(0, 0, hz + hr * 0.4) @ R(-8, 0, 0), seg=16,
                   seg_minor=4)
        part.cyl(hr * 0.16, hr * 0.16, hr * 0.18, 'charcoal', T(0, -hr * 1.06, hz + hr * 0.48) @ R(90, 0, 0), seg=10)
        part.cyl(hr * 0.12, hr * 0.12, 0.004, 'lamp', T(0, -hr * 1.16, hz + hr * 0.48) @ R(90, 0, 0), seg=10)
    else:
        raise ValueError('unknown hat ' + t)
