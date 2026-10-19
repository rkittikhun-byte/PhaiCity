# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Hair styles of the concept sheets: spiky (men and boys), bun, bob (schoolgirls), ponytail, braid, short_neat,
messy, bald (monks). spec['hair'] = {'style': ..., 'color': 'hair'} or just the style name."""

import math

from .mesh import R, S, T


def _spec(spec):
    h = spec.get('hair', 'spiky')
    if isinstance(h, str):
        h = {'style': h}
    h.setdefault('color', 'hair')
    return h


def _cap(part, body, mat, front=0.32, back=-0.55, grow=1.07, side_low=-0.25):
    """Hair cap over the skull: front edge at front*r above the head centre, lower at the back and the sides."""
    hr = body.p['head']
    hz = body.head_z

    def keep(co):
        rel = (co - _c(hz))
        y = rel.y / (hr * grow)
        z = rel.z / (hr * grow)
        x = abs(rel.x) / (hr * grow)
        # Edge height blends from the forehead (front) to the nape (back); temples a bit lower.
        t = (y + 1) / 2  # 0 at the face, 1 at the back
        edge = front + (back - front) * t
        if x > 0.75 and y < 0.2:
            edge = min(edge, side_low)
        return z >= edge
    part.cap(hr * grow, mat, T(0, 0, hz) @ S(1.0, 0.97, 0.98), keep=keep, seg=16, rings=12)


def _c(hz):
    from mathutils import Vector
    return Vector((0, 0, hz))


def build(part, spec, body):
    h = _spec(spec)
    style = h['style']
    mat = h['color']
    hr = body.p['head']
    hz = body.head_z
    if style in ('bald', 'none'):
        return
    hat = spec.get('hat')
    hat_type = hat if isinstance(hat, str) else (hat or {}).get('type')
    if hat_type in ('hijab', 'astronaut'):
        return
    if style in ('spiky', 'messy', 'short_neat') and hat_type in ('cap', 'flat_cap', 'helmet', 'hardhat', 'kopiah', 'akha', 'ngob'):
        # Under a hat only the hair round the sides and the back shows.
        _cap(part, body, mat, front=0.18, back=-0.45, grow=1.04)
        return
    if style == 'spiky':
        _cap(part, body, mat, front=0.22, back=-0.45)
        # Tufts: cones pointing up and out round the crown, and a fringe over the forehead.
        tufts = [(0, 30, 0.95), (35, 35, 0.9), (-35, 35, 0.9), (70, 45, 0.85), (-70, 45, 0.85),
                 (110, 55, 0.85), (-110, 55, 0.85), (150, 55, 0.85), (-150, 55, 0.85), (180, 45, 0.9),
                 (0, 5, 0.9), (20, 10, 0.85), (-20, 10, 0.85)]
        for az, el, k in tufts:
            a, e = math.radians(az), math.radians(el)
            # az 0 is the back (+Y) ... direction from the head centre
            d = (math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e))
            base = T(d[0] * hr * 0.98, d[1] * hr * 0.98, hz + d[2] * hr * 0.98)
            part.cyl(hr * 0.2 * k, 0.0, hr * 0.42 * k, mat,
                     base @ _point(d) @ R(0, 0, 0), seg=5, smooth=False)
        for x in (-0.5, -0.2, 0.15, 0.45):
            part.cyl(hr * 0.14, 0.0, hr * 0.32, mat,
                     T(x * hr, -hr * 0.86, hz + hr * 0.42) @ R(150 + x * 20, x * -25, 0), seg=5, smooth=False)
    elif style == 'short_neat':
        _cap(part, body, mat, front=0.3, back=-0.4, grow=1.05)
        part.sphere(hr * 0.45, mat, T(-hr * 0.2, -hr * 0.62, hz + hr * 0.55) @ S(1.4, 0.6, 0.45), seg=10, rings=6)
    elif style == 'messy':
        _cap(part, body, mat, front=0.15, back=-0.6, grow=1.09)
        for az in range(0, 360, 40):
            a = math.radians(az)
            d = (math.sin(a) * 0.9, math.cos(a) * 0.9, 0.2)
            part.cyl(hr * 0.13, 0.0, hr * 0.3, mat, T(d[0] * hr, d[1] * hr, hz + 0.1 * hr) @ _point(d), seg=5,
                     smooth=False)
    elif style in ('bun', 'bun_grey', 'bun_flower'):
        _cap(part, body, mat, front=0.36, back=-0.5, grow=1.05)
        part.sphere(hr * 0.36, mat, T(0, hr * 0.62, hz + hr * 0.72), seg=12, rings=8)
        # Side-swept fringe.
        part.sphere(hr * 0.5, mat, T(hr * 0.25, -hr * 0.66, hz + hr * 0.5) @ R(0, -25, 0) @ S(1.3, 0.5, 0.45),
                    seg=10, rings=6)
        if style == 'bun_flower' or h.get('flower'):
            for i in range(5):
                a = 2 * math.pi * i / 5
                part.sphere(hr * 0.09, 'flower',
                            T(-hr * 0.55 + math.cos(a) * hr * 0.1, hr * 0.3, hz + hr * 0.75 + math.sin(a) * hr * 0.1),
                            seg=6, rings=4)
            part.sphere(hr * 0.06, 'yellow', T(-hr * 0.57, hr * 0.26, hz + hr * 0.75), seg=6, rings=4)
    elif style == 'bob':
        # A helmet of straight hair to the jaw, open over the face, with a straight fringe.
        part.cap(hr * 1.1, mat, T(0, 0, hz) @ S(1.0, 0.98, 1.0),
                 keep=lambda co: co.z > hz - hr * 0.62 and not (co.y < -hr * 0.45 and co.z < hz + hr * 0.3),
                 seg=16, rings=12)
    elif style == 'ponytail':
        _cap(part, body, mat, front=0.3, back=-0.5, grow=1.05)
        part.sphere(hr * 0.12, 'red', T(0, hr * 1.0, hz + hr * 0.15), seg=8, rings=5)
        part.cyl(hr * 0.07, hr * 0.2, hr * 0.85, mat, T(0, hr * 1.08, hz - hr * 0.45) @ R(15, 0, 0), seg=8)
        part.sphere(hr * 0.5, mat, T(hr * 0.22, -hr * 0.66, hz + hr * 0.5) @ R(0, -25, 0) @ S(1.3, 0.5, 0.45),
                    seg=10, rings=6)
    elif style == 'ponytail_high':
        _cap(part, body, mat, front=0.3, back=-0.5, grow=1.05)
        part.cyl(hr * 0.08, hr * 0.24, hr * 1.0, mat, T(0, hr * 1.12, hz - hr * 0.05) @ R(22, 0, 0), seg=8)
        part.sphere(hr * 0.12, 'hair', T(0, hr * 0.98, hz + hr * 0.45), seg=8, rings=5)
        part.sphere(hr * 0.5, mat, T(hr * 0.22, -hr * 0.66, hz + hr * 0.5) @ R(0, -25, 0) @ S(1.3, 0.5, 0.45),
                    seg=10, rings=6)
    elif style == 'braid':
        _cap(part, body, mat, front=0.3, back=-0.5, grow=1.05)
        side = h.get('side', -1)
        for i in range(6):
            part.sphere(hr * 0.15, mat, T(side * hr * 0.75, hr * 0.35 - i * hr * 0.06, hz - hr * 0.35 - i * hr * 0.22),
                        seg=8, rings=5)
        part.sphere(hr * 0.5, mat, T(hr * 0.22, -hr * 0.66, hz + hr * 0.5) @ R(0, -25, 0) @ S(1.3, 0.5, 0.45),
                    seg=10, rings=6)
    else:
        raise ValueError('unknown hair style ' + style)


def _point(d):
    """Rotation turning +Z towards direction d."""
    from .mesh import align_z
    return align_z(d)
